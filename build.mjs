// Fabrique index.html : un seul fichier, sans dépendance, sans empaqueteur npm.
// Il précalcule ce qui est cher (stratégies de base et écarts au compte, table par table)
// pour que l'application n'ait plus rien à résoudre au chargement.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { solve } from "./src/solver.mjs";
import { computeIndices } from "./src/indices.mjs";
import { simulate } from "./src/sim.mjs";
import { TABLES, reglesDe } from "./src/tables.mjs";
import { SYSTEMES } from "./src/counting.mjs";
import { makeRules } from "./src/engine.mjs";
import { PAGES, ORDRE_ACADEMIE } from "./src/pages/catalogue.mjs";

const t0 = Date.now();
const MAINS = +(process.env.MAINS || 3_000_000);

// ---- 1. précalcul ----
// ── 1. précalcul ─────────────────────────────────────────────────────
// Tout ce bloc ne dépend QUE des règles et des modules qui les résolvent.
// Il coûte une minute et demie ; une retouche de CSS n'a aucune raison de la
// payer. On l'indexe donc sur l'empreinte des sources qui le produisent :
// changer une table, un système ou le solveur invalide le cache tout seul,
// et il n'y a rien à penser. Le fichier est versionné pour qu'un clone frais
// construise sans rien recalculer.
const CACHE = "src/precalcul.json";
const empreinte = createHash("sha256")
  .update(["src/solver.mjs", "src/indices.mjs", "src/sim.mjs", "src/tables.mjs", "src/counting.mjs", "src/engine.mjs"]
    .map(f => readFileSync(f, "utf8")).join("\u0000"))
  .update("mains:" + MAINS).digest("hex").slice(0, 16);

let donnees = null;
if (existsSync(CACHE)) {
  const c = JSON.parse(readFileSync(CACHE, "utf8"));
  if (c.empreinte === empreinte) { donnees = c.donnees; process.stderr.write(`  précalcul repris du cache (${empreinte})\n`); }
}
if (!donnees) {
  donnees = { tables: {}, systemes: {}, genere: new Date().toISOString().slice(0, 10) };
  const cles = new Map();          // règles identiques = un seul calcul
  const signature = r => JSON.stringify([r.decks, r.h17, r.das, r.surrender, r.doubleOn, r.maxHands, r.hitSplitAces, r.peek, r.blackjackPays]);
  for (const t of TABLES) {
    const r = makeRules(reglesDe(t));
    const sig = signature(r);
    if (!cles.has(sig)) cles.set(sig, { chart: solve(r).chart, indices: computeIndices(r, SYSTEMES.hilo.v, { min: -8, max: 8 }) });
    const { chart, indices } = cles.get(sig);
    const rr = t.melange === "melangeuse_continue" ? Object.assign({}, r, { penetration: 0.02 }) : r;
    const { edge } = simulate(rr, MAINS, 20260904);
    donnees.tables[t.id] = {
      chart,
      ecarts: indices.deviations.filter(d => Math.abs(d.index) <= 6).map(d => [d.fam, d.key, d.up, d.index, d.vers]),
      abandons: indices.abandons.filter(a => Math.abs(a.index) <= 6).map(a => [a.fam, a.key, a.up, a.index]),
      assurance: indices.insurance ? indices.insurance.index : null,
      avantage: +edge.toFixed(3),
    };
    process.stderr.write(`  ${t.nom.padEnd(18)} avantage ${edge.toFixed(3)} %  ·  ${donnees.tables[t.id].ecarts.length} écarts\n`);
  }
  for (const [k, sy] of Object.entries(SYSTEMES)) donnees.systemes[k] = { nom: sy.nom, equilibre: sy.equilibre, niveau: sy.niveau, v: sy.v, note: sy.note };
  donnees.catalogue = TABLES;
  writeFileSync(CACHE, JSON.stringify({ empreinte, donnees }));
}
// Ce que la plaque de mesure du hall AFFICHE doit voyager AVEC les données, jamais être
// réécrit à la main dans le gabarit : c'est exactement comme ça que « Neuf tables » a
// survécu trois jours pour dix tables réelles, en se contredisant avec le JSON-LD de la
// MÊME page. Posé HORS du bloc `if (!donnees)`, sinon un cache chaud les perdrait.
// ⚠️ `donnees.genere` vient du cache : c'est la date du dernier VRAI calcul, pas celle de
// la construction. C'est bien ce qu'on veut dire par « recalculé le … ».
donnees.mains = MAINS;
donnees.empreinte = empreinte;

