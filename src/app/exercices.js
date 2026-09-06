/* ══════════════════════ EXERCICES ══════════════════════ */
const X = { genre: "defilement", sabot: [], cartes: [], cachees: [], i: -1, minuteur: null, rc: 0, rep: [], encours: false,
  jeux: 6, t0: 0, delais: [], controles: [], prochainControle: 0, pause: false, depart: 0, chrono: null, silence: false, par: 1 };

/* ── LES REPÈRES DE NIVEAU ────────────────────────────────────────────────
   L'application MESURE depuis le premier jour et n'a jamais dit ce qui est BON.
   « Meilleur jeu de 52 : 30,1 s », « Réaction moyenne : 1,2 s » : bien ? mal ?
   Sans barème on ne sait pas si on progresse, et un entraîneur qui ne situe pas
   ne sert qu'à moitié — c'était, au 6 septembre, le plus large trou de la maison :
   pas une occurrence de seuil, d'objectif ou de palier dans tout src/app.

   ⚠️ CETTE TABLE EST LA SEULE. Le bureau (progres.js, sous chaque tuile) et les
   trois bilans y lisent les MÊMES paliers. Deux barèmes qui se contrediraient d'un
   écran à l'autre valent moins que pas de barème du tout : on ne saurait plus lequel
   croire. progres.js est concaténé APRÈS ce fichier (build.mjs, MORCEAUX) : il la voit.

   Un palier = [borne, nom, ton, phrase?]. On descend la liste et le PREMIER qui
   accepte la valeur gagne ; `null` est le reste, il ne refuse rien.
   `sens:"bas"` = plus petit est meilleur (des secondes) ; `sens:"haut"` = plus grand
   est meilleur (un pourcentage).

   Le ton est ÉCRIT ici plutôt que déduit du rang, et il y en a TROIS, pas deux.
   La maison peint en jade/cinabre ce qui est juste ou faux (rReel, estNote) : c'est
   un vrai/faux, pas une échelle. Sur une échelle, peindre en rouge les trois quarts
   du chemin d'un débutant dirait « raté » là où il faut lire « pas encore ». */
const REPERES = {
  // Le sabot chrono : le temps RAMENÉ à un jeu de 52 cartes — la seule mesure
  // comparable d'une session à l'autre, puisqu'on ne compte jamais le même nombre de
  // cartes. 25 à 30 s pour 52 cartes est le repère classique du comptage utilisable
  // en salle : au-delà, le croupier distribue plus vite qu'on ne compte.
  jeu52: { objectif: 30, unite: " s", quoi: "compter un jeu de 52", sens: "bas",
    paliers: [[22, "Rythme de pro", "bien"], [30, "Rythme de salle", "bien"],
              [40, "Tu tiens", ""], [60, "Tu apprends", ""], [null, "Premiers pas", "mal"]] },
  // Le défilement : le délai entre la carte qui tombe et TON CLIC.
  // ⚠️ Ce n'est pas la même grandeur que le jeu de 52 ci-dessus, et l'écart entre les
  // deux objectifs (1 s par carte ici, 0,58 s là-haut) n'est PAS une incohérence à
  // « corriger » : là-haut on compte en silence, ici il faut en plus viser un bouton
  // et le pousser. Le geste coûte, et il ne coûte rien en salle.
  reaction: { objectif: 1, unite: " s", quoi: "annoncer une carte", sens: "bas",
    paliers: [[.6, "Rythme de pro", "bien"], [1, "Rythme de salle", "bien"],
              [1.5, "Tu tiens", ""], [2.2, "Tu apprends", ""], [null, "Premiers pas", "mal"]] },
  // L'estimation : la PART de manches jugées justes. « Juste » vaut un demi-jeu
  // d'écart ou moins (repondreEstimation) — c'est la tolérance, et c'est elle qu'on
  // annonce comme l'objectif. Les bornes 70 et 90 sont celles que finEstimation
  // appliquait déjà EN DUR : elles ont été déplacées ici, pas réinventées.
  estimation: { objectif: 70, unite: " %", quoi: "rester dans le demi-jeu de tolérance", sens: "haut",
    paliers: [[90, "Œil de croupier", "bien", "Ton compte vrai sera juste, manche après manche."],
              [70, "Tu tiens", "bien", "Correct. Un demi-jeu d'erreur coûte déjà un point de compte vrai, continue."],
              [null, "À travailler", "mal", "Un compte courant parfait divisé par une mauvaise estimation donne une mauvaise décision."]] }
};
/* 🚨 Une moyenne de réaction ne mesure quelque chose que si l'on a RÉPONDU.
   Vu en essai le 6 septembre : une session à 3 clics justes, 6 faux et 11 ratées
   affichait « 0,2 s · Rythme de pro » — les trois seuls clics étaient tombés juste
   après une carte, et l'application félicitait un naufrage, à côté de sa propre tuile
   « 11 ratées ». On exige donc un échantillon : dix clics, et la moitié des cartes vues
   (la plus petite session possible en compte 20, la règle n'interdit jamais rien).
   Sans échantillon, PAS de pastille et PAS de `reaction` en base — sinon le bureau
   moyennerait à parts égales une session de quarante clics et une de trois. */
