// Construit TOUTES les pages éditoriales à partir d'une seule coquille.
//
//   node outils/pages.mjs
//
// 🚨 POURQUOI CET OUTIL EXISTE (08/09/2026). Il y avait trois pages écrites à la main.
// Deux étaient en ligne, et elles ne se ressemblaient PAS : la française en sombre seul,
// l'anglaise en clair/sombre avec un autre corps de texte et un vocabulaire de classes
// à elle. La troisième (src/pages/comment-jouer-au-blackjack.html) était un doublon
// complet de la première, jamais publié, jamais relu. Chacune portait sa propre copie
// de l'en-tête, du fil d'Ariane, du JSON-LD et de la ligne d'aide au jeu — quatre choses
// dont UNE seule faute de frappe envoie quelqu'un en difficulté sur une ligne morte.
// En ajouter douze de plus à la main aurait fait douze coquilles de plus à surveiller.
//
// Ici, une page = un fragment de corps (src/pages/corps/<x>.html) + une entrée de
// catalogue. Le reste — <head>, données structurées, navigation, précédent/suivant,
// pied de page, plan du site, llms.txt — est produit UNE fois, pour toutes.
//
// ⚠️ Le contrôle des chiffres reste chez outils/verifier-pages.mjs, qui tourne APRÈS et
// relit les pages CONSTRUITES. Ce fichier ne vérifie que ce qu'il peut voir tout seul :
// qu'un fragment existe, qu'il ne réintroduit pas une balise de document, et qu'une
// question balisée en FAQ est bien posée dans le texte.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { PAGES, ORDRE_ACADEMIE } from "../src/pages/catalogue.mjs";

const SITE = (readFileSync("src/visio.mjs", "utf8").match(/export const LIEN_SITE = "([^"]+)"/) || [])[1];
if (!SITE) throw new Error("src/visio.mjs : LIEN_SITE introuvable");
const RACINE = SITE.replace(/\/$/, "");
const CSS = readFileSync("src/pages/style.css", "utf8");
// ⚠️ Le volume de simulation se lit COMME build.mjs le lit — jamais recopié dans une
// phrase. La page anglaise annonçait « 3,000,000 hands per rule set » en toutes lettres :
// le jour où MAINS change, c'est la phrase qui prouve les chiffres qui devient fausse.
const MAINS = +(process.env.MAINS || 3_000_000);
const PRE = JSON.parse(readFileSync("src/precalcul.json", "utf8")).donnees;
const MARQUE = readFileSync("icon.svg", "utf8").replace(/<\?xml[^>]*\?>/, "").trim()
  .replace('<svg ', '<svg aria-hidden="true" focusable="false" ');

