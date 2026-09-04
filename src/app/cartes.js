/* ══════════════════════ CARTES ══════════════════════
   LES CARTES — le dessin des faces, des figures et des dos (lot Cartes).
   Concaténé entre socle.js et salon.js : il peut se servir de tout ce que
   socle.js définit, et ce que le salon et la table utilisent doit être défini ici.

   UNE SEULE fabrique de carte dans toute l'application : carteHtml(c, opts).
   Tout ce qui pose une carte à l'écran (table, exercices, stratégie,
   concentration, multijoueur, éventail d'accueil) passe par carteEl(), qui
   n'est qu'un emballage autour de carteHtml(). Aucune logique de jeu ici :
   rg() reste la seule passerelle vers le comptage, et une carte dessinée ne
   sait pas ce qu'elle vaut.

   La carte est un SVG en ligne dans un viewBox de 100 × 140 : tout est en
   unités de carte, la largeur réelle (--w) ne change rien au dessin. Les
   enseignes et les figures vivent dans un sprite <defs> posé une fois dans le
   <body> (#cartotheque) ; chaque carte y renvoie par <use>. Le fond ivoire, la
   texture, l'ombre et le dos sont en CSS (section « Les cartes » de style.css).

   Ce qu'une VRAIE carte a et qu'un rectangle n'a pas :
   · les indices dans DEUX coins, celui du bas RETOURNÉ (la carte se lit tenue
     dans les deux sens) — ce n'est pas un bug, c'est ce qu'on voit sur toutes
     les cartes depuis deux siècles ;
   · les pips disposés comme sur une carte de casino (le 7 a son pip
     surnuméraire entre les deux premiers rangs, le 9 et le 10 changent de
     squelette), ceux de la moitié basse retournés ;
   · des figures MIROIR : on ne dessine que la moitié haute, la moitié basse
     est la même tournée de 180°. Trois masses de couleur reconnaissables à
     60 px : Roi rouge et or, Dame bleu nuit et or, Valet mi-rouge mi-bleu.
   ═══════════════════════════════════════════════════════════════════ */

/* ── Le sprite : enseignes, figures, une fois pour toutes ─────────────── */
const CARTES_SUITES = { "♠": "S", "♥": "H", "♦": "D", "♣": "C" };
const CARTES_NOMS = { S: "pique", H: "cœur", D: "carreau", C: "trèfle" };
const CARTES_RANGS_NOMS = { A: "as", V: "valet", D: "dame", R: "roi" };
// Les quatre couleurs des figures : or, rouge, bleu nuit, ivoire — et l'encre du trait.
const CF = { or: "#D4AF37", rouge: "#A8281C", bleu: "#1B2A4E", ivoire: "#F6F1E4", encre: "#141110" };

