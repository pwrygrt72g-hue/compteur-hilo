/* ══════════════════════ À PLUSIEURS — LA TABLE ══════════════════════
   LA TABLE DE BLACKJACK À PLUSIEURS (lot Réseau). Concaténé après ensemble.js.
   Jusqu'à cinq humains autour de LA scène (#v-table), pas d'un écran à part :
   ton siège est `.toi`, les autres sont nommés, et tout ce qui existe déjà —
   cartes.js, jetons.js (le règlement animé), croupier.js (les humeurs), le bus
   « sabot:* » — sert tel quel.

   Le modèle (src/table-reseau.mjs) : l'HÔTE est autoritaire. Il tient le sabot
   prouvable, distribue, tranche. Chaque client — l'hôte compris — reçoit un ÉTAT
   complet, versionné, et l'affiche tel quel : rendreReseau() compare l'état reçu
   au précédent et n'en déduit que des GESTES (une carte qui arrive, une mise qui
   vole, une main réglée), jamais une issue.

   Comment on se greffe sans dupliquer le rendu :
   · T.reseau = { code, moi, hote, phase } : la scène sait qu'elle est partagée.
   · T.enJeu reste VRAI tant qu'on est en réseau : c'est ce qui tient fermées la
     donne solo (distribuer), la phase de mise solo (ouvrirMises) et le rachat solo.
   · Nos mains portent les drapeaux de jetons.js (jRegle, jEngage, jDouble…) déjà
     posés : ses écouteurs les considèrent réglées et n'y touchent pas l'argent —
     DB.tapis, le tapis SOLO, ne bouge jamais ici. Les jetons de la table à
     plusieurs sont ceux de l'état ; on les fait voler avec ses outils (vol,
     glisser, lueur, garnirCercles).
   · Les boutons de table.js sont ENVELOPPÉS (l'ancien onclick est gardé) : en
     réseau ils envoient une action à l'hôte, en solo ils font ce qu'ils faisaient.
   ═══════════════════════════════════════════════════════════════════ */
const RS = { salle: null, api: null, code: "", moi: "", etat: null, prec: null, tableSolo: "", ticker: null, abandon: false,
  mise: 0, poses: [], miseVue: {}, enVol: {}, emis: new Set(), partis: new Set(), assurPartie: new Set(), vus: new Set(),
  vuCroupier: 0, vuCachee: false, signature: "", bulleAssurance: false, rachatPropose: 0, panneauOuvert: false,
  // Le crochet de visio.js : un message du courtier lui est d'abord proposé (sujets visio/*),
  // et il le garde ou le rend. net.mjs n'a qu'un seul onMessage, posé à la connexion.
  onBrut: null };
const PAGES_URL = "https://pwrygrt72g-hue.github.io/compteur-hilo/";
// Ta couleur à la table = un JETON du rack (jetons.js), pas une pastille arc-en-ciel :
// la pastille devant ton nom en prend la face. Une ancienne couleur enregistrée
// qui n'est plus dans la liste retombe sur un jeton tiré au sort.
const COULEURS = RACK.map(v => { const j = jetonDe(v); return [j.face, fmtJ(v), v]; });
if (!DB.couleur || !COULEURS.some(c => c[0] === DB.couleur)) DB.couleur = COULEURS[alea(COULEURS.length)][0];

/* ── Qui je suis : un identifiant par onglet, qui survit à un rechargement ──
   C'est ce qui permet de retrouver son siège : l'hôte garde un siège dont le joueur
   a disparu quinze secondes (ABSENCE_DELAI), le temps qu'il revienne avec le même id. */
function rsIdentite() {
  const neuf = () => "j" + SH.hex(crypto.getRandomValues(new Uint8Array(5)));
  try { let id = sessionStorage.getItem("sabot-id"); if (!id) { id = neuf(); sessionStorage.setItem("sabot-id", id); } return id; } catch (e) { return neuf(); }
}
function rendreCouleurs() {
  const b = $("mpCouleurBoite"); if (!b) return;
  b.innerHTML = "";
  COULEURS.forEach(([c, n, v]) => {
    const x = jetonEl(v, 44, "button"); x.type = "button"; x.classList.add("couleur"); x.classList.toggle("on", DB.couleur === c);
    x.style.setProperty("--c", c); x.setAttribute("role", "radio"); x.setAttribute("aria-checked", DB.couleur === c); x.setAttribute("aria-label", "jeton de " + n); x.title = "Jeton de " + n; x.dataset.c = c;
    x.onclick = () => { DB.couleur = x.dataset.c; garder(); rendreCouleurs(); };
    b.appendChild(x);
  });
  rendreTableMP();
}
// La table où l'on va s'asseoir, à droite du formulaire : la carte du salon, telle
// quelle (mêmes règles, même avantage maison), avec ses sièges — on voit ce qu'on ouvre.
function rendreTableMP() {
  const boite = $("mpTable"); if (!boite) return;
  const t = tableCourante(), n = DONNEES.catalogue.indexOf(t) + 1;
  boite.innerHTML = carteTableHtml(t, { n, inerte: true })
    + `<p class="muet mp-sieges" style="font-size:var(--t-fin);margin:8px 0 0">${Math.min(t.sieges, 5)} sièges · mise minimale ${fmtJ(t.mise_min)}</p>
       <div class="rang-btn" style="margin-top:8px;justify-content:flex-start"><button class="btn creux" data-vue="salon">Changer de table</button></div>`;
  boite.querySelector("[data-vue]").onclick = () => aller("salon");
}
rendreCouleurs();
document.addEventListener("sabot:table", rendreTableMP);

/* ── Le transport : MQTT en vrai ; une usine injectée (window.__reseauTransport)
   pour la sonde et les captures, qui n'ont pas de courtier. ─────────────── */
async function rsConnecter(code) {
  const sujet = NET.sujetTable(code);
  if (window.__reseauTransport) {
    const t = window.__reseauTransport({ sujet, id: RS.moi, onMessage: m => rsRecevoir(m) });
    return { publier: o => t.publier(JSON.stringify(o)), fermer: () => t.fermer && t.fermer(), nom: "transport local" };
  }
  const { api, url } = await NET.connecterAvecRepli({
    clientId: "hilo-" + RS.moi + "-" + Date.now().toString(36).slice(-4),
    // Le testament : si l'onglet ferme sans dire au revoir, le courtier le dit pour lui.
    testament: { sujet, message: JSON.stringify({ t: "adieu", id: RS.moi }) },
    onEssai: (n, total, nom) => rsEtatTexte(`Essai ${n} sur ${total} — ${nom}…`),
    onMessage: (s, brut) => { if (RS.onBrut && RS.onBrut(s, brut)) return; try { rsRecevoir(JSON.parse(brut)); } catch (e) {} },
    onClose: () => rsDeconnecte(),
  });
  api.souscrire(sujet);
  // `brut` : l'api de net.mjs telle quelle, pour la visio (elle souscrit ses propres sujets).
  return { publier: o => api.publier(sujet, JSON.stringify(o)), fermer: () => api.fermer(), nom: NET.nomCourtier(url), brut: api };
}
function rsRecevoir(m) { if (RS.salle) RS.salle.recevoir(m, Date.now()); }
function rsEtatTexte(t) { const e = $("mpEtat"); if (e) e.textContent = t; }
function rsEchec() {
  $("mpEtat").innerHTML = `Aucun courtier joignable en trois secondes. Dans un Artifact publié, les connexions WebSocket sont bloquées sans un mot : la table à plusieurs se joue sur <a href="${PAGES_URL}" target="_blank" rel="noopener">pwrygrt72g-hue.github.io/compteur-hilo</a>. <b>Le reste de l'application marche normalement.</b>`;
  son("ko");
}
function rsDeconnecte() {
  if (!T.reseau) return;
  $("annonce").textContent = "Connexion perdue. Quitte la table et rejoins-la avec le même code.";
  bandeau("Connexion au courtier perdue.");
}

