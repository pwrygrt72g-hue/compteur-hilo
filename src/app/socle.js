/* ══════════════════════════════════════════════════════════════════════
   L'application. Tout ce qui est cher — stratégies de base, écarts au compte,
   avantage maison — a été calculé à la construction et vit dans DONNEES.
   Ici on ne fait que jouer, afficher, et mesurer.

   ── Le bus d'événements de la table ──────────────────────────────────
   La scène (table.js) ÉMET, les calques (jetons.js, croupier.js, cartes.js)
   ÉCOUTENT : `document.addEventListener("sabot:carte", e => e.detail…)`.
   Personne ne touche aux lignes de la scène pour se brancher dessus.

     sabot:table            { table }                 la table (et son lieu) est posée
     sabot:remelange        { table, cartes }         sabot neuf ou mélangeuse : compte à zéro
     sabot:donne-debut      { table, sieges, mise?, jetons?, tc? }  la donne commence, les mains
                            sont vides. mise = ta mise en UNITÉS du minimum, jetons = en jetons,
                            tc = compte vrai figé à la fermeture des mises (null si système
                            déséquilibré) — posés par jetons.js dans son propre écouteur, donc
                            visibles des écouteurs enregistrés APRÈS lui (croupier.js) seulement
     sabot:carte            { siege, main, index, carte, cachee, depuis:{x,y}, vers:{x,y}, el }
                            siege = indice du siège, ou "croupier" ; depuis = centre du sabot,
                            vers = centre de la carte posée ; el = l'élément de la carte
     sabot:tour             { siege, main, toi }      c'est à ce siège de jouer
     sabot:croupier-revele  { carte, total }          la carte cachée est retournée
     sabot:main-fin         { siege, main, toi, issue, montant }
                            issue ∈ gagne · perd · bust · blackjack · egalite · abandon ;
                            montant en unités de mise (négatif = perdu). Un bust et un abandon
                            sont émis À L'INSTANT, les autres au règlement.
     sabot:manche-fin       { issues, toi, net, solde } issues[siege][main] ; toi = tes issues
     sabot:sieges           { sieges }                les sièges viennent d'être redessinés (les
                            cercles de mise sont NEUFS : jetons.js y repose ses piles)
     sabot:assurance-offre  { siege, main, toi, cout, possible }  AVANT la question : un écouteur
                            peut poser possible=false (pas de quoi payer) — la question est sautée
     sabot:assurance        { siege, main, toi, prise, montant }  la réponse, montant en jetons
     sabot:assurance-fin    { siege, main, toi, gagne, montant }  l'assurance est réglée (+mise si
                            le croupier avait blackjack, −moitié sinon), avant les main-fin
     sabot:reseau-entree    { api, code, moi }        la table à plusieurs est reliée (reseau.js) ;
                            api.brut = l'api de net.mjs, absent avec le transport muet de la sonde
     sabot:reseau-pairs     { pairs }                 la liste des pairs de la salle a changé (Map id → { id, nom })
     sabot:reseau-sortie    {}                        on quitte la table à plusieurs
     Les montants sont en JETONS : hand.bet porte la vraie mise depuis le lot Jetons.
     remelange porte aussi pendantDonne:true quand le sabot est renouvelé au milieu d'une donne.
   ══════════════════════════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);
const emettre = (nom, detail) => document.dispatchEvent(new CustomEvent("sabot:" + nom, { detail: detail || {} }));
const E = M.engine, SOL = M.solver, SH = M.shuffle, CT = M.counting, NET = M.net, TR = M["table-reseau"];
const RANKS = E.RANKS, SUITS = E.SUITS;
const sgn = n => n > 0 ? "+" + n : n < 0 ? "\u2212" + Math.abs(n) : String(n);
const fr1 = x => x.toFixed(1).replace(".", ",");
const fr2 = x => x.toFixed(2).replace(".", ",");
const dodo = ms => new Promise(r => setTimeout(r, ms));
const alea = n => { const max = Math.floor(0x100000000 / n) * n, a = new Uint32Array(1);
  do { crypto.getRandomValues(a); } while (a[0] >= max); return a[0] % n; };
const echap = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ── Mémoire locale ─────────────────────────────────────────────────── */
const DB = { prenom: "", son: true, sys: "hilo", theme: "", table: "boulevard", sessions: [],
  strat: { base: [0, 0], ecarts: [0, 0], assurance: [0, 0] }, fautes: [],
  // Le tapis : tes jetons en main. Tout le monde s'assoit avec 1 000 ; `engage` est
  // ce qui est posé sur le feutre (rendu au chargement si une main a été interrompue).
  tapis: 1000, rachats: 0, engage: 0 };
