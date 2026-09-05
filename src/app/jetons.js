/* ══════════════════════ JETONS ══════════════════════
   LES JETONS — le rack, les piles, le vol vers les cercles de mise (lot Jetons).
   Concaténé juste après table.js. Il se branche sur le bus « sabot:* » documenté
   en tête de socle.js et pose ses piles dans #jetonsCalque et dans les .cercle.

   Ce que ce morceau POSSÈDE : l'argent. DB.tapis (tes jetons en main), DB.engage
   (ce qui est posé sur le feutre), DB.rachats. La table (table.js) ne compte que
   des mises : elle lit `st.mise` à la donne, et `hand.bet` porte la vraie mise.
   Tout mouvement d'argent passe par DEUX fonctions — engager() et rendre() —
   pour qu'une main interrompue (rechargement) puisse être remboursée au démarrage.

   La phase, posée sur #v-table[data-phase] :
     mise       le rack est ouvert, les jetons volent vers les cercles
     jeu        la donne est en cours, le rack est sous le rail
     reglement  les jetons glissent (gains vers toi, pertes vers le croupier)
   ═══════════════════════════════════════════════════════════════════ */

/* ── L'argent : des jetons, arrondis au centime, formatés à la française ── */
const TAPIS_DEPART = 1000;
const arr = x => Math.round(x * 100) / 100;
const fmtJ = n => {
  const neg = n < 0, a = Math.abs(arr(n)), e = Math.floor(a), d = Math.round((a - e) * 100);
  return (neg ? "−" : "") + String(e).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + (d ? "," + String(d).padStart(2, "0") : "");
};
const reduit = () => matchMedia("(prefers-reduced-motion:reduce)").matches;

/* ── Les dénominations : le code des casinos, et un « snapper » de 2,50 ────
   Le 2,50 (rose) ne se mise jamais : il ne sert qu'à PAYER — un blackjack 3:2
   sur 25 vaut 37,50, un abandon sur 11 rend 5,50. Sans lui, ces sommes ne se
   posent pas en jetons. */
const JETONS = [
  { v: 1,    cls: "v1",    face: "#E8E2D2", marque: "#3A6BB0", texte: "#22262B" },
  { v: 2.5,  cls: "v250",  face: "#E39FBA", marque: "#FBF2F6", texte: "#78304F" },
  { v: 5,    cls: "v5",    face: "#C4282C", marque: "#F7EFDD", texte: "#8E1B1F" },
  { v: 25,   cls: "v25",   face: "#1F7A47", marque: "#F7EFDD", texte: "#14512F" },
  // Le 100 : face ardoise (pas noir pur), inserts IVOIRE et liseré clair — mesuré le 05/09 sur le
  // feutre du Salon Privé (#25282B), face contre feutre ≈ 1,3:1, seul le chiffre faisait le travail.
  { v: 100,  cls: "v100",  face: "#2A2A31", marque: "#EDE7D9", texte: "#1D1D22", bord: "rgba(246,242,232,.55)" },
  { v: 500,  cls: "v500",  face: "#6A3BA0", marque: "#F3E9F9", texte: "#4A2670" },
  { v: 1000, cls: "v1000", face: "#E27A1F", marque: "#FFF4E4", texte: "#8F4A0E" },
];
const RACK = [1, 5, 25, 100, 500, 1000];     // ce qu'on peut poser, de gauche à droite (touches 1 à 6)
const DENOM = [1000, 500, 100, 25, 5, 1];

// Un montant en jetons. ⚠️ Le snapper se retire AVANT le glouton : 37,50 découpé
// en entier puis complété donne 25+5+5+1+1+2,50 = 39,50. Il n'en faut jamais deux.
function decoupe(montant) {
  const out = []; let c = Math.round(montant * 100);
  if (c % 100 === 50) { out.push(2.5); c -= 250; }
  let r = c / 100;
  for (const d of DENOM) { const n = Math.floor(r / d + 1e-9); for (let k = 0; k < n; k++) out.push(d); r -= n * d; }
  return out;
}

/* ── Le dessin : un SVG par jeton, un sprite pour ce qui est commun ──────
   Disque, six marques de bord, anneau, inlay ivoire au centre avec la valeur,
   et un relief (lumière en haut, ombre en bas) qui fait aussi la tranche des
   jetons du dessous dans une pile. Les dégradés vivent une fois dans #jetonotheque. */
const JETONOTHEQUE = `<svg id="jetonotheque" width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute;left:-1px;top:-1px;overflow:hidden"><defs>
<g id="jt-marques">${[0, 60, 120, 180, 240, 300].map(a => `<rect x="43" y="1.4" width="14" height="10.5" rx="2.2" transform="rotate(${a} 50 50)"/>`).join("")}</g>
<linearGradient id="jt-relief" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".40"/><stop offset=".40" stop-color="#fff" stop-opacity="0"/><stop offset=".70" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></linearGradient>
<radialGradient id="jt-inlay" cx=".5" cy=".36" r=".72"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".15"/></radialGradient>
<radialGradient id="jt-bombe" cx=".5" cy=".5" r=".5"><stop offset=".76" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".34"/></radialGradient>
<radialGradient id="jt-reflet" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".30"/><stop offset=".55" stop-color="#fff" stop-opacity=".10"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
</defs></svg>`;
document.body.insertAdjacentHTML("afterbegin", JETONOTHEQUE);

