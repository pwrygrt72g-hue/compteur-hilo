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
/* ── UN BANC MODAL ────────────────────────────────────────────────────────────
   Comment sonne un objet SOLIDE qu'on frappe : un choc très court excite plusieurs
   résonances qui s'éteignent chacune à son rythme. Un jeton d'argile est un disque
   libre — ses modes sont INHARMONIQUES (rapports 1 : 1,73 : 2,33 : 4,11), et c'est
   précisément ça qu'on reconnaît comme « objet » plutôt que comme « bip ».
   🚨 Mesuré le 07/09 sur l'ancien `jeton` : UN seul pic spectral, 100 % de l'énergie
   dans une octave. Une sinusoïde ne peut pas sonner comme un jeton, quel que soit
   son volume — c'est un défaut de TIMBRE, la dimension que le banc ne mesurait pas.
   ⚠️ Le Q se CALCULE, il ne se tâtonne pas : l'enveloppe d'un passe-bande décroît en
   exp(−π·f·t/Q), donc pour un T60 visé, Q = T60 · f / 2,199. Régler un Q « à l'oreille »
   fait dériver l'amortissement avec la fréquence, et les modes hauts traînent. */
function modal(a, sortie, t, o) {
  // Un mode = une SINUSOÏDE AMORTIE. Le timbre vient des RAPPORTS entre modes, pas du
  // procédé qui les fait sonner : c'est l'inharmonicité (1 : 1,73 : 2,33 : 4,11) que
  // l'oreille reconnaît comme « disque d'argile », et l'amortissement décroissant avec
  // le mode (les aigus s'éteignent les premiers) qui la rend crédible.
  // 🚨 PREMIÈRE VERSION ABANDONNÉE, et pourquoi — elle excitait quatre passe-bandes à
  // Q calculé (98 à 108) avec un choc de 0,4 ms. Le Q était juste, la physique aussi,
  // et ça ne rendait RIEN : mesuré au banc, crête 0,002 et 35,8 dB sous sa famille.
  // Une bande de 24 Hz de large ne capte presque aucune énergie d'un choc large ; il
  // aurait fallu compenser par un gain tâtonné, c'est-à-dire remplacer un réglage
  // physique par un réglage à l'oreille. Les sinusoïdes donnent le même timbre avec
  // une amplitude qu'on maîtrise.
  // ⚠️ `dec` est la constante de temps de enveloppe() : −60 dB tombe à ~6,9 τ, donc
  // pour un T60 visé, dec = T60 / 6,9. C'est la même conversion, transposée.
  let fin = 0;
  for (const m of o.modes) {
    const f = (o.f || 2400) * m.r * (o.k || 1) * (o.detune || 1);
    if (f > a.sampleRate * .45) continue;          // au-dessus de Nyquist : repliement
    ton(a, sortie, t, { f, type: "sine", g: (o.g || .3) * m.g, att: .0006, dec: m.t60 / 6.9, dur: m.t60 });
    if (m.t60 > fin) fin = m.t60;
  }
  // …et le CONTACT lui-même. Sans lui on entend une cloche minuscule ; avec lui, un
  // objet qui touche quelque chose. C'est le transitoire qui situe l'instant du choc.
  bruit(a, sortie, t, { f: (o.f || 2400) * 1.6, q: 1.2, g: (o.g || .3) * .40, att: .0004, dec: .0025, dur: .010, k: o.k || 1 });
  return fin;
}

/* Du bruit dont le filtre BALAIE — le glissement d'une carte sur du feutre est un
   frottement « stick-slip » dont le spectre se déplace, pas un filtre figé. Mesuré :
   l'ancien `carte` ne balayait que 10 demi-tons, et seulement par accident (sa 2ᵉ salve
   démarrait 10 ms plus tard). `lfo` module l'amplitude : c'est le grain du papier. */
