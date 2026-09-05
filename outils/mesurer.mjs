// Banc de mesure responsive, sans dépendance : Node 22 a WebSocket en natif.
//
// ⚠️ `--window-size` est IGNORÉ par le headless de Chrome en `--dump-dom` — toutes
// les mesures rendent alors la même taille quelle que soit celle demandée, et un
// relevé « responsive » fait comme ça mesure toujours le même écran. Il faut passer
// par le protocole DevTools et `Emulation.setDeviceMetricsOverride`.
//
//   node outils/mesurer.mjs [vue…]
//
// « reseau » est une vue de plus : la table À PLUSIEURS (transport muet, deux amis
// fictifs assis, vignettes vidéo en attente), soumise aux MÊMES assertions que la table
// solo — elle doit tenir dans un écran avec ses têtes. À mettre en DERNIER : elle
// laisse la scène en mode réseau (on quitte la table à la fin, mais on ne rejoue pas la donne).
//
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { extname } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 8749, CDP = 9333;
const TAILLES = [
  ["téléphone étroit", 360, 640], ["iPhone SE", 375, 667], ["iPhone 14", 390, 844],
  ["TÉLÉPHONE COUCHÉ", 844, 390], ["tablette portrait", 768, 1024],
  ["tablette paysage", 1024, 768], ["portable", 1280, 800], ["grand écran", 1920, 1080],
];
const VUES = process.argv.slice(2).length ? process.argv.slice(2)
  : ["accueil", "salon", "table", "exercices", "strategie", "concentration", "ensemble", "progres"];

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
const serveur = createServer((q, r) => {
  const f = (q.url === "/" ? "/index.html" : q.url).split("?")[0].replace(/\.\./g, "");
  let corps; try { corps = readFileSync("." + f); } catch (e) { r.writeHead(404); return r.end("non"); }
  r.writeHead(200, { "content-type": TYPES[extname(f)] || "text/plain" }); r.end(corps);
}).listen(PORT);

const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-sandbox",
  "--remote-debugging-port=" + CDP, "--remote-allow-origins=*", "about:blank"], { stdio: "ignore" });

const dodo = ms => new Promise(r => setTimeout(r, ms));
const attendre = async (url, n = 60) => {
  for (let i = 0; i < n; i++) { try { return await (await fetch(url)).json(); } catch (e) { await dodo(250); } }
  throw new Error("Chrome ne répond pas sur " + url);
};