// La clé s'appelle « sabot ». L'ancienne (« laque_v1 ») est relue une fois pour
// ne perdre ni prénom ni historique, puis tout s'écrit sous le nouveau nom.
try { Object.assign(DB, JSON.parse(localStorage.getItem("sabot") || localStorage.getItem("laque_v1") || "{}")); } catch (e) {}
DB.strat = Object.assign({ base: [0, 0], ecarts: [0, 0], assurance: [0, 0] }, DB.strat || {});
DB.fautes = DB.fautes || []; DB.sessions = DB.sessions || [];
const garder = () => { try { localStorage.setItem("sabot", JSON.stringify(DB)); } catch (e) {} };
const sys = () => DONNEES.systemes[DB.sys] || DONNEES.systemes.hilo;
// 900 ms par carte : le rythme d'un vrai croupier. À 400 les cartes tombaient trop vite (Léo, 04/09).
if (DB.cadence === undefined || DB.cadence === 400) DB.cadence = 900;
// L'aide à la décision : "auto" = allumée les vingt premières mains, puis un vrai/faux (table.js, aideActive).
if (DB.conseil === undefined) DB.conseil = "auto";
// Les cartes ont 13 rangs à l'écran, mais 10 en mathématiques : 10, V, D et R
// sont une seule et même colonne. Tout ce qui parle au solveur ou au comptage
// passe par rg(). Sans ça, un roi tombe hors du tableau et le compte devient NaN.
const rg = c => (c.i >= 9 ? 9 : c.i);
const valeurCompte = c => sys().v[rg(c)];
const tableCourante = () => DONNEES.catalogue.find(t => t.id === DB.table) || DONNEES.catalogue[0];
const donneesTable = () => DONNEES.tables[tableCourante().id];
const prenom = () => DB.prenom.trim();

/* ── Sons : synthétisés, jamais un fichier ───────────────────────────────
   Tout est fabriqué au vol par WebAudio : du bruit filtré pour ce qui frotte
   (une carte qui sort du sabot, le raclement du mélange), des impulsions courtes
   pour ce qui claque (une carte qui se pose, des jetons qui tintent), des
   oscillateurs pour ce qui sonne (le blackjack, le gain, le bust).
   · Rien ne part avant un geste : le contexte est CRÉÉ au chargement (c'est permis,
     il naît « suspended »), hors du chemin critique, et n'est que REPRIS (resume,
     1-2 ms) au premier pointeur ou à la première touche — la règle d'autoplay des
     navigateurs porte sur la lecture, pas sur la création. Mesuré le 05/09 : le
     constructeur seul prenait 535-624 ms SYNCHRONES dans le clic « Distribuer » ;
     la page gelait, la main du croupier sautait au sabot quand l'image revenait.
     Hors geste, un son demandé est noté au journal et se tait.
   · Jamais deux fois le même son à l'identique : chaque genre tire une hauteur
     à ±8 %, différente de la précédente (variation).
   · Un seul volume général (DB.volume, 0-100, défaut 60), réglé dans ⚙, en plus
     de la coupure DB.son. La courbe est en puissance 1,6 : 60 sonne « moyen ».
   · Chaque son a UN nom, et le bus les déclenche : sabot:carte (la pose, calée
     sur l'arrivée de la carte), sabot:main-fin (gain, bust, blackjack), les
     jetons qui volent (jetons.js, vol). synthese() est pure — un contexte, une
     sortie, un instant — ce qui la rend mesurable hors ligne (outils/ecouter.mjs). */
