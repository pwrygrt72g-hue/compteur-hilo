/* ══════════════════════ LA TABLE ══════════════════════ */
const T = { sabot: [], graine: null, empreinte: "", coupe: 0, rc: 0, vues: 0, mains: 0, defausse: 0,
  croupier: [], sieges: [], occupe: false, enJeu: false, toi: null, actif: null, revele: false, solde: 0 };
// Les mêmes prénoms que NOMS_BOTS (src/table-reseau.mjs), dans le même ordre : une
// table du catalogue monte à SEPT sièges (Le Front de Mer, Le Cercle, L'Aquarium) et la
// table entre amis à huit. Une liste plus courte que le nombre de sièges ferait s'asseoir
// deux « Marc » côte à côte — et le nom est le signal principal de « qui joue ».
const NOMS = ["Marc", "Sonia", "Karim", "Léa", "Paul", "Nadia", "Hugo", "Inès"];
const vitesse = () => DB.cadence;
// La donne INITIALE va plus vite que les tirages : douze cartes à 900 ms font
// onze secondes d'attente avant de pouvoir jouer (mesuré le 04/09), et à 400 ms
// avec un vol de 180 ms les cartes « tombaient » (Léo). Mesuré à nouveau le 05/09
// à la cadence par défaut : 5,4 s avant de voir sa main, et à 18 s le voisin
// réfléchissait encore. Les tirages, où l'on compte carte par carte, gardent la
// cadence pleine. T.rythme > 0 = on est dans la donne initiale.
// Puis Léo, le 06/09 : « elles se distribuent trop vite ». Un croupier pose une carte
// toutes les 0,45 à 0,55 s — 360 ms mesurés le 06/09, c'était une machine. 55 % de la
// cadence, entre 260 et 620 ms : 495 ms au réglage par défaut, soit une donne de douze
// cartes en 6,5 s battement compris. Le libellé du réglage se recalcule seul.
const cadenceDonne = () => Math.max(260, Math.min(620, Math.round(vitesse() * .55)));
// Le temps de réflexion d'un VOISIN : réglé à part (« rythme des voisins »), parce
// qu'il n'a rien à voir avec la cadence à laquelle on compte les cartes.
if (DB.voisins === undefined) DB.voisins = 450;
const voisins = () => Math.max(120, Math.min(1500, DB.voisins || 450));
const rythme = () => T.turbo ? 120 : (T.rythme || vitesse());
const poserIntervalle = ms => $("plateau").style.setProperty("--intervalle", ms + "ms");
// Une attente de la table : un clic sur le feutre pendant que les voisins jouent
// passe tout à la vitesse minimale (T.turbo), jusqu'à ton tour ou au règlement.
const pause = ms => dodo(T.turbo ? Math.min(ms, 90) : ms);
function turbo(on) {
  if (!!T.turbo === !!on) return;
  T.turbo = !!on; poserIntervalle(rythme());
  $("v-table").classList.toggle("turbo", T.turbo);
}
// Une annonce qui change ne surgit pas : elle bascule.
// La pastille est centrée par un transform CSS (translateX(-50%)) : on anime la propriété
// `translate`, indépendante, qui se compose PAR-DESSUS. Mesuré le 05/09 : `transform` animé
// écrasait le centrage, et la pastille sautait de 106 px vers la gauche à la fin de son fondu.
// Sur ordinateur, c'est le croupier qui dit l'annonce (croupier.js écoute « sabot:annonce »).
function annoncer(txt) {
  const a = $("annonce"); if (a.textContent === txt) return;
  a.textContent = txt;
  emettre("annonce", { texte: txt });
  if (txt && !matchMedia("(prefers-reduced-motion:reduce)").matches)
    a.animate([{ opacity: 0, translate: "0 4px" }, { opacity: 1, translate: "0 0" }], { duration: 200, easing: "ease-out" });
}
const reglesTable = () => {
  const t = tableCourante();
  return E.makeRules({ decks: t.jeux, h17: t.h17, blackjackPays: t.blackjackPays, das: t.das,
    surrender: t.surrender, doubleOn: t.doubleOn, maxHands: t.maxHands, hitSplitAces: t.hitSplitAces,
    holeCard: t.holeCard, peek: t.peek, enhcLosesAll: !!t.enhcLosesAll, penetration: t.penetration || .75 });
};
const ISSUE = { "gagné": "g", "perdu": "p", "égalité": "n", "sauté": "p", "blackjack": "bj", "abandon": "n" };
// L'aide à la décision (« Stratégie : Tirer ») est ALLUMÉE D'OFFICE les vingt premières mains
// (DB.conseil = "auto") : un novice lâché devant Tirer/Rester/Doubler/Séparer/Abandon sans
// un mot ne sait pas ce qu'on attend de lui (les critiques, 05/09). « Masquer l'aide » ou
// le bouton de la barre posent un vrai/faux, qui l'emporte ensuite.
const aideActive = () => DB.conseil === true || (DB.conseil === "auto" && (DB.mainsJouees || 0) < 20);
function rendreAide() {
  const b = $("bAide"); if (!b) return;
  b.setAttribute("aria-pressed", aideActive() ? "true" : "false");
  b.title = aideActive() ? "L'aide à la décision est affichée pendant ton tour — clique pour la masquer" : "Afficher la stratégie de base pendant ton tour";
}
// Le total d'une main, tel qu'il s'écrit sous les cartes : « 17 souple » quand un as y vaut
// encore onze, « 20 · doublé » quand la mise a été doublée — jamais « ×2 », qui se lisait
// « vingt fois deux » (les critiques, 05/09).
function scoreTexte(h) {
  if (!h || !h.cards.length || h.ramassee) return "";
  const t = E.handTotal(h.cards);
  return t + (E.isSoft(h.cards) && t < 21 ? " souple" : "") + (h.doubled ? " · doublé" : "");
}
// Le total du croupier : le chiffre, et « sauté » sur une ligne à lui quand il dépasse 21.
function poserScoreCroupier() {
  const t = E.handTotal(T.croupier); poserScore($("dScore"), t);
  const s = $("dSaute"); if (s) s.hidden = !(t > 21);
}
const MOT = { H: "Tirer", S: "Rester", D: "Doubler", P: "Séparer", U: "Abandonner" };
const CROUPIER = { siege: "croupier", main: 0 };
// Les issues, dans le vocabulaire du bus (sans accents : ce sont des clés).
const ISSUE_BUS = { "gagné": "gagne", "perdu": "perd", "sauté": "bust", "blackjack": "blackjack", "égalité": "egalite", "abandon": "abandon" };
// Un bust et un abandon se savent À L'INSTANT : le croupier doit réagir tout de
// suite, pas au règlement. `emis` évite de les annoncer deux fois.
function sauter(si, hi) {
  const h = T.sieges[si].mains[hi]; h.result = "sauté"; h.emis = true; rendreSieges();
  // Ton propre bust s'ENTEND (un boum sourd) et se LIT (le verdict sur tes cartes) : les deux
  // sont branchés sur le bus « sabot:main-fin » (socle.js, et inscrireVerdict plus bas), pour
  // que la table à plusieurs (reseau.js) les ait aussi sans une ligne de plus.
  emettre("main-fin", { siege: si, main: hi, toi: T.sieges[si].toi, issue: "bust", montant: -(h.bet || 1) * (h.doubled ? 2 : 1) });
  // Le croupier ramasse la main sautée tout de suite (cartes ET mise), pas au règlement :
  // on laisse 500 ms pour LIRE le bust, puis les cartes glissent à la défausse et le
  // badge reste seul sur le siège vide. La main garde ses cartes dans l'état (le
  // compte les a vues) ; `ramassee` empêche seulement de les redessiner.
  setTimeout(async () => {
    if (h.result !== "sauté" || h.ramassee || !T.enJeu) return;
    const hote = $(`m_${si}_${hi}`); if (!hote) return;
    h.ramassee = true;
    await ramasser([...hote.querySelectorAll(".carte")]);
    if (hote.isConnected) { hote.innerHTML = ""; const sc = hote.parentNode && hote.parentNode.querySelector(".score"); if (sc) sc.textContent = ""; }
    // Les cartes parties, la pastille « Sauté » flottait seule au-dessus d'un cercle vide,
    // sans rien à quoi se rapporter (les critiques, 05/09). Elle se pose DANS la case de
    // mise, là où la mise vient d'être ramassée : c'est la place qui a perdu (style.css).
    marquerSaute(si);
    T.defausse += h.cards.length; h.defaussee = true; rafraichirBarre();
  }, 500);
}
function marquerSaute(si) {
  const st = T.sieges[si], d = $("sieges") && $("sieges").children[si]; if (!st || !d) return;
  d.classList.toggle("saute", st.mains.length > 0 && st.mains.every(h => h.ramassee));
}
function abandonner(si, hi) {
  const h = T.sieges[si].mains[hi]; h.surrendered = true; h.result = "abandon"; h.emis = true; rendreSieges();
  emettre("main-fin", { siege: si, main: hi, toi: T.sieges[si].toi, issue: "abandon", montant: -(h.bet || 1) / 2 });
}

// Remélanger sans quitter la table : nouvelles cartes, compte à zéro, historique intact.
async function remelanger() {
  const t = tableCourante();
  const s = await sabotProuvable(t.jeux);
  T.sabot = s.cartes; T.graine = s.graine; T.empreinte = s.empreinte; T.revele = false;
  T.rc = CT.compteInitial(DB.sys, t.jeux); T.vues = 0;
  T.sabot.pop(); T.defausse = 0;
  rafraichirBarre(); rendreRecu(); emettre("remelange", { table: t.id, cartes: T.sabot.length, pendantDonne: true });
}
// `pendantDonne` : le sabot est renouvelé au milieu d'une donne (carte de coupe).
// Dans ce cas le verrou appartient à l'appelant — le relâcher ici laisserait une
// seconde donne démarrer par-dessus la première, et les deux videraient le sabot.
async function nouveauSabot(o) {
  o = o || {};
  const t = tableCourante();
  const s = await sabotProuvable(t.jeux);
  T.sabot = s.cartes; T.graine = s.graine; T.empreinte = s.empreinte; T.revele = false;
  /* ── La carte de coupe · corrigé le 6 septembre 2026 ───────────────────────
     `T.coupe` est le nombre de cartes qui RESTENT derrière la carte de coupe : le
     remélange se déclenche sur `T.sabot.length <= T.coupe` (distribuer(), plus bas).
     La pénétration, elle, est la fraction du sabot qu'on JOUE — c'est ce que dit le
     catalogue (« on joue 75 % du sabot avant de remélanger ») et ce que mesure le
     simulateur qui calcule l'avantage maison affiché (sim.mjs : `cut = shoeSize *
     penetration`, remélange quand `dealt >= cut`).
     On écrivait ici `length * penetration` : les deux nombres étaient INVERSÉS. Au
     Boulevard (6 jeux, pénétration 0,75) on remélangeait dès qu'il restait 234 cartes,
     soit 78 cartes jouées — 25 % au lieu de 75 %, cinq manches par sabot au lieu de
     quinze. Le Salon Privé, vendu sur sa pénétration de 0,85 (« la carte de coupe est
     le seul chiffre qui compte »), était en réalité la PIRE table du catalogue. Pour un
     entraîneur au comptage c'est le paramètre qui décide si compter sert à quelque
     chose : à 25 % de sabot joué, ça ne sert à rien, et l'application enseignait donc
     l'inverse de ce qu'elle affirmait.
     D'où `1 - penetration` : ce qu'on laisse derrière, c'est ce qu'on ne joue pas.
     ⚠️ La branche mélangeuse continue garde son `* .02` : elle est INERTE (distribuer()
     court-circuite sur `if (csm)` et l'affichage force `--coupe: 0`). */
  T.coupe = t.melange === "melangeuse_continue" ? Math.floor(T.sabot.length * .02) : Math.floor(T.sabot.length * (1 - (t.penetration || .75)));
  T.rc = CT.compteInitial(DB.sys, t.jeux); T.vues = 0; T.defausse = 0;
  if (!o.pendantDonne) {
    T.mains = 0; T.croupier = []; T.enJeu = false; T.occupe = false; T.actif = null;
    construireSieges();
    $("dMain").innerHTML = ""; $("dScore").textContent = "·";
  }
  T.sabot.pop(); T.defausse = 1;              // la carte brûlée : ni montrée, ni comptée
  poserLieu(t);
  $("conseil").textContent = "";
  rafraichirBarre(); rendreRecu();
  if (!o.pendantDonne) { annoncer(t.melange === "melangeuse_continue" ? "Mélangeuse continue : les cartes reviennent dans la machine à chaque main." : "Sabot neuf, mélangé, carte brûlée."); boutons({ donne: true }); }
  poserIntervalle(rythme());
  emettre("remelange", { table: t.id, cartes: T.sabot.length, pendantDonne: !!o.pendantDonne });
}
/* ── Le lieu ─────────────────────────────────────────────────────────────
   L'identifiant de la table EST l'identifiant du décor : [data-lieu] sur la
   vue, et la feuille de style fait le reste. La barre ne garde que trois
   puces — le nombre de jeux, H17/S17, 3:2 ou 6:5 — plus la mélangeuse quand
   il y en a une, parce que celle-là tue le comptage. */
function poserLieu(t) {
  // 🚨 `data-sieges` n'est PLUS posé ici : il porte le nombre RÉELLEMENT rendu, et
  // rendreSieges() est le seul à le savoir. Au Salon Privé (3 places au catalogue) en
  // réseau, cette ligne écrivait « 3 » sur une table de HUIT sièges — et [data-sieges="3"]
  // (style.css) resserrait le tapis à 1267 px pour huit joueurs.
  $("v-table").dataset.lieu = t.id;
  // Une mélangeuse continue n'a ni sabot à couper, ni défausse, ni compte de cartes : la
  // feuille de style remplace les deux meubles par la machine (les critiques, 05/09 : le
  // Cotai annonçait « mélangeuse » et montrait une carte de coupe et un compteur à 297).
  $("v-table").dataset.melange = t.melange === "melangeuse_continue" ? "csm" : "sabot";
  const ds = $("dSaute"); if (ds) ds.hidden = true;
  // Le lieu dans son propre <small> : à 1024 px de large, le bandeau passait sur deux lignes
  // (71 px au lieu de 44, mesuré le 05/09) et ces 27 px manquaient au feutre. Sous 1180 px on
  // replie le lieu (style.css, .hud-lieu) : le nom de la table suffit, il est dans le fil d'Ariane.
  $("tNom").innerHTML = echap(t.nom) + ' <small class="hud-lieu">· ' + echap(t.lieu) + "</small>";
  $("tRegles").innerHTML = pucesCourtes(t);   // les mêmes trois puces que la porte du hall (salon.js)
  noteTable(t);
  // La salle a le décor de son lieu : la photo embarquée (window.PHOTOS, cf. build.mjs),
  // floutée et assombrie par la feuille de style. Sans photo, la salle reste celle de
  // la lueur et du sol posés par [data-lieu] — rien ne casse.
  const ph = (window.PHOTOS || {})[t.id];
  $("salle").style.setProperty("--photo", ph ? `url("${ph}")` : "none");
  rendreMotif(t.id); LETTRAGE.cle = ""; rendreLettrage();
  emettre("table", { table: t });
}
/* ── La note de table ─────────────────────────────────────────────────────────
   Une ligne persistante sous la barre, pour ce qui vaut toute la session.
   1. La MÉLANGEUSE CONTINUE : on pouvait s'asseoir au Cotai et y passer sa première session
      entière sans qu'on nous dise que le comptage n'y sert à rien — la pastille rouge n'avait
      qu'un `title`, et l'appareil dessiné sur le feutre porte le mot « MÉLANGEUSE » sans
      conséquence énoncée. La phrase juste existe déjà deux fois dans le hall : on la reprend
      MOT POUR MOT (chipsRegles, salon.js), on n'en écrit pas une seconde.
   2. L'INVITE À COMPTER, pendant le PREMIER sabot seulement : à la table, rien ne demandait
      jamais de compter. La seule vérification automatique arrive à la carte de coupe, après
      ~78 cartes — une trentaine de mains. On terminait sa première session sans avoir compté
      une seule carte, et sans que l'application s'en aperçoive. */
