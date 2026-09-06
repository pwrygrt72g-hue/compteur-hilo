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
  VIDEO_MAX, PALIERS_ENCODAGE, LIEN_SITE, GIGUE_SALUT_MS, GIGUE_OFFRE_MS, REOFFRE_MS,
  ATTENTE_POLIE_MS, ENVOI_ECART_MS, SALUT_INTERVALLE_MS, SILENCE_ICE_MS, SILENCE_MAX_MS,
  creerVisio } from "./visio.mjs";

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
ok("le message de l'artefact porte le lien du site", MESSAGE_ARTEFACT.includes(LIEN_SITE), true);
// 🚨 UNE SEULE ADRESSE DANS TOUT LE MODULE, et aucun texte visible qui nomme
// l'hébergeur : le jour où l'application déménage sous son nom de domaine, on
// change LIEN_SITE et rien d'autre. « la version GitHub Pages » écrite en toutes
// lettres serait alors une phrase fausse que personne n'irait relire.
ok("l'adresse du site est une URL complète", /^https:\/\/[^\s]+\/$/.test(LIEN_SITE), true);
ok("aucun texte destiné à l'écran ne nomme d'hébergeur", /github|pages|netlify|vercel/i.test(MESSAGE_ARTEFACT.replace(LIEN_SITE, "")), false);
ok("le message « sans relais » envoie vers ⚙", SANS_RELAIS_MESSAGE.includes("⚙") && /relais/.test(SANS_RELAIS_MESSAGE), true);
/* ══ LE PLAFOND : DEUX NOMBRES, PAS UN (6 septembre 2026) ═══════════════════
   La table est passée à huit sièges. Si le maillage avait suivi, la pointe de
   signalisation reçue par la dernière personne à entrer serait montée à 20
   msg/s contre un quota d'emqx mesuré à ~10 — et ce qui dépasse est jeté sans
   un mot. On a donc séparé ce qui coûte cher (les IMAGES) de ce qui ne coûte
   rien (les VOIX, 24 à 40 kbit/s le pair).
   🚨 Ces deux tests sont là pour empêcher qu'on les refusionne « pour
   simplifier » : ce serait rendre muettes les deux dernières personnes assises. */
ok("huit connexions : tout le monde a une voix", PAIRS_MAX, 8);
ok("six images : moi et cinq vignettes distantes", VIDEO_MAX, 6);
ok("le plafond des images est SOUS celui des connexions", VIDEO_MAX < PAIRS_MAX, true);
ok("les deux gigues existent et sont bornées", [GIGUE_SALUT_MS, GIGUE_OFFRE_MS], [1500, 1200]);
// Le filet de menage() ré-offre au bout de REOFFRE_MS. Si l'attente polie plus la
// gigue le dépassait, il offrirait PAR-DESSUS l'attente : deux offres pour une
// paire, la collision que tout ce fichier s'applique à éviter.
ok("attente polie + gigue restent sous la ré-offre", ATTENTE_POLIE_MS + GIGUE_OFFRE_MS < REOFFRE_MS, true);
ok("deux paliers d'encodage, du plus généreux au plus sobre", PALIERS_ENCODAGE.map(x => x.bits), [250000, 150000]);
ok("le palier sobre couvre jusqu'à sept pairs", PALIERS_ENCODAGE[PALIERS_ENCODAGE.length - 1].pairs >= PAIRS_MAX - 1, true);

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
    // Les paramètres d'encodage : le vrai sender en a, le nôtre aussi — sans quoi
    // reglerEncodage() passerait son chemin (il vérifie les deux méthodes) et les
    // paliers ne seraient jamais éprouvés.
    this.params = { encodings: [{}] };
    this.sender = { track: typeof source === "string" ? null : source,
      replaceTrack: t => { this.remplacements.push(t); this.sender.track = t; return Promise.resolve(); },
      getParameters: () => this.params,
      setParameters: prm => { this.params = prm; this.reglages = (this.reglages || 0) + 1; return Promise.resolve(); } };
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
    // ⚠️ LA DESCRIPTION PORTE SES LIGNES m=, comme une vraie SDP. Sans ça, une offre
    // publiée par un pair et reçue par un autre n'annonce RIEN, setRemoteDescription
    // ne crée aucun transcepteur et adopter() n'a rien à adopter : le côté qui RÉPOND
    // reste sans pistes. Un banc de deux instances ne le voit pas (les tests d'en bas
    // fabriquent l'offre à la main, avec ses mlignes) ; un maillage de huit, si.
    this.localDescription = { type: reponse ? "answer" : "offer", sdp: "", mlignes: this.transceivers.map(x => x.genre) };
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