/* ── Les options de la partie : la table où l'on est assis, ses limites, la
   stratégie des bots (celle du solveur), le compte (ton système). Lues au moment
   de devenir hôte — un invité élu joue la table adoptée, pas la sienne. ── */
function rsStrategie(cards, up, ctx) {
  const d = donneesTable();
  const total = E.handTotal(cards), soft = E.isSoft(cards);
  const paire = cards.length === 2 && E.cardValue(cards[0]) === E.cardValue(cards[1]) ? rg(cards[0]) : null;
  return SOL.actionFor(d.chart, { total, soft, pairIdx: paire, upIdx: rg(up), canD: !!ctx.peutDoubler, canP: paire !== null && !!ctx.peutSeparer, canU: !!ctx.peutAbandonner });
}
function rsOptionsPartie() {
  const t = tableCourante();
  return { regles: reglesTable(), table: t.id, jeux: t.jeux, miseMin: t.mise_min || 10, miseMax: t.mise_max || 1000,
    par5: t.blackjackPays < 1.5, csm: t.melange === "melangeuse_continue", penetration: t.penetration, tapis: TAPIS_DEPART,
    sys: DB.sys, valeur: valeurCompte, rcInitial: jeux => CT.compteInitial(DB.sys, jeux), strategie: rsStrategie };
}
async function rsCartesNeuves() {
  const jeux = (RS.etat && RS.etat.jeux) || tableCourante().jeux;
  const s = await sabotProuvable(jeux);
  return { cartes: s.cartes, empreinte: s.empreinte, graine: SH.hex(s.graine) };
}

/* ── Ouvrir ou rejoindre ─────────────────────────────────────────────── */
async function ouvrirTable(code, createur) {
  if (RS.salle) quitterTable(true);
  RS.moi = rsIdentite(); RS.code = code; RS.abandon = false; RS.api = null;
  $("mpCreer").disabled = $("mpRejoindre").disabled = true;
  rsEtatTexte("Recherche d'un courtier…");
  // Trois secondes, pas vingt-sept : un refus silencieux (CSP d'un Artifact) doit être dit tout de suite.
  const garde = setTimeout(() => { if (!RS.api) { RS.abandon = true; rsEchec(); $("mpCreer").disabled = $("mpRejoindre").disabled = false; } }, 3000);
  let api;
  try { api = await rsConnecter(code); }
  catch (e) { clearTimeout(garde); if (!RS.abandon) rsEchec(); $("mpCreer").disabled = $("mpRejoindre").disabled = false; return; }
  clearTimeout(garde);
  if (RS.abandon) { try { api.fermer(); } catch (e) {} return; }
  RS.api = api; $("mpCreer").disabled = $("mpRejoindre").disabled = false; rsEtatTexte("");
  RS.salle = TR.creerSalle({
    moi: RS.moi, nom: prenom() || "Joueur", couleur: DB.couleur, createur, cadence: vitesse(), horloge: Date.now,
    transport: { publier: o => api.publier(o) },
    cartesNeuves: rsCartesNeuves, partie: rsOptionsPartie,
    onEtat: e => rendreReseau(e),
    onInfo: txt => { bandeau(txt, 3200); if (RS.etat) { rsResyncMise(); rsBoutons(RS.etat); } },
    onPairs: pairs => { emettre("reseau-pairs", { pairs }); if (rsPanneauVisible()) rsPanneau(); },
  });
  entrerModeReseau();
  RS.salle.entrer(Date.now());
  // La visio (visio.js) se greffe ici : le courtier est relié, la scène est en mode réseau.
  emettre("reseau-entree", { api, code, moi: RS.moi });
  RS.ticker = setInterval(() => { if (!RS.salle) return; RS.salle.cadence = vitesse(); RS.salle.tic(Date.now()); }, 200);
  aller("table");
  bandeau(createur ? "Table ouverte — partage le code " + TR.formaterCode(code) : "Tu rejoins la table " + TR.formaterCode(code), 3600);
}
function entrerModeReseau() {
  RS.tableSolo = DB.table;
  T.reseau = { code: RS.code, moi: RS.moi, hote: "", phase: "attente" };
  T.enJeu = true; T.occupe = false; T.actif = null; T.toi = null; T.croupier = [];
  J.phase = "attente"; J.donnee = false;
  RS.prec = null; RS.etat = null; RS.mise = 0; RS.poses = []; RS.miseVue = {}; RS.enVol = {};
  RS.emis = new Set(); RS.partis = new Set(); RS.assurPartie = new Set(); RS.vus = new Set();
  RS.vuCroupier = 0; RS.vuCachee = false; RS.signature = ""; RS.bulleAssurance = false; RS.rachatPropose = 0;
  $("v-table").dataset.reseau = "1"; $("v-table").dataset.phase = "attente";
  $("bReseau").hidden = false; $("bReseau").textContent = "Table " + TR.formaterCode(RS.code);
  $("bNouveauSabot").textContent = "Journal";
  $("dMain").innerHTML = ""; $("dScore").textContent = "·"; $("conseil").textContent = ""; $("boiteAssurance").innerHTML = "";
  T.sieges = Array.from({ length: TR.NB_SIEGES }, () => ({ nom: "Libre", vide: true, mains: [], mise: 0, miseVue: 0, reseau: true }));
  poserLieu(tableCourante()); rsChipCode();
  rsRendreSieges(); boutons({}); $("bDonne").disabled = true;
  $("annonce").textContent = "Connexion à la table…";
  rsRendreRack();
}
function quitterTable(silencieux) {
  emettre("reseau-sortie", {});   // la visio se ferme d'abord : son adieu doit partir par un courtier encore relié
  if (RS.salle) { try { RS.salle.quitter(); } catch (e) {} } RS.salle = null;
  if (RS.api) { try { RS.api.fermer(); } catch (e) {} } RS.api = null;
  clearInterval(RS.ticker); RS.ticker = null;
  if (!T.reseau) return;
  T.reseau = null; RS.etat = null; RS.prec = null;
  delete $("v-table").dataset.reseau; $("bReseau").hidden = true; $("bNouveauSabot").textContent = "Nouveau sabot";
  $("boiteAssurance").innerHTML = ""; $("jetonsCalque").innerHTML = "";
  if (RS.tableSolo) { DB.table = RS.tableSolo; garder(); }
  T.enJeu = false; T.occupe = false; T.actif = null; T.toi = null; J.phase = "attente"; J.donnee = false;
  nouveauSabotSolo();               // la table solo repart : sabot neuf, sièges, mises ouvertes
  if (!silencieux) bandeau("Tu as quitté la table à plusieurs.");
}
function rsAgir(a, v, extra) { if (!RS.salle) return null; return RS.salle.agir(a, v, extra, Date.now()); }
const rsMonSiege = () => T.toi ? T.sieges.indexOf(T.toi) : -1;
const rsHote = () => !!(RS.etat && RS.etat.hote === RS.moi);