const jetonDe = v => JETONS.find(x => x.v === v) || JETONS[0];
function jetonSvg(v) {
  const j = jetonDe(v), txt = v === 2.5 ? "2,50" : String(v);
  // Le chiffre se lit à 1280 (un jeton posé fait 42 px ; « 1000 » à 19/100 faisait 8 px) : l'inlay
  // prend 31 de rayon et le chiffre 21 / 27 / 33 selon sa longueur.
  const fs = txt.length >= 4 ? 21 : txt.length === 3 ? 27 : 33;
  // preserveAspectRatio="none" : dans une pile la face est écrasée en ellipse (plongée) ; ailleurs
  // la boîte est carrée et rien ne change. Le dessin vit dans <g class="jt-face"> : c'est LUI qui
  // tourne en vol (jetons.js, vol), pas la boîte — une ellipse qui tournerait basculerait.
  return `<svg class="jt-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"><g class="jt-face">
<circle cx="50" cy="50" r="49" fill="${j.face}"/>
<use href="#jt-marques" fill="${j.marque}" stroke="rgba(0,0,0,.32)" stroke-width=".7"/>
<circle cx="50" cy="50" r="49" fill="url(#jt-bombe)"/>
<circle cx="50" cy="50" r="41.5" fill="none" stroke="${j.marque}" stroke-opacity=".5" stroke-width="1.1"/>
<circle cx="50" cy="50" r="34.5" fill="none" stroke="${j.marque}" stroke-width="2"/>
<circle cx="50" cy="50" r="31" fill="#F7F2E5"/>
<circle cx="50" cy="50" r="31" fill="url(#jt-inlay)"/>
<text x="50" y="50.5" text-anchor="middle" dominant-baseline="central" font-size="${fs}" fill="${j.texte}">${txt}</text>
<circle cx="50" cy="50" r="49" fill="url(#jt-relief)"/>
<ellipse cx="50" cy="24" rx="27" ry="9" fill="url(#jt-reflet)"/>
<circle cx="50" cy="50" r="48.6" fill="none" stroke="${j.bord || "#000"}" stroke-opacity="${j.bord ? "1" : ".45"}" stroke-width="1"/>
</g></svg>`;
}
const JT_GABARIT = document.createElement("template");
function jetonEl(v, w, tag) {
  const b = tag || "div";
  const j = jetonDe(v);
  // --face / --marque : la tranche (style.css, .jt-pile .jt::before) est rayée à ses couleurs.
  JT_GABARIT.innerHTML = `<${b} class="jt ${j.cls}" data-v="${v}" style="--face:${j.face};--marque:${j.marque}${w ? `;--w:${w}px` : ""}">${jetonSvg(v)}</${b}>`;
  return JT_GABARIT.content.firstElementChild.cloneNode(true);
}
// Une pile : le plus gros jeton en bas, coupée par huit comme un croupier coupe
// ses piles — 12 000 au Salon Privé fait deux colonnes, pas une tour.
function pileEl(montant, w) {
  const js = decoupe(montant).sort((a, b) => b - a), tas = document.createElement("div");
  tas.className = "jt-tas"; tas.style.setProperty("--jw", (w || 40) + "px");
  for (let i = 0; i < js.length; i += 8) {
    const col = js.slice(i, i + 8), p = document.createElement("div"); p.className = "jt-pile";
    p.style.setProperty("--n", col.length);
    col.forEach((v, k) => { const e = jetonEl(v); e.style.setProperty("--i", k); p.appendChild(e); });
    tas.appendChild(p);
  }
  return tas;
}

/* ── La taille des jetons POSÉS : celle de la table (--w-table, posée par cartes.js
   sur le plateau), 60 % d'une carte pour ta pile, 50 % pour celle d'un voisin — le
   rapport d'un vrai jeton (39 mm) à une vraie carte (63) est 0,62. Le clone en vol a
   la taille d'ARRIVÉE — mesuré le 05/09, un clone de 40 px qui devenait une pile de
   34 au contact faisait un accroc de 15 %. */
function tailleJeton(toi) {
  const w = parseFloat(getComputedStyle($("plateau")).getPropertyValue("--w-table")) || 84;
  return Math.round(w * (toi ? .6 : .5));
}
const tailleRack = () => { const b = $("rjJetons").firstElementChild; return b ? (parseFloat(getComputedStyle(b).getPropertyValue("--w")) || 46) : 46; };

/* ── L'état ─────────────────────────────────────────────────────────────── */
const J = { phase: "attente", mise: 0, poses: [], attente: 0 };
if (typeof DB.tapis !== "number" || isNaN(DB.tapis)) DB.tapis = TAPIS_DEPART;
if (typeof DB.rachats !== "number") DB.rachats = 0;
if (typeof DB.engage !== "number" || isNaN(DB.engage)) DB.engage = 0;
// Une main interrompue par un rechargement : ce qui était posé revient en main.
if (DB.engage > 0) { DB.tapis = arr(DB.tapis + DB.engage); DB.engage = 0; garder(); }
T.mise = 0; T.miseOk = false; T.tcMise = null; T.miseDonne = 0;

const limites = () => { const t = tableCourante(); return { min: t.mise_min || 10, max: t.mise_max || 1000, par5: t.blackjackPays < 1.5 }; };
const miseValide = m => { const l = limites(); return m >= l.min && m <= l.max && (!l.par5 || m % 5 === 0); };
// Les deux seuls mouvements d'argent : vers le feutre, et retour en main.
function engager(st, m) {
  if (st.toi) { DB.tapis = arr(DB.tapis - m); DB.engage = arr(DB.engage + m); garder(); }
  else st.tapis = arr((typeof st.tapis === "number" ? st.tapis : TAPIS_DEPART) - m);
}
function rendre(st, engage, retour) {
  if (st.toi) { DB.tapis = arr(DB.tapis + retour); DB.engage = arr(Math.max(0, DB.engage - engage)); garder(); }
  else st.tapis = arr((typeof st.tapis === "number" ? st.tapis : TAPIS_DEPART) + retour);
}

/* ── Les ancres : tout en coordonnées de la VUE (#jetonsCalque la couvre, salle ET barre
   des coups). Mesuré le 05/09 avec un calque limité à la salle : le jeton du rack (y = 764)
   décollait sous une salle qui s'arrêtait à 728, tranché par le bord pendant ~100 ms, puis
   « sortait du sol » entre deux sièges. Le vol part du jeton qu'on a cliqué. ── */
