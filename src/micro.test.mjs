// Le micro, SANS navigateur : la machine à états, la sourdine, le vumètre, le son des
// autres. Tout est faux sauf le code testé — un faux getUserMedia, un faux AudioContext
// dont on choisit l'amplitude, un faux document.
//
// Ce que ce fichier protège avant tout : on arrive MUET (personne n'est diffusé sans
// avoir cliqué), la sourdine GARDE la piste (la retirer renégocierait à chaque clic),
// et le micro reste une permission SÉPARÉE de la caméra (audio: false y est délibéré).
//   node src/micro.test.mjs
import { microPartage, creerMicro, creerVumetre, creerSortieAudio,
  CONTRAINTES_MICRO, ETATS_MICRO, SEUIL_OUVRE, SEUIL_FERME, MAINTIEN_MS } from "./micro.mjs";
import { ETATS_CAMERA, CONTRAINTES } from "./camera.mjs";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
function ok(nom, a, b) {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A === B) pass++; else { fail++; console.log("  ÉCHEC :", nom, "\n    obtenu ", A, "\n    attendu", B); }
}
const dodo = ms => new Promise(r => setTimeout(r, ms));

/* ── Les faux appareils ──────────────────────────────────────────────────── */
class FaussePiste {
  constructor(kind = "audio") { this.kind = kind; this.enabled = true; this.arretee = false; this.ecoute = {}; this.clones = []; }
  addEventListener(n, f) { (this.ecoute[n] = this.ecoute[n] || []).push(f); }
  stop() { this.arretee = true; }
  clone() { const c = new FaussePiste(this.kind); c.parent = this; this.clones.push(c); return c; }
  finir() { (this.ecoute.ended || []).forEach(f => f()); }
}
class FauxFlux {
  constructor(pistes) { this.pistes = [].concat(pistes || []); }
  getTracks() { return this.pistes; }
  getAudioTracks() { return this.pistes.filter(p => p.kind === "audio"); }
  getVideoTracks() { return this.pistes.filter(p => p.kind === "video"); }
}
globalThis.MediaStream = FauxFlux;

// Un getUserMedia qu'on pilote : ce qu'il rend, ce qu'il refuse, combien de fois appelé.
let GUM = { appels: 0, contraintes: null, piste: null, erreur: null, delai: 0 };
function poserNavigateur(mediaDevices) {
  Object.defineProperty(globalThis, "navigator", { value: mediaDevices === null ? {} : { mediaDevices }, configurable: true, writable: true });
}
function navigateurNormal() {
  poserNavigateur({
    async getUserMedia(c) {
      GUM.appels++; GUM.contraintes = c;
      if (GUM.delai) await dodo(GUM.delai);
      if (GUM.erreur) throw GUM.erreur;
      GUM.piste = new FaussePiste("audio");
      return new FauxFlux([GUM.piste]);
    },
  });
}
function neuf() { GUM = { appels: 0, contraintes: null, piste: null, erreur: null, delai: 0 }; navigateurNormal(); return creerMicro(); }
const echec = nom => { const e = new Error(nom); e.name = nom; return e; };
// Un AudioContext factice : chaque échantillon vaut `amplitude`, donc le RMS aussi.
let AMPLITUDE = 0, CONNEXIONS_ANALYSEUR = 0;
const fauxAC = (etat = "running") => ({
  state: etat,
  resume() { return Promise.resolve(); },
  createMediaStreamSource(f) { this.dernierFlux = f; return { connect() {}, disconnect() {} }; },
  createAnalyser() { return { fftSize: 512, smoothingTimeConstant: 0, connect() { CONNEXIONS_ANALYSEUR++; }, disconnect() {},
    getFloatTimeDomainData(t) { for (let i = 0; i < t.length; i++) t[i] = AMPLITUDE; } }; },
});

