// Capture d'écran d'une vue, à une taille, dans un thème — pour REGARDER son travail.
//
//   node outils/capturer.mjs <vue> [LxH] [sortie.png] [--donne] [--sombre|--clair] [--table=id] [--attendre=ms] [--puis=idBouton] [--attendre2=ms] [--mise] [--sansmise]
//
//   --mise      : pose une mise (un jeton qui couvre le minimum) sans distribuer — la phase de mise.
//   --donne     : pose la mise PUIS distribue (la donne exige une mise depuis le lot Jetons).
//   --sansmise  : avec --donne, ne pose rien (pour voir le bouton fermé).
//   --reseau    : ouvre une table À PLUSIEURS (transport muet, sans courtier), s'assoit et mise.
//   --reseau=attente : la même, avant de s'asseoir — la table qui attend des joueurs.
//   --reseau=amis : la même, assis, avec deux amis fictifs poussés par le transport muet
//                   (ils saluent l'hôte et s'assoient) — les vignettes vidéo en attente.
//   --puis=a,b  : plusieurs identifiants, cliqués dans l'ordre (ex. bReglages,relaisOuvrir).
//   --jouer     : après la donne, joue la main jusqu'au règlement (Rester), puis attend --attendre2 ms.
//
//   node outils/capturer.mjs table 1280x800 /tmp/table.png --donne
//   node outils/capturer.mjs table 375x667 /tmp/tel.png --donne --table=cotai
//
// Même moteur que mesurer.mjs : Chrome headless piloté par le protocole DevTools
// (`--window-size` est ignoré en headless, seule l'émulation fait foi).
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { extname } from "node:path";

