// La visio, SANS navigateur : ce qui se décide avant la première RTCPeerConnection,
// et — depuis le 6 septembre 2026 — les DEUX transcepteurs de chaque paire, avec une
// fausse RTCPeerConnection qui note tout ce qu'on lui demande.
// Ce qu'il protège en premier : la liste des serveurs ICE. Un TURN mort inscrit en dur
// (Open Relay, 5 septembre 2026) ralentissait la collecte de tout le monde sans rien
// relayer ; désormais le relais vient de ⚙, et sans identifiants on part en STUN seul.
// Puis, en bas, la parole : l'ordre des lignes m= et la sourdine qui ne renégocie pas.
//   node src/visio.test.mjs
import { serveursIce, urlsRelais, relaisConfigure, SERVEURS_ICE, SERVEURS_STUN, sujetVisio, testamentVisio,
  expliquerEchec, MESSAGE_ARTEFACT, SANS_RELAIS_MESSAGE, AVEC_RELAIS_MESSAGE, ETATS_VOIX, PAIRS_MAX,
  ATTENTE_POLIE_MS, ENVOI_ECART_MS, creerVisio } from "./visio.mjs";

let pass = 0, fail = 0;
function ok(nom, a, b) {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A === B) pass++; else { fail++; console.log("  ÉCHEC :", nom, "\n    obtenu ", A, "\n    attendu", B); }
}
const stun = { urls: SERVEURS_STUN.slice() };

// ── 1. Vide : STUN seul, jamais un relais fantôme.
ok("sans rien : STUN seul", serveursIce(), [stun]);
ok("null : STUN seul", serveursIce(null), [stun]);
ok("objet vide : STUN seul", serveursIce({}), [stun]);
ok("champs vides : STUN seul", serveursIce({ url: "", user: "", pass: "" }), [stun]);
ok("la constante par défaut = STUN seul", SERVEURS_ICE, [stun]);
ok("deux serveurs STUN de Google, rien d'autre", SERVEURS_STUN, ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]);
ok("le TURN Open Relay mort n'est plus nulle part", JSON.stringify(SERVEURS_ICE).includes("openrelay"), false);
ok("STUN seul n'a pas d'identifiants", serveursIce(null).some(s => s.username || s.credential), false);
ok("relaisConfigure : non", relaisConfigure(null), false);

// ── 2. Un relais INCOMPLET est un relais absent : un TURN sans identifiants est refusé partout.
ok("URL sans identifiants : STUN seul", serveursIce({ url: "turn:relais.exemple.org:3478" }), [stun]);
ok("URL + utilisateur sans mot de passe : STUN seul", serveursIce({ url: "turn:relais.exemple.org:3478", user: "u" }), [stun]);
ok("identifiants sans URL : STUN seul", serveursIce({ user: "u", pass: "p" }), [stun]);
ok("URL illisible (http) : STUN seul", serveursIce({ url: "https://metered.ca", user: "u", pass: "p" }), [stun]);

// ── 3. Un relais complet : STUN d'abord, puis le TURN avec ses identifiants.
const r = serveursIce({ url: "turn:standard.relay.metered.ca:80", user: "abc", pass: "s3cret" });
ok("relais complet : deux entrées", r.length, 2);
ok("relais complet : STUN en premier", r[0], stun);
ok("relais complet : le TURN et ses identifiants", r[1], { urls: ["turn:standard.relay.metered.ca:80"], username: "abc", credential: "s3cret" });
ok("relaisConfigure : oui", relaisConfigure({ url: "turn:standard.relay.metered.ca:80", user: "abc", pass: "s3cret" }), true);
ok("espaces autour de l'utilisateur : rognés", serveursIce({ url: "turn:h:80", user: "  abc ", pass: "p" })[1].username, "abc");

