/* ══════════════════════════════════════════════════════════════════════
   L'application. Tout ce qui est cher — stratégies de base, écarts au compte,
   avantage maison — a été calculé à la construction et vit dans DONNEES.
   Ici on ne fait que jouer, afficher, et mesurer.
   ══════════════════════════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);
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
  strat: { base: [0, 0], ecarts: [0, 0], assurance: [0, 0] }, fautes: [], solde: 0 };
try { Object.assign(DB, JSON.parse(localStorage.getItem("laque_v1") || "{}")); } catch (e) {}
DB.strat = Object.assign({ base: [0, 0], ecarts: [0, 0], assurance: [0, 0] }, DB.strat || {});
DB.fautes = DB.fautes || []; DB.sessions = DB.sessions || [];
const garder = () => { try { localStorage.setItem("laque_v1", JSON.stringify(DB)); } catch (e) {} };
const sys = () => DONNEES.systemes[DB.sys] || DONNEES.systemes.hilo;
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
function carteEl(c, dos) {
  const d = document.createElement("div");
  d.className = "carte" + (dos ? " carte--dos" : c.col === "r" ? " rouge" : "");
  if (!dos) d.innerHTML = `<div class="rang">${c.r}<i>${c.suit}</i></div><div class="pip">${c.suit}</div><div class="bas">${c.r}<i>${c.suit}</i></div>`;
  return d;
}
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
function aller(v) {
  vue = v;
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
  $("theme").textContent = DB.theme === "clair" ? "☀" : DB.theme === "sombre" ? "☾" : "◐";
  $("theme").title = DB.theme ? "Thème " + DB.theme : "Thème du système";
}
$("theme").onclick = () => { DB.theme = DB.theme === "" ? "sombre" : DB.theme === "sombre" ? "clair" : ""; garder(); appliquerTheme(); };
function rendreSon() { $("son").textContent = DB.son ? "♪" : "✕"; $("son").classList.toggle("eteint", !DB.son); }
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

/* ══════════════════════ LE SALON ══════════════════════ */
function chipsRegles(t) {
  const d = DONNEES.tables[t.id];
  const c = [];
  c.push([`${t.jeux} jeu${t.jeux > 1 ? "x" : ""}`, t.jeux <= 2 ? "bien" : ""]);
  c.push([t.h17 ? "H17" : "S17", t.h17 ? "" : "bien"]);
  c.push([t.blackjackPays === 1.5 ? "3:2" : "6:5", t.blackjackPays === 1.5 ? "bien" : "mal"]);
  if (t.melange === "melangeuse_continue") c.push(["mélangeuse continue", "mal"]);
  else c.push([`pén. ${Math.round(t.penetration * 100)} %`, t.penetration >= .75 ? "bien" : t.penetration <= .55 ? "mal" : ""]);
  if (t.das) c.push(["DAS", "bien"]); else c.push(["sans DAS", ""]);
  if (t.surrender !== "none") c.push(["abandon", "bien"]);
  if (!t.holeCard) c.push(["sans carte cachée", "mal"]);
  if (t.doubleOn !== "any") c.push(["doubler " + t.doubleOn.join("-"), ""]);
  return c.map(([l, k]) => `<span class="regle ${k}">${l}</span>`).join("");
}
// L'indice de comptabilité : ce que la table laisse VRAIMENT à un compteur.
// La pénétration domine, le paiement du blackjack peut tout annuler.
function indiceComptable(t) {
  if (t.melange === "melangeuse_continue") return 0;
  if (t.blackjackPays < 1.5) return Math.max(0, Math.round(12 - t.jeux));
  const pen = t.penetration, jeux = t.jeux;
  const brut = 100 * (pen - .45) * (1.55 - .06 * jeux);
  return Math.max(4, Math.min(99, Math.round(brut)));
}
// Deux choses seulement tuent le comptage : le blackjack payé 6:5 et la mélangeuse
// continue. Une pénétration médiocre rend la table faible — la jauge le dit déjà,
// et la tamponner « morte » serait un mensonge utile à personne.
function tableMorte(t) {
  if (t.blackjackPays < 1.5) return "Le blackjack payé 6 pour 5 — ne t'assieds pas ici";
  if (t.melange === "melangeuse_continue") return "Mélangeuse continue — le comptage est mort";
  return null;
}
function rendreSalon() {
  const filtre = $("filtreSalon").querySelector('[aria-selected="true"]').dataset.f;
  const liste = DONNEES.catalogue.filter(t => {
    const i = indiceComptable(t);
    return filtre === "tout" || (filtre === "battable" ? i >= 25 : i < 25);
  });
  $("salon").innerHTML = liste.map((t, n) => {
    const d = DONNEES.tables[t.id], ind = indiceComptable(t), tampon = tableMorte(t), brulee = !!tampon;
    return `<article class="laque tbl ${brulee ? "brulee" : ""}" ${brulee ? `data-tampon="${tampon}"` : ""}>
      <span class="num">Table ${n + 1} · ${echap(t.lieu)}</span>
      <h3>${echap(t.nom)}</h3>
      <div class="jauge" title="Indice de comptabilité"><i style="width:${ind}%"></i><b>${ind}</b></div>
      <div class="regles">${chipsRegles(t)}</div>
      <p class="lecon">« ${echap(t.lecon)} »</p>
      <div class="chiffres">
        <div><b>${fr2(d.avantage)} %</b><span class="grave">avantage maison</span></div>
        <div><b>${d.assurance === null ? "—" : sgn(d.assurance)}</b><span class="grave">assurance dès</span></div>
        <div><b>${d.ecarts.length}</b><span class="grave">écarts utiles</span></div>
      </div>
      <div class="pied">
        <button class="btn" data-asseoir="${t.id}">${brulee ? "M'asseoir" : "Prendre place"}</button>
        <button class="btn creux" data-pourquoi="${t.id}">Pourquoi</button>
      </div>
    </article>`;
  }).join("") || `<p class="muet">Aucune table dans ce filtre.</p>`;
  $("salon").querySelectorAll("[data-asseoir]").forEach(b => b.onclick = () => {
    DB.table = b.dataset.asseoir; garder(); nouveauSabot(); aller("table");
    bandeau("Tu t'assieds à « " + tableCourante().nom + " »");
  });
  $("salon").querySelectorAll("[data-pourquoi]").forEach(b => b.onclick = () => {
    const t = DONNEES.catalogue.find(x => x.id === b.dataset.pourquoi), d = DONNEES.tables[t.id];
    ouvrirModale(`<span class="grave">${echap(t.lieu)}</span><h2 style="margin:4px 0 8px">${echap(t.nom)}</h2>
      <p class="lecon" style="font-family:'Instrument Serif',serif;font-size:var(--t-titre);color:var(--laiton)">« ${echap(t.lecon)} »</p>
      <p style="text-align:left">${echap(t.detail)}</p>
      <div class="regles" style="justify-content:center">${chipsRegles(t)}</div>
      <p class="muet" style="font-size:var(--t-petit);margin-top:12px">Avantage maison mesuré sur trois millions de mains jouées en stratégie parfaite : <b class="cadran">${fr2(d.avantage)} %</b>.</p>`);
  });
}
$("filtreSalon").querySelectorAll("button").forEach(b => b.onclick = () => {
  $("filtreSalon").querySelectorAll("button").forEach(x => x.setAttribute("aria-selected", x === b ? "true" : "false"));
  rendreSalon();
});
function ouvrirModale(html) {
  $("modaleBoite").innerHTML = html + `<div class="rang-btn" style="margin-top:16px"><button class="btn creux" id="modaleFermer">Fermer</button></div>`;
  $("modale").hidden = false;
  $("modaleFermer").onclick = () => { $("modale").hidden = true; };
  $("modaleFermer").focus();
}
$("modale").addEventListener("click", e => { if (e.target === $("modale")) $("modale").hidden = true; });

/* ══════════════════════ LA TABLE ══════════════════════ */
const T = { sabot: [], graine: null, empreinte: "", coupe: 0, rc: 0, vues: 0, mains: 0, defausse: 0,
  croupier: [], sieges: [], occupe: false, enJeu: false, toi: null, actif: null, revele: false, solde: 0 };
const NOMS = ["Marc", "Sonia", "Karim", "Léa", "Paul", "Nadia"];
const vitesse = () => +$("tVitesse").value;
const reglesTable = () => {
  const t = tableCourante();
  return E.makeRules({ decks: t.jeux, h17: t.h17, blackjackPays: t.blackjackPays, das: t.das,
    surrender: t.surrender, doubleOn: t.doubleOn, maxHands: t.maxHands, hitSplitAces: t.hitSplitAces,
    holeCard: t.holeCard, peek: t.peek, enhcLosesAll: !!t.enhcLosesAll, penetration: t.penetration || .75 });
};
const ISSUE = { "gagné": "g", "perdu": "p", "égalité": "n", "sauté": "p", "blackjack": "bj", "abandon": "n" };
const MOT = { H: "Tirer", S: "Rester", D: "Doubler", P: "Séparer", U: "Abandonner" };