// ---- 2. mini-empaqueteur : des modules ES vers une seule portée ----
// table-reseau (la table à plusieurs, hôte autoritaire) dépend d'engine : il vient après.
// visio (le maillage WebRTC autour de la table) dépend de net : il vient après lui ;
// camera (une seule caméra, comptée par références) et micro (une seule voix, jumeau
// de camera depuis le 6 septembre 2026) ne dépendent de rien.
const ORDRE = ["engine", "solver", "shuffle", "counting", "net", "table-reseau", "camera", "micro", "visio"];
const exportsDe = src => {
  const n = new Set();
  for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:const|let|function)\s+([A-Za-z_$][\w$]*)/gm)) n.add(m[1]);
  for (const m of src.matchAll(/^export\s*\{([^}]*)\}/gm)) m[1].split(",").forEach(x => { const c = x.trim().split(/\s+as\s+/).pop().trim(); if (c) n.add(c); });
  return [...n];
};
let bundle = "const M={};\n";
for (const nom of ORDRE) {
  let src = readFileSync(`src/${nom}.mjs`, "utf8");
  const noms = exportsDe(src);
  src = src.replace(/^import\s*\{([^}]*)\}\s*from\s*["']\.\/([\w-]+)\.mjs["'];?\s*$/gm, (_, ids, mod) => `const {${ids}} = M[${JSON.stringify(mod)}];`);
  src = src.replace(/^export\s+\{[^}]*\};?\s*$/gm, "");
  src = src.replace(/^export\s+/gm, "");
  bundle += `M[${JSON.stringify(nom)}] = (function(){\n${src}\nreturn {${noms.join(",")}};\n})();\n`;
}

// ---- 3. assemblage ----
const css = readFileSync("src/app/style.css", "utf8");
const corps = readFileSync("src/app/corps.html", "utf8");
// L'interface est concaténée DANS CET ORDRE à l'intérieur d'une seule portée.
// Ce n'est pas un système de modules : c'est une table des matières. Un fichier
// annoncé mais absent fait échouer la construction, plutôt que de produire une
// page à moitié muette qu'on découvrirait à l'usage.
// ⚠️ L'ORDRE EST LE CODE : tout vit dans une seule portée IIFE et les `const`
// ne remontent pas. Intervertir deux morceaux casse en zone morte temporelle.
// cartes.js (le dessin des cartes) doit précéder le salon, qui en affiche ;
// jetons.js et croupier.js écoutent le bus émis par table.js, ils viennent juste après.
// reseau.js (la table à plusieurs) se greffe sur la table, les jetons et le croupier :
// il vient après eux trois, et après ensemble.js dont il complète l'écran d'accueil.
// visio.js (les têtes des amis sur les sièges, le bouton Caméra, le relais de ⚙) écoute
// les événements « sabot:reseau-* » que reseau.js émet : il vient juste après lui.
// mouvement.js (l'onde au clic) ne dépend de RIEN : un seul écouteur délégué sur le
// document, posé en dernier, qui ne connaît que des sélecteurs. Il vient juste avant
// demarrage.js pour que l'écouteur existe avant le premier rendu.
// dons.js (la caisse) ne dépend que du socle : $ pour les deux états de la page, aller()
// pour la porte vers la table entre amis. Il tient en vingt lignes et ne branche rien d'autre.
const MORCEAUX = ["socle.js","camera.js","cartes.js","salon.js","table.js","jetons.js","croupier.js",
  "exercices.js","strategie.js","concentration.js","ensemble.js","reseau.js","visio.js","dons.js","progres.js","clavier.js","mouvement.js","demarrage.js"];
const app = MORCEAUX.map(f => {
  try { return `\n/* ═══ ${f} ═══ */\n` + readFileSync(`src/app/${f}`, "utf8"); }
  catch (e) { throw new Error(`morceau d'interface manquant : src/app/${f}`); }
}).join("\n");
const tete = readFileSync("src/app/tete.html", "utf8");