const args = process.argv.slice(2);
// La valeur peut contenir des « = » (une expression JS pour --sonde) : on coupe au PREMIER seulement.
const opt = Object.fromEntries(args.filter(a => a.startsWith("--")).map(a => { const i = a.indexOf("="); return i < 0 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)]; }));
const pos = args.filter(a => !a.startsWith("--"));
const vue = pos[0] || "table";
const [L, H] = (pos[1] || "1280x800").split("x").map(Number);
const sortie = pos[2] || `/tmp/capture-${vue}-${L}x${H}.png`;

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 8750 + Math.floor(Math.random() * 200), CDP = 9400 + Math.floor(Math.random() * 200);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
const serveur = createServer((q, r) => {
  const f = (q.url === "/" ? "/index.html" : q.url).split("?")[0].replace(/\.\./g, "");
  let corps; try { corps = readFileSync("." + f); } catch (e) { r.writeHead(404); return r.end("non"); }
  r.writeHead(200, { "content-type": TYPES[extname(f)] || "text/plain" }); r.end(corps);
}).listen(PORT);
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
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
await cdp("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html` });
await dodo(1500);
if (opt.table) await evaluer(`(() => { try { const d = JSON.parse(localStorage.getItem("sabot") || "{}"); d.table = ${JSON.stringify(opt.table)}; localStorage.setItem("sabot", JSON.stringify(d)); } catch (e) {} })()`);
if (opt.table) { await cdp("Page.reload"); await dodo(1500); }
await evaluer(`(document.querySelector('[data-vue="${vue}"]')||{click(){}}).click()`);
await dodo(700);
if (opt.reseau) {
  await evaluer(`(document.querySelector('nav [data-vue="ensemble"]')||{click(){}}).click()`); await dodo(300);
  await evaluer(`window.__reseauTransport = o => { window.__reseauEntrant = o.onMessage; return { publier() {}, fermer() {} }; }; document.getElementById("mpCreer").click()`); await dodo(1600);
  if (opt.reseau !== "attente") { await evaluer(`(document.querySelector("#sieges .siege.vide .asseoir")||{click(){}}).click()`); await dodo(500); }
  if (opt.reseau === "amis") {
    await evaluer(`(() => { const r = window.__reseauEntrant; if (!r) return;
      for (const [id, nom, c, k] of [["jAmi1", "Sonia", "#c0392b", 2], ["jAmi2", "Karim", "#1f6f4a", 4]]) {
        r({ t: "salut", id, nom, couleur: c }); r({ t: "action", id, a: "asseoir", v: k, nom, couleur: c }); } })()`);
    await dodo(700);
  }
}
const MISER = `(async () => { const q = s => document.querySelector(s), dodo = ms => new Promise(r => setTimeout(r, ms));
  for (let g = 0; g < 30 && q("#bDonne") && q("#bDonne").disabled; g++) {
    const rack = q("#rackJetons"), min = rack ? +(rack.dataset.min || 5) : 5;
    const libres = [...document.querySelectorAll("#rjJetons button:not([disabled])")];
    const j = libres.find(b => +b.dataset.v >= min) || libres[libres.length - 1];
    if (!j) break; j.click(); await dodo(90);
  } })()`;
// --jouer joue une main : il MISE et il DISTRIBUE, sinon il n'y a rien à jouer. Mesuré le
// 06/09 : lancé seul, il tournait 120 × 150 ms = 18 s sur une table vide puis écrivait la
// capture en annonçant « après une donne » — une phase de mise intacte livrée pour un
// règlement demandé. Personne ne pouvait relire le règlement avec cet outil.
if (opt.jouer && !opt.donne) opt.donne = true;
if ((opt.donne && !opt.sansmise) || opt.mise) { await evaluer(MISER); await dodo(opt.donne ? 350 : +(opt.attendre || 900)); }
if (opt.donne) { await evaluer(`(document.getElementById("bDonne")||{click(){}}).click()`); await dodo(opt.jouer ? 900 : +(opt.attendre || 3200)); }
// --jouer : joue la main jusqu'au RÈGLEMENT (Rester dès que c'est à toi, jamais d'assurance), puis
// attend --attendre2 ms (700 par défaut) — le moment où les jetons glissent et où le verdict s'inscrit.
if (opt.jouer) {
  await evaluer(`(async () => { const q = s => document.querySelector(s), dodo = ms => new Promise(r => setTimeout(r, ms));
    const phase = () => document.getElementById("v-table").dataset.phase || "";
    for (let g = 0; g < 120 && phase() !== "reglement"; g++) { await dodo(150);
      if (q("#bTire") && !q("#bTire").disabled) q("#bReste").click();
      const a = q("#boiteAssurance .opts button:last-child"); if (a) a.click(); }
    return phase(); })()`);
  const arrive = await evaluer(`document.getElementById("v-table").dataset.phase || ""`);
  // Une capture muette d'un état qu'on n'a pas demandé est pire que pas de capture.
  if (String(arrive) !== "reglement") { console.error(`ÉCHEC --jouer : la table n'a jamais atteint le règlement (phase « ${arrive} ») — aucune capture écrite.`); ws.close(); chrome.kill(); serveur.close(); process.exit(2); }
  await dodo(+(opt.attendre2 || 700));
}
// --puis=bReste : un coup après la donne (pour voir le croupier retourner sa carte, un bust, un gain…).
if (opt.puis) { for (const id of String(opt.puis).split(",")) { await evaluer(`(document.getElementById(${JSON.stringify(id.trim())})||{click(){}}).click()`); await dodo(250); } await dodo(+(opt.attendre2 || 2500)); }
else await dodo(+(opt.attendre || 400));
// --sonde=<expression JS> : imprime sa valeur (JSON) juste avant la capture — pour MESURER ce qu'on regarde.
if (opt.sonde) console.log("SONDE", JSON.stringify(await evaluer(String(opt.sonde))));
const erreurs = await evaluer(`(window.__err || []).join(" / ")`);
const shot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
writeFileSync(sortie, Buffer.from(shot.result.data, "base64"));
console.log(`${sortie}  (${L}×${H}, vue ${vue}${opt.jouer ? ", au règlement" : opt.donne ? ", après une donne" : ""}${erreurs ? " — ERREURS JS : " + erreurs : ""})`);
ws.close(); chrome.kill(); serveur.close(); process.exit(0);