// Remélanger sans quitter la table : nouvelles cartes, compte à zéro, historique intact.
async function remelanger() {
  const t = tableCourante();
  const s = await sabotProuvable(t.jeux);
  T.sabot = s.cartes; T.graine = s.graine; T.empreinte = s.empreinte; T.revele = false;
  T.rc = CT.compteInitial(DB.sys, t.jeux); T.vues = 0;
  T.sabot.pop(); T.defausse = 0;
  rafraichirBarre(); rendreRecu();
}
// `pendantDonne` : le sabot est renouvelé au milieu d'une donne (carte de coupe).
// Dans ce cas le verrou appartient à l'appelant — le relâcher ici laisserait une
// seconde donne démarrer par-dessus la première, et les deux videraient le sabot.
async function nouveauSabot(o) {
  o = o || {};
  const t = tableCourante();
  const s = await sabotProuvable(t.jeux);
  T.sabot = s.cartes; T.graine = s.graine; T.empreinte = s.empreinte; T.revele = false;
  T.coupe = t.melange === "melangeuse_continue" ? Math.floor(T.sabot.length * .02) : Math.floor(T.sabot.length * (t.penetration || .75));
  T.rc = CT.compteInitial(DB.sys, t.jeux); T.vues = 0; T.defausse = 0;
  if (!o.pendantDonne) {
    T.mains = 0; T.croupier = []; T.enJeu = false; T.occupe = false; T.actif = null;
    construireSieges();
    $("dMain").innerHTML = ""; $("dScore").textContent = "·";
  }
  T.sabot.pop(); T.defausse = 1;              // la carte brûlée : ni montrée, ni comptée
  $("tNom").textContent = t.nom + " · " + t.lieu;
  $("tRegles").innerHTML = chipsRegles(t);
  $("devise").textContent = t.blackjackPays === 1.5 ? "LE BLACKJACK PAIE 3 POUR 2" : "LE BLACKJACK PAIE 6 POUR 5";
  $("tCoupe").style.left = Math.round((t.melange === "melangeuse_continue" ? 2 : (t.penetration || .75) * 100)) + "%";
  $("conseil").textContent = "";
  rafraichirBarre(); rendreRecu();
  if (!o.pendantDonne) { $("annonce").textContent = "Sabot neuf, mélangé, carte brûlée."; boutons({ donne: true }); }
  $("plateau").style.setProperty("--intervalle", vitesse() + "ms");
}
function construireSieges() {
  const t = tableCourante(), n = Math.max(1, Math.min(t.sieges, 6));
  const moi = Math.floor((n - 1) / 2);
  T.sieges = [];
  for (let k = 0; k < n; k++) {
    const toi = k === moi;
    T.sieges.push({ nom: toi ? (prenom() || "Toi") : NOMS[k > moi ? k - 1 : k], toi, mains: [] });
    if (toi) T.toi = T.sieges[k];
  }
  rendreSieges();
}
function rendreSieges() {
  const el = $("sieges"); el.innerHTML = "";
  T.sieges.forEach((st, si) => {
    const d = document.createElement("div");
    d.className = "siege" + (st.toi ? " toi" : "") + (T.actif && T.actif.siege === si ? " actif" : "");
    const hs = document.createElement("div"); hs.className = "mains";
    st.mains.forEach((h, hi) => {
      const w = document.createElement("div");
      w.className = "m" + (T.actif && T.actif.siege === si && T.actif.main === hi ? " encours" : "");
      const md = document.createElement("div"); md.className = "main"; md.id = `m_${si}_${hi}`;
      h.cards.forEach(c => md.appendChild(carteEl(c)));
      const sc = document.createElement("div"); sc.className = "score";
      sc.textContent = h.cards.length ? E.handTotal(h.cards) + (h.doubled ? " ×2" : "") : "";
      const rs = document.createElement("div"); rs.className = "issue " + (ISSUE[h.result] || "");
      rs.textContent = h.result || "";
      w.append(md, sc, rs); hs.appendChild(w);
    });
    const nm = document.createElement("div"); nm.className = "nom serre"; nm.textContent = st.nom;
    d.append(hs, nm); el.appendChild(d);
  });
}
function rafraichirBarre() {
  const t = tableCourante();
  $("sabot").textContent = T.sabot.length; $("tMains").textContent = T.mains; $("tVues").textContent = T.vues;
  $("defausseN").textContent = T.defausse; $("defausse").classList.toggle("pleine", T.defausse > 0);
  const jeuxRestants = T.sabot.length / 52;
  const visible = $("tCompteVisible").checked;
  $("tRC").textContent = visible ? sgn(T.rc) : "—";
  $("tJeux").textContent = visible ? fr1(jeuxRestants) : "—";
  const tc = sys().equilibre ? CT.compteVrai(T.rc, jeuxRestants) : null;
  $("tTC").textContent = visible ? (tc === null ? "n/a" : fr1(tc)) : "—";
  $("tMise").textContent = visible && tc !== null ? CT.misesUnites(tc, 12) : "—";
  $("tSolde").textContent = (T.solde >= 0 ? "+" : "") + fr1(T.solde);
  const idx = $("tIndex");
  if (visible) {
    idx.textContent = sgn(T.rc);
    idx.className = "index cadran " + (T.rc > 0 ? "plus" : T.rc < 0 ? "moins" : "");
    idx.style.left = Math.max(4, Math.min(96, 50 + T.rc * 2.2)) + "%";
  } else { idx.textContent = "?"; idx.className = "index cadran"; idx.style.left = "50%"; }
  $("tAide").textContent = visible
    ? "Le compte est affiché : sers-t'en pour vérifier, pas pour t'en passer."
    : "Le compte est masqué tant que tu ne l'as pas demandé : c'est à toi de le tenir.";
}
$("tCompteVisible").onchange = rafraichirBarre;
$("tVitesse").oninput = () => $("plateau").style.setProperty("--intervalle", vitesse() + "ms");
function boutons(o) {
  [["donne", "bDonne"], ["tire", "bTire"], ["reste", "bReste"], ["double", "bDouble"], ["separe", "bSepare"], ["abandon", "bAbandon"]]
    .forEach(([k, id]) => { $(id).disabled = !o[k]; });
}
function animerDepuisSabot(e, hote) {
  const s = $("sabot").getBoundingClientRect(), c = hote.getBoundingClientRect();
  e.style.setProperty("--dx", (s.left + s.width / 2 - (c.left + c.width / 2)) + "px");
  e.style.setProperty("--dy", (s.top - c.top) + "px");
  e.classList.add("carte--entre");
}
async function tirer(main, hote, cachee) {
  // Filet de sécurité : plutôt remélanger que distribuer une carte inexistante.
  if (!T.sabot.length) { const t = tableCourante(); const s = await sabotProuvable(t.jeux);
    T.sabot = s.cartes; T.graine = s.graine; T.empreinte = s.empreinte; T.revele = false;
    T.rc = CT.compteInitial(DB.sys, t.jeux); T.vues = 0; T.sabot.pop(); rendreRecu();
  }
  const c = T.sabot.pop(); c.cachee = !!cachee; main.push(c);
  const e = carteEl(c, cachee); hote.appendChild(e); animerDepuisSabot(e, hote); son("carte");
  if (!cachee) { T.rc += valeurCompte(c); T.vues++; }
  rafraichirBarre(); await dodo(vitesse()); return c;
}
async function tirerSiege(si, hi) {
  const st = T.sieges[si], h = st && st.mains[hi], hote = $(`m_${si}_${hi}`);
  if (!h || !hote) return;
  await tirer(h.cards, hote);
  const w = $(`m_${si}_${hi}`);
  if (w && w.parentNode) w.parentNode.querySelector(".score").textContent = E.handTotal(h.cards) + (h.doubled ? " ×2" : "");
}
async function revelerCachee() {
  const c = T.croupier.find(x => x.cachee); if (!c) return;
  c.cachee = false; T.rc += valeurCompte(c); T.vues++;
  const vieux = $("dMain").children[1];
  const e = carteEl(c); e.classList.add("carte--revele");
  $("dMain").replaceChild(e, vieux); son("carte");
  rafraichirBarre(); $("dScore").textContent = E.handTotal(T.croupier);
  await dodo(240);
}
const peutSeparer = (h, st) => E.canSplit(h, st.mains, reglesTable());
const peutDoubler = (h, st) => E.canDouble(h, st.mains, reglesTable());
const peutAbandonner = (h, st) => E.canSurrender(h, st.mains, reglesTable()) && !h.fromSplit;

function actionBase(cards, up, st, h) {
  const r = reglesTable(), d = donneesTable();
  const total = E.handTotal(cards), soft = E.isSoft(cards);
  const paire = cards.length === 2 && E.cardValue(cards[0]) === E.cardValue(cards[1]) ? rg(cards[0]) : null;
  return SOL.actionFor(d.chart, { total, soft, pairIdx: paire, upIdx: rg(up),
    canD: peutDoubler(h, st), canP: paire !== null && peutSeparer(h, st), canU: peutAbandonner(h, st) });
}
// L'écart au compte : on ne l'applique que si le joueur a demandé l'aide.
function actionAvecEcart(cards, up, st, h, tc) {
  const d = donneesTable(), base = actionBase(cards, up, st, h);
  if (tc === null) return { a: base, ecart: null };
  const total = E.handTotal(cards), soft = E.isSoft(cards);
  const paire = cards.length === 2 && E.cardValue(cards[0]) === E.cardValue(cards[1]) ? rg(cards[0]) : null;
  const fam = paire !== null ? "pair" : soft && total >= 13 && total <= 20 ? "soft" : "hard";
  const cle = paire !== null ? paire : total;
  let trouve = null;
  const ru = rg(up);
  for (const [f, k, u, idx, vers] of d.ecarts) if (f === fam && k === cle && u === ru && tc >= idx) trouve = { a: vers, idx };
  for (const [f, k, u, idx] of d.abandons) if (f === fam && k === cle && u === ru && tc >= idx && peutAbandonner(h, st)) trouve = { a: "U", idx };
  if (!trouve) return { a: base, ecart: null };
  return { a: trouve.a, ecart: trouve.idx };
}