const CARTOTHEQUE = `<svg id="cartotheque" width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute;left:-1px;top:-1px;overflow:hidden"><defs>
<symbol id="s-S" viewBox="0 0 100 100"><path d="M50 5C50 5 14 34 14 55c0 14 10 24 22 24 6 0 11-3 14-8 3 5 8 8 14 8 12 0 22-10 22-24C86 34 50 5 50 5Z"/><path d="M50 62c0 14-5 23-15 31h30c-10-8-15-17-15-31Z"/></symbol>
<symbol id="s-H" viewBox="0 0 100 100"><path d="M50 92C44 84 10 62 10 38c0-15 11-26 25-26 7 0 12 4 15 10 3-6 8-10 15-10 14 0 25 11 25 26 0 24-34 46-40 54Z"/></symbol>
<symbol id="s-D" viewBox="0 0 100 100"><path d="M50 4c10 20 22 34 40 46-18 12-30 26-40 46-10-20-22-34-40-46C28 38 40 24 50 4Z"/></symbol>
<symbol id="s-C" viewBox="0 0 100 100"><circle cx="50" cy="30" r="19.5"/><circle cx="29.5" cy="59" r="19.5"/><circle cx="70.5" cy="59" r="19.5"/><circle cx="50" cy="54" r="12"/><path d="M50 50c0 16-4 30-14 44h28c-10-14-14-28-14-44Z"/></symbol>
<!-- Les figures : la moitié HAUTE seulement, dans le cadre x 17→83, y 26→70.
     La moitié basse est <use> tournée de 180° autour du centre (50,70). -->
<g id="f-R">
  <path fill="${CF.rouge}" d="M17 70l5-10c8-6 17-9 28-9s20 3 28 9l5 10Z"/>
  <path fill="${CF.bleu}" d="M17 70l5-10 8.5 4-4.5 6Zm66 0l-5-10-8.5 4 4.5 6Z"/>
  <path fill="${CF.or}" d="M30 67l20-7.5 20 7.5v3l-20-7.5-20 7.5Z"/>
  <path fill="${CF.ivoire}" stroke="${CF.encre}" stroke-width="1" d="M38.5 55.5l11.5 8 11.5-8v5.5l-11.5 8-11.5-8Z"/>
  <ellipse cx="50" cy="46" rx="10.5" ry="11" fill="${CF.ivoire}" stroke="${CF.encre}" stroke-width="1.1"/>
  <path fill="${CF.encre}" d="M39.5 45c-1-9 4-14 10.5-14s11.5 5 10.5 14c-1-5-4.5-7.5-10.5-7.5S40.5 40 39.5 45Z"/>
  <path fill="${CF.encre}" d="M40 49c1 9 5 13 10 13s9-4 10-13c1 9-3 16-10 16s-11-7-10-16Z"/>
  <path fill="${CF.encre}" d="M44.5 50.8c2-1.6 9-1.6 11 0-2 1-9 1-11 0Z"/>
  <circle cx="46.2" cy="46" r="1.25" fill="${CF.encre}"/><circle cx="53.8" cy="46" r="1.25" fill="${CF.encre}"/>
  <path stroke="${CF.encre}" stroke-width="1" fill="none" stroke-linecap="round" d="M44 43.2q2.2-1.4 4.4-.2M51.6 43q2.2-1.2 4.4.2M50 45.5v3.5"/>
  <path fill="${CF.or}" stroke="${CF.encre}" stroke-width=".9" stroke-linejoin="round" d="M39 34.5l2-8.5 4.5 5.5 4.5-8 4.5 8 4.5-5.5 2 8.5Z"/>
  <rect x="38.5" y="33" width="23" height="4.2" rx=".8" fill="${CF.or}" stroke="${CF.encre}" stroke-width=".9"/>
  <circle cx="50" cy="35.1" r="1.3" fill="${CF.rouge}"/><circle cx="44" cy="35.1" r="1" fill="${CF.bleu}"/><circle cx="56" cy="35.1" r="1" fill="${CF.bleu}"/>
  <path fill="${CF.ivoire}" stroke="${CF.encre}" stroke-width=".8" d="M75 34l2-7 2 7v24h-4Z"/>
  <rect x="71" y="58" width="12" height="3" rx="1" fill="${CF.or}" stroke="${CF.encre}" stroke-width=".8"/>
  <rect x="76" y="61" width="2" height="5" fill="${CF.encre}"/>
  <circle cx="77" cy="65" r="3.4" fill="${CF.ivoire}" stroke="${CF.encre}" stroke-width=".9"/>
</g>
<g id="f-D">
  <path fill="${CF.bleu}" d="M17 70l5-10c8-6 17-9 28-9s20 3 28 9l5 10Z"/>
  <path fill="${CF.or}" d="M27 64c6-5 14-8 23-8s17 3 23 8l-1.5 2.6C65 62 58 60 50 60s-15 2-21.5 6.6Z"/>
  <path fill="${CF.ivoire}" stroke="${CF.encre}" stroke-width="1" d="M39 55.5l11 7.5 11-7.5v5l-11 7.5-11-7.5Z"/>
  <circle cx="50" cy="65" r="1.7" fill="${CF.or}" stroke="${CF.encre}" stroke-width=".6"/>
  <path fill="${CF.encre}" d="M38.5 46c-1-10 4.5-15 11.5-15s12.5 5 11.5 15l3.5 18c-4-4-9.5-6-15-6s-11 2-15 6Z"/>
  <ellipse cx="50" cy="46" rx="10.2" ry="10.8" fill="${CF.ivoire}" stroke="${CF.encre}" stroke-width="1.1"/>
  <path fill="${CF.encre}" d="M39.8 45c-1-8.5 4-13.5 10.2-13.5s11.2 5 10.2 13.5c-1-5-4.5-7.5-10.2-7.5S40.8 40 39.8 45Z"/>
  <circle cx="46.2" cy="46" r="1.25" fill="${CF.encre}"/><circle cx="53.8" cy="46" r="1.25" fill="${CF.encre}"/>
  <path stroke="${CF.encre}" stroke-width=".9" fill="none" stroke-linecap="round" d="M44 43.2q2.2-1.4 4.4-.2M51.6 43q2.2-1.2 4.4.2M50 45.5v3.5"/>
  <path stroke="${CF.rouge}" stroke-width="1.2" fill="none" stroke-linecap="round" d="M47.6 52q2.4 1.6 4.8 0"/>
  <path fill="${CF.or}" stroke="${CF.encre}" stroke-width=".9" stroke-linejoin="round" d="M41 33l2.5-7.5 4.5 4.5 2-6.5 2 6.5 4.5-4.5 2.5 7.5Z"/>
  <rect x="40.5" y="32" width="19" height="3.4" rx=".8" fill="${CF.or}" stroke="${CF.encre}" stroke-width=".9"/>
  <circle cx="50" cy="26.8" r="1.2" fill="${CF.ivoire}" stroke="${CF.encre}" stroke-width=".6"/>
  <path stroke="${CF.encre}" stroke-width="1.2" fill="none" d="M72.5 47c-1 5-2 10-3.5 16"/>
  <circle cx="72.5" cy="38" r="2.9" fill="${CF.rouge}"/><circle cx="68.7" cy="40.8" r="2.9" fill="${CF.rouge}"/><circle cx="76.3" cy="40.8" r="2.9" fill="${CF.rouge}"/><circle cx="70.1" cy="45.2" r="2.9" fill="${CF.rouge}"/><circle cx="74.9" cy="45.2" r="2.9" fill="${CF.rouge}"/>
  <circle cx="72.5" cy="42" r="2" fill="${CF.or}"/>
  <circle cx="69" cy="64.5" r="3.4" fill="${CF.ivoire}" stroke="${CF.encre}" stroke-width=".9"/>
</g>
<g id="f-V">
  <path fill="${CF.rouge}" d="M17 70l5-10c8-6 17-9 28-9v19Z"/>
  <path fill="${CF.bleu}" d="M83 70l-5-10c-8-6-17-9-28-9v19Z"/>
  <rect x="24" y="64.5" width="52" height="3.4" fill="${CF.or}" stroke="${CF.encre}" stroke-width=".7"/>
  <path fill="${CF.ivoire}" stroke="${CF.encre}" stroke-width="1" d="M39 55l11 7.5 11-7.5v5l-11 7.5-11-7.5Z"/>
  <ellipse cx="50" cy="46" rx="10.2" ry="10.8" fill="${CF.ivoire}" stroke="${CF.encre}" stroke-width="1.1"/>
  <path fill="${CF.encre}" d="M39.8 45c-1-8.5 4-13.5 10.2-13.5s11.2 5 10.2 13.5c-1-5-4.5-7.5-10.2-7.5S40.8 40 39.8 45Z"/>
  <circle cx="46.2" cy="46" r="1.25" fill="${CF.encre}"/><circle cx="53.8" cy="46" r="1.25" fill="${CF.encre}"/>
  <path stroke="${CF.encre}" stroke-width=".9" fill="none" stroke-linecap="round" d="M44 43.2q2.2-1.4 4.4-.2M51.6 43q2.2-1.2 4.4.2M50 45.5v3.5M47.5 52q2.5 1.6 5 0"/>
  <path fill="${CF.bleu}" stroke="${CF.encre}" stroke-width=".9" stroke-linejoin="round" d="M39 37.5c0-8 5-11.5 11-11.5l14-2.5-2.5 5.5-2 8.5Z"/>
  <path fill="${CF.or}" stroke="${CF.encre}" stroke-width=".7" d="M61.5 27.5c5-8 11-10 18-8-6 2-10 6-14 12Z"/>
  <rect x="74" y="31" width="2.6" height="37" fill="${CF.encre}"/>
  <path fill="${CF.ivoire}" stroke="${CF.encre}" stroke-width=".8" d="M73.6 31l1.7-6.5 1.7 6.5Z"/>
  <path fill="${CF.or}" stroke="${CF.encre}" stroke-width=".8" d="M76.6 35c6 2 8 8 6 14l-6-2Z"/>
  <circle cx="75.3" cy="63.5" r="3.4" fill="${CF.ivoire}" stroke="${CF.encre}" stroke-width=".9"/>
</g>
</defs></svg>`;
document.body.insertAdjacentHTML("afterbegin", CARTOTHEQUE);

