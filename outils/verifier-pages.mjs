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

const PAGES = ["blackjack/index.html", "en/blackjack/index.html"];
let ko = 0, ok = 0;
const dire = (bon, quoi, detail) => { if (bon) { ok++; } else { ko++; console.log("KO  " + quoi + (detail ? "  → " + detail : "")); } };

const pre = JSON.parse(readFileSync("src/precalcul.json", "utf8")).donnees;
const AV = pre.tables, CAT = pre.catalogue;
const texteNu = h => h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ")
  .replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]*>/g, " ")
  .replace(/&nbsp;|&#8239;|&#160;/g, " ").replace(/&rsquo;|&#8217;/g, "'").replace(/\s+/g, " ").trim();

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
  const bornes = new Set(["0,36", "0,63", "1,4", "1,5", "0,5", "0,2", "1,35", "2,26"]);   // écarts théoriques et fourchettes, pas des mesures de table
  for (const c of new Set(cites))
    dire(arrondis.has(c) || bornes.has(c),
      p + " : le pourcentage cité vient d'une mesure du dépôt", c + " %");

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
if (existsSync("sitemap.xml")) {
  const sm = readFileSync("sitemap.xml", "utf8");
  for (const p of PAGES) {
    const url = "https://wisehand21.com/" + p.replace(/index\.html$/, "");
    const dansPlan = sm.includes("<loc>" + url + "</loc>");
    const horsIndex = /name="robots"[^>]*noindex/.test(readFileSync(p, "utf8"));
    dire(!(dansPlan && horsIndex), "cohérence : " + url + " n'est pas à la fois au plan de site et en noindex");
    dire(dansPlan || horsIndex, "cohérence : " + url + " est soit au plan de site, soit explicitement en noindex");
  }
}

console.log(`\n${ok} contrôles passés, ${ko} échecs`);
process.exit(ko ? 1 : 0);
