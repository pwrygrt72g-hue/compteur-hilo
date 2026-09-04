/* ══════════════════════ LA TABLE ══════════════════════ */
const T = { sabot: [], graine: null, empreinte: "", coupe: 0, rc: 0, vues: 0, mains: 0, defausse: 0,
  croupier: [], sieges: [], occupe: false, enJeu: false, toi: null, actif: null, revele: false, solde: 0 };
const NOMS = ["Marc", "Sonia", "Karim", "Léa", "Paul", "Nadia"];
const vitesse = () => DB.cadence;
const reglesTable = () => {
  const t = tableCourante();
  return E.makeRules({ decks: t.jeux, h17: t.h17, blackjackPays: t.blackjackPays, das: t.das,
    surrender: t.surrender, doubleOn: t.doubleOn, maxHands: t.maxHands, hitSplitAces: t.hitSplitAces,
    holeCard: t.holeCard, peek: t.peek, enhcLosesAll: !!t.enhcLosesAll, penetration: t.penetration || .75 });
};
const ISSUE = { "gagné": "g", "perdu": "p", "égalité": "n", "sauté": "p", "blackjack": "bj", "abandon": "n" };
const MOT = { H: "Tirer", S: "Rester", D: "Doubler", P: "Séparer", U: "Abandonner" };
const CROUPIER = { siege: "croupier", main: 0 };
// Les issues, dans le vocabulaire du bus (sans accents : ce sont des clés).
const ISSUE_BUS = { "gagné": "gagne", "perdu": "perd", "sauté": "bust", "blackjack": "blackjack", "égalité": "egalite", "abandon": "abandon" };
// Un bust et un abandon se savent À L'INSTANT : le croupier doit réagir tout de
// suite, pas au règlement. `emis` évite de les annoncer deux fois.
function sauter(si, hi) {
  const h = T.sieges[si].mains[hi]; h.result = "sauté"; h.emis = true; rendreSieges();
  emettre("main-fin", { siege: si, main: hi, toi: T.sieges[si].toi, issue: "bust", montant: -(h.bet || 1) * (h.doubled ? 2 : 1) });
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
  if (!o.pendantDonne) { $("annonce").textContent = "Sabot neuf, mélangé, carte brûlée."; boutons({ donne: true }); }
  $("plateau").style.setProperty("--intervalle", vitesse() + "ms");
  emettre("remelange", { table: t.id, cartes: T.sabot.length, pendantDonne: !!o.pendantDonne });
}
/* ── Le lieu ─────────────────────────────────────────────────────────────
   L'identifiant de la table EST l'identifiant du décor : [data-lieu] sur la
   vue, et la feuille de style fait le reste. La barre ne garde que trois
   puces — le nombre de jeux, H17/S17, 3:2 ou 6:5 — plus la mélangeuse quand
   il y en a une, parce que celle-là tue le comptage. */
function poserLieu(t) {
  $("v-table").dataset.lieu = t.id;
  $("tNom").textContent = t.nom + " · " + t.lieu;
  const tmp = document.createElement("div"); tmp.innerHTML = chipsRegles(t);
  const puces = [...tmp.children], garde = puces.slice(0, 3);
  const csm = puces.find(p => /mélangeuse/.test(p.textContent));
  if (csm && !garde.includes(csm)) garde.push(csm);
  $("tRegles").replaceChildren(...garde);
  rendreMotif(t.id); LETTRAGE.cle = ""; rendreLettrage();
  emettre("table", { table: t });
}
/* Le lettrage doré en arc est DÉRIVÉ des règles : « 3 TO 2 » ou « 6 TO 5 »,
   « HIT SOFT 17 » ou « STAND ON ALL 17s », et l'assurance seulement là où le
   croupier a une carte cachée. Les arcs suivent le rail réel : ils sont
   recalculés sur la taille mesurée du feutre, jamais dessinés en dur. */
