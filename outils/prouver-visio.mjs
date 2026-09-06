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
//   2 bis. la COLLECTE ICE est terminée des deux côtés, en < 5 s (iceGatheringState
//      « complete », durée posée par visio.mjs). Avec le TURN mort d'Open Relay inscrit
//      en dur jusqu'au 5 septembre 2026, elle ne finissait JAMAIS : cette étape est
//      celle qui empêche un relais mort de revenir sans que personne le voie.
//   2 ter. LE SON, de bout en bout, sur cette liaison déjà établie (§ prouverAudio) :
//      micros fermés → rien ne circule et la session n'a que DEUX sections m= ; A ouvre
//      son micro → B reçoit de l'ÉNERGIE, pas seulement des paquets ; B, qui n'a pas
//      cliqué, n'émet toujours rien ; la sourdine tue le son en < 2 s sans toucher à
//      l'ICE ni publier une SDP ; on rouvre, ça revient en < 2 s ; les deux micros
//      ouverts, la voix passe dans les deux sens — et l'image n'a pas bronché.
//   3. on tue B (SIGKILL) : A doit signaler son départ en ≤ 12 s
//   4. on relance B : les deux se revoient en ≤ 30 s, et B RÉENTEND A sans re-cliquer
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
//   VISIO_SANS_AUDIO=1       saute l'épreuve du son (pour isoler un souci d'image) —
//                            une sortie de secours, PAS un mode normal : une régression
//                            du son doit casser le banc comme une régression de l'image
//   VISIO_DIAG=1             imprime la série des images relevée pendant l'épreuve du son
//   VISIO_JOURNAL=40         combien de lignes de journal montrer en cas d'échec
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
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

// ── Deux voix postiches, une par navigateur ────────────────────────────────
// 🚨 LE TIMBRE CONTINU DU FAUX PÉRIPHÉRIQUE DE CHROME NE SUFFIT PAS, et ce n'est
// pas un raffinement : il fausse la mesure dans le sens du FAUX NÉGATIF.
//   · les deux navigateurs émettent EXACTEMENT le même signal. Dès que A joue la
//     voix de B tout en capturant, l'annulation d'écho de A prend sa propre
//     tonalité pour l'écho de celle de B — elle est identique — et l'efface.
//     Mesuré au banc : l'énergie reçue de A tombe de 4,6e-1 à 2,5e-3 à la seconde
//     où B ouvre son micro, alors que rien n'est cassé.
//   · un timbre parfaitement stationnaire est, pour la suppression de bruit, du
//     bruit : elle l'apprend et le mord.
// On donne donc à chacun un fichier différent — des « syllabes » séparées de
// silences, dans une autre bande et sur une autre cadence. Deux signaux
// décorrélés : l'annulation d'écho n'a plus rien à retrancher, la suppression de
// bruit n'a plus rien de stationnaire à mordre, et une voix hachée ressemble
// enfin à ce que l'application transporte vraiment.
const TAUX = 48000;
function voixPostiche(chemin, base, motif, cycle, actif) {
  const n = Math.round(TAUX * cycle * motif.length * 4);   // boucle sans couture : un nombre entier de syllabes
  const pcm = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const t = i / TAUX, dans = t % cycle;
    let a = 0;
    if (dans < actif) { const u = dans / actif; a = 0.5 - 0.5 * Math.cos(2 * Math.PI * u); }   // enveloppe douce, pas de clic
    const fr = base * motif[Math.floor(t / cycle) % motif.length];
    // Une fondamentale et deux harmoniques : un spectre de voix, pas une sinusoïde nue.
    const v = a * 0.42 * (Math.sin(2 * Math.PI * fr * t) + 0.5 * Math.sin(4 * Math.PI * fr * t) + 0.25 * Math.sin(6 * Math.PI * fr * t)) / 1.75;
    pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), i * 2);
  }
  const tete = Buffer.alloc(44);
  tete.write("RIFF", 0); tete.writeUInt32LE(36 + pcm.length, 4); tete.write("WAVE", 8);
  tete.write("fmt ", 12); tete.writeUInt32LE(16, 16); tete.writeUInt16LE(1, 20); tete.writeUInt16LE(1, 22);
  tete.writeUInt32LE(TAUX, 24); tete.writeUInt32LE(TAUX * 2, 28); tete.writeUInt16LE(2, 32); tete.writeUInt16LE(16, 34);
  tete.write("data", 36); tete.writeUInt32LE(pcm.length, 40);
  writeFileSync(chemin, Buffer.concat([tete, pcm]));
  return chemin;
}
// Trois voix distinctes (A, B, et C pour VISIO_TROIS) : graves syllabées, aiguës
// rapides, médium lent. Rien de commun entre elles, c'est tout ce qu'on leur demande.
const VOIX = {
  1: voixPostiche("/tmp/voix-A.wav", 220, [1, 1.26, 1.5, 1.12], 0.25, 0.17),
  2: voixPostiche("/tmp/voix-B.wav", 520, [1, 0.84, 1.33, 1.19, 0.95], 0.19, 0.12),
  3: voixPostiche("/tmp/voix-C.wav", 360, [1, 1.19, 0.89], 0.31, 0.22),
};