if (typeof DB.volume !== "number" || isNaN(DB.volume)) DB.volume = 60;
let AC = null, MG = null;
const SON_JOURNAL = [], SON_TRACE = []; window.__sonJournal = SON_JOURNAL; window.__sonTrace = SON_TRACE;   // les genres joués (et horodatés), pour la sonde
const volumeGain = () => Math.pow(Math.max(0, Math.min(100, DB.volume)) / 100, 1.6);
function creerAC() {
  if (AC) return AC;
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); MG = AC.createGain(); MG.gain.value = volumeGain(); MG.connect(AC.destination); } catch (e) { AC = null; }
  return AC;
}
function ac() {
  if (!AC) creerAC();
  if (AC && AC.state === "suspended") AC.resume().catch(() => {});
  return AC;
}
// Le contexte naît une fois la page rendue (un temps mort, jamais un geste) ; le premier
// geste ne fait que le REPRENDRE. Si le navigateur refuse la création hors geste, ac() la
// refait dans le geste — l'ancien chemin, qui marche toujours.
(window.requestIdleCallback || (f => setTimeout(f, 60)))(() => { creerAC(); });
["pointerdown", "keydown"].forEach(ev => document.addEventListener(ev, () => { ac(); }, { capture: true, passive: true }));
const DERNIERE_HAUTEUR = {}, DERNIER_INSTANT = {};
function variation(genre) {
  let k, g = 0; do { k = .92 + Math.random() * .16; } while (Math.abs(k - (DERNIERE_HAUTEUR[genre] || 0)) < .015 && g++ < 12);
  DERNIERE_HAUTEUR[genre] = k; return k;
}
// Une seconde de bruit blanc, fabriquée une fois par contexte : chaque son en lit une tranche au hasard.
const BRUITS = new WeakMap();
function bruitBuffer(a) {
  let b = BRUITS.get(a); if (b) return b;
  b = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  BRUITS.set(a, b); return b;
}
// Une enveloppe : attaque linéaire, puis décroissance exponentielle (constante de temps `dec`).
function enveloppe(a, t, g, att, dec) {
  const n = a.createGain(); n.gain.setValueAtTime(0.0001, t);
  n.gain.linearRampToValueAtTime(g, t + att); n.gain.setTargetAtTime(0.0001, t + att, dec); return n;
}
// Du bruit filtré. o : { f, q, type, g, att, dec, dur, k }
function bruit(a, sortie, t, o) {
  const s = a.createBufferSource(); s.buffer = bruitBuffer(a);
  const f = a.createBiquadFilter(); f.type = o.type || "bandpass"; f.frequency.value = (o.f || 2500) * (o.k || 1); f.Q.value = o.q || 1;
  const g = enveloppe(a, t, o.g || .2, o.att || .003, o.dec || .02);
  s.connect(f).connect(g).connect(sortie); s.start(t, Math.random() * .4); s.stop(t + (o.dur || .12) + .05);
}
// Une note. o : { f, type, g, att, dec, dur, k, vers (glissando exponentiel vers cette fréquence) }
function ton(a, sortie, t, o) {
  const os = a.createOscillator(); os.type = o.type || "sine";
  const f0 = (o.f || 440) * (o.k || 1); os.frequency.setValueAtTime(f0, t);
  if (o.vers) os.frequency.exponentialRampToValueAtTime(o.vers * (o.k || 1), t + (o.dur || .2));
  const g = enveloppe(a, t, o.g || .1, o.att || .005, o.dec || .08);
  os.connect(g).connect(sortie); os.start(t); os.stop(t + (o.dur || .2) + (o.dec || .08) * 6);
}
/* La partition. `a` est un contexte (réel ou hors ligne), `sortie` un nœud, `t` l'instant.
   Rend la durée approximative du son, en secondes (pour la mesure). */
/* Le NIVEAU de chaque son. Mesuré le 06/09 (outils/ecouter.mjs) : `bust` sortait à 0,0885 de
   rms contre 0,0043 pour `carte` — un rapport de 21 pour 1, soit 26 dB —, et 4 fois plus fort
   que `gain`. Pendant une donne on entendait onze cartes à la limite de l'audible, puis un
   bust qui saute de 26 dB : l'application CRIAIT quand on perd et chuchotait quand on gagne.
   Le timbre et l'enveloppe ne bougent pas : seul le volume est ramené à la cible de sa
   FAMILLE — les gestes (carte, pose, jetons, raclement) à 0,014 de rms, les verdicts (bust,
   gain, blackjack) à 0,041, les retours d'exercice (ok, ko, alerte) à 0,016. Les facteurs
   sont le quotient mesuré ; le banc vérifie qu'aucun genre ne s'écarte de sa famille. */