const salleRect = () => $("v-table").getBoundingClientRect();
function centre(el) { const s = salleRect(), r = el.getBoundingClientRect(); return { x: r.left + r.width / 2 - s.left, y: r.top + r.height / 2 - s.top }; }
const ancreCercle = si => { const e = $("cercle_" + si); return e ? centre(e) : { x: salleRect().width / 2, y: salleRect().height * .8 }; };
// Sous le rail, pas sur le rack : mesuré le 05/09, le jeton du paiement apparaissait posé SUR le
// rack, par-dessus les tubes, avant de glisser. Il sort de dessous, et il APPARAÎT (vol, o.apparait).
const ancreCroupier = () => { const e = $("rack"); if (!(e && e.offsetWidth)) return { x: salleRect().width / 2, y: 30 };
  const c = centre(e); c.y += e.offsetHeight / 2 + 22; return c; };
// Le rack fermé est sous le rail : les jetons en partent (ou y rentrent) par le bas.
const ancreRack = v => { const b = $("rjJetons").querySelector(`[data-v="${v}"]`) || $("rjJetons"); const c = centre(b);
  if (!$("rackJetons").classList.contains("ouvert")) { const s = salleRect(); c.x = s.width / 2; c.y = s.height + 40; } return c; };
// « Chez soi » : ton rack pour toi ; pour un voisin, le rail juste sous son nom.
const ancreMaison = si => { const st = T.sieges[si]; if (st && st.toi) return ancreRack(25); const c = ancreCercle(si); return { x: c.x, y: c.y + 72 }; };

/* ── Le vol : un clone dans le calque, le VRAI état est rendu à l'arrivée ──
   Deux animations : le porteur suit la ligne droite, le jeton dessus décrit
   l'arc (il monte, tourne, grossit) pendant que son ombre reste sur le feutre
   et s'éloigne. Sous prefers-reduced-motion, tout se pose en une milliseconde. */
function vol(o) {
  const calque = $("jetonsCalque"), invisible = $("v-table").hidden || salleRect().width < 50;
  const dur = invisible || reduit() ? 1 : (o.duree || 320);
  const w = o.w || (o.montant !== undefined ? 40 : 44);
  const porte = document.createElement("div"); porte.className = "jt-vol"; porte.style.setProperty("--w", w + "px");
  const ombre = document.createElement("i"); ombre.className = "jt-ombre";
  const corps = o.montant !== undefined ? pileEl(o.montant, w) : jetonEl(o.v, w);
  porte.append(ombre, corps); calque.appendChild(porte);
  const dx = o.vers.x - o.depuis.x, dy = o.vers.y - o.depuis.y;
  porte.style.left = (o.depuis.x - w / 2) + "px"; porte.style.top = (o.depuis.y - w / 2) + "px";
  // UNE courbe pour le trajet, la rotation et la portance : mesuré le 04/09, avec un
  // porteur à 80 % du trajet en 120 ms et une toupie de 400 ms, le jeton faisait sa
  // pirouette SUR PLACE au-dessus du cercle. Sommet à 38 % : il retombe sur le cercle.
  const ease = o.glisse ? "cubic-bezier(.3,0,.2,1)" : "cubic-bezier(.3,.1,.25,1)";
  // fondu : s'efface en arrivant (vers le croupier, ou hors de la table) ;
  // apparait : surgit en partant (les jetons d'un voisin viennent de son rail, hors champ).
  const trajet = o.fondu
    ? [{ transform: "translate(0,0)", opacity: 1 }, { transform: `translate(${dx * .72}px,${dy * .72}px)`, opacity: 1, offset: .72 }, { transform: `translate(${dx}px,${dy}px)`, opacity: 0 }]
    : o.apparait
    ? [{ transform: "translate(0,0)", opacity: 0 }, { transform: `translate(${dx * .3}px,${dy * .3}px)`, opacity: 1, offset: .3 }, { transform: `translate(${dx}px,${dy}px)`, opacity: 1 }]
    : [{ transform: "translate(0,0)" }, { transform: `translate(${dx}px,${dy}px)` }];
  const a = porte.animate(trajet, { duration: dur, easing: ease, fill: "forwards" });
  // Le jeton qu'on prend claque en partant (socle.js) ; les jetons d'un voisin, ou un paiement
  // qui glisse, à mi-voix. L'arrivée tinte dans le rappel `fin` de chaque appelant.
  if (dur > 1) son("jeton", { gain: o.doux ? .45 : o.glisse ? .7 : 1 });
  // Le jeton part à la taille de là où il était (le rack : 46 px) et prend celle
  // d'arrivée dans le premier tiers du vol — jamais au contact.
  // Mesuré le 05/09 : de 46 à 25 px dans le premier tiers, le jeton « fondait » en partant. Sur 60 %.
  if (o.de && o.de !== w) porte.animate([{ scale: (o.de / w).toFixed(3) }, { scale: "1", offset: .6 }, { scale: "1" }], { duration: dur, easing: "ease-out", fill: "forwards" });
  if (!o.glisse) {
    // Mesuré le 05/09 : rotation LINÉAIRE de 300° sous un porteur en cubic-bezier, les
    // 130 dernières ms tournaient de 125° pour 20 px de course, et la pile posée est à 0°
    // (300° ≡ −60° : le chiffre sautait au contact). Même courbe, tour complet.
    // C'est la FACE (le <g> du dessin) qui tourne, pas la boîte : une pile a une tranche, et
    // une boîte en plongée qui tourne ne tourne pas, elle bascule.
    corps.querySelectorAll(".jt-face").forEach(f => f.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], { duration: dur, easing: ease, fill: "forwards" }));
    const porte = corps.firstElementChild;
    if (porte) porte.animate([{ transform: "translateY(0) scale(1)" }, { transform: "translateY(-26px) scale(1.1)", offset: .38 }, { transform: "translateY(0) scale(1)" }],
      { duration: dur, easing: "ease-out", fill: "forwards" });
    ombre.animate([{ transform: "scale(1)", opacity: .55 }, { transform: "scale(.6)", opacity: .2, offset: .38 }, { transform: "scale(1)", opacity: .55 }], { duration: dur, fill: "forwards" });
  } else corps.animate([{ transform: "rotate(0)" }, { transform: `rotate(${dx > 0 ? 16 : -16}deg)` }], { duration: dur, easing: ease, fill: "forwards" });
  // L'arrivée est garantie par un minuteur, pas seulement par onfinish : un onglet
  // caché (ou un Chrome sans images) ne fait pas avancer ses animations, et l'ÉTAT
  // — la pile dans le cercle, le tapis — ne doit jamais dépendre d'un dessin.
  let fait = false;
  const fin = () => { if (fait) return; fait = true; porte.remove(); if (o.fin) o.fin(); };
  a.onfinish = fin; a.oncancel = fin; setTimeout(fin, dur + 60);
  return a;
}
// La lueur dorée sur un cercle qui vient de gagner.
function lueur(si) {
  if ($("v-table").hidden) return;
  const c = ancreCercle(si), d = document.createElement("i"); d.className = "jt-lueur";
  d.style.left = c.x + "px"; d.style.top = c.y + "px"; $("jetonsCalque").appendChild(d);
  const a = d.animate([{ opacity: 0, transform: "translate(-50%,-50%) scale(.5)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1)", offset: .3 }, { opacity: 0, transform: "translate(-50%,-50%) scale(1.25)" }],
    { duration: reduit() ? 1 : 950, easing: "ease-out", fill: "forwards" });
  a.onfinish = () => d.remove();
}