// ── L'adresse du site : UNE constante, dans src/visio.mjs ────────────────────────────
// Le gabarit écrit `__LIEN_SITE__` ; c'est ici qu'il devient une URL. Sans ce détour, la
// phrase « joue sur la version en ligne » du panneau À plusieurs portait l'adresse en dur,
// et le jour du déménagement sous le nom de domaine propre il aurait fallu penser à ce
// href-là — celui qu'on ne relit jamais, dans un paragraphe qu'on ne lit qu'en panne.
// On échoue franchement plutôt que de livrer un lien mort : un href resté `__LIEN_SITE__`
// ne se voit qu'en cliquant.
const LIEN_SITE = (readFileSync("src/visio.mjs", "utf8").match(/export const LIEN_SITE = "([^"]+)"/) || [])[1];
if (!LIEN_SITE) throw new Error("src/visio.mjs : LIEN_SITE introuvable — le gabarit ne peut plus être résolu");

let out = `${tete}
<style>
${css}
</style>
${corps}
<script>
(function(){
"use strict";
const DONNEES = ${JSON.stringify(donnees)};
${bundle}
${app}
})();
</script>
`;
// Deux sorties depuis les mêmes pièces :
//  · index.html  — document complet, pour l'hébergement statique et le fichier local.
//    Sans <meta charset>, un serveur qui n'annonce pas l'encodage fait lire
//    la page en latin-1 : tous les accents cassent. Vérifié, pas supposé.
//  · artefact.html — le même corps SANS doctype ni <head>, parce que l'outil
//    Artifact enveloppe le fichier lui-même et refuse ces balises.
if (out.includes("__LIEN_SITE__")) out = out.split("__LIEN_SITE__").join(LIEN_SITE);

// ── L'ÉTAGE « L'ACADÉMIE » DU HALL LIT LE CATALOGUE DES PAGES ────────────────────────
// Dix leçons, une ligne chacune, écrites ici depuis src/pages/catalogue.mjs — la MÊME
// source que outils/pages.mjs, qui construit les pages elles-mêmes. Un titre recopié à
// la main dans le gabarit divergerait de la page qu'il annonce dès la première retouche.
// ⚠️ Une liste VIDE fait échouer la construction : un étage « L'Académie » sans leçon
// est exactement la page à moitié muette que ce fichier refuse de produire ailleurs.
{
  const lecons = ORDRE_ACADEMIE.slice(1).map(slug => PAGES.find(p => p.slug === slug)).filter(Boolean);
  if (lecons.length < 2) throw new Error(`catalogue.mjs : ${lecons.length} leçon(s) dans ORDRE_ACADEMIE — l'étage L'Académie du hall serait vide`);
  const ech = x => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const li = lecons.map((p, i) =>
    `<li><a href="/${p.slug}/"><span class="no">${String(i + 1).padStart(2, "0")}</span><b>${ech(p.court)}</b><span>${ech(p.sous || p.titre)}</span></a></li>`).join("\n");
  const nb = ["zéro", "une", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze"][lecons.length] || String(lecons.length);
  out = out.replace("__LECONS_ACADEMIE__", li).replace("__NB_LECONS__", `${nb[0].toUpperCase() + nb.slice(1)} leçons`);
  if (out.includes("__LECONS_ACADEMIE__") || out.includes("__NB_LECONS__")) throw new Error("corps.html : un espace réservé de l'Académie n'a pas été remplacé");
}
writeFileSync("artefact.html", out);

// ── Ce qui n'existe QUE dans index.html : l'en-tête public ────────────────────
// 🚨 Ce bloc N'EST PAS dans src/app/tete.html, et c'est délibéré : tete.html est
// partagé avec artefact.html, qui est publié sous un AUTRE domaine. Y mettre le
// canonique et les balises Open Graph ferait déclarer à l'artefact qu'il est une
// copie de wisehand21.com — vrai, mais ce n'est pas à lui de le dire, et un jour
// on ne saurait plus laquelle des deux pages Google regarde.
// L'adresse vient de LIEN_SITE, la constante unique déjà lue plus haut : rien
// n'est écrit en dur ici, pas plus que dans le gabarit.
//
// L'IMAGE DE PARTAGE est en JPEG et non en WebP, alors que tout le reste du dépôt
// est en WebP : le scraper de LinkedIn ne lit pas le WebP de façon fiable (vérifié
// le 07/09/2026) et sort alors un aperçu SANS image, sans le signaler. Elle est
// fabriquée par outils/og-image.sh — 1200x630, ~112 Ko.
const SITE = LIEN_SITE.replace(/\/$/, "");
const OG_IMAGE = SITE + "/static/og.jpg";
const DESCRIPTION = (tete.match(/<meta name="description" content="([^"]+)"/) || [])[1];
if (!DESCRIPTION) throw new Error("tete.html : <meta name=\"description\"> introuvable — l'en-tête public ne peut plus être construit");

// SoftwareApplication décrit L'OUTIL (c'est une application, pas un article) ;
// WebSite donne son nom au domaine. Aucun FAQPage ici : les questions vivent sur
// /blackjack/, et baliser une question absente de la page est une violation.
const JSONLD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": SITE + "/#app",
      name: "WiseHand",
      url: SITE + "/",
      applicationCategory: "GameApplication",
      applicationSubCategory: "Blackjack trainer",
      operatingSystem: "Tout navigateur web",
      inLanguage: "fr",
      description: DESCRIPTION,
      image: OG_IMAGE,
      author: { "@type": "Person", name: "Léo Lejeau" },
      license: "https://opensource.org/licenses/MIT",
      isAccessibleForFree: true,
      // 🚨 Un prix de 0 se déclare, sinon « gratuit » n'est qu'une affirmation
      // dans une phrase. C'est la seule chose de cette page qu'un moteur peut
      // vérifier mécaniquement.
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
      featureList: [
        "Dix tables de casino aux règles distinctes",
        "Stratégie de base résolue pour chaque table",
        "Écarts au compte vrai (Hi-Lo)",
        "Avantage maison mesuré par simulation",
        "Table à plusieurs, sans serveur",
        "Fonctionne hors ligne",
      ],
    },
    { "@type": "WebSite", "@id": SITE + "/#site", url: SITE + "/", name: "WiseHand", inLanguage: "fr" },
  ],
};

