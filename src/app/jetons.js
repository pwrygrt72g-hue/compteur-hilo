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
  { v: 100,  cls: "v100",  face: "#1D1D22", marque: "#E7D9AE", texte: "#1D1D22" },
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
</defs></svg>`;
document.body.insertAdjacentHTML("afterbegin", JETONOTHEQUE);

const jetonDe = v => JETONS.find(x => x.v === v) || JETONS[0];
function jetonSvg(v) {
  const j = jetonDe(v), txt = v === 2.5 ? "2,50" : String(v);
  const fs = txt.length >= 4 ? 19 : txt.length === 3 ? 25 : 30;
  return `<svg class="jt-svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
<circle cx="50" cy="50" r="49" fill="${j.face}"/>
<use href="#jt-marques" fill="${j.marque}"/>
<circle cx="50" cy="50" r="49" fill="url(#jt-bombe)"/>
<circle cx="50" cy="50" r="40.5" fill="none" stroke="${j.marque}" stroke-opacity=".5" stroke-width="1.1"/>
<circle cx="50" cy="50" r="33" fill="none" stroke="${j.marque}" stroke-width="2"/>
<circle cx="50" cy="50" r="29.5" fill="#F7F2E5"/>
<circle cx="50" cy="50" r="29.5" fill="url(#jt-inlay)"/>
<text x="50" y="50.5" text-anchor="middle" dominant-baseline="central" font-size="${fs}" fill="${j.texte}">${txt}</text>
<circle cx="50" cy="50" r="49" fill="url(#jt-relief)"/>
<circle cx="50" cy="50" r="48.6" fill="none" stroke="#000" stroke-opacity=".45" stroke-width="1"/>
</svg>`;
}
const JT_GABARIT = document.createElement("template");
function jetonEl(v, w, tag) {
  const b = tag || "div";
  JT_GABARIT.innerHTML = `<${b} class="jt ${jetonDe(v).cls}" data-v="${v}"${w ? ` style="--w:${w}px"` : ""}>${jetonSvg(v)}</${b}>`;
  return JT_GABARIT.content.firstElementChild.cloneNode(true);
}
// Une pile : le plus gros jeton en bas, coupée par huit comme un croupier coupe
// ses piles — 12 000 au Salon Privé fait deux colonnes, pas une tour.
function pileEl(montant, w) {
  const js = decoupe(montant).sort((a, b) => b - a), tas = document.createElement("div");
  tas.className = "jt-tas"; tas.style.setProperty("--w", (w || 40) + "px");
  for (let i = 0; i < js.length; i += 8) {
    const col = js.slice(i, i + 8), p = document.createElement("div"); p.className = "jt-pile";
    p.style.setProperty("--n", col.length);
    col.forEach((v, k) => { const e = jetonEl(v); e.style.setProperty("--i", k); p.appendChild(e); });
    tas.appendChild(p);
  }
  return tas;
}

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

/* ── Les ancres : tout en coordonnées de la salle (#jetonsCalque la couvre) ── */
const salleRect = () => $("salle").getBoundingClientRect();
function centre(el) { const s = salleRect(), r = el.getBoundingClientRect(); return { x: r.left + r.width / 2 - s.left, y: r.top + r.height / 2 - s.top }; }
const ancreCercle = si => { const e = $("cercle_" + si); return e ? centre(e) : { x: salleRect().width / 2, y: salleRect().height * .8 }; };
const ancreCroupier = () => { const e = $("rack"); return e && e.offsetWidth ? centre(e) : { x: salleRect().width / 2, y: 30 }; };
// Le rack fermé est sous le rail : les jetons en partent (ou y rentrent) par le bas.
const ancreRack = v => { const b = $("rjJetons").querySelector(`[data-v="${v}"]`) || $("rjJetons"); const c = centre(b); if (!$("rackJetons").classList.contains("ouvert")) c.y = salleRect().height + 40; return c; };
// « Chez soi » : ton rack pour toi ; pour un voisin, le rail juste sous son nom.
const ancreMaison = si => { const st = T.sieges[si]; if (st && st.toi) return ancreRack(25); const c = ancreCercle(si); return { x: c.x, y: c.y + 72 }; };

/* ── Le vol : un clone dans le calque, le VRAI état est rendu à l'arrivée ──
   Deux animations : le porteur suit la ligne droite, le jeton dessus décrit
   l'arc (il monte, tourne, grossit) pendant que son ombre reste sur le feutre
   et s'éloigne. Sous prefers-reduced-motion, tout se pose en une milliseconde. */
function vol(o) {
  const calque = $("jetonsCalque"), invisible = $("v-table").hidden || salleRect().width < 50;
  const dur = invisible || reduit() ? 1 : (o.duree || 400);
  const w = o.w || (o.montant !== undefined ? 40 : 44);
  const porte = document.createElement("div"); porte.className = "jt-vol"; porte.style.setProperty("--w", w + "px");
  const ombre = document.createElement("i"); ombre.className = "jt-ombre";
  const corps = o.montant !== undefined ? pileEl(o.montant, w) : jetonEl(o.v, w);
  porte.append(ombre, corps); calque.appendChild(porte);
  const dx = o.vers.x - o.depuis.x, dy = o.vers.y - o.depuis.y;
  porte.style.left = (o.depuis.x - w / 2) + "px"; porte.style.top = (o.depuis.y - w / 2) + "px";
  const ease = o.glisse ? "cubic-bezier(.3,0,.2,1)" : "cubic-bezier(.22,.72,.24,1)";
  // fondu : s'efface en arrivant (vers le croupier, ou hors de la table) ;
  // apparait : surgit en partant (les jetons d'un voisin viennent de son rail, hors champ).
  const trajet = o.fondu
    ? [{ transform: "translate(0,0)", opacity: 1 }, { transform: `translate(${dx * .72}px,${dy * .72}px)`, opacity: 1, offset: .72 }, { transform: `translate(${dx}px,${dy}px)`, opacity: 0 }]
    : o.apparait
    ? [{ transform: "translate(0,0)", opacity: 0 }, { transform: `translate(${dx * .3}px,${dy * .3}px)`, opacity: 1, offset: .3 }, { transform: `translate(${dx}px,${dy}px)`, opacity: 1 }]
    : [{ transform: "translate(0,0)" }, { transform: `translate(${dx}px,${dy}px)` }];
  const a = porte.animate(trajet, { duration: dur, easing: ease, fill: "forwards" });
  if (!o.glisse) {
    corps.animate([{ transform: "translateY(0) rotate(0deg) scale(1)" }, { transform: "translateY(-30px) rotate(200deg) scale(1.14)", offset: .5 }, { transform: "translateY(0) rotate(360deg) scale(1)" }],
      { duration: dur, easing: "ease-in-out", fill: "forwards" });
    ombre.animate([{ transform: "scale(1)", opacity: .55 }, { transform: "scale(.6)", opacity: .2, offset: .5 }, { transform: "scale(1)", opacity: .55 }], { duration: dur, fill: "forwards" });
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
    ce.querySelectorAll(".jt-mises").forEach(x => x.remove());
    const parts = misesVisibles(st);
    ce.classList.toggle("garni", parts.length > 0);
    if (!parts.length) return;
    const box = document.createElement("div"); box.className = "jt-mises";
    parts.forEach(m => box.appendChild(pileEl(m, st.toi ? 40 : 36)));
    ce.appendChild(box);
  });
}
document.addEventListener("sabot:sieges", () => { detecterSeparations(); garnirCercles(); });

/* ── Le rack : tes jetons, sur le rail devant toi ────────────────────────── */
function rendreRack() {
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
  $("rjTapis").textContent = fmtJ(DB.tapis);
  $("rjLimites").textContent = `min ${fmtJ(l.min)} · max ${fmtJ(l.max)}`;
  $("rjMise").textContent = fmtJ(J.mise);
  const u = J.mise / l.min;
  $("rjUnites").textContent = J.mise ? `${fr1(u)} unité${u > 1 ? "s" : ""}` : (DB.tapis >= l.min ? "pose ta mise" : "—");
  $("bRetirer").disabled = !ouvert || !J.poses.length;
  $("bRachat").hidden = !(ouvert && DB.tapis < l.min && J.mise === 0);
  r.classList.toggle("ouvert", ouvert);
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
  engager(T.toi, v); J.mise = arr(J.mise + v); J.poses.push(v); T.toi.mise = T.mise = J.mise;
  rendreRack(); majDonne();
  vol({ v, w: 40, depuis, vers: ancreCercle(si), fin: () => { if (J.phase !== "mise") return; T.toi.miseVue = Math.min(J.mise, arr((T.toi.miseVue || 0) + v)); garnirCercles(); son("jetons"); } });
}
function retirerJeton() {
  if (J.phase !== "mise" || !J.poses.length || !T.toi) return;
  const v = J.poses.pop(), si = T.sieges.indexOf(T.toi);
  J.mise = arr(J.mise - v); T.toi.mise = T.mise = J.mise; T.toi.miseVue = Math.min(T.toi.miseVue || 0, J.mise);
  rendre(T.toi, v, v); garnirCercles(); rendreRack(); majDonne();
  vol({ v, w: 40, depuis: ancreCercle(si), vers: ancreRack(v), fin: () => son("jetons") });
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

/* ── La phase de mise ────────────────────────────────────────────────────── */
function ouvrirMises() {
  if (T.enJeu || T.occupe) return;
  // Ce qui traînait encore sur le feutre revient en main (main interrompue, table changée).
  if (DB.engage > 0) { DB.tapis = arr(DB.tapis + DB.engage); DB.engage = 0; garder(); }
  J.phase = "mise"; J.donnee = false; J.mise = 0; J.poses = []; J.attente = 0; T.mise = 0; T.miseDonne = 0;
  $("v-table").dataset.phase = "mise";
  T.sieges.forEach(st => { st.mise = 0; st.miseVue = 0; (st.mains || []).forEach(h => { h.jParti = true; }); });
  profilerSieges(); garnirCercles(); rendreRack(); majDonne(); rendreCoach();
  const l = limites();
  T.sieges.forEach((st, si) => {
    if (st.toi) return;
    const m = miseBot(st); st.mise = m; engager(st, m);
    setTimeout(() => { if (J.phase !== "mise" || T.sieges[si] !== st) return;
      vol({ montant: m, w: 36, depuis: ancreMaison(si), vers: ancreCercle(si), duree: 380, apparait: true, fin: () => { if (J.phase === "mise" && T.sieges[si] === st) { st.miseVue = m; garnirCercles(); } } });
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
function rendreCoach() {
  const c = $("coachMise"), l = limites();
  if (J.phase === "mise" || J.phase === "attente" || !T.miseDonne) { c.innerHTML = ""; return; }
  const u = T.miseDonne / l.min;
  let h = `Mise ${fmtJ(T.miseDonne)} · ${fr1(u)} unité${u > 1 ? "s" : ""}`;
  if (T.montre && typeof T.tcMise === "number") { const { ok, ref } = coherence(u, T.tcMise);
    h += ` · compte vrai ${T.tcMise > 0 ? "+" : ""}${fr1(T.tcMise)} → <b class="${ok ? "ok" : "ko"}">${ok ? "cohérent" : "incohérent, la rampe dit " + ref}</b>`; }
  c.innerHTML = h;
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
document.addEventListener("sabot:donne-debut", () => {
  fermerMises(); J.donnee = true;
  T.sieges.forEach(st => st.mains.forEach(h => { h.jEngage = true; h.jVu = true; }));
  garnirCercles(); rendreRack(); rendreCoach();
});
// Une main née d'une séparation : une seconde mise part de chez son propriétaire.
function detecterSeparations() {
  if (J.phase !== "jeu") return;
  T.sieges.forEach((st, si) => st.mains.forEach(h => {
    if (h.jEngage || !h.fromSplit) return;
    h.jEngage = true; engager(st, h.bet); rendreRack();
    vol({ montant: h.bet, w: st.toi ? 40 : 36, depuis: ancreMaison(si), vers: ancreCercle(si), duree: 360, apparait: !st.toi,
      fin: () => { h.jVu = true; garnirCercles(); if (st.toi) son("jetons"); } });
  }));
}
// Un doublement : la carte arrive, la seconde mise aussi.
document.addEventListener("sabot:carte", e => {
  const { siege: si, main: hi } = e.detail; if (si === "croupier" || J.phase !== "jeu") return;
  const st = T.sieges[si], h = st && st.mains[hi]; if (!h || !h.doubled || h.jDouble || !h.jEngage) return;
  h.jDouble = true; engager(st, h.bet); rendreRack();
  vol({ montant: h.bet, w: st.toi ? 40 : 36, depuis: ancreMaison(si), vers: ancreCercle(si), duree: 360, apparait: !st.toi,
    fin: () => { h.jDoubleVu = true; garnirCercles(); if (st.toi) son("jetons"); } });
});
// L'assurance : payable ou pas, puis posée à côté de la mise.
document.addEventListener("sabot:assurance-offre", e => { if (e.detail.toi && DB.tapis < e.detail.cout) { e.detail.possible = false; bandeau("Le croupier montre un as — tu n'as pas de quoi t'assurer."); } });
document.addEventListener("sabot:assurance", e => {
  const { siege: si, main: hi, prise, montant } = e.detail; const st = T.sieges[si], h = st && st.mains[hi];
  if (!prise || !h || !montant) return;
  engager(st, montant); rendreRack();
  vol({ montant, w: 36, depuis: ancreMaison(si), vers: ancreCercle(si), duree: 360, apparait: !st.toi, fin: () => { h.jAssuranceVu = true; garnirCercles(); son("jetons"); } });
});

/* ── Le règlement : les gains glissent vers toi, les pertes vers le croupier ──
   regler() émet les main-fin dans l'ordre des sièges, d'un coup ; on les
   ESPACE (140 ms) pour que le croupier paie une place après l'autre. Un bust
   arrive à l'instant, seul : il part tout de suite. */
function enfiler(fn) { const d = reduit() ? 0 : J.attente; J.attente += 140; setTimeout(fn, d); }
function glisser(montant, depuis, vers, o) { return vol(Object.assign({ montant, w: 38, depuis, vers, glisse: true, duree: 520 }, o || {})); }
document.addEventListener("sabot:main-fin", e => {
  const { siege: si, main: hi, toi, issue, montant } = e.detail;
  const st = T.sieges[si], h = st && st.mains[hi]; if (!h || h.jRegle) return; h.jRegle = true;
  const engage = h.bet * (h.doubled ? 2 : 1), retour = arr(engage + montant);
  rendre(st, engage, retour);
  if (!toi) st.dernierNet = montant;
  enfiler(() => {
    h.jParti = true; garnirCercles();
    const ce = ancreCercle(si), croupier = ancreCroupier(), maison = ancreMaison(si);
    if (issue === "bust" || issue === "perd") glisser(engage, ce, croupier, { fondu: true });
    else if (issue === "abandon") { glisser(engage / 2, ce, croupier, { fondu: true }); glisser(retour, ce, maison, { fondu: !toi }); }
    else if (issue === "egalite") glisser(engage, ce, maison, { fondu: !toi });
    else {  // gagne · blackjack : le croupier paie devant le cercle, puis tout part chez le joueur
      glisser(montant, croupier, ce, { fin: () => { if (toi) { lueur(si); son("jetons"); }
        glisser(retour, ce, maison, { fondu: !toi, duree: 460, fin: () => { if (toi) rendreTapis(); } }); } });
      return;
    }
    if (toi) { rendreTapis(); son("jetons"); }
  });
});
document.addEventListener("sabot:assurance-fin", e => {
  const { siege: si, main: hi, toi, gagne, montant } = e.detail; const st = T.sieges[si], h = st && st.mains[hi];
  if (!h || !h.assurance || h.jAssurancePartie) return;
  const mise = h.assurance; h.jAssurancePartie = true; rendre(st, mise, arr(mise + montant));
  enfiler(() => {
    garnirCercles(); const ce = ancreCercle(si);
    if (gagne) glisser(montant, ancreCroupier(), ce, { fin: () => { glisser(arr(mise + montant), ce, ancreMaison(si), { fondu: !toi }); if (toi) { lueur(si); son("jetons"); } } });
    else glisser(mise, ce, ancreCroupier(), { fondu: true });
  });
});
document.addEventListener("sabot:manche-fin", () => {
  J.phase = "reglement"; $("v-table").dataset.phase = "reglement"; rendreTapis(); rendreCoach();
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