const NIVEAU = { carte: 3.33, pose: 5.19, jeton: 3.78, jetons: 2.55, raclement: 1.84,
  blackjack: 1.15, bust: .46, gain: 1.83, ok: 1.82, ko: .91, alerte: 1.72 };
function synthese(a, sortie, genre, t, k) {
  k = k || 1;
  const niv = NIVEAU[genre];
  if (niv && niv !== 1) { const n = a.createGain(); n.gain.value = niv; n.connect(sortie); sortie = n; }
  switch (genre) {
    case "carte":      // une carte qui SORT du sabot : un chuintement passe-bande de 60 ms
      bruit(a, sortie, t, { f: 2600, q: .7, g: .21, att: .006, dec: .016, dur: .07, k });
      bruit(a, sortie, t + .01, { f: 6500, q: .5, type: "highpass", g: .05, att: .004, dec: .012, dur: .05, k });
      return .08;
    case "pose":       // la carte qui se POSE : un clic feutré, presque rien
      bruit(a, sortie, t, { f: 820, q: .9, type: "lowpass", g: .34, att: .002, dec: .009, dur: .04, k });
      bruit(a, sortie, t, { f: 2100, q: 1.6, g: .10, att: .001, dec: .004, dur: .02, k });
      return .05;
    case "jeton":      // UN jeton qu'on prend ou qu'on lâche : un claquement d'argile, sec
      bruit(a, sortie, t, { f: 3900, q: 2.2, g: .17, att: .001, dec: .011, dur: .05, k });
      ton(a, sortie, t, { f: 2950, type: "sine", g: .055, att: .001, dec: .026, dur: .04, k });
      return .07;
    case "jetons": {   // des jetons qui tintent : deux ou trois impulsions amorties, chacune à sa hauteur
      const n = 2 + (Math.random() < .5 ? 1 : 0); let dt = 0, fin = 0;
      for (let i = 0; i < n; i++) {
        const kk = k * (.96 + Math.random() * .08), ti = t + dt;
        bruit(a, sortie, ti, { f: 4300, q: 3, g: .15, att: .001, dec: .010, dur: .05, k: kk });
        ton(a, sortie, ti, { f: 2500 + Math.random() * 900, type: "triangle", g: .06, att: .001, dec: .042, dur: .06, k: kk });
        ton(a, sortie, ti, { f: 5300, type: "sine", g: .028, att: .001, dec: .03, dur: .05, k: kk });
        fin = dt + .12; dt += .04 + Math.random() * .025;
      }
      return fin;
    }
    case "raclement": { // le mélange : un riffle qui accélère, puis les cartes qu'on égalise en deux tapes
      bruit(a, sortie, t, { f: 700, q: .5, type: "lowpass", g: .09, att: .04, dec: .16, dur: .55, k });
      let dt = 0, pas = .026;
      for (let i = 0; i < 26 && dt < .48; i++) { bruit(a, sortie, t + dt, { f: 1500 + i * 25, q: 1.2, g: .18, att: .0015, dec: .0055, dur: .03, k }); dt += pas; pas = Math.max(.010, pas * .95); }
      bruit(a, sortie, t + .60, { f: 520, q: .8, type: "lowpass", g: .24, att: .002, dec: .02, dur: .06, k });
      bruit(a, sortie, t + .71, { f: 520, q: .8, type: "lowpass", g: .20, att: .002, dec: .018, dur: .06, k });
      return .85;
    }
    case "blackjack":  // une note douce : trois partiels, attaque lente, longue traîne
      ton(a, sortie, t, { f: 880, g: .15, att: .025, dec: .32, dur: .9, k });
      ton(a, sortie, t + .02, { f: 1320, g: .07, att: .03, dec: .22, dur: .7, k });
      ton(a, sortie, t + .04, { f: 1760, g: .035, att: .03, dec: .16, dur: .5, k });
      ton(a, sortie, t + .18, { f: 1174.7, g: .06, att: .03, dec: .28, dur: .7, k });
      return 1.6;
    case "bust":       // un boum sourd : un glissando grave, un souffle, et c'est tout
      ton(a, sortie, t, { f: 150, vers: 42, g: .62, att: .004, dec: .16, dur: .26, k });
      bruit(a, sortie, t, { f: 380, q: .6, type: "lowpass", g: .22, att: .002, dec: .05, dur: .16, k });
      return .9;
    case "gain": {     // un accord bref, majeur, égrené : do, mi, sol — et l'octave qui s'éteint
      [[523.25, 0], [659.25, .035], [783.99, .07]].forEach(([f, dt]) => {
        ton(a, sortie, t + dt, { f, type: "triangle", g: .10, att: .006, dec: .17, dur: .3, k });
        ton(a, sortie, t + dt, { f: f * 2, type: "sine", g: .03, att: .006, dec: .22, dur: .3, k });
      });
      return .9;
    }
    case "ok": ton(a, sortie, t, { f: 880, g: .11, att: .01, dec: .045, dur: .12, k }); return .3;
    case "ko": ton(a, sortie, t, { f: 220, g: .16, att: .01, dec: .09, dur: .24, k }); return .5;
    case "alerte": ton(a, sortie, t, { f: 440, g: .11, att: .01, dec: .05, dur: .12, k }); return .3;
    default: ton(a, sortie, t, { f: 560, g: .11, att: .01, dec: .05, dur: .12, k }); return .3;
  }
}
// son(genre, { apres: secondes, gain: 0-1 }) — `apres` cale le son sur une arrivée (la pose d'une carte).
function son(genre, o) {
  if (!DB.son) return; o = o || {};
  // Les verdicts (deux mains séparées gagnent d'un coup) ne sonnent qu'une fois par instant.
  const now = performance.now();
  if ((genre === "gain" || genre === "bust" || genre === "blackjack") && now - (DERNIER_INSTANT[genre] || -1e9) < 150) return;
  DERNIER_INSTANT[genre] = now;
  SON_JOURNAL.push(genre); if (SON_JOURNAL.length > 400) SON_JOURNAL.shift();
  SON_TRACE.push(genre + (o.apres ? "+" + Math.round(o.apres * 1000) : "") + "@" + Math.round(now)); if (SON_TRACE.length > 400) SON_TRACE.shift();
  if (!AC || AC.state !== "running" || !MG) return;   // pas de geste encore, ou onglet endormi : on se tait
  const sortie = o.gain !== undefined && o.gain !== 1 ? (() => { const g = AC.createGain(); g.gain.value = o.gain; g.connect(MG); return g; })() : MG;
  try { synthese(AC, sortie, genre, AC.currentTime + (o.apres || 0), variation(genre)); } catch (e) { log("son", e); }
}
function log(quoi, e) { try { console.debug(quoi, e); } catch (x) {} }
function appliquerVolume() { if (MG && AC) MG.gain.setTargetAtTime(volumeGain(), AC.currentTime, .02); }
// Mesure hors ligne (outils/ecouter.mjs) : rend le son dans un OfflineAudioContext et en donne le relief.
window.__rendreSon = async genre => {
  const dur = 2, sr = 44100, oc = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, sr * dur, sr);
  const annonce = synthese(oc, oc.destination, genre, .05, 1);
  const b = await oc.startRendering(), d = b.getChannelData(0);
  let crete = 0, dernier = 0, somme = 0;
  for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > crete) crete = v; if (v > .004) dernier = i; somme += v * v; }
  return { genre, crete: +crete.toFixed(3), rms: +Math.sqrt(somme / d.length).toFixed(4), duree: +((dernier / sr) - .05).toFixed(3), annonce };
};
/* Le bus : la pose d'une carte est calée sur son ARRIVÉE (retard + durée du vol, posés par
   table.js sur le detail) ; tes verdicts sonnent quand le croupier PAIE (au tempo de jetons.js :
   J.attente est le retard de ce siège — lu ici AVANT que jetons.js ne l'incrémente, puisque
   ce fichier est concaténé avant lui). */
