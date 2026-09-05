// Teste un relais TURN depuis un VRAI Chrome, sans ami et sans caméra :
//
//   node outils/tester-relais.mjs <adresse> <utilisateur> <mot-de-passe> [délai ms]
//   node outils/tester-relais.mjs                       → le TURN Open Relay qui était inscrit en dur
//
// La même fonction que le bouton « Tester le relais » de ⚙ (src/visio.mjs, testerRelais) :
// une RTCPeerConnection en iceTransportPolicy:"relay" ne peut produire QUE des candidats
// relay — s'il en arrive un, le relais a alloué. Sortie 0 si oui, 1 sinon, avec la raison.
// C'est ce banc qui a établi, le 5 septembre 2026, qu'Open Relay était mort.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, rmSync, existsSync } from "node:fs";
import { extname, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const RACINE = dirname(dirname(fileURLToPath(import.meta.url)));
const [url, user, pass, delai] = process.argv.slice(2);
const turn = url ? { url, user: user || "", pass: pass || "" }
  : { url: "turn:openrelay.metered.ca:80, turn:openrelay.metered.ca:443, turns:openrelay.metered.ca:443", user: "openrelayproject", pass: "openrelayproject" };
const DELAI = +(delai || 8000);
const TYPES = { ".html": "text/html; charset=utf-8", ".mjs": "text/javascript" };
const serveur = createServer((q, r) => {
  const f = q.url.split("?")[0].replace(/\.\./g, "");
  let corps; try { corps = readFileSync(join(RACINE, f)); } catch (e) { r.writeHead(404); return r.end("non"); }
  r.writeHead(200, { "content-type": TYPES[extname(f)] || "text/plain" }); r.end(corps);
}).listen(0);
const PORT = serveur.address().port;
const dodo = ms => new Promise(r => setTimeout(r, ms));
const profil = "/tmp/relais-banc";
try { rmSync(profil, { recursive: true, force: true }); } catch (e) {}
const proc = spawn(CHROME, ["--headless=new", "--no-sandbox", "--disable-gpu", "--user-data-dir=" + profil, "--remote-debugging-port=0", "--remote-allow-origins=*", "about:blank"], { stdio: "ignore", detached: true });
let cdpPort = 0;
for (let i = 0; i < 80 && !cdpPort; i++) { try { if (existsSync(profil + "/DevToolsActivePort")) cdpPort = +readFileSync(profil + "/DevToolsActivePort", "utf8").split("\n")[0]; } catch (e) {} if (!cdpPort) await dodo(250); }
if (!cdpPort) { console.log("Chrome n'a pas démarré."); process.exit(2); }
let cibles; for (let i = 0; i < 80; i++) { try { cibles = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json(); break; } catch (e) { await dodo(250); } }
const ws = new WebSocket(cibles.find(c => c.type === "page").webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej); });
let id = 0; const attentes = new Map();
ws.addEventListener("message", e => { const m = JSON.parse(e.data); if (m.id && attentes.has(m.id)) { attentes.get(m.id)(m); attentes.delete(m.id); } });
const cdp = (method, params = {}) => new Promise(res => { const k = ++id; attentes.set(k, res); ws.send(JSON.stringify({ id: k, method, params })); });
const evaluer = async expr => { const r = await cdp("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); return r.result && r.result.result ? r.result.result.value : null; };
await cdp("Page.enable"); await cdp("Runtime.enable");
await cdp("Page.navigate", { url: `http://127.0.0.1:${PORT}/outils/relais-banc.html` });
for (let i = 0; i < 40 && !(await evaluer("!!window.__pret")); i++) await dodo(250);
console.log(`Relais : ${turn.url}\nUtilisateur : ${turn.user || "(vide)"} · délai ${DELAI} ms`);
console.log("Serveurs ICE construits :", JSON.stringify(await evaluer(`window.__serveursIce(${JSON.stringify(turn)})`)));
const r = await evaluer(`window.__testerRelais(${JSON.stringify(turn)}, ${DELAI})`);
console.log(r && r.ok ? `\n✓ RELAIS JOIGNABLE : un candidat relay en ${(r.ms / 1000).toFixed(2)} s${r.candidat ? " (" + r.candidat + (r.protocole ? ", " + r.protocole : "") + ")" : ""}`
  : `\n✗ RELAIS MORT OU REFUSÉ après ${r ? (r.ms / 1000).toFixed(2) : "?"} s : ${r ? r.raison : "pas de réponse du banc"}`);
try { ws.close(); } catch (e) {} try { process.kill(-proc.pid, "SIGKILL"); } catch (e) { try { proc.kill("SIGKILL"); } catch (_) {} }
serveur.close(); try { rmSync(profil, { recursive: true, force: true }); } catch (e) {}
process.exit(r && r.ok ? 0 : 1);