/* ── Les piles dans les cercles : rendues depuis l'ÉTAT, à chaque redessin ──
   rendreSieges() recrée les cercles à chaque coup ; on ne garde aucun nœud,
   on redessine ce que l'état dit. En phase de mise, c'est la mise ARRIVÉE
   (st.miseVue) ; en jeu, la mise de chaque main encore sur le feutre. */
function misesVisibles(st) {
  // Tant que les mains de la donne n'existent pas (phase de mise, ou pause avant la
  // première carte), la pile est la mise arrivée dans le cercle.
  if (J.phase === "mise" || !J.donnee) return st.miseVue > 0 ? [st.miseVue] : [];
  const out = [];
  for (const h of st.mains || []) {
    if (h.jParti || !h.jVu) continue;
    out.push(h.bet);
    if (h.doubled && h.jDoubleVu) out.push(h.bet);
    if (h.assurance && h.jAssuranceVu && !h.jAssurancePartie) out.push(h.assurance);
  }
  return out;
}
function garnirCercles() {
  T.sieges.forEach((st, si) => {
    const ce = $("cercle_" + si); if (!ce) return;
    ce.querySelectorAll(".jt-mises, .jt-montant").forEach(x => x.remove());
    const parts = misesVisibles(st);
    ce.classList.toggle("garni", parts.length > 0);
    if (!parts.length) return;
    const box = document.createElement("div"); box.className = "jt-mises";
    const w = tailleJeton(st.toi);
    parts.forEach(m => box.appendChild(pileEl(m, w)));
    ce.appendChild(box);
    // Le montant, en clair, à droite du cercle : une pile se compte à la tranche, et
    // une tranche de 3 px ne se lit pas. Le croupier annonce la mise, on l'écrit.
    const total = parts.reduce((a, b) => a + b, 0);
    const mt = document.createElement("i"); mt.className = "jt-montant"; mt.textContent = fmtJ(total); ce.appendChild(mt);
  });
}
document.addEventListener("sabot:sieges", () => { detecterSeparations(); garnirCercles(); });
// cartes.js vient de (re)poser --w-table : les piles déjà posées prennent la nouvelle taille
// (--jw est transitionnée : elles glissent). Mesuré le 05/09 : rendues avant la première mesure,
// elles gardaient la taille de repli, puis sautaient de 43 à 21 px à la mise suivante.
document.addEventListener("sabot:echelle", () => {
  document.querySelectorAll("#sieges .cercle .jt-tas").forEach(t => {
    const toi = !!t.closest(".siege.toi"); t.style.setProperty("--jw", tailleJeton(toi) + "px"); });
});