/* ── Le rendu d'un état : on compare, on redessine, on joue les gestes ───── */
const rsCle = (e, k, hi) => e.manche + ":" + k + ":" + hi;
const rsCarteCle = c => c.cachee ? "?" : c.r + c.suit;
function rsSignature(e) {
  return JSON.stringify([e.manche, e.phase, e.actif, e.sieges.map(st => st && [st.id, st.nom, st.absent, st.passe, st.bot, st.mise,
    st.mains.map(h => [h.cards.map(rsCarteCle).join(""), h.result || "", h.doubled, h.assurance])])]);
}
function rendreReseau(e) {
  if (!T.reseau || !e) return;
  const prec = RS.prec; RS.etat = e;
  T.reseau.hote = e.hote; T.reseau.phase = e.phase;
  // La table de l'hôte devient la mienne : le lieu, les règles, les limites la suivent.
  if (DB.table !== e.table) { DB.table = e.table; garder(); poserLieu(tableCourante()); rsChipCode(); }
  if (!$("tCode")) rsChipCode();
  const memeManche = !!prec && prec.manche === e.manche && prec.phase !== "reglement" || !!prec && prec.phase === e.phase && e.phase === "reglement";
  if (e.phase === "mise" && (!prec || prec.phase !== "mise")) {
    RS.mise = 0; RS.poses = []; RS.miseVue = {}; RS.enVol = {}; RS.emis = new Set(); RS.partis = new Set(); RS.assurPartie = new Set(); RS.vus = new Set();
    J.phase = "attente"; J.donnee = false; $("v-table").dataset.phase = "mise"; $("boiteAssurance").innerHTML = ""; RS.bulleAssurance = false; RS.rachatPropose = 0;
  }
  if (e.phase !== "mise" && e.phase !== "attente" && e.phase !== "sabot") { J.donnee = true; if (J.phase === "attente" || J.phase === "mise") J.phase = "jeu"; if (e.phase !== "reglement") $("v-table").dataset.phase = "jeu"; }
  if (e.phase === "attente" || e.phase === "sabot") { J.donnee = false; $("v-table").dataset.phase = "attente"; }

  /* ── Les sièges de la scène, reconstruits depuis l'état ── */
  const effets = [];
  T.sieges = e.sieges.map((st, k) => {
    if (!st) return { nom: "Libre", vide: true, toi: false, mains: [], mise: 0, miseVue: 0, reseau: true };
    const s = { nom: st.nom, toi: st.id === RS.moi, id: st.id, couleur: st.couleur, bot: st.bot, absent: st.absent, tapis: st.tapis, mise: st.mise,
      rachats: st.rachats, passe: st.passe, dernierNet: st.dernierNet, reseau: true, miseVue: RS.miseVue[k] || 0, mains: [] };
    s.mains = st.mains.map((h, hi) => {
      const cle = rsCle(e, k, hi);
      return Object.assign(E.newHand(h.cards.map(c => Object.assign({}, c)), h.bet), {
        doubled: h.doubled, surrendered: h.surrendered, fromSplit: h.fromSplit, fromSplitAces: h.fromSplitAces, result: h.result, net: h.net, assurance: h.assurance || 0,
        // Les drapeaux de jetons.js : réglée (il n'y touche pas), vue (la pile est dessinée)…
        jRegle: true, jEngage: true, jDouble: true, jVu: !h.fromSplit || hi === 0 || RS.vus.has(cle + ":v"),
        jDoubleVu: RS.vus.has(cle + ":d"), jAssuranceVu: RS.vus.has(cle + ":a"), jParti: RS.partis.has(cle), jAssurancePartie: RS.assurPartie.has(cle) });
    });
    return s;
  });
  T.toi = T.sieges.find(s => s.toi) || null;
  T.actif = e.actif && T.sieges[e.actif.siege] && !T.sieges[e.actif.siege].vide ? e.actif : null;
  T.croupier = e.croupier.map(c => c.cachee ? { cachee: true } : Object.assign({}, c));
  T.sabot = new Array(e.sabot.restantes); T.coupe = e.sabot.coupe; T.defausse = e.sabot.defausse;
  T.rc = e.rc; T.vues = e.vues; T.empreinte = e.sabot.empreinte; T.mains = e.manche;

  /* ── Ce qui a changé : cartes nouvelles, mains réglées, mises, doublements ── */
  if (memeManche) {
    e.sieges.forEach((st, k) => {
      if (!st) return;
      const ps = prec.sieges[k], meme = ps && ps.id === st.id;
      // Multi-ensemble des cartes déjà vues sur ce siège : une séparation déplace les
      // cartes d'une main à l'autre, on ne compare donc pas main par main mais carte par carte.
      const deja = new Map();
      if (meme) ps.mains.forEach(h => h.cards.forEach(c => { const q = rsCarteCle(c); deja.set(q, (deja.get(q) || 0) + 1); }));
      st.mains.forEach((h, hi) => {
        const cle = rsCle(e, k, hi), ph = meme ? ps.mains[hi] : null;
        h.cards.forEach((c, ci) => { const q = rsCarteCle(c); if (deja.get(q)) deja.set(q, deja.get(q) - 1); else effets.push({ t: "carte", siege: k, main: hi, index: ci, carte: c }); });
        if (h.doubled && !(ph && ph.doubled)) effets.push({ t: "jetons", siege: k, montant: h.bet, cle: cle + ":d" });
        if (h.fromSplit && hi > 0 && !(ph && ph.fromSplit)) effets.push({ t: "jetons", siege: k, montant: h.bet, cle: cle + ":v" });
        if (h.assurance && !(ph && ph.assurance)) effets.push({ t: "jetons", siege: k, montant: h.assurance, cle: cle + ":a" });
        const finie = h.result && (h.net !== undefined || h.result === "sauté" || h.result === "abandon");
        if (finie && !RS.emis.has(cle)) { RS.emis.add(cle);
          const montant = h.net !== undefined ? h.net : h.result === "sauté" ? -h.bet * (h.doubled ? 2 : 1) : -h.bet / 2;
          effets.push({ t: "fin", siege: k, main: hi, issue: h.result, montant, toi: st.id === RS.moi, h: T.sieges[k].mains[hi], cle }); }
        if (h.assurance && h.net !== undefined && !RS.assurPartie.has(cle)) effets.push({ t: "assurance-fin", siege: k, main: hi, cle, toi: st.id === RS.moi, gagne: e.croupier.length === 2 && !e.cachee && E.handTotal(e.croupier) === 21, mise: h.assurance });
      });
    });
    e.croupier.forEach((c, ci) => { if (ci >= RS.vuCroupier) effets.push({ t: "carte", siege: "croupier", main: 0, index: ci, carte: c, cachee: !!c.cachee }); });
  } else if (prec) {
    // Nouvelle manche : rien à animer sur ce qui vient d'être remis à zéro.
    RS.vuCroupier = 0;
    if (e.croupier.length) e.croupier.forEach((c, ci) => effets.push({ t: "carte", siege: "croupier", main: 0, index: ci, carte: c, cachee: !!c.cachee }));
  } else {
    // Premier état reçu (ou reconnexion) : tout apparaît, sans vol — on n'a pas vu la donne.
    RS.vuCroupier = e.croupier.length;
    e.sieges.forEach((st, k) => st && st.mains.forEach((h, hi) => { if (h.result) RS.emis.add(rsCle(e, k, hi)); if (h.net !== undefined) { RS.partis.add(rsCle(e, k, hi)); RS.assurPartie.add(rsCle(e, k, hi)); } if (h.doubled) RS.vus.add(rsCle(e, k, hi) + ":d"); if (h.assurance) RS.vus.add(rsCle(e, k, hi) + ":a"); RS.vus.add(rsCle(e, k, hi) + ":v"); }));
    T.sieges.forEach(s => s.mains.forEach((h, hi) => { h.jDoubleVu = h.doubled; h.jAssuranceVu = !!h.assurance; h.jVu = true; h.jParti = h.net !== undefined; }));
  }
  const revele = !!prec && prec.cachee && !e.cachee && e.croupier.length >= 2;
  const tourChange = JSON.stringify(e.actif) !== JSON.stringify(prec ? prec.actif : null) || (prec && prec.phase !== e.phase);
  const remelange = e.evenement && e.evenement.t === "remelange" && (!prec || prec.sabot.empreinte !== e.sabot.empreinte);
  const donneDebut = !!prec && prec.phase === "mise" && e.phase !== "mise" && e.phase !== "attente" && e.phase !== "sabot";
  const reglementDebut = e.phase === "reglement" && (!prec || prec.phase !== "reglement");

  /* ── Le dessin ── */
  const sig = rsSignature(e);
  if (sig !== RS.signature) { RS.signature = sig; rsRendreSieges(); }
  rsRendreCroupier(e, prec);
  rafraichirBarre(); rsRendreRack(); rsBoutons(e); rsAnnonce(e); rsAssurance(e); rsMisesDesAutres(e);
  if (rsPanneauVisible()) rsPanneau();

  /* ── Les gestes, dans l'ordre d'une vraie table ── */
  if (remelange) { emettre("remelange", { table: e.table, cartes: e.sabot.restantes, pendantDonne: !!e.evenement.pendantDonne }); if (!e.evenement.pendantDonne) bandeau("Sabot neuf, scellé : empreinte publiée, graine révélée à la fin."); }
  if (e.evenement && e.evenement.t === "reprise" && (!prec || prec.hote !== e.hote)) bandeau(e.message, 4200);
  if (e.evenement && e.evenement.t === "rachat" && prec && prec.v < e.v) { const st = e.sieges[e.evenement.siege]; if (st && st.id !== RS.moi) bandeau(st.nom + " reprend 1 000 jetons."); }
  if (donneDebut) {
    const moi = T.toi, jetons = moi && moi.mains.length ? moi.mains[0].bet : 0, l = limites();
    const tc = sys().equilibre ? CT.compteVrai(e.rc, e.sabot.restantes / 52) : null;
    emettre("donne-debut", { table: e.table, sieges: e.sieges.filter(st => st && !st.passe).length, mise: jetons ? jetons / l.min : undefined, jetons: jetons || undefined, tc });
    rsRendreRack();
  }
  let delai = 0;
  effets.filter(f => f.t === "carte").forEach(f => { rsEffetCarte(f, delai); delai += 120; });
  if (revele) { const el = $("dMain").children[1] || $("dMain").lastElementChild; son("carte"); emettre("croupier-revele", { carte: e.croupier[1], total: E.handTotal(e.croupier), el }); }
  effets.filter(f => f.t === "jetons").forEach(f => rsEffetJetons(f));
  if (tourChange && e.phase === "jeu" && e.actif) emettre("tour", { siege: e.actif.siege, main: e.actif.main, toi: !!(T.toi && T.sieges[e.actif.siege] === T.toi) });
  if (tourChange && e.phase === "croupier") emettre("tour", { siege: "croupier", main: 0, toi: false });
  effets.filter(f => f.t === "assurance-fin").forEach(f => rsEffetAssuranceFin(f));
  effets.filter(f => f.t === "fin").forEach(f => rsEffetFin(f));
  if (reglementDebut) {
    const issues = e.sieges.map(st => st ? st.mains.map(h => ISSUE_BUS[h.result] || h.result) : []);
    const moi = T.toi, k = rsMonSiege();
    const net = moi ? moi.mains.reduce((s, h) => s + (h.net || 0) + (h.assurance ? (E.handTotal(e.croupier) === 21 && e.croupier.length === 2 ? h.assurance * 2 : -h.assurance) : 0), 0) : 0;
    emettre("manche-fin", { issues, toi: k >= 0 ? issues[k] : [], net, solde: moi ? arr(moi.tapis - TAPIS_DEPART * (1 + (moi.rachats || 0))) : 0, croupier: E.handTotal(e.croupier) });
    rsRendreRack();
  }
  if (e.phase === "mise" && T.toi && T.toi.tapis < e.miseMin && !T.toi.mise && RS.rachatPropose !== e.manche && vue === "table" && $("modale").hidden) { RS.rachatPropose = e.manche; setTimeout(() => { if (RS.etat === e && T.toi && T.toi.tapis < e.miseMin) rsRachat(); }, 500); }
  RS.prec = e;
}