/* ── Les pips, 2 à 10 : la vraie disposition ────────────────────────────
   x : 0 gauche · 1 centre · 2 droite — y : fraction du champ, 0 en haut.
   Un pip dont le centre est sous la moitié est RETOURNÉ (fy > .5). */
const T3 = 1 / 3, D3 = 2 / 3;
const PIPS = {
  "2": [[1, 0], [1, 1]],
  "3": [[1, 0], [1, .5], [1, 1]],
  "4": [[0, 0], [2, 0], [0, 1], [2, 1]],
  "5": [[0, 0], [2, 0], [1, .5], [0, 1], [2, 1]],
  "6": [[0, 0], [2, 0], [0, .5], [2, .5], [0, 1], [2, 1]],
  "7": [[0, 0], [2, 0], [1, .25], [0, .5], [2, .5], [0, 1], [2, 1]],
  "8": [[0, 0], [2, 0], [1, .25], [0, .5], [2, .5], [1, .75], [0, 1], [2, 1]],
  "9": [[0, 0], [2, 0], [0, T3], [2, T3], [1, .5], [0, D3], [2, D3], [0, 1], [2, 1]],
  "10": [[0, 0], [2, 0], [1, 1 / 6], [0, T3], [2, T3], [0, D3], [2, D3], [1, 5 / 6], [0, 1], [2, 1]],
};
const PIP_X = [31, 50, 69];          // les trois colonnes, en unités de carte
const PIP_HAUT = 36, PIP_BAS = 104;  // le champ, sous l'indice du haut et au-dessus de celui du bas

