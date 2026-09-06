// Le banc du SON : on ne peut pas écouter un Chrome headless, on peut MESURER ce qu'il rend.
// Chaque genre de son (socle.js, synthese) est rendu dans un OfflineAudioContext par la page
// elle-même (window.__rendreSon), et on relève sa crête, son niveau efficace et sa durée réelle.
//
//   node outils/ecouter.mjs            → un tableau, et « SON : tout passe » si chaque son est
//                                        audible (crête ≥ 0,05), ne sature pas (≤ 1) et dure ce qu'il annonce.
//
// Même moteur que capturer.mjs : Chrome piloté par le protocole DevTools.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { extname } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 8950 + Math.floor(Math.random() * 40), CDP = 9600 + Math.floor(Math.random() * 40);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
const serveur = createServer((q, r) => {
  const f = (q.url === "/" ? "/index.html" : q.url).split("?")[0].replace(/\.\./g, "");
  let corps; try { corps = readFileSync("." + f); } catch (e) { r.writeHead(404); return r.end("non"); }
  r.writeHead(200, { "content-type": TYPES[extname(f)] || "text/plain" }); r.end(corps);
}).listen(PORT);
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-sandbox", "--remote-debugging-port=" + CDP, "--remote-allow-origins=*", "about:blank"], { stdio: "ignore" });
const dodo = ms => new Promise(r => setTimeout(r, ms));
const attendre = async (url, n = 60) => { for (let i = 0; i < n; i++) { try { return await (await fetch(url)).json(); } catch (e) { await dodo(250); } } throw new Error("Chrome muet"); };
const cibles = await attendre(`http://127.0.0.1:${CDP}/json/list`);
const ws = new WebSocket(cibles.find(c => c.type === "page").webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener("open", r));
let id = 0; const attentes = new Map();
ws.addEventListener("message", e => { const m = JSON.parse(e.data); if (m.id && attentes.has(m.id)) { attentes.get(m.id)(m); attentes.delete(m.id); } });
const cdp = (method, params = {}) => new Promise(res => { const n = ++id; attentes.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluer = async expr => { const r = await cdp("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); return r.result?.result?.value; };
await cdp("Page.enable"); await cdp("Runtime.enable");
await cdp("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html` });
await dodo(1500);

// Ce que chaque son ANNONCE (durée approximative rendue par synthese), et ce qu'on exige de lui.
const GENRES = ["carte", "pose", "jeton", "jetons", "raclement", "blackjack", "bust", "gain", "ok", "ko", "alerte"];
/* Les trois FAMILLES. Un banc qui ne vérifie qu'« audible » et « ne sature pas » laisse
   passer 26 dB d'écart entre une carte et un bust — c'est ce qu'on mesurait le 06/09 :
   l'application criait quand on perdait et chuchotait quand on gagnait. Un son ne doit pas
   s'écarter de plus de 8 dB de la médiane de sa famille, sinon la dérive revient en silence. */
const FAMILLES = { geste: ["carte", "pose", "jeton", "jetons", "raclement"],
  verdict: ["blackjack", "bust", "gain"], retour: ["ok", "ko", "alerte"] };
const ECART_MAX_DB = 8;
const rms = {};
const echecs = [];
console.log("genre        crête   rms      durée   annoncée");
for (const g of GENRES) {
  const r = await evaluer(`window.__rendreSon(${JSON.stringify(g)})`);
  if (!r) { echecs.push(g + " : rien rendu"); console.log(g.padEnd(12) + "—"); continue; }
  console.log(g.padEnd(12) + String(r.crete).padEnd(8) + String(r.rms).padEnd(9) + (r.duree + " s").padEnd(8) + r.annonce + " s");
  if (r.crete < .05) echecs.push(g + " : inaudible (crête " + r.crete + ")");
  if (r.crete > 1) echecs.push(g + " : sature (crête " + r.crete + ")");
  if (r.duree > r.annonce * 1.6 + .1) echecs.push(g + " : dure " + r.duree + " s pour " + r.annonce + " annoncés");
  if (r.duree < .02) echecs.push(g + " : trop court (" + r.duree + " s)");
  rms[g] = r.rms;
}
// Le NIVEAU : chaque famille tient dans 8 dB autour de sa médiane.
const dB = (a, b) => 20 * Math.log10(a / b);
console.log("\nfamille      médiane   écart max");
for (const [nom, genres] of Object.entries(FAMILLES)) {
  const vals = genres.map(g => rms[g]).filter(v => v > 0).sort((a, b) => a - b);
  if (vals.length < 2) continue;
  const med = vals[Math.floor(vals.length / 2)];
  let pire = 0, quiPire = "";
  for (const g of genres) { const e = Math.abs(dB(rms[g] || med, med)); if (e > pire) { pire = e; quiPire = g; } }
  console.log(nom.padEnd(12) + med.toFixed(4).padEnd(10) + pire.toFixed(1) + " dB (" + quiPire + ")");
  if (pire > ECART_MAX_DB) echecs.push(`famille « ${nom} » : ${quiPire} à ${pire.toFixed(1)} dB de la médiane (plafond ${ECART_MAX_DB})`);
}
// Jamais deux fois la même hauteur de suite : on rend deux fois le même son et on compare les échantillons.
const distincts = await evaluer(`(async () => {
  const a = await window.__rendreSon("jetons"), b = await window.__rendreSon("jetons"); return a.rms !== b.rms || a.duree !== b.duree; })()`);
if (!distincts) echecs.push("deux « jetons » de suite sont identiques");
console.log("\n" + (echecs.length ? "✗ SON : " + echecs.length + " défaut(s)\n  " + echecs.join("\n  ") : "✓ SON : tout passe (" + GENRES.length + " sons audibles, sans saturation, aux durées annoncées)"));
ws.close(); chrome.kill(); serveur.close(); process.exit(echecs.length ? 1 : 0);
