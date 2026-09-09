// Capture d'écran d'une PAGE ÉDITORIALE (blackjack/, academie/…), à une taille, dans un
// thème — le pendant de capturer.mjs pour ce que fabrique outils/pages.mjs.
//
//   node outils/capturer-page.mjs <chemin> [LxH] [sortie.png] [--sombre|--clair] [--vers=#id]
//   node outils/capturer-page.mjs blackjack/ 375x812 /tmp/fr-tel.png
//   node outils/capturer-page.mjs en/blackjack/ 1440x1100 /tmp/en.png --vers=#chart
//
// 🚨 Pourquoi pas `chrome --screenshot` : (1) `--window-size=375` est CLAMPÉ par la
// fenêtre minimale de Chrome (~500 px) — on croit regarder un téléphone, on regarde
// un recadrage d'ordinateur ; (2) sous le budget de temps virtuel, requestAnimationFrame
// ne tire jamais, donc les révélations au défilement restent à opacité 0 : une capture
// ancrée sur #chart sortait UNIFORMÉMENT VIDE (vécu le 09/09). Ici : émulation d'appareil
// + de VRAIES images, et on attend que rien ne reste éteint avant de capturer.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { extname } from "node:path";

const args = process.argv.slice(2);
const opt = Object.fromEntries(args.filter(a => a.startsWith("--")).map(a => { const i = a.indexOf("="); return i < 0 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)]; }));
const pos = args.filter(a => !a.startsWith("--"));
const chemin = (pos[0] || "blackjack/").replace(/^\//, "");
const [L, H] = (pos[1] || "1280x900").split("x").map(Number);
const sortie = pos[2] || `/tmp/page-${chemin.replace(/\W+/g, "-")}${L}x${H}.png`;

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const CDP = 9400 + Math.floor(Math.random() * 200);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".txt": "text/plain", ".xml": "application/xml" };
const serveur = createServer((q, r) => {
  let f = q.url.split("?")[0].split("#")[0].replace(/\.\./g, "");
  if (f.endsWith("/")) f += "index.html";
  let corps; try { corps = readFileSync("." + f); } catch (e) { r.writeHead(404); return r.end("non"); }
  r.writeHead(200, { "content-type": TYPES[extname(f)] || "text/plain" }); r.end(corps);
}).listen(0);
// Port 0 : le système en choisit un libre — un tirage au sort finit par tomber sur un serveur oublié (vécu : EADDRINUSE 8791).
const PORT = serveur.address().port;
const chrome = spawn(CHROME, ["--headless=new", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox", "--hide-scrollbars",
  "--remote-debugging-port=" + CDP, "--remote-allow-origins=*", "about:blank"], { stdio: "ignore" });
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
await cdp("Emulation.setDeviceMetricsOverride", { width: L, height: H, deviceScaleFactor: 2, mobile: L < 900 });
if (opt.sombre || opt.clair) await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: opt.sombre ? "dark" : "light" }] });
await cdp("Page.navigate", { url: `http://127.0.0.1:${PORT}/${chemin}` });
await dodo(1200);
if (opt.vers) { await evaluer(`(() => { const e = document.querySelector(${JSON.stringify(String(opt.vers))}); if (e) e.scrollIntoView({ block: "start" }); return !!e; })()`); }
// On attend de VRAIES images jusqu'à ce que plus rien ne soit éteint dans la fenêtre.
const eteints = await evaluer(`(async () => { const raf = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  let reste = []; for (let i = 0; i < 12; i++) { await raf();
    reste = [...document.querySelectorAll("main *")].filter(e => { const r = e.getBoundingClientRect();
      return r.height > 0 && r.top < innerHeight && r.bottom > 0 && +getComputedStyle(e).opacity < .99; }).map(e => e.tagName + (e.className ? "." + String(e.className).split(" ")[0] : ""));
    if (!reste.length) break; }
  return reste.slice(0, 6); })()`);
const horizontal = await evaluer(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
// --mesure=<fichier.mjs> : on ÉVALUE un bout de JS dans la page et on imprime ce qu'il rend.
// Regarder une capture ne dit pas si une colonne de chiffres est hors écran de 3 px ou de
// 300 ; la mesure, si. (Vécu le 09/09 : un tableau à trois colonnes lisible à l'œil sur
// l'image, dont les nombres étaient en fait poussés hors du cadre sur téléphone.)
if (opt.mesure) console.log(JSON.stringify(await evaluer(`(() => { ${readFileSync(String(opt.mesure), "utf8")} })()`), null, 1));
const shot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
writeFileSync(sortie, Buffer.from(shot.result.data, "base64"));
console.log(`${sortie}  (${L}×${H}, ${chemin}${opt.vers ? " → " + opt.vers : ""}${opt.sombre ? ", sombre" : ""})${horizontal > 0 ? `  ⚠ DÉBORDEMENT horizontal de ${horizontal} px` : ""}${eteints && eteints.length ? `  ⚠ encore éteints : ${eteints.join(", ")}` : ""}`);
ws.close(); chrome.kill(); serveur.close(); process.exit(0);
