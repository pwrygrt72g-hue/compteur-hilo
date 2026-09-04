/* ══════════════════════ LE SALON ══════════════════════ */
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
// continue. Une pénétration médiocre rend la table faible — la jauge le dit déjà,
// et la tamponner « morte » serait un mensonge utile à personne.
function tableMorte(t) {
  if (t.blackjackPays < 1.5) return "Le blackjack payé 6 pour 5 — ne t'assieds pas ici";
  if (t.melange === "melangeuse_continue") return "Mélangeuse continue — le comptage est mort";
  return null;
}
function rendreSalon() {
  const filtre = $("filtreSalon").querySelector('[aria-selected="true"]').dataset.f;
  const liste = DONNEES.catalogue.filter(t => {
    const i = indiceComptable(t);
    return filtre === "tout" || (filtre === "battable" ? i >= 25 : i < 25);
  });
  $("salon").innerHTML = liste.map((t, n) => {
    const d = DONNEES.tables[t.id], ind = indiceComptable(t), tampon = tableMorte(t), brulee = !!tampon;
    return `<article class="laque tbl ${brulee ? "brulee" : ""}" ${brulee ? `data-tampon="${tampon}"` : ""}>
      <span class="num">Table ${n + 1} · ${echap(t.lieu)}</span>
      <h3>${echap(t.nom)}</h3>
      <div class="jauge" title="Indice de comptabilité"><i style="width:${ind}%"></i><b>${ind}</b></div>
      <div class="regles">${chipsRegles(t)}</div>
      <p class="lecon">« ${echap(t.lecon)} »</p>
      <div class="chiffres">
        <div><b>${fr2(d.avantage)} %</b><span class="grave">avantage maison</span></div>
        <div><b>${d.assurance === null ? "—" : sgn(d.assurance)}</b><span class="grave">assurance dès</span></div>
        <div><b>${d.ecarts.length}</b><span class="grave">écarts utiles</span></div>
      </div>
      <div class="pied">
        <button class="btn" data-asseoir="${t.id}">${brulee ? "M'asseoir" : "Prendre place"}</button>
        <button class="btn creux" data-pourquoi="${t.id}">Pourquoi</button>
      </div>
    </article>`;
  }).join("") || `<p class="muet">Aucune table dans ce filtre.</p>`;
  $("salon").querySelectorAll("[data-asseoir]").forEach(b => b.onclick = () => {
    DB.table = b.dataset.asseoir; garder(); nouveauSabot(); aller("table");
    bandeau("Tu t'assieds à « " + tableCourante().nom + " »");
  });
  $("salon").querySelectorAll("[data-pourquoi]").forEach(b => b.onclick = () => {
    const t = DONNEES.catalogue.find(x => x.id === b.dataset.pourquoi), d = DONNEES.tables[t.id];
    ouvrirModale(`<span class="grave">${echap(t.lieu)}</span><h2 style="margin:4px 0 8px">${echap(t.nom)}</h2>
      <p class="lecon" style="font-family:'Instrument Serif',serif;font-size:var(--t-titre);color:var(--laiton)">« ${echap(t.lecon)} »</p>
      <p style="text-align:left">${echap(t.detail)}</p>
      <div class="regles" style="justify-content:center">${chipsRegles(t)}</div>
      <p class="muet" style="font-size:var(--t-petit);margin-top:12px">Avantage maison mesuré sur trois millions de mains jouées en stratégie parfaite : <b class="cadran">${fr2(d.avantage)} %</b>.</p>`);
  });
}
$("filtreSalon").querySelectorAll("button").forEach(b => b.onclick = () => {
  $("filtreSalon").querySelectorAll("button").forEach(x => x.setAttribute("aria-selected", x === b ? "true" : "false"));
  rendreSalon();
});
// La feuille de réglages EMPRUNTE le bloc `#outils` à l'en-tête et le rend à la
// fermeture. Recopier son HTML dupliquerait `#sys`, `#theme`, `#son` — des
// identifiants en double, et les branchements posés au démarrage resteraient
// accrochés à la copie cachée : les boutons de la feuille ne feraient rien.
$("bReglages").onclick = () => {
  ouvrirModale(`<h2>R\u00e9glages</h2><div id="accueilOutils"></div>
    <p class="muet" style="margin-top:14px">Le syst\u00e8me de comptage change les valeurs
    de toutes les cartes, partout dans l'application \u2014 y compris dans les exercices.</p>`);
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