function bruitBalaye(a, sortie, t, o) {
  const s = a.createBufferSource(); s.buffer = bruitBuffer(a);
  const f = a.createBiquadFilter(); f.type = "bandpass"; f.Q.value = o.q || 1.2;
  const k = o.k || 1, dur = o.dur || .07;
  f.frequency.setValueAtTime((o.f0 || 900) * k, t);
  f.frequency.exponentialRampToValueAtTime((o.f1 || 2600) * k, t + dur);
  const g = enveloppe(a, t, o.g || .2, o.att || .006, o.dec || .016);
  s.connect(f).connect(g);
  if (o.lfo) {
    const m = a.createGain(); m.gain.value = 1 - (o.prof || .35);
    const osc = a.createOscillator(); osc.type = "sine"; osc.frequency.value = o.lfo;
    const prof = a.createGain(); prof.gain.value = o.prof || .35;
    osc.connect(prof).connect(m.gain); osc.start(t); osc.stop(t + dur + .05);
    g.connect(m).connect(sortie);
  } else g.connect(sortie);
  s.start(t, Math.random() * .4); s.stop(t + dur + .05);
  return dur;
}

/* ── LE RIFFLE, CALCULÉ UNE FOIS ──────────────────────────────────────────────
   🚨 L'ancien mélange programmait 26 `bruit()`, soit 87 nœuds pour un seul son — à lui
   seul le pic de charge de toute la donne, sur une application dont Léo dit qu'elle
   saccade. Et il ne sonnait pas : 26 clics en 394 ms = 66 clics/s, alors qu'un vrai
   riffle lâche 52 cartes en 250-400 ms, soit 130 à 200 clics/s. À 66/s l'oreille
   RÉSOUT encore chaque clic — on entendait une crécelle, pas un déchirement.
   La densité ne se règle pas avec un volume : il faut les 52 cartes. On les calcule
   donc UNE FOIS dans un tampon, joué ensuite par trois nœuds.
   ⚠️ Le tampon est par CONTEXTE (WeakMap) : le contexte hors ligne du banc de mesure
   a sa propre fréquence d'échantillonnage, et un tampon rendu à 44,1 kHz joué à
   48 kHz transposerait tout le son. */