/* ── 1. Les contraintes : le micro n'est PAS un réglage de la caméra ─────── */
ok("annulation d'écho demandée", CONTRAINTES_MICRO.audio.echoCancellation, true);
ok("réduction de bruit demandée", CONTRAINTES_MICRO.audio.noiseSuppression, true);
ok("gain automatique demandé", CONTRAINTES_MICRO.audio.autoGainControl, true);
ok("le micro ne demande JAMAIS la vidéo", CONTRAINTES_MICRO.video, false);
ok("la caméra ne demande TOUJOURS PAS l'audio", CONTRAINTES.audio, false);
ok("mêmes noms d'états que la caméra (contrat partagé)", ETATS_MICRO, ETATS_CAMERA);

/* ── 2. Les seuils : une vraie hystérésis, pas un seuil unique déguisé ──── */
ok("le seuil d'ouverture est au-dessus du seuil de fermeture", SEUIL_OUVRE > SEUIL_FERME, true);
ok("un maintien non nul", MAINTIEN_MS > 0, true);

/* ── 3. On arrive MUET, toujours ─────────────────────────────────────────── */
{
  const m = neuf();
  ok("au repos : éteint", [m.etat, m.references, m.flux], ["eteinte", 0, null]);
  ok("au repos : déjà en sourdine", m.estCoupe(), true);
  const r = await m.prendre();
  ok("prendre : actif", m.etat, "active");
  ok("prendre : un flux", !!r.flux, true);
  ok("prendre : la piste est TENUE mais MUETTE", GUM.piste.enabled, false);
  ok("prendre : la piste n'est pas arrêtée pour autant", GUM.piste.arretee, false);
  ok("prendre : estCoupe() le dit", m.estCoupe(), true);
  ok("prendre : le résultat porte la sourdine", r.coupe, true);
  ok("prendre : une référence", m.references, 1);
  ok("prendre : les contraintes demandées sont celles du micro", GUM.contraintes, CONTRAINTES_MICRO);
}

/* ── 4. Ouvrir, couper, rouvrir : `enabled`, jamais la piste ─────────────── */
{
  const m = neuf();
  const r = await m.ouvrir();
  ok("ouvrir : la piste émet", GUM.piste.enabled, true);
  ok("ouvrir : plus en sourdine", [m.estCoupe(), r.coupe], [false, false]);
  ok("ouvrir : une seule référence prise", m.references, 1);
  m.couper(true);
  ok("couper : la piste est muette", GUM.piste.enabled, false);
  ok("couper : la piste EXISTE toujours (rien à renégocier)", GUM.piste.arretee, false);
  ok("couper : le flux est intact", m.flux.getAudioTracks().length, 1);
  m.couper(false);
  ok("rouvrir : la piste réémet", GUM.piste.enabled, true);
  ok("couper() sans argument bascule", [m.couper(), m.couper()], [true, false]);
  ok("couper(true) deux fois de suite : idempotent", [m.couper(true), m.couper(true)], [true, true]);
  // L'abonnement à la sourdine : l'écran ne doit pas avoir sa propre vérité.
  const vus = []; const stop = m.onSourdine(v => vus.push(v));
  m.couper(false); m.couper(false); m.couper(true);
  ok("onSourdine : notifié aux CHANGEMENTS seulement", vus, [false, true]);
  stop(); m.couper(false);
  ok("onSourdine : désabonnement", vus.length, 2);
}