// ── 4. Les URL telles qu'on les tape : plusieurs, sans schéma, avec transport.
ok("host:port sans schéma → turn:", urlsRelais("relais.exemple.org:3478"), ["turn:relais.exemple.org:3478"]);
ok("host seul → turn:host", urlsRelais("relais.exemple.org"), ["turn:relais.exemple.org"]);
ok("plusieurs URL, virgules et retours à la ligne", urlsRelais("turn:a.b:80, turn:a.b:80?transport=tcp\nturns:a.b:443?transport=tcp"),
  ["turn:a.b:80", "turn:a.b:80?transport=tcp", "turns:a.b:443?transport=tcp"]);
ok("turns: gardé tel quel", urlsRelais("turns:a.b:443"), ["turns:a.b:443"]);
ok("majuscules de schéma tolérées", urlsRelais("TURN:a.b:80"), ["TURN:a.b:80"]);
ok("http:// jeté, pas préfixé", urlsRelais("http://pas/valide, turn:ok:80"), ["turn:ok:80"]);
ok("vide → rien", urlsRelais(""), []);
ok("undefined → rien", urlsRelais(undefined), []);
ok("un stun: dans le champ relais n'entre pas dans l'entrée TURN", serveursIce({ url: "stun:a.b:3478", user: "u", pass: "p" }), [stun]);
ok("un stun: à côté d'un turn: est ignoré, le turn: reste", serveursIce({ url: "stun:a.b:3478 turn:a.b:80", user: "u", pass: "p" })[1].urls, ["turn:a.b:80"]);

// ── 5. Ce qui ne bouge pas : sujets, testament, messages.
ok("sujet adressé", sujetVisio("A7K2M9PQ", "jA", "jB"), "compteur-hilo/v1/A7K2M9PQ/visio/jA/jB");
ok("testament : un adieu sur mon sujet /tous", testamentVisio("A7K2M9PQ", "jA"), { sujet: "compteur-hilo/v1/A7K2M9PQ/visio/jA/tous", message: JSON.stringify({ t: "adieu" }) });
ok("échec réseau muet → le message de l'artefact", expliquerEchec(new Error("connexion refusée")), MESSAGE_ARTEFACT);
ok("échec sans message → le message de l'artefact", expliquerEchec(null), MESSAGE_ARTEFACT);
ok("le message de l'artefact porte le lien GitHub Pages", MESSAGE_ARTEFACT.includes("pwrygrt72g-hue.github.io/compteur-hilo"), true);
ok("le message « sans relais » envoie vers ⚙", SANS_RELAIS_MESSAGE.includes("⚙") && /relais/.test(SANS_RELAIS_MESSAGE), true);
ok("cinq pairs au plus", PAIRS_MAX, 5);

/* ══ LA PAROLE (6 septembre 2026) ════════════════════════════════════════════
   Ce que ces tests protègent :
   · l'ORDRE des lignes m= — vidéo puis audio, TOUJOURS, quels que soient les flux
     présents. Deux pairs qui ne créent pas leurs transcepteurs dans le même ordre
     ne s'alignent pas et la négociation échoue ; comme les deux côtés exécutent ce
     même code, l'ordre est garanti tant que ces deux lignes ne bougent pas.
   · la SOURDINE ne renégocie RIEN : `enabled = false`, pas de replaceTrack, pas de
     changement de direction, pas un appel au navigateur.
   · `onFlux` ne voit QUE la vidéo — l'écran écrit avant la parole continue de
     marcher, il ne recevra jamais un flux sans image dans son <video>.
   ═══════════════════════════════════════════════════════════════════════════ */