/* ── Les sièges : le rendu de table.js, puis ce que le réseau ajoute ─────── */
function rsRendreSieges() {
  rendreSieges();
  const e = RS.etat;
  document.querySelectorAll("#sieges .siege").forEach((d, k) => {
    const st = T.sieges[k], nm = d.querySelector(".nom"); if (!st || !nm) return;
    d.classList.toggle("vide", !!st.vide); d.classList.toggle("absent", !!st.absent); d.classList.toggle("bot", !!st.bot);
    d.classList.toggle("passe", !!(st.passe && !st.vide && e && e.phase !== "mise" && e.phase !== "attente"));
    if (st.vide) {
      if (!T.toi && e && e.phase !== "sabot") {
        const b = document.createElement("button"); b.type = "button"; b.className = "asseoir"; b.textContent = "S'asseoir";
        b.onclick = () => rsAgir("asseoir", k, { nom: prenom() || "Joueur", couleur: DB.couleur }); nm.replaceWith(b);
      } else nm.textContent = "Libre";
      return;
    }
    nm.innerHTML = `<i class="pastille" style="--c:${echap(st.couleur || "#8a8f8b")}"></i>${echap(st.nom)}${st.bot ? " · bot" : ""}${st.absent ? " · parti" : ""}`;
    const tp = document.createElement("span"); tp.className = "tapis-siege"; tp.textContent = fmtJ(st.tapis) + (st.rachats ? " · " + st.rachats + " rachat" + (st.rachats > 1 ? "s" : "") : "");
    nm.after(tp);
  });
  // Les sièges ont grandi (tapis sous le nom, boutons « S'asseoir ») APRÈS la mesure de
  // rendreSieges() : on remesure, sinon ce qui dépasse passe sur le lettrage du rail.
  dimensionnerCartes();
}
function rsChipCode() {
  const r = $("tRegles"); if (!r || !RS.code) return;
  let c = $("tCode"); if (!c) { c = document.createElement("span"); c.id = "tCode"; c.className = "regle code"; c.title = "Le code de cette table : partage-le"; r.prepend(c); }
  c.textContent = TR.formaterCode(RS.code);
}
/* Le croupier : on n'y touche que quand ses cartes changent — la carte cachée est un
   DOS qu'on RETOURNE (cartes.js), il ne faut pas le recréer entre-temps. */