/* ── 5. Le comptage de références ────────────────────────────────────────── */
{
  const m = neuf();
  await m.prendre(); await m.prendre();
  ok("deux références, un seul getUserMedia", [m.references, GUM.appels], [2, 1]);
  m.couper(false);
  m.rendre();
  ok("une référence rendue : le micro tourne encore", [m.references, m.etat, GUM.piste.arretee], [1, "active", false]);
  m.rendre();
  ok("dernière référence rendue : éteint et piste arrêtée", [m.references, m.etat, GUM.piste.arretee, m.flux], [0, "eteinte", true, null]);
  ok("au dernier rendu, la sourdine revient", m.estCoupe(), true);
  m.rendre(); m.rendre();
  ok("rendre en trop ne descend jamais sous zéro", m.references, 0);
}
{
  const m = neuf();
  GUM.delai = 5;
  const p1 = m.prendre(), p2 = m.prendre();
  await Promise.all([p1, p2]);
  ok("deux prendre simultanés : un seul getUserMedia", GUM.appels, 1);
}
{
  // Tout rendu PENDANT la demande : on n'allume pas un voyant que personne ne regarde.
  const m = neuf();
  GUM.delai = 10;
  const p = m.prendre();
  m.rendre();
  const r = await p;
  ok("rendu pendant la demande : rien n'est allumé", [r.flux, m.flux, m.etat], [null, null, "eteinte"]);
  ok("rendu pendant la demande : la piste obtenue est arrêtée", GUM.piste.arretee, true);
}
{
  // 🚨 UNE SOURDINE POSÉE PENDANT L'INVITE DE PERMISSION GAGNE CONTRE `ouvrir()`.
  // Cet `await` dure aussi longtemps que le navigateur laisse son invite à l'écran : le
  // `couper(false)` inconditionnel d'à l'arrivée écrasait tout geste fait entre-temps.
  // Mesuré à l'écran : trois clics « me couper » pendant une invite ralentie finissaient
  // en micro OUVERT — le geste qui voulait arrêter était celui qui garantissait d'être
  // diffusé. On n'ouvre donc que si personne n'a rien dit.
  const m = neuf();
  GUM.delai = 20;
  const p = m.ouvrir();
  await dodo(5);
  m.couper(true);                                  // « non, finalement, tais-moi »
  const r = await p;
  ok("sourdine demandée pendant l'invite : ouvrir() ne l'écrase PAS", [m.estCoupe(), r.coupe], [true, true]);
  ok("sourdine demandée pendant l'invite : la piste n'émet pas", GUM.piste.enabled, false);
  ok("sourdine demandée pendant l'invite : le micro est bien tenu", [m.etat, !!m.flux], ["active", true]);
}
{
  // …et sans geste entre-temps, `ouvrir()` ouvre, comme avant.
  const m = neuf();
  GUM.delai = 20;
  const r = await m.ouvrir();
  ok("sans geste pendant l'invite : ouvrir() ouvre bel et bien", [m.estCoupe(), r.coupe, GUM.piste.enabled], [false, false, true]);
}

/* ── 6. Les refus : une phrase, jamais une exception ─────────────────────── */
const refus = [
  ["NotAllowedError", "refusee"], ["PermissionDeniedError", "refusee"], ["SecurityError", "refusee"],
  ["NotFoundError", "absente"], ["DevicesNotFoundError", "absente"], ["OverconstrainedError", "absente"],
  ["NotReadableError", "occupee"], ["TrackStartError", "occupee"], ["AbortError", "occupee"],
  ["QuoiQueCeSoit", "indisponible"],
];
for (const [nom, attendu] of refus) {
  const m = neuf(); GUM.erreur = echec(nom);
  const r = await m.prendre();
  ok("refus " + nom + " → " + attendu, [m.etat, r.flux], [attendu, null]);
  ok("refus " + nom + " : une phrase pour l'écran", m.raison.length > 10, true);
  ok("refus " + nom + " : le nom technique reste dans detail", m.detail.startsWith(nom), true);
}
{
  const m = neuf(); GUM.erreur = echec("NotAllowedError");
  await m.prendre(); m.rendre();
  ok("après un refus, l'état RESTE explicable", m.etat, "refusee");
}
{
  // Pas de navigator.mediaDevices : l'artefact, ou une page non sécurisée.
  poserNavigateur(null);
  const m = creerMicro();
  const r = await m.prendre();
  ok("sans mediaDevices : indisponible, sans lever", [m.etat, r.flux], ["indisponible", null]);
  ok("sans mediaDevices : la phrase renvoie vers le site", /GitHub Pages/.test(m.raison), true);
  navigateurNormal();
}

/* ── 7. La piste qui meurt toute seule ───────────────────────────────────── */
{
  const m = neuf();
  await m.ouvrir();
  const vus = [];
  m.onEtat((e, r) => vus.push(e));
  GUM.piste.finir();
  ok("piste finie → état coupee", m.etat, "coupee");
  ok("piste finie → plus de flux", m.flux, null);
  ok("piste finie → l'écran est prévenu", vus, ["coupee"]);
  ok("piste finie → une phrase", m.raison, "Le micro s'est arrêté.");
}
{
  const m = neuf();
  await m.prendre();
  const vus = []; const stop = m.onEtat(e => vus.push(e));
  stop();
  GUM.piste.finir();
  ok("onEtat : désabonnement", vus.length, 0);
}