const LETTRAGE = { cle: "" };
function texteLettrage(t) {
  return {
    paie: t.blackjackPays === 1.5 ? "BLACKJACK PAYS 3 TO 2" : "BLACKJACK PAYS 6 TO 5",
    croupier: t.h17 ? "DEALER MUST HIT SOFT 17" : "DEALER MUST STAND ON ALL 17s",
    assurance: t.holeCard ? "INSURANCE PAYS 2 TO 1" : "NO HOLE CARD",
  };
}
function rendreLettrage() {
  const f = $("feutre"), svg = $("lettrage"); if (!f || !svg) return;
  const W = f.clientWidth, H = f.clientHeight;
  if (W < 320 || H < 160) { if (LETTRAGE.cle !== "vide") { svg.innerHTML = ""; LETTRAGE.cle = "vide"; } return; }
  const fr = f.getBoundingClientRect();
  const rangee = f.querySelector(".rangee-haute"), annonce = $("annonce");
  const basHaut = Math.round(rangee.getBoundingClientRect().bottom - fr.top);
  const basAnnonce = Math.round(annonce.getBoundingClientRect().bottom - fr.top);
  let hautSieges = H;
  f.querySelectorAll(".siege").forEach(sg => { hautSieges = Math.min(hautSieges, sg.getBoundingClientRect().top - fr.top); });
  hautSieges = Math.round(hautSieges);
  const t = tableCourante(), tx = texteLettrage(t);
  const cle = [W, H, basHaut, basAnnonce, hautSieges, t.id].join("|");
  if (cle === LETTRAGE.cle) return; LETTRAGE.cle = cle;
  // Le rail est une demi-lune : on l'approche par une ellipse centrée sous le
  // feutre (rx = W/2, ry = 72 % de H), et chaque ligne est un arc concentrique
  // rentré de d pixels. Les angles sont en degrés, −90 = l'apex du rail.
  const cx = W / 2, cy = .72 * H;
  const arc = (d, a1, a2) => {
    const rx = W / 2 - d, ry = .72 * H - d, p = a => { const r = a * Math.PI / 180; return [cx + rx * Math.cos(r), cy + ry * Math.sin(r)]; };
    const [x1, y1] = p(a1), [x2, y2] = p(a2);
    return `M${x1.toFixed(1)} ${y1.toFixed(1)}A${rx.toFixed(1)} ${ry.toFixed(1)} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  };
  const petit = Math.max(9, Math.round(W * .0115)), grand = Math.max(14, Math.round(W * .021));
  let out = "", n = 0;
  const ligne = (texte, d, a1, a2, taille) => {
    n++; out += `<defs><path id="lt${n}" d="${arc(d, a1, a2)}"/></defs>
      <text font-size="${taille}"><textPath href="#lt${n}" startOffset="50%" text-anchor="middle">${echap(texte)}</textPath></text>`;
  };
  // Le long du rail, de part et d'autre du rack : la règle du croupier à gauche,
  // l'assurance à droite. L'apex reste libre pour le rack de jetons.
  ligne(tx.croupier, 6 + petit, -176, -122, petit);
  ligne(tx.assurance, 6 + petit, -58, -4, petit);
  // Le paiement du blackjack, en grand, entre l'annonce et les sièges — si la
  // place y est ; un écran bas garde le rail et perd le grand lettrage.
  const place = hautSieges - basAnnonce;
  // Centré dans la bande libre (au plus 40 px sous l'annonce) : collé à elle,
  // « Assurance ? » se lisait par-dessus le lettrage.
  if (place >= grand + 14) ligne(tx.paie, basAnnonce + grand + 4 + Math.min(40, (place - grand - 14) / 2), -140, -40, grand);
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.innerHTML = out;
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
      h.cards.forEach(c => md.appendChild(carteEl(c)));
      const sc = document.createElement("div"); sc.className = "score";
      sc.textContent = h.cards.length ? E.handTotal(h.cards) + (h.doubled ? " ×2" : "") : "";
      const rs = document.createElement("div"); rs.className = "issue " + (ISSUE[h.result] || "");
      rs.textContent = h.result || "";
      w.append(md, sc, rs); hs.appendChild(w);
    });
    // Le cercle de mise, doré, devant chaque siège : vide pour l'instant, le lot
    // Jetons y posera les piles (#cercle_<siège>). --ecart soulève les sièges du bord.
    const ce = document.createElement("div"); ce.className = "cercle"; ce.id = "cercle_" + si; ce.dataset.siege = si;
    const nm = document.createElement("div"); nm.className = "nom serre"; nm.textContent = st.nom;
    d.style.setProperty("--ecart", Math.abs(si - (T.sieges.length - 1) / 2).toFixed(1));
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
function rafraichirBarre() {
  const t = tableCourante(), total = t.jeux * 52;
  // Le sabot montre ses cartes et sa carte de coupe ; la défausse, son tas.
  const sb = $("sabot"); sb.textContent = T.sabot.length;
  sb.style.setProperty("--reste", (T.sabot.length / total).toFixed(3));
  sb.style.setProperty("--coupe", (T.coupe / total).toFixed(3));
  $("defausseN").textContent = T.defausse; $("defausse").classList.toggle("pleine", T.defausse > 0);
  $("defausse").style.setProperty("--pile", Math.min(1, T.defausse / total).toFixed(3));
  const jeuxRestants = T.sabot.length / 52;
  const visible = !!T.montre;
  $("tRC").textContent = visible ? sgn(T.rc) : "—";
  $("tJeux").textContent = visible ? fr1(jeuxRestants) : "—";
  const tc = sys().equilibre ? CT.compteVrai(T.rc, jeuxRestants) : null;
  $("tTC").textContent = visible ? (tc === null ? "n/a" : fr1(tc)) : "—";
  // La mise conseillée est la rampe de référence 2(TC−1), en UNITÉS de mise minimum
  // (misesUnites ne bat pas sa table — cf. counting.mjs). Le tapis, lui, est rendu par jetons.js.
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
function animerDepuisSabot(e, hote) {
  const s = $("sabot").getBoundingClientRect(), c = hote.getBoundingClientRect();
  e.style.setProperty("--dx", (s.left + s.width / 2 - (c.left + c.width / 2)) + "px");
  e.style.setProperty("--dy", (s.top - c.top) + "px");
  e.classList.add("carte--entre");
}
async function tirer(main, hote, cachee, qui) {
  // Filet de sécurité : plutôt remélanger que distribuer une carte inexistante.
  if (!T.sabot.length) { const t = tableCourante(); const s = await sabotProuvable(t.jeux);
    T.sabot = s.cartes; T.graine = s.graine; T.empreinte = s.empreinte; T.revele = false;
    T.rc = CT.compteInitial(DB.sys, t.jeux); T.vues = 0; T.sabot.pop(); rendreRecu();
    emettre("remelange", { table: t.id, cartes: T.sabot.length, pendantDonne: true });
  }
  const c = T.sabot.pop(); c.cachee = !!cachee; main.push(c);
  const e = carteEl(c, cachee); hote.appendChild(e);
  // Une carte de plus dans un siège : l'éventail se resserre pour qu'elle tienne.
  if (qui) dimensionnerCartes();
  // Mesurée AVANT l'animation : pendant le vol, le rect de la carte est celui
  // du sabot, pas celui de son point d'arrivée.
  const cr = e.getBoundingClientRect(), sr = $("sabot").getBoundingClientRect();
  animerDepuisSabot(e, hote); son("carte");
  emettre("carte", { siege: qui ? qui.siege : "croupier", main: qui ? qui.main : 0, index: main.length - 1,
    carte: c, cachee: !!cachee, el: e,
    depuis: { x: sr.left + sr.width / 2, y: sr.top + sr.height / 2 },
    vers: { x: cr.left + cr.width / 2, y: cr.top + cr.height / 2 } });
  if (!cachee) { T.rc += valeurCompte(c); T.vues++; }
  rafraichirBarre(); await dodo(vitesse()); return c;
}
async function tirerSiege(si, hi) {
  const st = T.sieges[si], h = st && st.mains[hi], hote = $(`m_${si}_${hi}`);
  if (!h || !hote) return;
  await tirer(h.cards, hote, false, { siege: si, main: hi });
  const w = $(`m_${si}_${hi}`);
  if (w && w.parentNode) w.parentNode.querySelector(".score").textContent = E.handTotal(h.cards) + (h.doubled ? " ×2" : "");
}
// La carte cachée est un DOS posé dans la main : on ne la remplace pas, on la
// RETOURNE. C'est cartes.js qui dessine la face et fait tourner le pivot, sur
// l'événement « sabot:croupier-revele » (el = la carte elle-même).
async function revelerCachee() {
  const c = T.croupier.find(x => x.cachee); if (!c) return;
  c.cachee = false; T.rc += valeurCompte(c); T.vues++;
  const e = $("dMain").children[1] || $("dMain").lastElementChild;
  son("carte");
  rafraichirBarre(); $("dScore").textContent = E.handTotal(T.croupier);
  emettre("croupier-revele", { carte: c, total: E.handTotal(T.croupier), el: e });
  await dodo(matchMedia("(prefers-reduced-motion:reduce)").matches ? 60 : 420);
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
  T.occupe = true; boutons({}); ac();
  const t = tableCourante();
  // Une mélangeuse continue remet les cartes jouées dans le sabot après chaque main :
  // le compte ne s'accumule jamais. C'est la seule façon honnête de la simuler.
  const csm = t.melange === "melangeuse_continue";
  if (csm) {
    // La mélangeuse ne clôt pas une partie : elle reprend les cartes et on continue.
    // Le nombre de mains et le solde ne bougent pas, seul le compte est remis à plat.
    if (T.mains > 0) { $("annonce").textContent = "La mélangeuse reprend les cartes."; await remelanger(); await dodo(400); }
  } else if (T.sabot.length <= T.coupe) {
    $("annonce").textContent = "Carte de coupe atteinte : on remélange.";
    if (T.vues > 20) demanderMonCompte(true);
    await dodo(900); await nouveauSabot({ pendantDonne: true });
    $("annonce").textContent = "Sabot neuf, mélangé, carte brûlée.";
  }
  for (const st of T.sieges) for (const h of st.mains) T.defausse += h.cards.length;
  T.defausse += T.croupier.length; T.croupier = []; T.actif = null;
  // Chaque siège joue la mise qu'il a posée dans son cercle (st.mise, lot Jetons) ; `|| 1` = sans jetons, une unité.
  for (const st of T.sieges) st.mains = [E.newHand([], st.mise || 1)];
  rendreSieges(); $("dMain").innerHTML = ""; $("dScore").textContent = "·";
  $("annonce").textContent = ""; $("conseil").textContent = ""; rafraichirBarre();
  T.enJeu = true;
  emettre("donne-debut", { table: t.id, sieges: T.sieges.length });
  const r = reglesTable();
  for (let tour = 0; tour < 2; tour++) {
    for (let si = 0; si < T.sieges.length; si++) await tirerSiege(si, 0);
    // Sans carte cachée, le croupier ne prend qu'une carte : c'est toute la règle.
    if (tour === 0) { await tirer(T.croupier, $("dMain"), false, CROUPIER); $("dScore").textContent = E.cardValue(T.croupier[0]); }
    else if (r.holeCard) await tirer(T.croupier, $("dMain"), true, CROUPIER);
  }
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
    $("annonce").textContent = "Le croupier vérifie sa carte…"; await dodo(vitesse() * 1.4);
    if (E.handTotal(T.croupier) === 21) { await revelerCachee(); $("annonce").textContent = "Blackjack du croupier."; T.occupe = false; return regler(); }
    $("annonce").textContent = "";
  }
  T.occupe = false; await jouerSieges(0);
}
function demanderAssurance() {
  return new Promise(res => {
    $("annonce").textContent = "Assurance ?";
    const b = document.createElement("div"); b.className = "bulle";
    b.innerHTML = `<div class="de">Croupier</div><div class="q">Le croupier montre un as. Assurance ?</div>
      <div class="opts"><button data-o="1">Oui</button><button data-o="0">Non</button></div>`;
    b.querySelectorAll("button").forEach(bt => bt.onclick = () => {
      const prise = bt.dataset.o === "1"; $("boiteAssurance").innerHTML = ""; $("annonce").textContent = "";
      if (sys().equilibre) {
        const seuil = donneesTable().assurance;
        const tc = CT.compteVrai(T.rc, T.sabot.length / 52);
        const devrait = seuil !== null && tc >= seuil, bon = prise === devrait;
        DB.strat.assurance[bon ? 0 : 1]++; garder(); son(bon ? "ok" : "ko");
        bandeau(`${bon ? "✓" : "✗"} compte vrai ${fr1(tc)} · ${devrait ? "l'assurance est rentable dès " + sgn(seuil) : "pas d'assurance sous " + sgn(seuil)}`, 3400);
      }
      res(prise);
    });
    $("boiteAssurance").appendChild(b); son("alerte");
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
      T.actif = { siege: si, main: hi }; rendreSieges();
      emettre("tour", { siege: si, main: hi, toi: st.toi });
      if (st.toi) { T.occupe = false; return tonTour(); }
      await jouerAuto(si, hi);
    }
  }
  T.actif = null; rendreSieges(); await jouerCroupier();
}
async function jouerAuto(si, hi) {
  const st = T.sieges[si], r = reglesTable();
  let h = st.mains[hi];
  for (;;) {
    if (h.fromSplitAces && !r.hitSplitAces && h.cards.length === 2) break;
    const a = actionBase(h.cards, T.croupier[0], st, h);
    await dodo(vitesse() * 1.1);
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
  if (DB.conseil) {
    const tc = sys().equilibre ? CT.compteVrai(T.rc, T.sabot.length / 52) : null;
    const { a, ecart } = actionAvecEcart(h.cards, T.croupier[0], st, h, tc);
    $("conseil").innerHTML = `Stratégie : <b>${MOT[a]}</b>` + (ecart !== null ? ` <span class="muet">— écart au compte, à partir de ${sgn(ecart)}</span>` : "");
  } else $("conseil").textContent = "";
}
async function mainSuivante() {
  const si = T.sieges.indexOf(T.toi); boutons({}); $("conseil").textContent = "";
  if (T.actif.main + 1 < T.toi.mains.length) { T.actif = { siege: si, main: T.actif.main + 1 }; rendreSieges();
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
$("bAbandon").onclick = monAction(async () => {
  const h = T.toi.mains[T.actif.main]; if (!peutAbandonner(h, T.toi)) return;
  abandonner(T.sieges.indexOf(T.toi), T.actif.main); son("alerte"); await mainSuivante();
});
async function jouerCroupier() {
  T.occupe = true; const r = reglesTable();
  emettre("tour", { siege: "croupier", main: 0, toi: false });
  const vivants = T.sieges.some(st => st.mains.some(h => !h.surrendered && !E.isBust(h.cards) && !(E.isBlackjack(h) && st.mains.length === 1)));
  if (r.holeCard) await revelerCachee();
  else { await tirer(T.croupier, $("dMain"), false, CROUPIER); $("dScore").textContent = E.handTotal(T.croupier); }
  await dodo(vitesse() * .5);
  if (vivants) {
    for (;;) {
      const t = E.handTotal(T.croupier), soft = E.isSoft(T.croupier);
      if (t > 21 || t > 17 || (t === 17 && !(r.h17 && soft))) break;
      await tirer(T.croupier, $("dMain"), false, CROUPIER); $("dScore").textContent = E.handTotal(T.croupier);
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
  T.solde += net;
  T.actif = null; rendreSieges(); T.mains++; T.enJeu = false; T.occupe = false; rafraichirBarre(); garder();
  $("annonce").textContent = `Croupier ${dt > 21 ? "saute à " + dt : dt}. Toi : ${miennes.join(" · ")}.`;
  // Les mains d'abord, une par une, puis la manche : un écouteur peut compter
  // sur cet ordre pour faire glisser les jetons avant de tirer un bilan.
  assurances.forEach(a => emettre("assurance-fin", a));
  fins.forEach(f => emettre("main-fin", f));
  emettre("manche-fin", { issues, toi: T.toi ? issues[T.sieges.indexOf(T.toi)] : [], net, solde: T.solde, croupier: dt });
  boutons({ donne: true });
}
$("bDonne").onclick = distribuer;
$("bNouveauSabot").onclick = () => nouveauSabot();
// Les réglages d'installation — cadence, aide — se règlent une fois et n'ont
// rien à faire sur le feutre à côté des coups qu'on joue à chaque main.
$("bReglagesTable").onclick = () => {
  ouvrirModale(`<h2>Réglages de la table</h2>
    <div class="demande" style="flex-direction:column;align-items:stretch;text-align:left">
      <label class="ch"><span class="grave">Cadence du croupier</span>
        <input type="range" id="rgCadence" min="120" max="1400" step="20" value="${DB.cadence}">
        <span class="muet" id="rgCadenceL">${fr1(DB.cadence / 1000)} s par carte</span></label>
      <label class="ch ligne"><input type="checkbox" id="rgConseil"${DB.conseil ? " checked" : ""}>
        Afficher la stratégie de base pendant mon tour</label>
    </div>`);
  $("rgCadence").oninput = () => {
    DB.cadence = +$("rgCadence").value; garder();
    $("rgCadenceL").textContent = fr1(DB.cadence / 1000) + " s par carte";
    $("plateau").style.setProperty("--intervalle", vitesse() + "ms");
  };
  $("rgConseil").onchange = () => {
    DB.conseil = $("rgConseil").checked; garder();
    if (T.actif && !T.occupe && T.toi === T.sieges[T.actif.siege]) tonTour();
  };
};
$("bMonCompte").onclick = () => demanderMonCompte(false);
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