async function distribuer() {
  if (T.occupe || T.enJeu) return;
  T.occupe = true; boutons({}); ac();
  const t = tableCourante();
  // Une mélangeuse continue remet les cartes jouées dans le sabot après chaque main :
  // le compte ne s'accumule jamais. C'est la seule façon honnête de la simuler.
  const csm = t.melange === "melangeuse_continue";
  if (csm) {
    // La mélangeuse ne clôt pas une partie : elle reprend les cartes et on continue.
    // Le nombre de mains et le solde ne bougent pas, seul le compte est remis à plat.
    if (T.mains > 0) { $("annonce").textContent = "La mélangeuse reprend les cartes."; await remelanger(); await dodo(400); }
  } else if (T.sabot.length <= T.coupe) {
    $("annonce").textContent = "Carte de coupe atteinte : on remélange.";
    if (T.vues > 20) demanderMonCompte(true);
    await dodo(900); await nouveauSabot({ pendantDonne: true });
    $("annonce").textContent = "Sabot neuf, mélangé, carte brûlée.";
  }
  for (const st of T.sieges) for (const h of st.mains) T.defausse += h.cards.length;
  T.defausse += T.croupier.length; T.croupier = []; T.actif = null;
  for (const st of T.sieges) st.mains = [E.newHand([], 1)];
  rendreSieges(); $("dMain").innerHTML = ""; $("dScore").textContent = "·";
  $("annonce").textContent = ""; $("conseil").textContent = ""; rafraichirBarre();
  T.enJeu = true;
  const r = reglesTable();
  for (let tour = 0; tour < 2; tour++) {
    for (let si = 0; si < T.sieges.length; si++) await tirerSiege(si, 0);
    // Sans carte cachée, le croupier ne prend qu'une carte : c'est toute la règle.
    if (tour === 0) { await tirer(T.croupier, $("dMain")); $("dScore").textContent = E.cardValue(T.croupier[0]); }
    else if (r.holeCard) await tirer(T.croupier, $("dMain"), true);
  }
  if (r.holeCard && E.cardValue(T.croupier[0]) === 11) await demanderAssurance();
  if (r.holeCard && r.peek && E.cardValue(T.croupier[0]) >= 10) {
    $("annonce").textContent = "Le croupier vérifie sa carte…"; await dodo(vitesse() * 1.4);
    if (E.handTotal(T.croupier) === 21) { await revelerCachee(); $("annonce").textContent = "Blackjack du croupier."; T.occupe = false; return regler(); }
    $("annonce").textContent = "";
  }
  T.occupe = false; await jouerSieges(0);
}
function demanderAssurance() {
  return new Promise(res => {
    $("annonce").textContent = "Assurance ?";
    const b = document.createElement("div"); b.className = "bulle";
    b.innerHTML = `<div class="de">Croupier</div><div class="q">Le croupier montre un as. Assurance ?</div>
      <div class="opts"><button data-o="1">Oui</button><button data-o="0">Non</button></div>`;
    b.querySelectorAll("button").forEach(bt => bt.onclick = () => {
      const prise = bt.dataset.o === "1"; $("boiteAssurance").innerHTML = ""; $("annonce").textContent = "";
      if (sys().equilibre) {
        const seuil = donneesTable().assurance;
        const tc = CT.compteVrai(T.rc, T.sabot.length / 52);
        const devrait = seuil !== null && tc >= seuil, bon = prise === devrait;
        DB.strat.assurance[bon ? 0 : 1]++; garder(); son(bon ? "ok" : "ko");
        bandeau(`${bon ? "✓" : "✗"} compte vrai ${fr1(tc)} · ${devrait ? "l'assurance est rentable dès " + sgn(seuil) : "pas d'assurance sous " + sgn(seuil)}`, 3400);
      }
      res(prise);
    });
    $("boiteAssurance").appendChild(b); son("alerte");
  });
}
async function jouerSieges(depuis) {
  const r = reglesTable();
  for (let si = depuis; si < T.sieges.length; si++) {
    const st = T.sieges[si];
    for (let hi = 0; hi < st.mains.length; hi++) {
      const h = st.mains[hi];
      if (h.surrendered) continue;
      if (E.isBlackjack(h) && st.mains.length === 1) { h.result = "blackjack"; rendreSieges(); continue; }
      T.actif = { siege: si, main: hi }; rendreSieges();
      if (st.toi) { T.occupe = false; return tonTour(); }
      await jouerAuto(si, hi);
    }
  }
  T.actif = null; rendreSieges(); await jouerCroupier();
}
async function jouerAuto(si, hi) {
  const st = T.sieges[si], r = reglesTable();
  let h = st.mains[hi];
  for (;;) {
    if (h.fromSplitAces && !r.hitSplitAces && h.cards.length === 2) break;
    const a = actionBase(h.cards, T.croupier[0], st, h);
    await dodo(vitesse() * 1.1);
    if (a === "U") { h.surrendered = true; h.result = "abandon"; rendreSieges(); return; }
    if (a === "S") break;
    if (a === "P") { await separer(si, hi); h = st.mains[hi]; continue; }
    if (a === "D") { h.doubled = true; await tirerSiege(si, hi); break; }
    await tirerSiege(si, hi);
    if (E.handTotal(h.cards) >= 21) break;
  }
  if (E.isBust(h.cards)) { h.result = "sauté"; rendreSieges(); }
}
async function separer(si, hi) {
  const st = T.sieges[si], h = st.mains[hi];
  const c2 = h.cards.pop(), as = E.isAce(h.cards[0]);
  const nh = E.newHand([c2], h.bet, { fromSplit: true, fromSplitAces: as });
  h.fromSplit = true; h.fromSplitAces = as;
  st.mains.splice(hi + 1, 0, nh); rendreSieges();
  await tirerSiege(si, hi); await tirerSiege(si, hi + 1);
}
function tonTour() {
  const st = T.toi, h = st.mains[T.actif.main], r = reglesTable();
  if (h.surrendered) return mainSuivante();
  if (h.fromSplitAces && !r.hitSplitAces && h.cards.length === 2) return mainSuivante();
  const total = E.handTotal(h.cards);
  if (total >= 21) { if (total > 21) { h.result = "sauté"; rendreSieges(); } return mainSuivante(); }
  boutons({ tire: true, reste: true, double: peutDoubler(h, st), separe: peutSeparer(h, st), abandon: peutAbandonner(h, st) });
  if ($("tConseil").checked) {
    const tc = sys().equilibre ? CT.compteVrai(T.rc, T.sabot.length / 52) : null;
    const { a, ecart } = actionAvecEcart(h.cards, T.croupier[0], st, h, tc);
    $("conseil").innerHTML = `Stratégie : <b>${MOT[a]}</b>` + (ecart !== null ? ` <span class="muet">— écart au compte, à partir de ${sgn(ecart)}</span>` : "");
  } else $("conseil").textContent = "";
}
async function mainSuivante() {
  const si = T.sieges.indexOf(T.toi); boutons({}); $("conseil").textContent = "";
  if (T.actif.main + 1 < T.toi.mains.length) { T.actif = { siege: si, main: T.actif.main + 1 }; rendreSieges(); return tonTour(); }
  T.occupe = true; await jouerSieges(si + 1);
}
const monAction = f => async () => { if (T.occupe || !T.actif) return; await f(); };
$("bTire").onclick = monAction(async () => { T.occupe = true; boutons({}); await tirerSiege(T.sieges.indexOf(T.toi), T.actif.main); T.occupe = false; tonTour(); });
$("bReste").onclick = monAction(async () => { await mainSuivante(); });
$("bDouble").onclick = monAction(async () => {
  const h = T.toi.mains[T.actif.main]; if (!peutDoubler(h, T.toi)) return;
  T.occupe = true; boutons({}); h.doubled = true; await tirerSiege(T.sieges.indexOf(T.toi), T.actif.main);
  if (E.isBust(h.cards)) { h.result = "sauté"; rendreSieges(); } T.occupe = false; await mainSuivante();
});
$("bSepare").onclick = monAction(async () => {
  const h = T.toi.mains[T.actif.main]; if (!peutSeparer(h, T.toi)) return;
  T.occupe = true; boutons({}); await separer(T.sieges.indexOf(T.toi), T.actif.main); T.occupe = false; tonTour();
});
$("bAbandon").onclick = monAction(async () => {
  const h = T.toi.mains[T.actif.main]; if (!peutAbandonner(h, T.toi)) return;
  h.surrendered = true; h.result = "abandon"; rendreSieges(); son("alerte"); await mainSuivante();
});
async function jouerCroupier() {
  T.occupe = true; const r = reglesTable();
  const vivants = T.sieges.some(st => st.mains.some(h => !h.surrendered && !E.isBust(h.cards) && !(E.isBlackjack(h) && st.mains.length === 1)));
  if (r.holeCard) await revelerCachee();
  else if (vivants || true) { await tirer(T.croupier, $("dMain")); $("dScore").textContent = E.handTotal(T.croupier); }
  await dodo(vitesse() * .5);
  if (vivants) {
    for (;;) {
      const t = E.handTotal(T.croupier), soft = E.isSoft(T.croupier);
      if (t > 21 || t > 17 || (t === 17 && !(r.h17 && soft))) break;
      await tirer(T.croupier, $("dMain")); $("dScore").textContent = E.handTotal(T.croupier);
    }
  }
  await regler();
}
async function regler() {
  const r = reglesTable(), dt = E.handTotal(T.croupier);
  let miennes = [], net = 0;
  for (const st of T.sieges) for (const h of st.mains) {
    const res = r.holeCard ? E.settleHand(h, T.croupier, r) : E.settleNoHoleCard(h, T.croupier, r);
    h.result = res.result;
    if (st.toi) { miennes.push(res.result); net += res.net; }
  }
  T.solde += net; DB.solde = T.solde;
  T.actif = null; rendreSieges(); T.mains++; T.enJeu = false; T.occupe = false; rafraichirBarre(); garder();
  $("annonce").textContent = `Croupier ${dt > 21 ? "saute à " + dt : dt}. Toi : ${miennes.join(" · ")}.`;
  boutons({ donne: true });
}
$("bDonne").onclick = distribuer;
$("bNouveauSabot").onclick = () => nouveauSabot();
$("tConseil").onchange = () => { if (T.actif && !T.occupe && T.toi === T.sieges[T.actif.siege]) tonTour(); };
$("bMonCompte").onclick = () => demanderMonCompte(false);
// Le compte est figé à l'ouverture : le sabot peut être remélangé pendant
// que la question est à l'écran, la réponse doit rester celle qu'on a posée.
function demanderMonCompte(finSabot) {
  const rc = T.rc, vues = T.vues, restantes = T.sabot.length;
  const jeuxRestants = restantes / 52, tc = CT.compteVrai(rc, jeuxRestants);
  // À la fin du sabot on lève le sceau : la graine prouve que l'ordre des cartes
  // était fixé avant la première donne. C'est le seul instant où la montrer sert.
  const sceau = finSabot ? `<div class="recu" style="margin-top:14px;text-align:left">
      <div class="sceau revele"><span class="rond"></span>Sceau levé — ce sabot était fixé d'avance</div>
      <dt>Empreinte publiée avant la donne</dt><dd>${T.empreinte}</dd>
      <dt>Graine</dt><dd>${SH.hex(T.graine)}</dd></div>` : "";
  ouvrirModale(`<h2>${finSabot ? "Carte de coupe — ton compte ?" : "Ton compte"}</h2>
    ${finSabot ? '<p class="muet">Le sabot est fini. Dis ton compte avant que tout reparte à zéro.</p>' : ""}
    <div class="demande" style="flex-direction:column;align-items:center">
      <label class="ch" style="align-items:center"><span class="grave">Compte courant</span><input type="number" id="mcRC" placeholder="0"></label>
      <label class="ch" style="align-items:center"><span class="grave">Jeux restants, au jugé</span><input type="number" id="mcJeux" step="0.5" placeholder="4,5"></label>
      <button class="btn" id="mcOk">Vérifier</button>
    </div><p id="mcRes" class="muet" style="margin-top:12px"></p>` + sceau);
  const verifier = () => {
    const g = $("mcRC").value.trim(); if (g === "") return;
    const dit = parseInt(g, 10), bon = dit === rc; son(bon ? "ok" : "ko");
    const dj = parseFloat(($("mcJeux").value || "").replace(",", "."));
    let txt = bon ? "Exact. " : `Tu as dit ${sgn(dit)}, c'était ${sgn(rc)}. `;
    txt += `${vues} cartes vues, ${restantes} restantes, soit ${fr1(jeuxRestants)} jeux.`;
    if (!isNaN(dj)) txt += ` Tu as estimé ${fr1(dj)}${Math.abs(dj - jeuxRestants) <= .5 ? " ✓" : " ✗"}.`;
    if (sys().equilibre) txt += ` Compte vrai ${fr1(tc)} · mise théorique ${CT.misesUnites(tc, 12)} unité${CT.misesUnites(tc, 12) > 1 ? "s" : ""}.`;
    $("mcRes").textContent = txt;
    DB.sessions.push({ t: Date.now(), genre: "table", sys: sys().nom, n: vues, exact: bon, ecart: Math.abs(dit - rc) });
    while (DB.sessions.length > 240) DB.sessions.shift(); garder();
    if (vue === "progres") rendreProgres();
  };
  $("mcOk").onclick = verifier;
  $("mcRC").addEventListener("keydown", e => { if (e.key === "Enter") verifier(); });
  setTimeout(() => $("mcRC").focus(), 40);
}
/* ── Le reçu : l'empreinte avant, la graine après ─────────────────── */
function rendreRecu() {
  const t = tableCourante();
  const scelle = !T.revele;
  $("recu").innerHTML = `
    <div class="sceau ${scelle ? "" : "revele"}"><span class="rond"></span>${scelle ? "Scellé — l'ordre des cartes est fixé et personne ne le connaît" : "Révélé — n'importe qui peut refaire ce mélange"}</div>
    <dt>Table</dt><dd>${echap(t.nom)} · ${t.jeux} jeux · ${T.sabot.length} cartes restantes</dd>
    <dt>Empreinte de la graine, publiée avant la donne</dt><dd>${T.empreinte || "—"}</dd>
    <dt>Graine</dt><dd>${T.revele ? SH.hex(T.graine) : "révélée à la fin du sabot"}</dd>`;
}
$("bVerifier").onclick = async () => {
  if (!T.revele) { T.revele = true; rendreRecu(); }
  const recalc = await SH.shuffle(sabotNeuf(tableCourante().jeux), T.graine);
  const emp = await SH.commit(T.graine);
  const memeEmpreinte = emp === T.empreinte;
  $("verifResultat").innerHTML = memeEmpreinte
    ? `✓ L'empreinte publiée correspond bien à cette graine, et le mélange se rejoue à l'identique. Première carte du sabot : <b>${recalc[recalc.length - 1].r}${recalc[recalc.length - 1].suit}</b>.`
    : `✗ L'empreinte ne correspond pas. Quelque chose ne va pas.`;
  son(memeEmpreinte ? "ok" : "ko");
};
$("bCopierVerif").onclick = () => {
  const code = `// Colle ceci dans la console d'un navigateur pour refaire le mélange toi-même.
const graine = "${T.revele ? SH.hex(T.graine) : "…révèle d'abord la graine…"}";
const unhex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
(async () => {
  const s = unhex(graine);
  console.log("empreinte :", hex(await crypto.subtle.digest("SHA-256", s)));
  const k = await crypto.subtle.importKey("raw", s, {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  let ctr = 0, buf = new Uint8Array(0), pos = 0;
  const next4 = async () => { if (pos + 4 > buf.length) { const c = new Uint8Array(8);
      new DataView(c.buffer).setBigUint64(0, BigInt(ctr++));
      buf = new Uint8Array(await crypto.subtle.sign("HMAC", k, c)); pos = 0; }
    const v = new DataView(buf.buffer, buf.byteOffset + pos, 4).getUint32(0); pos += 4; return v; };
  const below = async n => { const max = Math.floor(0x100000000 / n) * n; let v;
    do { v = await next4(); } while (v >= max); return v % n; };
  const R = ["A","2","3","4","5","6","7","8","9","10","V","D","R"], S = ["♠","♥","♦","♣"];
  const a = []; for (let d = 0; d < ${tableCourante().jeux}; d++) for (const su of S) for (const r of R) a.push(r + su);
  for (let i = a.length - 1; i > 0; i--) { const j = await below(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  console.log("ordre de distribution :", a.slice().reverse().join(" "));
})();`;
  navigator.clipboard && navigator.clipboard.writeText(code).then(
    () => bandeau("Vérificateur copié : colle-le dans la console d'un navigateur."),
    () => ouvrirModale(`<h2>Vérificateur</h2><div class="recu" style="text-align:left;white-space:pre-wrap;max-height:50vh;overflow:auto">${echap(code)}</div>`));
};

