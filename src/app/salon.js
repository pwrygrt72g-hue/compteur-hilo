/* ══════════════════════ LE HALL ══════════════════════
   Le menu est un casino : on ne choisit pas une « vue », on pousse une porte.
   Ce fichier rend les portes des tables (rendreSalon), pose les photos sur les
   portes fixes du hall (rendreHall) et écrit les crédits qui vont avec.
   Il vit AVANT table.js : rien ici ne touche T au chargement — seulement au rendu. */
// Chaque puce porte son EXPLICATION en infobulle (title) : H17, S17, 3:2, 6:5, DAS, pén. 75 % —
// du jargon sans un mot pour le novice, qui ne pouvait pas choisir une table en connaissance de
// cause (les critiques, 05/09). Le texte dit ce que la règle change POUR TOI.
function chipsRegles(t) {
  const c = [];
  c.push([`${t.jeux} jeu${t.jeux > 1 ? "x" : ""}`, t.jeux <= 2 ? "bien" : "", `${t.jeux} jeu${t.jeux > 1 ? "x" : ""} de 52 cartes dans le sabot — moins il y en a, plus le compte bouge vite`]);
  c.push([t.h17 ? "H17" : "S17", t.h17 ? "" : "bien", t.h17 ? "H17 : le croupier tire encore sur un 17 souple (as + 6) — un peu moins bon pour toi" : "S17 : le croupier reste sur tous les 17, même souples — un peu mieux pour toi"]);
  c.push([t.blackjackPays === 1.5 ? "3:2" : "6:5", t.blackjackPays === 1.5 ? "bien" : "mal", t.blackjackPays === 1.5 ? "3:2 : un blackjack paie une fois et demie ta mise — la règle normale" : "6:5 : un blackjack ne paie que 1,2 fois ta mise — à fuir, le compte ne rattrape jamais ça"]);
  if (t.melange === "melangeuse_continue") c.push(["mélangeuse continue", "mal", "Les cartes jouées retournent dans la machine après chaque main : le compte ne s'accumule jamais"]);
  else c.push([`pén. ${Math.round(t.penetration * 100)} %`, t.penetration >= .75 ? "bien" : t.penetration <= .55 ? "mal" : "", `Pénétration ${Math.round(t.penetration * 100)} % : on joue ${Math.round(t.penetration * 100)} % du sabot avant de remélanger — plus c'est profond, plus le compte a le temps de payer`]);
  if (t.das) c.push(["DAS", "bien", "DAS : on peut doubler après avoir séparé une paire"]); else c.push(["sans DAS", "", "Pas de doublement après une séparation"]);
  if (t.surrender !== "none") c.push(["abandon", "bien", "Abandon : on peut rendre une mauvaise main et récupérer la moitié de sa mise"]);
  if (!t.holeCard) c.push(["sans carte cachée", "mal", "Le croupier ne prend sa seconde carte qu'à la fin : s'il fait blackjack, tu perds aussi tes doublements"]);
  if (t.doubleOn !== "any") c.push(["doubler " + t.doubleOn.join("-"), "", "On ne peut doubler que sur un total de " + t.doubleOn.join(", ")]);
  return c.map(([l, k, aide]) => `<span class="regle ${k}"${aide ? ` title="${echap(aide)}" data-aide="1"` : ""}>${l}</span>`).join("");
}
// …et la même liste EN TOUTES LETTRES, pour la feuille « Les règles de cette table » : un
// `title` ne s'atteint ni au doigt, ni sous 1000 px (où la rangée est retirée). Les textes ne
// sont pas réécrits — une seule source, celle des pastilles.
function chipsReglesTexte(t) {
  const div = document.createElement("div"); div.innerHTML = chipsRegles(t);
  return [...div.children].map(e => [e.textContent.trim(), e.getAttribute("title") || "", e.className.replace("regle", "").trim()]);
}
// Les TROIS puces qu'on garde partout où la place manque (la porte du hall, la barre de
// la table) : le nombre de jeux, H17/S17, 3:2 ou 6:5 — plus la mélangeuse quand il y en
// a une, parce que celle-là tue le comptage. Une seule définition pour les deux écrans.
// o.sansMelangeuse : sur la PORTE du hall, le tampon « À fuir · mélangeuse » le dit déjà — la puce
// en plus ajoutait une rangée et poussait « MACAO, COTAI STRIP » sur « TABLE 4 » (les critiques, 05/09).
function pucesCourtes(t, o) {
  const tmp = document.createElement("div"); tmp.innerHTML = chipsRegles(t);
  const puces = [...tmp.children], garde = puces.slice(0, 3);
  const csm = puces.find(p => /mélangeuse/.test(p.textContent));
  if (csm && !garde.includes(csm) && !(o && o.sansMelangeuse)) garde.push(csm);
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
        <span class="regles">${pucesCourtes(t, { sansMelangeuse: true })}</span>
        <span class="chiffres"><span title="Ce que la maison gagne en moyenne sur chaque mise, en stratégie parfaite — plus c'est bas, mieux c'est"><b>${fr2(d.avantage)} %</b>avantage maison</span><span title="Mise minimale et maximale à cette table, en jetons"><b>${fmtJ(t.mise_min)} – ${fmtJ(t.mise_max)}</b>mises</span></span>
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
      <p class="muet" style="font-size:var(--t-petit);margin-top:12px">Avantage maison mesuré sur trois millions de mains jouées en stratégie parfaite : <b class="cadran">${fr2(d.avantage)} %</b> — ce que la maison gagne en moyenne sur chaque mise. Rentabilité du comptage : <b class="cadran">${indiceComptable(t)}</b> sur 100 — plus c'est haut, plus tenir le compte rapporte ici.</p>`);
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
// Le pied de page porte aussi la PORTÉE du partage à l'identique (les BY-SA obligent la photo,
// pas la collection qui l'affiche) et la non-affiliation : les neuf tables sont inventées, mais
// les lieux photographiés existent — sans la phrase, on croirait à un partenariat. Voir LICENSE.
function rendreCredits() {
  const c = $("hallCredits"), L = window.PHOTOS_CREDITS || [];
  if (!c) return;
  if (!L.length) { c.hidden = true; return; }
  c.innerHTML = `<span class="grave">Photos</span><p>` + L.map(x =>
    `<span class="credit"><a href="${echap(x.source)}" target="_blank" rel="noopener" title="${echap(x.titre)}">${echap(x.auteur)}</a>`
    + ` <a class="lic" href="${echap(x.licence_url)}" target="_blank" rel="noopener">${echap(x.licence)}</a></span>`).join(" · ")
    + `</p><p>Recadrées, redimensionnées et encodées en WebP ; les originaux sont chez leurs auteurs. Chaque photo modifiée reste sous la licence de son original — les CC BY-SA sont donc partagées à l'identique. Le reste de l'application ne l'est pas : elle les rassemble, elle n'en dérive pas. Le Sabot n'est affilié à aucun casino. Les noms de tables sont fictifs ; les photos montrent des lieux réels, sous licence libre.</p>`;
}
$("bHallReglages").onclick = () => $("bReglages").click();

/* ── « Première fois ? » : la leçon en trois écrans (le but du jeu, les trois valeurs, dix cartes
   à compter avec correction). Le hall partait de « Le compte est masqué » et la seule explication
   du comptage était son dernier bloc (les critiques, 05/09). Tout vient du système sélectionné
   (sys().v) : la leçon est celle de Hi-Lo comme d'Omega II. ─────────────────────────────── */
const LECON = { etape: 0, cartes: [], i: 0, rc: 0, bons: 0, dit: 0 };
function leconRangs() {
  const v = sys().v, groupes = {};
  RANKS.forEach((r, i) => { const k = v[i >= 9 ? 9 : i]; (groupes[k] = groupes[k] || []).push(r); });
  // Trié du − au + : dans l'ORDRE DES BOUTONS de l'exercice, qui est aussi celui des touches
  // fléchées (← = −1, → = +1). Mémoriser « +1 » à gauche dans la leçon et le retrouver à droite
  // sous le doigt une seconde plus tard, c'est une friction gratuite dans un exercice de réflexe.
  return Object.keys(groupes).map(Number).sort((a, b) => a - b).map(k => [k, groupes[k]]);
}
function leconHtml() {
  const e = LECON.etape, S = sys();
  const tete = `<div class="lecon"><span class="lecon-etape">Apprendre à compter · ${e + 1} sur 3</span>`;
  if (e === 0) return tete + `<h2>Le but du jeu, en une phrase.</h2>
    <p>Au blackjack, tu joues <b>contre le croupier</b>, pas contre les autres joueurs : il faut faire <b>plus que lui sans dépasser 21</b>. Les figures valent 10, l'as vaut 1 ou 11, le reste sa valeur.</p>
    <p>Tant qu'un as compte 11, on dit que la main est <b>souple</b> : « 17 souple », c'est as + 6, et elle ne peut pas sauter — tirer une carte de plus est sans risque, l'as redescend à 1. C'est le mot que tu verras sous tes cartes et sur le feutre.</p>
    <p>Le croupier, lui, n'a pas le choix : il tire jusqu'à 17. C'est pour ça que <b>ce qui reste dans le sabot</b> change tout — beaucoup de dix et d'as à venir, c'est bon pour toi (tes blackjacks paient une fois et demie, ses 16 sautent) ; beaucoup de petites cartes, c'est bon pour lui.</p>
    <p><b>Compter, c'est savoir de quel côté penche le sabot.</b> Et miser plus quand il penche vers toi.</p>
    <div class="rang-btn"><button class="btn" id="leconSuite">Les trois valeurs →</button></div></div>`;
  if (e === 1) {
    const rangs = leconRangs().map(([k, rs]) => { const jeu = sabotNeuf(1);
      const ex = rs.slice(0, 5).map(r => jeu.find(c => c.r === r));
      return `<div class="lecon-rang"><span class="regle ${k > 0 ? "bien" : k < 0 ? "mal" : ""}">${sgn(k)}</span><span class="main">${ex.map(c => carteEl(c).outerHTML).join("")}</span><span class="muet">${rs.join(" · ")}</span></div>`; }).join("");
    return tete + `<h2>${S.nom} : chaque carte vaut ${leconRangs().map(([k]) => sgn(k)).join(", ")}.</h2>
      <p>Tu pars de <b>${sgn(CT.compteInitial(DB.sys, 6))}</b> à un sabot neuf. À chaque carte qui sort — les tiennes, celles des voisins, celles du croupier — tu ajoutes sa valeur de tête. Ce total, c'est le <b>compte courant</b>.</p>
      ${rangs}
      <p class="muet" style="font-size:var(--t-petit)">Les petites cartes sorties (+1) laissent les grosses dans le sabot : le compte monte, la table penche vers toi. Divisé par le nombre de jeux qui restent, ça devient le <b>compte vrai</b> — celui qui décide de la mise.</p>
      <div class="rang-btn"><button class="btn" id="leconSuite">Dix cartes, à toi →</button><button class="btn creux" id="leconAvant">← Le but</button></div></div>`;
  }
  const fini = LECON.i >= LECON.cartes.length;
  if (!fini) {
    const c = LECON.cartes[LECON.i], vals = [...new Set(S.v)].sort((a, b) => a - b);
    return tete + `<h2>Dix cartes. Annonce la valeur de chacune.</h2>
      <p class="muet" style="font-size:var(--t-petit)">Carte ${LECON.i + 1} sur ${LECON.cartes.length} · ${S.nom} : ${leconRangs().map(([k, rs]) => sgn(k) + " pour " + (rs.length > 4 ? rs[0] + "–" + rs[rs.length - 1] : rs.join(", "))).join(" · ")}. Tiens le total de tête.</p>
      <div class="lecon-scene">${carteEl(c).outerHTML}<div class="lecon-compte"><span class="grave">Ton compte, de tête</span><b>?</b></div></div>
      <div class="reponses">${vals.map(x => `<button data-v="${x}" class="${x > 0 ? "plus" : x < 0 ? "moins" : ""}">${sgn(x)}<i>${RANKS.filter((r, i) => S.v[i >= 9 ? 9 : i] === x).join(" ")}</i></button>`).join("")}</div>
      <p class="lecon-retour" id="leconRetour"></p></div>`;
  }
  if (LECON.dit === null) return tete + `<h2>Et le compte, alors ?</h2>
    <p>Dix cartes sont sorties. Tu as annoncé juste <b>${LECON.bons} fois sur ${LECON.cartes.length}</b>. Maintenant, le total :</p>
    <div class="demande"><label class="ch"><span class="grave">Compte courant</span><input type="number" id="leconSaisie" placeholder="0"></label><button class="btn" id="leconVerifier">Vérifier</button></div></div>`;
  const exact = LECON.dit === LECON.rc;
  return tete + `<h2>${exact ? "Exact." : "Presque."}</h2>
    <div class="lecon-bilan"><span class="grave">Le compte réel</span><b style="color:${exact ? "var(--jade)" : "var(--cinabre)"}">${sgn(LECON.rc)}</b>${exact ? "" : `<span class="muet">tu as dit ${sgn(LECON.dit)}</span>`}</div>
    <p>${exact ? "C'est exactement ça : tu sais compter. " : "Le geste est là, il reste à le rendre automatique. "}Dans la salle d'entraînement, les cartes défilent à la vitesse que tu veux ; à une table, tu comptes pendant que tout le monde joue — et un croupier te regarde miser.</p>
    <div class="rang-btn"><button class="btn" id="leconExercices">Continuer dans les exercices</button><button class="btn creux" id="leconTables">M'asseoir à une table</button><button class="btn creux" id="leconRejouer">Dix autres cartes</button></div></div>`;
}
function leconTirer() {
  const jeu = sabotNeuf(1); LECON.cartes = [];
  for (let k = 0; k < 10; k++) LECON.cartes.push(jeu.splice(alea(jeu.length), 1)[0]);
  LECON.i = 0; LECON.rc = CT.compteInitial(DB.sys, 6); LECON.bons = 0; LECON.dit = null;
}
function rendreLecon() {
  ouvrirModale(leconHtml());
  const b = $("modaleBoite");
  const suite = b.querySelector("#leconSuite"), avant = b.querySelector("#leconAvant");
  if (suite) suite.onclick = () => { LECON.etape++; if (LECON.etape === 2) leconTirer(); rendreLecon(); };
  if (avant) avant.onclick = () => { LECON.etape--; rendreLecon(); };
  b.querySelectorAll(".reponses button").forEach(bt => bt.onclick = () => {
    const c = LECON.cartes[LECON.i], vrai = valeurCompte(c), bon = +bt.dataset.v === vrai;
    LECON.rc += vrai; if (bon) LECON.bons++; son(bon ? "ok" : "ko");
    const r = b.querySelector("#leconRetour"); if (r) { r.textContent = (bon ? "✓ " : "✗ c'était ") + sgn(vrai); r.className = "lecon-retour " + (bon ? "ok" : "ko"); }
    b.querySelectorAll(".reponses button").forEach(x => { x.disabled = true; });
    setTimeout(() => { LECON.i++; rendreLecon(); }, bon ? 420 : 900);
  });
  const verif = b.querySelector("#leconVerifier"), saisie = b.querySelector("#leconSaisie");
  const verifier = () => { const g = (saisie.value || "").trim(); if (g === "") return; LECON.dit = parseInt(g, 10); son(LECON.dit === LECON.rc ? "ok" : "ko"); rendreLecon(); };
  if (verif) { verif.onclick = verifier; saisie.addEventListener("keydown", e => { if (e.key === "Enter") verifier(); }); setTimeout(() => saisie.focus(), 40); }
  const fermer = () => { $("modale").hidden = true; };
  const ex = b.querySelector("#leconExercices"); if (ex) ex.onclick = () => { fermer(); aller("exercices"); };
  const ta = b.querySelector("#leconTables"); if (ta) ta.onclick = () => { fermer(); allerHall("lesTables"); };
  const rj = b.querySelector("#leconRejouer"); if (rj) rj.onclick = () => { leconTirer(); rendreLecon(); };
  if (suite) suite.focus();
}
function ouvrirLecon() { LECON.etape = 0; rendreLecon(); }
if ($("hallApprendre")) $("hallApprendre").onclick = ouvrirLecon;

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