document.addEventListener("sabot:carte", e => { const d = e.detail || {}; son("pose", { apres: ((d.delai || 0) + (d.duree || 0)) / 1000 }); });
document.addEventListener("sabot:main-fin", e => {
  const d = e.detail || {}; if (!d.toi) return;
  const attente = (typeof J === "object" && J && typeof J.attente === "number") ? J.attente / 1000 : 0;
  if (d.issue === "bust") son("bust");
  else if (d.issue === "blackjack") son("blackjack", { apres: attente + .12 });
  else if (d.issue === "gagne") son("gain", { apres: attente + .1 });
});
// 🚨 CE BANDEAU EST LE SEUL CANAL DE CERTAINES PANNES (un micro refusé, un casque
// débranché) : sans `role="status"` ni `aria-live`, il n'existait pas du tout pour un
// lecteur d'écran — le message apparaissait, disparaissait, et rien n'avait été dit.
// `polite` et pas `assertive` : on ne coupe pas la parole à qui est en train de lire sa
// main, on l'annonce à la première pause.
function bandeau(msg, ms) {
  const d = document.createElement("div"); d.className = "bandeau-bas"; d.textContent = msg;
  d.setAttribute("role", "status"); d.setAttribute("aria-live", "polite");
  document.body.appendChild(d); setTimeout(() => d.remove(), ms || 2600);
}