function rsRendreCroupier(e, prec) {
  const dm = $("dMain");
  // On repart de zéro quand sa main repart (nouvelle manche) ou quand le dessin ne
  // correspond plus à ce qu'on croit avoir dessiné ; sinon on n'ajoute que le manquant.
  if (!prec || prec.manche !== e.manche || e.croupier.length < RS.vuCroupier || dm.children.length !== RS.vuCroupier) { dm.innerHTML = ""; RS.vuCroupier = 0; }
  for (let i = RS.vuCroupier; i < e.croupier.length; i++) { const c = e.croupier[i]; dm.appendChild(carteEl(c.cachee ? { r: "A", i: 0, suit: "♠", col: "n" } : c, !!c.cachee)); }
  RS.vuCroupier = e.croupier.length; RS.vuCachee = e.cachee;
  const visibles = e.croupier.filter(c => !c.cachee);
  $("dScore").textContent = !visibles.length ? "·" : e.cachee ? E.cardValue(visibles[0]) : E.handTotal(visibles);
}
function rsEffetCarte(f, delai) {
  setTimeout(() => {
    if (!T.reseau) return;
    const hote = f.siege === "croupier" ? $("dMain") : $(`m_${f.siege}_${f.main}`); if (!hote) return;
    const el = hote.children[f.index]; if (!el || el.classList.contains("carte--entre")) return;
    const cr = el.getBoundingClientRect(), sr = $("sabot").getBoundingClientRect();
    animerDepuisSabot(el, cr); son("carte");
    emettre("carte", { siege: f.siege, main: f.main, index: f.index, carte: f.carte, cachee: !!f.cachee, el,
      depuis: { x: sr.left + sr.width / 2, y: sr.top + sr.height / 2 }, vers: { x: cr.left + cr.width / 2, y: cr.top + cr.height / 2 } });
  }, delai);
}
// Une seconde mise (doublement, séparation, assurance) part de chez son propriétaire.
function rsEffetJetons(f) {
  const st = T.sieges[f.siege], toi = !!(st && st.toi);
  vol({ montant: f.montant, w: toi ? 40 : 36, depuis: toi ? ancreRack(25) : ancreMaison(f.siege), vers: ancreCercle(f.siege), duree: 360, apparait: !toi,
    fin: () => { RS.vus.add(f.cle); const [m, k, hi] = f.cle.split(":"); const h = T.sieges[k] && T.sieges[k].mains[+hi]; if (h) { if (f.cle.endsWith(":d")) h.jDoubleVu = true; if (f.cle.endsWith(":v")) h.jVu = true; if (f.cle.endsWith(":a")) h.jAssuranceVu = true; } garnirCercles(); if (toi) son("jetons"); } });
}
// Une main réglée : le bus pour le croupier (ses humeurs) et cartes.js ; les jetons,
// nous-mêmes, avec les outils de jetons.js — il ne touche pas nos mains.
function rsEffetFin(f) {
  const issue = ISSUE_BUS[f.issue] || f.issue, h = f.h, engage = h.bet * (h.doubled ? 2 : 1), retour = arr(engage + f.montant), si = f.siege, toi = f.toi;
  emettre("main-fin", { siege: si, main: f.main, toi, issue, montant: f.montant });
  enfiler(() => {
    RS.partis.add(f.cle); const st = T.sieges[si], hh = st && st.mains[f.main]; if (hh) hh.jParti = true; garnirCercles();
    if ($("v-table").hidden) return;
    const ce = ancreCercle(si), croupier = ancreCroupier(), maison = ancreMaison(si);
    if (issue === "bust" || issue === "perd") glisser(engage, ce, croupier, { fondu: true });
    else if (issue === "abandon") { glisser(engage / 2, ce, croupier, { fondu: true }); glisser(retour, ce, maison, { fondu: !toi }); }
    else if (issue === "egalite") glisser(engage, ce, maison, { fondu: !toi });
    else { glisser(f.montant, croupier, ce, { fin: () => { if (toi) { lueur(si); son("jetons"); } glisser(retour, ce, maison, { fondu: !toi, duree: 460, fin: () => rsRendreTapis() }); } }); return; }
    if (toi) { rsRendreTapis(); son("jetons"); }
  });
}
function rsEffetAssuranceFin(f) {
  enfiler(() => {
    RS.assurPartie.add(f.cle); const st = T.sieges[f.siege], h = st && st.mains[f.main]; if (h) h.jAssurancePartie = true; garnirCercles();
    if ($("v-table").hidden) return;
    const ce = ancreCercle(f.siege);
    if (f.gagne) glisser(f.mise * 2, ancreCroupier(), ce, { fin: () => { glisser(f.mise * 3, ce, ancreMaison(f.siege), { fondu: !f.toi }); if (f.toi) { lueur(f.siege); son("jetons"); } } });
    else glisser(f.mise, ce, ancreCroupier(), { fondu: true });
  });
}
// Les mises des autres arrivent dans leur cercle en volant ; la mienne part du rack au clic.
function rsMisesDesAutres(e) {
  if (e.phase !== "mise") return;
  e.sieges.forEach((st, k) => {
    if (!st) return;
    const vue = RS.miseVue[k] || 0, enVol = RS.enVol[k];
    if (st.mise > vue && (enVol === undefined || enVol < st.mise)) {
      const moi = st.id === RS.moi, cible = st.mise, m = arr(st.mise - Math.max(vue, enVol || 0)); RS.enVol[k] = cible;
      vol({ montant: m, w: moi ? 40 : 36, depuis: moi ? ancreRack(25) : ancreMaison(k), vers: ancreCercle(k), duree: 380, apparait: !moi,
        fin: () => { RS.miseVue[k] = Math.max(RS.miseVue[k] || 0, cible); if (RS.enVol[k] === cible) delete RS.enVol[k]; rsGarnir(); } });
    } else if (st.mise < vue) { RS.miseVue[k] = st.mise; rsGarnir(); }
  });
}
function rsGarnir() { T.sieges.forEach((s, k) => { s.miseVue = RS.miseVue[k] || 0; }); garnirCercles(); }