const ech = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const js = v => JSON.stringify(v).replace(/<\//g, "<\\/");
const url = slug => RACINE + "/" + (slug ? slug + "/" : "");

// Le texte nu d'un fragment : ce qu'un lecteur voit. Sert au temps de lecture et au
// contrôle « la réponse balisée est-elle visible dans la page ».
const texteNu = h => h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ")
  .replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]*>/g, " ")
  .replace(/&nbsp;|&#8239;|&#160;/g, " ").replace(/&rsquo;|&#8217;/g, "'")
  .replace(/&minus;|&#8722;/g, "−").replace(/&times;/g, "×").replace(/&ndash;|&#8211;/g, "–").replace(/&mdash;|&#8212;/g, "—").replace(/&hellip;/g, "…").replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n))
  .replace(/&amp;/g, "&").replace(/&laquo;|&raquo;/g, '"').replace(/\s+/g, " ").trim();

// ── Les traductions de la coquille ────────────────────────────────────────────
// Deux langues, deux ours. Les NUMÉROS D'AIDE AU JEU sont ceux qu'outils/verifier-pages.mjs
// vérifie ligne à ligne : ils ont été confirmés le 07/09/2026 auprès des organismes qui les
// exploitent. Les changer exige de les revérifier À LA SOURCE.
const L = {
  fr: {
    accueil: "Accueil", cours: "L'Académie", guide: "Le blackjack", app: "L'entraîneur",
    lecture: n => `${n} min de lecture`, publie: "Publié le", modifie: "Mis à jour le",
    avant: "Leçon précédente", apres: "Leçon suivante", autre: "English", 
    mois: ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"],
    ours: `<p><strong>Ici, personne ne perd d'argent&#8239;: les jetons ne valent rien et le tapis se rachète
d'un clic. Dehors, c'est autre chose.</strong> Le blackjack reste un jeu d'argent, et un jeu
d'argent se perd à long terme. Rien sur cette page n'est un conseil de jouer.</p>`,
    aide: `<p>Si le jeu a cessé d'être un jeu&#8239;: <strong>Joueurs Info Service, 09 74 75 13 13</strong>
— anonyme et non surtaxé, tous les jours de 8&nbsp;h à 2&nbsp;h.</p>`,
    pied: `Jeu interdit aux mineurs.`,
    methode: n => `<p class="meta"><strong>D'où viennent ces chiffres.</strong> Chaque avantage maison
cité sur ce site est produit en simulant <strong>${n} mains</strong> par jeu de règles, avec un
joueur qui applique la stratégie de base résolue pour ces règles-là — pas une grille recopiée.
Les grilles sont calculées par un solveur exact&#8239;; les index de comptage sont obtenus par
dichotomie sur la composition du sabot. La graine est fixe, donc le résultat est reproductible.
Dernier calcul&#8239;: ${PRE.genere}. Le code est ouvert&#8239;: les chiffres peuvent être
régénérés à partir de lui.</p>`,
  },
  en: {
    accueil: "Home", cours: "The Academy", guide: "Blackjack", app: "The trainer",
    lecture: n => `${n} min read`, publie: "Published", modifie: "Updated",
    avant: "Previous lesson", apres: "Next lesson", autre: "Français",
    mois: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    ours: `<p><strong>Nobody loses money here: the chips are worthless and the bankroll resets with one
click. Outside, it is another matter.</strong> Blackjack is gambling, and gambling loses money
over the long run. Nothing on this page is advice to play.</p>`,
    aide: `<p>If gambling has stopped being a game:<br>
<strong>United Kingdom</strong> — National Gambling Helpline, <strong>0808 8020 133</strong>, free and open around the clock.<br>
<strong>United States</strong> — National Problem Gambling Helpline, <strong>1-800-MY-RESET</strong>
(<strong>1-800-697-3738</strong>), or the long-standing <strong>1-800-522-4700</strong>.</p>`,
    pied: `You must be of legal gambling age.`,
    methode: n => `<p class="meta"><strong>About these numbers.</strong> Every house edge on this site
was produced by simulating <strong>${n} hands</strong> per rule set, with a player using the exact
basic strategy solved for that rule set — not a transcribed chart. The charts are computed by an
exact solver; the counting indices are derived by bisection on shoe composition. The seed is fixed,
so the figures are reproducible. Last computed: ${PRE.genere}. The source is open, and the figures
can be regenerated from it.</p>`,
  },
};

const dateLisible = (iso, lang) => {
  const [a, m, j] = iso.split("-").map(Number);
  return lang === "fr" ? `${j} ${L.fr.mois[m - 1]} ${a}` : `${L.en.mois[m - 1]} ${j}, ${a}`;
};

// ── Une page ─────────────────────────────────────────────────────────────────
function construire(p, index) {
  const t = L[p.lang];
  const chemin = `src/pages/corps/${p.fichier}`;
  if (!existsSync(chemin)) throw new Error(`corps manquant : ${chemin} (page « ${p.slug || "/"} »)`);
  const corps = readFileSync(chemin, "utf8").trim();

  // 🚨 Un fragment qui réintroduit une balise de document produit une page à deux <head>
  // que le navigateur répare en silence, et qu'aucun test ne regarde. On échoue ici.
  for (const t2 of ["<html", "<head", "<body", "<!doctype", "<style", "<footer"])
    if (corps.toLowerCase().includes(t2))
      throw new Error(`${chemin} : le fragment contient « ${t2} » — le corps seul est attendu (la coquille pose le reste)`);
  const h1 = (corps.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1];
  if (!h1) throw new Error(`${chemin} : pas de <h1>`);
  if ((corps.match(/<h1[^>]*>/g) || []).length > 1) throw new Error(`${chemin} : plusieurs <h1>`);

  const nu = texteNu(corps);
  const mots = nu.split(/\s+/).length;
  const minutes = Math.max(2, Math.round(mots / 200));

  // Chaque <h2> doit porter un id : c'est ce qui rend les ancres profondes possibles,
  // et c'est ce qu'un moteur reprend pour proposer un « aller à cette section ».
  for (const m of corps.matchAll(/<h2(?![^>]*\bid=)[^>]*>([\s\S]*?)<\/h2>/g))
    throw new Error(`${chemin} : le <h2> « ${texteNu(m[1]).slice(0, 40)} » n'a pas d'id`);

  // 🚨 Une question balisée en FAQPage DOIT être posée dans la page, et sa réponse
  // visible : Google en fait un motif d'action manuelle. On refuse de construire.
  for (const q of p.faq || []) {
    const titres = [...corps.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)].map(m => texteNu(m[1]).replace(/\s*[?？]\s*$/, "").toLowerCase());
    const nom = q.q.replace(/\s*[?？]\s*$/, "").toLowerCase();
    if (!titres.some(x => x === nom || x.includes(nom) || nom.includes(x)))
      throw new Error(`${chemin} : la question balisée « ${q.q} » n'est posée nulle part dans la page`);
    const phrases = texteNu(q.r).split(/(?<=[.!?])\s+/).filter(x => x.length > 24).sort((a, b) => b.length - a.length);
    const pivot = phrases[0];
    if (!pivot || !nu.includes(pivot))
      throw new Error(`${chemin} : la réponse balisée pour « ${q.q} » n'apparaît pas dans le texte visible`);
  }

  // ── Le fil d'Ariane ────────────────────────────────────────────────────────
  const fil = (p.fil || []).concat([[p.court || texteNu(h1), null]]);
  const filHtml = fil.map(([nom, href], i) =>
    (i ? `<span class="sep" aria-hidden="true">›</span>` : "")
    + (href ? `<a href="${href}">${ech(nom)}</a>` : `<span aria-current="page">${ech(nom)}</span>`)).join("");

  // ── Précédent / suivant, dans l'ordre du cours ─────────────────────────────
  let suite = "";
  if (p.section === "academie") {
    const i = ORDRE_ACADEMIE.indexOf(p.slug);
    const av = i > 0 ? PAGES.find(x => x.slug === ORDRE_ACADEMIE[i - 1]) : null;
    const ap = i >= 0 && i < ORDRE_ACADEMIE.length - 1 ? PAGES.find(x => x.slug === ORDRE_ACADEMIE[i + 1]) : null;
    if (av || ap) suite = `\n<nav class="suite" aria-label="${p.lang === "fr" ? "Dans le cours" : "In the course"}">`
      + (av ? `<a href="/${av.slug}/"><span class="sens">← ${t.avant}</span>${ech(av.court)}</a>` : "")
      + (ap ? `<a class="apres" href="/${ap.slug}/"><span class="sens">${t.apres} →</span>${ech(ap.court)}</a>` : "")
      + `</nav>`;
  }

  // ── Les données structurées ────────────────────────────────────────────────
  const graphe = [];
  if (p.type === "Course") {
    graphe.push({
      "@type": "Course", "@id": url(p.slug) + "#cours", name: p.titre, description: p.desc,
      url: url(p.slug), inLanguage: p.lang, isAccessibleForFree: true,
      provider: { "@type": "Organization", name: "WiseHand", url: url("") },
      author: { "@type": "Person", name: "Léo Lejeau" },
      // La charge de travail est la SOMME des temps de lecture réels des leçons, pas une
      // estimation de confort : elle se recalcule à chaque construction.
      hasCourseInstance: {
        "@type": "CourseInstance", courseMode: "online",
        courseWorkload: "PT" + ORDRE_ACADEMIE.slice(1).reduce((n, s) => {
          const f = `src/pages/corps/${(PAGES.find(x => x.slug === s) || {}).fichier}`;
          return n + (existsSync(f) ? Math.max(2, Math.round(texteNu(readFileSync(f, "utf8")).split(/\s+/).length / 200)) : 0);
        }, 0) + "M",
      },
      hasPart: ORDRE_ACADEMIE.slice(1).map(s => {
        const q = PAGES.find(x => x.slug === s);
        return q ? { "@type": "Course", name: q.titre, url: url(q.slug),
          provider: { "@type": "Organization", name: "WiseHand", url: url("") } } : null;
      }).filter(Boolean),
    });
  } else {
    graphe.push({
      "@type": "Article", "@id": url(p.slug) + "#article",
      headline: texteNu(h1), description: p.desc, inLanguage: p.lang,
      datePublished: p.publie, dateModified: p.modifie || p.publie,
      author: { "@type": "Person", name: "Léo Lejeau" },
      publisher: { "@type": "Organization", name: "WiseHand", url: url("") },
      mainEntityOfPage: { "@id": url(p.slug) },
      image: RACINE + "/static/og.jpg",
      wordCount: mots,
      isAccessibleForFree: true,
      ...(p.apropos ? { about: p.apropos.map(n => ({ "@type": "Thing", name: n })) } : {}),
    });
  }
  graphe.push({
    "@type": "BreadcrumbList", "@id": url(p.slug) + "#fil",
    itemListElement: fil.map(([nom, href], i) => ({
      "@type": "ListItem", position: i + 1, name: nom,
      ...(href ? { item: href.startsWith("/") ? RACINE + href : href } : {}),
    })),
  });
  if ((p.faq || []).length) graphe.push({
    "@type": "FAQPage", "@id": url(p.slug) + "#faq",
    mainEntity: p.faq.map(q => ({ "@type": "Question", name: q.q,
      acceptedAnswer: { "@type": "Answer", text: q.r } })),
  });

  // ── L'en-tête ──────────────────────────────────────────────────────────────
  const alt = p.alt ? PAGES.find(x => x.slug === p.alt) : null;
  const hreflang = alt
    ? `<link rel="alternate" hreflang="${p.lang}" href="${url(p.slug)}">
<link rel="alternate" hreflang="${alt.lang}" href="${url(alt.slug)}">
<link rel="alternate" hreflang="x-default" href="${url(p.lang === "fr" ? p.slug : alt.slug)}">`
    : `<link rel="alternate" hreflang="${p.lang}" href="${url(p.slug)}">
<link rel="alternate" hreflang="x-default" href="${url(p.slug)}">`;

  const page = `<!doctype html>
<html lang="${p.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${ech(p.titre)} — WiseHand</title>
<meta name="description" content="${ech(p.desc)}">
<link rel="canonical" href="${url(p.slug)}">
${hreflang}
<meta property="og:type" content="${p.type === "Course" ? "website" : "article"}">
<meta property="og:site_name" content="WiseHand">
<meta property="og:locale" content="${p.lang === "fr" ? "fr_FR" : "en_US"}">
<meta property="og:url" content="${url(p.slug)}">
<meta property="og:title" content="${ech(p.titre)}">
<meta property="og:description" content="${ech(p.desc)}">
<meta property="og:image" content="${RACINE}/static/og.jpg">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Un valet de pique en gros plan, et le titre « Compter les cartes, pour de vrai ».">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${ech(p.titre)}">
<meta name="twitter:description" content="${ech(p.desc)}">
<meta name="twitter:image" content="${RACINE}/static/og.jpg">
<meta name="twitter:image:alt" content="Un valet de pique en gros plan, et le titre « Compter les cartes, pour de vrai ».">
<meta name="theme-color" content="#070D0C">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icon-180.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..800&family=Instrument+Serif&family=Martian+Mono:wdth,wght@75..112.5,300..700&display=swap">
<script type="application/ld+json">${js({ "@context": "https://schema.org", "@graph": graphe })}</script>
<style>
${CSS}</style>
</head>
<body>

<header class="enseigne">
  <div class="dedans">
    <a class="marque" href="/">${MARQUE}WiseHand</a>
    <nav aria-label="${p.lang === "fr" ? "Principale" : "Main"}">
      <a href="/${p.lang === "fr" ? "" : "en/blackjack/"}">${t.app}</a>
      <a href="/academie/">${t.cours}</a>
      ${alt ? `<a href="/${alt.slug}/" hreflang="${alt.lang}" lang="${alt.lang}">${t.autre}</a>` : ""}
    </nav>
  </div>
</header>

<div class="enveloppe">

<nav class="fil" aria-label="${p.lang === "fr" ? "Fil d'Ariane" : "Breadcrumb"}">${filHtml}</nav>

<main>
<article>
${corps}
</article>
${suite}
</main>

<footer>
<p class="ours" style="border:0;padding:0;margin:0 0 14px">
  <span>${t.publie} <time datetime="${p.publie}">${dateLisible(p.publie, p.lang)}</time></span>
  ${p.modifie && p.modifie !== p.publie ? `<span class="pt">·</span><span>${t.modifie} <time datetime="${p.modifie}">${dateLisible(p.modifie, p.lang)}</time></span>` : ""}
  <span class="pt">·</span><span>${t.lecture(minutes)}</span>
</p>
${t.methode(MAINS.toLocaleString(p.lang === "fr" ? "fr-FR" : "en-US"))}
${t.ours}
<div class="aide">${t.aide}</div>
<p>${t.pied} · <a href="/">WiseHand</a>${alt ? ` · <a href="/${alt.slug}/" hreflang="${alt.lang}" lang="${alt.lang}">${t.autre}</a>` : ""}</p>
</footer>

</div>
</body>
</html>
`;

  const dossier = p.slug ? p.slug : ".";
  mkdirSync(dossier, { recursive: true });
  writeFileSync(`${dossier}/index.html`, page);
  return { slug: p.slug, mots, minutes, ko: Math.round(page.length / 1024) };
}

// ── Tout construire ──────────────────────────────────────────────────────────
const faits = PAGES.map(construire);
for (const f of faits) console.log(`  /${f.slug}/`.padEnd(46) + `${String(f.mots).padStart(5)} mots · ${f.minutes} min · ${f.ko} Ko`);
console.log(`\n${faits.length} pages construites, ${faits.reduce((n, f) => n + f.mots, 0)} mots au total`);

// ── Le plan du site ──────────────────────────────────────────────────────────
// ⚠️ `lastmod` est la VRAIE date de dernière modification déclarée au catalogue.
// La gonfler à chaque déploiement apprend au robot à l'ignorer.
// Un plan de site n'est pas un inventaire de fichiers : ni .webp, ni manifeste, ni sw.js.
const plan = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Écrit par outils/pages.mjs. Ne pas modifier à la main : la prochaine construction
     l'écraserait. Une page s'ajoute au plan en s'ajoutant à src/pages/catalogue.mjs. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">

  <url>
    <loc>${url("")}</loc>
    <lastmod>${PAGES.map(p => p.modifie || p.publie).sort().pop()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
${PAGES.map(p => {
  const alt = p.alt ? PAGES.find(x => x.slug === p.alt) : null;
  return `
  <url>
    <loc>${url(p.slug)}</loc>
    <lastmod>${p.modifie || p.publie}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${p.priorite || "0.7"}</priority>${alt ? `
    <xhtml:link rel="alternate" hreflang="${p.lang}" href="${url(p.slug)}"/>
    <xhtml:link rel="alternate" hreflang="${alt.lang}" href="${url(alt.slug)}"/>` : ""}
  </url>`;
}).join("")}

</urlset>
`;
writeFileSync("sitemap.xml", plan);
console.log(`sitemap.xml : ${PAGES.length + 1} URL`);

// ── llms.txt ─────────────────────────────────────────────────────────────────
// La convention llmstxt.org : un plan de site LISIBLE, pour les modèles qui vont le
// chercher avant de crawler. Ce n'est pas un standard adopté par les moteurs ; il ne
// coûte rien et il dit en clair ce que le site sait faire que les autres ne savent pas.
// ⚠️ Il ne remplace ni robots.txt ni sitemap.xml, et ne prétend pas les remplacer.
const pre = JSON.parse(readFileSync("src/precalcul.json", "utf8")).donnees;
const parAv = pre.catalogue.slice().sort((a, b) => pre.tables[a.id].avantage - pre.tables[b.id].avantage);
const llms = `# WiseHand

> Entraîneur de comptage de cartes au blackjack, gratuit, sans compte, sans publicité et
> sans argent réel. Code ouvert (MIT). Il tourne entièrement dans le navigateur.

Ce que ce site a et que les autres n'ont pas : ses chiffres ne sont pas recopiés. Un
solveur calcule la stratégie de base pour chaque règlement de table, et un simulateur
MESURE l'avantage maison sur ${(pre.mains || 3e6).toLocaleString("fr-FR")} mains par variante,
graine fixe, résultat reproductible. Dernier calcul : ${pre.genere}.

Avantage maison mesuré, des dix tables du catalogue, de la meilleure à la pire :
${parAv.map(t => `- ${t.nom} — ${t.jeux} jeu${t.jeux > 1 ? "x" : ""}, ${t.h17 ? "H17" : "S17"}, blackjack payé ${t.blackjackPays === 1.5 ? "3:2" : "6:5"}${t.melange === "melangeuse_continue" ? ", mélangeuse continue" : `, coupe à ${Math.round(t.penetration * 100)} %`} : **${pre.tables[t.id].avantage.toFixed(3).replace(".", ",")} %**`).join("\n")}

Index d'assurance calculé : compte vrai **+3** (identique sur les dix tables).

## L'application

- [WiseHand](${url("")}) : dix tables, exercices de comptage, stratégie et écarts au compte, table à plusieurs sans serveur, fonctionne hors ligne.

## Le cours

${ORDRE_ACADEMIE.map(s => { const p = PAGES.find(x => x.slug === s); return p ? `- [${p.titre}](${url(p.slug)}) : ${p.desc}` : ""; }).filter(Boolean).join("\n")}

## Les pages de fond

${PAGES.filter(p => !p.section && p.lang === "fr" && p.slug).map(p => `- [${p.titre}](${url(p.slug)}) : ${p.desc}`).join("\n")}

## En anglais

${PAGES.filter(p => p.lang === "en").map(p => `- [${p.titre}](${url(p.slug)}) : ${p.desc}`).join("\n")}

## Ce que ce site ne dit pas

Le comptage de cartes ne rend personne riche. Il renverse un avantage de quelques
dixièmes de pour cent, sur des milliers de mains, à condition de ne jamais se tromper.
Aucune page de ce site ne conseille de jouer de l'argent, ne promet un gain, ni
n'explique comment tricher. Le blackjack est un jeu d'argent, et un jeu d'argent se
perd à long terme.
`;
writeFileSync("llms.txt", llms);
console.log(`llms.txt : ${Math.round(llms.length / 1024)} Ko`);