/* ══════════════════════ EXERCICES ══════════════════════ */
const X = { genre: "defilement", sabot: [], cartes: [], i: -1, minuteur: null, rc: 0, rep: [], encours: false,
  jeux: 6, t0: 0, delais: [], controles: [], prochainControle: 0, pause: false, depart: 0, chrono: null, silence: false, par: 1 };
function ongletEx(g) {
  X.genre = g;
  $("ongletsEx").querySelectorAll("button").forEach(b => b.setAttribute("aria-selected", b.dataset.ex === g ? "true" : "false"));
  $("opDefilement").hidden = g !== "defilement"; $("opChrono").hidden = g !== "chrono"; $("opEstimation").hidden = g !== "estimation";
  ["exPiste", "exBilan", "estPiste", "estBilan"].forEach(id => { $(id).hidden = true; });
  $("exReglages").hidden = false;
}
$("ongletsEx").querySelectorAll("button").forEach(b => b.onclick = () => ongletEx(b.dataset.ex));
$("eVitesse").oninput = () => { $("eVitesseL").textContent = fr1(+$("eVitesse").value / 1000) + " s";
  $("exPiste").style.setProperty("--intervalle", $("eVitesse").value + "ms"); };
$("eJeux").onchange = rendreSysteme; $("cJeux").onchange = rendreSysteme;
function rendreReponses() {
  const v = sys().v, vals = [...new Set(v)].sort((a, b) => a - b);
  $("reponses").innerHTML = vals.map(x =>
    `<button data-v="${x}" class="${x > 0 ? "plus" : x < 0 ? "moins" : ""}">${sgn(x)}<i>${RANKS.filter((r, i) => v[i >= 9 ? 9 : i] === x).join(" ")}</i></button>`).join("");
  $("reponses").querySelectorAll("button").forEach(b => b.onclick = () => repondre(+b.dataset.v));
}
const prochainControle = de => {
  if (X.genre !== "defilement") return Infinity;
  const m = $("eControle").value;
  if (m === "0") return Infinity;
  if (m === "alea") return de + 8 + alea(16);
  return de + +m;
};
$("eDemarrer").onclick = demarrerExercice;
$("eStop").onclick = () => finExercice();
$("rRejouer").onclick = demarrerExercice;
$("rReglages").onclick = () => { $("exBilan").hidden = true; $("exReglages").hidden = false; };
async function demarrerExercice() {
  ac();
  if (X.genre === "estimation") return demarrerEstimation();
  if (X.genre === "defilement") {
    X.jeux = +$("eJeux").value;
    const s = await sabotProuvable(X.jeux);
    X.sabot = s.cartes;
    const n = $("eNb").value === "tout" ? X.sabot.length : Math.min(+$("eNb").value, X.sabot.length);
    X.cartes = X.sabot.slice(0, n); X.silence = $("eMode").value === "silence"; X.par = X.silence ? +$("eParVue").value : 1;
  } else {
    X.jeux = +$("cJeux").value;
    const s = await sabotProuvable(X.jeux);
    X.sabot = s.cartes; X.cartes = X.sabot.slice(); X.silence = true; X.par = +$("cParVue").value;
  }
  X.i = -1; X.rc = CT.compteInitial(DB.sys, X.jeux); X.rep = new Array(X.cartes.length).fill(null);
  X.encours = true; X.delais = []; X.controles = []; X.pause = false; X.prochainControle = prochainControle(0); X.depart = 0;
  $("reponses").hidden = X.silence; $("trace").hidden = X.silence;
  $("chronoL").hidden = X.genre !== "chrono"; $("chronoL").textContent = "0,0 s";
  $("trace").innerHTML = X.cartes.map(() => "<i></i>").join("");
  $("exReglages").hidden = true; $("exBilan").hidden = true; $("exPiste").hidden = false;
  $("exVerdict").hidden = true; $("exDemande").hidden = false;
  ["rCompte", "rJeux", "rTC"].forEach(id => { $(id).value = ""; });
  clearInterval(X.chrono);
  if (X.genre === "chrono") X.chrono = setInterval(() => { if (X.depart) $("chronoL").textContent = fr1((performance.now() - X.depart) / 1000) + " s"; }, 100);
  $("exPiste").style.setProperty("--intervalle", (X.genre === "chrono" ? 600 : +$("eVitesse").value) + "ms");
  suivante();
}
function suivante() {
  clearTimeout(X.minuteur);
  if (X.i >= 0 && X.i + 1 >= X.prochainControle && X.i + 1 < X.cartes.length) return controle();
  X.i++;
  if (X.i >= X.cartes.length) return finExercice();
  if (!X.depart) X.depart = performance.now();
  const grp = X.cartes.slice(X.i, X.i + X.par); X.i += grp.length - 1;
  for (const c of grp) X.rc += valeurCompte(c);
  $("scene").innerHTML = "";
  const w = document.createElement("div"); w.className = "groupe";
  grp.forEach((c, k) => { const e = carteEl(c); e.style.rotate = (alea(7) - 3) + "deg"; e.style.animationDelay = (k * 55) + "ms"; e.classList.add("carte--entre"); w.appendChild(e); });
  $("scene").appendChild(w); son("carte");
  $("exPos").textContent = `${X.i + 1} / ${X.cartes.length}`;
  $("exReste").textContent = `${X.sabot.length - X.i - 1} cartes restantes`;
  X.t0 = performance.now();
  if (X.genre === "defilement") {
    const ms = +$("eVitesse").value;
    $("exBarre").style.transition = "none"; $("exBarre").style.width = "0";
    requestAnimationFrame(() => requestAnimationFrame(() => { $("exBarre").style.transition = `width ${ms}ms linear`; $("exBarre").style.width = "100%"; }));
    X.minuteur = setTimeout(suivante, ms);
  } else { $("exBarre").style.transition = "width .2s"; $("exBarre").style.width = (100 * (X.i + 1) / X.cartes.length) + "%"; }
}
function repondre(v) {
  if (!X.encours || X.pause || X.silence || X.i < 0 || X.rep[X.i] !== null) return;
  X.rep[X.i] = v;
  const vrai = valeurCompte(X.cartes[X.i]), bon = v === vrai;
  X.delais.push(performance.now() - X.t0);
  $("trace").children[X.i].className = bon ? "ok" : "ko";
  son(bon ? "ok" : "ko");
  $("scene").classList.remove("juste", "faux"); void $("scene").offsetWidth;
  $("scene").classList.add(bon ? "juste" : "faux");
  if ($("eMontre").checked) {
    const f = document.createElement("div"); f.className = "eclair cadran";
    f.textContent = (bon ? "✓ " : "✗ ") + sgn(vrai);
    f.style.color = bon ? "var(--jade)" : "var(--cinabre)"; $("scene").appendChild(f);
  }
  if ($("eAvance").checked) suivante();
}
function controle() {
  X.pause = true; X.prochainControle = prochainControle(X.i + 1);
  $("exControle").hidden = false; $("ctrlSaisie").value = ""; $("ctrlRetour").textContent = ""; $("ctrlOk").disabled = false;
  setTimeout(() => $("ctrlSaisie").focus(), 40);
}
function validerControle() {
  if (!X.pause) return; const g = $("ctrlSaisie").value.trim(); if (g === "") return;
  const bon = parseInt(g, 10) === X.rc; X.controles.push(bon); $("ctrlOk").disabled = true; son(bon ? "ok" : "ko");
  $("ctrlRetour").textContent = bon ? "✓ exact" : "✗ c'était " + sgn(X.rc);
  $("ctrlRetour").style.color = bon ? "var(--jade)" : "var(--cinabre)";
  setTimeout(() => { $("exControle").hidden = true; X.pause = false; suivante(); }, bon ? 620 : 1400);
}
$("ctrlOk").onclick = validerControle;
$("ctrlSaisie").addEventListener("keydown", e => { if (e.key === "Enter") validerControle(); });
$("scene").addEventListener("click", () => { if (X.genre === "chrono" && X.encours && !X.pause) suivante(); });
function finExercice() {
  clearTimeout(X.minuteur); clearInterval(X.chrono); X.encours = false; $("exControle").hidden = true;
  X.secondes = X.depart ? (performance.now() - X.depart) / 1000 : 0;
  for (let k = 0; k <= X.i && k < X.cartes.length; k++) if (X.rep[k] === null && !X.silence) $("trace").children[k].className = "rate";
  $("boiteTC").hidden = !sys().equilibre || X.genre === "chrono";
  $("boiteJeux").hidden = X.genre === "chrono";
  $("exPiste").hidden = true; $("exBilan").hidden = false;
  setTimeout(() => $("rCompte").focus(), 50);
}
$("rVerifier").onclick = verifierExercice;
$("rCompte").addEventListener("keydown", e => { if (e.key === "Enter") verifierExercice(); });
function verifierExercice() {
  const g = $("rCompte").value.trim(); if (g === "") return;
  const dit = parseInt(g, 10), vues = Math.min(X.i + 1, X.cartes.length);
  let bons = 0, faux = 0, rates = 0;
  for (let k = 0; k < vues; k++) { const a = X.rep[k];
    if (a === null) rates++; else if (a === valeurCompte(X.cartes[k])) bons++; else faux++; }
  const exact = dit === X.rc, ecart = Math.abs(dit - X.rc);
  son(exact ? "ok" : "ko");
  $("rReel").textContent = sgn(X.rc); $("rReel").style.color = exact ? "var(--jade)" : "var(--cinabre)";
  const jeuxRestants = (X.sabot.length - vues) / 52, tc = CT.compteVrai(X.rc, jeuxRestants);
  const dj = parseFloat(($("rJeux").value || "").replace(",", ".")), dtc = parseInt($("rTC").value, 10);
  let txt = exact ? (prenom() ? `Exact, ${prenom()}. ` : "Exact. ") + "Le compte courant est juste." : `Écart de ${ecart} sur ${vues} cartes.`;
  if (X.genre === "chrono") txt += ` ${vues} cartes en ${fr1(X.secondes)} s, soit ${fr1(vues / Math.max(X.secondes, .1))} cartes par seconde.`;
  if (!isNaN(dj)) txt += ` Jeux restants estimés ${fr1(dj)} contre ${fr1(jeuxRestants)} réels${Math.abs(dj - jeuxRestants) <= .5 ? " ✓" : ""}.`;
  if (sys().equilibre && !isNaN(dtc)) txt += ` Compte vrai annoncé ${sgn(dtc)}, réel ${fr1(tc)}${Math.abs(dtc - tc) <= .5 ? " ✓" : ""}.`;
  $("rTexte").textContent = txt;
  const moy = X.delais.length ? X.delais.reduce((a, b) => a + b, 0) / X.delais.length / 1000 : null;
  const tuiles = [[sgn(dit), "Ta réponse"], [vues, "Cartes vues"]];
  if (!X.silence) tuiles.push([bons, "Clics justes"], [faux, "Clics faux"], [rates, "Ratées"], [moy !== null ? fr1(moy) + " s" : "—", "Réaction"]);
  if (X.genre === "chrono") tuiles.push([fr1(X.secondes) + " s", "Chrono"]);
  else { tuiles.push([fr1(jeuxRestants), "Jeux restants"]); if (sys().equilibre) tuiles.push([fr1(tc), "Compte vrai"]); }
  if (X.controles.length) tuiles.push([`${X.controles.filter(Boolean).length}/${X.controles.length}`, "Contrôles"]);
  $("rTuiles").innerHTML = tuiles.map(([b, l]) => `<div><b>${b}</b><span class="grave">${l}</span></div>`).join("");
  $("rMise").textContent = sys().equilibre && X.genre === "defilement"
    ? `À ce compte vrai, un compteur miserait ${CT.misesUnites(tc, 12)} unité${CT.misesUnites(tc, 12) > 1 ? "s" : ""}.` : "";
  DB.sessions.push({ t: Date.now(), genre: X.genre, sys: sys().nom, n: vues, exact, ecart,
    reaction: moy, secondes: X.genre === "chrono" ? +X.secondes.toFixed(1) : null,
    controles: X.controles.length ? [X.controles.filter(Boolean).length, X.controles.length] : null });
  while (DB.sessions.length > 240) DB.sessions.shift(); garder();
  $("exDemande").hidden = true; $("exVerdict").hidden = false;
}