const pipUse = (s, x, y, taille, retourne) =>
  `<use href="#s-${s}" x="${(x - taille / 2).toFixed(1)}" y="${(y - taille / 2).toFixed(1)}" width="${taille}" height="${taille}"${retourne ? ` transform="rotate(180 ${x} ${y})"` : ""}/>`;

function champPips(r, s) {
  if (r === "A") return pipUse(s, 50, 70, 44, false);
  if (r === "V" || r === "D" || r === "R") return champFigure(r, s);
  const p = PIPS[r]; if (!p) return "";
  const taille = r === "10" || r === "9" ? 19 : 21;
  return p.map(([cx, fy]) => pipUse(s, PIP_X[cx], PIP_HAUT + fy * (PIP_BAS - PIP_HAUT), taille, fy > .5)).join("");
}
// Le cadre de la figure prend la couleur de l'enseigne (currentColor) : un Roi
// de cœur et un Roi de pique partagent le même dessin, seul le cadre change —
// exactement le procédé des jeux imprimés. Le clip est propre à chaque carte
// (id unique) : un url(#id) partagé se résout sur la PREMIÈRE carte du
// document et casse dès qu'elle est retirée.
let CARTES_SEQ = 0;
function champFigure(r, s) {
  const id = "cf" + (++CARTES_SEQ);
  return `<clipPath id="${id}"><rect x="17.5" y="26.5" width="65" height="87" rx="2"/></clipPath>` +
    `<rect x="17" y="26" width="66" height="88" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.2"/>` +
    `<g clip-path="url(#${id})"><use href="#f-${r}"/><use href="#f-${r}" transform="rotate(180 50 70)"/></g>` +
    `<path d="M17 70h66" stroke="currentColor" stroke-width=".8"/>` +
    pipUse(s, 23.5, 33, 9, false) + pipUse(s, 76.5, 107, 9, true);
}
// L'indice du coin : le rang au-dessus, l'enseigne dessous. Le « 10 » est plus
// étroit, comme sur les vraies cartes, pour tenir dans la même colonne.
function coin(r, s) {
  const dix = r === "10";
  return `<g class="coin"><text x="11.5" y="21.5" text-anchor="middle"${dix ? ` font-size="15" textLength="17" lengthAdjust="spacingAndGlyphs"` : ""}>${r}</text>` +
    pipUse(s, 11.5, 31, 13, false) + `</g>`;
}
const carteNom = c => (CARTES_RANGS_NOMS[c.r] || c.r) + " de " + (CARTES_NOMS[CARTES_SUITES[c.suit]] || "");