/* ── Cartes ─────────────────────────────────────────────────────────── */
// Le dessin d'une carte (carteEl, carteHtml) vit dans cartes.js, concaténé juste
// après ce fichier : une seule fabrique pour toute l'application.
function sabotNeuf(jeux) {
  const s = [];
  for (let d = 0; d < jeux; d++) for (const [suit, col] of SUITS) for (let i = 0; i < 13; i++) s.push({ r: RANKS[i], i, suit, col });
  return s;
}
// Un sabot PROUVABLE : l'empreinte est publiée avant, la graine révélée après.
async function sabotProuvable(jeux, graineDonnee) {
  const graine = graineDonnee || SH.randomSeed();
  const cartes = await SH.shuffle(sabotNeuf(jeux), graine);
  return { cartes, graine, empreinte: await SH.commit(graine) };
}

/* ── Navigation ─────────────────────────────────────────────────────── */
let vue = "accueil";
function mesurerEntete() {
  const h = document.querySelector("header");
  if (h) document.documentElement.style.setProperty("--h-entete", Math.round(h.getBoundingClientRect().height) + "px");
}
addEventListener("resize", mesurerEntete);
addEventListener("orientationchange", () => setTimeout(mesurerEntete, 120));

function aller(v) {
  // « Le salon » n'est plus une vue : c'est l'ancre « Les tables » du hall. Tout ce qui
  // y envoyait (Changer de table, le rachat, la nav cachée) arrive au bon endroit.
  if (v === "salon") return allerHall("lesTables");
  vue = v;
  // La table est un POSTE, pas un document : on empêche la page de défiler
  // sous elle, ce qui est aussi ce qui rend `100svh` stable quand la barre
  // d'URL d'un téléphone se rétracte.
  document.body.classList.toggle("a-table", v === "table");
  // Le hall est le seul écran qui sort de la colonne de 1120 px : son héros va bord à bord.
  document.body.classList.toggle("au-hall", v === "accueil");
  mesurerEntete();
  document.querySelectorAll(".vue").forEach(s => { s.hidden = s.id !== "v-" + v; });
  document.querySelectorAll("#nav button").forEach(b => b.setAttribute("aria-current", b.dataset.vue === v ? "page" : "false"));
  if (v === "progres") rendreProgres();
  if (v === "accueil") { rendreEventail(); rendreSalon(); }
  if (v === "strategie") { if (!STR.main && !STR.ecart) nouveauCoup(); rendreGrille(); }
  if (v !== "concentration" && CO.encours) finConcentration(false);
  rendreFil();
  // Changer d'écran est un événement comme un autre : la voix (visio.js) en a besoin —
  // la barre de la table emporte le bouton « Micro » avec elle, et un micro ouvert doit
  // pouvoir se montrer ailleurs.
  emettre("vue", { vue: v });
  window.scrollTo({ top: 0 });
}
// Le hall, ouvert sur une de ses salles (#lesTables, #entrainement, #prive, #bureau).
function allerHall(ancre) {
  aller("accueil");
  const e = ancre && $(ancre); if (!e) return;
  // Après le scrollTo(0) de aller() : la salle glisse sous l'en-tête collant (scroll-margin-top en CSS).
  setTimeout(() => e.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth", block: "start" }), 30);
}
document.querySelectorAll("[data-vue]").forEach(b => b.addEventListener("click", () => aller(b.dataset.vue)));
document.querySelectorAll("[data-hall]").forEach(b => b.addEventListener("click", () => allerHall(b.dataset.hall)));

/* ── Le fil d'Ariane ────────────────────────────────────────────────────
   « Hall › Le Cotai · Macao », « Hall › Salle d'entraînement › Exercices › Sabot chrono ».
   Chaque segment intermédiaire est une porte qu'on peut repousser ; le dernier dit où
   l'on est. Dans le hall, rien : on est déjà à l'entrée. */
function rendreFil() {
  const f = $("fil"); if (!f) return;
  const onglet = id => { const b = document.querySelector(`#${id} [role="tab"][aria-selected="true"]`); return b ? b.textContent.trim() : ""; };
  const pas = [];                                            // [libellé, ancre du hall ou null]
  if (vue === "table") pas.push([tableCourante().nom, null]);          // « Hall › Le Cotai » — le lieu est déjà dans la barre de la table
  else if (vue === "exercices") pas.push(["Salle d'entraînement", "entrainement"], ["Exercices", null], [onglet("ongletsEx"), null]);
  else if (vue === "strategie") pas.push(["Salle d'entraînement", "entrainement"], ["Stratégie", null], [onglet("ongletsStrat"), null]);
  else if (vue === "concentration") pas.push(["Salle d'entraînement", "entrainement"], ["Concentration", null]);
  else if (vue === "ensemble") pas.push(["Entre amis", "prive"], [onglet("mpModes"), null]);
  else if (vue === "progres") pas.push(["Bureau", "bureau"], ["Progression", null]);
  const segs = pas.filter(([l]) => l);
  f.hidden = !segs.length;
  f.innerHTML = segs.length ? `<button data-vue="accueil">Hall</button>` + segs.map(([l, a], i) =>
    `<span class="sep" aria-hidden="true">›</span>` + (a ? `<button data-hall="${a}">${echap(l)}</button>`
      : i === segs.length - 1 ? `<b aria-current="page">${echap(l)}</b>` : `<span>${echap(l)}</span>`)).join("") : "";
  f.querySelectorAll("[data-vue]").forEach(b => b.onclick = () => aller(b.dataset.vue));
  f.querySelectorAll("[data-hall]").forEach(b => b.onclick = () => allerHall(b.dataset.hall));
}
// Un onglet qui change (Défilement → Sabot chrono) change le dernier segment.
document.addEventListener("click", e => { if (e.target.closest && e.target.closest('[role="tab"]')) setTimeout(rendreFil, 0); });

/* ── Thème, son, système ────────────────────────────────────────────── */
function appliquerTheme() {
  if (DB.theme) document.documentElement.setAttribute("data-theme", DB.theme);
  else document.documentElement.removeAttribute("data-theme");
  $("theme").textContent = (DB.theme === "clair" ? "☀ " : DB.theme === "sombre" ? "☾ " : "◐ ")
    + (DB.theme ? "Thème " + DB.theme : "Thème du système");
  $("theme").title = "Basculer clair / sombre / système";
}
$("theme").onclick = () => { DB.theme = DB.theme === "" ? "sombre" : DB.theme === "sombre" ? "clair" : ""; garder(); appliquerTheme(); };
function rendreSon() { $("son").textContent = DB.son ? "♪ Sons activés" : "✕ Sons coupés";
  $("son").classList.toggle("eteint", !DB.son);
  const v = $("volume"); if (v) { v.value = DB.volume; v.disabled = !DB.son; if ($("volumeL")) $("volumeL").textContent = DB.volume + " %"; } }
$("son").onclick = () => { DB.son = !DB.son; garder(); rendreSon(); if (DB.son) son("jetons"); };
// Le volume général (0-100, défaut 60) : le curseur vit dans ⚙ avec le bouton Sons. Il
// s'entend pendant qu'on le règle — un tintement de jetons, pas plus d'un tous les 160 ms.
let VOLUME_T = 0;
if ($("volume")) $("volume").oninput = () => {
  DB.volume = +$("volume").value; garder(); rendreSon(); appliquerVolume();
  const now = performance.now(); if (now - VOLUME_T > 160) { VOLUME_T = now; son("jetons"); }
};
$("prenom").value = DB.prenom;
$("prenom").oninput = () => { DB.prenom = $("prenom").value; garder(); rendreSalut(); };
// Le hall salue par le prénom : « Bonsoir, Léo. » avant l'heure de fermeture, jamais un « Bonjour » à minuit.
// Sans prénom, la salutation est suivie du CHAMP lui-même — « Bonsoir. [Ton prénom] » : un vrai
// champ, pas un pointillé qui n'était ni un champ ni un bouton (les critiques, 05/09). Une fois
// répondu, la salutation redevient le bouton qui rouvre le champ (« modifier »).
let HALL_EDITE = false;
function rendreSalut() {
  const e = $("hallSalut"); if (!e) return;
  const p = prenom(), h = new Date().getHours(), bon = h >= 18 || h < 5 ? "Bonsoir" : "Bonjour";
  e.textContent = p ? bon + ", " + p + "." : bon + ".";
  const c = $("hallSalutChamp"); if (c) c.textContent = bon + ".";
  if (!$("hallQui")) return;
  const champ = HALL_EDITE || !p;
  $("hallPrenom").hidden = !champ; $("hallQui").hidden = champ;
  $("hallQui").setAttribute("aria-expanded", champ ? "true" : "false");
}
if ($("hallQui")) {
  const montrer = on => { HALL_EDITE = on; rendreSalut(); if (on) { $("prenom").focus(); $("prenom").select(); } else if (prenom()) $("hallQui").focus(); };
  $("hallQui").onclick = () => montrer(true);
  $("prenom").addEventListener("focus", () => { HALL_EDITE = true; });
  $("prenom").addEventListener("keydown", e => { if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); montrer(false); } });
  $("prenom").addEventListener("blur", () => setTimeout(() => { if (document.activeElement !== $("prenom")) { HALL_EDITE = false; rendreSalut(); } }, 120));
}

