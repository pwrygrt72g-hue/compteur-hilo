/* ══════════════════════ LA TABLE ══════════════════════ */
const T = { sabot: [], graine: null, empreinte: "", coupe: 0, rc: 0, vues: 0, mains: 0, defausse: 0,
  croupier: [], sieges: [], occupe: false, enJeu: false, toi: null, actif: null, revele: false, solde: 0 };
const NOMS = ["Marc", "Sonia", "Karim", "Léa", "Paul", "Nadia"];
const vitesse = () => DB.cadence;
// La donne INITIALE va plus vite que les tirages : douze cartes à 900 ms font
// onze secondes d'attente avant de pouvoir jouer (mesuré le 04/09), et à 400 ms
// avec un vol de 180 ms les cartes « tombaient » (Léo). Mesuré à nouveau le 05/09
// à la cadence par défaut : 5,4 s avant de voir sa main, et à 18 s le voisin
// réfléchissait encore. Un vrai croupier distribue douze cartes en quatre
// secondes. Ici 40 % de la cadence, entre 220 et 380 ms, et le vol remplit
// l'intervalle (--don suit --intervalle). Les tirages, où l'on compte carte par
// carte, gardent la cadence pleine. T.rythme > 0 = on est dans la donne initiale.
const cadenceDonne = () => Math.max(220, Math.min(380, Math.round(vitesse() * .4)));
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
  T.coupe = t.melange === "melangeuse_continue" ? Math.floor(T.sabot.length * .02) : Math.floor(T.sabot.length * (t.penetration || .75));
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
  $("v-table").dataset.lieu = t.id; $("v-table").dataset.sieges = Math.max(1, Math.min(t.sieges, 6));
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
  // La salle a le décor de son lieu : la photo embarquée (window.PHOTOS, cf. build.mjs),
  // floutée et assombrie par la feuille de style. Sans photo, la salle reste celle de
  // la lueur et du sol posés par [data-lieu] — rien ne casse.
  const ph = (window.PHOTOS || {})[t.id];
  $("salle").style.setProperty("--photo", ph ? `url("${ph}")` : "none");
  rendreMotif(t.id); LETTRAGE.cle = ""; rendreLettrage();
  emettre("table", { table: t });
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
  if (W < 320 || H < 160) { if (LETTRAGE.cle !== "vide") { svg.innerHTML = ""; LETTRAGE.cle = "vide"; } return; }
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
  const petit = Math.max(11, Math.round(W * .013)), grand = Math.max(14, Math.round(W * .021));
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
  // La bande où vivent l'annonce et le conseil (style.css) : celle du grand arc, sous la
  // main du croupier — jamais une hauteur codée en dur qui tomberait sur les cartes.
  f.style.setProperty("--bande-haut", Math.round(basCentre + 2) + "px");
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
  const t = tableCourante(), n = Math.max(1, Math.min(t.sieges, 6));
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
      if (!h.ramassee) h.cards.forEach(c => md.appendChild(carteEl(c)));
      const sc = document.createElement("div"); sc.className = "score";
      sc.textContent = scoreTexte(h);
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
    : `${T.sabot.length} cartes restent dans le sabot · la carte de coupe est plantée à ${T.coupe} cartes de la fin`;
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
function dureeVol(d) {
  const cs = getComputedStyle($("plateau"));
  const don = parseFloat(cs.getPropertyValue("--don")) || 300, slot = parseFloat(cs.getPropertyValue("--intervalle")) || 450;
  return Math.round(Math.max(120, Math.min(slot * .9, don * (.65 + .6 * Math.min(1.2, d / 600)))));
}
const DELAI_VOL = 40;   // ms : la main du croupier part en même temps que la carte (croupier.js)
function animerDepuisSabot(e, cr) {
  const s = $("sabot").getBoundingClientRect();
  // Le CENTRE de la carte part du centre du sabot : à l'échelle .74, elle tient tout
  // entière dans sa boîte et en SORT. Mesuré le 05/09 avec le haut de la carte à
  // sabot.top + 6 : centrée 20 px sous le milieu du sabot, elle dépassait de 18 px
  // sous lui — une carte entière posée sur le feutre avant de partir.
  let dx = s.left + s.width / 2 - (cr.left + cr.width / 2), dy = s.top + s.height * .5 - (cr.top + cr.height / 2);
  const siege = e.closest(".siege");
  if (siege && window.DOMMatrixReadOnly) {
    try {
      const inv = new DOMMatrixReadOnly(getComputedStyle(siege).transform).inverse();
      const v = inv.transformPoint(new DOMPoint(dx, dy, 0, 0)); dx = v.x; dy = v.y;
    } catch (err) {}
  }
  e.style.setProperty("--dx", dx + "px"); e.style.setProperty("--dy", dy + "px");
  const duree = dureeVol(Math.hypot(dx, dy));
  e.style.animationDuration = duree + "ms"; e.style.animationDelay = DELAI_VOL + "ms";
  e.addEventListener("animationend", () => { e.classList.remove("carte--entre"); e.style.animationDuration = ""; e.style.animationDelay = ""; }, { once: true });
  e.classList.add("carte--entre");
  return { duree, delai: DELAI_VOL };
}
async function tirer(main, hote, cachee, qui) {
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
  const vol = animerDepuisSabot(e, cr);
  if (!matchMedia("(prefers-reduced-motion:reduce)").matches) {
    // Mesuré le 05/09 : la 1re carte glissait 150 ms AVANT que la 2e n'atterrisse. Elle
    // attend les trois quarts du vol RÉEL de la carte : elle bouge quand on la touche.
    [...hote.children].slice(0, -1).forEach((x, i) => {
      const dx = avant[i] - x.getBoundingClientRect().left;
      if (Math.abs(dx) > .5) x.animate([{ transform: `translateX(${dx}px)` }, { transform: "none" }],
        { duration: 200, delay: Math.round(vol.delai + vol.duree * .72), easing: "cubic-bezier(.3,0,.2,1)", fill: "backwards" });
    });
  }
  // La main du croupier part AVEC la carte (même retard, croupier.js lit `duree` et
  // `delai`) : le geste pousse la carte pendant la première moitié du vol.
  emettre("carte", { siege: qui ? qui.siege : "croupier", main: qui ? qui.main : 0, index: main.length - 1,
    carte: c, cachee: !!cachee, el: e, duree: vol.duree, delai: vol.delai,
    depuis: { x: sr.left + sr.width / 2, y: sr.top + sr.height / 2 },
    vers: { x: cr.left + cr.width / 2, y: cr.top + cr.height / 2 } });
  son("carte");
  if (!cachee) { T.rc += valeurCompte(c); T.vues++; }
  rafraichirBarre(); await pause(rythme()); return c;
}
// Un score qui change ne surgit pas : il COMPTE — un tic par point, 250 ms en tout, du total
// d'avant (ou de zéro, pour une première carte) jusqu'au nouveau. En mouvement réduit, ou quand
// la valeur n'est pas un nombre, il s'écrit d'un coup. Les tics sont des minuteurs, pas des rAF :
// sous temps virtuel (la sonde) seule la première image est livrée, et un score resterait à
// mi-chemin ; le dernier minuteur écrit toujours la valeur exacte.
const SCORE_TICS = new WeakMap();
function poserScore(el, v) {
  if (!el) return; v = String(v); if (el.textContent === v && !SCORE_TICS.has(el)) return;
  clearInterval(SCORE_TICS.get(el)); SCORE_TICS.delete(el);
  const m = /^(\d+)(.*)$/.exec(v), av = /^(\d+)/.exec(el.textContent || "");
  const reduit = matchMedia("(prefers-reduced-motion:reduce)").matches;
  const fin = () => { el.textContent = v; el.classList.remove("bascule"); void el.offsetWidth; el.classList.add("bascule"); };
  if (!m || reduit) return fin();
  const cible = +m[1], suffixe = m[2] || "", depart = av ? +av[1] : 0, n = Math.abs(cible - depart);
  if (!n) return fin();
  const sens = Math.sign(cible - depart), pas = Math.max(12, Math.round(250 / n)); let k = 0;
  el.textContent = depart + suffixe; el.classList.add("compte");
  const tic = setInterval(() => { k++; if (k >= n) { clearInterval(tic); SCORE_TICS.delete(el); el.classList.remove("compte"); fin(); return; } el.textContent = (depart + sens * k) + suffixe; }, pas);
  SCORE_TICS.set(el, tic);
}
async function tirerSiege(si, hi) {
  const st = T.sieges[si], h = st && st.mains[hi], hote = $(`m_${si}_${hi}`);
  if (!h || !hote) return;
  await tirer(h.cards, hote, false, { siege: si, main: hi });
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
  son("carte");
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
  return { a: trouve.a, ecart: trouve.idx };
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
  // Les cartes de la manche précédente sont RAMASSÉES vers la défausse, pas
  // effacées : un balayage en éventail, une carte après l'autre, puis le tas grimpe.
  await ramasser();
  for (const st of T.sieges) for (const h of st.mains) if (!h.defaussee) T.defausse += h.cards.length;
  T.defausse += T.croupier.length; T.croupier = []; T.actif = null;
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
  for (let tour = 0; tour < 2; tour++) {
    for (let si = 0; si < T.sieges.length; si++) await tirerSiege(si, 0);
    // Sans carte cachée, le croupier ne prend qu'une carte : c'est toute la règle.
    if (tour === 0) { await tirer(T.croupier, $("dMain"), false, CROUPIER); poserScoreCroupier(); }
    else if (r.holeCard) await tirer(T.croupier, $("dMain"), true, CROUPIER);
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
    const { a, ecart } = actionAvecEcart(h.cards, T.croupier[0], st, h, tc);
    $("conseil").innerHTML = `Stratégie : <b>${MOT[a]}</b>` + (ecart !== null ? ` <span class="muet">— écart au compte, à partir de ${sgn(ecart)}</span>` : "")
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
    ABANDON_ARME = setTimeout(() => { ABANDON_ARME = 0; b.innerHTML = "Abandon<kbd>A</kbd>"; b.classList.remove("confirme"); }, 3000);
    return;
  }
  clearTimeout(ABANDON_ARME); ABANDON_ARME = 0; b.innerHTML = "Abandon<kbd>A</kbd>"; b.classList.remove("confirme");
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
  T.solde += net; turbo(false); DB.mainsJouees = (DB.mainsJouees || 0) + 1;
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
  emettre("manche-fin", { issues, toi: T.toi ? issues[T.sieges.indexOf(T.toi)] : [], net, solde: T.solde, croupier: dt });
  boutons({ donne: true });
}
$("bDonne").onclick = distribuer;
/* ── Le verdict de TA main : un mot en serif, au-dessus de tes cartes, qui s'INSCRIT (un balayage
   de gauche à droite, comme une plume) puis s'efface. Branché sur le bus « sabot:main-fin », donc
   valable pour la table à plusieurs aussi. Calé sur le paiement de ce siège (J.attente, lu avant que
   jetons.js ne l'incrémente : table.js est concaténé avant lui), pour que le mot, les jetons et la
   note tombent ensemble ; un bust et un abandon, eux, s'inscrivent à l'instant. */
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
    VERDICT_T = setTimeout(() => { v.classList.remove("on"); }, 2300);
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
  ouvrirModale(`<h2>${finSabot ? "Carte de coupe — ton compte ?" : "Ton compte"}</h2>
    ${finSabot ? '<p class="muet">Le sabot est fini. Dis ton compte avant que tout reparte à zéro.</p>' : ""}
    <div class="demande" style="flex-direction:column;align-items:center">
      <label class="ch" style="align-items:center"><span class="grave">Compte courant</span><input type="number" id="mcRC" placeholder="0"></label>
      <label class="ch" style="align-items:center"><span class="grave">Jeux restants, au jugé</span><input type="number" id="mcJeux" step="0.5" placeholder="4,5"></label>
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