/* ── La fabrique ───────────────────────────────────────────────────────
   carteHtml(c, opts) → la carte entière, prête à être injectée.
     c    : { r, i, suit, col } (le format de sabotNeuf)
     opts : { dos:true }  → un DOS, face contre table, qui pourra être retourné
            { classe }    → classes en plus
   Une face cachée ne contient PAS son dessin : il est posé au retournement.
   Ce n'est pas du zèle, c'est ce qui empêche de lire la carte dans le DOM. */
function faceSvg(c) {
  const s = CARTES_SUITES[c.suit] || "S";
  return `<svg class="face-svg" viewBox="0 0 100 140" aria-hidden="true" focusable="false">` +
    coin(c.r, s) + `<g transform="rotate(180 50 70)">` + coin(c.r, s) + `</g>` + champPips(c.r, s) + `</svg>`;
}
function carteHtml(c, opts) {
  opts = opts || {};
  const classes = ["carte"];
  if (opts.classe) classes.push(opts.classe);
  if (opts.dos) {
    classes.push("carte--pivot", "cachee");
    return `<div class="${classes.join(" ")}" role="img" aria-label="carte face cachée"><div class="pivot"><div class="face av"></div><div class="face ar"></div></div></div>`;
  }
  if (c.col === "r") classes.push("rouge");
  return `<div class="${classes.join(" ")}" role="img" aria-label="${echap(carteNom(c))}" data-r="${echap(c.r)}" data-s="${CARTES_SUITES[c.suit] || ""}">${faceSvg(c)}</div>`;
}
const CARTE_GABARIT = document.createElement("template");
function carteEl(c, dos) {
  CARTE_GABARIT.innerHTML = carteHtml(c, { dos: !!dos });
  return CARTE_GABARIT.content.firstElementChild.cloneNode(true);
}
/* Retourner une carte posée face contre table : on dessine la face à ce
   moment-là, puis on laisse la transition CSS tourner le pivot. La perspective
   est DANS le transform du pivot, jamais sur .main : posée sur le parent, elle
   met le point de fuite au centre de la main et déforme les cartes voisines. */
