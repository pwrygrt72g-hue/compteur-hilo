// La visio, SANS navigateur : ce qui se décide avant la première RTCPeerConnection.
// Ce que ce fichier protège : la liste des serveurs ICE. Un TURN mort inscrit en dur
// (Open Relay, 5 septembre 2026) ralentissait la collecte de tout le monde sans rien
// relayer ; désormais le relais vient de ⚙, et sans identifiants on part en STUN seul.
//   node src/visio.test.mjs
import { serveursIce, urlsRelais, relaisConfigure, SERVEURS_ICE, SERVEURS_STUN, sujetVisio, testamentVisio,
  expliquerEchec, MESSAGE_ARTEFACT, SANS_RELAIS_MESSAGE, PAIRS_MAX } from "./visio.mjs";

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

console.log(`\n${pass} tests passés, ${fail} échecs`);
process.exit(fail ? 1 : 0);