class FaussePiste {
  constructor(kind) { this.kind = kind; this.enabled = true; this.arretee = false; }
  addEventListener() {}
  stop() { this.arretee = true; }
}
class FauxFlux {
  constructor(pistes) { this.pistes = [].concat(pistes || []); }
  getTracks() { return this.pistes; }
  getAudioTracks() { return this.pistes.filter(p => p.kind === "audio"); }
  getVideoTracks() { return this.pistes.filter(p => p.kind === "video"); }
}
globalThis.MediaStream = FauxFlux;
class FauxTransceiver {
  constructor(source, init) {
    this.source = source; this.direction = (init || {}).direction; this.remplacements = [];
    // `mid` null = ce transcepteur n'a JAMAIS été associé à une section m= : c'est
    // exactement l'orphelin que adopter() doit fermer.
    this.mid = (init || {}).mid !== undefined ? init.mid : null;
    this.arrete = false;
    const genre = typeof source === "string" ? source : source.kind;
    this.receiver = { track: { kind: genre } };
    this.sender = { track: typeof source === "string" ? null : source,
      replaceTrack: t => { this.remplacements.push(t); this.sender.track = t; return Promise.resolve(); } };
  }
  stop() { this.arrete = true; }
}
class FauxPC {
  constructor(config) {
    this.config = config; this.transceivers = []; this.appels = [];
    this.signalingState = "stable"; this.iceConnectionState = "new"; this.iceGatheringState = "new";
    this.localDescription = null; this.remoteDescription = null; this.ferme = false;
  }
  addTransceiver(src, init) {
    const tr = new FauxTransceiver(src, init);
    this.transceivers.push({ genre: typeof src === "string" ? src : src.kind, direction: (init || {}).direction, tr });
    this.appels.push("addTransceiver");
    return tr;
  }
  // 🚨 CE FAUX DOIT IMITER LE VRAI DÉFAUT DE CHROME, sinon le test ne protège rien :
  // setRemoteDescription(offre) ne réutilise PAS nos transcepteurs, il en CRÉE de
  // neufs, porteurs du mid. C'est ce comportement qui doublait les sections m=.
  // `d.mlignes` dit ce que l'offre distante contient.
  async setRemoteDescription(d) {
    this.appels.push("setRemoteDescription"); this.remoteDescription = d;
    if (d && d.type === "offer") for (const genre of (d.mlignes || [])) {
      const tr = new FauxTransceiver(genre, { direction: "recvonly", mid: String(this.transceivers.length) });
      this.transceivers.push({ genre, direction: "recvonly", tr, distant: true });
    }
    this.signalingState = d && d.type === "offer" ? "have-remote-offer" : "stable";
  }
  async setLocalDescription() {
    this.appels.push("setLocalDescription");
    const reponse = this.signalingState === "have-remote-offer";
    this.localDescription = { type: reponse ? "answer" : "offer", sdp: "" };
    this.signalingState = reponse ? "stable" : "have-local-offer";
  }
  getTransceivers() { return this.transceivers.map(x => x.tr); }
  async addIceCandidate() { this.appels.push("addIceCandidate"); }
  restartIce() { this.appels.push("restartIce"); }
  close() { this.ferme = true; }
}
globalThis.RTCPeerConnection = FauxPC;

const SALON = "A7K2M9PQ";
// « jB » comme moi et « jA » comme pair : moi > lui, donc je suis l'IMPOLI et rien
// n'attend — la paire se crée à la seconde où son salut arrive.
// `poli: true` inverse les rôles : je m'appelle « jA », le pair est « jB », donc je
// suis le POLI — celui qui laisse l'autre offrir et n'offre qu'après ATTENTE_POLIE_MS.
// C'est donc LUI qui répond, et répondre est la moitié du monde qui était fautive.
function table({ flux = null, micro = null, poli = false, sansSalut = false } = {}) {
  const envois = [], vus = { video: [], audio: [] }, voix = [];
  const moi = poli ? "jA" : "jB", lui = poli ? "jB" : "jA";
  const api = creerVisio({
    reseau: { publier: (s, m) => envois.push([s, m]), souscrire: () => {} },
    salon: SALON, moi, flux, micro,
    onFlux: (id, f) => vus.video.push([id, f]),
    onAudio: (id, f) => vus.audio.push([id, f]),
    onVoix: (id, v) => voix.push([id, v]),
    onDepart: () => {}, onEtat: () => {},
  });
  if (!sansSalut) api.recevoir(`compteur-hilo/v1/${SALON}/visio/${lui}/tous`, JSON.stringify({ s: "sess1", t: "salut" }));
  const p = api.pairs.get(lui);
  return { api, p, envois, vus, voix, moi, lui, pc: p && p.pc };
}
const recevoirDe = (t, o) => t.api.recevoir(`compteur-hilo/v1/${SALON}/visio/${t.lui}/tous`, JSON.stringify(Object.assign({ s: "sess1" }, o)));
const genres = t => t.pc.transceivers.map(x => x.genre);
const directions = t => t.pc.transceivers.map(x => x.direction);

