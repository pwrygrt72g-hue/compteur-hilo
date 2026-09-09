// Contrôle des pages éditoriales (/blackjack/, /en/blackjack/) — celles qu'un robot lit
// et qu'une IA cite. Elles ne passent PAS par build.mjs : rien ne les vérifiait.
//
//   node outils/verifier-pages.mjs
//
// 🚨 POURQUOI CET OUTIL EXISTE (07/09/2026). Ces deux pages sont arrivées en production
// dans un commit qui ne les annonçait pas, sans relecture. Elles portaient : une balise
// `rating=adult` qui demandait leur exclusion des filtres SafeSearch, une stratégie de
// base FAUSSE (« 12 contre 2, restez » — le solveur du dépôt dit TIRER, sur les dix
// tables), un volume de simulation emprunté à une AUTRE mesure, et « quatre tables où
// compter ne sert à rien » quand le code du site en compte deux causes et trois tables.
// Toutes ces fautes étaient vérifiables contre le dépôt lui-même. Aucune ne l'a été.
//
// La règle qui en découle : une page qui se vend sur « nos chiffres sont mesurés, pas
// recopiés » doit prouver CHACUN de ses chiffres contre la source qui les mesure. Ce
// fichier le fait. Il sort 1 au premier écart.
import { readFileSync, existsSync } from "node:fs";
import { PAGES as CATALOGUE } from "../src/pages/catalogue.mjs";
import { empreinteSources } from "./mesurer-compteur.mjs";

// TOUTES les pages du catalogue, pas une liste écrite ici : une page ajoutée au
// catalogue est contrôlée sans qu'on y pense — c'est le contraire de ce qui est
// arrivé le 07/09, où rien ne regardait les pages parce que rien ne les listait.
const PAGES = CATALOGUE.map(p => p.slug + "/index.html");
let ko = 0, ok = 0;
const dire = (bon, quoi, detail) => { if (bon) { ok++; } else { ko++; console.log("KO  " + quoi + (detail ? "  → " + detail : "")); } };

const pre = JSON.parse(readFileSync("src/precalcul.json", "utf8")).donnees;
const AV = pre.tables, CAT = pre.catalogue;
// Les mesures du COMPTEUR (gain par main, carrières, ruine) — cf. outils/mesurer-compteur.mjs.
const MES_CHEMIN = "src/pages/mesures-compteur.json";
const MES = existsSync(MES_CHEMIN) ? JSON.parse(readFileSync(MES_CHEMIN, "utf8")) : null;
const EVS = [], SDS = new Set(), MISES = [], INCOHERENTS = [];
if (MES) {
  // Toute mesure du banc, où qu'elle soit rangée : une par table, la décomposition, la
  // fragilité, la rampe intuitive, les carrières. On descend l'arbre — une mesure ajoutée
  // demain dans une nouvelle rubrique doit compter, sinon la page qui la cite échouerait.
  const descendre = o => { if (!o || typeof o !== "object") return;
    if (typeof o.ev === "number") {
      EVS.push(o.ev);
      if (typeof o.sd === "number") { SDS.add(o.sd.toFixed(1).replace(".", ",")); SDS.add(o.sd.toFixed(1)); }
      // Le gain rapporté à l'ARGENT MISÉ : c'est l'unité de la littérature (« 0,5 à 1,5 % »),
      // et ce n'est PAS le gain par main dès qu'une rampe fait varier la mise.
      if (o.mise_moyenne > 0) MISES.push(o.ev / o.mise_moyenne * 100);
      // Un fichier écrit à la main passe l'empreinte : elle prouve les SOURCES, pas la
      // mesure. Une chose qu'un fabricant ne pense pas à respecter : l'intervalle de
      // confiance est 1,96·σ/√n, et il se recalcule à partir de deux champs voisins.
      if (typeof o.ic95 === "number" && typeof o.sd === "number" && o.mains > 0) {
        const attendu = 1.96 * o.sd / Math.sqrt(o.mains);
        if (Math.abs(o.ic95 - attendu) > Math.max(1e-6, attendu * 0.02)) INCOHERENTS.push(`ic95=${o.ic95} au lieu de ${attendu.toFixed(6)} (σ=${o.sd}, n=${o.mains})`);
      }
      return;
    }
    for (const v of Object.values(o)) descendre(v); };
  descendre(MES.tables); descendre(MES.boulevard);
}
// Un JSON de mesures PÉRIMÉ est pire que pas de mesures : les pages citeraient des chiffres
// qui ne décrivent plus le jeu du site. L'empreinte couvre le moteur ET le banc lui-même.
if (MES && INCOHERENTS.length) { ko++; console.log("KO  mesures-compteur.json : un intervalle de confiance ne se recalcule pas depuis son écart-type — fichier écrit à la main ?  → " + INCOHERENTS.slice(0, 3).join(" · ")); } else if (MES) ok++;
if (MES && MES.empreinte !== empreinteSources()) { ko++; console.log("KO  mesures-compteur.json est PÉRIMÉ : une source a changé depuis la mesure — relancer node outils/mesurer-compteur.mjs  → " + MES.empreinte + " ≠ " + empreinteSources()); } else if (MES) ok++;