/* ── Estimation du sabot ─────────────────────────────────────────── */
const ES = { jeux: 6, manches: 10, i: 0, n: 0, bons: 0, erreurs: [], bloque: false };
function demarrerEstimation() {
  ES.jeux = +$("sJeux").value; ES.manches = +$("sManches").value; ES.i = 0; ES.bons = 0; ES.erreurs = [];
  $("exReglages").hidden = true; $("exBilan").hidden = true; $("exPiste").hidden = true;
  $("estBilan").hidden = true; $("estPiste").hidden = false;
  const opts = []; for (let d = .5; d <= ES.jeux - .5; d += .5) opts.push(d);
  $("estBoutons").innerHTML = opts.map(d => `<button data-d="${d}">${fr1(d)}</button>`).join("");
  $("estBoutons").querySelectorAll("button").forEach(b => b.onclick = () => repondreEstimation(+b.dataset.d));
  $("estJustes").textContent = "0"; $("estEcart").textContent = "—";
  mancheEstimation();
}
function mancheEstimation() {
  if (ES.i >= ES.manches) return finEstimation();
  ES.bloque = false; $("estRetour").innerHTML = "";
  const total = ES.jeux * 52; ES.n = 26 + alea(total - 52);
  $("estPos").textContent = `Manche ${ES.i + 1} sur ${ES.manches} · sabot de ${ES.jeux} jeux`;
  $("estPile").style.height = "0px";
  requestAnimationFrame(() => { $("estPile").style.height = (242 * ES.n / total) + "px"; });
  son("carte");
}
function repondreEstimation(g) {
  if (ES.bloque) return; ES.bloque = true;
  const reel = ES.n / 52, err = Math.abs(g - reel), bon = err <= .5;
  if (bon) ES.bons++; ES.erreurs.push(err); ES.i++; son(bon ? "ok" : "ko");
  $("estRetour").innerHTML = `<span class="dit" style="color:${bon ? "var(--jade)" : "var(--cinabre)"}">${bon ? "Bien vu" : "Raté"}</span>
    ${ES.n} cartes, soit ${fr1(reel)} jeux au tas. Il reste ${fr1(ES.jeux - reel)} jeux dans le sabot.`;
  $("estJustes").textContent = ES.bons;
  $("estEcart").textContent = fr1(ES.erreurs.reduce((a, b) => a + b, 0) / ES.erreurs.length) + " jeu";
  setTimeout(() => { if (vue === "exercices") mancheEstimation(); }, bon ? 1050 : 2050);
}
function finEstimation() {
  const pct = Math.round(100 * ES.bons / Math.max(ES.erreurs.length, 1));
  const moy = ES.erreurs.length ? ES.erreurs.reduce((a, b) => a + b, 0) / ES.erreurs.length : 0;
  $("estPiste").hidden = true; $("estBilan").hidden = false;
  $("estNote").textContent = pct + " %"; $("estNote").style.color = pct >= 70 ? "var(--jade)" : "var(--cinabre)";
  $("estTexte").textContent = pct >= 90 ? "Coup d'œil de croupier. Ton compte vrai sera juste."
    : pct >= 70 ? "Correct. Un demi-jeu d'erreur coûte déjà un point de compte vrai, continue."
    : "À travailler : un compte courant parfait divisé par une mauvaise estimation donne une mauvaise décision.";
  $("estTuiles").innerHTML = [[`${ES.bons}/${ES.erreurs.length}`, "Justes"], [fr1(moy) + " jeu", "Écart moyen"],
    [fr1(Math.max.apply(null, ES.erreurs.concat([0]))) + " jeu", "Pire écart"], [ES.jeux, "Sabot"]]
    .map(([b, l]) => `<div><b>${b}</b><span class="grave">${l}</span></div>`).join("");
  DB.sessions.push({ t: Date.now(), genre: "estimation", sys: sys().nom, n: ES.erreurs.length, exact: pct >= 70, ecart: +moy.toFixed(2) });
  while (DB.sessions.length > 240) DB.sessions.shift(); garder();
}
$("estStop").onclick = finEstimation;
$("estRejouer").onclick = demarrerEstimation;
$("estRetourReglages").onclick = () => { $("estBilan").hidden = true; $("exReglages").hidden = false; };

/* ══════════════════════ STRATÉGIE ══════════════════════ */
const STR = { mode: "base", main: null, up: null, tc: 0, ecart: null, dePile: false, serie: 0, n: 0, bons: 0, bloque: false };
const carteDe = i => { const [suit, col] = SUITS[alea(4)]; return { r: RANKS[i], i, suit, col }; };
$("ongletsStrat").querySelectorAll("button").forEach(b => b.onclick = () => {
  STR.mode = b.dataset.s; STR.serie = 0; STR.n = 0; STR.bons = 0;
  $("ongletsStrat").querySelectorAll("button").forEach(x => x.setAttribute("aria-selected", x === b ? "true" : "false"));
  $("stratDrill").hidden = STR.mode === "grille"; $("stratGrille").hidden = STR.mode !== "grille";
  $("stratListe").hidden = STR.mode !== "ecarts";
  if (STR.mode === "grille") rendreGrille(); else nouveauCoup();
});
const clefFaute = (cs, u) => cs.map(rg).sort().join("-") + "v" + rg(u);
function nouveauCoup() {
  STR.bloque = false; $("sRetour").innerHTML = ""; STR.dePile = false;
  const d = donneesTable();
  if (STR.mode === "ecarts") {
    const tout = d.ecarts.concat(d.abandons.map(a => [a[0], a[1], a[2], a[3], "U"]));
    if (!tout.length) { $("sRetour").innerHTML = `<span class="dit">Cette table n'a aucun écart utile.</span>Change de table dans le salon.`; return; }
    const e = tout[alea(tout.length)];
    STR.ecart = { fam: e[0], cle: e[1], up: e[2], idx: e[3], vers: e[4] };
    STR.tc = e[3] + alea(5) - 2;
    STR.up = carteDe(e[2]);
    STR.main = mainDepuis(e[0], e[1]);
    $("sTC").hidden = false; $("sTC").innerHTML = `compte vrai<b>${sgn(STR.tc)}</b>`;
  } else {
    STR.ecart = null; $("sTC").hidden = true;
    const pile = DB.fautes;
    if (pile.length && alea(100) < 35) { const f = pile[alea(pile.length)];
      STR.main = f.p.map(carteDe); STR.up = carteDe(f.u); STR.dePile = true; }
    else { const s = sabotNeuf(6);
      do { STR.main = [s.splice(alea(s.length), 1)[0], s.splice(alea(s.length), 1)[0]]; STR.up = s.splice(alea(s.length), 1)[0]; }
      while (E.handTotal(STR.main) === 21); }
  }
  rendreCoup();
}
function mainDepuis(fam, cle) {
  if (fam === "pair") return [carteDe(cle), carteDe(cle)];
  if (fam === "soft") return [carteDe(0), carteDe(cle - 12)];
  // Un total dur : on prend une composition plausible qui n'est pas une paire.
  for (const a of [9, 8, 7, 6, 5, 4, 3, 2, 1]) { const b = cle - (a === 0 ? 11 : a + 1);
    for (let j = 1; j <= 9; j++) if ((j + 1) === b && j !== a) return [carteDe(a), carteDe(j)]; }
  return [carteDe(9), carteDe(cle - 11)];
}
function rendreCoup() {
  $("sUp").innerHTML = ""; $("sUp").appendChild(carteEl(STR.up));
  $("sMain").innerHTML = "";
  STR.main.forEach(c => $("sMain").appendChild(carteEl(c)));
  const t = E.handTotal(STR.main), soft = E.isSoft(STR.main);
  $("sTotal").textContent = (soft && t < 21 ? "souple " : "") + t;
  const paire = STR.main.length === 2 && E.cardValue(STR.main[0]) === E.cardValue(STR.main[1]);
  const r = reglesTable();
  const actes = [["H", "Tirer", "T"], ["S", "Rester", "R"], ["D", "Doubler", "B"], ["P", "Séparer", "S"]];
  if (r.surrender !== "none") actes.push(["U", "Abandonner", "A"]);
  $("sBoutons").innerHTML = actes.map(([k, l, key]) =>
    `<button class="btn creux" data-a="${k}"${k === "P" && !paire ? " disabled" : ""}>${l}<kbd>${key}</kbd></button>`).join("");
  $("sBoutons").querySelectorAll("button").forEach(b => b.onclick = () => repondreStrat(b.dataset.a));
  const t2 = tableCourante();
  $("stratIntro").innerHTML = STR.mode === "ecarts"
    ? `Le compte vrai t'est donné. Joue l'écart s'il y en a un, sinon la stratégie de base. Écarts calculés pour <b>${echap(t2.nom)}</b>, en ${sys().nom}.`
    : `Table en cours : <b>${echap(t2.nom)}</b> — ${t2.jeux} jeux, ${t2.h17 ? "croupier qui tire à dix-sept souple" : "croupier qui reste à dix-sept souple"}${t2.das ? ", doubler après séparation" : ""}${t2.surrender !== "none" ? ", abandon tardif" : ""}. Les mains que tu rates reviennent plus souvent.`;
  if (STR.mode === "ecarts") {
    const d = donneesTable();
    $("listeEcarts").textContent = d.ecarts.slice().sort((a, b) => Math.abs(a[3]) - Math.abs(b[3])).slice(0, 22)
      .map(e => `${nomCellule(e[0], e[1])} contre ${RANKS[e[2]]} : ${MOT[e[4]].toLowerCase()} dès ${sgn(e[3])}`).join(" · ")
      + (d.assurance !== null ? ` · assurance dès ${sgn(d.assurance)}` : "");
  }
  majScoreStrat();
}
const nomCellule = (f, k) => f === "hard" ? String(k) : f === "soft" ? `A,${k - 11}` : (k === 0 ? "A,A" : `${RANKS[k]},${RANKS[k]}`);
function majScoreStrat() {
  $("sSerie").textContent = STR.serie; $("sSession").textContent = STR.bons + "/" + STR.n;
  const a = DB.strat[STR.mode === "ecarts" ? "ecarts" : "base"];
  $("sTotalGen").textContent = a[0] + a[1] ? Math.round(100 * a[0] / (a[0] + a[1])) + " % sur " + (a[0] + a[1]) : "—";
}
function repondreStrat(a) {
  if (STR.bloque) return; STR.bloque = true;
  const d = donneesTable(), r = reglesTable();
  let juste, pourquoi;
  if (STR.mode === "ecarts") {
    const e = STR.ecart;
    const paire = STR.main.length === 2 && E.cardValue(STR.main[0]) === E.cardValue(STR.main[1]);
    const base = SOL.actionFor(d.chart, { total: E.handTotal(STR.main), soft: E.isSoft(STR.main),
      pairIdx: paire ? rg(STR.main[0]) : null, upIdx: rg(STR.up), canD: true, canP: paire, canU: r.surrender !== "none" });
    juste = STR.tc >= e.idx ? e.vers : base;
    pourquoi = `${nomCellule(e.fam, e.cle)} contre ${RANKS[e.up]} : ${MOT[e.vers].toLowerCase()} à partir de ${sgn(e.idx)}, sinon ${MOT[base].toLowerCase()}. Ici le compte vrai est ${sgn(STR.tc)}.`;
  } else {
    const paire = STR.main.length === 2 && E.cardValue(STR.main[0]) === E.cardValue(STR.main[1]);
    juste = SOL.actionFor(d.chart, { total: E.handTotal(STR.main), soft: E.isSoft(STR.main),
      pairIdx: paire ? rg(STR.main[0]) : null, upIdx: rg(STR.up), canD: true, canP: paire, canU: r.surrender !== "none" });
    const t = E.handTotal(STR.main);
    pourquoi = `${paire ? STR.main[0].r + "," + STR.main[1].r : (E.isSoft(STR.main) ? "souple " : "dur ") + t} contre ${STR.up.r} : ${MOT[juste].toLowerCase()}.`;
  }
  const ok = a === juste; STR.n++; if (ok) { STR.bons++; STR.serie++; } else STR.serie = 0;
  DB.strat[STR.mode === "ecarts" ? "ecarts" : "base"][ok ? 0 : 1]++;
  if (STR.mode === "base") {
    const k = clefFaute(STR.main, STR.up), i = DB.fautes.findIndex(f => f.k === k);
    if (!ok) { if (i < 0) { DB.fautes.push({ k, p: STR.main.map(rg), u: rg(STR.up), n: 1 }); while (DB.fautes.length > 40) DB.fautes.shift(); } else DB.fautes[i].n++; }
    else if (i >= 0 && STR.dePile) { if (--DB.fautes[i].n <= 0) DB.fautes.splice(i, 1); }
  }
  garder(); son(ok ? "ok" : "ko");
  $("sRetour").innerHTML = `<span class="dit" style="color:${ok ? "var(--jade)" : "var(--cinabre)"}">${ok ? "Juste" : "Non — " + MOT[juste]}</span>${echap(pourquoi)}`;
  majScoreStrat();
  setTimeout(() => { if (vue === "strategie") nouveauCoup(); }, ok ? 880 : 2350);
}
function rendreGrille() {
  const d = donneesTable(), t = tableCourante();
  $("grilleTable").textContent = t.nom;
  const ORD = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0], LBL = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "A"];
  const ligne = (nom, arr) => `<tr><th>${nom}</th>${ORD.map(u => `<td class="${arr[u]}">${arr[u]}</td>`).join("")}</tr>`;
  let h = `<table class="grille"><tr><th></th>${LBL.map(l => `<th>${l}</th>`).join("")}</tr>`;
  for (let x = 20; x >= 5; x--) h += ligne(String(x), d.chart.hard[x]);
  h += `<tr><th colspan="11" style="text-align:left;padding-top:8px">mains souples</th></tr>`;
  for (let x = 20; x >= 13; x--) if (d.chart.soft[x]) h += ligne("A," + (x - 11), d.chart.soft[x]);
  h += `<tr><th colspan="11" style="text-align:left;padding-top:8px">paires</th></tr>`;
  for (const i of [0, 9, 8, 7, 6, 5, 4, 3, 2, 1]) h += ligne(i === 0 ? "A,A" : `${RANKS[i]},${RANKS[i]}`, d.chart.pair[i]);
  $("grilleHote").innerHTML = h + "</table>";
}