// ── 6. Quand c'est MOI qui offre : deux transcepteurs, vidéo PUIS audio, quatre cas.
{
  const cam = () => new FauxFlux([new FaussePiste("video")]);
  const mic = () => new FauxFlux([new FaussePiste("audio")]);
  const cas = [
    ["caméra et micro", { flux: cam(), micro: mic() }, ["sendrecv", "sendrecv"]],
    ["caméra seule", { flux: cam(), micro: null }, ["sendrecv", "recvonly"]],
    ["micro seul", { flux: null, micro: mic() }, ["recvonly", "sendrecv"]],
    ["ni l'un ni l'autre", { flux: null, micro: null }, ["recvonly", "recvonly"]],
  ];
  for (const [nom, opts, dirs] of cas) {
    const t = table(opts);
    ok("m= vidéo puis audio — " + nom, genres(t), ["video", "audio"]);
    ok("directions — " + nom, directions(t), dirs);
    ok("les deux transcepteurs existent dès la première offre — " + nom, [!!t.p.tr, !!t.p.trA], [true, true]);
    ok("deux sections m=, pas quatre — " + nom, t.pc.transceivers.length, 2);
    t.api.fermer();
  }
}
{
  // Sans micro : on ENTEND sans parler, exactement comme on VOIT sans être vu.
  const t = table({});
  ok("sans micro : la ligne audio est quand même là (entendre sans parler)", t.p.trA.direction, "recvonly");
  ok("sans micro : aucune piste envoyée", t.p.trA.sender.track, null);
  t.api.fermer();
}

// ── 7. Allumer le micro en cours de partie : replaceTrack, comme la caméra.
{
  const t = table({});
  const piste = new FaussePiste("audio");
  const avantVideo = t.p.tr.remplacements.length;
  t.api.attacherMicro(new FauxFlux([piste]));
  ok("attacherMicro : la piste est posée dans le transcepteur audio", t.p.trA.remplacements, [piste]);
  ok("attacherMicro : la direction passe en sendrecv", t.p.trA.direction, "sendrecv");
  ok("attacherMicro : la vidéo n'est PAS touchée", t.p.tr.remplacements.length, avantVideo);
  ok("attacherMicro : microCoupe() suit la piste", t.api.microCoupe(), false);
  t.api.attacherMicro(null);
  ok("attacherMicro(null) : on cesse d'être entendu", [t.p.trA.remplacements[1], t.p.trA.direction], [null, "recvonly"]);
  ok("sans piste, on est coupé par définition", t.api.microCoupe(), true);
  t.api.fermer();
}
{
  const cam = new FaussePiste("video");
  const t = table({ flux: new FauxFlux([cam]) });
  t.api.attacherFlux(null);
  ok("attacherFlux ne touche PAS le transcepteur audio", t.p.trA.remplacements.length, 0);
  ok("attacherFlux fait toujours son travail sur la vidéo", [t.p.tr.remplacements, t.p.tr.direction], [[null], "recvonly"]);
  t.api.fermer();
}

