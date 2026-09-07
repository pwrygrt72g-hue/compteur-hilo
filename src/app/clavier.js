/* ══════════════════════ CLAVIER ══════════════════════ */
document.addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") return;
  // L'onglet est en pause : une seule touche répond, celle qui reprend.
  if (PAUSE.actif) { if (e.key === "Enter" || e.key === " ") { reprendreOnglet(); e.preventDefault(); } return; }
  if (!$("modale").hidden) {
    if (e.key === "Escape") { $("modale").hidden = true; return; }
    // 🚨 LA LEÇON ENSEIGNAIT DES TOUCHES QU'ELLE N'ACCEPTAIT PAS. Son étape 3 demande dix
    // fois d'annoncer −1 / 0 / +1 sur les mêmes boutons que l'exercice, et ce fichier
    // sortait d'office dès qu'une modale était ouverte : seul Échap survivait. On mappe donc
    // les mêmes touches sur les mêmes réponses — par VALEUR pour les flèches, par POSITION
    // pour les chiffres, exactement comme l'exercice quinze lignes plus bas.
    const rep = $("modale").querySelector(".reponses");
    if (rep && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const bts = [...rep.querySelectorAll("button:not([disabled])")];
      const parValeur = v => bts.find(b => +b.dataset.v === v);
      // L'espace n'est pris que si le focus n'est PAS sur une commande : sur un bouton, le
      // navigateur le presse lui-même, et on répondrait à deux endroits à la fois.
      const a = document.activeElement, natif = a && /^(BUTTON|INPUT|SELECT|TEXTAREA|A)$/.test(a.tagName);
      let cible = null;
      if (e.key === "ArrowLeft") cible = parValeur(-1);
      else if (e.key === "ArrowRight") cible = parValeur(1);
      else if (e.key === "ArrowDown" || (e.key === " " && !natif)) cible = parValeur(0);
      else if (/^[1-9]$/.test(e.key)) cible = bts[+e.key - 1];
      if (cible) { cible.click(); e.preventDefault(); }
    }
    return;
  }
  if (vue === "exercices" && X.encours && !X.pause) {
    if (X.genre === "chrono") { if (e.key === " " || e.key === "ArrowRight" || e.key === "Enter") { suivante(); e.preventDefault(); } return; }
    if (e.key === "ArrowLeft") { repondre(-1); e.preventDefault(); }
    else if (e.key === "ArrowRight") { repondre(1); e.preventDefault(); }
    else if (e.key === "ArrowDown" || e.key === " ") { repondre(0); e.preventDefault(); }
    else if (/^[1-5]$/.test(e.key)) { const b = $("reponses").children[+e.key - 1]; if (b) repondre(+b.dataset.v); }
  } else if (vue === "strategie" && !STR.bloque) {
    const m = { t: "H", r: "S", b: "D", s: "P", a: "U" }[e.key.toLowerCase()];
    const bt = m && $("sBoutons").querySelector(`[data-a="${m}"]`);
    if (bt && !bt.disabled) { repondreStrat(m); e.preventDefault(); }
  } else if (vue === "concentration" && CO.encours) {
    if (e.key === " " || e.key === "Enter") { detendre(); e.preventDefault(); }
  } else if (vue === "table") {
    const k = e.key.toLowerCase();
    if (k === "t") $("bTire").click(); else if (k === "r") $("bReste").click();
    else if (k === "d") $("bDouble").click(); else if (k === "s") $("bSepare").click();
    else if (k === "a") $("bAbandon").click(); else if (e.key === "Enter" || e.key === " ") { $("bDonne").click(); e.preventDefault(); }
    // Les jetons : 1 à 6 de gauche à droite dans le rack, Retour arrière reprend le dernier posé.
    else if (/^[1-6]$/.test(e.key)) poserJetonRang(+e.key);
    // Par le BOUTON, pas la fonction : à plusieurs (reseau.js), reprendre un jeton passe par l'hôte.
    else if (e.key === "Backspace") { $("bRetirer").click(); e.preventDefault(); }
  }
});

/* ══════════════════════ L'ONGLET QU'ON QUITTE ══════════════════════
   🚨 CHANGER D'ONGLET DÉTRUISAIT UNE SESSION D'ENTRAÎNEMENT. Chrome bride `setTimeout` à
   une seconde au moins dans un onglet caché : les cartes continuaient de défiler — à un
   rythme faux, et invisibles — pendant qu'on lisait un courriel. On revenait avec un compte
   mort, et en Concentration on revenait GRILLÉ pour des regards qu'on n'a jamais vus.
   Il n'y avait pas un seul `visibilitychange` dans tout src/app.

   On met en pause, et on NE REDÉMARRE JAMAIS TOUT SEUL : au retour il faut le temps de
   retrouver son compte, et une carte qui repart sous les yeux au moment où l'on revient
   coûte exactement la session qu'on voulait sauver.

   La table (#v-table) n'est pas concernée : rien n'y tourne contre le joueur, c'est à lui
   de jouer. Elle a sa propre défense, le `beforeunload` en bas de ce fichier. */
