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
     Les montants sont en JETONS : hand.bet porte la vraie mise depuis le lot Jetons.
     remelange porte aussi pendantDonne:true quand le sabot est renouvelé au milieu d'une donne.
   ══════════════════════════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);
const emettre = (nom, detail) => document.dispatchEvent(new CustomEvent("sabot:" + nom, { detail: detail || {} }));
const E = M.engine, SOL = M.solver, SH = M.shuffle, CT = M.counting, NET = M.net;
const RANKS = E.RANKS, SUITS = E.SUITS;
const sgn = n => (n > 0 ? "+" : "") + n;
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
if (DB.conseil === undefined) DB.conseil = false;
// Les cartes ont 13 rangs à l'écran, mais 10 en mathématiques : 10, V, D et R
// sont une seule et même colonne. Tout ce qui parle au solveur ou au comptage
// passe par rg(). Sans ça, un roi tombe hors du tableau et le compte devient NaN.
const rg = c => (c.i >= 9 ? 9 : c.i);
const valeurCompte = c => sys().v[rg(c)];
const tableCourante = () => DONNEES.catalogue.find(t => t.id === DB.table) || DONNEES.catalogue[0];
const donneesTable = () => DONNEES.tables[tableCourante().id];
const prenom = () => DB.prenom.trim();

/* ── Sons : discrets, synthétisés, jamais un fichier ─────────────────── */
let AC = null;
function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (AC && AC.state === "suspended") AC.resume(); return AC; }
function son(genre) {
  if (!DB.son) return; const a = ac(); if (!a) return; const t = a.currentTime;
  if (genre === "carte") {
    const n = a.createBuffer(1, a.sampleRate * .06, a.sampleRate), d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.6);
    const s = a.createBufferSource(); s.buffer = n;
    const f = a.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 2500; f.Q.value = .8;
    const g = a.createGain(); g.gain.value = .3; s.connect(f).connect(g).connect(a.destination); s.start(t); return;
  }
  if (genre === "jetons" || genre === "raclement") {
    // Jetons : deux claquements d'argile très brefs. Raclement : le souffle grave des
    // cartes qu'on rassemble au remélange. Du bruit filtré, jamais un fichier.
    const j = genre === "jetons", dur = j ? .05 : .32;
    for (const dt of (j ? [0, .055] : [0])) {
      const n = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate), d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, j ? 3.2 : 1.6);
      const s = a.createBufferSource(); s.buffer = n;
      const f = a.createBiquadFilter(); f.type = j ? "bandpass" : "lowpass"; f.frequency.value = j ? 3800 : 900; f.Q.value = j ? 1.4 : .5;
      const g = a.createGain(); g.gain.value = j ? .22 : .16;
      s.connect(f).connect(g).connect(a.destination); s.start(t + dt);
    }
    return;
  }
  const o = a.createOscillator(), g = a.createGain(); o.type = "sine";
  o.frequency.setValueAtTime(genre === "ok" ? 880 : genre === "ko" ? 220 : genre === "alerte" ? 440 : 560, t);
  g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(genre === "ko" ? .16 : .11, t + .01);
  g.gain.exponentialRampToValueAtTime(.0001, t + (genre === "ko" ? .24 : .12));
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + .3);
}
function bandeau(msg, ms) {
  const d = document.createElement("div"); d.className = "bandeau-bas"; d.textContent = msg;
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
  vue = v;
  // La table est un POSTE, pas un document : on empêche la page de défiler
  // sous elle, ce qui est aussi ce qui rend `100svh` stable quand la barre
  // d'URL d'un téléphone se rétracte.
  document.body.classList.toggle("a-table", v === "table");
  mesurerEntete();
  document.querySelectorAll(".vue").forEach(s => { s.hidden = s.id !== "v-" + v; });
  document.querySelectorAll("nav button").forEach(b => b.setAttribute("aria-current", b.dataset.vue === v ? "page" : "false"));
  if (v === "progres") rendreProgres();
  if (v === "accueil") rendreEventail();
  if (v === "salon") rendreSalon();
  if (v === "strategie") { if (!STR.main && !STR.ecart) nouveauCoup(); rendreGrille(); }
  if (v !== "concentration" && CO.encours) finConcentration(false);
  window.scrollTo({ top: 0 });
}
document.querySelectorAll("[data-vue]").forEach(b => b.addEventListener("click", () => aller(b.dataset.vue)));

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
  $("son").classList.toggle("eteint", !DB.son); }