/* ── 8. Le vumètre ───────────────────────────────────────────────────────── */
{
  const mort = creerVumetre({});
  ok("vumètre sans rien : mort et muet", [mort.vivant, mort.niveau(), mort.parle()], [false, 0, false]);
  mort.fermer();
  ok("fermer un vumètre mort ne lève pas", true, true);
  ok("vumètre sans piste audio : mort", creerVumetre({ ac: fauxAC(), flux: new FauxFlux([new FaussePiste("video")]) }).vivant, false);
}
{
  CONNEXIONS_ANALYSEUR = 0;
  const flux = new FauxFlux([new FaussePiste("audio")]);
  const v = creerVumetre({ ac: fauxAC(), flux, maintien: 30 });
  ok("vumètre branché : vivant", v.vivant, true);
  ok("l'analyseur ne sort sur RIEN (jamais de larsen)", CONNEXIONS_ANALYSEUR, 0);
  AMPLITUDE = 0;
  ok("silence : rien ne parle", [v.niveau(), v.parle()], [0, false]);
  AMPLITUDE = SEUIL_FERME + 0.001;              // au-dessus du seuil BAS, sous le seuil haut
  ok("un souffle n'ouvre pas l'anneau", v.parle(), false);
  AMPLITUDE = SEUIL_OUVRE + 0.01;
  ok("une voix ouvre l'anneau", v.parle(), true);
  ok("le niveau est bien le RMS", Math.abs(v.niveau() - AMPLITUDE) < 1e-6, true);
  AMPLITUDE = SEUIL_FERME + 0.001;              // entre deux mots : on reste au-dessus du seuil bas
  ok("entre deux syllabes, l'anneau tient", v.parle(), true);
  AMPLITUDE = 0;
  ok("juste après le dernier mot, l'anneau tient encore (maintien)", v.parle(), true);
  await dodo(60);
  ok("après le maintien, l'anneau s'éteint", v.parle(), false);
  v.fermer();
  ok("vumètre fermé : niveau 0", [v.niveau(), v.parle()], [0, false]);
}

/* ── 9. `mesurer` : voir son propre niveau MÊME en sourdine ──────────────── */
{
  const m = neuf();
  ok("mesurer sans micro tenu : rien", m.mesurer(fauxAC()), null);
  await m.prendre();
  ok("mesurer sans AudioContext : rien (on n'en crée jamais un)", m.mesurer(null), null);
  const ac = fauxAC();
  const v = m.mesurer(ac);
  ok("mesurer : un vumètre vivant", !!v && v.vivant, true);
  ok("mesurer : idempotent", m.mesurer(ac), v);
  ok("mesurer : c'est une COPIE de la piste qu'on écoute", GUM.piste.clones.length, 1);
  ok("la copie reste ouverte alors que la piste envoyée est muette", [GUM.piste.clones[0].enabled, GUM.piste.enabled], [true, false]);
  AMPLITUDE = SEUIL_OUVRE + 0.02;
  ok("en sourdine, on voit quand même son propre niveau", m.niveau() > SEUIL_OUVRE, true);
  ok("…et qu'on parle", m.parle(), true);
  ok("mais estCoupe() dit toujours qu'on ne nous entend pas", m.estCoupe(), true);
  m.rendre();
  ok("au dernier rendu, la copie est arrêtée aussi", GUM.piste.clones[0].arretee, true);
  ok("au dernier rendu, le vumètre est fermé", m.niveau(), 0);
  AMPLITUDE = 0;
}