/* ══ 13. LE PLAFOND DES IMAGES, EN MARCHE ═══════════════════════════════════
   Une table pleine, vue de MA place. Ce qu'on protège ici, dans l'ordre
   d'importance :
   · la VOIX de tout le monde. C'est la règle, pas un détail de réglage : la
     sixième personne qui s'assied parle et entend comme les cinq premières.
     Le mécanisme d'avant refusait la connexion ENTIÈRE au sixième pair — donc
     l'image ET la voix — et l'écran lui disait « table pleine ». Depuis qu'on
     peut se parler autour de la table (6 septembre 2026), ce refus-là voulait
     dire « tu es assis et tu es muet », ce qui n'est pas une place.
   · le rationnement des IMAGES, déterministe et SANS un message de plus : les
     plus anciennement connus d'abord. Les deux côtés le calculent chacun de
     leur côté et tombent d'accord — c'est le but.
   · une place libérée qui REND son image. Sans ça, la sixième personne resterait
     une silhouette jusqu'à la fin de la partie sur une table qui s'est vidée.
   ═══════════════════════════════════════════════════════════════════════════ */
{
  const cam = new FaussePiste("video"), mic = new FaussePiste("audio");
  const etats = [];
  const api = creerVisio({
    reseau: { publier: () => {}, souscrire: () => {} },
    salon: SALON, moi: "jZ", nom: "moi",              // « jZ » : je suis l'impoli de tout le monde
    flux: new FauxFlux([cam]), micro: new FauxFlux([mic]),
    onFlux: () => {}, onAudio: () => {}, onDepart: () => {}, onEtat: (id, e) => etats.push([id, e]),
  });
  const venir = n => api.recevoir(`compteur-hilo/v1/${SALON}/visio/${n}/tous`, JSON.stringify({ s: "s" + n, t: "salut" }));
  const assis = ["jA", "jB", "jC", "jD", "jE", "jF", "jG"];
  assis.forEach(venir);
  const de = n => api.pairs.get(n);

  ok("sept pairs assis, donc huit personnes", api.pairs.size, PAIRS_MAX - 1);
  ok("les cinq premiers ont droit à l'image", assis.slice(0, 5).map(n => de(n).image), [true, true, true, true, true]);
  ok("les suivants sont en SON SEUL, pas dehors", assis.slice(5).map(n => de(n).image), [false, false]);
  ok("…et ils ont bel et bien une connexion", assis.slice(5).map(n => !!de(n).pc), [true, true]);
  ok("cinq images distantes, VIDEO_MAX - 1", assis.filter(n => de(n).image).length, VIDEO_MAX - 1);

  // La neuvième personne, elle, est vraiment refusée : PAIRS_MAX est atteint.
  venir("jH");
  ok("au-delà de huit personnes, la connexion est refusée", api.pairs.has("jH"), false);
  ok("et l'écran l'apprend", etats.some(([id, e]) => id === "jH" && e === "refuse"), true);

  await new Promise(r => setTimeout(r, GIGUE_OFFRE_MS + 150));   // les offres partent avec leur gigue

  ok("chaque paire a ses deux lignes m=, son seul compris", assis.map(n => de(n).pc.transceivers.length), [2, 2, 2, 2, 2, 2, 2]);
  ok("ordre m= tenu partout : vidéo puis audio", de("jG").pc.transceivers.map(x => x.genre), ["video", "audio"]);
  // 🚨 LE TEST QUI COMPTE : ma voix part vers TOUT LE MONDE, mon image vers cinq.
  ok("ma voix part vers les sept", assis.map(n => de(n).trA.sender.track === mic), [true, true, true, true, true, true, true]);
  ok("mon image part vers les cinq premiers", assis.slice(0, 5).map(n => de(n).tr.sender.track === cam), [true, true, true, true, true]);
  ok("et vers personne d'autre", assis.slice(5).map(n => de(n).tr.sender.track), [null, null]);
  ok("le son seul reste en recvonly pour l'image, sendrecv pour la voix",
    [de("jG").tr.direction, de("jG").trA.direction], ["recvonly", "sendrecv"]);

  // Les paliers : cinq images sortantes, donc le palier sobre.
  const pal = PALIERS_ENCODAGE[1];
  ok("à cinq images, le palier sobre est posé sur les émetteurs",
    de("jA").tr.sender.getParameters().encodings[0],
    { maxBitrate: pal.bits, maxFramerate: pal.images, scaleResolutionDownBy: pal.reduction });

  // Une place se libère : la sixième personne récupère son image, sans rien demander.
  ok("avant le départ, jF est en son seul", de("jF").image, false);
  api.depart("jA");
  ok("une place libérée rend l'image", de("jF").image, true);
  ok("…et ma caméra part vraiment vers elle", de("jF").tr.sender.track, cam);
  ok("celle d'après attend toujours son tour", de("jG").image, false);
  ok("toujours cinq images distantes, jamais six", assis.slice(1).filter(n => de(n).image).length, VIDEO_MAX - 1);
  api.fermer();
}
{
  // À DEUX, RIEN N'A CHANGÉ : pas de gigue, l'impoli offre de façon SYNCHRONE.
  // C'est ce qui garantit qu'une table ordinaire ne paie pas le prix d'une salve
  // qui ne peut pas s'y produire — et que le banc à deux navigateurs reste aussi
  // rapide qu'avant.
  const t = table({});
  ok("à deux : la paire est garnie tout de suite, sans attendre", [!!t.p.tr, !!t.p.trA], [true, true]);
  ok("à deux : l'unique pair a droit à l'image", t.p.image, true);
  ok("à deux : aucun minuteur d'attente n'a été posé", t.p.attentePolie, null);
  t.api.fermer();
}