const ENTETE = `<link rel="canonical" href="${SITE}/">
<link rel="alternate" hreflang="fr" href="${SITE}/">
<link rel="alternate" hreflang="x-default" href="${SITE}/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="WiseHand">
<meta property="og:locale" content="fr_FR">
<meta property="og:url" content="${SITE}/">
<meta property="og:title" content="WiseHand — compter les cartes au blackjack, pour de vrai">
<meta property="og:description" content="${DESCRIPTION}">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Un valet de pique en gros plan, et le titre « Compter les cartes, pour de vrai ».">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="WiseHand — compter les cartes au blackjack, pour de vrai">
<meta name="twitter:description" content="${DESCRIPTION}">
<meta name="twitter:image" content="${OG_IMAGE}">
<meta name="twitter:image:alt" content="Un valet de pique en gros plan, et le titre « Compter les cartes, pour de vrai ».">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<script type="application/ld+json">${JSON.stringify(JSONLD).replace(/<\//g, "<\\/")}</script>
`;

writeFileSync("index.html", `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${ENTETE}${out.slice(0, out.indexOf("<style>"))}</head>
<body>
${out.slice(out.indexOf("<style>"))}</body>
</html>
`);
const ko = Math.round(out.length / 1024);
console.log(`\nindex.html écrit : ${ko} Ko, ${out.split("\n").length} lignes, en ${((Date.now() - t0) / 1000).toFixed(1)} s`);

