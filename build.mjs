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

// ---- 2. mini-empaqueteur : des modules ES vers une seule portée ----
const ORDRE = ["engine", "solver", "shuffle", "counting", "net"];
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
  src = src.replace(/^import\s*\{([^}]*)\}\s*from\s*["']\.\/(\w+)\.mjs["'];?\s*$/gm, (_, ids, mod) => `const {${ids}} = M.${mod};`);
  src = src.replace(/^export\s+\{[^}]*\};?\s*$/gm, "");
  src = src.replace(/^export\s+/gm, "");
  bundle += `M.${nom} = (function(){\n${src}\nreturn {${noms.join(",")}};\n})();\n`;
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
const MORCEAUX = ["socle.js","cartes.js","salon.js","table.js","jetons.js","croupier.js",
  "exercices.js","strategie.js","concentration.js","ensemble.js","progres.js","clavier.js","demarrage.js"];
const app = MORCEAUX.map(f => {
  try { return `\n/* ═══ ${f} ═══ */\n` + readFileSync(`src/app/${f}`, "utf8"); }
  catch (e) { throw new Error(`morceau d'interface manquant : src/app/${f}`); }
}).join("\n");
const tete = readFileSync("src/app/tete.html", "utf8");

const out = `${tete}
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
//  · index.html  — document complet, pour GitHub Pages et le fichier local.
//    Sans <meta charset>, un serveur qui n'annonce pas l'encodage fait lire
//    la page en latin-1 : tous les accents cassent. Vérifié, pas supposé.
//  · artefact.html — le même corps SANS doctype ni <head>, parce que l'outil
//    Artifact enveloppe le fichier lui-même et refuse ces balises.
writeFileSync("artefact.html", out);
writeFileSync("index.html", `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${out.slice(0, out.indexOf("<style>"))}</head>
<body>
${out.slice(out.indexOf("<style>"))}</body>
</html>
`);
const ko = Math.round(out.length / 1024);
console.log(`\nindex.html écrit : ${ko} Ko, ${out.split("\n").length} lignes, en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
