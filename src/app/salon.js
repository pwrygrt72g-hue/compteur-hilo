/* ══════════════════════ LE HALL ══════════════════════
   Le menu est un casino : on ne choisit pas une « vue », on pousse une porte.
   Ce fichier rend les portes des tables (rendreSalon), pose les photos sur les
   portes fixes du hall (rendreHall) et écrit les crédits qui vont avec.
   Il vit AVANT table.js : rien ici ne touche T au chargement — seulement au rendu. */
function chipsRegles(t) {
  const d = DONNEES.tables[t.id];
  const c = [];
  c.push([`${t.jeux} jeu${t.jeux > 1 ? "x" : ""}`, t.jeux <= 2 ? "bien" : ""]);
  c.push([t.h17 ? "H17" : "S17", t.h17 ? "" : "bien"]);
  c.push([t.blackjackPays === 1.5 ? "3:2" : "6:5", t.blackjackPays === 1.5 ? "bien" : "mal"]);
  if (t.melange === "melangeuse_continue") c.push(["mélangeuse continue", "mal"]);
  else c.push([`pén. ${Math.round(t.penetration * 100)} %`, t.penetration >= .75 ? "bien" : t.penetration <= .55 ? "mal" : ""]);
  if (t.das) c.push(["DAS", "bien"]); else c.push(["sans DAS", ""]);
  if (t.surrender !== "none") c.push(["abandon", "bien"]);
  if (!t.holeCard) c.push(["sans carte cachée", "mal"]);
  if (t.doubleOn !== "any") c.push(["doubler " + t.doubleOn.join("-"), ""]);
  return c.map(([l, k]) => `<span class="regle ${k}">${l}</span>`).join("");
}
// Les TROIS puces qu'on garde partout où la place manque (la porte du hall, la barre de
// la table) : le nombre de jeux, H17/S17, 3:2 ou 6:5 — plus la mélangeuse quand il y en
// a une, parce que celle-là tue le comptage. Une seule définition pour les deux écrans.
function pucesCourtes(t) {
  const tmp = document.createElement("div"); tmp.innerHTML = chipsRegles(t);
  const puces = [...tmp.children], garde = puces.slice(0, 3);
  const csm = puces.find(p => /mélangeuse/.test(p.textContent));
  if (csm && !garde.includes(csm)) garde.push(csm);
  return garde.map(p => p.outerHTML).join("");
}
// L'indice de comptabilité : ce que la table laisse VRAIMENT à un compteur.
// La pénétration domine, le paiement du blackjack peut tout annuler.
function indiceComptable(t) {
  if (t.melange === "melangeuse_continue") return 0;
  if (t.blackjackPays < 1.5) return Math.max(0, Math.round(12 - t.jeux));
  const pen = t.penetration, jeux = t.jeux;
  const brut = 100 * (pen - .45) * (1.55 - .06 * jeux);
  return Math.max(4, Math.min(99, Math.round(brut)));
}
// Deux choses seulement tuent le comptage : le blackjack payé 6:5 et la mélangeuse
// continue. Une pénétration médiocre rend la table faible — l'indice le dit déjà,
// et la tamponner « morte » serait un mensonge utile à personne.
function tableMorte(t) {
  if (t.blackjackPays < 1.5) return "Le blackjack payé 6 pour 5 — ne t'assieds pas ici";
  if (t.melange === "melangeuse_continue") return "Mélangeuse continue — le comptage est mort";
  return null;
}
const tamponCourt = t => t.blackjackPays < 1.5 ? "À fuir · 6:5" : "À fuir · mélangeuse";
const photoDe = cle => (window.PHOTOS || {})[cle] || "";
// Le point focal d'une photo qui n'est pas au centre : le Front de Mer, c'est 60 % de ciel
// bleu plat en haut (source 1600 × 900) — cadrée au centre, la porte était un rectangle bleu
// entre deux portes chaudes (les critiques, 05/09). La ville éclairée est en bas.
const PHOTO_POS = { frontdemer: "50% 84%", boulevard: "50% 60%", aquarium: "50% 40%" };
// Un sabot est ENTAMÉ dès qu'une main a été jouée ou qu'une donne est en cours : la
// porte de cette table dit « Reprendre » et ne remélange pas quand on la pousse.
const sabotEntame = () => T.mains > 0 || T.enJeu;

/* ── La porte d'une table : sa photo, son nom en serif, trois puces, deux chiffres.
   o.n = son numéro dans le catalogue · o.reprise = « Reprendre » · o.inerte = un
   simple panneau (l'écran À plusieurs la montre sans qu'on puisse s'y asseoir en solo). */