const PAUSE = { actif: false, quoi: null, t0: 0, ecoule: 0 };
function mettreEnPause() {
  if (PAUSE.actif) return;
  if (vue === "exercices" && X.encours && !X.pause) PAUSE.quoi = "exercices";
  else if (vue === "concentration" && CO.encours) PAUSE.quoi = "concentration";
  else return;
  PAUSE.actif = true; PAUSE.t0 = performance.now();
  clearTimeout(X.minuteur); clearTimeout(CO.minuteur); clearTimeout(CO.minuteurBulle);
  if (PAUSE.quoi === "exercices") {
    // Le chrono n'a pas de minuteur à couper : son intervalle LIT `X.depart`, et se tait
    // quand il vaut 0 (`if (X.depart)`). On garde le temps déjà couru et on l'efface :
    // l'affichage se fige, et la reprise repose un départ décalé de l'absence.
    PAUSE.ecoule = X.depart ? performance.now() - X.depart : 0; X.depart = 0;
  } else {
    // La bulle en cours est refermée SANS pénalité : on ne fait pas payer une question
    // posée à quelqu'un qui n'était pas devant son écran.
    if (CO.occupe) fermerEvt();
  }
  $("pauseTitre").textContent = PAUSE.quoi === "concentration" ? "Tu as quitté la table." : "Tu as quitté l'onglet.";
  $("pauseOnglet").hidden = false; fondInerte();
  setTimeout(() => $("pauseReprendre").focus(), 30);
}
/* Rendre à la carte QUI EST DÉJÀ À L'ÉCRAN son intervalle entier, sans en tirer une
   nouvelle. `suivante()` et `suivanteCo()` commencent toutes deux par AVANCER : les appeler
   à la reprise volerait sa carte à quelqu'un qui a changé d'onglet une demi-seconde après
   son apparition — précisément la carte qu'on voulait sauver. Quatre lignes reprises telles
   quelles de exercices.js et concentration.js : la barre de progression, et le minuteur. */
function rearmer(barre, ms, suite) {
  const b = $(barre);
  b.style.transition = "none"; b.style.width = "0";
  requestAnimationFrame(() => requestAnimationFrame(() => { b.style.transition = `width ${ms}ms linear`; b.style.width = "100%"; }));
  return setTimeout(suite, ms);
}
function reprendreOnglet() {
  if (!PAUSE.actif) return;
  const dt = performance.now() - PAUSE.t0;
  PAUSE.actif = false; $("pauseOnglet").hidden = true; fondInerte();
  if (PAUSE.quoi === "exercices" && X.encours) {
    X.depart = PAUSE.ecoule ? performance.now() - PAUSE.ecoule : 0;
    X.t0 = performance.now();                       // le délai de réponse repart d'ici
    // Le mode « chrono » n'a pas de minuteur : c'est le joueur qui fait défiler. Rien à
    // ré-armer — et l'appeler lui ferait sauter une carte.
    if (X.genre === "defilement") X.minuteur = rearmer("exBarre", +$("eVitesse").value, suivante);
  } else if (PAUSE.quoi === "concentration" && CO.encours) {
    // Tous les repères de temps sont décalés de l'absence : la durée finale, l'horodatage
    // des signes, la date du prochain événement. Sans ça, le bilan compte le temps passé
    // ailleurs, et le chef de table pose sa question dans la seconde du retour.
    CO.depart += dt; CO.dernier += dt;
    CO.prochain = performance.now() + 2500 + alea(3000);
    // La caméra a cessé de tourner (requestAnimationFrame s'arrête dans un onglet caché) :
    // la dernière image date d'avant. La comparer à celle du retour ferait un écart énorme
    // et un faux signe. On repart d'une page blanche.
    CO.prec = null; CO.fige = 0;
    CO.minuteur = rearmer("coBarre", +$("coVitesse").value, suivanteCo);
  }
  PAUSE.quoi = null;
}
$("pauseReprendre").onclick = reprendreOnglet;
document.addEventListener("visibilitychange", () => { if (document.hidden) mettreEnPause(); });

/* ── L'AIDE QUI S'ÉTEINT, ET QUI LE DIT (une seule fois) ────────────────────
   La stratégie de base est allumée d'office les vingt premières mains (table.js,
   `aideActive`) puis se retire. La règle est bonne, la transition était MUETTE : celui
   qui s'appuyait dessus la voit disparaître au milieu d'une main et croit à une panne.
   On le dit UNE fois — le drapeau vit dans DB, donc il traverse les rechargements — et
   on nomme le bouton qui la ramène, pour que ce soit une information, pas une punition.
   Greffé sur « sabot:manche-fin », émis juste après l'incrément de DB.mainsJouees. */
document.addEventListener("sabot:manche-fin", () => {
  if (DB.conseil !== "auto" || DB.aideRetiree) return;
  if ((DB.mainsJouees || 0) < 20) return;
  DB.aideRetiree = true; garder();
  bandeau("Vingt mains jouées — l'aide se retire. Le bouton « Aide à la décision » la ramène quand tu veux.", 6000);
});

/* ── RECHARGER EN PLEIN SABOT ───────────────────────────────────────────────
   Le tapis et la mise survivent à un rechargement, le SABOT non : on repart d'un sabot
   neuf, et le compte tenu depuis vingt mains part avec. Un avertissement, et seulement
   quand il y a quelque chose à perdre — `sabotEntame()` est la définition de la maison
   (salon.js), la même qui fait dire « Reprendre » à la porte de la table. Une confirmation
   à CHAQUE départ serait pire que le problème qu'elle règle.
   Le navigateur écrit son propre texte : on ne peut que dire qu'il y a lieu de demander. */
addEventListener("beforeunload", e => { if (sabotEntame()) { e.preventDefault(); e.returnValue = ""; } });