function retournerCarte(el, c) {
  if (!el || !el.classList.contains("carte--pivot")) return;
  const av = el.querySelector(".face.av");
  if (av && !av.firstElementChild) av.innerHTML = faceSvg(c);
  el.classList.toggle("rouge", c.col === "r");
  el.setAttribute("aria-label", carteNom(c)); el.dataset.r = c.r; el.dataset.s = CARTES_SUITES[c.suit] || "";
  // La main du croupier arrive sur la carte à 240 ms (croupier.js) : la carte
  // pivote SOUS elle, pas avant qu'elle l'ait touchée.
  // La tranche (90°) doit tomber sur le coup de poignet du croupier (250 ms) : départ à
  // 240 ms, 420 ms en ease-in-out (style.css) → la tranche passe vers 450 ms, juste après.
  if (matchMedia("(prefers-reduced-motion:reduce)").matches) el.classList.remove("cachee");
  else setTimeout(() => el.classList.remove("cachee"), 240);
}
document.addEventListener("sabot:croupier-revele", e => retournerCarte(e.detail.el, e.detail.carte));

/* ── La largeur des cartes de la table : UN calcul, pas dix clamp() ──────
   Le siège a droit à sa part de la largeur (ou, sur téléphone, à la largeur
   fixe que le CSS lui donne) ; la carte y tient à plat, et une main serrée se
   RESSERRE en éventail (--pas = ce qu'on voit de chaque carte) plutôt que de
   déborder. Deux mains de quatre cartes dans un siège de 200 px ne demandent
   pas 316 px : elles se recouvrent. Posé sur chaque .main en ligne, donc
   au-dessus de tout ce que la feuille de style dit ; le croupier suit
   --w-table (posé sur le feutre), un peu plus grand que les joueurs. */
/* La courbe RÉELLE du feutre : ses coins bas sont deux quarts d'ellipse dont les
   rayons sont relus dans le border-radius calculé (en px ou en %), jamais
   recopiés. cy = le centre des ellipses ; entre les deux, le bord est droit. */