const REACTION_MINI = 10;
const reactionFiable = (clics, vues) => clics >= REACTION_MINI && clics * 2 >= vues;
// « 30 », « 1 », « 0,6 » — un nombre écrit comme on le dit, sans la décimale morte
// de fr1 (qui rendrait « objectif 30,0 s »).
const nbFr = x => (Math.round(x * 10) / 10).toString().replace(".", ",");
const tonCouleur = t => t === "bien" ? "var(--jade)" : t === "mal" ? "var(--cinabre)" : "var(--os)";
// Le palier d'une valeur — ou null si la mesure n'existe pas encore : on ne situe
// personne sur zéro session, et « Premiers pas » sur un tiret serait un jugement
// porté sur du vide.
function palierDe(cle, v) {
  const R = REPERES[cle];
  if (!R || v === null || v === undefined || !isFinite(v)) return null;
  const p = R.paliers.find(x => x[0] === null || (R.sens === "bas" ? v <= x[0] : v >= x[0]));
  return { nom: p[1], ton: p[2], phrase: p[3] || "",
    atteint: R.sens === "bas" ? v <= R.objectif : v >= R.objectif,
    // ⚠️ `quoi` se lit APRÈS « pour » : c'est un GROUPE VERBAL, jamais un groupe nominal.
    // L'estimation portait « de manches dans le demi-jeu… » et la bulle annonçait
    // « Objectif : 70 % pour DE MANCHES dans le demi-jeu de tolérance » (vu le 06/09).
    aide: "Objectif : " + nbFr(R.objectif) + R.unite + " pour " + R.quoi };
}
/* La pastille de palier, sous le chiffre — au bureau comme dans les bilans, le même
   appel et donc le même verdict. `.regle` est la pastille de la maison ; `.bien` et
   `.mal` sont ses deux tons, et l'absence de classe le troisième (neutre).
   L'objectif chiffré voyage dans le `title` et non à côté : une tuile fait 148 px de
   large au bureau, 138 px dans un bilan — « Rythme de salle · objectif 30 s » y
   déborderait, et une pastille en pilule ne se coupe pas en deux lignes. */
function badgeRepere(cle, v) {
  const p = palierDe(cle, v);
  if (!p) return "";
  // 🚨 UN SPAN, jamais un div : `.tuiles div` (style.css) donne bordure, coin arrondi et
  // padding à TOUT div descendant d'un bilan — la pastille se retrouvait enfermée dans
  // une seconde boîte, et la tuile poussait d'un cran. Invisible dans le DOM, flagrant
  // sur la capture (06/09).
  return `<span style="display:block;margin-top:8px"><span class="regle ${p.ton}" title="${echap(p.aide)}">${echap(p.nom)}</span></span>`;
}

/* ── LA MONTÉE EN CADENCE : une PROPOSITION, jamais une contrainte ─────────
   Le drill Stratégie fait déjà de la répétition espacée — les mains ratées reviennent
   plus souvent (strategie.js, la pile DB.fautes). Le comptage, lui, n'avait jamais
   rien fait de ce qu'il mesure : on pouvait rester trois mois à 1,2 s la carte sans
   que rien ne suggère d'accélérer.

   Trois défilements exacts d'affilée À LA MÊME CADENCE, avec de la marge sur la
   réaction, et on propose 200 ms de moins. Deux ratés nets, et on propose 200 ms de
   plus.

   🚨 UN BOUTON, PAS UN RÉGLAGE QUI BOUGE TOUT SEUL. Rien ne change tant qu'on ne
   clique pas, la boîte disparaît si on l'ignore, et le curseur reste où on l'a laissé.
   Ce qui manque à cette application, c'est de dire OÙ ON EN EST — pas de décider à la
   place du joueur. Un entraîneur qui accélère sans prévenir se fait éteindre. */
const CADENCE_PAS = 200, CADENCE_PLANCHER = 300;
// Le plus court intervalle (ms) auquel un défilement est ressorti exact. Il ne pilote
// rien : il dit d'où l'on part, dans la scène de réglage et dans la boîte ci-dessous.
if (DB.cadenceTenue === undefined) DB.cadenceTenue = null;

