/* ══════════════════════ LA TABLE ══════════════════════ */
const T = { sabot: [], graine: null, empreinte: "", coupe: 0, rc: 0, vues: 0, mains: 0, defausse: 0,
  croupier: [], sieges: [], occupe: false, enJeu: false, toi: null, actif: null, revele: false, solde: 0 };
const NOMS = ["Marc", "Sonia", "Karim", "Léa", "Paul", "Nadia"];
const vitesse = () => DB.cadence;
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
  // Sur téléphone les sièges défilent horizontalement : sans ce recentrage, le
  // siège qui joue peut être hors écran au moment précis où c'est son tour.
  const vedette = el.querySelector(".siege.actif") || el.querySelector(".siege.toi");
  if (vedette && el.scrollWidth > el.clientWidth + 4) vedette.scrollIntoView({
    inline: "center", block: "nearest",
    behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth" });
}
function rafraichirBarre() {
  const t = tableCourante();
  $("sabot").textContent = T.sabot.length;
  $("defausseN").textContent = T.defausse; $("defausse").classList.toggle("pleine", T.defausse > 0);
  const jeuxRestants = T.sabot.length / 52;
  const visible = !!T.montre;
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
// Un seul bouton de 38 px à la place de deux cases de 13 px, inutilisables au doigt.
$("bMontrer").onclick = () => {
  T.montre = !T.montre;
  $("bMontrer").setAttribute("aria-pressed", T.montre ? "true" : "false");
  $("bMontrer").textContent = T.montre ? "Masquer le compte" : "Montrer le compte";
  rafraichirBarre();
};
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
  if (DB.conseil) {
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
// Les réglages d'installation — cadence, aide — se règlent une fois et n'ont
// rien à faire sur le feutre à côté des coups qu'on joue à chaque main.
$("bReglagesTable").onclick = () => {
  ouvrirModale(`<h2>Réglages de la table</h2>
    <div class="demande" style="flex-direction:column;align-items:stretch;text-align:left">
      <label class="ch"><span class="grave">Cadence du croupier</span>
        <input type="range" id="rgCadence" min="120" max="1400" step="40" value="${DB.cadence}">
        <span class="muet" id="rgCadenceL">${fr1(DB.cadence / 1000)} s par carte</span></label>
      <label class="ch ligne"><input type="checkbox" id="rgConseil"${DB.conseil ? " checked" : ""}>
        Afficher la stratégie de base pendant mon tour</label>
    </div>`);
  $("rgCadence").oninput = () => {
    DB.cadence = +$("rgCadence").value; garder();
    $("rgCadenceL").textContent = fr1(DB.cadence / 1000) + " s par carte";
    $("plateau").style.setProperty("--intervalle", vitesse() + "ms");
  };
  $("rgConseil").onchange = () => {
    DB.conseil = $("rgConseil").checked; garder();
    if (T.actif && !T.occupe && T.toi === T.sieges[T.actif.siege]) tonTour();
  };
};
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
/* ── Le reçu du sabot : l'empreinte avant, la graine après ───────────────
   Il vivait dans un <details> sous la table. Le poste n'a plus de « sous » :
   il devient une fiche qu'on ouvre, ce qui est de toute façon son usage —
   on la lit une fois, quand on veut vérifier. */
function recuHtml() {
  const t = tableCourante(), scelle = !T.revele;
  return `<dl class="recu">
    <div class="sceau ${scelle ? "" : "revele"}"><span class="rond"></span>${scelle
      ? "Scellé — l'ordre des cartes est fixé et personne ne le connaît"
      : "Révélé — n'importe qui peut refaire ce mélange"}</div>
    <dt>Table</dt><dd>${echap(t.nom)} · ${t.jeux} jeux · ${T.sabot.length} cartes restantes</dd>
    <dt>Empreinte de la graine, publiée avant la donne</dt><dd>${T.empreinte || "—"}</dd>
    <dt>Graine</dt><dd>${T.revele ? SH.hex(T.graine) : "révélée à la fin du sabot"}</dd></dl>`;
}
// Le reçu peut être ouvert pendant qu'un sabot se termine : on le rafraîchit
// s'il est à l'écran, on ne le fabrique pas s'il n'y est pas.
function rendreRecu() { const e = $("recu"); if (e) e.outerHTML = recuHtml(); }

function verificateurTexte() {
  return `// Colle ceci dans la console d'un navigateur pour refaire le mélange toi-même.
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
}

$("bRecu").onclick = () => {
  ouvrirModale(`<h2>Le reçu du sabot</h2>
    <p class="muet" style="font-size:var(--t-petit);text-align:left">Avant de distribuer, l'application publie l'empreinte d'une graine. À la fin du sabot, elle révèle la graine. N'importe qui peut alors recalculer l'ordre exact des cartes et vérifier qu'il n'a pas été choisi après coup.</p>
    ${recuHtml()}
    <div class="rang-btn" style="margin-top:10px;justify-content:center">
      <button class="btn creux mini" id="bVerifier">Vérifier ce sabot</button>
      <button class="btn creux mini" id="bCopierVerif">Copier le vérificateur</button>
    </div>
    <p class="muet" id="verifResultat" style="font-size:var(--t-petit);margin-top:8px"></p>`);
  $("bVerifier").onclick = async () => {
    if (!T.revele) { T.revele = true; rendreRecu(); }
    const recalc = await SH.shuffle(sabotNeuf(tableCourante().jeux), T.graine);
    const meme = (await SH.commit(T.graine)) === T.empreinte;
    $("verifResultat").innerHTML = meme
      ? `✓ L'empreinte publiée correspond bien à cette graine, et le mélange se rejoue à l'identique. Première carte du sabot : <b>${recalc[recalc.length - 1].r}${recalc[recalc.length - 1].suit}</b>.`
      : `✗ L'empreinte ne correspond pas. Quelque chose ne va pas.`;
    son(meme ? "ok" : "ko");
  };
  $("bCopierVerif").onclick = () => {
    const code = verificateurTexte();
    navigator.clipboard && navigator.clipboard.writeText(code).then(
      () => bandeau("Vérificateur copié : colle-le dans la console d'un navigateur."),
      () => ouvrirModale(`<h2>Vérificateur</h2><div class="recu" style="text-align:left;white-space:pre-wrap;max-height:50svh;overflow:auto">${echap(code)}</div>`));
  };
};
