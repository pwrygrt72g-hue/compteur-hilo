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