let _boiteCadence = null, _cadenceCible = 0;
// La boîte n'existe pas dans corps.html : elle est posée une fois dans le verdict,
// juste au-dessus de la rangée de boutons, et réutilisée ensuite.
function boiteCadence() {
  if (_boiteCadence) return _boiteCadence;
  const b = document.createElement("div");
  b.id = "exCadence"; b.hidden = true;
  b.style.cssText = "margin:18px auto 0;max-width:60ch;padding:12px 15px;border:1px solid var(--filet);" +
    "border-radius:12px;display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap;text-align:left";
  b.innerHTML = '<span id="exCadenceTexte" style="font-size:var(--t-petit);flex:1 1 22ch;min-width:20ch"></span>' +
    '<button class="btn creux" id="exCadenceBtn"></button>';
  const v = $("exVerdict");
  v.insertBefore(b, v.querySelector(".rang-btn"));
  $("exCadenceBtn").onclick = () => {
    // Sans cible, on ne touche à RIEN. Le bouton reste dans le document quand la boîte
    // est repliée (personne ne peut le cliquer, `hidden` le retire de l'affichage) —
    // mais un `value = 0` collerait le curseur sur son minimum, 0,2 s, ce qu'aucune
    // proposition ne demande jamais. Un raccourci ou un test qui l'appelle malgré tout
    // ne doit pas pouvoir dérégler l'exercice.
    if (!_cadenceCible) return;
    $("eVitesse").value = _cadenceCible;
    $("eVitesse").oninput();     // l'étiquette du curseur et la variable CSS suivent
    rendreSceneExo();            // le résumé du tiroir replié aussi
    $("exCadenceTexte").innerHTML = `<b>Cadence réglée sur ${nbFr(_cadenceCible / 1000)} s.</b> Elle s'applique au prochain défilement.`;
    $("exCadenceBtn").hidden = true;
    bandeau(`Cadence : une carte toutes les ${nbFr(_cadenceCible / 1000)} s.`);
  };
  return (_boiteCadence = b);
}
function proposerCadence() {
  const b = boiteCadence(); b.hidden = true; $("exCadenceBtn").hidden = false;
  // Seul le défilement a une cadence imposée : le sabot chrono se fait défiler à la
  // main, l'estimation n'a pas de carte qui tombe. Rien à proposer ailleurs.
  if (X.genre !== "defilement") return;
  const ms = +$("eVitesse").value;
  const S = DB.sessions.filter(s => s.genre === "defilement" && s.ms === ms);
  const trois = S.slice(-3), deux = S.slice(-2);
  // Monter : trois exacts d'affilée, et une réaction qui garde 40 % de marge sur
  // l'intervalle. Sans la marge on proposerait d'accélérer quelqu'un qui clique déjà
  // au dernier moment — il raterait la première carte de la session suivante.
  const marge = trois.every(s => s.reaction && s.reaction * 1000 < .6 * s.ms);
  // Les deux bornes. Le plancher est à nous (300 ms : en dessous on ne lit plus une
  // carte, on la devine) ; le plafond est celui du curseur lui-même, pour qu'une
  // retouche de corps.html ne laisse pas les deux valeurs diverger en silence.
  // 🚨 On ne propose JAMAIS un cran qui n'en est pas un : à 3 s, bout de course,
  // « Ralentir à 3 s » s'est affiché en essai — un bouton qui ne change rien, sur un
  // écran qui vient de dire qu'on a perdu le fil.
  const plafond = +$("eVitesse").max || 3000;
  const plusVite = Math.max(CADENCE_PLANCHER, ms - CADENCE_PAS);
  const plusLent = Math.min(plafond, ms + CADENCE_PAS);
  if (trois.length === 3 && trois.every(s => s.exact) && marge && plusVite < ms) {
    _cadenceCible = plusVite;
    $("exCadenceTexte").innerHTML = `Trois défilements exacts à ${nbFr(ms / 1000)} s, et tu réponds en ${fr1(trois[2].reaction)} s.
      Il te reste de la marge : tu peux serrer d'un cran.`;
    $("exCadenceBtn").textContent = `Passer à ${nbFr(plusVite / 1000)} s`;
    b.hidden = false; return;
  }
  // Ralentir : deux échecs NETS de suite (un écart de 3 n'est pas une carte manquée,
  // c'est le fil perdu). Un seul raté ne dit rien — tout le monde en fait.
  if (deux.length === 2 && deux.every(s => !s.exact && s.ecart >= 3) && plusLent > ms) {
    _cadenceCible = plusLent;
    $("exCadenceTexte").innerHTML = `Deux fois de suite le fil perdu à ${nbFr(ms / 1000)} s.
      On apprend à la cadence où l'on est juste, pas à celle qu'on vise.`;
    $("exCadenceBtn").textContent = `Ralentir à ${nbFr(_cadenceCible / 1000)} s`;
    b.hidden = false;
  }
}

function ongletEx(g) {
  X.genre = g;
  $("ongletsEx").querySelectorAll("button").forEach(b => b.setAttribute("aria-selected", b.dataset.ex === g ? "true" : "false"));
  $("opDefilement").hidden = g !== "defilement"; $("opChrono").hidden = g !== "chrono"; $("opEstimation").hidden = g !== "estimation";
  ["exPiste", "exBilan", "estPiste", "estBilan"].forEach(id => { $(id).hidden = true; });
  $("exReglages").hidden = false;
  rendreSceneExo();
}
/* ── Le tiroir des réglages et la scène de démonstration ───────────────────
   Mesuré le 05/09 : sept sélecteurs, un curseur et deux cases AVANT « Commencer », puis
   60 % d'écran vide — un formulaire de réglages, pas un exercice. Le tiroir est replié
   (son résumé dit ce qu'il contient), « Commencer » est dans le bandeau, et la scène
   occupe l'espace : trois cartes de dos, le compteur à zéro, ce qui va se passer. Elle
   s'efface avec le tiroir dès que la piste ou le bilan est là (style.css, :has). */