/* ══ 14. LE RATIONNEMENT DES IMAGES EST SYMÉTRIQUE ══════════════════════════
   Ce que ces tests protègent, et pourquoi ils existent : `p.image` n'est pas
   qu'un réglage de débit, c'est ce que l'ÉCRAN lit pour dire « vous êtes en son
   seul, vous ne vous voyez pas » (app/visio.js, rvSonSeul). Si les deux côtés
   d'une paire ne tombent pas d'accord, celui qui ne reçoit rien affiche « sa
   caméra est coupée » sur quelqu'un dont la caméra est allumée et qui émet.
   La règle d'avant triait sur `ne`, une horloge LOCALE : le dernier arrivé
   rencontre tout le monde à la même seconde alors que tout le monde l'a
   rencontré en dernier. Mesuré le 6 septembre 2026, huit personnes, ce module
   contre un faux courtier : 12 paires asymétriques sur 28 en régime établi, et
   quatre personnes qui RECEVAIENT six ou sept flux là où VIDEO_MAX en promet
   cinq. On trie donc sur l'instant d'arrivée que chacun ANNONCE, et une paire
   n'échange ses images que si SES DEUX MEMBRES sont en tête de liste.
   ═══════════════════════════════════════════════════════════════════════════ */
{
  const noms = ["jA", "jB", "jC", "jD", "jE", "jF", "jG", "jH"];
  const gens = new Map();
  const pub = (de, s, m) => { for (const [id, v] of gens) if (id !== de) v.recevoir(s, m); };
  // Chacun s'assied 100 ms après le précédent. On fige Date.now() le temps de la
  // construction : c'est là que `monArrivee` est pris, et on veut huit valeurs connues.
  const vraiNow = Date.now;
  noms.forEach((n, i) => {
    Date.now = () => 100000 + i * 100;
    gens.set(n, creerVisio({
      reseau: { publier: (s, m) => pub(n, s, m), souscrire: () => {} },
      salon: SALON, moi: n, nom: n,
      flux: new FauxFlux([new FaussePiste("video")]), micro: new FauxFlux([new FaussePiste("audio")]),
      onFlux: () => {}, onAudio: () => {}, onDepart: () => {}, onEtat: () => {}, onVoix: () => {},
    }));
  });
  Date.now = vraiNow;
  // Le salut du vrai module porte `a` : on le rejoue à l'identique, deux rondes.
  const saluer = () => noms.forEach((n, i) =>
    pub(n, `compteur-hilo/v1/${SALON}/visio/${n}/tous`, JSON.stringify({ s: "s" + n, t: "salut", n, a: 100000 + i * 100 })));
  saluer(); saluer();
  // Les offres partent avec leur gigue et passent par la file cadencée à
  // ENVOI_ECART_MS : à huit, la table met quelques secondes à se nouer entièrement.
  await new Promise(r => setTimeout(r, ATTENTE_POLIE_MS + GIGUE_OFFRE_MS + 2500));

  const envoie = (a, b) => { const p = gens.get(a).pairs.get(b); return !!p && p.image === true; };
  let asym = 0;
  for (let i = 0; i < noms.length; i++) for (let j = i + 1; j < noms.length; j++)
    if (envoie(noms[i], noms[j]) !== envoie(noms[j], noms[i])) asym++;
  ok("huit personnes : AUCUNE paire asymétrique", asym, 0);
  ok("les six premiers assis échangent leurs images", noms.slice(0, VIDEO_MAX).map(n => noms.filter(m => m !== n && envoie(n, m)).length),
    [5, 5, 5, 5, 5, 5]);
  ok("les suivants sont en son seul avec TOUT LE MONDE", noms.slice(VIDEO_MAX).map(n => noms.filter(m => m !== n && envoie(n, m)).length), [0, 0]);
  // 🚨 LE PLAFOND VAUT DANS LES DEUX SENS. Celui qui monte était tenu ; celui qui
  // descend ne l'était pas, et c'est pourtant lui que l'écran promet (« moi et cinq
  // vignettes distantes »). Sept flux à décoder, ce n'est pas cinq.
  const entrants = noms.map(n => noms.filter(m => m !== n && envoie(m, n)).length);
  ok("personne ne REÇOIT plus de VIDEO_MAX - 1 images", entrants.filter(x => x > VIDEO_MAX - 1).length, 0);
  ok("…et ce que je reçois est exactement ce que j'envoie", entrants, noms.map(n => noms.filter(m => m !== n && envoie(n, m)).length));
  // 🚨 ET LA VOIX DE TOUT LE MONDE, Y COMPRIS DES DEUX QUI N'ONT PAS D'IMAGE. C'est
  // la promesse du 🚨 en tête de visio.mjs (« ne rends pas muettes les deux dernières
  // personnes assises »), et c'est le seul endroit où on la vérifie sur une table
  // ENTIÈRE plutôt que du point de vue d'une seule personne.
  const voixVersTous = n => {
    const v = gens.get(n);
    return [...v.pairs.values()].every(p => p.trA && p.trA.sender.track && p.trA.sender.track.kind === "audio");
  };
  ok("tout le monde émet sa voix vers tous ses pairs, son seul compris", noms.map(voixVersTous), [true, true, true, true, true, true, true, true]);
  ok("…et les deux sans image ont bien sept pairs chacun", noms.slice(VIDEO_MAX).map(n => gens.get(n).pairs.size), [PAIRS_MAX - 1, PAIRS_MAX - 1]);

  // Une place se libère : tout le monde le voit pareil, et le premier en attente entre.
  for (const [id, v] of gens) { if (id !== "jA") v.depart("jA"); }
  gens.get("jA").fermer(); gens.delete("jA");
  const restants = [...gens.keys()];
  let asym2 = 0;
  for (let i = 0; i < restants.length; i++) for (let j = i + 1; j < restants.length; j++)
    if (envoie(restants[i], restants[j]) !== envoie(restants[j], restants[i])) asym2++;
  ok("après un départ : toujours aucune paire asymétrique", asym2, 0);
  ok("la place libérée revient au premier en attente (jG)", restants.filter(m => m !== "jG" && envoie("jG", m)).length, 5);
  ok("et le dernier attend toujours son tour", restants.filter(m => m !== "jH" && envoie("jH", m)).length, 0);
  for (const v of gens.values()) v.fermer();
}
{
  // 🚨 CELUI QUI RÉPOND À UN SON SEUL DOIT QUAND MÊME ENVOYER SA VOIX. C'est
  // brancher() qui la pose (adopter l'appelle), et RIEN ne le vérifiait : la
  // mutation qui gate la voix sur `p.image` dans brancher() laissait la suite
  // entièrement verte, alors que la même mutation dans garnir() était bien
  // attrapée. Vérifié en vrai WebRTC : avec elle, un côté n'entend plus rien.
  const cam = new FaussePiste("video"), mic = new FaussePiste("audio");
  const api = creerVisio({
    reseau: { publier: () => {}, souscrire: () => {} },
    salon: SALON, moi: "jA", nom: "moi",       // « jA » : je suis le POLI de tout le monde, donc je RÉPONDS
    flux: new FauxFlux([cam]), micro: new FauxFlux([mic]),
    onFlux: () => {}, onAudio: () => {}, onDepart: () => {}, onEtat: () => {}, onVoix: () => {},
  });
  // Ils s'asseyent tous APRÈS moi : je suis donc en tête de liste, et ce sont eux
  // que le plafond repousse — pas moi.
  const apres = Date.now() + 1000;
  ["jB", "jC", "jD", "jE", "jF", "jG", "jH"].forEach((n, i) =>
    api.recevoir(`compteur-hilo/v1/${SALON}/visio/${n}/tous`, JSON.stringify({ s: "s" + n, t: "salut", a: apres + i })));
  const seul = api.pairs.get("jH");
  ok("le dernier assis est bien en son seul", seul.image, false);
  api.recevoir(`compteur-hilo/v1/${SALON}/visio/jH/jA`, JSON.stringify({ s: "sjH", t: "description", d: offreDistante }));
  await new Promise(r => setTimeout(r, 0));
  ok("je RÉPONDS à un son seul : ma voix part quand même", seul.trA.sender.track, mic);
  ok("…et sa direction dit bien que j'émets", seul.trA.direction, "sendrecv");
  ok("je RÉPONDS à un son seul : mon image, elle, ne part pas", seul.tr.sender.track, null);
  ok("…et deux sections m=, pas quatre", seul.pc.transceivers.length, 2);
  api.fermer();
}
/* ══ 15. LES SEUILS DE SILENCE SE COMPTENT EN SALUTS ════════════════════════
   Le 6 septembre 2026, SALUT_INTERVALLE_MS est passé de 2 s à 3 s pour tenir
   sous le quota du courtier, et SILENCE_ICE_MS est resté à 3 s : le rapport est
   tombé à 1,00, donc ZÉRO marge. Mesuré : un pair parfaitement vivant, qui
   saluait à la cadence normale mais dont ICE hoquetait, était retiré à 3,00 s —
   avant même son deuxième salut. Ces deux tests existent pour que le prochain
   qui touche à la cadence des saluts voie tout de suite ce qu'il déplace.
   ═══════════════════════════════════════════════════════════════════════════ */
ok("un salut entier de marge avant de déclarer parti sur ICE coupé", SILENCE_ICE_MS >= SALUT_INTERVALLE_MS * 1.5, true);
ok("deux saluts entiers de marge quand ICE tient encore", SILENCE_MAX_MS >= SALUT_INTERVALLE_MS * 2, true);
ok("le seuil « ICE coupé » reste le plus rapide des deux", SILENCE_ICE_MS < SILENCE_MAX_MS, true);
ok("la promesse du haut du fichier tient : moins de douze secondes", SILENCE_MAX_MS < 12000, true);

console.log(`\n${pass} tests passés, ${fail} échecs`);
process.exit(fail ? 1 : 0);