$("son").onclick = () => { DB.son = !DB.son; garder(); rendreSon(); if (DB.son) son("ok"); };
$("prenom").value = DB.prenom;
$("prenom").oninput = () => { DB.prenom = $("prenom").value; garder(); };

$("sys").innerHTML = Object.entries(DONNEES.systemes).map(([k, s]) => `<option value="${k}">${s.nom}</option>`).join("");
$("sys").value = DB.sys;
$("sys").onchange = () => { DB.sys = $("sys").value; garder(); rendreSysteme(); rendreReponses(); if (vue === "table") nouveauSabot(); };
function rendreSysteme() {
  const s = sys();
  $("sysNom").textContent = s.nom; $("sysNote").textContent = s.note;
  const groupes = {};
  RANKS.forEach((r, i) => { const k = s.v[i >= 9 ? 9 : i]; (groupes[k] = groupes[k] || []).push(r); });
  $("sysTable").innerHTML = Object.keys(groupes).sort((a, b) => b - a)
    .map(k => `<span class="regle ${+k > 0 ? "bien" : +k < 0 ? "mal" : ""}"><b class="cadran">${sgn(+k)}</b>&nbsp; ${groupes[k].join(" ")}</span>`).join("")
    + (s.equilibre ? "" : `<span class="regle">déséquilibré · départ à ${sgn(CT.compteInitial(DB.sys, +($("eJeux").value || 6)))}</span>`);
  $("cCible").textContent = sgn(CT.compteInitial(DB.sys, +$("cJeux").value) + (s.equilibre ? 0 : 4 * +$("cJeux").value));
}
function rendreEventail() {
  const f = $("eventail"); f.innerHTML = "";
  const jeu = sabotNeuf(1); const pris = [];
  for (let k = 0; k < 5; k++) pris.push(jeu.splice(alea(jeu.length), 1)[0]);
  pris.forEach((c, k) => { const e = carteEl(c);
    e.style.transform = `translateX(-50%) rotate(${(k - 2) * 13}deg)`;
    e.style.animationDelay = (k * 65) + "ms"; f.appendChild(e); });
}
const MODES = [
  ["salon", "Le choix", "Le salon", "Neuf tables réelles, neuf règlements, neuf leçons. Deux d'entre elles sont imbattables : apprends à les reconnaître avant de t'asseoir."],
  ["exercices", "Le réflexe", "Exercices", "Défilement à la vitesse que tu veux, sabot chronométré, estimation du tas de défausse. Les trois muscles du comptage, travaillés séparément."],
  ["table", "Le jeu", "La table", "Un croupier, des joueurs, un vrai sabot avec sa carte brûlée et sa carte de coupe. Le compte est masqué : c'est à toi de le tenir."],
  ["strategie", "La décision", "Stratégie", "La stratégie de base main par main, puis les écarts au compte — tous calculés pour la table où tu es assis, pas recopiés d'un livre."],
  ["concentration", "Le sang-froid", "Concentration", "Le chef de table te surveille pendant que tu comptes. Questions, calculs, regards, et un détecteur qui guette tes lèvres."],
  ["ensemble", "À plusieurs", "Le même sabot", "Tes amis s'assoient à la même table, voient les mêmes cartes, et à la fin chacun annonce son compte."],
];
$("modes").innerHTML = MODES.map(([v, e, t, p]) =>
  `<button class="laque mode" data-vue="${v}"><span class="grave">${e}</span><h3>${t}</h3><p>${p}</p><span class="fleche">Ouvrir →</span></button>`).join("");
$("modes").querySelectorAll("[data-vue]").forEach(b => b.addEventListener("click", () => aller(b.dataset.vue)));