/* ── Le rack : tes jetons, sur le rail devant toi ────────────────────────── */
function rendreRack(o) {
  o = o || {};
  const l = limites(), r = $("rackJetons"), boite = $("rjJetons");
  r.dataset.min = l.min; r.dataset.max = l.max;
  if (!boite.children.length) RACK.forEach(v => {
    const b = jetonEl(v, 46, "button"); b.type = "button"; b.setAttribute("aria-label", `Poser un jeton de ${fmtJ(v)}`);
    b.onclick = () => poserJeton(v); boite.appendChild(b);
  });
  const ouvert = J.phase === "mise";
  boite.querySelectorAll("button").forEach(b => {
    const v = +b.dataset.v;
    b.disabled = !ouvert || v > DB.tapis || J.mise + v > l.max || (l.par5 && v % 5 !== 0);
    b.title = l.par5 && v % 5 !== 0 ? "Ici les mises vont par 5" : `Poser ${fmtJ(v)} (touche ${RACK.indexOf(v) + 1})`;
  });
  $("rjLimites").textContent = `min ${fmtJ(l.min)} · max ${fmtJ(l.max)}`;
  // Mesuré le 05/09 : les chiffres changeaient à t=0 alors que le jeton touchait le
  // cercle à 320 ms. `differe` laisse les montants au vol : c'est lui qui les écrit.
  if (!o.differe) rendreMontants();
  $("bRetirer").disabled = !ouvert || !J.poses.length;
  $("bRachat").hidden = !(ouvert && DB.tapis < l.min && J.mise === 0);
  r.classList.toggle("ouvert", ouvert);
}
// Les montants du rack et de la barre : écrits ensemble, quand le jeton est arrivé.
function rendreMontants() {
  const l = limites();
  $("rjTapis").textContent = fmtJ(DB.tapis);
  $("rjMise").textContent = fmtJ(J.mise);
  rendreMiseHud();
  const u = J.mise / l.min;
  $("rjUnites").textContent = J.mise ? `${fr1(u)} unité${u > 1 ? "s" : ""}` : (DB.tapis >= l.min ? "pose ta mise" : "—");
  rendreTapis();
}
function rendreTapis() {
  $("tTapis").textContent = fmtJ(DB.tapis);
  const n = $("tNet"), s = T.solde || 0;
  n.hidden = !s; n.textContent = (s > 0 ? "+" : "") + fmtJ(s); n.className = s > 0 ? "plus" : s < 0 ? "moins" : "";
}
function majDonne() {
  T.miseOk = J.phase === "mise" && miseValide(J.mise);
  if (J.phase === "mise" && !T.enJeu && !T.occupe) {
    $("bDonne").disabled = !T.miseOk;
    $("bDonne").title = T.miseOk ? "" : `Pose d'abord une mise : au moins ${fmtJ(limites().min)}`;
  }
}
function poserJeton(v) {
  if (J.phase !== "mise" || !T.toi) return;
  const l = limites();
  if (l.par5 && v % 5 !== 0) return bandeau("Ici les mises vont par 5.");
  if (v > DB.tapis) return bandeau("Il ne te reste pas ça en main.");
  if (J.mise + v > l.max) return bandeau(`Maximum de la table : ${fmtJ(l.max)}.`);
  const si = T.sieges.indexOf(T.toi), depuis = ancreRack(v);
  // L'accusé du clic : le jeton du rack se soulève, le clone part de sa place. Sans ça rien
  // ne reliait le clic au jeton qui vole (mesuré le 05/09).
  const bouton = $("rjJetons").querySelector(`[data-v="${v}"]`);
  // Le jeton CHOISI reste soulevé dans le rack (style.css, .choisi) : on voit lequel on vient de poser.
  $("rjJetons").querySelectorAll(".choisi").forEach(b => { if (b !== bouton) b.classList.remove("choisi"); });
  if (bouton) bouton.classList.add("choisi");
  if (bouton && !reduit()) { const a = bouton.animate([{ transform: "translateY(0)" }, { transform: "translateY(-7px)", offset: .4 }, { transform: "none" }], { duration: 200, easing: "ease-out" }); a.finished.then(() => a.cancel(), () => {}); }
  engager(T.toi, v); J.mise = arr(J.mise + v); J.poses.push(v); T.toi.mise = T.mise = J.mise;
  // L'ÉTAT tout de suite (Distribuer s'ouvre au clic, une ligne) ; le DESSIN à l'image suivante.
  // Le clone décolle d'abord ; le rack et l'appel du croupier se redessinent après — mesuré le
  // 05/09 : ~55 ms immobile au rack avant la première image en vol, un hoquet. ⚠️ majDonne reste
  // SYNCHRONE : différé lui aussi, un second clic tombé avant l'image suivante trouvait
  // Distribuer encore fermé et reposait un jeton (la sonde, sous temps virtuel, misait 100 pour 25).
  // Et le différé est un setTimeout, PAS un requestAnimationFrame : sous --virtual-time-budget
  // (la sonde) seule la première image est livrée, les suivantes jamais — mesuré le 05/09 sur
  // une page nue (raf1 = 7 ms, raf2 absent après 700 ms). Un rack qui ne se redessine jamais
  // laisse « Retirer » fermé pour de bon.
  majDonne();
  vol({ v, w: tailleJeton(true), de: tailleRack(), depuis, vers: ancreCercle(si), fin: () => {
    rendreMontants(); if (J.phase !== "mise") return;
    T.toi.miseVue = Math.min(J.mise, arr((T.toi.miseVue || 0) + v)); garnirCercles(); son("jetons"); } });
  setTimeout(() => { rendreRack({ differe: true }); appelMise(); }, 0);
}
function retirerJeton() {
  if (J.phase !== "mise" || !J.poses.length || !T.toi) return;
  const v = J.poses.pop(), si = T.sieges.indexOf(T.toi);
  J.mise = arr(J.mise - v); T.toi.mise = T.mise = J.mise; T.toi.miseVue = Math.min(T.toi.miseVue || 0, J.mise);
  rendre(T.toi, v, v); garnirCercles(); rendreRack(); majDonne(); appelMise();
  vol({ v, w: tailleJeton(true), depuis: ancreCercle(si), vers: ancreRack(v), fin: () => son("jetons") });
}
function poserJetonRang(k) { const b = $("rjJetons").children[k - 1]; if (b && !b.disabled) b.click(); }
$("bRetirer").onclick = retirerJeton;
$("bRachat").onclick = () => proposerRachat();

/* ── Les voisins : ils misent visiblement, et mal ─────────────────────────
   Un plat, un martingaleur, un qui monte quand ça rentre, un qui mise large —
   et au plus UN compteur, tiré au sort, que rien ne signale. Le repérer est
   un exercice : c'est ce que le chef de table cherche chez toi. */