/* Les règles de la table, EN TOUTES LETTRES. Les explications des pastilles ne vivaient que
   dans un attribut `title` : rien n'invitait à survoler (ni curseur, ni soulignement), au doigt
   elles étaient muettes, et sous 1000 px la rangée est carrément retirée de l'écran. Les textes
   sont ceux de chipsRegles (salon.js) — une seule source, pas une seconde version. */
function ouvrirReglesTable() {
  const t = tableCourante(), tmp = document.createElement("div"); tmp.innerHTML = chipsRegles(t);
  const lignes = [...tmp.children].map(e => `<li>${e.outerHTML}<span>${echap(e.getAttribute("title") || "")}</span></li>`).join("");
  ouvrirModale(`<h2>Les règles de cette table</h2>
    <p class="muet">${echap(t.nom)} · ${echap(t.lieu)} — mise de ${fmtJ(t.mise_min)} à ${fmtJ(t.mise_max)}.</p>
    <ul class="regles-liste">${lignes}</ul>`);
}
$("tRegles").onclick = ouvrirReglesTable;
function noteTable(t) {
  const n = $("noteTable"); if (!n) return;
  t = t || tableCourante();
  const bouts = [];
  if (t.melange === "melangeuse_continue") {
    const tmp = document.createElement("div"); tmp.innerHTML = chipsRegles(t);
    const csm = [...tmp.children].find(e => /mélangeuse/i.test(e.textContent));
    // Le texte est celui de la pastille du hall, MOT POUR MOT (chipsRegles) : une seule source.
    bouts.push(`<b>Mélangeuse continue.</b> ${echap(csm ? csm.getAttribute("title") : "")} — ici, compter ne sert à rien.`);
  } else if (!DB.aAnnonce && (DB.mainsJouees || 0) < 30 && !$("v-table").dataset.reseau) {
    // Elle s'éteint à la première annonce, ou au bout de trente mains — comme l'aide à la
    // décision s'éteint à vingt. Elle ne s'adresse qu'à quelqu'un qui n'a encore jamais compté.
    // SANS bouton : « Annoncer mon compte » est déjà dans la barre, en toutes lettres, et il ne
    // bouge jamais — deux boutons au libellé identique qui appellent la même chose sur le même
    // écran font douter qu'ils fassent la même chose. La phrase reste : c'est elle qui INVITE,
    // le geste est là où on le cherchera toujours. (La feuille tenait déjà ce raisonnement sous
    // 1024 px, où elle masquait ce bouton-ci : on l'applique désormais à toutes les largeurs.)
    bouts.push(`<b>À toi de tenir le compte.</b> Personne ne te le demandera pendant la main.`);
  }
  n.innerHTML = bouts.join("");
}
/* Le lettrage doré en arc est DÉRIVÉ des règles : « 3 TO 2 » ou « 6 TO 5 »,
   « HIT SOFT 17 » ou « STAND ON ALL 17s », et l'assurance seulement là où le
   croupier a une carte cachée. Les arcs suivent le rail réel : ils sont
   recalculés sur la taille mesurée du feutre, jamais dessinés en dur. */