// ── 8. La sourdine ne renégocie RIEN.
{
  const piste = new FaussePiste("audio");
  const t = table({ micro: new FauxFlux([piste]) });
  const appelsAvant = t.pc.appels.slice();
  const remplAvant = t.p.trA.remplacements.length;
  const dirAvant = t.p.trA.direction;
  const envoisAvant = t.envois.length;

  ok("couperMicro(true) rend true", t.api.couperMicro(true), true);
  ok("couper : la piste est muette", piste.enabled, false);
  ok("couper : la piste EXISTE toujours", [piste.arretee, t.p.trA.sender.track], [false, piste]);
  ok("couper : AUCUN replaceTrack", t.p.trA.remplacements.length, remplAvant);
  ok("couper : la direction ne bouge pas", t.p.trA.direction, dirAvant);
  ok("couper : aucun appel de plus au navigateur (donc aucune offre)", t.pc.appels, appelsAvant);
  ok("couper : rien n'est publié sur le courtier", t.envois.length, envoisAvant);
  ok("couper : microCoupe() le dit", t.api.microCoupe(), true);

  ok("rouvrir rend false", t.api.couperMicro(false), false);
  ok("rouvrir : la piste réémet", piste.enabled, true);
  ok("rouvrir : toujours aucune renégociation", t.pc.appels, appelsAvant);
  ok("couperMicro() sans argument bascule", [t.api.couperMicro(), t.api.couperMicro()], [true, false]);
  t.api.fermer();
}

// ── 9. Deux rappels : `onFlux` ne voit QUE la vidéo.
{
  const t = table({});
  t.pc.ontrack({ track: { kind: "video" }, streams: [] });
  ok("une piste vidéo va dans onFlux", [t.vus.video.length, t.vus.audio.length], [1, 0]);
  t.pc.ontrack({ track: { kind: "audio" }, streams: [] });
  ok("une piste audio va dans onAudio, JAMAIS dans onFlux", [t.vus.video.length, t.vus.audio.length], [1, 1]);
  ok("chaque piste arrive dans son propre flux", t.vus.video[0][1] !== t.vus.audio[0][1], true);
  ok("le pair est nommé des deux côtés", [t.vus.video[0][0], t.vus.audio[0][0]], ["jA", "jA"]);
  t.api.fermer();
}
{
  // Un écran qui ne connaît pas encore `onAudio` : rien ne casse, la voix est ignorée.
  const recus = [];
  const api = creerVisio({
    reseau: { publier: () => {}, souscrire: () => {} },
    salon: SALON, moi: "jB", onFlux: (id, f) => recus.push(id), onDepart: () => {}, onEtat: () => {},
  });
  api.recevoir(`compteur-hilo/v1/${SALON}/visio/jA/tous`, JSON.stringify({ s: "s", t: "salut" }));
  const pc = api.pairs.get("jA").pc;
  pc.ontrack({ track: { kind: "audio" }, streams: [] });
  ok("sans onAudio, l'écran d'avant ne reçoit rien du tout (pas un flux noir)", recus, []);
  pc.ontrack({ track: { kind: "video" }, streams: [] });
  ok("…et il reçoit toujours ses vidéos", recus, ["jA"]);
  api.fermer();
}

// ── 10. Rien d'autre n'a bougé : les cadences et la présence sont intactes.
{
  const t = table({});
  ok("la paire porte toujours son état ICE et sa collecte", [t.p.ice, t.p.collecteMs], ["new", null]);
  ok("un seul RTCPeerConnection par pair", t.api.pairs.size, 1);
  t.api.depart("jA");
  ok("le départ ferme la connexion", [t.pc.ferme, t.api.pairs.size], [true, 0]);
  t.api.fermer();
}

