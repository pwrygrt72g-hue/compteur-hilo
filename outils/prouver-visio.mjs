// La PREUVE que la visio marche : deux vrais navigateurs qui se voient.
//
//   node outils/prouver-visio.mjs
//
// Deux Chrome headless, deux profils, deux ports DevTools, un salon tiré au
// hasard, sur un serveur statique local ; le VRAI courtier MQTT public pour la
// signalisation ; le faux périphérique caméra de Chrome pour les images.
// Puis, dans l'ordre, chaque étape chronométrée :
//   1. les deux se relient au courtier (le même — B est épinglé sur celui de A)
//   2. ≤ 30 s : chaque côté a l'autre en ICE connected/completed ET framesDecoded > 15
//      (des images passent VRAIMENT, c'est le décodeur qui le dit, via getStats)
//   3. on tue B (SIGKILL) : A doit signaler son départ en ≤ 12 s
//   4. on relance B : les deux se revoient en ≤ 30 s
// Sortie 1 avec l'étape fautive et l'état des deux côtés. Si les courtiers
// publics sont capricieux, on dit lequel a servi et on refait UNE fois, en
// évitant celui qui vient d'échouer.
//
// Trois modes en plus, par variable d'environnement, pour prouver ce que le
// passage nu ne montre pas :
//   VISIO_TROIS=1            un troisième navigateur C rejoint : c'est un MAILLAGE,
//                            chacun voit chacun, et le départ de B est vu par A ET C
//   VISIO_SOAK_MS=20000      on tient la connexion N ms et on exige ZÉRO faux départ
//   VISIO_SANS_TESTAMENT=1   B se relie SANS testament MQTT : sa mort ne peut être
//                            vue que par le silence — et doit l'être en ≤ 12 s quand même
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, rmSync, existsSync } from "node:fs";
import { extname, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const RACINE = dirname(dirname(fileURLToPath(import.meta.url)));
// ⚠️ Ports choisis PAR LE SYSTÈME, jamais tirés au sort. Vécu le 4 septembre :
// un port DevTools tiré dans 9500-9525 tombait dans la plage aléatoire de
// capturer.mjs (9400-9599), qu'un autre chantier faisait tourner en même temps.
// Le banc pilotait alors LEUR Chrome — lancé sans faux périphérique — et la
// caméra était « refusée », par intermittence, sans rien qui le dise.
const TYPES = { ".html": "text/html; charset=utf-8", ".mjs": "text/javascript", ".js": "text/javascript", ".json": "application/json" };
const serveur = createServer((q, r) => {
  const f = q.url.split("?")[0].replace(/\.\./g, "");
  let corps; try { corps = readFileSync(join(RACINE, f)); } catch (e) { r.writeHead(404); return r.end("non"); }
  r.writeHead(200, { "content-type": TYPES[extname(f)] || "text/plain" }); r.end(corps);
}).listen(0);
const PORT = serveur.address().port;

const dodo = ms => new Promise(r => setTimeout(r, ms));
const sec = ms => (ms / 1000).toFixed(1) + " s";
const ALPHA = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const codeSalon = () => Array.from({ length: 5 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join("");

// ── Un navigateur piloté par le protocole DevTools (patron de mesurer.mjs) ──
async function lancer(n, url) {
  const profil = "/tmp/visio-" + n;
  try { rmSync(profil, { recursive: true, force: true }); } catch (e) {}
  // `--remote-debugging-port=0` : Chrome prend un port libre et l'écrit dans
  // <profil>/DevToolsActivePort — c'est forcément LE NÔTRE (profil neuf).
  const proc = spawn(CHROME, ["--headless=new", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream",
    "--no-sandbox", "--disable-gpu", "--user-data-dir=" + profil, "--remote-debugging-port=0",
    "--remote-allow-origins=*", "--autoplay-policy=no-user-gesture-required", "about:blank"], { stdio: "ignore", detached: true });
  let cdpPort = 0;
  for (let i = 0; i < 80 && !cdpPort; i++) {
    try { if (existsSync(profil + "/DevToolsActivePort")) cdpPort = +readFileSync(profil + "/DevToolsActivePort", "utf8").split("\n")[0]; } catch (e) {}
    if (!cdpPort) await dodo(250);
  }
  if (!cdpPort) throw new Error("Chrome " + n + " n'a pas écrit DevToolsActivePort dans " + profil);
  const attendre = async (u, k = 80) => {
    for (let i = 0; i < k; i++) { try { return await (await fetch(u)).json(); } catch (e) { await dodo(250); } }
    throw new Error("Chrome " + n + " ne répond pas sur " + u);
  };
  const cibles = await attendre(`http://127.0.0.1:${cdpPort}/json/list`);
  const ws = new WebSocket(cibles.find(c => c.type === "page").webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej); });
  let id = 0; const attentes = new Map();
  ws.addEventListener("message", e => { const m = JSON.parse(e.data); if (m.id && attentes.has(m.id)) { attentes.get(m.id)(m); attentes.delete(m.id); } });
  const cdp = (method, params = {}) => new Promise(res => { const k = ++id; attentes.set(k, res); ws.send(JSON.stringify({ id: k, method, params })); });
  const evaluer = async expr => {
    const r = await cdp("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result && r.result.result ? r.result.result.value : null;
  };
  await cdp("Page.enable"); await cdp("Runtime.enable");
  // Ceinture en plus des bretelles du drapeau : la caméra est accordée à l'origine du banc, explicitement.
  await cdp("Browser.grantPermissions", { origin: `http://127.0.0.1:${PORT}`, permissions: ["videoCapture"] });
  await cdp("Page.navigate", { url });
  return {
    n, proc, cdpPort,
    etat: async () => { try { return JSON.parse(await evaluer("JSON.stringify(window.__etat || null)")); } catch (e) { return null; } },
    // On tue le GROUPE de processus : Chrome est une famille (navigateur, rendu,
    // réseau, GPU). Tuer le seul parent laisse le processus réseau vivant quelques
    // secondes, la socket vers le courtier avec lui — et le testament ne part pas.
    tuer(signal = "SIGKILL") { try { ws.close(); } catch (e) {} try { process.kill(-proc.pid, signal); } catch (e) { try { proc.kill(signal); } catch (_) {} } },
  };
}

class Echec extends Error { constructor(etape, detail) { super(etape); this.etape = etape; this.detail = detail; } }
// Attend que `cond(etat)` soit vraie, ou échoue avec l'étape et le dernier état vu.
async function attendreQue(nav, cond, delaiMax, etape) {
  const t0 = Date.now(); let dernier = null;
  while (Date.now() - t0 < delaiMax) {
    dernier = await nav.etat();
    if (dernier && cond(dernier)) return Date.now() - t0;
    await dodo(250);
  }
  throw new Echec(etape, dernier);
}
const ok = e => e.ice === "connected" || e.ice === "completed";
const voit = (etat, id) => etat.pairs.some(p => p.id === id && ok(p) && p.framesDecoded > 15);
const resume = e => !e ? "(pas d'état)" : `courtier=${e.courtier || "—"} connecté=${e.connecte} caméra=${e.camera} pairs=${JSON.stringify(e.pairs.map(p => ({ id: p.id, ice: p.ice, signal: p.signal, images: p.framesDecoded, via: p.candidatLocal })))} départs=${e.departs.length}${e.erreur ? " ERREUR=" + e.erreur : ""}`;
const urlDe = (salon, moi, extra = "") => `http://127.0.0.1:${PORT}/outils/visio-banc.html?salon=${salon}&moi=${moi}${extra}`;
const TROIS = process.env.VISIO_TROIS === "1", SOAK = +(process.env.VISIO_SOAK_MS || 0), SANS_TESTAMENT = process.env.VISIO_SANS_TESTAMENT === "1";
const nomDe = n => ["", "A", "B", "C"][n];

async function passage(essai, eviter) {
  const salon = codeSalon();
  console.log(`\n══ Passage ${essai} — salon ${salon}${eviter ? " (en évitant " + eviter + ")" : ""}${TROIS ? " · trois pairs" : ""}${SOAK ? " · tenue " + sec(SOAK) : ""}${SANS_TESTAMENT ? " · B sans testament" : ""} ══`);
  const t0 = Date.now(), navs = [];
  const etape = (nom, d, info = "") => console.log(`  ✓ ${nom.padEnd(58)} ${sec(d).padStart(7)}${info ? "   " + info : ""}`);
  const via = async (nav, id) => ((await nav.etat()).pairs.find(p => p.id === id) || {}).candidatLocal || "?";
  // Chaque côté de `couples` doit voir l'autre (ICE connecté + images) avant `delai`.
  const seVoient = async (couples, delai, etapeNom) => {
    const t = Date.now();
    for (const [nav, id] of couples) await attendreQue(nav, e => voit(e, id), Math.max(1000, delai - (Date.now() - t)), `${etapeNom} : ${nomDe(nav.n)} doit voir ${id}`);
    return Date.now() - t;
  };
  try {
    // 1. A se relie, et dit quel courtier a répondu ; les autres sont épinglés sur le même.
    const A = await lancer(1, urlDe(salon, "A", eviter ? "&eviter=" + eviter : "")); navs.push(A);
    let d = await attendreQue(A, e => e.connecte && e.courtier, 30000, "A relié au courtier");
    const courtier = (await A.etat()).courtier;
    const url = ["wss://broker.emqx.io:8084/mqtt", "wss://broker.hivemq.com:8884/mqtt", "wss://test.mosquitto.org:8081/mqtt"].find(u => u.includes(courtier));
    const epingle = "&courtier=" + encodeURIComponent(url);
    etape("A relié au courtier", d, "→ " + courtier);
    d = await attendreQue(A, e => e.camera === "active", 10000, "A a sa caméra");
    etape("A a sa caméra (faux périphérique)", d);
    let B = await lancer(2, urlDe(salon, "B", epingle + (SANS_TESTAMENT ? "&sanstestament=1" : ""))); navs.push(B);
    d = await attendreQue(B, e => e.connecte && e.courtier, 30000, "B relié au même courtier");
    etape("B relié au même courtier", d, "→ " + (await B.etat()).courtier + (SANS_TESTAMENT ? ", sans testament" : ""));

    // 2. Les deux se voient : ICE connecté ET des images décodées, dans les deux sens.
    d = await seVoient([[A, "B"], [B, "A"]], 30000, "A et B se voient");
    etape("A et B se voient (ICE connecté, > 15 images, deux sens)", d, `A→B via ${await via(B, "A")}, B→A via ${await via(A, "B")}`);
    const eA = await A.etat(), eB = await B.etat();
    console.log(`     A voit B en ${eA.pairs[0].videoWidth} px de large, ${eA.pairs[0].framesDecoded} images · B voit A en ${eB.pairs[0].videoWidth} px, ${eB.pairs[0].framesDecoded} images`);

    // 2 bis. Un troisième : chacun voit chacun.
    let C = null;
    if (TROIS) {
      const tc = Date.now();
      C = await lancer(3, urlDe(salon, "C", epingle)); navs.push(C);
      await attendreQue(C, e => e.connecte, 30000, "C relié au courtier");
      d = await seVoient([[A, "C"], [B, "C"], [C, "A"], [C, "B"]], 30000, "C rejoint la table");
      etape("C rejoint : A, B et C se voient tous (six flux)", Date.now() - tc, `C→A via ${await via(A, "C")}, C→B via ${await via(B, "C")}`);
    }

    // 2 ter. On tient : aucun faux départ, personne ne perd personne.
    if (SOAK) {
      const ts = Date.now(); let images = 0;
      while (Date.now() - ts < SOAK) {
        for (const nav of navs) {
          const e = await nav.etat();
          if (!e || e.departs.length) throw new Echec(`tenue ${sec(SOAK)} : ${nomDe(nav.n)} a signalé un FAUX départ`, e);
          for (const p of e.pairs) if (!ok(p)) throw new Echec(`tenue ${sec(SOAK)} : ${nomDe(nav.n)} a perdu ${p.id} (ICE ${p.ice})`, e);
          if (nav === A) images = e.pairs[0].framesDecoded;
        }
        await dodo(500);
      }
      etape(`Tenue de ${sec(SOAK)} : zéro faux départ, ICE stable partout`, Date.now() - ts, `A a décodé ${images} images de B`);
    }

    // 3. B meurt brutalement : A (et C) doivent le signaler en ≤ 12 s (testament MQTT, sinon silence).
    const t3 = Date.now();
    B.tuer("SIGKILL"); navs.splice(navs.indexOf(B), 1);
    const parti = e => e.departs.some(x => x.id === "B") && !e.pairs.some(p => p.id === "B");
    d = await attendreQue(A, parti, 12000, "A signale le départ de B (≤ 12 s)");
    if (C) await attendreQue(C, parti, Math.max(1000, 12000 - d), "C signale le départ de B (≤ 12 s)");
    etape(`B tué (SIGKILL) → ${C ? "A et C signalent" : "A signale"} son départ`, Date.now() - t3, `(≤ 12 s${SANS_TESTAMENT ? ", par le silence seul" : ""})`);

    // 4. B revient : tout le monde se revoit en ≤ 30 s, sur des connexions NEUVES.
    const t4 = Date.now();
    B = await lancer(2, urlDe(salon, "B", epingle)); navs.push(B);
    const couples = [[A, "B"], [B, "A"]]; if (C) couples.push([C, "B"], [B, "C"]);
    d = await seVoient(couples, 30000, "B relancé");
    etape(`B relancé → ${C ? "A, B et C" : "les deux"} se revoient (images dans tous les sens)`, d, "(≤ 30 s)");
    console.log(`  ✓ PASSAGE ${essai} RÉUSSI en ${sec(Date.now() - t0)} — courtier ${courtier}`);
    return { ok: true, courtier };
  } catch (e) {
    const etats = await Promise.all(navs.map(async n => `${nomDe(n.n)} : ${resume(await n.etat())}`));
    console.log(`  ✗ ÉCHEC à l'étape « ${e.etape || e.message} » après ${sec(Date.now() - t0)}`);
    if (e.detail !== undefined) console.log("    dernier état vu : " + resume(e.detail));
    for (const s of etats) console.log("    " + s);
    for (const n of navs) { const et = await n.etat(); if (et && et.journal) console.log(`    journal ${nomDe(n.n)} :\n      ` + et.journal.slice(-12).join("\n      ")); }
    return { ok: false, courtier: (await (navs[0] ? navs[0].etat() : null))?.courtier, etape: e.etape || e.message };
  } finally {
    for (const n of navs) n.tuer();
  }
}

let r = await passage(1);
if (!r.ok) {
  console.log(`\n  Les courtiers publics sont parfois capricieux : on refait une fois${r.courtier ? ", sans " + r.courtier : ""}.`);
  await dodo(1500);
  r = await passage(2, r.courtier);
}
serveur.close();
for (const n of [1, 2, 3]) { try { rmSync("/tmp/visio-" + n, { recursive: true, force: true }); } catch (e) {} }
console.log(r.ok ? "\n✓ LA VISIO MARCHE : deux navigateurs se sont vus, ont perdu l'un l'autre, et se sont retrouvés."
  : `\n✗ LA VISIO NE PASSE PAS — étape fautive : ${r.etape}`);
process.exit(r.ok ? 0 : 1);