// ── Un navigateur piloté par le protocole DevTools (patron de mesurer.mjs) ──
async function lancer(n, url) {
  const profil = "/tmp/visio-" + n;
  try { rmSync(profil, { recursive: true, force: true }); } catch (e) {}
  // `--remote-debugging-port=0` : Chrome prend un port libre et l'écrit dans
  // <profil>/DevToolsActivePort — c'est forcément LE NÔTRE (profil neuf).
  const proc = spawn(CHROME, ["--headless=new", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream",
    // Le faux périphérique VIDÉO reste celui de Chrome ; seul le son vient du fichier.
    "--use-file-for-fake-audio-capture=" + VOIX[n],
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
  // Ceinture en plus des bretelles du drapeau : caméra ET micro accordés à l'origine du
  // banc, explicitement. Sans « audioCapture », un refus de micro se lirait « personne
  // ne parle » — exactement le faux négatif que ce banc existe pour éliminer.
  await cdp("Browser.grantPermissions", { origin: `http://127.0.0.1:${PORT}`, permissions: ["videoCapture", "audioCapture"] });
  await cdp("Page.navigate", { url });
  return {
    n, proc, cdpPort,
    // Appelle une fonction de la page (__ouvrirMicro, __couperMicro, __zero) et rend
    // sa valeur. Les gestes du micro se pilotent d'ici, comme des clics.
    appeler: async (expr) => { try { return await evaluer(`(async()=>{try{return JSON.stringify(await (${expr}))}catch(e){return JSON.stringify({erreur:String(e&&e.message||e)})}})()`).then(v => v ? JSON.parse(v) : null); } catch (e) { return null; } },
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
const resume = e => !e ? "(pas d'état)" : !e.pairs ? "(objet partiel) " + JSON.stringify(e) : `courtier=${e.courtier || "—"} connecté=${e.connecte} caméra=${e.camera} ` +
  `micro=${e.micro ? e.micro.etat + (e.micro.coupe ? "/sourdine" : "/ouvert") : "—"} ` +
  `pairs=${JSON.stringify((e.pairs || []).map(p => ({ id: p.id, ice: p.ice, signal: p.signal, images: p.framesDecoded, via: p.candidatLocal,
    audio: p.audio ? { paquets: p.audio.paquets, energie: +p.audio.energie.toFixed(6), niveau: p.audio.niveau, ecoute: +p.audio.ecouteMax.toFixed(3), el: p.audioEl } : null,
    nego: p.negociations })))} ` +
  `pub=${e.pub ? JSON.stringify(e.pub) : "—"} départs=${(e.departs || []).length}${e.erreur ? " ERREUR=" + e.erreur : ""}`;
const urlDe = (salon, moi, extra = "") => `http://127.0.0.1:${PORT}/outils/visio-banc.html?salon=${salon}&moi=${moi}${extra}`;
const TROIS = process.env.VISIO_TROIS === "1", SOAK = +(process.env.VISIO_SOAK_MS || 0), SANS_TESTAMENT = process.env.VISIO_SANS_TESTAMENT === "1";
// La voix est prouvée À CHAQUE PASSAGE, pas derrière un drapeau : une régression du
// son doit casser le banc comme une régression de l'image. VISIO_SANS_AUDIO=1 est une
// sortie de secours pour isoler un souci de vidéo, pas un mode normal.
const AUDIO = process.env.VISIO_SANS_AUDIO !== "1";
const nomDe = n => ["", "A", "B", "C"][n];

// ── La preuve du SON ───────────────────────────────────────────────────────
// 🚨 `packetsReceived > 0` NE PROUVE RIEN SUR LE SON. Une piste en sourdine
// (`enabled = false`) continue d'envoyer des paquets — remplis de silence. C'est
// `totalAudioEnergy` (inbound-rtp audio, chez le RÉCEPTEUR) qui distingue « on
// m'entend » de « on reçoit mon silence ». Les deux seuils ci-dessous ont été
// MESURÉS au banc, avec le faux périphérique de Chrome (un timbre continu) :
// une seconde et demie de voix pèse ~1e-2, une seconde et demie de sourdine
// pèse exactement 0. Ils sont posés loin de part et d'autre.
const ENERGIE_VOIX = 1e-4;      // au-dessus : il y a du son dans les paquets
const ENERGIE_SILENCE = 1e-6;   // en dessous : c'est du silence (la sourdine)
const FENETRE_MS = 1500;        // la durée d'observation d'une énergie
// Le faux périphérique vidéo tourne à ~6 images par seconde et l'état de la page ne
// se rafraîchit qu'à 2 Hz : au repos on voit une image nouvelle toutes les ~500 ms.
// Deux secondes sans rien, ce n'est plus de la granularité, c'est un gel.
const IMAGE_TROU_MAX = 2000;

const paireDe = async (nav, id) => ((await nav.etat()) || { pairs: [] }).pairs.find(p => p.id === id) || null;
// Observe `ms` et rend ce qui a BOUGÉ pendant ce temps : l'énergie audio reçue, les
// paquets, les images. Remet à zéro le maximum du vumètre de l'application au départ,
// pour que `ecouteMax` soit bien le plus fort entendu PENDANT la fenêtre.
async function fenetre(nav, id, ms = FENETRE_MS) {
  await nav.appeler("window.__zero()");
  const a = await paireDe(nav, id);
  if (!a) throw new Echec("fenêtre audio : " + nomDe(nav.n) + " ne connaît plus " + id, await nav.etat());
  await dodo(ms);
  const e2 = await nav.etat();
  const b = (e2 && e2.pairs || []).find(p => p.id === id);
  if (!b) throw new Echec("fenêtre audio : " + nomDe(nav.n) + " a perdu " + id, e2);
  return { energie: b.audio.energie - a.audio.energie, paquets: b.audio.paquets - a.audio.paquets,
    images: b.framesDecoded - a.framesDecoded, niveau: b.audio.niveau, ecouteMax: b.audio.ecouteMax,
    ice: b.ice, negociations: b.negociations, sdp: b.sdp, audioEl: b.audioEl, apres: e2, paire: b };
}
// 🚨 ON DATE LE PHÉNOMÈNE, PAS SON OBSERVATEUR. Mesurer « combien de temps la
// sourdine a mis » en chronométrant ma propre boucle de sondage donnerait un chiffre
// qui parle de mes allers-retours (600 ms pièce), pas de la sourdine : au premier
// essai il annonçait 2,0 s pour un silence tombé bien avant. On suit donc l'énergie
// CUMULÉE, fraîche à chaque coup, et on retient l'instant du DERNIER mouvement.
const ENERGIE_CALME_MS = 800;   // sans le moindre gain pendant ce temps, c'est fini
async function energieDe(nav, id) { return await nav.appeler(`window.__energie("${id}")`); }
async function tombee(nav, id, plafond) {
  const t0 = Date.now();
  let der = (await energieDe(nav, id) || { energie: 0 }).energie, bouge = t0, fin = 0;
  while (Date.now() - t0 < plafond) {
    await dodo(100);
    const m = await energieDe(nav, id); if (!m) continue;
    fin = m.energie;
    if (m.energie - der > ENERGIE_SILENCE) { der = m.energie; bouge = Date.now(); }
    else if (Date.now() - bouge > ENERGIE_CALME_MS) return { ms: bouge - t0, energie: fin };
  }
  return null;
}
async function remontee(nav, id, plafond) {
  const t0 = Date.now();
  const dep = (await energieDe(nav, id) || { energie: 0 }).energie;
  while (Date.now() - t0 < plafond) {
    await dodo(100);
    const m = await energieDe(nav, id); if (!m) continue;
    if (m.energie - dep > ENERGIE_VOIX) return { ms: Date.now() - t0, energie: m.energie - dep };
  }
  return null;
}
const nb = x => (x === null || x === undefined) ? "—" : (typeof x === "number" ? (Math.abs(x) >= 0.01 ? x.toFixed(3) : x.toExponential(2)) : String(x));

// Guette les images de bout en bout de l'épreuve du son, et retient le plus long
// silence de l'image. Mesurer la vidéo dans une fenêtre de 1,5 s qui tombe pile sur
// une renégociation ne prouve rien : le faux périphérique tourne à ~6 images par
// seconde et l'état de la page ne se rafraîchit que toutes les 500 ms. Ce qu'on veut
// savoir, c'est si l'image s'ARRÊTE — et combien de temps.
function guetterImages(couples) {
  const t0 = Date.now();
  const vus = couples.map(([nav, id]) => ({ nav, id, debut: 0, dernier: 0, quand: Date.now(), trou: 0, trouA: 0, fin: 0, serie: [] }));
  let vivant = true;
  (async () => {
    while (vivant) {
      for (const v of vus) {
        const p = await paireDe(v.nav, v.id);
        if (p) {
          if (!v.debut) v.debut = p.framesDecoded;
          v.serie.push([+((Date.now() - t0) / 1000).toFixed(1), p.framesDecoded, p.vid ? p.vid.paquets : 0, p.vid ? p.vid.encodees : 0, p.vid ? p.vid.limite : ""]);
          if (p.framesDecoded > v.dernier) { if (Date.now() - v.quand > v.trou) { v.trou = Date.now() - v.quand; v.trouA = v.quand - t0; } v.quand = Date.now(); v.dernier = p.framesDecoded; }
          v.fin = p.framesDecoded;
        }
      }
      await dodo(300);
    }
  })();
  return {
    arreter() {
      vivant = false;
      return vus.map(v => ({ qui: nomDe(v.nav.n) + "←" + v.id, images: v.fin - v.debut, trou: Math.max(v.trou, Date.now() - v.quand), quand: v.trouA / 1000,
        serie: v.serie.map(a => a[0] + "s img" + a[1] + " pkt" + a[2] + " enc" + a[3] + (a[4] ? " " + a[4] : "")).join("  ") }));
    },
  };
}

// Rend une fonction `etape` déjà liée pour lire joliment, et pose les cinq faits.
async function prouverAudio(A, B, etape) {
  const t0 = Date.now();
  const pubDe = async nav => (await nav.etat()).pub;
  const guet = guetterImages([[A, "B"], [B, "A"]]);

  // a. PERSONNE N'A CLIQUÉ : rien ne circule. C'est la promesse « personne n'est
  //    diffusé sans avoir cliqué » — elle se prouve chez celui qui écoute.
  const ta = Date.now();
  const a1 = await paireDe(A, "B"), b1 = await paireDe(B, "A");
  for (const [nav, p, autre] of [[A, a1, "B"], [B, b1, "A"]]) {
    if (p.audio.paquets > 0 || p.audio.energie > ENERGIE_SILENCE)
      throw new Echec(`micro fermé des deux côtés, et pourtant ${nomDe(nav.n)} reçoit du son de ${autre} ` +
        `(paquets ${p.audio.paquets}, énergie ${nb(p.audio.energie)})`, await nav.etat());
    if (p.sortant.paquets > 0)
      throw new Echec(`micro fermé et ${nomDe(nav.n)} ÉMET quand même vers ${autre} ` +
        `(${p.sortant.paquets} paquets sortants) : quelqu'un est diffusé sans avoir cliqué`, await nav.etat());
  }
  // 🚨 DEUX SECTIONS m=, PAS QUATRE. Celui qui répondait recréait ses transcepteurs au
  // lieu d'adopter ceux de l'offre : la session portait deux images et deux voix, dont
  // la moitié hors du groupe BUNDLE. Ça marchait — jusqu'au premier micro ouvert, qui
  // gelait l'image sept secondes des deux côtés. Ce compte est le garde-fou.
  for (const [nav, p] of [[A, a1], [B, b1]])
    if (p.sections !== 2) throw new Echec(`${nomDe(nav.n)} a ${p.sections} sections m= au lieu de 2 : ` +
      "des transcepteurs ont été recréés au lieu d'être adoptés", await nav.etat());
  etape("Micros fermés : AUCUN paquet audio, et DEUX sections m=", Date.now() - ta,
    `A←B ${a1.audio.paquets} paquets · B←A ${b1.audio.paquets} paquets · ${a1.sections} et ${b1.sections} sections`);

  // b. A clique sur « parler » (le vrai chemin : micro.mjs.ouvrir + attacherMicro).
  const tb = Date.now();
  const r = await A.appeler("window.__ouvrirMicro()");
  if (!r || !r.flux) throw new Echec("A n'a pas pu ouvrir son micro : " + JSON.stringify(r), await A.etat());
  // Le transcepteur audio existe depuis la construction : ouvrir change sa direction,
  // donc UNE renégociation ici est normale et attendue (ce n'est pas la sourdine).
  await attendreQue(B, e => { const p = e.pairs.find(x => x.id === "A"); return p && p.audio.paquets > 0; }, 15000, "B reçoit les paquets audio de A");
  const fb = await fenetre(B, "A");
  if (fb.energie < ENERGIE_VOIX)
    throw new Echec(`B reçoit des paquets de A mais AUCUN SON : énergie +${nb(fb.energie)} en ${sec(FENETRE_MS)} ` +
      `(seuil ${nb(ENERGIE_VOIX)}) — des paquets ne sont pas de la voix`, fb.apres);
  if (!fb.audioEl) throw new Echec("B a du son mais aucun <audio> posé : creerSortieAudio n'a pas été appelé", fb.apres);
  if (!(fb.ecouteMax > 0))
    throw new Echec(`le vumètre de l'application n'entend RIEN sur le <audio> de A (max ${nb(fb.ecouteMax)}) : ` +
      "sur Chrome un flux distant ne s'analyse que s'il est aussi en cours de lecture", fb.apres);
  etape("A ouvre son micro → B l'ENTEND (énergie, pas des paquets vides)", Date.now() - tb,
    `+${nb(fb.energie)} d'énergie, +${fb.paquets} paquets, niveau ${nb(fb.niveau)}, vumètre ${fb.ecouteMax.toFixed(3)}`);

  // c. B n'a pas cliqué : il n'émet toujours rien. Un seul micro ouvert, un seul sens.
  const fa = await fenetre(A, "B", 800);
  if (fa.paquets > 0 || fa.energie > ENERGIE_SILENCE)
    throw new Echec(`B n'a jamais ouvert son micro et A reçoit pourtant du son (+${fa.paquets} paquets, +${nb(fa.energie)})`, fa.apres);
  const sortantB = (await paireDe(B, "A")).sortant.paquets;
  if (sortantB > 0) throw new Echec(`B n'a pas cliqué et émet quand même (${sortantB} paquets sortants)`, await B.etat());
  etape("B n'a pas cliqué : il n'émet rien, A ne reçoit rien", 0, `+${fa.paquets} paquets reçus, ${sortantB} paquet sortant`);

  // d. LA SOURDINE. Elle doit tuer le son SANS toucher à la connexion : même état ICE,
  //    aucune renégociation, aucune « description » publiée sur le courtier.
  const td = Date.now();
  const avantA = await paireDe(A, "B"), avantB = await paireDe(B, "A");
  const pubA0 = await pubDe(A), pubB0 = await pubDe(B);
  await A.appeler("window.__couperMicro(true)");
  const chute = await tombee(B, "A", 6000);
  if (!chute) throw new Echec("micro coupé et B entend TOUJOURS A six secondes après", await B.etat());
  if (chute.ms > 2000) throw new Echec(`la sourdine a mis ${sec(chute.ms)} à faire effet (plafond 2 s)`, await B.etat());
  // Et le silence TIENT : une seconde et demie de plus sans un souffle.
  const fm = await fenetre(B, "A", FENETRE_MS);
  if (fm.energie >= ENERGIE_SILENCE)
    throw new Echec(`le son est revenu tout seul, micro coupé : +${nb(fm.energie)} en ${sec(FENETRE_MS)}`, fm.apres);
  const dTombee = chute.ms;
  const apresA = await paireDe(A, "B"), apresB = await paireDe(B, "A");
  const pubA1 = await pubDe(A), pubB1 = await pubDe(B);
  const bouge = [];
  if (apresA.ice !== avantA.ice) bouge.push(`ICE de A : ${avantA.ice} → ${apresA.ice}`);
  if (apresB.ice !== avantB.ice) bouge.push(`ICE de B : ${avantB.ice} → ${apresB.ice}`);
  if (apresA.negociations !== avantA.negociations) bouge.push(`A a renégocié (${avantA.negociations} → ${apresA.negociations})`);
  if (apresB.negociations !== avantB.negociations) bouge.push(`B a renégocié (${avantB.negociations} → ${apresB.negociations})`);
  if (apresA.sdp !== avantA.sdp) bouge.push(`la signalisation de A a bougé (${avantA.sdp} → ${apresA.sdp})`);
  if (apresB.sdp !== avantB.sdp) bouge.push(`la signalisation de B a bougé (${avantB.sdp} → ${apresB.sdp})`);
  if (pubA1.description !== pubA0.description) bouge.push(`A a publié ${pubA1.description - pubA0.description} description(s) SDP`);
  if (pubB1.description !== pubB0.description) bouge.push(`B a publié ${pubB1.description - pubB0.description} description(s) SDP`);
  if (pubA1.candidats !== pubA0.candidats) bouge.push(`A a publié ${pubA1.candidats - pubA0.candidats} lot(s) de candidats`);
  if (bouge.length) throw new Echec("la sourdine a remué la connexion : " + bouge.join(" · "), apresB);
  // Les paquets, eux, continuent : c'est justement pourquoi on ne les regarde pas.
  etape("Sourdine → le son tombe à ZÉRO, connexion intacte", dTombee,
    `plus rien après ${sec(dTombee)}, puis +${nb(fm.energie)} sur ${sec(FENETRE_MS)} · ICE ${apresB.ice} inchangé · ` +
    `0 renégociation · 0 SDP publiée · et les paquets, eux, CONTINUENT (+${fm.paquets})`);

  // e. On rouvre : le son doit revenir en moins de deux secondes.
  const te = Date.now();
  await A.appeler("window.__couperMicro(false)");
  const retour = await remontee(B, "A", 4000);
  if (!retour) throw new Echec("micro rouvert et B n'entend toujours rien quatre secondes après", await B.etat());
  if (retour.ms > 2000) throw new Echec(`le son a mis ${sec(retour.ms)} à revenir (plafond 2 s)`, await B.etat());
  const fr = await fenetre(B, "A", FENETRE_MS);
  if (fr.energie < ENERGIE_VOIX) throw new Echec(`le son est revenu puis reparti : +${nb(fr.energie)} en ${sec(FENETRE_MS)}`, fr.apres);
  etape("Micro rouvert → le son revient (< 2 s)", retour.ms, `+${nb(fr.energie)} d'énergie sur ${sec(FENETRE_MS)}, vumètre ${fr.ecouteMax.toFixed(3)}`);

  // f. B ouvre à son tour : la voix passe dans les DEUX sens en même temps.
  const tf = Date.now();
  const rb = await B.appeler("window.__ouvrirMicro()");
  if (!rb || !rb.flux) throw new Echec("B n'a pas pu ouvrir son micro : " + JSON.stringify(rb), await B.etat());
  await attendreQue(A, e => { const p = e.pairs.find(x => x.id === "B"); return p && p.audio.paquets > 0; }, 15000, "A reçoit les paquets audio de B");
  const fab = await fenetre(A, "B");
  if (fab.energie < ENERGIE_VOIX) throw new Echec(`B a ouvert son micro et A ne l'ENTEND pas : +${nb(fab.energie)} d'énergie pour +${fab.paquets} paquets, ` +
      `<audio> posé=${fab.audioEl}, vumètre ${nb(fab.ecouteMax)}, niveau ${nb(fab.niveau)}`, fab.apres);
  if (!(fab.ecouteMax > 0)) throw new Echec("le vumètre de A n'entend rien sur le <audio> de B", fab.apres);
  const fba = await fenetre(B, "A");
  if (fba.energie < ENERGIE_VOIX) throw new Echec(`duplex : A n'est plus entendu de B (+${nb(fba.energie)})`, fba.apres);
  // Et après DEUX ouvertures de micro, toujours deux sections : les renégociations
  // remplacent la piste dans les transcepteurs existants, elles n'en ajoutent pas.
  for (const [nav, q] of [[A, fab.paire], [B, fba.paire]])
    if (q.sections !== 2) throw new Echec(`${nomDe(nav.n)} a ${q.sections} sections m= après l'ouverture des micros`, await nav.etat());
  etape("Les deux micros ouverts : la voix passe dans les DEUX sens", Date.now() - tf,
    `A←B +${nb(fab.energie)} · B←A +${nb(fba.energie)}`);

  // g. Et l'image n'a pas payé le son : elle a coulé pendant toute l'épreuve, y
  //    compris à travers les deux renégociations d'ouverture de micro.
  const img = guet.arreter();
  const mort = img.find(v => v.images <= 0);
  if (mort) throw new Echec(`la vidéo s'est arrêtée pendant l'épreuve du son : ${mort.qui} +${mort.images} image(s)`, await A.etat());
  const pire = img.reduce((a, b) => (a.trou > b.trou ? a : b));
  if (pire.trou > IMAGE_TROU_MAX || process.env.VISIO_DIAG === "1") { for (const v of img) console.log("     série " + v.qui + " : " + v.serie); }
  if (pire.trou > IMAGE_TROU_MAX) { throw new Echec(`la vidéo a gelé ${sec(pire.trou)} à t+${pire.quand.toFixed(1)}s de l'épreuve (${pire.qui}, plafond ${sec(IMAGE_TROU_MAX)})`, await A.etat()); }
  etape("La vidéo n'a pas bronché pendant toute l'épreuve", Date.now() - t0,
    img.map(v => `${v.qui} +${v.images} images`).join(" · ") + ` · plus long gel ${sec(pire.trou)}`);
  return Date.now() - t0;
}

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

    // 2 bis. La collecte ICE est FINIE, et vite, des deux côtés. Un relais mort dans la liste
    // la laisse « gathering » pour toujours (mesuré avec Open Relay) — on l'exige sous 5 s.
    const COLLECTE_MAX = 5000, tc2 = Date.now();
    const collecteFinie = e => e.pairs.length && e.pairs.every(p => p.collecte === "complete" && typeof p.collecteMs === "number");
    await attendreQue(A, collecteFinie, COLLECTE_MAX, "collecte ICE de A terminée (≤ 5 s)");
    await attendreQue(B, collecteFinie, Math.max(1000, COLLECTE_MAX - (Date.now() - tc2)), "collecte ICE de B terminée (≤ 5 s)");
    const durees = [...(await A.etat()).pairs, ...(await B.etat()).pairs].map(p => p.collecteMs);
    if (durees.some(ms => ms > COLLECTE_MAX)) throw new Echec(`collecte ICE trop lente : ${durees.join(" / ")} ms (plafond ${COLLECTE_MAX})`, await A.etat());
    etape("Collecte ICE terminée des deux côtés (< 5 s, STUN seul)", Date.now() - tc2, `durées ${durees.map(ms => (ms / 1000).toFixed(2) + " s").join(" · ")}`);

    // 2 ter. LE SON. Sur cette liaison-là, déjà établie, images comprises.
    if (AUDIO) {
      const da = await prouverAudio(A, B, etape);
      console.log(`     ── le son est prouvé en ${sec(da)} : reçu, coupé, rendu, dans les deux sens ──`);
    }

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
    // A avait son micro ouvert quand B est mort : la paire NEUVE doit naître avec la
    // piste audio dedans, sans que personne re-clique. C'est `localMicro` retenu par
    // visio.mjs et repris à la construction du transcepteur — si ça lâche, il faudrait
    // rouvrir son micro à chaque fois qu'un ami se reconnecte, et personne ne le saurait.
    if (AUDIO) {
      const t5 = Date.now();
      await attendreQue(B, e => { const p = e.pairs.find(x => x.id === "A"); return p && p.audio.paquets > 0; }, 15000, "B relancé reçoit la voix de A");
      const fn = await fenetre(B, "A");
      if (fn.energie < ENERGIE_VOIX) throw new Echec(`B est revenu mais n'entend plus A (+${nb(fn.energie)}) : le micro ne survit pas au retour d'un pair`, fn.apres);
      etape("B revenu ENTEND A sans que personne re-clique", Date.now() - t5, `+${nb(fn.energie)} d'énergie, vumètre ${fn.ecouteMax.toFixed(3)}`);
    }
    console.log(`  ✓ PASSAGE ${essai} RÉUSSI en ${sec(Date.now() - t0)} — courtier ${courtier}`);
    return { ok: true, courtier };
  } catch (e) {
    const etats = await Promise.all(navs.map(async n => `${nomDe(n.n)} : ${resume(await n.etat())}`));
    console.log(`  ✗ ÉCHEC à l'étape « ${e.etape || e.message} » après ${sec(Date.now() - t0)}`);
    if (e.detail !== undefined) console.log("    dernier état vu : " + resume(e.detail));
    for (const s of etats) console.log("    " + s);
    for (const n of navs) { const et = await n.etat(); if (et && et.journal) console.log(`    journal ${nomDe(n.n)} :\n      ` + et.journal.slice(-(+process.env.VISIO_JOURNAL || 12)).join("\n      ")); }
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