/* ── L'annonce, les boutons, le rack ─────────────────────────────────── */
function rsAnnonce(e) {
  const moi = T.toi; let txt = "";
  if (e.phase === "attente") txt = rsHote() ? `En attente de joueurs — partage le code ${TR.formaterCode(RS.code)}` : "En attente de l'hôte…";
  else if (e.phase === "sabot") txt = e.message || "Le croupier mélange un sabot neuf…";
  else if (e.phase === "mise") txt = !moi ? "Choisis un siège libre pour jouer" : (moi.mise >= e.miseMin ? "Mise posée" : "Faites vos jeux") + ` — ${e.miseRestant} s` + (rsHote() ? " · « Distribuer » clôt les mises" : "");
  else if (e.phase === "assurance") txt = "Le croupier montre un as. Assurance ?";
  else if (e.phase === "jeu") { const st = e.actif && e.sieges[e.actif.siege]; txt = st ? (st.id === RS.moi ? "À toi de jouer" : `À ${st.nom} de jouer`) + (e.tourRestant > 0 && e.tourRestant <= 10 ? ` — ${e.tourRestant} s` : "") : ""; }
  else if (e.phase === "croupier") txt = "Le croupier joue.";
  else if (e.phase === "reglement") txt = (e.message || "") + (moi && moi.mains.length ? " Toi : " + moi.mains.map(h => h.result).join(" · ") + "." : "");
  if (e.message && e.phase !== "reglement" && e.phase !== "sabot") txt = e.message + (txt ? " " + txt : "");
  $("annonce").textContent = txt;
}
function rsBoutons(e) {
  const moi = T.toi, r = reglesTable();
  const monTour = e.phase === "jeu" && e.actif && moi && T.sieges[e.actif.siege] === moi && moi.mains[e.actif.main];
  if (monTour) {
    const h = moi.mains[e.actif.main];
    boutons({ tire: true, reste: true, double: E.canDouble(h, moi.mains, r) && moi.tapis >= h.bet, separe: E.canSplit(h, moi.mains, r) && moi.tapis >= h.bet, abandon: E.canSurrender(h, moi.mains, r) });
    if (DB.conseil && e.croupier[0]) {
      const tc = sys().equilibre ? CT.compteVrai(e.rc, e.sabot.restantes / 52) : null;
      const { a, ecart } = actionAvecEcart(h.cards, e.croupier[0], moi, h, tc);
      $("conseil").innerHTML = `Stratégie : <b>${MOT[a]}</b>` + (ecart !== null ? ` <span class="muet">— écart au compte, à partir de ${sgn(ecart)}</span>` : "");
    } else $("conseil").textContent = "";
  } else { boutons({}); $("conseil").textContent = ""; }
  const b = $("bDonne");
  if (e.phase === "mise" && rsHote()) { const prets = e.sieges.some(st => st && st.mise >= e.miseMin && !st.absent); b.disabled = !prets; b.title = prets ? "Clore les mises et distribuer" : "Personne n'a encore misé"; }
  else { b.disabled = true; b.title = e.phase === "mise" ? "L'hôte distribue quand il clôt les mises" : ""; }
}
function rsRendreRack() {
  rendreRack();                                          // le squelette de jetons.js ; on repasse sur ce qui est à nous
  const e = RS.etat, moi = T.toi, l = limites();
  const ouvert = !!(e && e.phase === "mise" && moi && !moi.absent);
  $("rackJetons").classList.toggle("ouvert", ouvert);
  $("rjJetons").querySelectorAll("button").forEach(b => { const v = +b.dataset.v; b.disabled = !ouvert || v > moi.tapis || RS.mise + v > l.max || (l.par5 && v % 5 !== 0); });
  $("rjTapis").textContent = moi ? fmtJ(moi.tapis) : "—";
  $("rjMise").textContent = fmtJ(RS.mise);
  const u = RS.mise / l.min;
  $("rjUnites").textContent = RS.mise ? `${fr1(u)} unité${u > 1 ? "s" : ""}` : (moi && moi.tapis >= l.min ? "pose ta mise" : "—");
  $("bRetirer").disabled = !ouvert || !RS.poses.length;
  $("bRachat").hidden = !(ouvert && moi.tapis < l.min && RS.mise === 0);
  $("coachMise").innerHTML = "";
  rsRendreTapis();
}
function rsRendreTapis() {
  const moi = T.toi, e = RS.etat;
  $("tTapis").textContent = moi ? fmtJ(moi.tapis) : "—";
  const n = $("tNet"); if (!moi || !e) { n.hidden = true; return; }
  const engage = e.phase === "mise" ? moi.mise : moi.mains.reduce((s, h) => s + (h.net === undefined ? h.bet * (h.doubled ? 2 : 1) + (h.assurance || 0) : 0), 0);
  const s = arr(moi.tapis + engage - TAPIS_DEPART * (1 + (moi.rachats || 0)));
  n.hidden = !s; n.textContent = (s > 0 ? "+" : "") + fmtJ(s); n.className = s > 0 ? "plus" : s < 0 ? "moins" : "";
}
// Ma mise, jeton par jeton : le vol est immédiat, l'hôte confirme le total.
function rsPoser(v) {
  const e = RS.etat, moi = T.toi; if (!e || e.phase !== "mise" || !moi) return;
  const l = limites(), k = rsMonSiege();
  if (l.par5 && v % 5 !== 0) return bandeau("Ici les mises vont par 5.");
  if (v > moi.tapis) return bandeau("Il ne te reste pas ça en main.");
  if (RS.mise + v > l.max) return bandeau(`Maximum de la table : ${fmtJ(l.max)}.`);
  RS.mise = arr(RS.mise + v); RS.poses.push(v); moi.tapis = arr(moi.tapis - v); RS.enVol[k] = RS.mise;
  const cible = RS.mise;
  rsRendreRack();
  vol({ v, w: 40, depuis: ancreRack(v), vers: ancreCercle(k), fin: () => { if (!RS.etat || RS.etat.phase !== "mise") return; RS.miseVue[k] = Math.max(RS.miseVue[k] || 0, Math.min(cible, RS.mise)); if (RS.enVol[k] === cible) delete RS.enVol[k]; rsGarnir(); son("jetons"); } });
  rsAgir("mise", RS.mise);
}
function rsRetirer() {
  const e = RS.etat, moi = T.toi; if (!e || e.phase !== "mise" || !moi || !RS.poses.length) return;
  const v = RS.poses.pop(), k = rsMonSiege();
  RS.mise = arr(RS.mise - v); moi.tapis = arr(moi.tapis + v); RS.miseVue[k] = Math.min(RS.miseVue[k] || 0, RS.mise); delete RS.enVol[k];
  rsGarnir(); rsRendreRack();
  vol({ v, w: 40, depuis: ancreCercle(k), vers: ancreRack(v), fin: () => son("jetons") });
  rsAgir("mise", RS.mise);
}
// L'hôte a refusé (ou l'état diverge) : on se recale sur ce qu'il dit.
function rsResyncMise() {
  const e = RS.etat, moi = T.toi; if (!e || e.phase !== "mise" || !moi) return;
  const st = e.sieges[rsMonSiege()]; if (!st || st.mise === RS.mise) return;
  RS.mise = st.mise; RS.poses = decoupe(st.mise); RS.miseVue[rsMonSiege()] = st.mise; delete RS.enVol[rsMonSiege()]; rsGarnir(); rsRendreRack();
}
function rsRachat() {
  const e = RS.etat, moi = T.toi; if (!e || !moi || !$("modale").hidden) return;
  ouvrirModale(`<h2>Plus un jeton</h2>
    <p>Il te reste <b class="cadran">${fmtJ(moi.tapis)}</b> en main et le minimum ici est de <b>${fmtJ(e.miseMin)}</b>.</p>
    <p class="muet" style="font-size:var(--t-petit)">Un rachat remet ton tapis à 1 000 — tout le monde le voit, et il se compte. ${moi.rachats ? `Tu en es à ${moi.rachats}.` : "Ce serait le premier."}</p>
    <div class="rang-btn" style="justify-content:center;margin-top:12px"><button class="btn" id="rsRachatOui">Reprendre 1 000 jetons</button></div>`);
  $("rsRachatOui").onclick = () => { $("modale").hidden = true; rsAgir("rachat"); son("jetons"); };
}
function rsCoup(a) { if (!RS.etat || !T.toi) return; boutons({}); rsAgir(a); }
/* L'assurance : la bulle du croupier, la réponse part chez l'hôte. Le coach note
   la décision contre le seuil de la table, comme en solo. */