/* ══════════════════════ CONCENTRATION ══════════════════════ */
const CO = { sabot: [], cartes: [], i: -1, rc: 0, minuteur: null, encours: false, susp: 0, indices: [],
  depart: 0, occupe: null, minuteurBulle: null, prochain: 0, flux: null, raf: null, prec: null, fige: 0,
  dernier: 0, cam: false, repondu: 0, pose: 0, grille: false, evtT: 0 };
const SOCIAL = [["Sonia", "Tu viens d'où, toi ?", ["Paris", "Lyon", "Du coin"]],
  ["Marc", "T'es déjà venu ici ?", ["Première fois", "Souvent", "De temps en temps"]],
  ["Karim", "Tu bois quelque chose ?", ["Un café", "Une eau", "Non merci"]],
  ["Croupier", "Bonne soirée jusque-là ?", ["Ça va", "On verra", "Tranquille"]],
  ["Léa", "C'est ta chaise porte-bonheur ?", ["Toujours", "Jamais", "Peut-être"]],
  ["Paul", "Il est quelle heure ?", ["Tard", "Aucune idée", "Bientôt minuit"]],
  ["Croupier", "Vous restez à cette table ?", ["Oui", "Un moment", "On verra"]]];
function calcul() { const a = 3 + alea(9), b = 2 + alea(9), r = a * b;
  const opts = [r, r + a, r - b]; for (let i = opts.length - 1; i > 0; i--) { const j = alea(i + 1); [opts[i], opts[j]] = [opts[j], opts[i]]; }
  return ["Marc", `Tu sais compter ? ${a} × ${b}, ça fait ?`, opts.map(String), String(r)]; }
$("coVitesse").oninput = () => { $("coVitesseL").textContent = fr1(+$("coVitesse").value / 1000) + " s";
  $("coPiste").style.setProperty("--intervalle", $("coVitesse").value + "ms"); };
const niveau = () => +$("coNiveau").value;
function indice(pts, quoi) {
  const now = performance.now(); if (now - CO.dernier < 600) return; CO.dernier = now;
  CO.susp = Math.min(100, CO.susp + pts); CO.indices.push([Math.round((now - CO.depart) / 1000), pts, quoi]); son("ko");
  const li = document.createElement("li"); li.innerHTML = `<b>+${pts}</b>${echap(quoi)}`; $("coIndices").prepend(li);
  majJauge();
  if (CO.susp >= 100) { CO.grille = true; finConcentration(true); }
}
const apaiser = pts => { CO.susp = Math.max(0, CO.susp - pts); majJauge(); };
function majJauge() {
  $("coJauge").querySelector("i").style.width = CO.susp + "%";
  $("coJauge").classList.toggle("chaude", CO.susp >= 60);
  $("coJaugeN").textContent = Math.round(CO.susp);
}
$("coDemarrer").onclick = demarrerConcentration;
$("coRejouer").onclick = demarrerConcentration;
$("coStop").onclick = () => finConcentration(false);
$("coRetour").onclick = () => { $("coBilan").hidden = true; $("coReglages").hidden = false; };
async function demarrerConcentration() {
  ac();
  const jeux = +$("coJeux").value;
  const s = await sabotProuvable(jeux);
  CO.sabot = s.cartes; CO.cartes = CO.sabot.slice(0, +$("coNb").value);
  CO.i = -1; CO.rc = CT.compteInitial(DB.sys, jeux); CO.encours = true; CO.susp = 0; CO.indices = [];
  CO.occupe = null; CO.repondu = 0; CO.pose = 0; CO.grille = false; CO.dernier = 0; CO.fige = 0; CO.prec = null;
  $("coIndices").innerHTML = ""; majJauge(); $("coBulle").innerHTML = ""; $("coDetendu").classList.remove("on");
  $("coReglages").hidden = true; $("coBilan").hidden = true; $("coPiste").hidden = false;
  $("coVerdict").hidden = true; $("coDemande").hidden = false; $("coSaisie").value = "";
  $("coPiste").style.setProperty("--intervalle", $("coVitesse").value + "ms");
  CO.cam = $("coCam").checked; await lancerCamera();
  CO.depart = performance.now(); CO.prochain = CO.depart + 2500 + alea(3000); suivanteCo();
}
function suivanteCo() {
  clearTimeout(CO.minuteur); if (!CO.encours) return;
  CO.i++; if (CO.i >= CO.cartes.length) return finConcentration(false);
  const c = CO.cartes[CO.i]; CO.rc += valeurCompte(c);
  $("coScene").innerHTML = ""; const e = carteEl(c);
  e.style.rotate = (alea(7) - 3) + "deg"; e.classList.add("carte--entre"); $("coScene").appendChild(e); son("carte");
  $("coPos").textContent = `${CO.i + 1} / ${CO.cartes.length}`;
  $("coReste").textContent = `${CO.sabot.length - CO.i - 1} cartes restantes`;
  // Un croupier n'est pas un métronome.
  const ms = +$("coVitesse").value * (.85 + alea(30) / 100);
  $("coBarre").style.transition = "none"; $("coBarre").style.width = "0";
  requestAnimationFrame(() => requestAnimationFrame(() => { $("coBarre").style.transition = `width ${ms}ms linear`; $("coBarre").style.width = "100%"; }));
  CO.minuteur = setTimeout(suivanteCo, ms);
  if (!CO.occupe && performance.now() >= CO.prochain && CO.i < CO.cartes.length - 2) evenement();
}
function evenement() {
  const n = niveau();
  const genre = alea(10) < (n === 3 ? 4 : n === 2 ? 3 : 2) ? "regard" : (alea(10) < 3 ? "calcul" : "social");
  const attente = n === 3 ? 2600 : n === 2 ? 4000 : 5500;
  if (genre === "regard") {
    CO.occupe = "regard"; $("coOeil").classList.add("on"); $("coDetendu").classList.add("on");
    const b = document.createElement("div"); b.className = "bulle regard";
    b.innerHTML = `<div class="de">Chef de table</div><div class="q">Il te fixe. Reste naturel.</div><div class="sablier" style="animation-duration:${n === 3 ? 1300 : 1800}ms"></div>`;
    $("coBulle").innerHTML = ""; $("coBulle").appendChild(b); son("alerte");
    CO.minuteurBulle = setTimeout(() => { if (CO.occupe === "regard") { fermerEvt(); indice(18, "Tu n'as pas réagi au regard du chef de table."); } }, n === 3 ? 1300 : 1800);
    return;
  }
  const [qui, q, opts, bonne] = genre === "calcul" ? calcul() : SOCIAL[alea(SOCIAL.length)];
  CO.occupe = genre; CO.pose++;
  const b = document.createElement("div"); b.className = "bulle";
  b.innerHTML = `<div class="de">${echap(qui)}</div><div class="q">${echap(q)}</div>
    <div class="opts">${opts.map(o => `<button>${echap(o)}</button>`).join("")}</div>
    <div class="sablier" style="animation-duration:${attente}ms"></div>`;
  b.querySelectorAll("button").forEach(bt => bt.onclick = () => {
    const dt = performance.now() - CO.evtT; fermerEvt(); CO.repondu++;
    if (genre === "calcul" && bt.textContent !== bonne) indice(14, `Mauvais calcul : c'était ${bonne}.`);
    else if (dt > attente * .7) indice(8, "Réponse hésitante : tu as mis trop de temps.");
    else apaiser(4);
  });
  $("coBulle").innerHTML = ""; $("coBulle").appendChild(b); CO.evtT = performance.now(); son("alerte");
  CO.minuteurBulle = setTimeout(() => { if (CO.occupe) { fermerEvt(); indice(genre === "calcul" ? 12 : 10, `Tu as ignoré ${qui}. Un joueur muet, ça se remarque.`); } }, attente);
}
function fermerEvt() {
  clearTimeout(CO.minuteurBulle); CO.occupe = null; $("coBulle").innerHTML = "";
  $("coOeil").classList.remove("on"); $("coDetendu").classList.remove("on");
  const n = niveau();
  CO.prochain = performance.now() + (n === 3 ? 3000 : n === 2 ? 5000 : 8000) + alea(4000);
}
function detendre() {
  if (!CO.encours) return;
  if (CO.occupe === "regard") { fermerEvt(); apaiser(3); son("ok"); }
  else if (!CO.occupe) indice(5, "Tu souris dans le vide. Bizarre.");
}
$("coDetendu").onclick = detendre;
async function lancerCamera() {
  arreterCamera(); $("coCamHors").hidden = false; $("coCamEtat").textContent = "";
  if (!CO.cam) { $("coCamHors").textContent = "Caméra désactivée : seuls les signes de comportement comptent."; return; }
  try {
    CO.flux = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: "user" }, audio: false });
    const v = $("coVideo"); v.srcObject = CO.flux; await v.play();
    $("coCamHors").hidden = true; $("coCamEtat").textContent = "Détecteur actif";
    CO.raf = requestAnimationFrame(camTick);
  } catch (e) { CO.cam = false; $("coCamHors").textContent = "Caméra indisponible ici (" + (e.name || "refusée") + "). Ouvre le site plutôt que la page publiée."; }
}
function arreterCamera() { cancelAnimationFrame(CO.raf); if (CO.flux) { CO.flux.getTracks().forEach(t => t.stop()); CO.flux = null; } }
const LW = 64, LH = 48;
const travail = document.createElement("canvas"); travail.width = LW; travail.height = LH;
const wx = travail.getContext("2d", { willReadFrequently: true });
let camDernier = 0;
function camTick(ts) {
  CO.raf = requestAnimationFrame(camTick);
  if (ts - camDernier < 80) return; camDernier = ts;
  const v = $("coVideo"); if (v.readyState < 2) return;
  wx.drawImage(v, 0, 0, LW, LH);
  const d = wx.getImageData(0, 0, LW, LH).data, g = new Float32Array(LW * LH);
  for (let i = 0; i < LW * LH; i++) g[i] = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3;
  const ov = $("coCanvas"); ov.width = 320; ov.height = 240;
  const ox = ov.getContext("2d"); ox.clearRect(0, 0, 320, 240);
  ox.strokeStyle = "rgba(224,168,60,.65)"; ox.lineWidth = 2;
  ox.beginPath(); ox.ellipse(160, 118, 72, 98, 0, 0, 7); ox.stroke();
  const bouche = { x0: Math.round(LW * .36), x1: Math.round(LW * .64), y0: Math.round(LH * .58), y1: Math.round(LH * .76) };
  ox.strokeStyle = "rgba(244,135,108,.6)";
  ox.strokeRect(bouche.x0 * 5, bouche.y0 * 5, (bouche.x1 - bouche.x0) * 5, (bouche.y1 - bouche.y0) * 5);
  if (CO.prec) {
    let visage = 0, nv = 0, bo = 0, nb = 0;
    for (let y = Math.round(LH * .1); y < Math.round(LH * .9); y++)
      for (let x = Math.round(LW * .25); x < Math.round(LW * .75); x++) {
        const df = Math.abs(g[y * LW + x] - CO.prec[y * LW + x]);
        const dedans = x >= bouche.x0 && x < bouche.x1 && y >= bouche.y0 && y < bouche.y1;
        if (dedans) { bo += df; nb++; } else { visage += df; nv++; }
      }
    visage /= nv; bo /= nb;
    const immobile = visage < 1.2 && bo < 1.2; CO.fige = immobile ? CO.fige + 80 : 0;
    const levres = bo > 7 && bo > visage * 2.6;
    $("coCamEtat").textContent = `visage ${visage.toFixed(1)} · bouche ${bo.toFixed(1)}${levres ? " · LÈVRES" : ""}${CO.fige > 3000 ? " · figé " + Math.round(CO.fige / 1000) + " s" : ""}`;
    if (CO.encours) {
      if (levres) indice(niveau() === 3 ? 9 : 6, "Tes lèvres bougent. Tu comptes à voix basse ?");
      if (CO.fige > (niveau() === 3 ? 6000 : 9000)) { CO.fige = 0; indice(7, "Visage figé, regard vissé sur les cartes."); }
    }
  }
  CO.prec = g;
}
function finConcentration(grille) {
  clearTimeout(CO.minuteur); clearTimeout(CO.minuteurBulle); CO.encours = false; CO.occupe = null;
  $("coBulle").innerHTML = ""; $("coOeil").classList.remove("on"); $("coDetendu").classList.remove("on"); arreterCamera();
  CO.vues = Math.min(CO.i + 1, CO.cartes.length);
  $("coTitre").textContent = grille ? "Grillé. Le chef de table te raccompagne." : "Tu quittes la table tranquillement.";
  $("coSous").textContent = grille ? "Il reste une question, la seule qui compte : tu avais le compte ?"
    : `${CO.vues} cartes vues, suspicion finale ${Math.round(CO.susp)} sur 100. Annonce ton compte.`;
  $("coPiste").hidden = true; $("coBilan").hidden = false;
  setTimeout(() => $("coSaisie").focus(), 50);
}
$("coVerifier").onclick = verifierConcentration;
$("coSaisie").addEventListener("keydown", e => { if (e.key === "Enter") verifierConcentration(); });
function verifierConcentration() {
  const g = $("coSaisie").value.trim(); if (g === "") return;
  const dit = parseInt(g, 10), ok = dit === CO.rc, ecart = Math.abs(dit - CO.rc); son(ok ? "ok" : "ko");
  $("coReel").textContent = sgn(CO.rc); $("coReel").style.color = ok ? "var(--jade)" : "var(--cinabre)";
  const secondes = (performance.now() - CO.depart) / 1000;
  let txt = ok ? "Compte exact" : `Écart de ${ecart}`;
  txt += CO.grille ? ", mais grillé : au casino, ça ne sert plus à rien."
    : CO.susp < 30 ? ", et personne n'a rien vu. C'est exactement ça."
    : CO.susp < 70 ? ", avec un chef de table qui commence à te trouver louche."
    : ", à deux doigts de te faire sortir.";
  $("coTexte").textContent = txt;
  const pire = CO.indices.slice().sort((a, b) => b[1] - a[1])[0];
  $("coTuiles").innerHTML = [[sgn(dit), "Ta réponse"], [CO.vues, "Cartes vues"], [Math.round(CO.susp), "Suspicion"],
    [CO.indices.length, "Signes"], [`${CO.repondu}/${CO.pose}`, "Questions"], [fr1(secondes) + " s", "Durée"]]
    .map(([b, l]) => `<div><b>${b}</b><span class="grave">${l}</span></div>`).join("")
    + (pire ? `<div style="grid-column:1/-1"><b style="font-size:var(--t-corps);font-family:Archivo,sans-serif">${echap(pire[2])}</b><span class="grave">Ton pire signe (+${pire[1]})</span></div>` : "");
  DB.sessions.push({ t: Date.now(), genre: "concentration", sys: sys().nom, n: CO.vues, exact: ok && !CO.grille,
    ecart: CO.grille ? Math.max(ecart, 1) : ecart, susp: Math.round(CO.susp), grille: CO.grille });
  while (DB.sessions.length > 240) DB.sessions.shift(); garder();
  $("coDemande").hidden = true; $("coVerdict").hidden = false;
}