function courbeFeutre(f, W, H) {
  const v = getComputedStyle(f).borderBottomLeftRadius.split(/\s+/);
  const lire = (t, ref) => t.endsWith("%") ? parseFloat(t) / 100 * ref : parseFloat(t) || 0;
  const rx = Math.min(W / 2, lire(v[0] || "0", W)), ry = Math.min(H, lire(v[1] || v[0] || "0", H));
  const cy = H - ry;
  // y du bord bas du feutre à l'abscisse x (H sur la partie droite).
  const y = x => {
    let cx = null; if (x < rx) cx = rx; else if (x > W - rx) cx = W - rx; else return H;
    const u = (x - cx) / rx; return cy + ry * Math.sqrt(Math.max(0, 1 - u * u));
  };
  return { rx, ry, cy, y };
}
function dimensionnerCartes() {
  const box = $("sieges"); if (!box) return;
  const sieges = [...box.querySelectorAll(".siege")], n = sieges.length; if (!n) return;
  const cs = getComputedStyle(box), H = box.clientHeight;
  const L = box.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  if (L < 80) return;                                  // vue cachée : rien à mesurer
  const pellicule = cs.flexWrap === "nowrap";          // téléphone : les sièges défilent, la largeur de carte reste celle du CSS
  const gap = parseFloat(cs.columnGap) || 12;
  const cercle = box.querySelector(".cercle");
  const chrome = (cercle ? cercle.offsetHeight : 72) + 68;   // score, nom, cercle, marges : tout ce qui n'est pas la carte
  // La carte du croupier suit la HAUTEUR DU FEUTRE (stable), jamais celle des sièges :
  // la rangée haute a sa hauteur d'après cette valeur, et la hauteur des sièges dépend
  // de la rangée haute — une boucle, si on lisait H. 15,5 % : 90 px sur un portable
  // (feutre de 580), 100 sur un grand écran, 66 sur une tablette couchée.
  // Posées sur le PLATEAU (pas seulement le feutre) : le rack du croupier, le sabot, la
  // défausse et les jetons (jetons.js) suivent la même échelle — à 1920 × 1080 tout ce qui
  // était posé sur un feutre de 1456 px restait à l'échelle de 1280.
  const feutre = $("feutre"), plateau = $("plateau"), Hf = feutre ? feutre.clientHeight : 0;
  // Sur un feutre bas (1024 × 768 : 369 px), 19 % ne laissait AUCUN trou entre les
  // cartes du croupier et celles des sièges (mesuré le 05/09 : 371 contre 365) — l'arc
  // doré passait sous les cartes. Le croupier prend un peu moins, l'arc retrouve sa place.
  if (plateau && Hf > 0) plateau.style.setProperty("--w-croupier", Math.max(58, Math.min(106, Math.round(Hf * (Hf < 430 ? .17 : .19)))) + "px");
  // Plus de bande réservée au lettrage : le plafond (62 % de la hauteur d'un siège)
  // laisse la bande de lui-même dès qu'il y a de la place, et sur un écran bas l'arc
  // passe sous les cartes — comme sur une vraie table.
  const wHaut = H > 0 ? Math.max(44, (H - chrome) / 1.4) : 999;
  // Un siège de moins d'un demi-pixel de trop et le dernier passe à la ligne
  // (vécu : le 5ᵉ siège sur une 2ᵉ rangée, remonté de 231 px sur l'arc).
  const partage = Math.min(300, Math.floor((L - gap * (n - 1)) / n - .5));
  // La largeur « de la table » : celle d'une main de deux dans un siège ordinaire.
  // Plafond : une carte ne prend pas plus de 62 % de la hauteur qui lui revient —
  // 84 px sur un portable (1280 × 800), 100 px sur un grand écran (1920 × 1080).
  const plafond = Math.min(100, Math.max(84, (H - chrome) / 1.4 * .62));
  const sBase = (pellicule ? sieges[0].clientWidth : partage) - 12;
  const wTable = Math.max(40, Math.round(Math.min(plafond, wHaut, .62 * sBase)));
  sieges.forEach(s => {
    // Une largeur FIXE par siège : un siège qui passe de 126 à 133 px à sa 2ᵉ carte
    // faisait reculer tous ses voisins de 3 px (mesuré le 04/09).
    if (!pellicule) s.style.width = partage + "px";
    const mains = [...s.querySelectorAll(".main")], h = Math.max(1, mains.length);
    const S = (pellicule ? s.clientWidth : partage) - 12;         // l'intérieur du siège
    const Wmain = (S - (h - 1) * 10) / h;
    const kmax = Math.max(2, ...mains.map(m => m.children.length));
    mains.forEach(m => {
      let w;
      if (pellicule) { m.style.removeProperty("--w"); w = parseFloat(getComputedStyle(m).getPropertyValue("--w")) || 44; }
      // Plein sur une main de deux ; au-delà, on accepte de ne voir que 26 % de chaque
      // carte avant de la rapetisser — c'est ce que fait un croupier qui resserre un jeu.
      else { w = Math.max(40, Math.round(Math.min(wTable, Wmain / (1 + (kmax - 1) * .26)))); m.style.setProperty("--w", w + "px"); }
      const c = m.children.length, pas = c > 1 ? Math.min(.44 * w, (Wmain - w) / (c - 1)) : .44 * w;
      m.style.setProperty("--pas", Math.max(8, pas).toFixed(1) + "px");
    });
  });
  if (plateau) plateau.style.setProperty("--w-table", (pellicule ? Math.round(.62 * sBase) : wTable) + "px");
  if (!pellicule && feutre) placerSieges(box, sieges, feutre);
}
/* Les sièges sur l'ARC. Le rail bas est courbe : un siège du bord posé en rang
   aurait son coin extérieur hors du feutre. Chacun REMONTE (--lift) juste ce qu'il
   faut pour que le coin extérieur bas de son contenu reste sur le feutre, et
   s'incline vers le centre (--tilt, 3,5° par rang, 7° au plus). Tout est mesuré
   HORS transformation (offsetTop/offsetLeft), sinon on mesurerait le résultat. */
