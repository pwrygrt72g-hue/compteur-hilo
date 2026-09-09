// ─────────────────────────────────────────────────────────────────────────────
// outils/indexnow.mjs — annonce les URL du site à Bing, Yandex, Seznam et Naver.
//
//   node outils/indexnow.mjs            → SIMULATION (n'envoie rien)
//   node outils/indexnow.mjs --envoyer  → envoie pour de vrai
//
// POURQUOI CET OUTIL EXISTE. Le 9 septembre 2026, le site n'était indexé nulle
// part : zéro URL sur Bing, zéro sur Brave, et même la requête de marque
// « wisehand21 » ne le renvoyait pas. robots.txt déclare pourtant le plan du
// site et rien ne bloque personne — il ne manquait que le DÉCLENCHEUR. Google
// n'en a pas d'autre que la Search Console, qui demande un compte ; IndexNow,
// lui, ne demande rien qu'un fichier de clé servi par le domaine.
//
// 🚨 CE N'EST PAS UN SUBSTITUT À LA SEARCH CONSOLE. Google ne participe PAS à
// IndexNow. Cet outil couvre Bing (donc l'index dont se servent ChatGPT et
// Copilot — exactement le canal que robots.txt dit chercher), Yandex, Seznam et
// Naver. Il ne dispense de rien côté Google.
//
// 🚨 SIMULATION PAR DÉFAUT. Annoncer des URL est une action SORTANTE : elle part
// vers des serveurs qu'on ne contrôle pas et on ne la reprend pas. Le défaut est
// donc de ne rien envoyer et de montrer ce qui partirait — la même règle que
// pour tout ce qui sort d'ici.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync } from "node:fs";

const RACINE = "https://wisehand21.com";
const envoyer = process.argv.includes("--envoyer");

// La clé est le fichier .txt de 32 caractères hexadécimaux posé à la racine du
// dépôt. On la LIT plutôt que de l'écrire ici : deux copies d'une même clé
// finiraient par diverger, et c'est le fichier servi qui fait foi.
const fichiers = readdirSync(".").filter(f => /^[0-9a-f]{8,128}\.txt$/.test(f));
if (fichiers.length !== 1) {
  console.error(`✗ il faut EXACTEMENT un fichier de clé à la racine, j'en vois ${fichiers.length}`);
  process.exit(1);
}
const cle = fichiers[0].replace(/\.txt$/, "");
const contenu = readFileSync(fichiers[0], "utf8").trim();
if (contenu !== cle) {
  console.error(`✗ ${fichiers[0]} doit contenir EXACTEMENT sa clé (lu : « ${contenu.slice(0, 40)} »)`);
  process.exit(1);
}

// Les URL viennent du plan du site, jamais d'une liste écrite ici : une page
// ajoutée au catalogue est annoncée sans qu'on y pense.
const urls = [...readFileSync("sitemap.xml", "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
if (!urls.length) { console.error("✗ sitemap.xml ne contient aucune URL"); process.exit(1); }

console.log(`clé      ${cle}`);
console.log(`fichier  ${RACINE}/${fichiers[0]}`);
console.log(`urls     ${urls.length}`);
for (const u of urls) console.log("         " + u);

if (!envoyer) {
  console.log("\nSIMULATION — rien n'a été envoyé. Relance avec --envoyer pour annoncer pour de vrai.");
  process.exit(0);
}

// 🚨 FAIL-CLOSED : sans fichier de clé JOIGNABLE, chaque envoi repartirait en
// 403 et on croirait avoir annoncé le site alors que rien n'est parti. On
// vérifie donc d'abord ce que le monde extérieur voit, pas ce qu'on a sur le disque.
const verif = await fetch(`${RACINE}/${fichiers[0]}`);
const vu = (await verif.text()).trim();
if (!verif.ok || vu !== cle) {
  console.error(`✗ le fichier de clé n'est pas servi correctement (HTTP ${verif.status}, lu « ${vu.slice(0, 40)} »).`);
  console.error("  Publie-le d'abord : sans lui, toute annonce est refusée.");
  process.exit(1);
}
console.log("\n✓ fichier de clé servi et conforme");

const r = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: new URL(RACINE).host,
    key: cle,
    keyLocation: `${RACINE}/${fichiers[0]}`,
    urlList: urls,
  }),
});
const corps = await r.text();
// 200 = accepté · 202 = accepté, clé en cours de validation. Tout le reste est un refus.
console.log(`\nréponse  HTTP ${r.status}${corps ? "  " + corps.slice(0, 200) : ""}`);
if (r.status !== 200 && r.status !== 202) {
  console.error("✗ refusé — rien n'a été annoncé.");
  process.exit(1);
}
console.log(`✓ ${urls.length} URL annoncées à Bing, Yandex, Seznam et Naver.`);
console.log("  ⚠️ Google ne participe pas à IndexNow : la Search Console reste nécessaire.");