/* ══════════════════════ À PLUSIEURS ══════════════════════ */
const MP = { api: null, code: "", moi: "", nom: "", pairs: new Map(), hote: false, url: "",
  cartes: [], i: -1, rc: 0, encours: false, minuteur: null, annonces: new Map(), graine: null, empreinte: "" };
function messageMP(o) { if (MP.api) MP.api.publier(NET.sujet(MP.code), JSON.stringify(o)); }
function rendrePairs() {
  const tous = [...MP.pairs.values()];
  const hoteId = [...MP.pairs.keys()].sort()[0];
  MP.hote = hoteId === MP.moi;
  $("mpPairs").innerHTML = tous.sort((a, b) => a.id.localeCompare(b.id)).map(p =>
    `<span class="pair ${p.id === MP.moi ? "moi" : ""} ${p.id === hoteId ? "croupier" : ""}"><span class="point"></span>${echap(p.nom)}${p.id === hoteId ? " · croupier" : ""}${p.id === MP.moi ? " · toi" : ""}</span>`).join("");
  $("mpLancer").disabled = !MP.hote || MP.encours;
  $("mpExplique").textContent = MP.hote
    ? "Tu es le croupier de ce sabot : c'est toi qui le lances. Ton propre compte n'entre pas au classement, puisque tu connais l'ordre des cartes. Ferme l'onglet et le rôle passe à quelqu'un d'autre."
    : "Le croupier lance le sabot. Compte en silence, puis annonce. Le compte réel n'est révélé qu'une fois que tout le monde a répondu.";
}
async function ouvrirSalon(code) {
  MP.code = code; MP.moi = "j" + SH.hex(crypto.getRandomValues(new Uint8Array(5)));
  MP.nom = prenom() || "Joueur";
  MP.pairs = new Map([[MP.moi, { id: MP.moi, nom: MP.nom }]]);
  $("mpEtat").textContent = "Connexion au courtier…";
  try {
    const { api, url } = await NET.connecterAvecRepli({
      clientId: "hilo-" + MP.moi,
      onMessage: (_, brut) => { try { recevoirMP(JSON.parse(brut)); } catch (e) {} },
      onClose: () => { $("mpRelais").textContent = "Connexion perdue. Recharge la page pour revenir."; },
    });
    MP.api = api; MP.url = url;
    api.souscrire(NET.sujet(code));
    setTimeout(() => messageMP({ t: "salut", id: MP.moi, nom: MP.nom }), 220);
    $("mpAccueil").hidden = true; $("mpSalon").hidden = false;
    $("mpCodeAff").textContent = code;
    $("mpRelais").textContent = "Relié par " + url.replace("wss://", "").split(":")[0] + ". Les messages passent en clair par un courtier public.";
    rendrePairs(); rendreClassement();
  } catch (e) {
    $("mpEtat").innerHTML = `Aucun courtier n'a répondu. Deux causes possibles : ton réseau bloque les connexions WebSocket, ou tu es sur une page publiée dont la politique de sécurité les interdit. <b>Le reste de l'application fonctionne normalement.</b>`;
    son("ko");
  }
}
function recevoirMP(m) {
  if (!m || !m.id || m.id === MP.moi) {
    if (m && m.id === MP.moi) return;
  }
  if (m.t === "salut") {
    if (!MP.pairs.has(m.id)) { MP.pairs.set(m.id, { id: m.id, nom: m.nom || "Joueur" }); rendrePairs();
      messageMP({ t: "salut", id: MP.moi, nom: MP.nom }); }
    return;
  }
  if (m.t === "sabot") { demarrerSabotMP(m); return; }
  if (m.t === "carte") { afficherCarteMP(m); return; }
  if (m.t === "annonce") { MP.annonces.set(m.id, m.v); rendreClassement(); return; }
  if (m.t === "reveal") { MP.rcReel = m.rc; MP.graineHex = m.graine; rendreClassement(true); return; }
  if (m.t === "adieu") { MP.pairs.delete(m.id); rendrePairs(); return; }
}
$("mpCreer").onclick = () => ouvrirSalon(NET.codeSalon());
$("mpRejoindre").onclick = () => {
  const c = ($("mpCode").value || "").trim().toUpperCase();
  if (c.length < 4) { $("mpEtat").textContent = "Il faut le code complet, cinq caractères."; return; }
  ouvrirSalon(c);
};
$("mpQuitter").onclick = () => {
  messageMP({ t: "adieu", id: MP.moi }); if (MP.api) MP.api.fermer();
  MP.api = null; $("mpSalon").hidden = true; $("mpAccueil").hidden = false; $("mpEtat").textContent = "";
};
$("mpCopier").onclick = () => {
  const lien = location.origin + location.pathname + "#salon=" + MP.code;
  navigator.clipboard && navigator.clipboard.writeText(lien).then(() => bandeau("Lien copié : envoie-le à tes amis."), () => bandeau("Code : " + MP.code));
};
$("mpLancer").onclick = async () => {
  if (!MP.hote) return;
  const s = await sabotProuvable(2);
  MP.graine = s.graine; MP.empreinte = s.empreinte;
  const cartes = s.cartes.slice(0, 60);
  messageMP({ t: "sabot", id: MP.moi, n: cartes.length, empreinte: s.empreinte });
  demarrerSabotMP({ n: cartes.length, empreinte: s.empreinte });
  for (let k = 0; k < cartes.length; k++) {
    await dodo(1400);
    if (!MP.encours) break;
    const c = cartes[k];
    messageMP({ t: "carte", id: MP.moi, k, i: c.i, s: c.suit, col: c.col, r: c.r });
    afficherCarteMP({ k, i: c.i, s: c.suit, col: c.col, r: c.r, n: cartes.length });
  }
  await dodo(900);
  if (MP.encours) { MP.encours = false; $("mpAnnoncer").disabled = false;
    $("mpTitreDefi").textContent = "Sabot terminé — annonce ton compte"; rendrePairs(); }
};
function demarrerSabotMP(m) {
  MP.cartes = []; MP.i = -1; MP.rc = CT.compteInitial(DB.sys, 2); MP.encours = true;
  MP.annonces = new Map(); MP.rcReel = null; MP.total = m.n;
  $("mpTitreDefi").textContent = "Sabot en cours"; $("mpAnnoncer").disabled = true;
  $("mpScene").innerHTML = ""; $("mpPos").textContent = `0 / ${m.n}`;
  rendreClassement(); rendrePairs();
}
function afficherCarteMP(m) {
  const c = { r: m.r, i: m.i, suit: m.s, col: m.col };
  MP.rc += valeurCompte(c); MP.i = m.k;
  $("mpScene").innerHTML = ""; const e = carteEl(c); e.classList.add("carte--entre");
  e.style.setProperty("--dx", "180px"); e.style.setProperty("--dy", "-120px");
  $("mpScene").appendChild(e); son("carte");
  const n = MP.total || m.n || 60;
  $("mpPos").textContent = `${m.k + 1} / ${n}`;
  $("mpBarre").style.transition = "width .2s"; $("mpBarre").style.width = (100 * (m.k + 1) / n) + "%";
}
$("mpAnnoncer").onclick = () => {
  ouvrirModale(`<h2>Ton compte</h2><div class="demande" style="justify-content:center">
    <input type="number" id="mpSaisie" placeholder="0"><button class="btn" id="mpOk">Annoncer</button></div>`);
  const envoyer = () => {
    const g = $("mpSaisie").value.trim(); if (g === "") return;
    const v = parseInt(g, 10);
    MP.annonces.set(MP.moi, v); messageMP({ t: "annonce", id: MP.moi, v });
    $("modale").hidden = true; $("mpAnnoncer").disabled = true; rendreClassement();
    if (MP.hote) setTimeout(() => { messageMP({ t: "reveal", id: MP.moi, rc: MP.rc, graine: SH.hex(MP.graine) });
      MP.rcReel = MP.rc; MP.graineHex = SH.hex(MP.graine); rendreClassement(true); }, 2600);
  };
  $("mpOk").onclick = envoyer;
  $("mpSaisie").addEventListener("keydown", e => { if (e.key === "Enter") envoyer(); });
  setTimeout(() => $("mpSaisie").focus(), 40);
};
function rendreClassement(revele) {
  const hoteId = [...MP.pairs.keys()].sort()[0];
  const lignes = [...MP.pairs.values()].map(p => {
    const a = MP.annonces.get(p.id);
    const ecart = (revele && MP.rcReel !== null && a !== undefined) ? Math.abs(a - MP.rcReel) : null;
    return { nom: p.nom, croupier: p.id === hoteId, a, ecart };
  }).sort((x, y) => (x.ecart === null ? 99 : x.ecart) - (y.ecart === null ? 99 : y.ecart));
  $("mpClassement").innerHTML = `<tr><th>Joueur</th><th>Annonce</th><th>Écart</th></tr>` + lignes.map(l =>
    `<tr><td>${echap(l.nom)}${l.croupier ? ' <span class="muet">· croupier</span>' : ""}</td>
     <td class="n">${l.a === undefined ? "—" : sgn(l.a)}</td>
     <td class="n" style="color:${l.ecart === 0 ? "var(--jade)" : l.ecart ? "var(--cinabre)" : "inherit"}">${l.ecart === null ? "—" : l.ecart === 0 ? "exact" : l.ecart}</td></tr>`).join("")
    + (revele && MP.rcReel !== null ? `<tr><td colspan="3" class="muet" style="padding-top:10px">Compte réel : <b class="cadran">${sgn(MP.rcReel)}</b>. Graine du mélange : <span class="cadran" style="font-size:11px;word-break:break-all">${echap(MP.graineHex || "")}</span></td></tr>` : "");
}
if (location.hash.startsWith("#salon=")) {
  const c = location.hash.slice(7).toUpperCase();
  if (c.length >= 4) { aller("ensemble"); setTimeout(() => ouvrirSalon(c), 300); }
}