const PROFILS = ["plat", "superstitieux", "chaud", "large", "compteur", "plat"];
function profilerSieges() {
  const libres = PROFILS.slice(); let compteurs = 0;
  T.sieges.forEach(st => {
    if (st.toi || st.profil) return;
    let p = libres.length ? libres.splice(alea(libres.length), 1)[0] : "plat";
    if (p === "compteur" && compteurs++) p = "plat";
    st.profil = p; if (typeof st.tapis !== "number") st.tapis = TAPIS_DEPART;
  });
}
function miseBot(st) {
  const l = limites(), tc = sys().equilibre ? CT.compteVrai(T.rc, T.sabot.length / 52) : null;
  let u = 1;
  if (st.profil === "superstitieux") u = st.dernierNet < 0 ? Math.min(8, (st.derniereU || 1) * 2) : 1;
  else if (st.profil === "chaud") u = st.dernierNet > 0 ? Math.min(6, (st.derniereU || 1) + 1) : 1;
  else if (st.profil === "compteur") u = CT.miseRampe(tc, 8);
  else if (st.profil === "large") u = 2 + (alea(3) === 0 ? 1 : 0);
  if (st.tapis < l.min) st.tapis = TAPIS_DEPART;          // ruiné, il reprend des jetons sans un mot
  let m = Math.max(l.min, Math.min(l.max, st.tapis, u * l.min));
  if (l.par5) m = Math.max(l.min, Math.floor(m / 5) * 5);
  st.derniereU = m / l.min; return m;
}

/* ── L'appel à miser ─────────────────────────────────────────────────────
   Mesuré le 05/09 : « pose ta mise » était un 10 px gris dans le rack, pendant que
   « Sabot neuf, mélangé, carte brûlée. » en 22 px serif dominait le feutre et que
   « Distribuer » (éteint) était le bouton le plus voyant. La hiérarchie disait
   « lis l'annonce, clique Distribuer » ; l'état disait « clique un jeton ».
   …puis (les critiques, 05/09) la pastille « Pose ta mise » flottait au milieu de 400 px de
   feutre nu, le lettrage effacé dessous. Le coach parle au-dessus des sièges, pas au centre
   du tapis : le croupier le DIT une fois (« sabot:appel-mise » → croupier.js), ton cercle bat
   deux fois, et la ligne du rail devant toi (#coachMise) GARDE l'appel tant que la mise
   n'est pas posée. Sur téléphone (pas de bulle), l'annonce du feutre reste. */
let APPEL_T = null;
const texteAppel = l => DB.tapis >= l.min ? `Pose ta mise · minimum ${fmtJ(l.min)}` : "Plus assez de jetons pour la mise minimale";
function appelMise() {
  clearTimeout(APPEL_T);
  if ($("v-table").dataset.reseau) return;
  const l = limites(), ok = miseValide(J.mise);
  const toi = document.querySelector("#sieges .siege.toi");
  if (toi) toi.classList.toggle("appel", J.phase === "mise" && !ok);
  rendreCoach();
  if (J.phase !== "mise") return;
  if (ok) { if (/mise/i.test($("annonce").textContent)) annoncer(""); return; }
  const grand = matchMedia("(min-width:1000px)").matches;
  const dire = () => {
    if (J.phase !== "mise" || miseValide(J.mise) || T.enJeu) return;
    if (!grand) { annoncer(texteAppel(l)); return; }
    if (!J.appele) { J.appele = true; emettre("appel-mise", { min: l.min, ruine: DB.tapis < l.min }); }
  };
  // On laisse lire ce que la table vient de dire (« Sabot neuf… », le règlement), puis on appelle.
  const a = $("annonce").textContent.trim();
  if (!a || /mise/i.test(a)) dire(); else APPEL_T = setTimeout(dire, 1600);
}
document.addEventListener("sabot:sieges", () => appelMise());