const pluriel = (n, mot) => n + " " + mot + (n > 1 ? (/eu$/.test(mot) ? "x" : "s") : "");
function resumeExo() {
  if (X.genre === "chrono") return `${pluriel(+$("cJeux").value, "jeu")} · ${pluriel(+$("cParVue").value, "carte")} à la fois · ${pluriel(+$("cCachees").value, "retirée")}`;
  if (X.genre === "estimation") return `sabot de ${$("sJeux").value} jeux · ${$("sManches").value} manches`;
  const silence = $("eMode").value === "silence", par = +$("eParVue").value, ctrl = $("eControle").value;
  // En clair : « une carte toutes les 1,2 s · tu cliques la valeur » — un résumé de réglage codé
  // (« 1,2 s · je clique la valeur ») ne disait pas ce qu'on attend (les critiques, 05/09).
  return `${pluriel(+$("eJeux").value, "jeu")} · une carte toutes les ${fr1(+$("eVitesse").value / 1000)} s · ${silence ? "tu comptes en silence" : "tu cliques la valeur"}` +
    (silence && par > 1 ? ` · ${par} à la fois` : "") + (ctrl !== "0" ? " · contrôle surprise" : "");
}
// La légende du système sélectionné, en puces : « +1 2 3 4 5 6 · 0 7 8 9 · −1 10 V D R A ».
function legendeSysteme() {
  const v = sys().v, groupes = {};
  RANKS.forEach((r, i) => { const k = v[i >= 9 ? 9 : i]; (groupes[k] = groupes[k] || []).push(r); });
  // De gauche à droite comme les boutons de réponse et les touches fléchées : −1, 0, +1.
  return Object.keys(groupes).map(Number).sort((a, b) => a - b)
    .map(k => `<span class="regle ${k > 0 ? "bien" : k < 0 ? "mal" : ""}" title="Ces cartes valent ${sgn(k)}">${sgn(k)}&nbsp; ${groupes[k].join(" ")}</span>`).join("");
}
// La consigne des boutons, GÉNÉRÉE depuis le système : « Trois boutons : −1 pour A, 10, V, D, R ;
// 0 pour 7, 8, 9 ; +1 pour 2 à 6 ». Les touches 1…5 n'existent que pour un système à cinq valeurs.
function consigneBoutons() {
  const v = sys().v, vals = [...new Set(v)].sort((a, b) => a - b);
  const mots = ["", "un", "deux", "trois", "quatre", "cinq", "six"];
  const rangsDe = x => { const rs = RANKS.filter((r, i) => v[i >= 9 ? 9 : i] === x);
    return rs.length > 4 && rs.every((r, i) => !i || RANKS.indexOf(r) === RANKS.indexOf(rs[i - 1]) + 1) ? rs[0] + " à " + rs[rs.length - 1] : rs.join(", "); };
  const mot = mots[vals.length] || String(vals.length);
  const boutons = `${mot.charAt(0).toUpperCase() + mot.slice(1)} boutons : ` + vals.map(x => `<b>${sgn(x)}</b> pour ${rangsDe(x)}`).join(" ; ");
  const touches = vals.length === 3 ? `<kbd>←</kbd> −1 · <kbd>espace</kbd> 0 · <kbd>→</kbd> +1` : `<kbd>1…${vals.length}</kbd> les boutons de gauche à droite`;
  return boutons + ". Au clavier : " + touches + ".";
}
function rendreSceneExo() {
  const r = $("exResume"), cadre = $("exoCadre"); if (!r || !cadre) return;
  r.textContent = resumeExo();
  if (!cadre.children.length) for (let k = 0; k < 3; k++) cadre.appendChild(carteEl({}, true));
  const c = $("exScene").querySelector(".exo-compte"), lab = c.querySelector(".grave"), val = c.querySelector("b");
  const sec = fr1(+$("eVitesse").value / 1000);
  // La légende AVANT le départ : elle n'apparaissait que sur les boutons, une fois lancé.
  if ($("exoLegende")) $("exoLegende").innerHTML = X.genre === "estimation" ? "" : legendeSysteme();
  lab.textContent = X.genre === "estimation" ? "Jeux dans le tas" : "Compte courant"; val.textContent = X.genre === "estimation" ? "?" : "0";
  $("exoQuoi").innerHTML = X.genre === "estimation"
    ? "Un tas de défausse, manche après manche : tu annonces combien de jeux y sont passés. C'est ce coup d'œil qui fait le compte vrai — tolérance : un demi-jeu."
    : X.genre === "chrono"
    ? "Tu fais défiler toi-même — <kbd>espace</kbd>, clic ou <kbd>→</kbd>. Le chrono part à la première carte, le compte t'est demandé à la fin."
    : $("eMode").value === "silence"
    ? `Les cartes tombent ici, une toutes les <b>${sec} s</b> ; tu tiens le compte en silence, on te le demande à la fin.`
    : `Les cartes tombent ici, une toutes les <b>${sec} s</b> ; tu annonces la valeur de chacune. ${consigneBoutons()}`;
  // Le meilleur intervalle déjà tenu : le seul endroit AVANT la session où l'on sache
  // d'où l'on part. Il n'impose rien — le curseur reste exactement où on l'a laissé.
  if (X.genre === "defilement" && DB.cadenceTenue)
    $("exoQuoi").innerHTML += `<span class="muet" style="display:block;margin-top:6px">Ta meilleure cadence tenue&nbsp;: ${nbFr(DB.cadenceTenue / 1000)} s.</span>`;
}
$("exReglages").addEventListener("change", rendreSceneExo);
$("exReglages").addEventListener("input", rendreSceneExo);
rendreSceneExo();
$("ongletsEx").querySelectorAll("button").forEach(b => b.onclick = () => ongletEx(b.dataset.ex));
$("eVitesse").oninput = () => { $("eVitesseL").textContent = fr1(+$("eVitesse").value / 1000) + " s";
  $("exPiste").style.setProperty("--intervalle", $("eVitesse").value + "ms"); };