const cibles = await attendre(`http://127.0.0.1:${CDP}/json/list`);
const ws = new WebSocket(cibles.find(c => c.type === "page").webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener("open", r));
let id = 0; const attentes = new Map();
ws.addEventListener("message", e => {
  const m = JSON.parse(e.data);
  if (m.id && attentes.has(m.id)) { attentes.get(m.id)(m); attentes.delete(m.id); }
});
const cdp = (method, params = {}) => new Promise(res => {
  const n = ++id; attentes.set(n, res); ws.send(JSON.stringify({ id: n, method, params }));
});
const evaluer = async expr => {
  const r = await cdp("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result && r.result.exceptionDetails) return { erreur: r.result.exceptionDetails.text };
  return r.result && r.result.result ? r.result.result.value : null;
};

await cdp("Page.enable"); await cdp("Runtime.enable");

// La sonde : ce qui compte pour juger un écran, pas ce qui est facile à mesurer.
const SONDE = `(() => {
  const q = s => document.querySelector(s);
  const vh = innerHeight, vw = innerWidth;
  const doc = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  const dep = [...document.querySelectorAll("body *")].filter(e => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && (r.right > vw + 1 || r.left < -1);
  }).slice(0, 4).map(e => (e.id ? "#" + e.id : e.className && typeof e.className === "string" ? "." + e.className.split(" ")[0] : e.tagName));
  const y = s => { const e = q(s); if (!e) return null; const r = e.getBoundingClientRect(); return Math.round(r.bottom); };
  const h = s => { const e = q(s); if (!e) return null; return Math.round(e.getBoundingClientRect().height); };
  // Une case à cocher ou un bouton radio DANS un <label> : c'est le label qui reçoit le
  // doigt (cliquer le texte coche la case), donc c'est LUI qu'on mesure — nommé par l'id
  // de la case, pour retrouver le champ. Une case nue, hors label, reste mesurée telle quelle.
  const cible = e => (e.matches("input[type=checkbox],input[type=radio]") && e.closest("label")) || e;
  const petits = [...document.querySelectorAll("button:not([hidden]), input, select, summary")]
    .filter(e => { const r = cible(e).getBoundingClientRect(); return r.width > 0 && (r.height < 44 || r.width < 24); })
    .map(e => { const r = cible(e).getBoundingClientRect(); return (e.id || e.className || e.tagName) + " " + Math.round(r.width) + "×" + Math.round(r.height); });
  const largeurDoc = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  return { vw, vh, doc, defile: Math.max(0, doc - vh), ecrans: +(doc / vh).toFixed(2),
    deborde: largeurDoc > vw + 1 ? dep : [], largeurDoc, hEntete: h("header"),
    yCoups: y("#coups"), hTapis: h("#plateau"), hSieges: h("#sieges"),
    bandes: { tete: h(".tete"), padHaut: q("header") ? parseFloat(getComputedStyle(q("header")).paddingTop) : null,
      barre: h(".hud"), salle: h(".salle"), haute: h(".rangee-haute"), annonce: h("#annonce"), conseil: h("#conseil"),
      actions: h(".zone-actions"), vTable: h("#v-table"), main: h("main") },
    petits: [...new Set(petits)].slice(0, 6) };
})()`;

const MISER = `(async () => { const q = s => document.querySelector(s), dodo = ms => new Promise(r => setTimeout(r, ms));
  for (let g = 0; g < 30 && q("#bDonne") && q("#bDonne").disabled; g++) {
    const rack = q("#rackJetons"), min = rack ? +(rack.dataset.min || 5) : 5;
    const libres = [...document.querySelectorAll("#rjJetons button:not([disabled])")];
    const j = libres.find(b => +b.dataset.v >= min) || libres[libres.length - 1];
    if (!j) break; j.click(); await dodo(90);
  } })()`;
const rapport = [];
for (const [nom, L, H] of TAILLES) {
  await cdp("Emulation.setDeviceMetricsOverride", { width: L, height: H, deviceScaleFactor: 1, mobile: L < 900 });
  await cdp("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html` });
  await dodo(1400);
  for (const v of VUES) {
    if (v === "reseau") {
      await evaluer(`(document.querySelector('nav [data-vue="ensemble"]')||{click(){}}).click()`); await dodo(300);
      await evaluer(`window.__reseauTransport = o => { window.__reseauEntrant = o.onMessage; return { publier() {}, fermer() {} }; }; document.getElementById("mpCreer").click()`); await dodo(1500);
      await evaluer(`(document.querySelector("#sieges .siege.vide .asseoir")||{click(){}}).click()`); await dodo(500);
      await evaluer(`(() => { const r = window.__reseauEntrant; if (!r) return; for (const [id, nom, c, k] of [["jAmi1", "Sonia", "#c0392b", 2], ["jAmi2", "Karim", "#1f6f4a", 4]]) { r({ t: "salut", id, nom, couleur: c }); r({ t: "action", id, a: "asseoir", v: k, nom, couleur: c }); } })()`);
      await dodo(700); await evaluer(MISER); await dodo(400);
      const m = await evaluer(SONDE);
      if (m && !m.erreur) rapport.push({ taille: nom, L, H, vue: v, ...m });
      await evaluer(`document.getElementById("bReseau").click()`); await dodo(200);
      await evaluer(`(document.getElementById("rsQuitter")||{click(){}}).click()`); await dodo(800);
      continue;
    }
    await evaluer(`(document.querySelector('nav [data-vue="${v}"]')||{click(){}}).click()`);
    await dodo(v === "table" ? 900 : 350);
    // La donne exige une mise (lot Jetons) : on tape un jeton qui couvre le minimum avant de distribuer.
    if (v === "table") { await evaluer(MISER); await dodo(300); await evaluer(`(document.getElementById("bDonne")||{click(){}}).click()`); await dodo(2600); }
    const m = await evaluer(SONDE);
    if (m && !m.erreur) rapport.push({ taille: nom, L, H, vue: v, ...m });
  }
}

console.log("\n" + "═".repeat(96));
console.log("ÉCRANS À DÉFILER — 1,0 signifie « tout tient dans la fenêtre »");
console.log("═".repeat(96));
const vues = [...new Set(rapport.map(r => r.vue))];
process.stdout.write("vue".padEnd(16));
for (const [n, L, H] of TAILLES) process.stdout.write((L + "×" + H).padStart(11));
console.log();
for (const v of vues) {
  process.stdout.write(v.padEnd(16));
  for (const [n, L, H] of TAILLES) {
    const r = rapport.find(x => x.vue === v && x.L === L && x.H === H);
    const e = r ? r.ecrans : null;
    process.stdout.write((e === null ? "—" : (e > 1.05 ? "▲" : " ") + e.toFixed(2) + "×").padStart(11));
  }
  console.log();
}
const pb = rapport.filter(r => r.deborde.length);
console.log("\nDÉBORDEMENTS HORIZONTAUX :", pb.length ? pb.map(r => `${r.L}×${r.H}/${r.vue} → ${r.deborde.join(",")}`).join(" · ") : "aucun");
const t = rapport.filter(r => r.vue === "table" || r.vue === "reseau");
console.log("\nTABLE — hauteur d'en-tête · bas des coups · feutre · sièges (« reseau » = la table à plusieurs, avec ses vignettes)");
for (const r of t) { const b = r.bandes;
  console.log(`  ${(r.L + "×" + r.H).padEnd(10)}${r.vue === "reseau" ? " (à plusieurs)" : ""} entête ${String(r.hEntete).padStart(4)} px (tete ${b.tete}, pad ${b.padHaut}) · coups à y=${String(r.yCoups).padStart(5)} (fenêtre ${r.vh}) ${r.yCoups > r.vh ? "❌ HORS ÉCRAN" : "✓"} · feutre ${r.hTapis} · sièges ${r.hSieges}`);
  console.log(`             bandes : barre ${b.barre} · salle ${b.salle} · rangée haute ${b.haute} · annonce ${b.annonce} · conseil ${b.conseil} · actions ${b.actions} · #v-table ${b.vTable} · main ${b.main}`); }
const cibles44 = [...new Set(rapport.flatMap(r => r.petits))];
console.log("\nCIBLES TACTILES SOUS 44 px :", cibles44.length ? cibles44.slice(0, 10).join(" · ") : "aucune");

// ── Assertions ────────────────────────────────────────────────────────────
// Le banc IMPRIMAIT ; il ne tombait pas. Six des sept chantiers sont de la mise
// en page : sans assertion par taille, tout se vérifie à l'œil, donc jamais.
// Ordinateur d'abord (Léo, 04/09) : les assertions ne portent que sur les tailles
// ≥ 1024 px. Les lignes téléphone restent IMPRIMÉES — de l'information, pas un
// verdict — jusqu'au jour où le téléphone entre dans le périmètre.
const LARGEUR_STRICTE = 1024;
const echecs = [], infos = [];
let courant = null;
const exiger = (cond, msg) => { if (!cond) (courant && courant.L >= LARGEUR_STRICTE ? echecs : infos).push(msg); };
// Cibles tactiles tolérées sous 44 px : les puces de nav (38 px, scroll-snap),
// la marque (un lien, pas un bouton d'action), et les entrées de formulaire.
const TOLERE = /^(marque|prenom|eJeux|sys)\b|^BUTTON \d+×3[4-9]$/;
for (const r of rapport) {
  courant = r;
  const ou = `${r.L}×${r.H}/${r.vue}`;
  exiger(r.largeurDoc <= r.vw + 1, `${ou} : la page déborde horizontalement (${r.largeurDoc} > ${r.vw}) → ${r.deborde.join(",")}`);
  exiger(r.hEntete <= 64, `${ou} : en-tête de ${r.hEntete} px (plafond 64 — une seule rangée)`);
  if (r.vue === "table" || r.vue === "reseau") {
    exiger(r.ecrans <= 1.03, `${ou} : la table demande ${r.ecrans} écran(s), elle doit tenir dans un`);
    exiger(r.yCoups !== null && r.yCoups <= r.vh, `${ou} : les coups sont hors écran (bas à y=${r.yCoups}, fenêtre ${r.vh})`);
    exiger(r.hSieges >= 60, `${ou} : sièges écrasés à ${r.hSieges} px`);
  }
  for (const c of r.petits) if (!TOLERE.test(c)) exiger(false, `${ou} : cible tactile ${c} sous 44 px`);
}
const uniques = [...new Set(echecs)];
const infosU = [...new Set(infos)];
if (infosU.length) console.log("\nℹ️ téléphone (hors périmètre pour l'instant, non bloquant) : " + infosU.length + " remarque(s)\n  " + infosU.slice(0, 8).join("\n  "));
console.log("\n" + (uniques.length ? "✗ " + uniques.length + " DÉFAUT(S) DE MISE EN PAGE (≥ 1024 px)\n  " + uniques.join("\n  ") : "✓ MISE EN PAGE : tout passe (≥ 1024 px)"));
ws.close(); chrome.kill(); serveur.close(); process.exit(uniques.length ? 1 : 0);