/* ── La phase de mise ────────────────────────────────────────────────────── */
function ouvrirMises() {
  if (T.enJeu || T.occupe) return;
  // Ce qui traînait encore sur le feutre revient en main (main interrompue, table changée).
  if (DB.engage > 0) { DB.tapis = arr(DB.tapis + DB.engage); DB.engage = 0; garder(); }
  J.phase = "mise"; J.donnee = false; J.mise = 0; J.poses = []; J.attente = 0; J.appele = false; T.mise = 0; T.miseDonne = 0;
  $("rjJetons").querySelectorAll(".choisi").forEach(b => b.classList.remove("choisi"));
  $("v-table").dataset.phase = "mise";
  T.sieges.forEach(st => { st.mise = 0; st.miseVue = 0; (st.mains || []).forEach(h => { h.jParti = true; }); });
  profilerSieges(); garnirCercles(); rendreRack(); majDonne(); rendreCoach(); appelMise();
  const l = limites();
  T.sieges.forEach((st, si) => {
    if (st.toi) return;
    const m = miseBot(st); st.mise = m; engager(st, m);
    setTimeout(() => { if (J.phase !== "mise" || T.sieges[si] !== st) return;
      vol({ montant: m, w: tailleJeton(false), depuis: ancreMaison(si), vers: ancreCercle(si), duree: 380, apparait: true, doux: true, fin: () => { if (J.phase === "mise" && T.sieges[si] === st) { st.miseVue = m; garnirCercles(); } } });
    }, 120 + si * 110);
  });
  if (DB.tapis < l.min) setTimeout(() => { if (J.phase === "mise" && DB.tapis < l.min && vue === "table") proposerRachat(); }, 600);
}
// Ruiné ailleurs qu'à la table (au chargement, par exemple) : la question se pose
// quand on s'y assoit, pas dans le dos d'une autre vue.
new MutationObserver(() => {
  if (!$("v-table").hidden && J.phase === "mise" && DB.tapis < limites().min) setTimeout(() => { if (vue === "table" && J.phase === "mise" && DB.tapis < limites().min) proposerRachat(); }, 400);
}).observe($("v-table"), { attributes: true, attributeFilter: ["hidden"] });
function proposerRachat() {
  if (!$("modale").hidden) return;
  const l = limites();
  ouvrirModale(`<h2>Plus un jeton</h2>
    <p>Il te reste <b class="cadran">${fmtJ(DB.tapis)}</b> en main et le minimum ici est de <b>${fmtJ(l.min)}</b>.</p>
    <p class="muet" style="font-size:var(--t-petit)">Un rachat remet ton tapis à 1 000 — et il se compte. ${DB.rachats ? `Tu en es à ${DB.rachats}.` : "Ce serait le premier."}</p>
    <div class="rang-btn" style="justify-content:center;margin-top:12px">
      <button class="btn" id="bRachatOui">Reprendre 1 000 jetons</button>
      <button class="btn creux" id="bRachatSalon">Changer de table</button>
    </div>`);
  $("bRachatOui").onclick = () => {
    DB.tapis = TAPIS_DEPART; DB.rachats = (DB.rachats || 0) + 1; garder();
    $("modale").hidden = true; rendreRack(); majDonne(); son("jetons");
    bandeau(`Tapis remis à 1 000 — ${DB.rachats}${DB.rachats > 1 ? "ᵉ" : "ᵉʳ"} rachat.`);
  };
  $("bRachatSalon").onclick = () => { $("modale").hidden = true; aller("salon"); };
}
// La phrase du coach : ta mise en unités, et — si le compte est affiché — sa
// cohérence avec le compte vrai. Le compte masqué reste masqué : la cohérence
// se lit alors dans « Mon compte », qui le révèle de toute façon.
function coherence(u, tc) { const ref = CT.miseRampe(tc); return { ok: Math.abs(u - ref) <= 1, ref }; }
// La mise RÉELLE vit dans la barre, à côté du tapis (« MISE 25 · 2,5 u ») : celle
// qu'on pose pendant la phase de mise, celle qui joue pendant la manche.
function rendreMiseHud() {
  const e = $("tMiseReelle"); if (!e) return;
  const l = limites(), m = J.phase === "mise" ? J.mise : T.miseDonne;
  if (!m) { e.textContent = "—"; return; }
  const u = m / l.min;
  e.textContent = fmtJ(m) + " · " + fr1(u) + " u";
}
// La phrase du coach ne dit plus que ce que la barre ne dit pas : la COHÉRENCE de
// la mise avec le compte vrai figé à la donne, quand le compte est affiché.
function rendreCoach() {
  const c = $("coachMise"), l = limites();
  rendreMiseHud();
  // Pendant la mise, la ligne du rail porte l'APPEL (cf. appelMise), en serif, devant ton cercle.
  if (J.phase === "mise") {
    const appel = !$("v-table").dataset.reseau && !miseValide(J.mise) && !T.enJeu && matchMedia("(min-width:1000px)").matches;
    c.classList.toggle("appel", appel);
    c.innerHTML = appel ? (DB.tapis >= l.min ? `Pose ta mise · <b>minimum ${fmtJ(l.min)}</b>` : "Plus assez de jetons pour la mise minimale") : "";
    return;
  }
  c.classList.remove("appel");
  if (J.phase === "attente" || !T.miseDonne || !T.montre || typeof T.tcMise !== "number") { c.innerHTML = ""; return; }
  const u = T.miseDonne / l.min, { ok, ref } = coherence(u, T.tcMise);
  c.innerHTML = `${fr1(u)} unité${u > 1 ? "s" : ""} pour un compte vrai de ${T.tcMise > 0 ? "+" : ""}${fr1(T.tcMise)} → <b class="${ok ? "ok" : "ko"}">${ok ? "cohérent" : "incohérent, la rampe dit " + ref}</b>`;
}
$("bMontrer").addEventListener("click", rendreCoach);

/* ── La donne : les mises sont fermées ─────────────────────────────────────
   Fermées au CLIC sur « Distribuer », pas à la première carte : entre les deux,
   distribuer() peut marquer une pause (carte de coupe, mélangeuse) pendant
   laquelle le rack doit déjà être clos — et le compte vrai figé est celui
   qu'on avait sous les yeux en décidant, avant tout remélange. */
function fermerMises() {
  if (J.phase !== "mise") return;
  J.phase = "jeu"; $("v-table").dataset.phase = "jeu";
  T.tcMise = sys().equilibre ? CT.compteVrai(T.rc, T.sabot.length / 52) : null; T.miseDonne = J.mise;
  J.poses = []; T.miseOk = false;
  rendreRack(); rendreCoach();
}
$("bDonne").addEventListener("click", () => { if (J.phase === "mise" && T.occupe) fermerMises(); });
document.addEventListener("sabot:donne-debut", e => {
  fermerMises(); J.donnee = true;
  // Le croupier (croupier.js, concaténé APRÈS ce fichier, donc écouté après) surveille
  // ta mise : on pose dans le detail la mise réellement jouée — en unités du minimum,
  // l'échelle de sa vigilance et de #tMise —, le montant en jetons, et le compte vrai
  // figé à la fermeture des mises. table.js ne peut pas les porter lui-même : sur le
  // chemin courant il émet cet événement dans le clic, avant que les mises soient fermées.
  if (e && e.detail && T.miseDonne) {
    e.detail.jetons = T.miseDonne; e.detail.mise = T.miseDonne / limites().min;
    e.detail.tc = typeof T.tcMise === "number" ? T.tcMise : null;
  }
  T.sieges.forEach(st => st.mains.forEach(h => { h.jEngage = true; h.jVu = true; }));
  garnirCercles(); rendreRack(); rendreCoach();
});
// Une main née d'une séparation : une seconde mise part de chez son propriétaire.
function detecterSeparations() {
  if (J.phase !== "jeu") return;
  T.sieges.forEach((st, si) => st.mains.forEach(h => {
    if (h.jEngage || !h.fromSplit) return;
    h.jEngage = true; engager(st, h.bet); rendreRack();
    vol({ montant: h.bet, w: tailleJeton(st.toi), de: st.toi ? tailleRack() : 0, depuis: ancreMaison(si), vers: ancreCercle(si), duree: 360, apparait: !st.toi, doux: !st.toi,
      fin: () => { h.jVu = true; garnirCercles(); if (st.toi) son("jetons"); } });
  }));
}
// Un doublement : la carte arrive, la seconde mise aussi.
document.addEventListener("sabot:carte", e => {
  const { siege: si, main: hi } = e.detail; if (si === "croupier" || J.phase !== "jeu") return;
  const st = T.sieges[si], h = st && st.mains[hi]; if (!h || !h.doubled || h.jDouble || !h.jEngage) return;
  h.jDouble = true; engager(st, h.bet); rendreRack();
  vol({ montant: h.bet, w: tailleJeton(st.toi), de: st.toi ? tailleRack() : 0, depuis: ancreMaison(si), vers: ancreCercle(si), duree: 360, apparait: !st.toi, doux: !st.toi,
    fin: () => { h.jDoubleVu = true; garnirCercles(); if (st.toi) son("jetons"); } });
});
// L'assurance : payable ou pas, puis posée à côté de la mise.
document.addEventListener("sabot:assurance-offre", e => { if (e.detail.toi && DB.tapis < e.detail.cout) { e.detail.possible = false; bandeau("Le croupier montre un as — tu n'as pas de quoi t'assurer."); } });
document.addEventListener("sabot:assurance", e => {
  const { siege: si, main: hi, prise, montant } = e.detail; const st = T.sieges[si], h = st && st.mains[hi];
  if (!prise || !h || !montant) return;
  engager(st, montant); rendreRack();
  vol({ montant, w: tailleJeton(st.toi), de: st.toi ? tailleRack() : 0, depuis: ancreMaison(si), vers: ancreCercle(si), duree: 360, apparait: !st.toi, doux: !st.toi, fin: () => { h.jAssuranceVu = true; garnirCercles(); son("jetons"); } });
});