const texteNu = h => h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ")
  .replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]*>/g, " ")
  .replace(/&nbsp;|&#8239;|&#160;/g, " ").replace(/&rsquo;|&#8217;/g, "'")
  .replace(/&minus;|&#8722;/g, "−").replace(/&asymp;|&#8776;/g, "≈").replace(/&times;/g, "×").replace(/&ndash;|&#8211;/g, "–").replace(/&mdash;|&#8212;/g, "—").replace(/&hellip;/g, "…").replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/\s+/g, " ").trim();

for (const p of PAGES) {
  if (!existsSync(p)) { dire(false, p + " : la page a disparu"); continue; }
  const h = readFileSync(p, "utf8"), nu = texteNu(h);

  // ── Ce qui interdit d'être trouvé, ou fait sanctionner ───────────────────────
  dire(!/name="rating"/.test(h), p + " : aucun rating (SafeSearch exclurait la page)");
  dire(/<link rel="canonical"/.test(h), p + " : une URL canonique");
  dire(/hreflang="x-default"/.test(h), p + " : un x-default pour les deux langues");

  // ── Le JSON-LD doit PARSER, et ne rien promettre que la page n'affiche ───────
  const blocs = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  dire(blocs.length > 0, p + " : au moins un bloc de données structurées");
  for (const [, brut] of blocs) {
    let j = null;
    try { j = JSON.parse(brut); } catch (e) { dire(false, p + " : le JSON-LD parse", e.message); continue; }
    dire(true, p + " : le JSON-LD parse");
    const noeuds = j["@graph"] || [j];
    const faq = noeuds.find(n => n["@type"] === "FAQPage");
    if (faq) {
      // 🚨 Google interdit de baliser en FAQPage une question ABSENTE de la page.
      // C'est un motif d'action manuelle — sur un domaine neuf, sans autorité à perdre.
      const titres = [...h.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)].map(m => texteNu(m[1]).replace(/\s*\?$/, "").toLowerCase());
      for (const q of faq.mainEntity || []) {
        const nom = String(q.name || "").replace(/\s*\?$/, "").toLowerCase().replace(/\s+/g, " ");
        dire(titres.some(t => t === nom || t.includes(nom) || nom.includes(t)),
          p + " : la question balisée est bien posée dans la page", q.name);
        // …et sa réponse doit se retrouver dans le texte visible, pas seulement dans le balisage.
        // ⚠️ On cherche la PLUS LONGUE phrase de la réponse, pas la première : beaucoup
        // commencent par « Non. » ou « No. », trois lettres qu'on retrouve partout — le
        // contrôle passait alors pour de mauvaises raisons, ou échouait pour de mauvaises
        // raisons selon le sens du test. Une phrase longue, elle, ne se retrouve par
        // hasard nulle part.
        const rep = texteNu(String((q.acceptedAnswer || {}).text || ""));
        const phrases = rep.split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(x => x.length > 24);
        const pivot = phrases.sort((a, b) => b.length - a.length)[0] || rep;
        dire(pivot.length > 24 && nu.includes(pivot),
          p + " : la réponse balisée est visible dans la page", pivot.slice(0, 62));
      }
    }
  }

  // ── Les CHIFFRES : chacun doit exister dans precalcul.json ───────────────────
  // On ne vérifie pas « le texte est joli » : on vérifie qu'aucun pourcentage
  // d'avantage maison cité n'est étranger à ce que le simulateur a mesuré.
  const mesures = new Set(Object.values(AV).map(t => t.avantage.toFixed(3).replace(".", ",")));
  const arrondis = new Set([...mesures].flatMap(v => [v, v.replace(/,(\d\d)\d$/, ",$1"), v.replace(/,(\d)\d\d$/, ",$1")]));
  const cites = [...nu.matchAll(/(\d,\d{1,3})\s*%/g)].map(m => m[1]);
  const bornes = new Set(["0,36", "0,63", "1,4", "1,5", "0,5", "0,2", "1,35", "2,26"]);
  // Le gain du compteur rapporté à l'argent misé (ev / mise moyenne) : mesuré, donc admis.
  for (const m of MISES) for (const d of [1, 2]) arrondis.add(Math.abs(m).toFixed(d).replace(".", ","));   // écarts théoriques et fourchettes, pas des mesures de table
  for (const c of new Set(cites))
    dire(arrondis.has(c) || bornes.has(c),
      p + " : le pourcentage cité vient d'une mesure du dépôt", c + " %");

  // ── L'ATTRIBUTION : dans une ligne de tableau, le nom et le chiffre vont ENSEMBLE ──
  // Le contrôle d'existence ci-dessus laisse passer « Le Néon … 0,359 % » : 0,359 EST une
  // mesure du dépôt — celle de La Marina. Une ligne de tableau qui nomme une table et
  // porte un pourcentage doit porter LE SIEN (à l'arrondi près, 1 à 3 décimales).
  for (const tr of h.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const ligne = texteNu(tr[1]);
    const table = CAT.find(t => ligne.includes(t.nom));
    if (!table) continue;
    const pcts = [...ligne.matchAll(/(\d,\d{1,3})\s*%/g)].map(m => m[1]);
    if (!pcts.length) continue;
    const mien = AV[table.id].avantage.toFixed(3).replace(".", ",");
    const admis = new Set([mien, mien.replace(/,(\d\d)\d$/, ",$1"), mien.replace(/,(\d)\d\d$/, ",$1")]);
    for (const c of pcts) if (/^\d,\d{1,3}$/.test(c) && +c.replace(",", ".") < 3)
      dire(admis.has(c), p + " : le chiffre d'une ligne de tableau est celui de la table nommée", `${table.nom} → ${c} % (mesuré : ${mien} %)`);
  }

  // ── Les TABLEAUX des leçons : jeux, coupe, comptes d'écarts, index, systèmes ──────
  // Le contrôle du pourcentage ne regarde qu'une colonne. Les leçons de l'Académie
  // alignent des jeux, une coupe, des comptes d'écarts, des index de décision, les
  // valeurs de quatre systèmes — tout cela sort de precalcul.json ou du catalogue,
  // donc tout cela se PROUVE. Une cellule fausse dans un tableau d'index enverrait
  // un lecteur doubler un 11 contre As sur un mauvais compte : on ne relit pas ces
  // tableaux à l'œil, on les recalcule. Ce que ce bloc ne sait PAS vérifier (une
  // arithmétique dérivée : gain de l'assurance, mise sur une rampe, perte à l'heure)
  // reste à la charge de la relecture — et il le dit ici plutôt que de faire semblant.
  const NOMS_SYS = Object.entries(pre.systemes).map(([id, s]) => [s.nom, id]);
  // 0 = As … 9 = 10 : l'encodage de strategie.js, pour `up` comme pour la clé d'une paire.
  const rang = t => /^(as|a|ace|aces)$/i.test(t) ? 0 : /^10\b/.test(t) ? 9 : /^[2-9]$/.test(t) ? +t - 1 : null;
  const entier = c => /^[+−-]?\d+$/.test(c) ? +c.replace("−", "-") : null;
  const FAM = { dur: "hard", hard: "hard", souple: "soft", soft: "soft", "paire de": "pair", "paire d'": "pair", "pair of": "pair" };
  const VERS = { doubler: "D", double: "D", rester: "S", stand: "S", "séparer": "P", split: "P", abandonner: "U", surrender: "U", tirer: "H", hit: "H" };
  const LIGNE_INDEX = /^(dur|hard|souple|soft|paire de|paire d'|pair of|n'importe laquelle|any)\s*(\d+|as|aces?)?\s+(as|a|\d+)\s+(doubler|double|rester|stand|séparer|split|abandonner|surrender|tirer|hit|prendre l'assurance|take insurance)\s+([+−-]?\d+)$/i;
  for (const tbl of h.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)) {
    const corps = tbl[1];
    const caption = texteNu((corps.match(/<caption[^>]*>([\s\S]*?)<\/caption>/) || ["", ""])[1]);
    // De QUELLE table parle ce tableau ? Sa légende, sinon la section qui le précède
    // (depuis le dernier titre) — le nom cité en dernier, donc le plus proche. Sans
    // nom : on ne devine pas, on refuse. « 79 écarts » n'est vrai que d'une table.
    const avant = h.slice(0, tbl.index);
    const contexte = texteNu(avant.slice(Math.max(avant.lastIndexOf("<h2"), avant.lastIndexOf("<h3"), 0))) + " " + caption;
    const tableCtx = CAT.map(t => [t, contexte.lastIndexOf(t.nom)]).filter(([, i]) => i >= 0).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const lignes = [...corps.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m => m[1]);
    const entetes = [...(corps.match(/<thead[\s\S]*?<\/thead>/) || [lignes[0] || ""])[0].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(m => texteNu(m[1]).toLowerCase().trim());
    for (const ligne of lignes) {
      const cellules = [...ligne.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(m => texteNu(m[1]).replace(/&minus;|\u2212/g, "−").trim());
      const texte = cellules.join(" ").trim();
      if (!/\d/.test(texte) || ligne.includes("<thead")) continue;
      // (a) Une ligne d'INDEX — « Dur 16 · 10 · Rester · 0 » : le solveur doit avoir CET écart, à CET index.
      const mi = texte.match(LIGNE_INDEX);
      if (mi) {
        const [, famBrut, cle, up, decision, idx] = mi;
        dire(!!tableCtx, p + " : un tableau d'index dit de quelle table il sort", texte);
        if (!tableCtx) continue;
        const T = AV[tableCtx.id], f = FAM[famBrut.toLowerCase()], v = VERS[decision.toLowerCase()], n = entier(idx), u = rang(up);
        const k = f === "pair" ? rang(cle || "") : +cle;
        let mesure;
        if (/assurance|insurance/i.test(decision)) mesure = T.assurance;
        else if (v === "U") mesure = (T.abandons.find(a => a[0] === f && a[1] === k && a[2] === u) || [])[3];
        else if (v && v !== "H") mesure = (T.ecarts.find(e => e[0] === f && e[1] === k && e[2] === u && e[4] === v) || [])[3];
        dire(mesure !== undefined && mesure === n, p + " : l'index d'une ligne d'écart est celui du solveur pour " + tableCtx.nom,
          `${texte} (solveur : ${mesure === undefined ? "aucun écart de ce genre" : mesure})`);
        continue;
      }
      // (b) Une ligne qui NOMME une table ou un système : chaque colonne connue porte SA valeur.
      const t = CAT.find(t => texte.includes(t.nom));
      const sys = NOMS_SYS.find(([nom]) => cellules[0] === nom);
      if (!t && !sys) continue;
      if (entetes.length !== cellules.length) { dire(false, p + " : les cellules d'une ligne s'alignent sur ses en-têtes", `${texte} (${cellules.length} cellules, ${entetes.length} en-têtes)`); continue; }
      cellules.forEach((c, i) => {
        const e = entetes[i];
        if (t) {
          const A = AV[t.id], cont = t.melange === "melangeuse_continue", coupe = Math.round(t.penetration * 100) + " %";
          const restants = (t.jeux * (1 - t.penetration)).toFixed(1).replace(".", ",");
          if (/^(jeux|decks)$/.test(e)) dire(entier(c) === t.jeux, p + " : la colonne des jeux est celle du catalogue", `${t.nom} → ${c} (catalogue : ${t.jeux})`);
          else if (/^(coupe|cut|pénétration|penetration)$/.test(e)) dire(cont ? !/\d/.test(c) : c === coupe, p + " : la coupe est celle du catalogue", `${t.nom} → ${c} (catalogue : ${cont ? "mélangeuse continue" : coupe})`);
          else if (/jeux (restants|derrière)|decks (remaining|behind)/.test(e)) dire(cont ? !/^\d/.test(c) : c === restants, p + " : les jeux derrière la coupe se déduisent du catalogue", `${t.nom} → ${c} (calcul : ${cont ? "aucune coupe" : restants})`);
          else if (/écarts|deviations|index/.test(e)) dire(entier(c) === A.ecarts.length, p + " : le compte d'écarts est celui du solveur", `${t.nom} → ${c} (solveur : ${A.ecarts.length})`);
          // « Abandon » est tantôt un COMPTE (16), tantôt une RÈGLE (tardif / aucun) : les deux se prouvent.
          else if (/^abandons?$|^surrenders?$/.test(e)) dire(entier(c) !== null ? entier(c) === A.abandons.length : /tardif|late/i.test(c) === (t.surrender === "late") && (/aucun|none|—|non/i.test(c) === (t.surrender === "none")),
            p + " : l'abandon d'une ligne est celui du catalogue", `${t.nom} → ${c} (catalogue : ${t.surrender}, ${A.abandons.length} abandons calculés)`);
          else if (/croupier|dealer|17/.test(e) && /^[hs]17$/i.test(c)) dire((c.toUpperCase() === "H17") === !!t.h17, p + " : S17/H17 est la règle du catalogue", `${t.nom} → ${c} (catalogue : ${t.h17 ? "H17" : "S17"})`);
          else if (/blackjack|pays|paie/.test(e) && /^\d:\d$/.test(c)) dire(c === (t.blackjackPays >= 1.5 ? "3:2" : "6:5"), p + " : le paiement du blackjack est celui du catalogue", `${t.nom} → ${c} (catalogue : ${t.blackjackPays})`);
        }
        if (sys) {
          const S = pre.systemes[sys[1]], r = rang(e);
          if (r !== null) dire(entier(c) === S.v[r], p + " : la valeur d'un système est celle du code", `${S.nom}, carte ${e} → ${c} (code : ${S.v[r]})`);
          else if (/équilibré|balanced/.test(e)) dire(/^(oui|yes)$/i.test(c) === !!S.equilibre, p + " : l'équilibre d'un système est celui du code", `${S.nom} → ${c}`);
          else if (/niveau|level/.test(e)) dire(entier(c) === S.niveau, p + " : le niveau d'un système est celui du code", `${S.nom} → ${c} (code : ${S.niveau})`);
        }
      });
    }
  }

  // ── Ce que le COMPTAGE rapporte : chaque chiffre vient de src/pages/mesures-compteur.json ──
  // Le banc outils/mesurer-compteur.mjs écrit ce fichier ; la leçon « ce que ça rapporte » et
  // les pages qui la citent ne peuvent avancer QUE ses mesures. La règle est l'ARRONDI, pas
  // l'intervalle de confiance : « 0,007 » doit être une mesure qui s'arrondit à 0,007 — sinon
  // la tolérance d'un IC (±0,0015 à 12 M de mains) laisserait passer 0,006 comme 0,010, et
  // c'est exactement comme ça qu'un vieux chiffre survit à la mesure qui le contredit.
  // Ce que ce bloc ne sait PAS prouver : une phrase (« le hasard pèse trois cents fois plus »,
  // « cent vingt mains pour un jeton ») dont l'arithmétique est dérivée d'un chiffre mesuré.
  if (MES) {
    const tol = d => 0.5 * Math.pow(10, -d) + 1e-9;
    // Le SIGNE compte quand il est écrit : « +0,006 par main » ne doit pas être validé par
    // la mise plate, qui vaut −0,006. Sans signe explicite (« la table prend 0,006 par
    // main »), on compare en valeur absolue — la phrase porte le sens.
    const dit = (cite, quoi) => {
      const [ent, dec] = cite.split(/[.,]/);
      const signe = /^[+]/.test(ent) ? 1 : /^[−-]/.test(ent) ? -1 : 0;
      const v = +`${ent.replace(/[+−-]/g, "")}.${dec}`;
      const bon = EVS.some(ev => signe === 0 ? Math.abs(Math.abs(ev) - v) <= tol(dec.length) : Math.abs(ev - signe * v) <= tol(dec.length));
      return dire(bon, p + " : " + quoi, cite);
    };
    // Les deux langues : « 0,008 unité par main » et « +0.008 units per hand ». Le
    // (?![\d.,]) évite d'attraper « 3,000,000 hands » — un volume, pas un gain.
    for (const m of new Set([...nu.matchAll(/([+−-]?\d[.,]\d{2,4})(?![\d.,])\s*(?:unités?(?: de mise)?|units?|u)?\s*(?:par main|\/main|per hand)/g)].map(m => m[1])))
      dit(m, "le gain par main cité est une mesure du banc (à l'arrondi près)");
    // L'index d'ASSURANCE (+3) était publié deux fois et prouvé zéro fois. On ne contrôle
    // que les compte-vrai cités DANS une phrase sur l'assurance : les leçons d'écarts en
    // citent vingt autres, qui ont leur propre contrôle (tableaux d'index).
    const idxAss = (Object.values(MES.tables)[0] || {}).index_assurance;
    if (idxAss !== undefined) for (const m of [...nu.matchAll(/assurance[^.]{0,90}?compte vrai (?:de )?\+?(\d+)/gi), ...nu.matchAll(/compte vrai (?:de )?\+?(\d+)[^.]{0,50}?assurance/gi)])
      dire(+m[1] === idxAss, p + " : l'index d'assurance cité est celui que le banc a joué", `+${m[1]} (mesuré : +${idxAss})`);
    // Les VOLUMES de simulation : la faute d'origine de cet outil était un volume emprunté
    // à une autre mesure. Ils se prouvent aussi.
    const VOL = new Set([MES.mains, MES.mains_decomposition, MES.boulevard.carrieres.mains, MES.boulevard.carrieres.n].filter(Boolean));
    const nb = t => +t.replace(/[\s  ]/g, "");
    for (const m of nu.matchAll(/(\d[\d\s  ]*)\s*millions? de mains/g))
      dire(VOL.has(nb(m[1]) * 1e6), p + " : le volume de mains cité est celui du banc", m[1].trim() + " millions");
    for (const m of nu.matchAll(/(\d[\d\s  ]*)\s*(?:carrières|mains chacun|mains chacune)/g))
      dire(VOL.has(nb(m[1])), p + " : le volume de simulation cité est celui du banc", m[0].trim());
    // « X % de l'argent misé » : ce n'est pas le gain par main, c'est ev / mise moyenne.
    for (const m of nu.matchAll(/(\d,\d{1,2})\s*%[^.]{0,40}?(?:de l'argent (?:réellement )?misé|de la mise)/g))
      dire(MISES.some(v => Math.abs(Math.abs(v) - +m[1].replace(",", ".")) <= 0.005 + 1e-9), p + " : le gain rapporté à l'argent misé est une mesure du banc", m[1] + " %");
    // Une décimale + « unité par main » = un écart-type (un gain, lui, en porte trois).
    // Le lookbehind/lookahead évitent d'attraper le « 0,0 » de « 0,008 unité par main ».
    for (const m of new Set([...nu.matchAll(/(?<![\d.,])(\d[.,]\d)(?!\d)\s*(?:unités?|units?)\s*(?:de mise\s*)?(?:par main|per hand)/g)].map(m => m[1])))
      dire(SDS.has(m), p + " : l'écart-type cité est celui du banc", m + " unité par main");
    for (const m of nu.matchAll(/(\d+)\s*% de ces carrières/g))
      dire(+m[1] === Math.round(MES.boulevard.carrieres.part_negative * 100), p + " : la part de carrières négatives est celle du banc", m[1] + " %");
    for (const m of nu.matchAll(/(?:sur (?:environ )?|environ )(\d+)\s*% des mains/g))
      dire(+m[1] === Math.round(MES.boulevard.decomposition.parfait.part_mises_hautes * 100), p + " : la part de mains misées au-dessus du minimum est celle du banc", m[1] + " %");
    for (const tbl of h.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)) {
      const corps = tbl[1];
      const lignes = [...corps.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m => m[1]);
      const legende = texteNu((corps.match(/<caption[^>]*>([\s\S]*?)<\/caption>/) || ["", ""])[1]).toLowerCase();
      const entetes = [...(corps.match(/<thead[\s\S]*?<\/thead>/) || [lignes[0] || ""])[0].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(m => texteNu(m[1]).toLowerCase().trim());
      const nombre = c => { const t = c.replace(/[\s  ]/g, "").replace("−", "-").replace(",", "."); return /^[+-]?\d+(\.\d+)?$/.test(t) ? +t : null; };
      for (const ligne of lignes) {
        if (!/<td[\s>]/.test(ligne)) continue;   // une ligne d'en-têtes n'est pas une donnée
        const cellules = [...ligne.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(m => texteNu(m[1]).trim());
        if (cellules.length !== entetes.length) continue;
        const texte = cellules.join(" ");
        // (a) « Gain du compteur » d'une ligne qui nomme une table : CELUI de cette table.
        const t = CAT.find(t => texte.includes(t.nom)), iGain = entetes.findIndex(e => /gain/.test(e));
        if (t && iGain >= 0 && MES.tables[t.id]) {
          const T = MES.tables[t.id], c = cellules[iGain], n = nombre(c), dec = (c.split(",")[1] || "").replace(/\D.*$/, "").length;
          // « ≈ 0 » n'est admis que si la mesure ne se distingue pas de zéro (IC95 à cheval sur 0).
          const ok = /^[≈~]\s*0$/.test(c) ? Math.abs(T.ev) <= T.ic95 : n !== null && Math.abs(n - T.ev) <= tol(dec || 3);   // signé : nombre() garde le − et le +
          dire(ok, p + " : le gain du compteur d'une ligne est celui mesuré pour " + t.nom, `${c} (banc : ${T.ev} ± ${T.ic95})`);
        }
        // (a bis) TOUTE colonne « gain … par main » ou « écart-type » : chaque cellule est
        // une mesure du banc, même quand la ligne ne nomme aucune table (décomposition,
        // fragilité). Sans cette règle, un tableau suffit à publier un chiffre inventé.
        entetes.forEach((e, i) => {
          const c = (cellules[i] || "").trim();
          // « Gain » ne suffit pas : la leçon sur l'assurance a une colonne « gain … pour
          // 100 unités engagées », qui est une arithmétique, pas une mesure du banc. Il
          // faut que la colonne — ou la légende du tableau — dise PAR MAIN.
          if ((/par main|per hand/.test(e) || (/gain/.test(e) && /par main|per hand/.test(legende))) && /^[+−-]?\d[.,]\d{2,4}$/.test(c)) {
            const dec = c.split(/[.,]/)[1].length, n = nombre(c);
            dire(EVS.some(ev => Math.abs(ev - n) <= tol(dec)), p + " : la cellule d'une colonne de gain est une mesure du banc, SIGNE COMPRIS", `${e} → ${c}`);
          }
          if (/écart-type/.test(e) && /^\d,\d$/.test(c))
            dire(SDS.has(c), p + " : la cellule d'une colonne d'écart-type est une mesure du banc", `${e} → ${c}`);
        });
        // (b) Le risque de ruine par caisse : exact, la graine est fixée.
        const iCaisse = entetes.findIndex(e => /caisse/.test(e)), iRuine = entetes.findIndex(e => /ruine|ruin/.test(e));
        if (iCaisse >= 0 && iRuine >= 0) {
          const B = cellules[iCaisse].replace(/\D/g, ""), pct = nombre(cellules[iRuine].replace("%", ""));
          const attendu = MES.boulevard.carrieres.ruine[B];
          if (attendu !== undefined) dire(pct !== null && pct === Math.round(attendu * 100), p + " : le risque de ruine d'une caisse est celui du banc", `${B} unités → ${cellules[iRuine]} (banc : ${Math.round(attendu * 100)} %)`);
          else dire(false, p + " : la caisse d'une ligne de ruine n'a pas été mesurée par le banc", cellules[iCaisse]);
        }
        // (c) Le résultat des carrières : pire, déciles, médiane, meilleure — exacts aussi.
        const iCar = entetes.findIndex(e => /carrière|career/.test(e)), iRes = entetes.findIndex(e => /résultat|result/.test(e));
        if (iCar >= 0 && iRes >= 0) {
          const lib = cellules[iCar].toLowerCase(), C = MES.boulevard.carrieres;
          const cle = /premier décile|1er décile|first decile/.test(lib) ? "decile_1" : /neuvième décile|9e décile|ninth decile/.test(lib) ? "decile_9"
            : /médiane|median/.test(lib) ? "mediane" : /la pire|worst/.test(lib) ? "pire" : /la meilleure|best/.test(lib) ? "meilleure" : null;
          if (cle) dire(nombre(cellules[iRes]) === C[cle], p + " : le résultat de carrière « " + cle + " » est celui du banc", `${cellules[iRes]} (banc : ${C[cle]})`);
        }
      }
    }
  } else if (/\d[.,]\d{2,4}\s*(?:unités?|units?|u)?\s*(?:par main|\/main|per hand)/.test(nu)) {
    dire(false, p + " : la page cite un gain par main mais src/pages/mesures-compteur.json manque — lancer node outils/mesurer-compteur.mjs");
  }

  // ── Le comptage : DEUX règles l'annulent, pas plus (src/app/salon.js) ────────
  const tue = CAT.filter(t => t.blackjackPays < 1.5 || t.melange === "melangeuse_continue").length;
  const dit = (nu.match(/(?:sur )?(trois|quatre|deux|three|four|two) des dix tables|(?:on )?(three|four|two) of the ten tables/i) || [])[0];
  if (dit) {
    const mots = { deux: 2, trois: 3, quatre: 4, two: 2, three: 3, four: 4 };
    const n = mots[(dit.match(/trois|quatre|deux|three|four|two/i) || [""])[0].toLowerCase()];
    dire(n === tue, p + " : le nombre de tables où compter ne sert à rien", `la page dit ${n}, le catalogue en compte ${tue}`);
  }

  // ── La stratégie de base citée en toutes lettres ─────────────────────────────
  // Le piège vécu : « entre 12 et 16 face à 2-6, restez ». Le solveur dit TIRER sur
  // 12 contre 2 et 12 contre 3. Toute phrase qui range le 12 avec les 13-16 est fausse.
  dire(!/(?:entre|from)\s*12\s*(?:et|à|to|and)\s*16[^.]{0,80}(?:restez|stand)/i.test(nu),
    p + " : le 12 n'est pas rangé avec les 13-16 (il se tire contre 2 et 3)");
}

// ── LES NUMÉROS D'AIDE AU JEU ─────────────────────────────────────────────────
// 🚨 C'est le contenu le plus important de ces pages, et le seul dont une faute de
// frappe envoie quelqu'un en difficulté sur une ligne morte. Chacun a été vérifié
// le 07/09/2026 auprès de l'organisme qui l'exploite — pas d'après un souvenir :
//   · 09 74 75 13 13    Joueurs Info Service (France) — déjà figé par outils/sonde.js
//   · 0808 8020 133     National Gambling Helpline (GamCare), confirmé sur le site
//                       de la UK Gambling Commission, le régulateur lui-même
//   · 1-800-MY-RESET / 1-800-697-3738  National Problem Gambling Helpline (NCPG),
//                       confirmé sur ncpgambling.org ; MY-RESET = 697-3738, lettre
//                       à lettre — le contrôle ci-dessous refait la conversion
//   · 1-800-522-4700    l'ancien numéro NCPG, toujours actif (idem)
// Les modifier exige de les revérifier À LA SOURCE, et de dater la vérification ici.
const AIDE = { "blackjack/index.html": ["09 74 75 13 13"],
               "en/blackjack/index.html": ["0808 8020 133", "1-800-MY-RESET", "1-800-697-3738", "1-800-522-4700"] };
for (const [p, nums] of Object.entries(AIDE)) {
  if (!existsSync(p)) continue;
  const nu = texteNu(readFileSync(p, "utf8"));
  for (const n of nums) dire(nu.includes(n), p + " : le numéro d'aide au jeu est intact", n);
}
// MY-RESET doit valoir 697-3738 sur le clavier : deux écritures du même numéro qui
// divergeraient enverraient la moitié des lecteurs ailleurs.
{
  const T = { A:2,B:2,C:2,D:3,E:3,F:3,G:4,H:4,I:4,J:5,K:5,L:5,M:6,N:6,O:6,P:7,Q:7,R:7,S:7,T:8,U:8,V:8,W:9,X:9,Y:9,Z:9 };
  dire([..."MYRESET"].map(c => T[c]).join("") === "6973738",
    "les deux écritures du numéro américain désignent la même ligne");
}

// ── Le plan de site et le noindex vont ENSEMBLE ────────────────────────────────
// Depuis le 08/09 le plan est ÉCRIT par outils/pages.mjs depuis le catalogue : chaque page
// construite y est, et aucune ne porte de noindex (la coquille n'en émet pas). Une page
// qui serait au plan ET en noindex serait un mensonge fait au robot ; une page construite
// mais absente du plan serait une page que personne ne trouve.
if (existsSync("sitemap.xml")) {
  const sm = readFileSync("sitemap.xml", "utf8");
  for (const p of PAGES) {
    if (!existsSync(p)) continue;
    const url = "https://wisehand21.com/" + p.replace(/index\.html$/, "");
    const dansPlan = sm.includes("<loc>" + url + "</loc>");
    const horsIndex = /name="robots"[^>]*noindex/.test(readFileSync(p, "utf8"));
    dire(!(dansPlan && horsIndex), "cohérence : " + url + " n'est pas à la fois au plan de site et en noindex");
    dire(dansPlan || horsIndex, "cohérence : " + url + " est soit au plan de site, soit explicitement en noindex");
  }
  // …et le plan ne cite aucune page que le catalogue ne connaît pas.
  const auPlan = [...sm.matchAll(/<loc>https:\/\/wisehand21\.com\/([^<]*)<\/loc>/g)].map(m => m[1]).filter(Boolean);
  for (const u of auPlan) dire(CATALOGUE.some(p => p.slug + "/" === u), "plan de site : l'URL est au catalogue", u);
}

console.log(`\n${ok} contrôles passés, ${ko} échecs`);
process.exit(ko ? 1 : 0);