$("eJeux").onchange = rendreSysteme; $("cJeux").onchange = rendreSysteme;
function rendreReponses() {
  const v = sys().v, vals = [...new Set(v)].sort((a, b) => a - b);
  $("reponses").innerHTML = vals.map(x =>
    `<button data-v="${x}" class="${x > 0 ? "plus" : x < 0 ? "moins" : ""}">${sgn(x)}<i>${RANKS.filter((r, i) => v[i >= 9 ? 9 : i] === x).join(" ")}</i></button>`).join("");
  $("reponses").querySelectorAll("button").forEach(b => b.onclick = () => repondre(+b.dataset.v));
}
const prochainControle = de => {
  if (X.genre !== "defilement") return Infinity;
  const m = $("eControle").value;
  if (m === "0") return Infinity;
  if (m === "alea") return de + 8 + alea(16);
  return de + +m;
};
$("eDemarrer").onclick = demarrerExercice;
if ($("eDemarrer2")) $("eDemarrer2").onclick = demarrerExercice;   // le même bouton, sous les cartes
$("eStop").onclick = () => finExercice();
$("rRejouer").onclick = demarrerExercice;
$("rReglages").onclick = () => { $("exBilan").hidden = true; $("exReglages").hidden = false; };
async function demarrerExercice() {
  ac();
  if (X.genre === "estimation") return demarrerEstimation();
  if (X.genre === "defilement") {
    X.jeux = +$("eJeux").value;
    const s = await sabotProuvable(X.jeux);
    X.sabot = s.cartes;
    // Un nombre ENTIER de jeux retombe toujours sur le même compte (0 en Hi-Lo) :
    // la réponse serait connue d'avance. D'où « au hasard », « jusqu'à la coupe »
    // (on ne voit jamais la fin d'un sabot en salle), et des cartes retirées.
    const choix = $("eNb").value;
    const n = choix === "coupe" ? Math.floor(X.sabot.length * (.65 + Math.random() * .15))
      : choix === "alea" ? 30 + alea(16) : Math.min(+choix, X.sabot.length);
    X.cartes = X.sabot.slice(0, n); X.silence = $("eMode").value === "silence"; X.par = X.silence ? +$("eParVue").value : 1;
    retirerCachees(n % 52 === 0 ? +$("eCachees").value : 0);
  } else {
    X.jeux = +$("cJeux").value;
    const s = await sabotProuvable(X.jeux);
    X.sabot = s.cartes; X.cartes = X.sabot.slice(); X.silence = true; X.par = +$("cParVue").value;
    retirerCachees(+$("cCachees").value);
  }
  X.i = -1; X.rc = CT.compteInitial(DB.sys, X.jeux); X.rep = new Array(X.cartes.length).fill(null);
  X.encours = true; X.delais = []; X.controles = []; X.pause = false; X.prochainControle = prochainControle(0); X.depart = 0;
  $("reponses").hidden = X.silence; $("trace").hidden = X.silence;
  $("chronoL").hidden = X.genre !== "chrono"; $("chronoL").textContent = "0,0 s";
  $("trace").innerHTML = X.cartes.map(() => "<i></i>").join("");
  $("exReglages").hidden = true; $("exBilan").hidden = true; $("exPiste").hidden = false;
  $("exVerdict").hidden = true; $("exDemande").hidden = false;
  ["rCompte", "rJeux", "rTC"].forEach(id => { $(id).value = ""; });
  clearInterval(X.chrono);
  if (X.genre === "chrono") X.chrono = setInterval(() => { if (X.depart) $("chronoL").textContent = fr1((performance.now() - X.depart) / 1000) + " s"; }, 100);
  $("exPiste").style.setProperty("--intervalle", (X.genre === "chrono" ? 600 : +$("eVitesse").value) + "ms");
  suivante();
}
// Les cartes retirées sortent de la séquence montrée mais restent dans le sabot :
// ton compte final, sur un paquet entier, révèle ce qu'elles valaient.
function retirerCachees(k) {
  X.cachees = [];
  for (let i = 0; i < k && X.cartes.length > 5; i++) X.cachees.push(X.cartes.splice(alea(X.cartes.length), 1)[0]);
}
$("cCachees").onchange = () => { $("cCacheesL").textContent = $("cCachees").value; };
function suivante() {
  clearTimeout(X.minuteur);
  if (X.i >= 0 && X.i + 1 >= X.prochainControle && X.i + 1 < X.cartes.length) return controle();
  X.i++;
  if (X.i >= X.cartes.length) return finExercice();
  if (!X.depart) X.depart = performance.now();
  const grp = X.cartes.slice(X.i, X.i + X.par); X.i += grp.length - 1;
  for (const c of grp) X.rc += valeurCompte(c);
  $("scene").innerHTML = "";
  const w = document.createElement("div"); w.className = "groupe";
  grp.forEach((c, k) => { const e = carteEl(c); e.style.rotate = (alea(7) - 3) + "deg"; e.style.animationDelay = (k * 55) + "ms"; e.classList.add("carte--entre"); w.appendChild(e); });
  $("scene").appendChild(w); son("carte");
  $("exPos").textContent = `${X.i + 1} / ${X.cartes.length}`;
  $("exReste").textContent = `${X.sabot.length - X.i - 1} cartes restantes`;
  X.t0 = performance.now();
  if (X.genre === "defilement") {
    const ms = +$("eVitesse").value;
    $("exBarre").style.transition = "none"; $("exBarre").style.width = "0";
    requestAnimationFrame(() => requestAnimationFrame(() => { $("exBarre").style.transition = `width ${ms}ms linear`; $("exBarre").style.width = "100%"; }));
    X.minuteur = setTimeout(suivante, ms);
  } else { $("exBarre").style.transition = "width .2s"; $("exBarre").style.width = (100 * (X.i + 1) / X.cartes.length) + "%"; }
}
function repondre(v) {
  if (!X.encours || X.pause || X.silence || X.i < 0 || X.rep[X.i] !== null) return;
  X.rep[X.i] = v;
  const vrai = valeurCompte(X.cartes[X.i]), bon = v === vrai;
  X.delais.push(performance.now() - X.t0);
  $("trace").children[X.i].className = bon ? "ok" : "ko";
  son(bon ? "ok" : "ko");
  $("scene").classList.remove("juste", "faux"); void $("scene").offsetWidth;
  $("scene").classList.add(bon ? "juste" : "faux");
  if ($("eMontre").checked) {
    const f = document.createElement("div"); f.className = "eclair cadran";
    f.textContent = (bon ? "✓ " : "✗ ") + sgn(vrai);
    f.style.color = bon ? "var(--jade)" : "var(--cinabre)"; $("scene").appendChild(f);
  }
  if ($("eAvance").checked) suivante();
}
function controle() {
  X.pause = true; X.prochainControle = prochainControle(X.i + 1);
  $("exControle").hidden = false; $("ctrlSaisie").value = ""; $("ctrlRetour").textContent = ""; $("ctrlOk").disabled = false;
  setTimeout(() => $("ctrlSaisie").focus(), 40);
}
function validerControle() {
  if (!X.pause) return; const g = $("ctrlSaisie").value.trim(); if (g === "") return;
  const bon = parseInt(g, 10) === X.rc; X.controles.push(bon); $("ctrlOk").disabled = true; son(bon ? "ok" : "ko");
  $("ctrlRetour").textContent = bon ? "✓ exact" : "✗ c'était " + sgn(X.rc);
  $("ctrlRetour").style.color = bon ? "var(--jade)" : "var(--cinabre)";
  setTimeout(() => { $("exControle").hidden = true; X.pause = false; suivante(); }, bon ? 620 : 1400);
}
$("ctrlOk").onclick = validerControle;
$("ctrlSaisie").addEventListener("keydown", e => { if (e.key === "Enter") validerControle(); });
$("scene").addEventListener("click", () => { if (X.genre === "chrono" && X.encours && !X.pause) suivante(); });
function finExercice() {
  clearTimeout(X.minuteur); clearInterval(X.chrono); X.encours = false; $("exControle").hidden = true;
  X.secondes = X.depart ? (performance.now() - X.depart) / 1000 : 0;
  for (let k = 0; k <= X.i && k < X.cartes.length; k++) if (X.rep[k] === null && !X.silence) $("trace").children[k].className = "rate";
  $("boiteTC").hidden = !sys().equilibre || X.genre === "chrono";
  $("boiteJeux").hidden = X.genre === "chrono";
  $("exPiste").hidden = true; $("exBilan").hidden = false;
  setTimeout(() => $("rCompte").focus(), 50);
}
$("rVerifier").onclick = verifierExercice;
$("rCompte").addEventListener("keydown", e => { if (e.key === "Enter") verifierExercice(); });
function verifierExercice() {
  const g = $("rCompte").value.trim(); if (g === "") return;
  const dit = parseInt(g, 10), vues = Math.min(X.i + 1, X.cartes.length);
  let bons = 0, faux = 0, rates = 0;
  for (let k = 0; k < vues; k++) { const a = X.rep[k];
    if (a === null) rates++; else if (a === valeurCompte(X.cartes[k])) bons++; else faux++; }
  const exact = dit === X.rc, ecart = Math.abs(dit - X.rc);
  son(exact ? "ok" : "ko");
  $("rReel").textContent = sgn(X.rc); $("rReel").style.color = exact ? "var(--jade)" : "var(--cinabre)";
  const jeuxRestants = (X.sabot.length - vues) / 52, tc = CT.compteVrai(X.rc, jeuxRestants);
  const dj = parseFloat(($("rJeux").value || "").replace(",", ".")), dtc = parseInt($("rTC").value, 10);
  // La cadence RAMENÉE à un jeu de 52 : c'est elle qu'on situe sur un barème, parce
  // qu'un chrono brut dépend du nombre de cartes tirées et ne se compare à rien.
  const par52 = X.genre === "chrono" && vues && X.secondes > 0 ? X.secondes / vues * 52 : null;
  let txt = exact ? (prenom() ? `Exact, ${prenom()}. ` : "Exact. ") + "Le compte courant est juste." : `Écart de ${ecart} sur ${vues} cartes.`;
  if (X.genre === "chrono") txt += ` ${vues} cartes en ${fr1(X.secondes)} s, soit ${fr1(vues / Math.max(X.secondes, .1))} cartes par seconde`
    // Sans chrono (arrêt avant la première carte), on n'invente pas un « 0 s par jeu ».
    + (par52 === null ? "." : `, et ${nbFr(par52)} s ramenées à un jeu de 52 (objectif ${nbFr(REPERES.jeu52.objectif)} s).`);
  if (!isNaN(dj)) txt += ` Jeux restants estimés ${fr1(dj)} contre ${fr1(jeuxRestants)} réels${Math.abs(dj - jeuxRestants) <= .5 ? " ✓" : ""}.`;
  if (sys().equilibre && !isNaN(dtc)) txt += ` Compte vrai annoncé ${sgn(dtc)}, réel ${fr1(tc)}${Math.abs(dtc - tc) <= .5 ? " ✓" : ""}.`;
  $("rTexte").textContent = txt;
  const rc = $("rCachees"); rc.hidden = !X.cachees.length;
  if (X.cachees.length) {
    const somme = X.cachees.reduce((a, c) => a + valeurCompte(c), 0);
    const cible = CT.compteInitial(DB.sys, X.jeux) + (sys().equilibre ? 0 : 4 * X.jeux);
    const entier = (X.cartes.length + X.cachees.length) % 52 === 0;
    rc.innerHTML = `<p class="grave">Retirées face cachée</p><div class="groupe"></div><p></p>`;
    const g = rc.querySelector(".groupe"); X.cachees.forEach(c => g.appendChild(carteEl(c)));
    rc.querySelector("p:last-child").textContent = entier
      ? `Elles valent ${sgn(somme)}. Le paquet entier retombe sur ${sgn(cible)} : un compte juste de ${sgn(X.rc)} les révélait${exact ? " — et tu l'as fait." : "."}`
      : `Elles valent ${sgn(somme)}.`;
  }
  const moy = X.delais.length ? X.delais.reduce((a, b) => a + b, 0) / X.delais.length / 1000 : null;
  // La moyenne s'AFFICHE toujours — trois clics à 0,2 s, c'est un fait — mais elle ne se
  // SITUE que sur un échantillon suffisant. La tuile « Ratées » juste à côté dit le reste.
  const moySure = moy !== null && reactionFiable(bons + faux, vues) ? moy : null;
  // Troisième colonne d'une tuile : sa pastille de palier, quand la mesure en a une.
  const tuiles = [[sgn(dit), "Ta réponse"], [vues, "Cartes vues"]];
  if (!X.silence) tuiles.push([bons, "Clics justes"], [faux, "Clics faux"], [rates, "Ratées"],
    [moy !== null ? fr1(moy) + " s" : "—", "Réaction", badgeRepere("reaction", moySure)]);
  if (X.genre === "chrono") tuiles.push([fr1(X.secondes) + " s", "Chrono"],
    [par52 !== null ? nbFr(par52) + " s" : "—", "Par jeu de 52", badgeRepere("jeu52", par52)]);
  else { tuiles.push([fr1(jeuxRestants), "Jeux restants"]); if (sys().equilibre) tuiles.push([fr1(tc), "Compte vrai"]); }
  if (X.controles.length) tuiles.push([`${X.controles.filter(Boolean).length}/${X.controles.length}`, "Contrôles"]);
  $("rTuiles").innerHTML = tuiles.map(([b, l, r]) => `<div><b>${b}</b><span class="grave">${l}</span>${r || ""}</div>`).join("");
  $("rMise").textContent = sys().equilibre && X.genre === "defilement"
    ? `À ce compte vrai, un compteur miserait ${CT.misesUnites(tc, 12)} unité${CT.misesUnites(tc, 12) > 1 ? "s" : ""}.` : "";
  // `ms` : la cadence à laquelle la session a été jouée. Sans elle, proposerCadence
  // ne saurait pas si une série d'exacts a été faite au rythme d'aujourd'hui ou à un
  // autre — et proposerait d'accélérer sur la foi de sessions plus lentes.
  DB.sessions.push({ t: Date.now(), genre: X.genre, sys: sys().nom, n: vues, exact, ecart,
    reaction: moySure, secondes: X.genre === "chrono" ? +X.secondes.toFixed(1) : null,
    ms: X.genre === "defilement" ? +$("eVitesse").value : null,
    controles: X.controles.length ? [X.controles.filter(Boolean).length, X.controles.length] : null });
  while (DB.sessions.length > 240) DB.sessions.shift();
  if (X.genre === "defilement" && exact) {
    const ms = +$("eVitesse").value;
    DB.cadenceTenue = DB.cadenceTenue ? Math.min(DB.cadenceTenue, ms) : ms;
  }
  garder();
  $("exDemande").hidden = true; $("exVerdict").hidden = false;
  proposerCadence();
}