/* ── 10. Le son des autres : un <audio>, jamais un <video> ───────────────── */
{
  let ECHEC_LECTURE = false;
  const cree = [];
  globalThis.document = {
    createElement(n) {
      const e = { tagName: n.toUpperCase(), style: { cssText: "" }, dataset: {}, volume: 1, muted: true,
        srcObject: null, lectures: 0, retire: false,
        setAttribute(k, v) { this[k] = v; }, remove() { this.retire = true; }, pause() {},
        play() { this.lectures++; return ECHEC_LECTURE ? Promise.reject(new Error("refusé")) : Promise.resolve(); } };
      cree.push(e); return e;
    },
    body: { enfants: [], appendChild(e) { this.enfants.push(e); } },
  };
  const s = creerSortieAudio();
  const f1 = new FauxFlux([new FaussePiste("audio")]);
  const a = s.poser("jA", f1);
  ok("le son des autres sort d'un <audio>", a.tagName, "AUDIO");
  ok("…et cet <audio> n'est PAS muet", a.muted, false);
  ok("…il est dans le document (sinon il ne joue ni ne s'analyse)", document.body.enfants.length, 1);
  ok("…et il joue", a.lectures, 1);
  ok("le flux est branché", a.srcObject, f1);
  ok("element(id) le rend, pour y brancher un vumètre", s.element("jA"), a);
  ok("reposer le même pair ne crée pas un second élément", s.poser("jA", f1), a);
  s.poser("jB", new FauxFlux([new FaussePiste("audio")]));
  ok("deux pairs, deux éléments", s.pairs, ["jA", "jB"]);
  ok("volume : borné à 1", s.volume(4), 1);
  ok("volume : borné à 0", s.volume(-2), 0);
  s.volume(0.5);
  ok("volume : appliqué à tout le monde", [s.element("jA").volume, s.element("jB").volume], [0.5, 0.5]);
  s.retirer("jA");
  ok("retirer : l'élément quitte le document", [s.pairs, a.retire, a.srcObject], [["jB"], true, null]);
  s.fermer();
  ok("fermer : plus personne", s.pairs, []);

  // La lecture automatique refusée : on le DIT, et le bouton la relance.
  ECHEC_LECTURE = true;
  const s2 = creerSortieAudio();
  const bloques = []; s2.onBloque(b => bloques.push(b));
  s2.poser("jC", new FauxFlux([new FaussePiste("audio")]));
  await dodo(0);
  ok("lecture refusée : bloque", s2.bloque, true);
  ok("lecture refusée : l'écran est prévenu", bloques, [true]);
  ECHEC_LECTURE = false;
  const relance = s2.element("jC").lectures;
  s2.rejouer();
  await dodo(0);
  ok("« Activer le son » relance la lecture", s2.element("jC").lectures, relance + 1);
  ok("« Activer le son » lève le blocage", s2.bloque, false);
  s2.fermer();
  delete globalThis.document;
  const s3 = creerSortieAudio();
  ok("sans document : poser rend null au lieu de lever", s3.poser("jD", f1), null);
}

/* ── 11. Un seul micro pour toute l'application ──────────────────────────── */
navigateurNormal();
ok("microPartage : le même à chaque appel", microPartage() === microPartage(), true);
ok("creerMicro : une machine neuve à chaque fois (pour les tests)", creerMicro() === creerMicro(), false);
ok("creerMicro n'est pas le micro partagé", creerMicro() === microPartage(), false);

/* ── 12. Le revirement du 6 septembre 2026 est ÉCRIT ─────────────────────── */
// Sans ces lignes, quelqu'un « réparera » en remettant le silence — c'était une
// décision explicite, elle a été levée par une autre, les deux doivent se lire.
{
  const cam = readFileSync(new URL("./camera.mjs", import.meta.url), "utf8");
  const vis = readFileSync(new URL("./visio.mjs", import.meta.url), "utf8");
  ok("camera.mjs date le revirement", /6 SEPTEMBRE 2026/.test(cam), true);
  ok("camera.mjs garde la trace de l'ancienne décision", /JAMAIS DE MICRO/.test(cam), true);
  ok("camera.mjs dit où l'audio est parti", /micro\.mjs/.test(cam), true);
  ok("visio.mjs date le revirement", /6 SEPTEMBRE 2026/.test(vis), true);
  ok("visio.mjs garde la trace de l'ancienne décision", /PAS DE MICRO/.test(vis), true);
  ok("camera.mjs ne demande toujours pas l'audio", /audio:\s*false/.test(cam), true);
}

console.log(`\n${pass} tests passés, ${fail} échecs`);
process.exit(fail ? 1 : 0);