function rsAssurance(e) {
  const boite = $("boiteAssurance"), moi = T.toi, k = rsMonSiege();
  const st = k >= 0 ? e.sieges[k] : null;
  const attend = e.phase === "assurance" && moi && moi.mains.length && st && st.assurance === undefined;
  if (!attend) { if (RS.bulleAssurance) { boite.innerHTML = ""; RS.bulleAssurance = false; } return; }
  if (RS.bulleAssurance) return;
  RS.bulleAssurance = true;
  const h = moi.mains[0], b = document.createElement("div"); b.className = "bulle";
  b.innerHTML = `<div class="de">Croupier</div><div class="q">Le croupier montre un as. Assurance ? (${fmtJ(h.bet / 2)})</div>
    <div class="opts"><button data-o="1"${moi.tapis < h.bet / 2 ? " disabled" : ""}>Oui</button><button data-o="0">Non</button></div>`;
  b.querySelectorAll("button").forEach(bt => bt.onclick = () => {
    const prise = bt.dataset.o === "1"; boite.innerHTML = ""; RS.bulleAssurance = false;
    if (sys().equilibre) {
      const seuil = donneesTable().assurance, tc = CT.compteVrai(e.rc, e.sabot.restantes / 52);
      const devrait = seuil !== null && tc >= seuil, bon = prise === devrait;
      DB.strat.assurance[bon ? 0 : 1]++; garder(); son(bon ? "ok" : "ko");
      bandeau(`${bon ? "✓" : "✗"} compte vrai ${fr1(tc)} · ${devrait ? "l'assurance est rentable dès " + sgn(seuil) : "pas d'assurance sous " + sgn(seuil)}`, 3400);
    }
    rsAgir("assurance", prise);
  });
  boite.appendChild(b); son("alerte");
}