// ── 11. Quand c'est L'AUTRE qui offre : on ADOPTE, on ne recrée pas.
// C'est le défaut trouvé au banc le 6 septembre 2026 : celui qui répondait créait ses
// propres transcepteurs, que setRemoteDescription n'associait jamais — quatre sections
// m= au lieu de deux, une caméra annoncée « recvonly », une ronde de négociation en
// trop, et l'image gelée sept secondes le jour où quelqu'un ouvrait son micro.
const offreDistante = { type: "offer", sdp: "", mlignes: ["video", "audio"] };
const luiOffre = t => t.api.recevoir(`compteur-hilo/v1/${SALON}/visio/${t.lui}/${t.moi}`,
  JSON.stringify({ s: "sess1", t: "description", d: offreDistante }));
{
  const cam = new FaussePiste("video"), mic = new FaussePiste("audio");
  const t = table({ flux: new FauxFlux([cam]), micro: new FauxFlux([mic]), poli: true });
  ok("avant l'offre distante : le poli n'a créé aucun transcepteur", t.pc.transceivers.length, 0);
  luiOffre(t);
  await new Promise(r => setTimeout(r, 0));
  ok("je réponds : DEUX sections m=, pas quatre", t.pc.transceivers.length, 2);
  ok("je n'ai créé aucun transcepteur moi-même", t.pc.appels.filter(a => a === "addTransceiver").length, 0);
  ok("j'ai adopté ceux qui portent un mid", [t.p.tr.mid, t.p.trA.mid], ["0", "1"]);
  ok("vidéo et audio, chacun le sien", [t.p.tr.receiver.track.kind, t.p.trA.receiver.track.kind], ["video", "audio"]);
  ok("ma caméra part DANS la réponse", [t.p.tr.remplacements, t.p.tr.direction], [[cam], "sendrecv"]);
  ok("ma voix part DANS la réponse", [t.p.trA.remplacements, t.p.trA.direction], [[mic], "sendrecv"]);
  ok("une seule ronde : une réponse, pas une offre de plus", t.pc.localDescription.type, "answer");
  t.api.fermer();
}
{
  // Sans caméra ni micro, celui qui répond reste en recvonly — voir sans être vu,
  // entendre sans parler — mais toujours sur DEUX sections, pas quatre.
  const t = table({ poli: true });
  luiOffre(t);
  await new Promise(r => setTimeout(r, 0));
  ok("sans rien : deux sections m= quand même", t.pc.transceivers.length, 2);
  ok("sans rien : recvonly des deux côtés", [t.p.tr.direction, t.p.trA.direction], ["recvonly", "recvonly"]);
  ok("sans rien : aucune piste envoyée", [t.p.tr.sender.track, t.p.trA.sender.track], [null, null]);
  t.api.fermer();
}
{
  // Offres croisées. Elles ne peuvent arriver qu'au POLI : l'impoli, lui, IGNORE une
  // offre reçue en pleine collision (négociation parfaite). Le poli, quand son attente
  // a expiré et qu'il a offert le premier, doit défaire son offre — et ses deux
  // transcepteurs restent alors SANS mid. S'ils survivaient, ils rajouteraient deux
  // sections m= à la prochaine offre : le défaut reviendrait par la porte de derrière.
  // On attend vraiment ATTENTE_POLIE_MS ; c'est ce délai-là qu'on veut voir jouer.
  const cam = new FaussePiste("video");
  const t = table({ flux: new FauxFlux([cam]), poli: true });
  ok("le poli n'offre pas tout de suite : rien de créé", t.pc.transceivers.length, 0);
  await new Promise(r => setTimeout(r, ATTENTE_POLIE_MS + 150));
  ok("le poli a fini par offrir : deux transcepteurs à lui", t.pc.transceivers.length, 2);
  const miens = [t.p.tr, t.p.trA];
  luiOffre(t);
  await new Promise(r => setTimeout(r, 0));
  ok("offres croisées : mes orphelins sont fermés", miens.map(x => x.arrete), [true, true]);
  ok("offres croisées : je garde ceux qui portent un mid", [t.p.tr.mid, t.p.trA.mid], ["2", "3"]);
  ok("offres croisées : ma caméra suit sur le bon transcepteur", [t.p.tr.remplacements, t.p.tr.direction], [[cam], "sendrecv"]);
  ok("offres croisées : toujours deux sections m= qui comptent", t.pc.getTransceivers().filter(x => x.mid !== null && !x.arrete).length, 2);
  t.api.fermer();
}