const RIFFLES = new WeakMap();
function riffleBuffers(a) {
  let v = RIFFLES.get(a); if (v) return v;
  const sr = a.sampleRate;
  v = [0, 1].map(variante => {
    const dur = .92, n = Math.ceil(sr * dur), b = a.createBuffer(1, n, sr), d = b.getChannelData(0);
    // 52 cartes, la cadence qui ACCÉLÈRE comme un pouce qui lâche le paquet.
    let ti = .02, pas = .0115;
    for (let i = 0; i < 52; i++) {
      const i0 = Math.floor(ti * sr), amp = .28 * (.72 + .5 * Math.random()) * (1 - i / 140);
      const lg = Math.floor(sr * .0022);
      for (let j = 0; j < lg && i0 + j < n; j++) d[i0 + j] += (Math.random() * 2 - 1) * amp * Math.exp(-j / (sr * .00035));
      ti += pas; pas = Math.max(.0053, pas * .9575);
    }
    // Le CORPS du paquet : la masse de cartes qui vibre pendant qu'elles s'entrelacent.
    const f0 = 165 * (variante ? 1.06 : 1);
    for (let j = 0; j < Math.floor(sr * .55) && j < n; j++)
      d[j + Math.floor(sr * .02)] += Math.sin(2 * Math.PI * f0 * j / sr) * .05 * Math.exp(-j / (sr * .16));
    // Les deux TAPES d'égalisation : on tasse le paquet sur la table.
    for (const [tt, aa] of [[.63, .5], [.74, .42]]) {
      const i0 = Math.floor(tt * sr), lg = Math.floor(sr * .05);
      for (let j = 0; j < lg && i0 + j < n; j++)
        d[i0 + j] += (Math.random() * 2 - 1) * aa * Math.exp(-j / (sr * .0035));
    }
    return b;
  });
  RIFFLES.set(a, v); return v;
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
// ⚠️ RECALIBRÉ le 07/09/2026, après la réécriture des cinq gestes : chaque facteur est
// le QUOTIENT MESURÉ entre le rms rendu par la nouvelle synthèse et la cible de sa
// famille (0,0133 pour les gestes). Ils ne se règlent pas à l'oreille — outils/ecouter.mjs
// les vérifie, et refuse plus de 8 dB d'écart à la médiane de la famille.
const NIVEAU = { carte: 6.71, pose: 5.19, jeton: 2.63, jetons: 2.15, raclement: 1.42,
  blackjack: .89, bust: .89, gain: 1.41, perd: .74, ok: 1.82, ko: .91, alerte: 1.72 };
/* 🚨 LA FAMILLE DE CHAQUE GENRE, DÉCLARÉE ICI. outils/ecouter.mjs portait sa propre liste
   littérale, dérivée de rien : un genre ajouté à NIVEAU sans être ajouté là-bas n'était
   mesuré par RIEN, et son `default:` le faisait passer au vert. Le banc lit désormais
   cette table (window.__sonsMesurables) et refuse un genre sans famille. */
const FAMILLE_SON = { carte: "geste", pose: "geste", jeton: "geste", jetons: "geste", raclement: "geste",
  blackjack: "verdict", bust: "verdict", gain: "verdict", perd: "verdict",
  ok: "retour", ko: "retour", alerte: "retour" };
function synthese(a, sortie, genre, t, k) {
  k = k || 1;
  const niv = NIVEAU[genre];
  if (niv && niv !== 1) { const n = a.createGain(); n.gain.value = niv; n.connect(sortie); sortie = n; }
  switch (genre) {
    case "carte":      // une carte qui SORT du sabot : le frottement, la lèvre, la boîte
      // ⚠️ Le passe-bande BALAIE (900 → 2600 Hz) : un frottement est un stick-slip dont
      // le spectre se déplace. L'ancien filtre était FIXE — d'où le « pshhh ».
      bruitBalaye(a, sortie, t, { f0: 900, f1: 2600, q: 1.2, g: .21, att: .006, dec: .016, dur: .07, lfo: 52, prof: .35, k });
      // 🚨 4200 Hz en PASSE-BANDE, plus 6500 Hz en passe-haut : un passe-haut n'a pas de
      // borne supérieure et laissait 41 % de l'énergie au-dessus de 8 kHz (mesuré) — du
      // souffle, pas une carte. C'est la détente sur la lèvre du sabot, elle est bornée.
      bruit(a, sortie, t + .01, { f: 4200, q: 1.4, g: .05, att: .004, dec: .012, dur: .05, k });
      // Le CORPS de la boîte. Sans lui, 0 % d'énergie sous 1 kHz : l'oreille entend un
      // filtre, pas un objet posé quelque part.
      bruit(a, sortie, t, { f: 240, q: 6, g: .07, att: .004, dec: .022, dur: .07, k });
      return .08;
    case "pose":       // la carte qui se POSE : un clic feutré, sur une table qui répond
      bruit(a, sortie, t, { f: 820, q: .9, type: "lowpass", g: .34, att: .002, dec: .009, dur: .04, k });
      bruit(a, sortie, t, { f: 2100, q: 1.6, g: .10, att: .001, dec: .004, dur: .02, k });
      // Le PANNEAU tendu de feutre — une table est une caisse, elle sonne grave et court.
      bruit(a, sortie, t, { f: 140, q: 3.5, g: .095, att: .003, dec: .022, dur: .06, k });
      // …et l'ARÊTE de la carte qui touche : 3 ms, c'est ce qui situe l'instant.
      bruit(a, sortie, t, { f: 5600, q: 1.1, g: .055, att: .0004, dec: .003, dur: .015, k });
      return .07;
    case "jeton":      // UN jeton d'argile : un DISQUE LIBRE, donc des modes inharmoniques
      modal(a, sortie, t, { f: 2400, g: .34, choc: .0004, k, modes: [
        { r: 1,    g: .30, t60: .090 },
        { r: 1.73, g: .17, t60: .062 },
        { r: 2.33, g: .10, t60: .042 },
        { r: 4.11, g: .05, t60: .024 }] });
      return .09;
    case "jetons": {   // une PILE qui retombe : LE MÊME objet frappé plusieurs fois
      // 🚨 Trois choses que l'ancienne version faisait à l'envers, toutes mesurées :
      //  · son pic d'enveloppe arrivait 50 ms APRÈS le début — or dans une pile qui
      //    retombe, le PREMIER choc est le plus fort, les suivants sont amortis par
      //    les jetons du dessous. D'où l'amplitude × .74 par impact.
      //  · les impacts étaient espacés de 40 à 65 ms, trop régulièrement : du vrai
      //    clapotis est GROUPÉ (9 + 31·rand² ms — la queue longue est rare).
      //  · chaque impact tirait sa hauteur au hasard : ce sont alors trois objets
      //    différents. C'est le MÊME banc, désaccordé de 2,2 % par choc, parce que
      //    la pile s'alourdit.
      const n = 3 + (Math.random() < .55 ? 1 : 0);
      let dt = 0, amp = .34, det = 1, fin = 0;
      for (let i = 0; i < n; i++) {
        const gros = i % 2 === 0 ? 1 : 1.27;   // deux tailles de jeton dans la pile
        modal(a, sortie, t + dt, { f: 2400 * gros, g: amp, choc: .00035, k, detune: det, modes: [
          { r: 1,    g: .30, t60: .072 },
          { r: 1.73, g: .15, t60: .050 },
          { r: 2.33, g: .09, t60: .034 },
          { r: 4.11, g: .04, t60: .020 }] });
        fin = dt + .10;
        const r = Math.random();
        dt += .009 + .031 * r * r; amp *= .74; det *= .978;
      }
      return fin;
    }
    case "raclement": { // le mélange : 52 cartes, calculées une fois (cf. riffleBuffers)
      // TROIS nœuds au lieu de 87. La variation vient de la vitesse de lecture et de
      // deux tampons tirés d'avance — pas d'une reprogrammation à chaque mélange.
      const bufs = riffleBuffers(a);
      const src = a.createBufferSource(); src.buffer = bufs[Math.random() < .5 ? 0 : 1];
      src.playbackRate.value = (.95 + Math.random() * .10) * k;
      const lp = a.createBiquadFilter(); lp.type = "lowpass";
      lp.frequency.value = 2600 * k; lp.Q.value = .7;
      const g = a.createGain(); g.gain.value = .95;
      src.connect(lp).connect(g).connect(sortie);
      src.start(t); src.stop(t + 1.1);
      return .85;
    }
    case "blackjack": {  // UNE CLOCHE QUI SE POSE — cinq couches, 1,85 s
      // 🚨 Mesuré le 07/09 : l'ancienne « note douce » avait le PLUS FAIBLE facteur de
      // crête des trois verdicts (6,1 contre 10,3 pour un simple gain). Une attaque de
      // 25 ms sur une sinusoïde n'a AUCUN transitoire : il n'y a pas d'instant de frappe,
      // donc rien à célébrer — et ça n'a rien à voir avec le volume, qui était déjà bon
      // (0,1 dB d'écart avec le gain). C'est la raison mesurable pour laquelle un
      // blackjack ne récompensait pas.
      // ⚠️ Aucune scie, aucune répétition, aucune montée sans fin : les trois marqueurs
      // du casino social. C'est un outil d'entraînement, la fête doit rester habillée.
      // ① LE CORPS — la main qui se pose. C'est LUI qui porte le transitoire manquant.
      ton(a, sortie, t, { f: 130.81, g: .30, att: .004, dec: .055, dur: .14, k });
      // ② L'ARPÈGE do-mi-sol, 58 ms d'écart : une phrase, pas quatre bips.
      [[523.25, 0, .115, .15], [659.25, .058, .105, .17], [783.99, .116, .100, .30]].forEach(([f, dt, g, dec]) => {
        ton(a, sortie, t + dt, { f, type: "triangle", g, att: .005, dec, dur: .26, k });
        ton(a, sortie, t + dt, { f: f * 2, type: "sine", g: g * .28, att: .005, dec: .10, dur: .26, k });
      });
      // ③ LA CLOCHE, à t+174 ms — partiels INHARMONIQUES de barre idéale. C'est
      //    l'inharmonicité qui fait « cloche frappée » plutôt qu'« accord de synthé ».
      //    ⚠️ C'est aussi l'instant que l'animation doit viser (cf. table.js).
      [[1, .105, .465], [2.76, .042, .315], [5.40, .020, .30], [8.93, .009, .22]].forEach(([r, g, dec]) => {
        ton(a, sortie, t + .174, { f: 1046.5 * r, type: "sine", g, att: .004, dec, dur: 1.5, k });
      });
      // ④ L'ÉCLAT : 45 ms de brillance, pas du bruit.
      bruit(a, sortie, t + .174, { f: 7200, q: .7, type: "highpass", g: .030, att: .004, dec: .045, dur: .14, k });
      // ⑤ LA TRAÎNE — la quinte qui reste et dit « c'est acquis ».
      ton(a, sortie, t + .174, { f: 1567.98, type: "sine", g: .030, att: .03, dec: .4125, dur: 1.4, k });
      return 1.85;
    }
    case "bust":       // « c'est refermé, on passe » — pas une punition
      // ⚠️ Ce qu'on doit RESSENTIR : la main est close. C'est un outil d'entraînement,
      // pas un casino qui gronde. Plus court qu'avant (0,46 s contre 0,68).
      // (a) LE CLIC d'attaque : l'ancienne attaque de 4 ms sur une sinusoïde de 150 Hz
      //     faisait un gonflement, pas un événement — on ne savait pas SITUER l'instant.
      bruit(a, sortie, t, { f: 900, q: .8, type: "lowpass", g: .30, att: .001, dec: .012, dur: .05, k });
      // (b) une CHUTE MUSICALE — une tierce mineure qui descend, donc une forme.
      ton(a, sortie, t, { f: 196, vers: 98, g: .40, att: .003, dec: .075, dur: .20, k });
      ton(a, sortie, t + .10, { f: 164.81, vers: 82.4, g: .22, att: .006, dec: .085, dur: .22, k });
      // (c) le souffle, resserré.
      bruit(a, sortie, t, { f: 300, q: .6, type: "lowpass", g: .13, att: .002, dec: .045, dur: .14, k });
      return .47;
    case "perd":       // la main est perdue SANS avoir sauté : on le dit, on n'en fait pas un drame
      /* La moitié des verdicts était MUETTE : le bus en déclare six (gagne, perd, bust,
         blackjack, egalite, abandon), on n'en sonorisait que trois — perdre 18 contre 20
         ne produisait AUCUN son, et on n'entendait une défaite que si l'on sautait.
         ⚠️ Une seule note basse, SANS chute : le glissando descendant est la signature du
         bust, la lui emprunter effacerait la différence entre « fermé » et « perdu ».
         Égalité et abandon restent muets, eux : il ne s'est rien passé. */
      ton(a, sortie, t, { f: 174.61, g: .34, att: .004, dec: .062, dur: .16, k });
      bruit(a, sortie, t, { f: 420, q: .7, type: "lowpass", g: .10, att: .002, dec: .028, dur: .09, k });
      return .28;
    case "gain": {     // « ça a marché » — posé, sans triomphe : il sonnera cent fois
      // Même famille tonale que le blackjack (do majeur) : le gain ÉNONCE, le blackjack
      // énonce ET résout sur l'octave. C'est ce qui les rend frères sans les rendre
      // interchangeables — mesuré avant : ils ne différaient que de 0,1 dB.
      // (a) le CORPS court dessous : le « oui » physique qui manquait.
      ton(a, sortie, t, { f: 130.81, g: .20, att: .004, dec: .045, dur: .10, k });
      // (b) l'accord se POSE au lieu de s'arrêter : la dernière note dure.
      [[523.25, 0, .100, .15], [659.25, .038, .098, .17], [783.99, .076, .100, .30]].forEach(([f, dt, g, dec]) => {
        ton(a, sortie, t + dt, { f, type: "triangle", g, att: .006, dec, dur: .3, k });
        ton(a, sortie, t + dt, { f: f * 2, type: "sine", g: g * .30, att: .006, dec: .22, dur: .3, k });
      });
      // (c) un éclat minuscule sur la dernière note.
      bruit(a, sortie, t + .076, { f: 6800, q: .7, type: "highpass", g: .014, att: .004, dec: .030, dur: .10, k });
      return 1.30;
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
  /* Les verdicts ne sonnent qu'une fois par INSTANT — et l'instant qui compte est celui où
     le son SORT (now + apres), pas celui de l'appel : `apres` porte J.attente, qui vaut
     ~140 ms par main déjà réglée et monte à plusieurs secondes à huit sièges séparés.
     🚨 UNE SEULE CLÉ pour les quatre verdicts. Étranglés par GENRE, un « gagne » et un
     « blackjack » émis dans le même tick passaient tous les deux et se superposaient
     (mesuré : +3,7 dB au-dessus de la cible de famille). 90 ms et non 150 : deux mains qui
     se règlent l'une après l'autre sont espacées de ~140 ms, et chacune doit s'entendre. */
  const now = performance.now();
  if (FAMILLE_SON[genre] === "verdict") {
    const vise = now + (o.apres || 0) * 1000;
    if (Math.abs(vise - (DERNIER_INSTANT.verdict === undefined ? -1e9 : DERNIER_INSTANT.verdict)) < 90) return;
    DERNIER_INSTANT.verdict = vise;
  }
  SON_JOURNAL.push(genre); if (SON_JOURNAL.length > 400) SON_JOURNAL.shift();
  SON_TRACE.push(genre + (o.apres ? "+" + Math.round(o.apres * 1000) : "") + "@" + Math.round(now)); if (SON_TRACE.length > 400) SON_TRACE.shift();
  if (!AC || AC.state !== "running" || !MG) return;   // pas de geste encore, ou onglet endormi : on se tait
  const sortie = o.gain !== undefined && o.gain !== 1 ? (() => { const g = AC.createGain(); g.gain.value = o.gain; g.connect(MG); return g; })() : MG;
  try { synthese(AC, sortie, genre, AC.currentTime + (o.apres || 0), variation(genre)); } catch (e) { log("son", e); }
}
function log(quoi, e) { try { console.debug(quoi, e); } catch (x) {} }
function appliquerVolume() { if (MG && AC) MG.gain.setTargetAtTime(volumeGain(), AC.currentTime, .02); }
// Mesure hors ligne (outils/ecouter.mjs) : rend le son dans un OfflineAudioContext et en donne le relief.
window.__sonsMesurables = () => ({ genres: Object.keys(NIVEAU), familles: FAMILLE_SON });
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
  else if (d.issue === "perd") son("perd", { apres: attente + .1 });
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
  // La fenêtre de dons ne survit pas au départ de l'accueil (dons.js : elle est RANGÉE, pas
  // refusée — elle reviendra). Sans ça elle reste par-dessus la table, plein écran et floutée.
  if (v !== "accueil" && window.fermerQuete) window.fermerQuete();
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
  // Le grand bouton des tables est un <details> : « Voir les tables » doit les FAIRE
  // APPARAÎTRE, pas défiler vers un bloc replié. Cette ligne couvre d'un coup TOUS les
  // chemins existants — aller("salon"), le rachat de jetons, « Changer de table », la fin
  // de la leçon, le fil d'Ariane, le lien profond #lesTables.
  if (e.tagName === "DETAILS") e.open = true;
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
  else if (vue === "dons") pas.push(["Bureau", "bureau"], ["Soutenir", null]);
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
  // La démonstration de la plaque compte SES six cartes avec le système sélectionné : ses
  // valeurs sont celles de Hi-Lo comme d'Omega II, jamais un « +1 » écrit en dur. C'est
  // donc ICI qu'elle se rejoue — rendreSysteme() est déjà appelée au démarrage ET à chaque
  // changement dans ⚙, ce qui fait exactement les deux occasions.
  // ⚠️ rendreMesures vit dans salon.js, TROIS morceaux plus bas. C'est une `function`, donc
  // hoistée dans toute l'IIFE — exactement comme rendreSalon(), appelée depuis aller() une
  // centaine de lignes plus haut. Un `const` ne l'aurait pas été.
  rendreMesures();
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