/* ══════════════════════ PROGRESSION ══════════════════════ */
const GENRE = { defilement: "Défilement", chrono: "Sabot chrono", table: "Table", concentration: "Concentration", estimation: "Estimation" };
const pctDe = a => a[0] + a[1] ? Math.round(100 * a[0] / (a[0] + a[1])) + " %" : "—";
function rendreProgres() {
  const S = DB.sessions;
  $("progTitre").textContent = prenom() ? `Tes sessions, ${prenom()}` : "Tes sessions";
  if (!S.length) {
    $("progPave").innerHTML = `<div class="laque t"><b>—</b><span class="grave">Aucune session pour l'instant</span></div>`;
    $("progJournal").innerHTML = ""; dessinerCourbe([]); return;
  }
  const ex = S.filter(s => s.exact).length;
  const rts = S.filter(s => s.reaction); const rt = rts.length ? rts.reduce((a, s) => a + s.reaction, 0) / rts.length : null;
  const chr = S.filter(s => s.genre === "chrono" && s.exact && s.secondes);
  const best = chr.length ? Math.min(...chr.map(s => s.secondes / s.n * 52)) : null;
  let serie = 0; for (let i = S.length - 1; i >= 0 && S[i].exact; i--) serie++;
  const d10 = S.slice(-10), ex10 = d10.filter(s => s.exact).length;
  $("progPave").innerHTML = [
    [S.length, "Sessions"], [Math.round(100 * ex / S.length) + " %", "Comptes exacts"],
    [Math.round(100 * ex10 / d10.length) + " %", "Sur les 10 dernières"], [serie, "Série en cours"],
    [rt !== null ? fr1(rt) + " s" : "—", "Réaction moyenne"], [best !== null ? fr1(best) + " s" : "—", "Meilleur jeu de 52"],
    [pctDe(DB.strat.base), "Stratégie de base"], [pctDe(DB.strat.ecarts), "Écarts au compte"], [pctDe(DB.strat.assurance), "Assurance"]
  ].map(([b, l]) => `<div class="laque t"><b>${b}</b><span class="grave">${l}</span></div>`).join("");
  const lignes = S.slice(-45).reverse().map(s => { const d = new Date(s.t);
    return `<tr><td>${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</td>
      <td>${GENRE[s.genre] || s.genre}</td><td>${echap(s.sys || "")}</td><td class="n">${s.n}</td>
      <td style="color:${s.exact ? "var(--jade)" : "var(--cinabre)"}">${s.exact ? "exact" : "écart " + s.ecart}</td>
      <td class="muet">${s.reaction ? fr1(s.reaction) + " s" : s.secondes ? fr1(s.secondes) + " s" : ""}${s.controles ? " · contrôles " + s.controles[0] + "/" + s.controles[1] : ""}${s.susp !== undefined ? " · suspicion " + s.susp + (s.grille ? " · grillé" : "") : ""}</td></tr>`; }).join("");
  $("progJournal").innerHTML = `<tr><th>Quand</th><th>Exercice</th><th>Système</th><th>Cartes</th><th>Résultat</th><th>Détail</th></tr>${lignes}`;
  dessinerCourbe(S.filter(x => x.genre !== "estimation").slice(-30));
}
function dessinerCourbe(S) {
  const c = $("courbe"), dpr = window.devicePixelRatio || 1, W = c.clientWidth || 800, H = 216;
  c.width = W * dpr; c.height = H * dpr;
  const x = c.getContext("2d"); x.scale(dpr, dpr); x.clearRect(0, 0, W, H);
  const css = getComputedStyle(document.documentElement);
  const os = css.getPropertyValue("--os-eteint").trim() || "#888";
  const or = css.getPropertyValue("--laiton").trim() || "#c9a552";
  const jade = css.getPropertyValue("--jade").trim(), cin = css.getPropertyValue("--cinabre").trim();
  const P = { l: 36, r: 12, t: 14, b: 26 };
  const maxE = Math.max(3, ...S.map(s => s.ecart)), n = Math.max(S.length, 1);
  const X = i => P.l + (W - P.l - P.r) * (n === 1 ? .5 : i / (n - 1));
  const Y = v => P.t + (H - P.t - P.b) * (1 - v / maxE);
  x.font = '11px "Martian Mono", monospace'; x.fillStyle = os;
  x.strokeStyle = css.getPropertyValue("--ardoise").trim() || "rgba(128,128,128,.2)"; x.lineWidth = 1;
  for (let v = 0; v <= maxE; v += Math.max(1, Math.ceil(maxE / 4))) {
    x.beginPath(); x.moveTo(P.l, Y(v)); x.lineTo(W - P.r, Y(v)); x.stroke(); x.fillText(v, 8, Y(v) + 4);
  }
  if (!S.length) { x.fillText("Lance une session pour voir ta courbe.", P.l + 8, H / 2); return; }
  x.beginPath(); x.moveTo(X(0), Y(S[0].ecart));
  S.forEach((s, i) => x.lineTo(X(i), Y(s.ecart)));
  x.lineTo(X(n - 1), Y(0)); x.lineTo(X(0), Y(0)); x.closePath();
  x.fillStyle = or + "22"; x.fill();
  x.beginPath(); S.forEach((s, i) => i ? x.lineTo(X(i), Y(s.ecart)) : x.moveTo(X(i), Y(s.ecart)));
  x.strokeStyle = or; x.lineWidth = 2; x.stroke();
  S.forEach((s, i) => { x.beginPath(); x.arc(X(i), Y(s.ecart), i === n - 1 ? 5 : 3.5, 0, 7);
    x.fillStyle = s.exact ? jade : cin; x.fill(); });
  x.fillStyle = os; x.fillText("plus ancien", P.l, H - 8);
  const w = x.measureText("plus récent").width; x.fillText("plus récent", W - P.r - w, H - 8);
}
$("progEffacer").onclick = () => {
  if (!confirm("Effacer tout l'historique ?")) return;
  DB.sessions = []; DB.strat = { base: [0, 0], ecarts: [0, 0], assurance: [0, 0] }; DB.fautes = [];
  garder(); rendreProgres(); bandeau("Historique effacé.");
};
window.addEventListener("resize", () => { if (vue === "progres") dessinerCourbe(DB.sessions.filter(x => x.genre !== "estimation").slice(-30)); });

/* ══════════════════════ CLAVIER ══════════════════════ */
document.addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") return;
  if (!$("modale").hidden) { if (e.key === "Escape") $("modale").hidden = true; return; }
  if (vue === "exercices" && X.encours && !X.pause) {
    if (X.genre === "chrono") { if (e.key === " " || e.key === "ArrowRight" || e.key === "Enter") { suivante(); e.preventDefault(); } return; }
    if (e.key === "ArrowLeft") { repondre(-1); e.preventDefault(); }
    else if (e.key === "ArrowRight") { repondre(1); e.preventDefault(); }
    else if (e.key === "ArrowDown" || e.key === " ") { repondre(0); e.preventDefault(); }
    else if (/^[1-5]$/.test(e.key)) { const b = $("reponses").children[+e.key - 1]; if (b) repondre(+b.dataset.v); }
  } else if (vue === "strategie" && !STR.bloque) {
    const m = { t: "H", r: "S", b: "D", s: "P", a: "U" }[e.key.toLowerCase()];
    const bt = m && $("sBoutons").querySelector(`[data-a="${m}"]`);
    if (bt && !bt.disabled) { repondreStrat(m); e.preventDefault(); }
  } else if (vue === "concentration" && CO.encours) {
    if (e.key === " " || e.key === "Enter") { detendre(); e.preventDefault(); }
  } else if (vue === "table") {
    const k = e.key.toLowerCase();
    if (k === "t") $("bTire").click(); else if (k === "r") $("bReste").click();
    else if (k === "b") $("bDouble").click(); else if (k === "s") $("bSepare").click();
    else if (k === "a") $("bAbandon").click(); else if (k === "d" || k === "Enter") $("bDonne").click();
  }
});

/* ══════════════════════ DÉMARRAGE ══════════════════════ */
appliquerTheme(); rendreSon(); rendreSysteme(); rendreReponses(); rendreEventail(); ongletEx("defilement");
$("eVitesse").dispatchEvent(new Event("input")); $("coVitesse").dispatchEvent(new Event("input"));
nouveauSabot();
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