/* ── Le règlement : les gains glissent vers toi, les pertes vers le croupier ──
   regler() émet les main-fin dans l'ordre des sièges, d'un coup ; on les
   ESPACE (140 ms) pour que le croupier paie une place après l'autre. Un bust
   arrive à l'instant, seul : il part tout de suite. */
function enfiler(fn) { const d = reduit() ? 0 : J.attente; J.attente += 140; setTimeout(fn, d); }
function glisser(montant, depuis, vers, o) { return vol(Object.assign({ montant, w: tailleJeton(o && o.toi), depuis, vers, glisse: true, duree: 520, doux: !(o && o.toi) }, o || {})); }
document.addEventListener("sabot:main-fin", e => {
  const { siege: si, main: hi, toi, issue, montant } = e.detail;
  const st = T.sieges[si], h = st && st.mains[hi]; if (!h || h.jRegle) return; h.jRegle = true;
  const engage = h.bet * (h.doubled ? 2 : 1), retour = arr(engage + montant);
  rendre(st, engage, retour);
  if (!toi) st.dernierNet = montant;
  enfiler(() => {
    const ce = ancreCercle(si), croupier = ancreCroupier(), maison = ancreMaison(si);
    // La pile et son montant quittent le cercle quand le clone qui part les REMPLACE au même
    // endroit (perte, égalité, abandon). Sur un gain, ils restent jusqu'à ce que le paiement
    // arrive : mesuré le 05/09, le cercle de Marc était vide et son « 30 » effacé pendant que le
    // jeton du croupier était encore sur le rack.
    const retirer = () => { h.jParti = true; garnirCercles(); };
    if (issue === "bust" || issue === "perd") { retirer(); glisser(engage, ce, croupier, { fondu: true, toi, fin: () => { if (toi) rendreTapis(); } }); }
    else if (issue === "abandon") { retirer(); glisser(engage / 2, ce, croupier, { fondu: true, toi }); glisser(retour, ce, maison, { fondu: !toi, toi, fin: () => { if (toi) rendreTapis(); } }); }
    else if (issue === "egalite") { retirer(); glisser(engage, ce, maison, { fondu: !toi, toi, fin: () => { if (toi) rendreTapis(); } }); }
    else {  // gagne · blackjack : le croupier paie devant le cercle, puis tout part chez le joueur
      glisser(montant, croupier, ce, { toi, apparait: true, fin: () => { retirer(); if (toi) { lueur(si); son("jetons"); }
        glisser(retour, ce, maison, { fondu: !toi, toi, duree: 460, fin: () => { if (toi) rendreTapis(); } }); } });
      return;
    }
    if (toi) son("jetons");
  });
});
document.addEventListener("sabot:assurance-fin", e => {
  const { siege: si, main: hi, toi, gagne, montant } = e.detail; const st = T.sieges[si], h = st && st.mains[hi];
  if (!h || !h.assurance || h.jAssurancePartie) return;
  const mise = h.assurance; h.jAssurancePartie = true; rendre(st, mise, arr(mise + montant));
  enfiler(() => {
    garnirCercles(); const ce = ancreCercle(si);
    if (gagne) glisser(montant, ancreCroupier(), ce, { apparait: true, fin: () => { glisser(arr(mise + montant), ce, ancreMaison(si), { fondu: !toi }); if (toi) { lueur(si); son("jetons"); } } });
    else glisser(mise, ce, ancreCroupier(), { fondu: true });
  });
});
document.addEventListener("sabot:manche-fin", () => {
  J.phase = "reglement"; $("v-table").dataset.phase = "reglement"; rendreCoach();
  const d = J.attente + 1150; J.attente = 0;
  setTimeout(() => { if (!T.enJeu && !T.occupe) ouvrirMises(); }, reduit() ? 80 : d);
});
document.addEventListener("sabot:remelange", e => {
  son("raclement");
  if (e.detail.pendantDonne) return;
  // Sabot neuf, sièges neufs : les voisins reçoivent un profil, la phase de mise s'ouvre.
  T.sieges.forEach(st => (st.mains || []).forEach(h => { h.jParti = true; }));
  ouvrirMises();
});
document.addEventListener("sabot:table", () => { rendreRack(); majDonne(); });
rendreRack(); rendreTapis();