const LETTRAGE = { cle: "", mesure: null, nu: true };
window.__lettrage = LETTRAGE;   // pour les sondes (capturer.mjs --sonde)
// En FRANÇAIS, comme « Pose ta mise », « Tirer » et « Abandon » : un feutre en anglais dans
// une interface en français faisait deux registres (les critiques, 05/09).
function texteLettrage(t) {
  return {
    paie: t.blackjackPays === 1.5 ? "BLACKJACK PAIE 3 CONTRE 2" : "BLACKJACK PAIE 6 CONTRE 5",
    croupier: t.h17 ? "LE CROUPIER TIRE À 17 SOUPLE" : "LE CROUPIER RESTE À 17",
    assurance: t.holeCard ? "L'ASSURANCE PAIE 2 CONTRE 1" : "SANS CARTE CACHÉE",
  };
}
function rendreLettrage() {
  const f = $("feutre"), svg = $("lettrage"); if (!f || !svg) return;
  const W = f.clientWidth, H = f.clientHeight;
  if (W < 150 || H < 120) { if (LETTRAGE.cle !== "vide") { svg.innerHTML = ""; LETTRAGE.cle = "vide"; } return; }
  // 🚨 Un feutre NU n'est plus une table de casino. Sous 400 px de large, les arcs n'ont plus
  // la place de porter une règle (mesuré le 06/09 à 360 × 640 : « lettrage : vide ») — alors
  // on imprime la seule qui compte, à plat, en une ligne : le paiement du blackjack.
  if (W < 400 || H < 230) {
    const tp = texteLettrage(tableCourante()), court = /3 CONTRE 2/.test(tp.paie) ? "BLACKJACK 3:2" : "BLACKJACK 6:5";
    const cle = "petit|" + W + "|" + H + "|" + court;
    if (LETTRAGE.cle === cle) return;
    LETTRAGE.cle = cle; LETTRAGE.nu = false; LETTRAGE.mesure = { petit: true };
    const taille = Math.max(9, Math.min(13, Math.round(W * .04)));
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML = `<text class="grand" x="${(W / 2).toFixed(1)}" y="${(H * .46).toFixed(1)}" font-size="${taille}" text-anchor="middle">${echap(court)}</text>`;
    return;
  }
  const rangee = f.querySelector(".rangee-haute"), box = $("sieges");
  // Tout est mesuré HORS transformation (offsetTop) : les sièges du bord sont
  // remontés sur l'arc par un transform, ce n'est pas leur place dans le flux.
  const basHaut = rangee.offsetTop + rangee.offsetHeight;
  // Le grand arc se place dans le VRAI trou entre les cartes du croupier et celles
  // des sièges, mesuré à l'ÉCRAN : les sièges sont remontés et penchés par un
  // transform, leur place dans le flux ne dit pas où sont leurs cartes. Mesuré le
  // 05/09 à 1280 × 800 : la rangée du croupier finissait à 410 et les cartes des
  // sièges 2 et 4 commençaient à 408 — l'arc calculé « entre les deux » passait sous
  // elles. Le trou existe au CENTRE (sous la main du croupier) et sur les CÔTÉS
  // (le sourire de l'arc remonte au-dessus des sièges intérieurs) : on contraint
  // l'arc à la verticale de chaque siège, et la taille cède si la place manque.
  const F = f.getBoundingClientRect();
  const dm = $("dMain"), rdm = dm ? dm.getBoundingClientRect() : null;
  const basCentre = Math.round(Math.max(rdm && rdm.height ? rdm.bottom - F.top : 0, rangee.offsetTop + rangee.offsetHeight - 8));
  // La réserve d'un siège est FIXE (largeur d'un éventail de trois cartes, haut de
  // la boîte .mains) : en phase de mise la boîte est vide, 0 px de large, et l'arc
  // calculé sur elle changeait de place à la première carte distribuée.
  const wT = parseFloat(getComputedStyle($("plateau")).getPropertyValue("--w-table")) || 84;
  const sieges = [...box.querySelectorAll(".siege")];
  const zones = sieges.map(sg => {
    const m = sg.querySelector(".mains") || sg, r = m.getBoundingClientRect(), rs = sg.getBoundingClientRect();
    // Les CARTES, pas la boîte (largeurCartes, cartes.js) : la boîte s'élargit avec « 18 souple ».
    const cx = rs.left + rs.width / 2 - F.left, demi = Math.max(largeurCartes(m) / 2, wT * 1.1);
    return { l: Math.round(cx - demi), r: Math.round(cx + demi), haut: Math.round(r.top - F.top) };
  });
  // Les deux lignes du rail évitent le siège ENTIER, tel qu'il est à l'écran (transform
  // compris) : la vignette vidéo (visio.js) et le tapis sous le nom (reseau.js) élargissent
  // et abaissent les sièges du bord bien au-delà de leurs cartes. Mesuré le 05/09 à
  // plusieurs : « DEALER MUST HIT SOFT 17 » traversait « JOUEUR 1 000 » et sa vignette.
  // …mais PAS le rectangle du siège entier : à cinq sièges sur 1 096 px, chacun fait 214 px
  // de large pour 80 px de contenu, et sa réserve de cartes (.mains, vide en phase de mise)
  // remplit tout le coin — mesuré le 05/09 en solo, plus AUCUNE ligne de rail ne tenait.
  // L'obstacle, c'est ce qui se VOIT : le cercle, le nom, les cartes, la vignette, le tapis ;
  // plus la réserve des cartes, à sa largeur RÉELLE (celle des zones), pour que l'arc ne
  // passe pas sous une carte qui n'est pas encore distribuée.
  const enScreen = e => { const r = e.getBoundingClientRect(); return { l: r.left - F.left, t: r.top - F.top, r: r.right - F.left, b: r.bottom - F.top }; };
  // …mais PAS les cartes, ni la réserve où elles vont tomber : sur un vrai feutre, les cartes
  // se POSENT sur l'impression. Les compter en obstacles (mesuré le 05/09, six captures) ne
  // laissait plus une ligne : « BLACKJACK PAIE 3 CONTRE 2 » n'était jamais dessiné, même en
  // phase de mise, sans une carte sur le tapis. Le grand arc, lui, reste au-dessus des cartes
  // par son plafond (zones[].haut) ; le rail passe sous le cercle, le nom, la vignette.
  const obstacles = sieges.flatMap(sg =>
    [...sg.querySelectorAll(".cercle, .nom, .score, .issue, .visage, .jt-mises, .jt-montant, .tapis-siege, .rangee-bas")].map(enScreen)
  ).filter(z => z.r > z.l && z.b > z.t);
  // 14 px de marge autour de chaque pièce (mesuré le 05/09 : à 8, le jeton de Marc se posait sur « MUST »).
  const touche = (x, y) => obstacles.some(z => x >= z.l - 14 && x <= z.r + 14 && y >= z.t - 8 && y <= z.b + 8);
  /* 🚨 CES DEUX MESURES SONT POSÉES AVANT LE CACHE — elles ne dessinent rien.
     Les deux `return` qui suivent (rendu identique, manche en cours) servent à ne pas
     REDESSINER le lettrage. Mais le bloc ci-dessous ne dessine pas : il PUBLIE la
     géométrie de la rangée des sièges, que la feuille de style lit pour poser l'annonce
     et le conseil. Le laisser derrière les `return`, c'est le rendre dépendant du moment
     où le lettrage a changé pour la dernière fois.
     Le prix, mesuré le 07/09 : à 1920 × 1080, `--bas-noms` n'était JAMAIS posée (vide),
     parce que le seul passage arrivé jusqu'ici avait trouvé des sièges pas encore mis en
     page (`r.height` nul, donc `basNoms` à 0, donc rien d'écrit) — et tous les passages
     suivants sortaient par le cache. La feuille retombait sur son repli `100% - 28px`,
     qui tombe pile sur les tapis. Une variable qu'on ne pose jamais ne lève aucune erreur :
     elle laisse simplement le repli mentir, en silence, à une seule taille d'écran. */
  // La bande où vivent l'annonce et le conseil (style.css) : celle du grand arc, sous la
  // main du croupier — jamais une hauteur codée en dur qui tomberait sur les cartes.
  f.style.setProperty("--bande-haut", Math.round(basCentre + 2) + "px");
  // …et la ligne du CONSEIL (« Stratégie : Rester ») se pose SOUS les noms des sièges, jamais
  // dessus. Mesuré le 06/09 à 1280 × 800 : le nom de ton siège occupait 653→669 et #conseil
  // 664→684 — l'étiquette « TOI » disparaissait au moment précis où c'était à toi de jouer,
  // alors qu'elle est bien là en phase de mise. Le repère qui te dit où tu es assis.
  // 🚨 SOUS LE NOM, IL Y A ENCORE LE TAPIS. La mesure ne prenait que `.nom` — or chaque siège
  // écrit son solde (« 1 000 ») dans un `.tapis-siege` JUSTE EN DESSOUS. Le conseil se posait
  // donc pile sur ces chiffres. Invisible à cinq sièges (le milieu de l'arc est creux, les
  // sièges les plus bas sont sur les côtés) ; à HUIT, les sièges du milieu sont les plus bas
  // ET ils sont centrés, exactement sous la pastille. Mesuré à 1512 × 945, table à huit :
  //   « Stratégie : Tirer »                       120 px → ne touche rien
  //   « Stratégie : Abandonner — écart… −1 »      357 px → efface le tapis de DEUX joueurs
  //   une phrase de stratégie longue             513 px → celui de QUATRE
  // C'est le même défaut que la bande « À X de jouer » corrigée juste au-dessus, une ligne
  // plus bas : une pastille centrée, libre de grandir, dans un arc dont le milieu est plein.
  let basNoms = 0;
  sieges.forEach(sg => sg.querySelectorAll(".nom, .tapis-siege").forEach(el => {
    const r = el.getBoundingClientRect(); if (r.height) basNoms = Math.max(basNoms, r.bottom - F.top);
  }));
  // Bornée au bord BAS du feutre — plus à « H − 25 ». Ce plafond-là était le vrai verrou :
  // sous huit tapis il ne reste que 24 px à 1512 et 14 px à 1280, moins que les 21 px de la
  // pastille, donc la borne la RAMENAIT sur les chiffres qu'on vient de dégager. Le feutre
  // porte `overflow-clip-margin:46px` (les noms des sièges des deux bouts débordent déjà sur
  // le rail, exprès) : la pastille peut donc s'asseoir sur ce rail sans être rognée, et elle
  // y est à sa place — juste au-dessus des boutons qu'elle commente.
  if (basNoms) f.style.setProperty("--bas-noms", Math.round(Math.min(basNoms + 3, H)) + "px");
  /* …et le COIN HAUT-GAUCHE, où la pastille « À toi de jouer » va se ranger à sept et huit
     sièges (cf. style.css), n'est libre que sur un feutre HAUT. Mesuré le 07/09, table à
     huit, distance entre le haut du feutre et le haut de TES cartes :
        1280 × 800  →   7 px      1366 × 768  →  26 px
        1512 × 945  →  75 px      1920 × 1080 →  71 px
     La pastille est posée à 8 px et fait 43 px de haut : sur les deux formats d'ordinateur
     portable les plus courants, elle s'assied donc sur tes deux premières cartes — mesuré
     81 × 43 px et 51 × 39 px à 1280, c'est-à-dire pile le coin qui porte la valeur et la
     couleur. On la décale à DROITE de ces cartes plutôt que dessus : c'est la seule
     direction libre (un balayage du feutre au pas de 6 px ne trouve AUCUNE position libre
     dans le coin, et le coin haut-droit est le miroir du tien — il porte les cartes du
     dernier siège dès qu'il est occupé). Les annonces LARGES (« En attente de joueurs… »,
     « Connexion perdue… ») tombent, elles, dans des phases SANS carte : le décalage vaut
     alors 0 et la pastille retrouve son coin. */
  let gaucheAnnonce = 0;
  sieges.forEach(sg => sg.querySelectorAll(".carte").forEach(el => {
    const r = el.getBoundingClientRect(); if (!r.height) return;
    if (r.top - F.top < 60 && r.left - F.left < W / 2) gaucheAnnonce = Math.max(gaucheAnnonce, r.right - F.left);
  }));
  // …et une fois décalée, elle a une LARGEUR maximale : celle du passage resté libre entre
  // tes cartes et la pièce suivante de la bande (la défausse, puis le sabot). Sans cette
  // borne, « À Sonia de jouer — 8 s » (199 px) et « Le croupier montre un as. Assurance ? »
  // (316 px) traversaient la défausse à 1280 et 1366 — on aurait échangé un défaut contre
  // un autre. Bornée, la phrase passe à la ligne DANS le passage et n'y touche rien : elle
  // a de la place vers le bas (les cercles des sièges commencent 200 px plus bas), pas vers
  // la droite. Sur un feutre haut, `gaucheAnnonce` vaut 0 et rien de tout ceci ne s'applique.
  if (gaucheAnnonce) {
    let butoir = W;
    f.querySelectorAll(".defausse, .sabot, .rangee-haute .carte, .rangee-haute .croupier").forEach(el => {
      const r = el.getBoundingClientRect(); if (!r.height) return;
      const g = r.left - F.left;
      if (r.top - F.top < 110 && g > gaucheAnnonce) butoir = Math.min(butoir, g);
    });
    f.style.setProperty("--annonce-large", Math.max(120, Math.round(butoir - gaucheAnnonce - 24)) + "px");
  } else f.style.removeProperty("--annonce-large");
  f.style.setProperty("--annonce-gauche", (gaucheAnnonce ? Math.round(gaucheAnnonce) + 12 : 16) + "px");

  const t = tableCourante(), tx = texteLettrage(t);
  const cle = [W, H, basHaut, basCentre, zones.map(z => z.l + ":" + z.r + ":" + z.haut).join(","), obstacles.map(z => Math.round(z.l) + ":" + Math.round(z.b)).join(","), t.id].join("|");
  if (cle === LETTRAGE.cle) return;
  // Jamais effacé au milieu d'une manche : un arc qui disparaît d'un coup se voit plus
  // qu'un arc qui passe sous une carte. Il se recalcule à la manche suivante — SAUF si
  // le feutre a changé de taille : un viewBox périmé étire et décale tout le lettrage
  // (mesuré le 05/09 à plusieurs : la barre des coups passait sur deux rangées, le
  // feutre perdait 54 px, et l'arc du rail traversait les noms des sièges).
  // …ni si le rendu gardé est NU (rien d'imprimé) ou celui d'une AUTRE table : mesuré le 05/09
  // (banc, 1024 × 768), en quittant le Boulevard en pleine manche pour le Salon Privé, le premier
  // rendu se faisait sur les sièges d'avant et ne dessinait rien — puis cette garde le gardait tel
  // quel toute la manche suivante. Un arc qui apparaît se voit moins qu'un feutre nu.
  if (T.enJeu && LETTRAGE.cle && LETTRAGE.cle !== "vide" && !LETTRAGE.nu) {
    const morceaux = LETTRAGE.cle.split("|"), w0 = morceaux[0], h0 = morceaux[1], id0 = morceaux[morceaux.length - 1];
    if (w0 === String(W) && h0 === String(H) && id0 === String(t.id)) return;
  }
  LETTRAGE.cle = cle;
  // Le rail bas = deux quarts d'ellipse (les coins) et un bord droit entre eux —
  // la courbe RÉELLE du feutre, relue dans son border-radius (cf. courbeFeutre).
  const cf = courbeFeutre(f, W, H);
  const pointCoin = (cote, d, a) => {
    const rx = cf.rx - d, ry = cf.ry - d, cx = cote === "G" ? cf.rx : W - cf.rx, r = a * Math.PI / 180;
    return [cx + rx * Math.cos(r), cf.cy + ry * Math.sin(r)];
  };
  const arcCoin = (cote, d, a1, a2) => {
    const rx = cf.rx - d, ry = cf.ry - d;
    const [x1, y1] = pointCoin(cote, d, a1), [x2, y2] = pointCoin(cote, d, a2);
    return `M${x1.toFixed(1)} ${y1.toFixed(1)}A${rx.toFixed(1)} ${ry.toFixed(1)} 0 0 ${a2 > a1 ? 1 : 0} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  };
  // Mesuré le 06/09 sur la page vivante : 23,66 px à 1280, 18 px à 1600, 37 px à 1920 — la
  // taille n'était pas monotone (à 1600 la grande ligne n'était plus qu'à 1,09 × la petite, la
  // hiérarchie s'effondrait ; à 1920 elle passait à 2,3 × et devenait l'objet le plus fort du
  // feutre, devant les cartes qui sont le sujet, traversant même la carte du croupier).
  // Deux plafonds, et le rapport grand/petit reste stable de 1280 à 2560.
  const petit = Math.max(11, Math.min(16, Math.round(W * .013))), grand = Math.max(14, Math.min(26, Math.round(W * .021)));
  // Un arc de coin, du bord (`ext`) vers l'intérieur (`int`), arrêté au premier degré où
  // la bande des lettres (la ligne de base et le haut des capitales) entre dans un siège.
  // Trop court pour porter une règle lisible (moins de 26°) : pas de ligne du tout —
  // une règle tronquée se lit comme un défaut, une règle absente ne se lit pas.
  const arcLibre = (cote, d, ext, int) => {
    const pas = Math.sign(int - ext); let fin = ext, len = 0, prec = null;
    for (let a = ext; pas > 0 ? a <= int : a >= int; a += pas) {
      // La bande des lettres : la ligne de base et le HAUT DES CAPITALES (.7 em pour
      // Archivo, pas .85 : à 1280 × 800 la marge en trop butait sur le nom du siège de
      // coin, « DEALER MUST HIT SOFT 17 » disparaissait à gauche, « INSURANCE » restait à droite).
      const [x0, y0] = pointCoin(cote, d, a), [x1, y1] = pointCoin(cote, d + petit * .7, a);
      if (touche(x0, y0) || touche(x1, y1)) break;
      if (prec) len += Math.hypot(x0 - prec[0], y0 - prec[1]);
      prec = [x0, y0]; fin = a;
    }
    if (Math.abs(fin - ext) < 26) return null;
    return { d: cote === "G" ? arcCoin("G", d, ext, fin) : arcCoin("D", d, fin, ext), len };
  };
  // Un texte TIENT sur son arc s'il n'a pas à descendre sous 9,5 px (la taille où on le
  // retire, plus bas) : .87 em par capitale, interlettrage de .22 em compris. Mesuré le
  // 05/09 à 1280 × 800 : le siège de coin coupait l'arc du rail à 35° — 135 px pour les
  // 280 px de « DEALER MUST HIT SOFT 17 » — et la règle disparaissait sans un mot.
  const tient = (arc, texte) => !!arc && arc.len * .96 >= texte.length * .87 * 9.6;
  let out = "", n = 0;
  const ligne = (texte, d, taille, classe) => {
    if (!d) return;
    n++; out += `<defs><path id="lt${n}" d="${d}"/></defs>
      <text class="${classe}" font-size="${taille}"><textPath href="#lt${n}" startOffset="50%" text-anchor="middle">${echap(texte)}</textPath></text>`;
  };
  // Le long de l'arc bas, de part et d'autre des sièges : la règle du croupier à
  // gauche, l'assurance à droite (180 = le bord gauche, 90 = le bas, 0 = le bord
  // droit ; on lit de gauche à droite, le haut des lettres vers le centre).
  const railG = arcLibre("G", 6 + petit, 179, 126), railD = arcLibre("D", 6 + petit, 1, 54);
  // TOUT OU RIEN : une seule ligne de rail, d'un côté, se lit comme un oubli (les critiques,
  // 05/09 : « INSURANCE » à droite, rien à gauche). Si les deux ne tiennent pas, aucune ne
  // va sur le rail — elles s'empilent sous le grand arc.
  const railOk = tient(railG, tx.croupier) && tient(railD, tx.assurance);
  const surRail = { croupier: railOk, assurance: railOk };
  if (surRail.croupier) ligne(tx.croupier, railG.d, petit, "rail");
  if (surRail.assurance) ligne(tx.assurance, railD.d, petit, "rail");
  // Ce que le rail ne peut pas porter va SOUS le grand arc, concentrique — le feutre de
  // Vegas : « PAYS 3 TO 2 », puis la règle du croupier et l'assurance en arcs empilés.
  const empiles = [!surRail.croupier && tx.croupier, !surRail.assurance && tx.assurance].filter(Boolean);
  // Le paiement du blackjack, en grand, dans la bande entre la main du croupier
  // et les sièges — TOUJOURS : un arc concentrique au rail (un sourire). Plafond :
  // à la verticale de chaque siège, l'arc reste au-dessus de ses cartes (le point de
  // l'arc le plus bas dans l'emprise du siège est le plus proche du centre).
  // Plancher : au centre, le haut des lettres passe sous les cartes du croupier.
  // Si les deux se contredisent, la taille descend ; sous 80 % de sa taille, l'arc
  // n'est PAS dessiné : un arc pincé à 15 px entre deux rangées de cartes est
  // illisible et fait fouillis (les critiques, 05/09) — le rail garde ses deux lignes.
  const rx = W * .34, ry = rx * .42, A = 40;
  const plafondPour = (rx, ry, A) => {
    const cosA = Math.cos((90 - A) * Math.PI / 180); let plafond = Infinity;
    zones.forEach(z => {
      const xp = Math.max(z.l, Math.min(z.r, W / 2)), u = Math.abs(xp - W / 2) / rx;
      if (u >= cosA) return;
      plafond = Math.min(plafond, z.haut - 3 + ry * (1 - Math.sqrt(1 - u * u)));
    });
    return isFinite(plafond) ? plafond : H - 40;
  };
  const plafond = plafondPour(rx, ry, A);
  let taille = grand, plancher = basCentre + 3 + taille * .78;
  // La taille cède jusqu'à tenir les DEUX contraintes : le plancher (le haut des lettres sous la main
  // du croupier) ET la marge de 1,15 fois sa taille testée juste après. Mesuré le 05/09 à 1024 × 768 :
  // avec 15 px de bande, la première seule donnait 14 px — qui échouait ensuite à 14 × 1,15 = 16,1 —
  // alors que 13 px tenait tout. Un arc de 13 px vaut mieux qu'un feutre nu.
  const bande = plafond - basCentre;
  if (plafond < plancher || bande < taille * 1.15) { taille = Math.max(13, Math.min(Math.floor((bande - 3) / .78), Math.floor(bande / 1.15))); plancher = basCentre + 3 + taille * .78; }
  // Le grand arc est TOUJOURS imprimé dès qu'une bande de 14 px existe entre la main du
  // croupier et les cartes des sièges : un feutre nu se voit avant tout le reste (les
  // critiques, 05/09). Il cède en taille jusqu'à 13 px avant de disparaître.
  const cache = plafond - basCentre < taille * 1.15 || taille < 13;
  // Le 2ᵉ arc (les règles que le rail n'a pas portées) : même centre, rayons agrandis de
  // `delta2`, un peu plus ouvert (il est à l'extérieur). Il n'existe que s'il reste sa
  // hauteur sous le grand arc AVANT les cartes des sièges ; le grand arc remonte alors
  // pour lui laisser la place. Rien ne s'empile sous un grand arc qui n'est pas dessiné.
  const A2 = A + 2;
  let t2 = 0, delta2 = 0, dispo = -Infinity, empile = false;
  if (!cache && empiles.length) {
    // La première paire (taille du 2ᵉ, taille du grand) qui tient : le 2ᵉ de petit − 1 à 10 px
    // — sa lisibilité d'abord —, le grand à sa taille puis en cédant jusqu'à 80 % (le seuil
    // où il ne serait plus dessiné du tout). `dsp` est le plus bas où le grand arc peut
    // poser sa ligne de base en laissant au 2ᵉ (delta2 plus bas) la place d'être au-dessus
    // des cartes. Mesuré le 05/09 à 1280 × 800 : 52 px entre la rangée du croupier et tes
    // cartes — le grand à 20 px et les règles à 11 y tiennent, pas 24 et 13.
    const tMin = Math.max(13, Math.round(grand * .6));
    const candidats = [petit - 1, petit - 2, petit - 3, 10].filter((v, i, a) => v >= 10 && a.indexOf(v) === i);
    boucle: for (const tt of candidats) {
      const d2 = Math.round(tt * 1.35), dsp = Math.min(plafond, plafondPour(rx + d2, ry + d2, A2) - d2 - 2);
      for (let tg = taille; tg >= tMin; tg--) {
        if (basCentre + 3 + tg * .78 <= dsp) { taille = tg; plancher = basCentre + 3 + taille * .78; t2 = tt; delta2 = d2; dispo = dsp; empile = true; break boucle; }
      }
    }
  }
  const rx2 = rx + delta2, ry2 = ry + delta2;
  let yBas = plafond >= plancher ? plancher + (plafond - plancher) * .5 : plancher;
  if (empile) yBas = Math.max(plancher, Math.min(yBas, dispo));
  LETTRAGE.mesure = { plafond, dispo, plancher, taille, delta2, empile, empiles: empiles.length, cache };
  const cy = yBas - ry;
  const p = (a, kx, ky) => { const r = a * Math.PI / 180; return [W / 2 + (kx || rx) * Math.cos(r), cy + (ky || ry) * Math.sin(r)]; };
  const [x1, y1] = p(90 + A), [x2, y2] = p(90 - A);
  if (!cache) ligne(tx.paie, `M${x1.toFixed(1)} ${y1.toFixed(1)}A${rx.toFixed(1)} ${ry.toFixed(1)} 0 0 0 ${x2.toFixed(1)} ${y2.toFixed(1)}`, taille, "grand");
  if (empile) {
    const [x3, y3] = p(90 + A2, rx2, ry2), [x4, y4] = p(90 - A2, rx2, ry2);
    ligne(empiles.join("  \u00b7  "), `M${x3.toFixed(1)} ${y3.toFixed(1)}A${rx2.toFixed(1)} ${ry2.toFixed(1)} 0 0 0 ${x4.toFixed(1)} ${y4.toFixed(1)}`, t2, "rail empile");
  }
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.innerHTML = out;
  LETTRAGE.nu = !svg.textContent.trim();   // un rendu sans une lettre ne mérite pas d'être gardé
  // Un texte plus long que son arc est coupé aux DEUX bouts (ancré au milieu) :
  // « DEALER MUST STAND ON ALL 17 » perdait son D à Macao. On réduit la taille
  // jusqu'à ce qu'il tienne, plutôt que d'écraser les lettres ; sous 9,5 px (un arc
  // raccourci par un siège) on retire la ligne, elle ne se lirait plus.
  svg.querySelectorAll("text").forEach(tx => {
    const tp = tx.querySelector("textPath"), chemin = svg.querySelector(tp.getAttribute("href"));
    if (!chemin || !chemin.getTotalLength || !tx.getComputedTextLength) return;
    const L = chemin.getTotalLength() * .96; let taille = parseFloat(tx.getAttribute("font-size"));
    for (let k = 0; k < 6 && tx.getComputedTextLength() > L && taille > 8; k++) {
      taille = Math.max(8, Math.floor(taille * L / tx.getComputedTextLength() * 100) / 100);
      tx.setAttribute("font-size", taille);
    }
    if (taille < 9.5) tx.remove();
  });
  // La boucle ci-dessus rétrécit chaque texte contre SON arc, sans jamais regarder ses frères :
  // mesuré le 06/09 à 1920, les deux lignes de rail — même rang d'information, même table —
  // sortaient à 19,91 et 16,18 px. On les réaccorde sur la plus petite.
  const rails = [...svg.querySelectorAll("text.rail:not(.empile)")];
  if (rails.length > 1) {
    const mini = Math.min(...rails.map(e => parseFloat(e.getAttribute("font-size")) || 0));
    if (mini > 0) rails.forEach(e => e.setAttribute("font-size", mini));
  }
}
// Deux lieux ont un motif tissé dans le feutre : les losanges de la laque de
// Macao, le guillochis d'un cadran pour Londres · Monte-Carlo. Les autres se
// distinguent par la couleur et la lumière — un motif de plus serait un gadget.
// Le motif ne pèse jamais plus que le grain : sinon il devient le sujet.
function rendreMotif(lieu) {
  const svg = $("motif"); if (!svg) return;
  if (lieu === "cotai") svg.innerHTML = `<defs><pattern id="mtf" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="translate(20 0)">
      <path d="M20 0L40 20L20 40L0 20Z" fill="none" style="stroke:var(--or)" stroke-opacity=".09" stroke-width="1"/>
      <circle cx="20" cy="20" r="1.6" style="fill:var(--or)" fill-opacity=".10"/></pattern></defs>
    <rect width="100%" height="100%" fill="url(#mtf)"/>`;
  else if (lieu === "cercle") {
    let g = "";
    for (let r = 26; r <= 380; r += 14) g += `<ellipse cx="50%" cy="-2" rx="${r * 1.35}" ry="${r}" fill="none" stroke="#fff" stroke-opacity=".045" stroke-width=".7"/>`;
    for (let a = 0; a < 360; a += 6) { const t = a * Math.PI / 180, x1 = (Math.cos(t) * 30).toFixed(1), y1 = (Math.sin(t) * 22 - 2).toFixed(1),
      x2 = (Math.cos(t) * 520).toFixed(1), y2 = (Math.sin(t) * 385 - 2).toFixed(1);
      g += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#fff" stroke-opacity=".022" stroke-width=".5" style="transform:translateX(50%)"/>`; }
    svg.innerHTML = `<g>${g}</g>`;
  } else svg.innerHTML = "";
}
// Une annonce à l'écran efface le grand lettrage sous elle (la bande est la même) ;
// observé sur le nœud, pour que les écritures directes (table à plusieurs) comptent.
if (window.MutationObserver && $("annonce")) new MutationObserver(() => {
  $("feutre").classList.toggle("annonce-on", !!$("annonce").textContent.trim());
}).observe($("annonce"), { childList: true, characterData: true, subtree: true });
// Le lettrage se recalcule quand le feutre change de taille — y compris quand
// la vue apparaît (0 × 0 → sa vraie taille).
if (window.ResizeObserver) new ResizeObserver(() => rendreLettrage()).observe($("feutre"));
function construireSieges() {
  // Sept, pas six : trois tables du catalogue en ont sept (Le Front de Mer, Le Cercle,
  // L'Aquarium) et on leur en retirait un. La table entre amis, elle, en a huit
  // (NB_SIEGES, src/table-reseau.mjs) — le catalogue ne la borne pas.
  const t = tableCourante(), n = Math.max(1, Math.min(t.sieges, 7));
  const moi = Math.floor((n - 1) / 2);
  T.sieges = [];
  for (let k = 0; k < n; k++) {
    const toi = k === moi;
    T.sieges.push({ nom: toi ? (prenom() || "Toi") : NOMS[k > moi ? k - 1 : k], toi, mains: [] });
    if (toi) T.toi = T.sieges[k];
  }
  rendreSieges();
}
function rendreSieges() {
  const el = $("sieges"); el.innerHTML = "";
  T.sieges.forEach((st, si) => {
    const d = document.createElement("div");
    d.className = "siege" + (st.toi ? " toi" : "") + (T.actif && T.actif.siege === si ? " actif" : "");
    const hs = document.createElement("div"); hs.className = "mains";
    st.mains.forEach((h, hi) => {
      const w = document.createElement("div");
      w.className = "m" + (T.actif && T.actif.siege === si && T.actif.main === hi ? " encours" : "");
      const md = document.createElement("div"); md.className = "main"; md.id = `m_${si}_${hi}`;
      // La pose est REJOUÉE ici : `carteEl` ne fabrique qu'une carte droite, et sans ce
      // rappel les mains des joueurs se redressaient à chaque redessin (cf. appliquerPose).
      if (!h.ramassee) h.cards.forEach((c, ci) => { const e = carteEl(c); md.appendChild(e); appliquerPose(e, c, ci, 1); });
      const sc = document.createElement("div"); sc.className = "score";
      ecrireScore(sc, scoreTexte(h));   // même écriture qu'au tic : le premier rendu a déjà les deux corps
      const rs = document.createElement("div"); rs.className = "issue " + (ISSUE[h.result] || "");
      rs.textContent = h.result || ""; rs.style.setProperty("--rang", si);   // la pastille surgit quand ce siège est payé
      // La pastille bascule à sa PREMIÈRE apparition seulement : rendreSieges()
      // reconstruit tout, une pastille déjà vue ne doit pas resauter.
      if (h.result && !h.issueVue) { rs.classList.add("neuve"); h.issueVue = true; }
      w.append(md, sc, rs); hs.appendChild(w);
    });
    // Le cercle de mise, doré, devant chaque siège : vide pour l'instant, le lot
    // Jetons y posera les piles (#cercle_<siège>). --ecart soulève les sièges du bord.
    const ce = document.createElement("div"); ce.className = "cercle"; ce.id = "cercle_" + si; ce.dataset.siege = si;
    const nm = document.createElement("div"); nm.className = "nom serre"; nm.textContent = st.nom;
    d.style.setProperty("--ecart", (si - (T.sieges.length - 1) / 2).toFixed(1));   // signé : négatif à gauche
    if (st.mains.length && st.mains.every(h => h.ramassee)) d.classList.add("saute");
    d.append(hs, ce, nm); el.appendChild(d);
  });
  // 🚨 LE NOMBRE DE SIÈGES QU'ON VIENT DE POSER, une seule source. Le catalogue ne le sait
  // pas : la table entre amis en a huit (NB_SIEGES) quelle que soit la table choisie, et
  // trois du catalogue en ont sept. En dépendent, dans style.css : la largeur du tapis
  // ([data-sieges="3"], ="4"), le plancher des vignettes vidéo (="7", ="8") et la bascule
  // en pellicule sous 1360 px (="8").
  // ⚠️ AVANT dimensionnerCartes() : c'est cet attribut qui décide de la pellicule, et
  // dimensionnerCartes lit `flex-wrap` pour savoir dans quel mode il mesure.
  $("v-table").dataset.sieges = T.sieges.length;
  dimensionnerCartes();
  rendreLettrage();
  // Sur téléphone les sièges défilent horizontalement : sans ce recentrage, le
  // siège qui joue peut être hors écran au moment précis où c'est son tour.
  const vedette = el.querySelector(".siege.actif") || el.querySelector(".siege.toi");
  if (vedette && el.scrollWidth > el.clientWidth + 4) vedette.scrollIntoView({
    inline: "center", block: "nearest",
    behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth" });
  // Les cercles de mise viennent d'être recréés : les piles de jetons (jetons.js) s'y reposent.
  emettre("sieges", { sieges: T.sieges });
}
// Le tour passe à un autre siège : on bascule .actif/.encours sur les nœuds EN PLACE.
// Reconstruire (rendreSieges) fait naître chaque siège dans son état final : la
// transition du halo doré ne joue jamais, et les cartes posées sont recréées.
function marquerActif() {
  const el = $("sieges"); if (!el) return;
  el.querySelectorAll(".siege").forEach((d, si) => {
    d.classList.toggle("actif", !!(T.actif && T.actif.siege === si));
    d.querySelectorAll(".m").forEach((w, hi) => w.classList.toggle("encours", !!(T.actif && T.actif.siege === si && T.actif.main === hi)));
  });
  const vedette = el.querySelector(".siege.actif") || el.querySelector(".siege.toi");
  if (vedette && el.scrollWidth > el.clientWidth + 4) vedette.scrollIntoView({
    inline: "center", block: "nearest", behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth" });
}
function rafraichirBarre() {
  const t = tableCourante(), total = t.jeux * 52;
  // Le sabot montre ses cartes et sa carte de coupe ; la défausse, son tas.
  // Une mélangeuse continue n'affiche rien : ni compte de cartes, ni carte de coupe — c'est
  // toute la leçon de la table. Le nombre reste lisible en data-n (la sonde, le banc).
  const csm = t.melange === "melangeuse_continue";
  const sb = $("sabot"); sb.textContent = csm ? "" : T.sabot.length; sb.dataset.n = T.sabot.length;
  sb.style.setProperty("--reste", (T.sabot.length / total).toFixed(3));
  sb.style.setProperty("--coupe", csm ? "0" : (T.coupe / total).toFixed(3));
  sb.title = csm ? "Mélangeuse continue : les cartes jouées y retournent après chaque main — rien à compter"
    : `${T.sabot.length} cartes restent dans le sabot · la carte de coupe est plantée à ${T.coupe} cartes de la fin : on joue ${Math.round((t.penetration || .75) * 100)} % du sabot avant de remélanger`;
  $("defausseN").textContent = T.defausse; $("defausse").classList.toggle("pleine", T.defausse > 0);
  $("defausse").style.setProperty("--pile", Math.min(1, T.defausse / total).toFixed(3));
  $("defausse").title = `${T.defausse} carte${T.defausse > 1 ? "s" : ""} dans la défausse`;
  const jeuxRestants = T.sabot.length / 52;
  const visible = !!T.montre;
  $("tRC").textContent = visible ? sgn(T.rc) : "—";
  $("tJeux").textContent = visible ? fr1(jeuxRestants) : "—";
  const tc = sys().equilibre ? CT.compteVrai(T.rc, jeuxRestants) : null;
  $("tTC").textContent = visible ? (tc === null ? "n/a" : fr1(tc)) : "—";
  // La mise conseillée est la rampe de référence 2(TC−1), en UNITÉS de mise minimum
  // (misesUnites ne bat pas sa table — cf. counting.mjs). Le tapis, lui, est rendu par jetons.js.
  // « Rampe » et non « Mise » : la mise RÉELLE est chiffrée à côté du tapis (jetons.js).
  $("tMise").textContent = visible && tc !== null ? CT.miseRampe(tc) : "—";
  const hc = $("hudCompte"); hc.classList.toggle("masque", !visible);
  hc.firstElementChild.className = visible ? (T.rc > 0 ? "plus" : T.rc < 0 ? "moins" : "") : "";
  hc.title = visible
    ? "Le compte est affiché : sers-t'en pour vérifier, pas pour t'en passer."
    : "Le compte est masqué tant que tu ne l'as pas demandé : c'est à toi de le tenir.";
}
// Un seul bouton de 38 px à la place de deux cases de 13 px, inutilisables au doigt.
$("bMontrer").onclick = () => {
  T.montre = !T.montre;
  $("bMontrer").setAttribute("aria-pressed", T.montre ? "true" : "false");
  $("bMontrer").textContent = T.montre ? "Masquer le compte" : "Montrer le compte";
  rafraichirBarre();
};
function boutons(o) {
  [["donne", "bDonne"], ["tire", "bTire"], ["reste", "bReste"], ["double", "bDouble"], ["separe", "bSepare"], ["abandon", "bAbandon"]]
    .forEach(([k, id]) => { $(id).disabled = !o[k]; });
  // Pas de donne sans mise : jetons.js pose T.miseOk (false tant que la mise est sous le minimum).
  if (o.donne && T.miseOk === false) $("bDonne").disabled = true;
}
// `cr` = le rect de la CARTE elle-même, mesuré avant l'animation. Mesuré sur le
// centre de la main, la k-ième carte partait à (k − (n−1)/2)·pas du sabot — la 4ᵉ
// carte du croupier naissait 55 px à droite du sabot.
// ⚠️ Les sièges du bord sont TOURNÉS (--tilt, ±7°) : un vecteur calculé à l'écran
// puis appliqué dans un siège tourné est lui-même tourné. Mesuré le 05/09 : la carte
// de Marc naissait 88 px sous le sabot, entière sur le feutre. On exprime le vecteur
// dans le repère du siège (inverse de sa transformation), et la rotation de la carte
// en vol retire --tilt pour garder l'angle à l'écran.
// Ce que la carte reçoit : sa durée et son retard, FIGÉS en ligne sur l'élément. Mesuré le
// 05/09 en rAF : `--don` dérive de `--intervalle`, et `poserIntervalle()` en fin de donne
// (ou à chaque turbo) RETIMAIT une animation terminée (fill both) qui rejouait ses 20 %
// finaux — la carte cachée sautait de 10 px, 80 ms après s'être posée. Une animation finie
// ne dépend plus de rien : la classe part à `animationend`, la pose de repos est
// transform:none, la même que la dernière image.
// La durée suit la DISTANCE : 6,7 px/ms au départ pour Marc (112 px par image à 60 Hz),
// c'était une carte qui se matérialise à 230 px du sabot, pas une carte qui en sort.
// Un croupier a un poignet à vitesse à peu près CONSTANTE : c'est la durée qui suit la
// distance, pas l'inverse. Mesuré le 06/09 sur les 11 cartes d'une donne : le siège le plus
// lointain (595 px) filait à 1,84 px/ms et le plus proche (165 px) à 0,67 — trois fois moins,
// avec un pic relevé à 80 px par image, soit une largeur de carte entière franchie entre deux
// images. `dureeVol` n'étalait la durée que de 1,53 × pour un écart de distance de 3,6 ×.
// 🚨 --don NE SE LIT PAS ICI. Une propriété personnalisée que personne n'a enregistrée par
// @property n'est pas résolue à sa valeur calculée : getPropertyValue rend le jeton brut
// « clamp(150ms, calc(900ms * .72), 420ms) » (sondé le 06/09), parseFloat en fait NaN, et le
// `|| 300` transformait le terme `don * 1.5` en une CONSTANTE de 450 ms — un plafond qui
// n'avait jamais rien à voir avec la cadence qu'il prétendait suivre. --intervalle, lui, est
// posé en ligne par poserIntervalle() : il se parse (900 ms sondés). Le plafond ne s'écrit
// donc plus qu'en fonction de lui. .80 (et non .95) laisse une centaine de millisecondes de
// repos entre la pose d'une carte et le départ de la suivante : c'est ce silence qui fait
// entendre douze gestes au lieu d'un roulement.
// --don reste posé par .scene / .plateau (style.css) : les exercices s'en servent VRAIMENT,
// par var() en CSS, où il est bien résolu. C'est le lire en JS qui ne marchait pas.
function dureeVol(d) {
  const slot = parseFloat(getComputedStyle($("plateau")).getPropertyValue("--intervalle")) || 450;
  return Math.round(Math.max(190, Math.min(slot * .80, d / 1.55)));
}
const DELAI_VOL = 40;   // ms : la main du croupier part en même temps que la carte (croupier.js)
/* `viser` (facultatif) = l'instant où la carte doit se POSER. Sans lui (un tirage isolé, une
   carte rejouée par reseau.js), on garde le retard fixe d'avant.
   ── Mesuré le 06/09 sur une donne complète : les DÉPARTS étaient métronomiques (367 ms ± 2)
   mais les vols duraient de 150 à 342 ms, donc les POSES — la seule chose qu'on voie et qu'on
   entende — s'espaçaient de 229 à 562 ms, et deux cartes se retrouvaient en l'air ensemble.
   On cadence donc sur l'ARRIVÉE : chaque carte attend le temps qu'il faut avant de partir. */
function animerDepuisSabot(e, cr, viser) {
  const s = $("sabot").getBoundingClientRect();
  // Le CENTRE de la carte part du centre du sabot : à l'échelle .80, elle tient tout
  // entière dans sa boîte et en SORT. Mesuré le 05/09 avec le haut de la carte à
  // sabot.top + 6 : centrée 20 px sous le milieu du sabot, elle dépassait de 18 px
  // sous lui — une carte entière posée sur le feutre avant de partir.
  let dx = s.left + s.width / 2 - (cr.left + cr.width / 2), dy = s.top + s.height * .5 - (cr.top + cr.height / 2);
  /* …mais partir du CENTRE, c'est naître à l'intérieur de la boîte : sondé le 06/09,
     chaque carte passait ses 8 premières images DERRIÈRE #sabot (128 ms), puis 6 autres
     derrière .rangee-haute et les cartes du croupier — 65 % du vol invisible. On décale
     donc le départ à la BOUCHE du sabot, dans le sens du trajet : le vecteur garde sa
     direction et perd .42 de la plus petite dimension du sabot (24 px à 1280 × 800). */
  const brut = Math.hypot(dx, dy) || 1, bouche = Math.min(s.width, s.height) * .42;
  const recul = Math.max(0, 1 - bouche / brut); dx *= recul; dy *= recul;
  // ⚠️ Les sièges du bord sont TOURNÉS (--tilt) : le vecteur, mesuré à l'écran, doit passer
  // dans le repère du siège — sans quoi la carte de Marc naissait 88 px sous le sabot.
  const siege = e.closest(".siege");
  if (siege && window.DOMMatrixReadOnly) {
    try {
      const inv = new DOMMatrixReadOnly(getComputedStyle(siege).transform).inverse();
      const v = inv.transformPoint(new DOMPoint(dx, dy, 0, 0)); dx = v.x; dy = v.y;
    } catch (err) { log("repere-siege", err); }
  }
  e.style.setProperty("--dx", dx + "px"); e.style.setProperty("--dy", dy + "px");
  const dist = Math.hypot(dx, dy) || 1, duree = dureeVol(dist);
  // Le sens du trajet, dans le repère de la carte : le sabot est en (--dx, --dy), donc on
  // va vers l'opposé. Trois choses en dépendent, et une seule les calcule.
  const ux = -dx / dist, uy = -dy / dist;
  // ① La PORTANCE suit la distance. Une portance fixe de 30 px faisait décoller la carte
  //    du croupier, à 165 px du sabot, autant que celle de Léa à 595 : elle VOLAIT. Ici
  //    8,7 px au plus loin, 2 px pour le croupier — elle SKIMME le feutre.
  e.style.setProperty("--leve", Math.min(9, dist * .012).toFixed(1) + "px");
  // ② Le DÉPASSEMENT : 4 px au-delà de sa place, dans le sens du trajet, avant de revenir.
  e.style.setProperty("--ovx", (ux * 4).toFixed(2) + "px"); e.style.setProperty("--ovy", (uy * 4).toFixed(2) + "px");
  // ③ La TRAÎNÉE part vers l'ARRIÈRE (le sabot). --tang est l'angle CSS du dégradé :
  //    une direction (vx, vy) à l'écran s'écrit atan2(vx, −vy) en degrés de gradient.
  //    --toff la pousse derrière la carte, TANGENTE à elle : le rayon du rectangle de la carte
  //    dans la direction du trajet, plus celui de l'ellipse de la traînée. Vu à l'écran le
  //    06/09 : à .62 largeur elle recouvrait la moitié de la carte et la lavait (on croyait la
  //    carte transparente) ; à deux demi-diagonales elle s'en DÉTACHAIT — une flaque de lumière
  //    posée sur le feutre à côté d'une carte. Une carte n'est pas un carré : c'est le rayon
  //    dans LA direction du vol qu'il faut, pas une demi-largeur.
  const hw = cr.width / 2 || 42, hh = cr.height / 2 || 59, pu = 1e-3;
  const rCarte = Math.min(Math.abs(ux) > pu ? hw / Math.abs(ux) : 1e6, Math.abs(uy) > pu ? hh / Math.abs(uy) : 1e6);
  const rTrainee = 1 / (Math.hypot(ux / hw, uy / hh) || 1 / hw);
  e.style.setProperty("--tbx", (-ux).toFixed(3)); e.style.setProperty("--tby", (-uy).toFixed(3));
  e.style.setProperty("--toff", (rCarte + rTrainee).toFixed(1) + "px");
  e.style.setProperty("--tang", (Math.atan2(-ux, uy) * 180 / Math.PI).toFixed(1) + "deg");
  const reduit = matchMedia("(prefers-reduced-motion:reduce)").matches;
  // Le retard ABSORBE l'écart de durée entre un vol court et un vol long. Sous turbo (un clic
  // sur le feutre pendant la donne) la visée est dépassée d'office : on retombe sur le retard
  // fixe plutôt que de laisser une carte attendre une horloge qu'on vient de bousculer.
  let delai = DELAI_VOL;
  if (reduit) delai = 0;
  else if (viser && !T.turbo) delai = Math.max(0, Math.min(900, Math.round(viser - performance.now() - duree)));
  e.style.animationDuration = duree + "ms"; e.style.animationDelay = delai + "ms";
  // 🚨 …ET les MÊMES en propriétés personnalisées, pour la TRAÎNÉE. Elle vit sur un
  // pseudo-élément, et `animation-duration` / `animation-delay` ne sont pas héritées : posées
  // en ligne sur la carte elles ne l'atteignent JAMAIS. Elle tournait donc sur --don (356 ms
  // pendant la donne) pendant que la carte volait 190, et démarrait à l'instant du clic —
  // c'est-à-dire qu'elle brillait sur le feutre AVANT que la carte ne parte. Les propriétés
  // personnalisées, elles, descendent jusqu'au ::after.
  // ⚠️ Le geler dans une sonde ne le montre PAS : forcer les quatre animations au même
  //    currentTime les remet en phase et masque exactement le décalage qu'on cherche.
  e.style.setProperty("--don", duree + "ms"); e.style.setProperty("--tdelai", delai + "ms");
  // Le groupe qui porte la carte ne passe au-dessus de la rangée haute que 55 ms après le
  // DÉPART RÉEL (style.css, .sieges:has / .croupier:has). Sans ce report, une carte qui attend
  // son tour restait posée SUR le sabot, à moitié dehors, jusqu'à 200 ms (sondé le 06/09) :
  // elle ne sortait plus du sabot, elle flottait dessus.
  const f = $("feutre"); if (f) f.style.setProperty("--sortie", (delai + 55) + "ms");
  e.addEventListener("animationend", () => { e.classList.remove("carte--entre");
    e.style.animationDuration = ""; e.style.animationDelay = ""; e.style.removeProperty("--don"); e.style.removeProperty("--tdelai"); }, { once: true });
  e.classList.add("carte--entre");
  // ⚠️ En mouvement réduit, le CSS ramène l'animation à 1 ms par !important : annoncer 342 ms
  //    au bus faisait arriver le clic de la pose (socle.js) 341 ms après la carte.
  return { duree: reduit ? 1 : duree, delai };
}
/* Deux cartes ne sont jamais posées EXACTEMENT pareil : un croupier n'aligne pas au réglet.
   La pose est TIRÉE DE LA CARTE elle-même (rang, couleur) et de son rang dans la main — la
   même main rejouée se repose à l'identique, ce n'est pas un générateur d'aléatoire qui
   ferait frémir la table à chaque redessin. ±1,6° et ±2 px chez les joueurs ; le croupier,
   qui pose devant lui à deux mains, est trois fois plus droit. */
function poseCarte(c, i) {
  let h = (i + 1) * 2654435761;
  const s = String((c && c.r) || "") + String((c && c.suit) || "");
  for (let k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) | 0;
  h = Math.abs(h);
  return { angle: ((h % 33) - 16) / 10, dev: ((h >> 5) % 5) - 2 };
}
// 🚨 POSER une carte, c'est le geste de croupier — et il doit être fait AUX DEUX ENDROITS
// où une carte apparaît, sinon il ne survit pas au premier redessin. C'était le cas :
// `tirer()` posait l'angle à la création, mais `rendreSieges()` reconstruit chaque main avec
// `carteEl(c)` seul — donc au RÈGLEMENT, sondé le 07/09, toutes les cartes des joueurs
// avaient `--pose` et `--dev` « absent » (rotate: 0) pendant que le croupier, dont la main
// vit dans #dMain qu'on ne reconstruit pas, gardait −0,49° et 0,34°. Sur la seule image que
// le joueur étudie vraiment, celle où il lit son résultat, les sept mains étaient alignées au
// réglet, comme imprimées, à côté d'une main de croupier restée de travers.
// ⚠️ Le calcul est DÉTERMINISTE (poseCarte hache la carte et son rang dans la main) et la
// correction anti-parallèle lit la carte PRÉCÉDENTE : rejoué dans l'ordre sur une main
// entière, il rend exactement les mêmes angles qu'à la donne. C'est ce qui permet de le
// rappeler sans que le tapis bouge.
function appliquerPose(e, c, i, droit) {
  const ps = poseCarte(c, i);
  // ⚠️ Deux cartes VOISINES parallèles, c'est exactement ce qu'on répare : le hachage seul
  // les rapproche une fois sur trente-trois (mesuré le 06/09 — la main de Sonia, −0,7° et
  // −0,7°). Trop près de sa voisine, la carte bascule de l'autre côté. Ça reste déterministe :
  // la voisine l'est aussi, la même main rejouée se repose à l'identique.
  let ang = ps.angle;
  const prec = e.previousElementSibling;
  if (prec) {
    const a0 = parseFloat(prec.style.getPropertyValue("--pose")) || 0;
    if (Math.abs(ang * droit - a0) < .5 * droit) ang = (a0 >= 0 ? -1 : 1) * Math.max(.5, Math.abs(ang));
  }
  e.style.setProperty("--pose", (ang * droit).toFixed(2) + "deg");
  e.style.setProperty("--dev", (ps.dev * droit).toFixed(1) + "px");
}
async function tirer(main, hote, cachee, qui, viser) {
  // Filet de sécurité : plutôt remélanger que distribuer une carte inexistante.
  if (!T.sabot.length) { const t = tableCourante(); const s = await sabotProuvable(t.jeux);
    T.sabot = s.cartes; T.graine = s.graine; T.empreinte = s.empreinte; T.revele = false;
    T.rc = CT.compteInitial(DB.sys, t.jeux); T.vues = 0; T.sabot.pop(); rendreRecu();
    emettre("remelange", { table: t.id, cartes: T.sabot.length, pendantDonne: true });
  }
  const c = T.sabot.pop(); c.cachee = !!cachee; main.push(c);
  // Les cartes déjà posées glissent quand la main se recentre (FLIP) : mesurées
  // avant l'insertion, animées de leur ancienne place vers la nouvelle.
  const avant = [...hote.children].map(x => x.getBoundingClientRect().left);
  const e = carteEl(c, cachee); hote.appendChild(e);
  // 🚨 La pose est posée À LA CRÉATION, et c'est le REPOS qui la porte (.main .carte, style.css) :
  // écrite seulement pendant le vol, elle disparaîtrait d'un coup à la fin de l'animation.
  appliquerPose(e, c, main.length - 1, qui && qui.siege === "croupier" ? .375 : 1);
  // Une carte de plus dans un siège : l'éventail se resserre pour qu'elle tienne.
  // Jamais pour le croupier : sa rangée a une géométrie fixée avant la première carte.
  if (qui && qui.siege !== "croupier") dimensionnerCartes();
  // Mesurée AVANT l'animation : pendant le vol, le rect de la carte est celui
  // du sabot, pas celui de son point d'arrivée.
  const cr = e.getBoundingClientRect(), sr = $("sabot").getBoundingClientRect();
  // La main du croupier se resserre au lieu de pousser le sabot : --pas suit le nombre
  // de cartes et la place que le bloc lui laisse (jamais moins d'un tiers de carte).
  if (hote.id === "dMain" && hote.children.length > 2) {
    const bloc = hote.parentNode, qui = bloc.querySelector(".qui");
    const dispo = bloc.clientWidth - (qui ? qui.offsetWidth : 0), w = e.offsetWidth || 84, k = hote.children.length;
    hote.style.setProperty("--pas", Math.max(w * .3, Math.min(w * .62, (dispo - w) / (k - 1))).toFixed(1) + "px");
  }
  const vol = animerDepuisSabot(e, cr, viser);
  if (!matchMedia("(prefers-reduced-motion:reduce)").matches) {
    // Mesuré le 05/09 : la 1re carte glissait 150 ms AVANT que la 2e n'atterrisse. Elle
    // attend le vol RÉEL de la carte : elle bouge quand on la touche.
    // .72 laissait encore 96 ms d'avance (mesuré le 06/09) — l'éventail s'écartait devant une
    // carte qui n'était pas là. À .92, et en 170 ms, le geste EST la poussée de la carte.
    [...hote.children].slice(0, -1).forEach((x, i) => {
      const dx = avant[i] - x.getBoundingClientRect().left;
      if (Math.abs(dx) > .5) x.animate([{ transform: `translateX(${dx}px)` }, { transform: "none" }],
        { duration: 170, delay: Math.round(vol.delai + vol.duree * .92), easing: "cubic-bezier(.2,.7,.3,1)", fill: "backwards" });
    });
  }
  // La main du croupier part AVEC la carte (même retard, croupier.js lit `duree` et
  // `delai`) : le geste pousse la carte pendant la première moitié du vol.
  emettre("carte", { siege: qui ? qui.siege : "croupier", main: qui ? qui.main : 0, index: main.length - 1,
    carte: c, cachee: !!cachee, el: e, duree: vol.duree, delai: vol.delai,
    depuis: { x: sr.left + sr.width / 2, y: sr.top + sr.height / 2 },
    vers: { x: cr.left + cr.width / 2, y: cr.top + cr.height / 2 } });
  // Le chuintement du sabot part QUAND la carte en sort, pas 40 ms avant. (Le clic de la
  // POSE, lui, est calé sur l'arrivée par socle.js, qui lit `duree` et `delai` du bus.)
  son("carte", { apres: vol.delai / 1000 });
  if (!cachee) { T.rc += valeurCompte(c); T.vues++; }
  rafraichirBarre(); await pause(rythme()); return c;
}
// Un score qui change ne surgit pas : il COMPTE — un tic par point, 250 ms en tout, du total
// d'avant (ou de zéro, pour une première carte) jusqu'au nouveau. En mouvement réduit, ou quand
// la valeur n'est pas un nombre, il s'écrit d'un coup. Les tics sont des minuteurs, pas des rAF :
// sous temps virtuel (la sonde) seule la première image est livrée, et un score resterait à
// mi-chemin ; le dernier minuteur écrit toujours la valeur exacte.
const SCORE_TICS = new WeakMap();
/* Le NOMBRE et son QUALIFICATIF ne pèsent pas pareil : « 20 » porte la décision, « souple ·
   doublé » la nuance. Séparés, le nombre peut être écrit GRAND (ton total, cf. .siege.toi
   .score) sans que la ligne entière ne s'allonge. Mesuré le 06/09 à 1024 × 768, cinq sièges :
   « 20 souple · doublé » d'un seul corps à 26 px faisait 328 px de large et s'écrivait SUR le
   total de Sonia et sur celui de Karim ; en deux corps il en fait 218 — la largeur qu'il avait
   AVANT (214 px), avec un chiffre pourtant une fois et demie plus gros, et plus aucune collision.
   ⚠️ `textContent` reste EXACTEMENT la même chaîne (les deux morceaux se recollent) : la
   comparaison d'égalité et le tic de comptage, plus bas, continuent de travailler dessus.
   Le score du croupier n'a jamais de qualificatif — il ne change pas d'un pixel. */
function ecrireScore(el, v) {
  const m = /^(\d+)(.*)$/.exec(v);
  if (!m) { el.textContent = v; return; }
  el.textContent = "";
  // ⚠️ Un <span>, PAS un <b> : #dScore EST déjà un <b>, et un <b> imbriqué y calculait un
  // poids de 900 là où la ligne du croupier en demande 700 — le score du croupier changeait
  // de graisse sans que personne ne l'ait demandé (mesuré le 06/09).
  const b = document.createElement("span"); b.className = "chiffre"; b.textContent = m[1]; el.appendChild(b);
  if (m[2]) { const q = document.createElement("span"); q.className = "qual"; q.textContent = m[2]; el.appendChild(q); }
}
function poserScore(el, v) {
  if (!el) return; v = String(v); if (el.textContent === v && !SCORE_TICS.has(el)) return;
  clearInterval(SCORE_TICS.get(el)); SCORE_TICS.delete(el);
  const m = /^(\d+)(.*)$/.exec(v), av = /^(\d+)/.exec(el.textContent || "");
  const reduit = matchMedia("(prefers-reduced-motion:reduce)").matches;
  const fin = () => { ecrireScore(el, v); el.classList.remove("bascule"); void el.offsetWidth; el.classList.add("bascule"); };
  if (!m || reduit) return fin();
  const cible = +m[1], suffixe = m[2] || "", depart = av ? +av[1] : 0, n = Math.abs(cible - depart);
  if (!n) return fin();
  const sens = Math.sign(cible - depart), pas = Math.max(12, Math.round(250 / n)); let k = 0;
  ecrireScore(el, depart + suffixe); el.classList.add("compte");
  const tic = setInterval(() => { k++; if (k >= n) { clearInterval(tic); SCORE_TICS.delete(el); el.classList.remove("compte"); fin(); return; } ecrireScore(el, (depart + sens * k) + suffixe); }, pas);
  SCORE_TICS.set(el, tic);
}
async function tirerSiege(si, hi, viser) {
  const st = T.sieges[si], h = st && st.mains[hi], hote = $(`m_${si}_${hi}`);
  if (!h || !hote) return;
  await tirer(h.cards, hote, false, { siege: si, main: hi }, viser);
  const w = $(`m_${si}_${hi}`);
  if (w && w.parentNode) poserScore(w.parentNode.querySelector(".score"), scoreTexte(h));
}
// La carte cachée est un DOS posé dans la main : on ne la remplace pas, on la
// RETOURNE. C'est cartes.js qui dessine la face et fait tourner le pivot, sur
// l'événement « sabot:croupier-revele » (el = la carte elle-même).
async function revelerCachee() {
  const c = T.croupier.find(x => x.cachee); if (!c) return;
  c.cachee = false; T.rc += valeurCompte(c); T.vues++;
  const e = $("dMain").children[1] || $("dMain").lastElementChild;
  const reduit = matchMedia("(prefers-reduced-motion:reduce)").matches;
  // La main du croupier vient sur la carte (240 ms), la carte pivote sous elle (dès
  // 200 ms, 520 ms de retournement), et le total n'apparaît qu'à mi-retournement,
  // quand la face devient lisible — pas avant que la carte ait bougé.
  emettre("croupier-revele", { carte: c, total: E.handTotal(T.croupier), el: e });
  await pause(reduit ? 30 : 460);
  son("pose");   // une carte qu'on RETOURNE ne sort pas du sabot : elle claque sur le feutre.
  rafraichirBarre(); poserScore($("dScore"), E.handTotal(T.croupier));
  await pause(reduit ? 30 : 440);
}
// Doubler et séparer engagent une seconde mise : il faut l'avoir en main (DB.tapis, lot Jetons).
const peutPayer = (h, st) => !st.toi || typeof DB.tapis !== "number" || DB.tapis >= h.bet;
const peutSeparer = (h, st) => E.canSplit(h, st.mains, reglesTable()) && peutPayer(h, st);
const peutDoubler = (h, st) => E.canDouble(h, st.mains, reglesTable()) && peutPayer(h, st);
const peutAbandonner = (h, st) => E.canSurrender(h, st.mains, reglesTable()) && !h.fromSplit;

function actionBase(cards, up, st, h) {
  const r = reglesTable(), d = donneesTable();
  const total = E.handTotal(cards), soft = E.isSoft(cards);
  const paire = cards.length === 2 && E.cardValue(cards[0]) === E.cardValue(cards[1]) ? rg(cards[0]) : null;
  return SOL.actionFor(d.chart, { total, soft, pairIdx: paire, upIdx: rg(up),
    canD: peutDoubler(h, st), canP: paire !== null && peutSeparer(h, st), canU: peutAbandonner(h, st) });
}
// L'écart au compte : on ne l'applique que si le joueur a demandé l'aide.
function actionAvecEcart(cards, up, st, h, tc) {
  const d = donneesTable(), base = actionBase(cards, up, st, h);
  if (tc === null) return { a: base, ecart: null };
  const total = E.handTotal(cards), soft = E.isSoft(cards);
  const paire = cards.length === 2 && E.cardValue(cards[0]) === E.cardValue(cards[1]) ? rg(cards[0]) : null;
  const fam = paire !== null ? "pair" : soft && total >= 13 && total <= 20 ? "soft" : "hard";
  const cle = paire !== null ? paire : total;
  let trouve = null;
  const ru = rg(up);
  for (const [f, k, u, idx, vers] of d.ecarts) if (f === fam && k === cle && u === ru && tc >= idx) trouve = { a: vers, idx };
  for (const [f, k, u, idx] of d.abandons) if (f === fam && k === cle && u === ru && tc >= idx && peutAbandonner(h, st)) trouve = { a: "U", idx };
  if (!trouve) return { a: base, ecart: null };
  return { a: trouve.a, ecart: trouve.idx, base };
}

async function distribuer() {
  if (T.occupe || T.enJeu) return;
  T.occupe = true; turbo(false); boutons({}); ac();
  const t = tableCourante();
  // Une mélangeuse continue remet les cartes jouées dans le sabot après chaque main :
  // le compte ne s'accumule jamais. C'est la seule façon honnête de la simuler.
  const csm = t.melange === "melangeuse_continue";
  if (csm) {
    // La mélangeuse ne clôt pas une partie : elle reprend les cartes et on continue.
    // Le nombre de mains et le solde ne bougent pas, seul le compte est remis à plat.
    if (T.mains > 0) { annoncer("La mélangeuse reprend les cartes."); await remelanger(); await dodo(400); }
  } else if (T.sabot.length <= T.coupe) {
    annoncer("Carte de coupe atteinte : on remélange.");
    if (T.vues > 20) demanderMonCompte(true);
    await dodo(900); await nouveauSabot({ pendantDonne: true });
    annoncer("Sabot neuf, mélangé, carte brûlée.");
  }
  // Les cartes de la manche précédente ont déjà été ramassées à la FIN du règlement
  // (rangerLaManche). Ces deux lignes sont le FILET : elles ne font rien dans le cas courant,
  // et rattrapent une manche interrompue (rechargement, changement de table, remélange).
  RANGEMENT++;   // un rangement encore en vol ne doit pas balayer la donne qui commence
  await ramasser();
  viderLeFeutre();
  // Chaque siège joue la mise qu'il a posée dans son cercle (st.mise, lot Jetons) ; `|| 1` = sans jetons, une unité.
  for (const st of T.sieges) st.mains = [E.newHand([], st.mise || 1)];
  rendreSieges(); $("dMain").innerHTML = ""; $("dMain").style.removeProperty("--pas"); $("dScore").textContent = "·";
  annoncer(""); $("conseil").textContent = ""; rafraichirBarre();
  T.enJeu = true;
  emettre("donne-debut", { table: t.id, sieges: T.sieges.length });
  const r = reglesTable();
  T.rythme = cadenceDonne(); poserIntervalle(T.rythme);
  // La main du croupier va au sabot (croupier.js, 320 ms) AVANT que la première carte n'en
  // sorte : mesuré le 05/09 en rAF, elle partait 40 ms après le clic, la main encore à
  // 110 px du sabot — la carte voyageait seule, la main courait derrière.
  if (!matchMedia("(prefers-reduced-motion:reduce)").matches && matchMedia("(min-width:1000px)").matches) await pause(260);
  /* LA DONNE SE CADENCE SUR LES ARRIVÉES. `vise` est l'instant où la PROCHAINE carte doit se
     poser ; chaque vol retarde son départ d'autant qu'il faut pour tomber dessus. L'avance
     initiale est le PLAFOND du vol (dureeVol ne dépasse jamais 80 % de l'intervalle) : plus
     court, les cartes lointaines — les plus longues à voler — se feraient rattraper par le
     plancher à zéro du retard, et on aurait remis la moitié de l'irrégularité qu'on retire.
     C'est le seul écart au plan du 06/09, qui proposait une avance de 260 ms : sondé, elle
     laisse tous les retards à 0 et ne cadence donc rien du tout. */
  let vise = performance.now() + Math.max(190, Math.round(T.rythme * .80));
  for (let tour = 0; tour < 2; tour++) {
    for (let si = 0; si < T.sieges.length; si++) { await tirerSiege(si, 0, vise); vise += T.rythme; }
    // Sans carte cachée, le croupier ne prend qu'une carte : c'est toute la règle.
    if (tour === 0) {
      await tirer(T.croupier, $("dMain"), false, CROUPIER, vise); vise += T.rythme; poserScoreCroupier();
      // LE BATTEMENT. Un croupier marque un temps au bout du premier tour — il repart de la
      // gauche. Sans lui, douze cartes font un seul roulement et on ne compte plus rien.
      const battement = Math.round(rythme() * .55);
      await pause(battement); vise += battement;
    }
    else if (r.holeCard) { await tirer(T.croupier, $("dMain"), true, CROUPIER, vise); vise += T.rythme; }
  }
  T.rythme = 0; poserIntervalle(vitesse());
  if (r.holeCard && E.cardValue(T.croupier[0]) === 11 && T.toi) {
    // L'assurance coûte la moitié de la mise : on s'assure d'abord qu'elle est payable
    // (un écouteur peut refuser), puis la réponse devient une vraie mise sur la main.
    const si = T.sieges.indexOf(T.toi), h = T.toi.mains[0];
    const offre = { siege: si, main: 0, toi: true, cout: h.bet / 2, possible: true };
    emettre("assurance-offre", offre);
    if (offre.possible) {
      const prise = await demanderAssurance();
      if (prise) h.assurance = h.bet / 2;
      emettre("assurance", { siege: si, main: 0, toi: true, prise, montant: prise ? h.bet / 2 : 0 });
    }
  }
  if (r.holeCard && r.peek && E.cardValue(T.croupier[0]) >= 10) {
    annoncer("Le croupier vérifie sa carte…"); await pause(vitesse() * 1.1);
    if (E.handTotal(T.croupier) === 21) { await revelerCachee(); annoncer("Blackjack du croupier."); T.occupe = false; return regler(); }
    annoncer("");
  }
  T.occupe = false; await jouerSieges(0);
}
// Le ramassage : chaque carte du feutre glisse vers la défausse, en éventail
// (28 ms d'écart), à l'échelle du tas ; puis le DOM est vidé. En mouvement réduit,
// rien ne vole. Le --pile de la défausse a déjà sa transition.
async function ramasser(cartes) {
  cartes = cartes || [...$("feutre").querySelectorAll(".main .carte")]; if (!cartes.length) return;
  if (matchMedia("(prefers-reduced-motion:reduce)").matches) {
    cartes.forEach(c => c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: "forwards" }));
    await dodo(130); return;
  }
  // Avec une mélangeuse continue, les cartes RENTRENT dans la machine — il n'y a pas de défausse.
  const csm = tableCourante().melange === "melangeuse_continue";
  const d = $(csm ? "sabot" : "defausse").getBoundingClientRect(); if (!d.width) return;
  const vite = T.turbo ? .45 : 1;
  cartes.forEach((c, i) => {
    const r = c.getBoundingClientRect();
    c.animate([{ transform: "none", opacity: 1 }, { opacity: 1, offset: .7 },
      { transform: `translate(${d.left + d.width / 2 - r.left - r.width / 2}px,${d.top + 8 - r.top}px) rotate(-8deg) scale(.6)`, opacity: 0 }],
      { duration: 260 * vite, delay: i * 28 * vite, easing: "cubic-bezier(.3,0,.2,1)", fill: "forwards" });
  });
  await dodo((260 + cartes.length * 28) * vite);
}
/* L'assurance a UNE voix : celle du croupier. Sur ordinateur c'est SA bulle qui pose la question,
   avec Oui/Non dedans, sans minuterie tant qu'on n'a pas répondu (croupier.js écoute
   « sabot:assurance-question » et pose q.prise = true). Mesuré le 05/09 : Vince demandait
   « Assurance ? » en bulle 3,4 s puis se taisait, pendant qu'un panneau signé « Croupier »
   parlait de lui à la troisième personne, posé PAR-DESSUS ta mise et les noms des voisins.
   Sans croupier (téléphone, table à plusieurs), la boîte reste — avec le montant, ce que ça
   paie, et un conseil : la première question qu'on pose à un novice ne peut pas être un pari
   annexe jamais expliqué. */
function demanderAssurance() {
  return new Promise(res => {
    const h = T.toi.mains[0], cout = h.bet / 2;
    const seuil = sys().equilibre ? donneesTable().assurance : null;
    let repondu = false;
    const repondre = prise => {
      if (repondu) return; repondu = true;
      $("boiteAssurance").innerHTML = ""; annoncer("");
      if (sys().equilibre) {
        const tc = CT.compteVrai(T.rc, T.sabot.length / 52);
        const devrait = seuil !== null && tc >= seuil, bon = prise === devrait;
        DB.strat.assurance[bon ? 0 : 1]++; garder(); son(bon ? "ok" : "ko");
        bandeau(`${bon ? "✓" : "✗"} compte vrai ${fr1(tc)} · ${devrait ? "l'assurance est rentable dès " + sgn(seuil) : "pas d'assurance sous " + sgn(seuil)}`, 3400);
      }
      res(prise);
    };
    const conseil = seuil !== null ? `Conseil : non, sauf compte vrai à partir de ${sgn(seuil)}.` : "Conseil : non — le pari perd à la longue.";
    const q = { cout, seuil, conseil, repondre, prise: false };
    emettre("assurance-question", q);
    if (q.prise) return;                     // le croupier a pris la question
    annoncer("Assurance ?");
    const b = document.createElement("div"); b.className = "bulle";
    b.innerHTML = `<div class="de">Croupier</div>
      <div class="q">Le croupier montre un as. Assurance ? <b>${fmtJ(cout)}</b> — un pari à part, la moitié de ta mise, payé 2 contre 1 s'il a un blackjack.</div>
      <div class="aide">${echap(conseil)}</div>
      <div class="opts"><button data-o="1">Oui</button><button data-o="0" class="defaut">Non</button></div>`;
    b.querySelectorAll("button").forEach(bt => bt.onclick = () => repondre(bt.dataset.o === "1"));
    $("boiteAssurance").appendChild(b); son("alerte");
    setTimeout(() => { const n = b.querySelector(".defaut"); if (n && n.isConnected) n.focus(); }, 60);
  });
}
async function jouerSieges(depuis) {
  const r = reglesTable();
  for (let si = depuis; si < T.sieges.length; si++) {
    const st = T.sieges[si];
    for (let hi = 0; hi < st.mains.length; hi++) {
      const h = st.mains[hi];
      if (h.surrendered) continue;
      if (E.isBlackjack(h) && st.mains.length === 1) { h.result = "blackjack"; rendreSieges(); continue; }
      T.actif = { siege: si, main: hi }; marquerActif();
      emettre("tour", { siege: si, main: hi, toi: st.toi });
      if (st.toi) { T.occupe = false; turbo(false); return tonTour(); }
      await jouerAuto(si, hi);
    }
  }
  T.actif = null; marquerActif(); await jouerCroupier();
}
async function jouerAuto(si, hi) {
  const st = T.sieges[si], r = reglesTable();
  let h = st.mains[hi];
  for (;;) {
    if (h.fromSplitAces && !r.hitSplitAces && h.cards.length === 2) break;
    const a = actionBase(h.cards, T.croupier[0], st, h);
    await pause(voisins());
    if (a === "U") { abandonner(si, hi); return; }
    if (a === "S") break;
    if (a === "P") { await separer(si, hi); h = st.mains[hi]; continue; }
    if (a === "D") { h.doubled = true; await tirerSiege(si, hi); break; }
    await tirerSiege(si, hi);
    if (E.handTotal(h.cards) >= 21) break;
  }
  if (E.isBust(h.cards)) sauter(si, hi);
}
async function separer(si, hi) {
  const st = T.sieges[si], h = st.mains[hi];
  const c2 = h.cards.pop(), as = E.isAce(h.cards[0]);
  const nh = E.newHand([c2], h.bet, { fromSplit: true, fromSplitAces: as });
  h.fromSplit = true; h.fromSplitAces = as;
  st.mains.splice(hi + 1, 0, nh); rendreSieges();
  await tirerSiege(si, hi); await tirerSiege(si, hi + 1);
}
function tonTour() {
  const st = T.toi, h = st.mains[T.actif.main], r = reglesTable();
  if (h.surrendered) return mainSuivante();
  if (h.fromSplitAces && !r.hitSplitAces && h.cards.length === 2) return mainSuivante();
  const total = E.handTotal(h.cards);
  if (total >= 21) { if (total > 21) sauter(T.sieges.indexOf(st), T.actif.main); return mainSuivante(); }
  boutons({ tire: true, reste: true, double: peutDoubler(h, st), separe: peutSeparer(h, st), abandon: peutAbandonner(h, st) });
  // « À toi : 14 contre un 10. » — sans cette ligne, rien ne disait au joueur que c'était son
  // tour ni contre quoi il jouait (les critiques, 05/09 : un halo doré et des boutons qui
  // passent du gris au blanc). Sur ordinateur c'est le croupier qui le dit.
  const up = T.croupier[0], vu = E.cardValue(up);
  const upTxt = vu === 11 ? "un as" : vu === 10 ? "un dix" : "un " + vu;
  const soft = E.isSoft(h.cards);
  const mains = st.mains.length > 1 ? ` (main ${T.actif.main + 1} sur ${st.mains.length})` : "";
  annoncer(`À toi${mains} : ${total}${soft ? " souple" : ""} contre ${upTxt}.`);
  if (aideActive()) {
    const tc = sys().equilibre ? CT.compteVrai(T.rc, T.sabot.length / 52) : null;
    const { a, ecart, base } = actionAvecEcart(h.cards, T.croupier[0], st, h, tc);
    // « — écart au compte, à partir de −1 » demandait d'appliquer une règle dont le déclencheur
    // est invisible (le compte est masqué par construction), et ne disait pas si « Rester »
    // était le coup de base ou l'écart. On énonce un FAIT, en NOMMANT les deux coups : ça
    // s'apprend même compte masqué, et ça se vérifie.
    const ecartTxt = ecart !== null && base && base !== a
      ? ` <span class="muet">— écart : la base dit ${MOT[base]}, à partir d'un compte vrai de ${sgn(ecart)} c'est ${MOT[a]}</span>` : "";
    $("conseil").innerHTML = `Stratégie : <b>${MOT[a]}</b>` + ecartTxt
      + ` <button class="lien" id="bMasquerAide" title="Ne plus afficher l'aide à la décision">masquer l'aide</button>`;
    $("bMasquerAide").onclick = () => { DB.conseil = false; garder(); rendreAide(); tonTour(); };
    // Le coup conseillé prend l'or du bouton principal (style.css, .conseille).
    const id = { H: "bTire", S: "bReste", D: "bDouble", P: "bSepare", U: "bAbandon" }[a];
    document.querySelectorAll("#coups .btn").forEach(b => b.classList.toggle("conseille", b.id === id));
  } else { $("conseil").textContent = ""; document.querySelectorAll("#coups .btn.conseille").forEach(b => b.classList.remove("conseille")); }
}
async function mainSuivante() {
  const si = T.sieges.indexOf(T.toi); boutons({}); $("conseil").textContent = "";
  document.querySelectorAll("#coups .btn.conseille").forEach(b => b.classList.remove("conseille"));
  if (T.actif.main + 1 < T.toi.mains.length) { T.actif = { siege: si, main: T.actif.main + 1 }; marquerActif();
    emettre("tour", { siege: si, main: T.actif.main, toi: true }); return tonTour(); }
  T.occupe = true; await jouerSieges(si + 1);
}
const monAction = f => async () => { if (T.occupe || !T.actif) return; await f(); };
$("bTire").onclick = monAction(async () => { T.occupe = true; boutons({}); await tirerSiege(T.sieges.indexOf(T.toi), T.actif.main); T.occupe = false; tonTour(); });
$("bReste").onclick = monAction(async () => { await mainSuivante(); });
$("bDouble").onclick = monAction(async () => {
  const h = T.toi.mains[T.actif.main]; if (!peutDoubler(h, T.toi)) return;
  T.occupe = true; boutons({}); h.doubled = true; await tirerSiege(T.sieges.indexOf(T.toi), T.actif.main);
  if (E.isBust(h.cards)) sauter(T.sieges.indexOf(T.toi), T.actif.main); T.occupe = false; await mainSuivante();
});
$("bSepare").onclick = monAction(async () => {
  const h = T.toi.mains[T.actif.main]; if (!peutSeparer(h, T.toi)) return;
  T.occupe = true; boutons({}); await separer(T.sieges.indexOf(T.toi), T.actif.main); T.occupe = false; tonTour();
});
// « Abandon » rend la main et la moitié de la mise : les dix premières mains, le bouton
// demande confirmation en le DISANT (« Rendre la moitié ? ») — un novice ne sait pas ce
// qu'il coûte (les critiques, 05/09). Un second clic (ou un second A) dans les 3 s abandonne.
let ABANDON_ARME = 0;
$("bAbandon").onclick = monAction(async () => {
  const h = T.toi.mains[T.actif.main]; if (!peutAbandonner(h, T.toi)) return;
  const b = $("bAbandon");
  if ((DB.mainsJouees || 0) < 10 && !ABANDON_ARME) {
    b.innerHTML = "Rendre la moitié ?<kbd>A</kbd>"; b.classList.add("confirme");
    ABANDON_ARME = setTimeout(() => { ABANDON_ARME = 0; b.innerHTML = "Abandonner<kbd>A</kbd>"; b.classList.remove("confirme"); }, 3000);
    return;
  }
  clearTimeout(ABANDON_ARME); ABANDON_ARME = 0; b.innerHTML = "Abandonner<kbd>A</kbd>"; b.classList.remove("confirme");
  abandonner(T.sieges.indexOf(T.toi), T.actif.main); son("alerte"); await mainSuivante();
});
async function jouerCroupier() {
  T.occupe = true; const r = reglesTable();
  emettre("tour", { siege: "croupier", main: 0, toi: false });
  const vivants = T.sieges.some(st => st.mains.some(h => !h.surrendered && !E.isBust(h.cards) && !(E.isBlackjack(h) && st.mains.length === 1)));
  if (r.holeCard) await revelerCachee();
  else { await tirer(T.croupier, $("dMain"), false, CROUPIER); poserScoreCroupier(); }
  await pause(vitesse() * .5);
  if (vivants) {
    for (;;) {
      const t = E.handTotal(T.croupier), soft = E.isSoft(T.croupier);
      if (t > 21 || t > 17 || (t === 17 && !(r.h17 && soft))) break;
      await tirer(T.croupier, $("dMain"), false, CROUPIER); poserScoreCroupier();
    }
  }
  await regler();
}
async function regler() {
  const r = reglesTable(), dt = E.handTotal(T.croupier);
  const dBJ = r.holeCard && T.croupier.length === 2 && dt === 21;
  let miennes = [], net = 0; const issues = [], fins = [], assurances = [];
  T.sieges.forEach((st, si) => { issues[si] = []; st.mains.forEach((h, hi) => {
    // L'assurance se règle avant la main : 2 contre 1 si le croupier avait blackjack.
    if (h.assurance) { const ni = E.settleInsurance(h.bet, dBJ); if (st.toi) net += ni;
      assurances.push({ siege: si, main: hi, toi: st.toi, gagne: dBJ, montant: ni }); }
    const res = r.holeCard ? E.settleHand(h, T.croupier, r) : E.settleNoHoleCard(h, T.croupier, r);
    h.result = res.result; issues[si][hi] = ISSUE_BUS[res.result] || res.result;
    if (st.toi) { miennes.push(res.result); net += res.net; }
    if (!h.emis) fins.push({ siege: si, main: hi, toi: st.toi, issue: issues[si][hi], montant: res.net });
  }); });
  T.solde += net; turbo(false); DB.mainsJouees = (DB.mainsJouees || 0) + 1; noteTable();
  T.actif = null; rendreSieges(); T.mains++; T.enJeu = false; T.occupe = false; rafraichirBarre(); garder();
  // Le pourquoi, en une phrase : « Le croupier saute à 24 : toutes les mains encore debout
  // gagnent. » ou « Croupier 20 contre ton 12 : perdu, −25. » Les pastilles disent le verdict,
  // pas la raison (les critiques, 05/09).
  const tiens = T.toi ? T.toi.mains.filter(h => !h.surrendered).map(h => E.handTotal(h.cards)) : [];
  const netTxt = net ? ` (${net > 0 ? "+" : "−"}${fmtJ(Math.abs(net))})` : "";
  const contre = tiens.length ? ` contre ${tiens.length > 1 ? "tes " + tiens.join(" et ") : "ton " + tiens[0]}` : "";
  annoncer(dt > 21 ? `Le croupier saute à ${dt} : toutes les mains encore debout gagnent. Toi : ${miennes.join(" · ")}${netTxt}.`
    : `Croupier ${dt}${dBJ ? " — blackjack" : ""}${contre} : ${miennes.join(" · ")}${netTxt}.`);
  // Les mains d'abord, une par une, puis la manche : un écouteur peut compter
  // sur cet ordre pour faire glisser les jetons avant de tirer un bilan.
  assurances.forEach(a => emettre("assurance-fin", a));
  fins.forEach(f => emettre("main-fin", f));
  // Le feutre se vide À LA FIN DU RÈGLEMENT, plus au DÉBUT de la donne suivante. Mesuré le
  // 06/09 : le dernier jeton du règlement se posait à t=13618 et les mises de la manche
  // SUIVANTE volaient à t=14484 — pendant que les cartes de la manche finie et les cinq
  // pastilles « PERDU » étaient encore là, sous « Pose ta mise · minimum 10 ». Deux manches
  // sur le tapis en même temps, sans limite de durée.
  // `J.attente` (lot Jetons) est lu ICI, avant que « manche-fin » ne le remette à zéro :
  // c'est l'étalement des paiements, siège après siège.
  const attenteJ = (typeof J === "object" && J && typeof J.attente === "number") ? J.attente : 0;
  const nCartes = $("feutre").querySelectorAll(".main .carte").length;
  const vite = T.turbo ? .45 : 1;
  const doux = matchMedia("(prefers-reduced-motion:reduce)").matches;
  // On attend que le VERDICT ait fini de se lire : le mot s'inscrit à attenteJ + 60 et tient
  // VERDICT_TENUE. Sans siège occupé, il n'y a pas de verdict — seuls les jetons comptent.
  const tenue = T.toi ? attenteJ + 60 + VERDICT_TENUE : Math.max(320, attenteJ + 260);
  const balayage = doux ? 140 : (260 + nCartes * 28) * vite;
  // `rangement` voyage dans l'événement : jetons.js n'ouvre les mises qu'APRÈS le balayage,
  // au lieu de compter de son côté (deux minuteries parallèles = deux manches à l'écran).
  emettre("manche-fin", { issues, toi: T.toi ? issues[T.sieges.indexOf(T.toi)] : [], net, solde: T.solde, croupier: dt,
    rangement: Math.round(tenue + balayage) });
  rangerLaManche(tenue);
  boutons({ donne: true });
}
/* Le rangement : on laisse lire le verdict, on balaie vers la défausse, et LE TAS MONTE au
   moment où les cartes y arrivent — c'est le geste qui compte les cartes, pas le clic sur
   « Distribuer » de la manche d'après. Mesuré le 06/09 en fin de main : sabot à 297 (15 cartes
   sorties) et « 1 carte dans la défausse », pendant toute la phase de mise — le moment précis
   où il faut estimer les jeux restants pour dimensionner sa mise, et où l'application consacre
   un exercice entier (« Estimation ») à lire ce tas. */
let RANGEMENT = 0;
async function rangerLaManche(tenue) {
  const jeton = ++RANGEMENT;
  if (tenue > 0) await dodo(tenue);
  if (jeton !== RANGEMENT || T.enJeu) return;
  await ramasser();
  if (jeton !== RANGEMENT || T.enJeu) return;
  viderLeFeutre();
}
// Les cartes quittent le modèle ET la défausse les reçoit. Appelée par le rangement de fin de
// manche ; `distribuer()` la rappelle en filet — elle ne fait alors plus rien.
function viderLeFeutre() {
  let bouge = false;
  for (const st of T.sieges) for (const h of st.mains) if (!h.defaussee) { T.defausse += h.cards.length; h.defaussee = true; bouge = true; }
  if (T.croupier.length) { T.defausse += T.croupier.length; T.croupier = []; bouge = true; }
  for (const st of T.sieges) if (st.mains.length) { st.mains = []; bouge = true; }
  T.actif = null;
  if (!bouge) return;
  rendreSieges(); $("dMain").innerHTML = ""; $("dMain").style.removeProperty("--pas"); $("dScore").textContent = "·";
  rafraichirBarre(); rendreLettrage();
}
$("bDonne").onclick = distribuer;
/* ── Le verdict de TA main : un mot en serif, au-dessus de tes cartes, qui s'INSCRIT (un balayage
   de gauche à droite, comme une plume) puis s'efface. Branché sur le bus « sabot:main-fin », donc
   valable pour la table à plusieurs aussi. Calé sur le paiement de ce siège (J.attente, lu avant que
   jetons.js ne l'incrémente : table.js est concaténé avant lui), pour que le mot, les jetons et la
   note tombent ensemble ; un bust et un abandon, eux, s'inscrivent à l'instant. */
const VERDICT_TENUE = 1900;   // ms : le temps de lire un mot — et l'horloge du rangement (regler)
const VERDICT_MOT = { bust: "Sauté", perd: "Perdu", gagne: "Gagné", blackjack: "Blackjack", egalite: "Égalité", abandon: "Abandon" };
const VERDICT_TON = { bust: "p", perd: "p", gagne: "g", blackjack: "bj", egalite: "n", abandon: "n" };
let VERDICT_T = null, VERDICT_D = null;
function inscrireVerdict(issue, retard) {
  const v = $("verdict"), f = $("feutre"); if (!v || !f || !VERDICT_MOT[issue]) return;
  clearTimeout(VERDICT_D);
  VERDICT_D = setTimeout(() => {
    if ($("v-table").hidden) return;
    const F = f.getBoundingClientRect(), toi = document.querySelector("#sieges .siege.toi .mains");
    const r = toi && toi.getBoundingClientRect();
    if (r && r.width) { v.style.left = Math.round(r.left + r.width / 2 - F.left) + "px"; v.style.top = Math.round(r.top - F.top - 4) + "px"; }
    else { v.style.left = "50%"; v.style.top = "45%"; }
    clearTimeout(VERDICT_T);
    v.className = "verdict " + VERDICT_TON[issue]; v.textContent = VERDICT_MOT[issue];
    void v.offsetWidth; v.classList.add("on");   // relance l'animation même si le mot est le même
    VERDICT_T = setTimeout(() => { v.classList.remove("on"); }, VERDICT_TENUE);
  }, retard || 0);
}
document.addEventListener("sabot:main-fin", e => {
  const d = e.detail || {}; if (!d.toi) return;
  const attente = (d.issue === "bust" || d.issue === "abandon") ? 0 : ((typeof J === "object" && J && typeof J.attente === "number") ? J.attente : 0) + 60;
  inscrireVerdict(d.issue, attente);
});
$("feutre").addEventListener("click", e => {
  if (e.target.closest("button, .bulle, input, select")) return;
  if (T.enJeu && T.occupe && !$("v-table").dataset.reseau) turbo(true);
});
$("bNouveauSabot").onclick = () => nouveauSabot();
// Les réglages d'installation — cadence, aide — se règlent une fois et n'ont
// rien à faire sur le feutre à côté des coups qu'on joue à chaque main.
$("bReglagesTable").onclick = () => {
  ouvrirModale(`<h2>Réglages de la table</h2>
    <div class="demande" style="flex-direction:column;align-items:stretch;text-align:left">
      <label class="ch"><span class="grave">Cadence du croupier</span>
        <input type="range" id="rgCadence" min="120" max="1400" step="20" value="${DB.cadence}">
        <span class="muet" id="rgCadenceL">${fr1(DB.cadence / 1000)} s par carte · donne initiale à ${fr1(cadenceDonne() / 1000)} s</span></label>
      <label class="ch"><span class="grave">Rythme des voisins</span>
        <input type="range" id="rgVoisins" min="120" max="1500" step="30" value="${voisins()}">
        <span class="muet" id="rgVoisinsL">${fr1(voisins() / 1000)} s de réflexion par décision — un clic sur le feutre pendant qu'ils jouent passe en accéléré</span></label>
      <label class="ch ligne"><input type="checkbox" id="rgConseil"${aideActive() ? " checked" : ""}>
        Afficher la stratégie de base pendant mon tour <span class="muet">(allumée d'office les 20 premières mains)</span></label>
    </div>`);
  $("rgCadence").oninput = () => {
    DB.cadence = +$("rgCadence").value; garder();
    $("rgCadenceL").textContent = fr1(DB.cadence / 1000) + " s par carte · donne initiale à " + fr1(cadenceDonne() / 1000) + " s";
    poserIntervalle(rythme());
  };
  $("rgVoisins").oninput = () => {
    DB.voisins = +$("rgVoisins").value; garder();
    $("rgVoisinsL").textContent = fr1(voisins() / 1000) + " s de réflexion par décision — un clic sur le feutre pendant qu'ils jouent passe en accéléré";
  };
  $("rgConseil").onchange = () => {
    DB.conseil = $("rgConseil").checked; garder(); rendreAide();
    if (T.actif && !T.occupe && T.toi === T.sieges[T.actif.siege]) tonTour();
  };
};
// L'aide à la décision a son bouton à côté de « Montrer le compte » : la seule chose dont
// un débutant a besoin ne vit plus au fond du menu « Plus » (les critiques, 05/09).
if ($("bAide")) {
  rendreAide();
  $("bAide").onclick = () => {
    DB.conseil = !aideActive(); garder(); rendreAide();
    if (T.actif && !T.occupe && T.toi === T.sieges[T.actif.siege]) tonTour();
  };
}
$("bMonCompte").onclick = () => demanderMonCompte(false);
// Le menu « Plus » de la barre des coups (sous 1400 px, style.css) : les utilitaires qu'on
// n'ouvre pas à chaque main. Un clic dedans le referme ; Échap et un clic dehors aussi.
{
  const plus = $("plusTable"), b = $("bPlus");
  const poser = on => { plus.classList.toggle("ouvert", on); b.setAttribute("aria-expanded", on ? "true" : "false"); };
  b.onclick = e => { e.stopPropagation(); poser(!plus.classList.contains("ouvert")); };
  $("plusMenu").addEventListener("click", e => { if (e.target.closest("button")) poser(false); });
  document.addEventListener("click", e => { if (plus.classList.contains("ouvert") && !e.target.closest("#plusTable")) poser(false); });
  addEventListener("keydown", e => { if (e.key === "Escape" && plus.classList.contains("ouvert")) { poser(false); b.focus(); } });
}
// Le compte est figé à l'ouverture : le sabot peut être remélangé pendant
// que la question est à l'écran, la réponse doit rester celle qu'on a posée.
function demanderMonCompte(finSabot) {
  const rc = T.rc, vues = T.vues, restantes = T.sabot.length;
  const jeuxRestants = restantes / 52, tc = CT.compteVrai(rc, jeuxRestants);
  // À la fin du sabot on lève le sceau : la graine prouve que l'ordre des cartes
  // était fixé avant la première donne. C'est le seul instant où la montrer sert.
  const sceau = finSabot ? `<div class="recu" style="margin-top:14px;text-align:left">
      <div class="sceau revele"><span class="rond"></span>Sceau levé — ce sabot était fixé d'avance</div>
      <dt>Empreinte publiée avant la donne</dt><dd>${T.empreinte}</dd>
      <dt>Graine</dt><dd>${SH.hex(T.graine)}</dd></div>` : "";
  // 🚨 PAS DE NOMBRE DANS LE PLACEHOLDER DE « Jeux restants ». Il portait « 4,5 » : ce
  // n'était pas un exemple, c'était 312 × 0,75 / 52 — la réponse EXACTE à la carte de coupe
  // sous l'ANCIEN sens de `penetration`. Depuis le 06/09 le sabot part au remélange vers
  // 78 cartes, soit 1,5 jeu : la suggestion était fausse d'un facteur trois. Et aucun autre
  // nombre ne peut la remplacer, car la bonne valeur dépend de la table (≈1,5 au Boulevard,
  // ≈0,9 au Salon privé, ≈0,5 au Néon qui n'a qu'un jeu). Souffler une réponse dans la case
  // même qui NOTE l'estimation retire à l'exercice tout ce qu'il apporte : on écrit « ? »,
  // et le format se lit dans step="0.5".
  ouvrirModale(`<h2>${finSabot ? "Carte de coupe — ton compte ?" : "Ton compte"}</h2>
    ${finSabot ? '<p class="muet">Le sabot est fini. Dis ton compte avant que tout reparte à zéro.</p>' : ""}
    <div class="demande" style="flex-direction:column;align-items:center">
      <label class="ch" style="align-items:center"><span class="grave">Compte courant</span><input type="number" id="mcRC" placeholder="0"></label>
      <label class="ch" style="align-items:center"><span class="grave">Jeux restants, au jugé</span><input type="number" id="mcJeux" step="0.5" placeholder="?"></label>
      <button class="btn" id="mcOk">Vérifier</button>
    </div><p id="mcRes" class="muet" style="margin-top:12px"></p>` + sceau);
  const verifier = () => {
    const g = $("mcRC").value.trim(); if (g === "") return;
    const dit = parseInt(g, 10), bon = dit === rc; son(bon ? "ok" : "ko");
    const dj = parseFloat(($("mcJeux").value || "").replace(",", "."));
    let txt = bon ? "Exact. " : `Tu as dit ${sgn(dit)}, c'était ${sgn(rc)}. `;
    txt += `${vues} cartes vues, ${restantes} restantes, soit ${fr1(jeuxRestants)} jeux.`;
    if (!isNaN(dj)) txt += ` Tu as estimé ${fr1(dj)}${Math.abs(dj - jeuxRestants) <= .5 ? " ✓" : " ✗"}.`;
    if (sys().equilibre) txt += ` Compte vrai ${fr1(tc)} · la rampe dit ${CT.miseRampe(tc)} unité${CT.miseRampe(tc) > 1 ? "s" : ""}.`;
    // Le vrai enseignement : la mise posée AVANT la donne, comparée au compte qu'on avait alors
    // (T.tcMise et T.miseDonne sont figés par jetons.js à la fermeture des mises).
    if (sys().equilibre && typeof T.tcMise === "number" && T.miseDonne > 0) {
      const u = T.miseDonne / tableCourante().mise_min, ref = CT.miseRampe(T.tcMise);
      txt += ` À la donne, tu as misé ${fr1(u)} unité${u > 1 ? "s" : ""} pour un compte vrai de ${fr1(T.tcMise)} : ${Math.abs(u - ref) <= 1 ? "cohérent" : "incohérent — la rampe disait " + ref}.`;
    }
    $("mcRes").textContent = txt;
    // Une fois qu'on a compté une fois, l'invite de la note de table n'a plus rien à apprendre.
    DB.aAnnonce = true; noteTable();
    DB.sessions.push({ t: Date.now(), genre: "table", sys: sys().nom, n: vues, exact: bon, ecart: Math.abs(dit - rc) });
    while (DB.sessions.length > 240) DB.sessions.shift(); garder();
    if (vue === "progres") rendreProgres();
  };
  $("mcOk").onclick = verifier;
  $("mcRC").addEventListener("keydown", e => { if (e.key === "Enter") verifier(); });
  setTimeout(() => $("mcRC").focus(), 40);
}
/* ── Le reçu du sabot : l'empreinte avant, la graine après ───────────────
   Il vivait dans un <details> sous la table. Le poste n'a plus de « sous » :
   il devient une fiche qu'on ouvre, ce qui est de toute façon son usage —
   on la lit une fois, quand on veut vérifier. */
function recuHtml() {
  const t = tableCourante(), scelle = !T.revele;
  return `<dl class="recu">
    <div class="sceau ${scelle ? "" : "revele"}"><span class="rond"></span>${scelle
      ? "Scellé — l'ordre des cartes est fixé et personne ne le connaît"
      : "Révélé — n'importe qui peut refaire ce mélange"}</div>
    <dt>Table</dt><dd>${echap(t.nom)} · ${t.jeux} jeux · ${T.sabot.length} cartes restantes</dd>
    <dt>Empreinte de la graine, publiée avant la donne</dt><dd>${T.empreinte || "—"}</dd>
    <dt>Graine</dt><dd>${T.revele ? SH.hex(T.graine) : "révélée à la fin du sabot"}</dd></dl>`;
}
// Le reçu peut être ouvert pendant qu'un sabot se termine : on le rafraîchit
// s'il est à l'écran, on ne le fabrique pas s'il n'y est pas.
function rendreRecu() { const e = $("recu"); if (e) e.outerHTML = recuHtml(); }

function verificateurTexte() {
  return `// Colle ceci dans la console d'un navigateur pour refaire le mélange toi-même.
const graine = "${T.revele ? SH.hex(T.graine) : "…révèle d'abord la graine…"}";
const unhex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
(async () => {
  const s = unhex(graine);
  console.log("empreinte :", hex(await crypto.subtle.digest("SHA-256", s)));
  const k = await crypto.subtle.importKey("raw", s, {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  let ctr = 0, buf = new Uint8Array(0), pos = 0;
  const next4 = async () => { if (pos + 4 > buf.length) { const c = new Uint8Array(8);
      new DataView(c.buffer).setBigUint64(0, BigInt(ctr++));
      buf = new Uint8Array(await crypto.subtle.sign("HMAC", k, c)); pos = 0; }
    const v = new DataView(buf.buffer, buf.byteOffset + pos, 4).getUint32(0); pos += 4; return v; };
  const below = async n => { const max = Math.floor(0x100000000 / n) * n; let v;
    do { v = await next4(); } while (v >= max); return v % n; };
  const R = ["A","2","3","4","5","6","7","8","9","10","V","D","R"], S = ["♠","♥","♦","♣"];
  const a = []; for (let d = 0; d < ${tableCourante().jeux}; d++) for (const su of S) for (const r of R) a.push(r + su);
  for (let i = a.length - 1; i > 0; i--) { const j = await below(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  console.log("ordre de distribution :", a.slice().reverse().join(" "));
})();`;
}

$("bRecu").onclick = () => {
  ouvrirModale(`<h2>Le reçu du sabot</h2>
    <p class="muet" style="font-size:var(--t-petit);text-align:left">Avant de distribuer, l'application publie l'empreinte d'une graine. À la fin du sabot, elle révèle la graine. N'importe qui peut alors recalculer l'ordre exact des cartes et vérifier qu'il n'a pas été choisi après coup.</p>
    ${recuHtml()}
    <div class="rang-btn" style="margin-top:10px;justify-content:center">
      <button class="btn creux mini" id="bVerifier">Vérifier ce sabot</button>
      <button class="btn creux mini" id="bCopierVerif">Copier le vérificateur</button>
    </div>
    <p class="muet" id="verifResultat" style="font-size:var(--t-petit);margin-top:8px"></p>`);
  $("bVerifier").onclick = async () => {
    if (!T.revele) { T.revele = true; rendreRecu(); }
    const recalc = await SH.shuffle(sabotNeuf(tableCourante().jeux), T.graine);
    const meme = (await SH.commit(T.graine)) === T.empreinte;
    $("verifResultat").innerHTML = meme
      ? `✓ L'empreinte publiée correspond bien à cette graine, et le mélange se rejoue à l'identique. Première carte du sabot : <b>${recalc[recalc.length - 1].r}${recalc[recalc.length - 1].suit}</b>.`
      : `✗ L'empreinte ne correspond pas. Quelque chose ne va pas.`;
    son(meme ? "ok" : "ko");
  };
  $("bCopierVerif").onclick = () => {
    const code = verificateurTexte();
    navigator.clipboard && navigator.clipboard.writeText(code).then(
      () => bandeau("Vérificateur copié : colle-le dans la console d'un navigateur."),
      () => ouvrirModale(`<h2>Vérificateur</h2><div class="recu" style="text-align:left;white-space:pre-wrap;max-height:50svh;overflow:auto">${echap(code)}</div>`));
  };
};