/* ── Estimation du sabot ─────────────────────────────────────────── */
const ES = { jeux: 6, manches: 10, i: 0, n: 0, bons: 0, erreurs: [], bloque: false };
function demarrerEstimation() {
  ES.jeux = +$("sJeux").value; ES.manches = +$("sManches").value; ES.i = 0; ES.bons = 0; ES.erreurs = [];
  $("exReglages").hidden = true; $("exBilan").hidden = true; $("exPiste").hidden = true;
  $("estBilan").hidden = true; $("estPiste").hidden = false;
  const opts = []; for (let d = .5; d <= ES.jeux - .5; d += .5) opts.push(d);
  $("estBoutons").innerHTML = opts.map(d => `<button data-d="${d}">${fr1(d)}</button>`).join("");
  $("estBoutons").querySelectorAll("button").forEach(b => b.onclick = () => repondreEstimation(+b.dataset.d));
  $("estJustes").textContent = "0"; $("estEcart").textContent = "—";
  mancheEstimation();
}
function mancheEstimation() {
  if (ES.i >= ES.manches) return finEstimation();
  ES.bloque = false; $("estRetour").innerHTML = "";
  const total = ES.jeux * 52; ES.n = 26 + alea(total - 52);
  $("estPos").textContent = `Manche ${ES.i + 1} sur ${ES.manches} · sabot de ${ES.jeux} jeux`;
  $("estPile").style.height = "0px";
  requestAnimationFrame(() => { $("estPile").style.height = (242 * ES.n / total) + "px"; });
  son("carte");
}
function repondreEstimation(g) {
  if (ES.bloque) return; ES.bloque = true;
  const reel = ES.n / 52, err = Math.abs(g - reel), bon = err <= .5;
  if (bon) ES.bons++; ES.erreurs.push(err); ES.i++; son(bon ? "ok" : "ko");
  $("estRetour").innerHTML = `<span class="dit" style="color:${bon ? "var(--jade)" : "var(--cinabre)"}">${bon ? "Bien vu" : "Raté"}</span>
    ${ES.n} cartes, soit ${fr1(reel)} jeux au tas. Il reste ${fr1(ES.jeux - reel)} jeux dans le sabot.`;
  $("estJustes").textContent = ES.bons;
  $("estEcart").textContent = fr1(ES.erreurs.reduce((a, b) => a + b, 0) / ES.erreurs.length) + " jeu";
  setTimeout(() => { if (vue === "exercices") mancheEstimation(); }, bon ? 1050 : 2050);
}
function finEstimation() {
  const pct = Math.round(100 * ES.bons / Math.max(ES.erreurs.length, 1));
  const moy = ES.erreurs.length ? ES.erreurs.reduce((a, b) => a + b, 0) / ES.erreurs.length : 0;
  // Le verdict, la couleur ET la phrase sortent tous de REPERES.estimation. Les seuils
  // 70 et 90 vivaient ici en dur : ils sont partis dans la table, sans changer de valeur,
  // pour que le bureau et ce bilan ne puissent plus dire deux choses du même joueur.
  const p = palierDe("estimation", pct);
  $("estPiste").hidden = true; $("estBilan").hidden = false;
  $("estNote").textContent = pct + " %"; $("estNote").style.color = tonCouleur(p.ton);
  $("estTexte").innerHTML = echap(p.phrase) +
    `<span class="muet" style="display:block;margin-top:5px">Objectif&nbsp;: ${nbFr(REPERES.estimation.objectif)} % de manches à moins d'un demi-jeu d'écart.</span>`;
  $("estTuiles").innerHTML = [[`${ES.bons}/${ES.erreurs.length}`, "Justes", badgeRepere("estimation", pct)],
    [fr1(moy) + " jeu", "Écart moyen"],
    [fr1(Math.max.apply(null, ES.erreurs.concat([0]))) + " jeu", "Pire écart"], [ES.jeux, "Sabot"]]
    .map(([b, l, r]) => `<div><b>${b}</b><span class="grave">${l}</span>${r || ""}</div>`).join("");
  // `pct` n'est écrit QUE si des manches ont été jouées : « Terminer » au premier écran
  // produit un 0 % qui ne mesure rien, et le bureau en ferait une moyenne.
  DB.sessions.push({ t: Date.now(), genre: "estimation", sys: sys().nom, n: ES.erreurs.length, exact: p.atteint,
    ecart: +moy.toFixed(2), pct: ES.erreurs.length ? pct : null });
  while (DB.sessions.length > 240) DB.sessions.shift(); garder();
}
$("estStop").onclick = finEstimation;
$("estRejouer").onclick = demarrerEstimation;
$("estRetourReglages").onclick = () => { $("estBilan").hidden = true; $("exReglages").hidden = false; };