function placerSieges(box, sieges, feutre) {
  const W = feutre.clientWidth, H = feutre.clientHeight; if (W < 320 || H < 160) return;
  const cf = courbeFeutre(feutre, W, H), n = sieges.length;
  // La marge au rail : 22 px, mais 38 dans les COINS, où court le lettrage du rail
  // (table.js : baseline à 6 + petit du bord, lettres vers le centre) — mesuré le
  // 05/09, « MARC » se posait sur « HIT SOFT 17 ». Le texte occupe les coins jusqu'à
  // l'angle 126° de l'ellipse, soit x ≈ 0,42 rx du bord.
  const petit = Math.max(11, Math.round(W * .013)), bande = 6 + petit + Math.round(petit * .75) + 6, zone = cf.rx * .42 + 16;
  const marge = x => (x < zone || x > W - zone) ? bande : 22;
  // Chaque PIÈCE du siège est tenue au-dessus de la courbe sur SA largeur : le cercle
  // et le nom, en bas, sont étroits ; les cartes, en haut, sont loin du rail. Mesuré le
  // 05/09 avec la demi-largeur de la boîte (99 px pour 65 de contenu) : les sièges
  // intérieurs remontaient de 33 px et leurs cartes couvraient l'arc doré — pour un
  // rail que seul le cercle, 130 px plus bas, aurait pu toucher. La remontée est
  // prise PAR PAIRE (miroir) : « Marc » 35 px et « Léa » 23 px faisaient 11 px d'écart.
  const wT = parseFloat(getComputedStyle($("plateau")).getPropertyValue("--w-table")) || 84;
  // Le haut d'une pièce dans la boîte des sièges, en sommant les offsetTop jusqu'à elle :
  // un siège transformé peut être ou non l'offsetParent de ses pièces selon le moteur.
  const hautDans = el => { let y = 0; for (let e = el; e && e !== box; e = e.offsetParent) y += e.offsetTop; return y; };
  const lifts = sieges.map(s => {
    const cx = box.offsetLeft + s.offsetLeft + s.offsetWidth / 2;
    let lift = 0;
    s.querySelectorAll(".mains, .cercle, .nom").forEach(p => {
      // Les cartes : une largeur FIXE (un éventail de trois), sinon la 3ᵉ carte déplacerait le siège.
      const demi = (p.classList.contains("mains") ? Math.max(p.offsetWidth, wT * 2.2) : p.offsetWidth) / 2 + 10;
      const bas = box.offsetTop + hautDans(p) + p.offsetHeight;
      const yCourbe = Math.min(cf.y(cx - demi) - marge(cx - demi), cf.y(cx + demi) - marge(cx + demi));
      lift = Math.max(lift, Math.round(bas - yCourbe));
    });
    return lift;
  });
  sieges.forEach((s, i) => {
    const ecart = i - (n - 1) / 2, j = n - 1 - i;
    s.style.setProperty("--lift", -Math.max(lifts[i], lifts[j]) + "px");
    s.style.setProperty("--tilt", (-Math.sign(ecart) * Math.min(7, Math.abs(ecart) * 3.5)).toFixed(1) + "deg");
  });
  // Les sièges viennent de bouger : l'arc doré se place dans le trou qu'ils laissent,
  // et l'observateur du feutre ne voit pas un siège qui remonte. Idempotent (clé).
  if (typeof rendreLettrage === "function") rendreLettrage();
}
if (window.ResizeObserver && $("sieges")) new ResizeObserver(() => dimensionnerCartes()).observe($("sieges"));