// ═══ Photos ═══════════════════════════════════════════════════════════════════
// Section indépendante du reste : elle relit les deux sorties déjà écrites et y
// glisse, AVANT le script de l'application, `window.PHOTOS` (clé → URL) et
// `window.PHOTOS_CREDITS` (auteur, licence, source). Une CC BY sans crédit est
// une violation : le crédit voyage donc avec les photos, dans la page.
// Deux régimes, parce que les deux sorties ne vivent pas au même endroit :
//  · index.html   — des URL relatives, servies telles quelles. Il reçoit EN PLUS
//    `window.PHOTOS_PETIT` (les mêmes clés vers les fichiers 640 px) : le hall en
//    fait un srcset et n'affiche plus une photo de 1600 px dans une vignette de
//    413 px. Mesuré le 07/09 : 2 530 Ko de photos avant, 913 Ko après sur un écran
//    non-Retina, la même chose sur un écran Retina (qui reprend le plein format).
//  · artefact.html — des data: URI, parce que la CSP de l'artefact bloque toute
//    image externe SANS ERREUR : les versions -petit, et le plein format pour le
//    hall seul. Le poids injecté est affiché et plafonné à 6 Mo — l'artefact
//    entier doit rester sous 16 Mo, et personne ne le verrait grossir sinon.
//    Il n'a PAS de PHOTOS_PETIT : les images y sont déjà inlinées et déjà réduites,
//    un srcset n'aurait rien à choisir et doublerait le poids injecté.
{
  const CREDITS = "static/photos/credits.json";
  if (!existsSync(CREDITS)) {
    process.stderr.write("  photos : pas de static/photos/credits.json, rien d'injecté\n");
  } else {
    const credits = JSON.parse(readFileSync(CREDITS, "utf8"));
    const dataUri = f => "data:image/webp;base64," + readFileSync(f).toString("base64");
    const photos = mode => Object.fromEntries(credits.map(c => [c.cle,
      mode === "pages" ? c.fichier : dataUri(c.cle === "hall" ? c.fichier : c.fichier_petit)]));
    const petites = () => Object.fromEntries(credits.filter(c => c.fichier_petit).map(c => [c.cle, c.fichier_petit]));
    // `</` échappé : une balise fermante dans une chaîne JSON couperait le <script>.
    const js = v => JSON.stringify(v).replace(/<\//g, "<\\/");
    const script = mode => `<script>window.PHOTOS=${js(photos(mode))};`
      + (mode === "pages" ? `window.PHOTOS_PETIT=${js(petites())};` : "")
      + `window.PHOTOS_CREDITS=${js(credits)};</script>\n`;
    const injecter = (page, s) => {
      const i = page.indexOf("<script>");
      if (i < 0) throw new Error("photos : aucun <script> où s'accrocher dans la page");
      return page.slice(0, i) + s + page.slice(i);
    };
    const sArt = script("artefact"), sIdx = script("pages");
    const mo = sArt.length / 1048576;
    if (mo > 6) throw new Error(`photos : ${mo.toFixed(2)} Mo injectés dans l'artefact, plafond 6 Mo`);
    writeFileSync("artefact.html", injecter(readFileSync("artefact.html", "utf8"), sArt));
    writeFileSync("index.html", injecter(readFileSync("index.html", "utf8"), sIdx));
    console.log(`photos : ${credits.length} clés · ${Math.round(sIdx.length / 1024)} Ko dans index.html · ${mo.toFixed(2)} Mo en data: URI dans artefact.html`);

    // ── La liste du service worker ne peut pas dériver ────────────────────────
    // sw.js précache les versions réduites pour que le hall garde ses photos hors ligne.
    // Cette liste est écrite À LA MAIN là-bas (un service worker ne se construit pas) :
    // rien n'empêcherait d'ajouter une photo ici et de l'oublier là, et le trou ne se
    // verrait QUE dans un avion. On compare donc les deux ensembles, dans les deux sens.
    const attendues = new Set(credits.filter(c => c.fichier_petit).map(c => c.fichier_petit));
    const sw = readFileSync("sw.js", "utf8");
    const bloc = sw.match(/const PHOTOS = \[([\s\S]*?)\]\s*\.map/);
    if (!bloc) throw new Error("sw.js : le tableau PHOTOS est introuvable — la vérification ne peut plus se faire");
    const listees = new Set([...bloc[1].matchAll(/"([^"]+)"/g)].map(m => `static/photos/${m[1]}-petit.webp`));
    const manquantes = [...attendues].filter(p => !listees.has(p));
    const fantomes = [...listees].filter(p => !attendues.has(p) || !existsSync(p));
    if (manquantes.length || fantomes.length) throw new Error(
      "sw.js : la liste des photos hors ligne ne correspond plus à credits.json.\n"
      + (manquantes.length ? `  à AJOUTER dans sw.js : ${manquantes.join(", ")}\n` : "")
      + (fantomes.length ? `  à RETIRER de sw.js (absentes du disque ou du catalogue) : ${fantomes.join(", ")}\n` : ""));
    // Même contrôle pour les PAGES : chaque entrée du catalogue est dans la coquille, et
    // la coquille ne cite aucune page que le catalogue ne connaît pas.
    const blocC = sw.match(/const COQUILLE = \[([\s\S]*?)\];/);
    if (!blocC) throw new Error("sw.js : le tableau COQUILLE est introuvable");
    const dansSw = new Set([...blocC[1].matchAll(/"\.\/([^"]*)"/g)].map(m => m[1]).filter(u => u.endsWith("/") && u !== ""));
    const auCatalogue = new Set(PAGES.map(p => p.slug + "/"));
    const pagesManquantes = [...auCatalogue].filter(u => !dansSw.has(u));
    const pagesFantomes = [...dansSw].filter(u => !auCatalogue.has(u));
    if (pagesManquantes.length || pagesFantomes.length) throw new Error(
      "sw.js : la coquille hors ligne ne correspond plus à src/pages/catalogue.mjs.\n"
      + (pagesManquantes.length ? `  à AJOUTER dans sw.js : ${pagesManquantes.map(u => "./" + u).join(", ")}\n` : "")
      + (pagesFantomes.length ? `  à RETIRER de sw.js : ${pagesFantomes.map(u => "./" + u).join(", ")}\n` : ""));
    const poids = [...attendues].reduce((n, p) => n + readFileSync(p).length, 0);
    console.log(`hors ligne : ${attendues.size} photos réduites précachées par sw.js · ${Math.round(poids / 1024)} Ko`);

    // ── UNE TABLE NEUVE NE PEUT PLUS ARRIVER À MOITIÉ ────────────────────────
    // 🚨 Écrit le 07/09 après avoir ajouté La Marina : sa carte s'affichait, son
    // feutre était le bon, et le croupier y souhaitait « la bienvenue au Boulevard ».
    // Trois choses vivent LOIN du catalogue et se laissent oublier une par une, sans
    // qu'aucune ne fasse d'erreur :
    //   — la PHOTO (credits.json) : sans elle, une carte de salon noire ;
    //   — le CROUPIER (croupier.js) : le repli est Vince, dont l'accueil NOMME sa
    //     table — on accueille donc les joueurs au nom d'un autre lieu ;
    //   — le FEUTRE (style.css) : sans lui, la table emprunte la couleur de la
    //     précédente, et deux lieux deviennent indiscernables.
    // Chacun échouait en SILENCE. Ils échouent maintenant à la construction.
    const cat = readFileSync("src/tables.mjs", "utf8");
    const ids = [...cat.matchAll(/^\s*id: "([\w-]+)"/gm)].map(m => m[1]);
    if (ids.length < 2) throw new Error("tables.mjs : aucun identifiant de table lu — la vérification ne peut plus se faire");
    const cles = new Set(credits.map(c => c.cle));
    const croupiers = readFileSync("src/app/croupier.js", "utf8");
    const blocCr = croupiers.match(/const CROUPIER_DEFAUT = \{([\s\S]*?)\};/);
    if (!blocCr) throw new Error("croupier.js : CROUPIER_DEFAUT est introuvable — la vérification ne peut plus se faire");
    const avecCroupier = new Set([...blocCr[1].matchAll(/(\w+):/g)].map(m => m[1]));
    const feutres = new Set([...css.matchAll(/#v-table\[data-lieu="([\w-]+)"\]/g)].map(m => m[1]));
    const trous = ids.flatMap(id => [
      cles.has(id) ? null : `${id} : pas de photo dans credits.json`,
      avecCroupier.has(id) ? null : `${id} : pas de croupier dans CROUPIER_DEFAUT (croupier.js) — le repli accueillerait au nom du Boulevard`,
      feutres.has(id) ? null : `${id} : pas de feutre #v-table[data-lieu="${id}"] dans style.css`,
    ]).filter(Boolean);
    if (trous.length) throw new Error("tables : une table du catalogue n'est pas complète.\n  " + trous.join("\n  "));
    console.log(`tables : ${ids.length} au catalogue, chacune avec sa photo, son croupier et son feutre`);
  }
}