function carteTableHtml(t, o) {
  o = o || {};
  const d = DONNEES.tables[t.id], mort = tableMorte(t), ph = photoDe(t.id);
  const balise = o.inerte ? "div" : "button";
  const nomAccessible = (o.reprise ? "Reprendre ta place à " : "S'asseoir à ") + t.nom + ", " + t.lieu + (mort ? " — " + mort : "");
  return `<article class="salle-porte ${mort ? "brulee" : ""}" ${mort ? `data-tampon="${echap(mort)}"` : ""}>
    <${balise} class="salle-carte porte" ${o.inerte ? "" : `data-asseoir="${t.id}" aria-label="${echap(nomAccessible)}"`}>
      ${ph ? `<img class="photo" src="${ph}" alt="" aria-hidden="true" loading="lazy" decoding="async"${PHOTO_POS[t.id] ? ` style="--pos:${PHOTO_POS[t.id]}"` : ""}>` : ""}<span class="voile"></span>
      <span class="haut"><span class="num">${o.n ? "Table " + o.n : "Ta table"}</span>${o.reprise ? `<span class="etat">Reprendre</span>` : mort ? `<span class="tampon" title="${echap(mort)}">${tamponCourt(t)}</span>` : ""}</span>
      <span class="bas">
        <span class="lieu">${echap(t.lieu)}</span><span class="nom">${echap(t.nom)}</span>
        <span class="sous">« ${echap(t.lecon)} »</span>
        <span class="regles">${pucesCourtes(t)}</span>
        <span class="chiffres"><span><b>${fr2(d.avantage)} %</b>avantage maison</span><span><b>${fmtJ(t.mise_min)} – ${fmtJ(t.mise_max)}</b>mises</span></span>
      </span>
      ${o.inerte ? "" : `<span class="asseoir-cta" aria-hidden="true">${o.reprise ? "Reprendre" : "S'asseoir"} &rarr;</span>`}
    </${balise}>
    ${o.inerte ? "" : `<button class="pourquoi" data-pourquoi="${t.id}" title="Pourquoi cette table ? La leçon, en détail" aria-label="Pourquoi ${echap(t.nom)} ?"><i>Pourquoi&nbsp;?</i></button>`}
  </article>`;
}
function rendreSalon() {
  const boite = $("salon"); if (!boite) return;
  const filtre = $("filtreSalon").querySelector('[aria-selected="true"]').dataset.f;
  const entame = sabotEntame();
  // Le numéro est celui du CATALOGUE, pas du filtre : « Table 4 » reste la quatrième.
  boite.innerHTML = DONNEES.catalogue.map((t, i) => ({ t, n: i + 1 })).filter(({ t }) => {
    const i = indiceComptable(t);
    return filtre === "tout" || (filtre === "battable" ? i >= 25 : i < 25);
  }).map(({ t, n }) => carteTableHtml(t, { n, reprise: entame && t.id === DB.table })).join("")
    || `<p class="muet">Aucune table dans ce filtre.</p>`;
  boite.querySelectorAll("[data-asseoir]").forEach(b => b.onclick = () => {
    const id = b.dataset.asseoir, t = DONNEES.catalogue.find(x => x.id === id) || tableCourante();
    // La table où le sabot est entamé : on reprend sa place, on ne remélange pas.
    if (id === DB.table && sabotEntame()) { aller("table"); bandeau("Tu reprends ta place à « " + t.nom + " »"); return; }
    DB.table = id; garder(); nouveauSabot(); aller("table");
    bandeau("Tu t'assieds à « " + tableCourante().nom + " »");
  });
  // Celui qui REVIENT a sa table sous le titre du héros : « Reprendre — Le Boulevard · tapis 975 »
  // (les critiques, 05/09 : un joueur qui revient veut sa table, pas un slogan — et les tables
  // étaient sous la ligne de flottaison). Le héros se fait plus court (body.revient, style.css).
  const rep = $("hallReprendre");
  if (rep) {
    const t = tableCourante(), revient = entame || DB.tapis !== 1000 || DB.rachats > 0 || (DB.sessions || []).length > 0;
    document.body.classList.toggle("revient", revient); rep.hidden = !revient;
    const tapis = String(Math.round(DB.tapis)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");
    rep.innerHTML = `${entame ? "Reprendre ta place" : "Reprendre"} — <b>${echap(t.nom)}</b><small>tapis ${tapis}</small>`;
    rep.onclick = () => { if (!sabotEntame()) nouveauSabot(); aller("table"); bandeau("Tu reprends ta place à « " + t.nom + " »"); };
  }
  boite.querySelectorAll("[data-pourquoi]").forEach(b => b.onclick = () => {
    const t = DONNEES.catalogue.find(x => x.id === b.dataset.pourquoi), d = DONNEES.tables[t.id];
    ouvrirModale(`<span class="grave">${echap(t.lieu)}</span><h2 style="margin:4px 0 8px">${echap(t.nom)}</h2>
      <p class="lecon" style="font-family:'Instrument Serif',serif;font-size:var(--t-titre);color:var(--laiton)">« ${echap(t.lecon)} »</p>
      <p style="text-align:left">${echap(t.detail)}</p>
      <div class="regles" style="justify-content:center">${chipsRegles(t)}</div>
      <p class="muet" style="font-size:var(--t-petit);margin-top:12px">Avantage maison mesuré sur trois millions de mains jouées en stratégie parfaite : <b class="cadran">${fr2(d.avantage)} %</b>. Indice de comptabilité : <b class="cadran">${indiceComptable(t)}</b> sur 100.</p>`);
  });
}
$("filtreSalon").querySelectorAll("button").forEach(b => b.onclick = () => {
  $("filtreSalon").querySelectorAll("button").forEach(x => x.setAttribute("aria-selected", x === b ? "true" : "false"));
  rendreSalon();
});

/* ── Les portes fixes du hall et les bandeaux de salle : la photo vient de
   window.PHOTOS (build.mjs), par la clé posée en data-photo. Sans photo, la porte
   garde son voile sombre et son titre — rien ne casse, rien ne charge. */
function rendreHall() {
  const P = window.PHOTOS || {};
  document.querySelectorAll("[data-photo]").forEach(e => {
    const img = e.querySelector(":scope > img.photo"), src = P[e.dataset.photo];
    if (!img) return;
    if (src) { if (img.getAttribute("src") !== src) img.src = src; } else img.remove();
  });
  rendreCredits(); rendreSalut();
}
// Une CC BY sans crédit est une violation : auteur, licence, source, pour chaque photo.
function rendreCredits() {
  const c = $("hallCredits"), L = window.PHOTOS_CREDITS || [];
  if (!c) return;
  if (!L.length) { c.hidden = true; return; }
  c.innerHTML = `<span class="grave">Photos</span><p>` + L.map(x =>
    `<span class="credit"><a href="${echap(x.source)}" target="_blank" rel="noopener" title="${echap(x.titre)}">${echap(x.auteur)}</a>`
    + ` <a class="lic" href="${echap(x.licence_url)}" target="_blank" rel="noopener">${echap(x.licence)}</a></span>`).join(" · ")
    + `</p><p>Recadrées, redimensionnées et encodées en WebP ; les originaux sont chez leurs auteurs.</p>`;
}
$("bHallReglages").onclick = () => $("bReglages").click();

// La feuille de réglages EMPRUNTE le bloc `#outils` à l'en-tête et le rend à la
// fermeture. Recopier son HTML dupliquerait `#sys`, `#theme`, `#son` — des
// identifiants en double, et les branchements posés au démarrage resteraient
// accrochés à la copie cachée : les boutons de la feuille ne feraient rien.
$("bReglages").onclick = () => {
  ouvrirModale(`<h2>Réglages</h2><div id="accueilOutils"></div>
    <p class="muet" style="margin-top:14px">Le système de comptage change les valeurs
    de toutes les cartes, partout dans l'application — y compris dans les exercices.</p>`);
  const o = $("outils"); o.hidden = false; $("accueilOutils").appendChild(o);
  const fermer = $("modaleFermer").onclick;
  $("modaleFermer").onclick = () => { rendreOutils(); fermer(); };
};
// Rendre le bloc à l'en-tête, quoi qu'il arrive — y compris quand la modale est
// fermée par un clic sur le voile ou par une autre modale qui écrase la boîte.
function rendreOutils() {
  const o = $("outils"); if (!o) return;
  o.hidden = true; document.querySelector(".tete").appendChild(o);
}
function ouvrirModale(html) {
  rendreOutils();
  $("modaleBoite").innerHTML = html + `<div class="rang-btn" style="margin-top:16px"><button class="btn creux" id="modaleFermer">Fermer</button></div>`;
  $("modale").hidden = false;
  $("modaleFermer").onclick = () => { $("modale").hidden = true; };
  $("modaleFermer").focus();
}
$("modale").addEventListener("click", e => { if (e.target === $("modale")) { rendreOutils(); $("modale").hidden = true; } });
addEventListener("keydown", e => { if (e.key === "Escape" && !$("modale").hidden) { rendreOutils(); $("modale").hidden = true; } });