// ── 12. « TU ES COUPÉE » : l'état du micro d'un pair voyage, et il ne se DÉDUIT jamais.
// C'était l'information la plus utilisée de toute application de parole, et elle n'existait
// nulle part : le siège d'un ami était strictement identique qu'il se taise, qu'il soit en
// sourdine ou qu'il n'ait jamais ouvert son micro.
{
  ok("trois états de voix, pas deux", ETATS_VOIX, ["ferme", "coupe", "ouvert"]);
  const t = table({});
  // ⚠️ Tout ce qui part passe par la file cadencée à ENVOI_ECART_MS : on la laisse couler.
  const couler = () => new Promise(r => setTimeout(r, ENVOI_ECART_MS * 3 + 40));
  const voixEnvoyees = () => t.envois.filter(([, m]) => JSON.parse(m).t === "voix");
  // Ce que J'ANNONCE
  ok("au départ, on annonce « ferme » (rien n'est ouvert à l'arrivée)", t.api.voixAnnoncee, "ferme");
  ok("annoncerVoix rend l'état retenu", t.api.annoncerVoix("ouvert"), "ouvert");
  // ⚠️ En appui-pour-parler la sourdine va et vient à chaque syllabe : republier à
  // l'identique inonderait un courtier qui jette au-delà de dix messages par seconde.
  t.api.annoncerVoix("ouvert");
  ok("un état inconnu n'est jamais publié ni retenu", t.api.annoncerVoix("bavard"), "ouvert");
  await couler();
  ok("annoncer publie UN SEUL message, quoi qu'on répète", voixEnvoyees().length, 1);
  ok("le message part sur le sujet « tous »", voixEnvoyees()[0][0].endsWith(`/${t.moi}/tous`), true);
  ok("le message dit la voix", JSON.parse(voixEnvoyees()[0][1]).v, "ouvert");
  // Ce que JE REÇOIS
  recevoirDe(t, { t: "voix", v: "coupe" });
  ok("la voix d'un pair remonte à l'écran", t.voix[t.voix.length - 1], [t.lui, "coupe"]);
  recevoirDe(t, { t: "voix", v: "n'importe quoi" });
  ok("un état inconnu venu du réseau est ignoré", t.voix.length, 1);
  t.api.fermer();
}
{
  // Le salut PORTE l'état : un pair arrivé après coup, ou un message perdu sous le quota
  // du courtier, se rattrapent tout seuls à la prochaine ronde — sans quoi un badge
  // « en sourdine » resterait faux jusqu'à la fin de la partie.
  const t2 = table({});
  recevoirDe(t2, { t: "salut", v: "ouvert" });
  ok("le salut d'un pair porte sa voix", t2.voix[t2.voix.length - 1], [t2.lui, "ouvert"]);
  recevoirDe(t2, { t: "salut" });
  ok("un salut sans voix ne dit rien (les anciens clients ne mentent pas)", t2.voix.length, 1);
  t2.api.fermer();
}
{
  // 🚨 IMAGE ET VOIX TOMBENT ENSEMBLE : elles voyagent dans la MÊME RTCPeerConnection.
  // Les messages d'échec ne parlaient que de la vidéo — celui qui gardait exprès sa caméra
  // fermée pour ne faire que parler y lisait une bonne nouvelle.
  ok("l'échec sans relais parle de la voix aussi", /voix/i.test(SANS_RELAIS_MESSAGE), true);
  ok("l'échec avec relais parle de la voix aussi", /voix/i.test(AVEC_RELAIS_MESSAGE), true);
  ok("l'échec sans relais dit encore où aller", /relais/.test(SANS_RELAIS_MESSAGE) && /⚙/.test(SANS_RELAIS_MESSAGE), true);
}

console.log(`\n${pass} tests passés, ${fail} échecs`);
process.exit(fail ? 1 : 0);