/* ── Les fiches : la table, le journal, le reçu ────────────────────────── */
const rsPanneauVisible = () => RS.panneauOuvert && !$("modale").hidden;
function rsPanneau() {
  const e = RS.etat, hote = rsHote(), pairs = RS.salle ? [...RS.salle.pairs.values()] : [];
  const siegeDe = id => e ? e.sieges.findIndex(st => st && st.id === id) : -1;
  const nomHote = e && e.hote ? ((RS.salle && RS.salle.pairs.get(e.hote)) || {}).nom || "l'hôte" : "l'hôte";
  const lien = location.origin + location.pathname + "#table=" + RS.code;
  ouvrirModale(`<span class="grave">À plusieurs</span><h2 style="margin:4px 0 8px">${echap(tableCourante().nom)} · ${echap(tableCourante().lieu)}</h2>
    <p class="codesalon">${TR.formaterCode(RS.code)}</p>
    <div class="rang-btn" style="margin-top:10px"><button class="btn creux" id="rsCopier">Copier le lien</button><button class="btn creux" id="rsQuitter">Quitter la table</button></div>
    <span class="grave" style="display:block;margin-top:14px">À cette table</span>
    <div class="pairs">${pairs.sort((a, b) => a.id.localeCompare(b.id)).map(p => { const k = siegeDe(p.id);
      return `<span class="pair ${p.id === RS.moi ? "moi" : ""} ${e && p.id === e.hote ? "croupier" : ""}"><span class="point" style="${p.couleur ? "background:" + echap(p.couleur) : ""}"></span>${echap(p.nom)}${e && p.id === e.hote ? " · tient le sabot" : ""}${p.id === RS.moi ? " · toi" : ""}${k >= 0 ? " · siège " + (k + 1) : " · debout"}</span>`; }).join("")}</div>
    ${hote ? `<label class="ch ligne" style="margin-top:14px"><input type="checkbox" id="rsBots"${e && e.bots ? " checked" : ""}> Compléter les sièges vides avec des bots</label>
      <p class="muet" style="font-size:var(--t-fin)">Tu tiens le sabot : tu distribues, tu clos les mises (« Distribuer »). Si tu fermes l'onglet, le plus ancien des autres reprend la main avec un sabot neuf.</p>`
      : `<p class="muet" style="font-size:var(--t-fin);margin-top:12px">${echap(nomHote)} tient le sabot et distribue. Les sièges vides restent vides, sauf si l'hôte les complète avec des bots.</p>`}
    <p class="muet" style="font-size:var(--t-fin)">Relié par ${echap(RS.api ? RS.api.nom : "—")}. Les messages passent en clair par un courtier public.</p>`);
  RS.panneauOuvert = true;
  const fermer = $("modaleFermer").onclick; $("modaleFermer").onclick = () => { RS.panneauOuvert = false; fermer(); };
  $("rsCopier").onclick = () => { navigator.clipboard && navigator.clipboard.writeText(lien).then(() => bandeau("Lien copié : envoie-le à tes amis."), () => bandeau("Code : " + TR.formaterCode(RS.code))); };
  $("rsQuitter").onclick = () => { RS.panneauOuvert = false; $("modale").hidden = true; quitterTable(); };
  if ($("rsBots")) $("rsBots").onchange = () => rsAgir("bots", $("rsBots").checked);
}
$("modale").addEventListener("click", ev => { if (ev.target === $("modale")) RS.panneauOuvert = false; });
function rsJournal() {
  const e = RS.etat, j = ((e && e.journal) || []).slice().reverse();
  const ligne = (m, s) => `<tr><td class="n">${m.manche}</td><td>${echap(s.nom)}${s.id === RS.moi ? " <span class=\"muet\">· toi</span>" : ""}</td>
    <td class="n">${fmtJ(s.mains.reduce((a, h) => a + h.mise, 0))}</td><td>${s.mains.map(h => echap(h.cartes.join(" "))).join("<br>")}</td>
    <td>${s.mains.map(h => h.issue).join(" · ")}</td><td class="n" style="color:${s.net > 0 ? "var(--jade)" : s.net < 0 ? "var(--cinabre)" : "inherit"}">${s.net > 0 ? "+" : ""}${fmtJ(s.net)}</td><td class="n">${fmtJ(s.tapis)}</td></tr>`;
  ouvrirModale(`<h2>Journal des manches</h2><p class="muet" style="font-size:var(--t-petit)">Ce que l'hôte a diffusé, manche par manche : les mises, les cartes, l'issue, le tapis. Le même journal chez tout le monde.</p>` +
    (j.length ? `<div class="defile" style="max-height:52svh;overflow:auto"><table class="classement"><tr><th>Manche</th><th>Joueur</th><th>Mise</th><th>Cartes</th><th>Issue</th><th>Net</th><th>Tapis</th></tr>` +
      j.map(m => `<tr class="croupier-ligne"><td class="n">${m.manche}</td><td class="muet">Croupier</td><td></td><td>${echap(m.croupier.join(" "))}</td><td>${m.total > 21 ? "saute à " + m.total : m.total}</td><td></td><td class="muet" style="font-size:var(--t-micro)">${echap(m.empreinte.slice(0, 10))}…</td></tr>` + m.sieges.map(s => ligne(m, s)).join("")).join("") + `</table></div>`
      : `<p class="muet">Aucune manche jouée pour l'instant.</p>`));
}
function rsRecu() {
  const e = RS.etat, sabots = ((e && e.sabot && e.sabot.sabots) || []).slice().reverse();
  ouvrirModale(`<h2>Le reçu du sabot</h2>
    <p class="muet" style="font-size:var(--t-petit);text-align:left">L'hôte publie l'empreinte de la graine avant la première carte. Quand le sabot est fini, il révèle la graine : n'importe qui à la table peut alors rejouer le mélange et vérifier qu'il n'a pas été choisi après coup.</p>
    ${sabots.length ? sabots.map((s, i) => `<dl class="recu" style="margin-top:10px;text-align:left">
      <div class="sceau ${s.graine ? "revele" : ""}"><span class="rond"></span>${s.graine ? "Révélé — n'importe qui peut refaire ce mélange" : "Scellé — l'ordre des cartes est fixé et seul l'hôte le connaît"}</div>
      <dt>Sabot</dt><dd>depuis la manche ${s.manche} · ${e.jeux} jeux${i === 0 ? ` · ${e.sabot.restantes} cartes restantes` : ""}</dd>
      <dt>Empreinte publiée avant la donne</dt><dd>${echap(s.empreinte)}</dd>
      <dt>Graine</dt><dd>${s.graine ? echap(s.graine) : "révélée quand ce sabot sera fini"}</dd>
      ${s.graine ? `<div class="rang-btn" style="margin-top:8px;justify-content:flex-start"><button class="btn creux mini" data-verif="${i}">Vérifier ce sabot</button></div><p class="muet" id="rsVerif${i}" style="font-size:var(--t-petit);font-family:Archivo,sans-serif"></p>` : ""}
    </dl>`).join("") : `<p class="muet">Pas encore de sabot : l'hôte le scelle à l'ouverture des mises.</p>`}`);
  $("modaleBoite").querySelectorAll("[data-verif]").forEach(b => b.onclick = async () => {
    const s = sabots[+b.dataset.verif], graine = SH.unhex(s.graine);
    const recalc = await SH.shuffle(sabotNeuf(e.jeux), graine), meme = (await SH.commit(graine)) === s.empreinte;
    $("rsVerif" + b.dataset.verif).innerHTML = meme
      ? `✓ L'empreinte publiée correspond à cette graine, et le mélange se rejoue à l'identique. Première carte (brûlée) : <b>${recalc[recalc.length - 1].r}${recalc[recalc.length - 1].suit}</b>.`
      : `✗ L'empreinte ne correspond pas. Quelque chose ne va pas.`;
    son(meme ? "ok" : "ko");
  });
}

/* ── Les branchements : on ENVELOPPE, on ne réécrit pas ───────────────── */
const rsSolo = {};
["bDonne", "bTire", "bReste", "bDouble", "bSepare", "bAbandon", "bNouveauSabot", "bRecu", "bRetirer", "bRachat"].forEach(id => { rsSolo[id] = $(id).onclick; });
$("bDonne").onclick = ev => T.reseau ? rsAgir("clore") : rsSolo.bDonne(ev);
$("bTire").onclick = ev => T.reseau ? rsCoup("tirer") : rsSolo.bTire(ev);
$("bReste").onclick = ev => T.reseau ? rsCoup("rester") : rsSolo.bReste(ev);
$("bDouble").onclick = ev => T.reseau ? rsCoup("doubler") : rsSolo.bDouble(ev);
$("bSepare").onclick = ev => T.reseau ? rsCoup("separer") : rsSolo.bSepare(ev);
$("bAbandon").onclick = ev => T.reseau ? rsCoup("abandon") : rsSolo.bAbandon(ev);
$("bNouveauSabot").onclick = ev => T.reseau ? rsJournal() : rsSolo.bNouveauSabot(ev);
$("bRecu").onclick = ev => T.reseau ? rsRecu() : rsSolo.bRecu(ev);
$("bRetirer").onclick = ev => T.reseau ? rsRetirer() : rsSolo.bRetirer(ev);
$("bRachat").onclick = ev => T.reseau ? rsRachat() : rsSolo.bRachat(ev);
$("bReseau").onclick = () => rsPanneau();
// Le rack : en capture, AVANT le bouton de jetons.js — en réseau le jeton part vers l'hôte, pas vers DB.tapis.
$("rjJetons").addEventListener("click", ev => {
  if (!T.reseau) return; const b = ev.target.closest("button"); if (!b || b.disabled) return;
  ev.stopPropagation(); ev.preventDefault(); rsPoser(+b.dataset.v);
}, true);
// Changer de table dans le salon, c'est quitter celle-ci : on quitte, puis le clic suit son cours.
$("salon").addEventListener("click", ev => {
  if (!T.reseau) return; const b = ev.target.closest("[data-asseoir]"); if (!b) return;
  ev.stopPropagation(); ev.preventDefault(); quitterTable(); b.click();
}, true);
// nouveauSabot() est appelé par le changement de système de comptage (socle.js) : en
// réseau, le sabot est celui de l'hôte — on redessine l'état, on ne remélange rien.
// Une déclaration de fonction est un lien réassignable : c'est ce qu'on fait ici, une fois.
const nouveauSabotSolo = nouveauSabot;
nouveauSabot = function (o) { if (T.reseau) { if (RS.etat) { RS.prec = null; rendreReseau(RS.etat); } return Promise.resolve(); } return nouveauSabotSolo(o); };
// Un lien reçu : #table=CODE rejoint la table directement.
if (/^#table=/.test(location.hash)) {
  const c = TR.normaliserCode(location.hash.slice(7));
  if (TR.codeValide(c)) { MP.mode = "table"; rendreModeMP(); aller("ensemble"); setTimeout(() => ouvrirTable(c, false), 300); }
}