$("sys").innerHTML = Object.entries(DONNEES.systemes).map(([k, s]) => `<option value="${k}">${s.nom}</option>`).join("");
$("sys").value = DB.sys;
$("sys").onchange = () => { DB.sys = $("sys").value; garder(); rendreSysteme(); rendreReponses(); if (vue === "table") nouveauSabot(); };
function rendreSysteme() {
  const s = sys();
  $("sysNom").textContent = s.nom; $("sysNote").textContent = s.note;
  const groupes = {};
  RANKS.forEach((r, i) => { const k = s.v[i >= 9 ? 9 : i]; (groupes[k] = groupes[k] || []).push(r); });
  $("sysTable").innerHTML = Object.keys(groupes).sort((a, b) => a - b)
    .map(k => `<span class="regle ${+k > 0 ? "bien" : +k < 0 ? "mal" : ""}"><b class="cadran">${sgn(+k)}</b>&nbsp; ${groupes[k].join(" ")}</span>`).join("")
    + (s.equilibre ? "" : `<span class="regle">déséquilibré · départ à ${sgn(CT.compteInitial(DB.sys, +($("eJeux").value || 6)))}</span>`);
  $("cCible").textContent = sgn(CT.compteInitial(DB.sys, +$("cJeux").value) + (s.equilibre ? 0 : 4 * +$("cJeux").value));
}
// L'éventail du hall, à 250 px : quatre cartes chiffrées au hasard et l'AS DE PIQUE devant,
// jamais une figure (à cette taille le sprite des figures, pensé pour 60 px, fait dessin
// d'enfant — les critiques, 05/09 — quand les pips, eux, sont irréprochables).
function rendreEventail() {
  const f = $("eventail"); f.innerHTML = "";
  const jeu = sabotNeuf(1).filter(c => c.i >= 1 && c.i <= 9); const pris = [];
  for (let k = 0; k < 4; k++) pris.push(jeu.splice(alea(jeu.length), 1)[0]);
  pris.push(sabotNeuf(1).find(c => c.r === "A" && c.suit === "♠"));
  pris.forEach((c, k) => { const e = carteEl(c);
    e.style.transform = `translateX(-50%) rotate(${(k - 2) * 13}deg)`;
    e.style.animationDelay = (k * 65) + "ms"; f.appendChild(e); });
}
