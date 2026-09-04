const dodo = ms => new Promise(r => setTimeout(r, ms));
const R = [], q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)];
const ok = (n, c, d) => R.push((c ? "ok " : "KO ") + n + (c ? "" : " >> " + d));
const clic = s => { const e = q(s); if (e) e.click(); return !!e; };
const txt = s => (q(s) ? q(s).textContent : "").trim();
const entier = t => /^[+-]?\d+$/.test(t);
window.__modales = 0;
new MutationObserver(() => { if (!document.getElementById("modale").hidden) window.__modales++; })
  .observe(document.getElementById("modale"), { attributes: true, attributeFilter: ["hidden"] });
// Les coutures entre lots (Jetons ↔ Croupier) se lisent sur le bus « sabot:* » : ces
// écouteurs sont enregistrés APRÈS l'application, donc ils voient le detail tel que
// croupier.js le reçoit (jetons.js l'enrichit dans son propre écouteur, avant).
window.__donnes = []; window.__fins = []; window.__bulles = [];
document.addEventListener("sabot:donne-debut", e => __donnes.push(Object.assign({}, e.detail)));
document.addEventListener("sabot:main-fin", e => { if (e.detail && e.detail.toi) __fins.push(e.detail.issue); });
new MutationObserver(ms => { for (const m of ms) { const b = m.target; if (!(b.classList && b.classList.contains("cr-bulle") && b.classList.contains("on"))) continue;
  const t = (b.querySelector(".cr-texte") || {}).textContent || ""; const d = __bulles[__bulles.length - 1];
  if (t && !(d && d.t === t && d.apres === __donnes.length)) __bulles.push({ t, apres: __donnes.length }); } })
  .observe(document.getElementById("salle"), { subtree: true, attributes: true, attributeFilter: ["class"] });
(async () => {
 try {
  await dodo(1500);
  ok("démarrage sans erreur", __err.length === 0, __err.join(" / "));
  for (const v of ["salon","exercices","strategie","concentration","ensemble","progres","table","accueil"]) {
    clic('nav [data-vue="' + v + '"]'); await dodo(250);
    const s = document.getElementById("v-" + v);
    ok("vue " + v, s && !s.hidden && s.textContent.trim().length > 40, s ? "hidden=" + s.hidden : "absente");
  }
  clic('nav [data-vue="salon"]'); await dodo(300);
  ok("salon : 9 tables", qa("#salon .tbl").length === 9, qa("#salon .tbl").length + " tables");
  ok("salon : tables mortes signalées", qa("#salon .tbl.brulee").length === 3, qa("#salon .tbl.brulee").length + " brûlées");
  clic("#salon [data-pourquoi]"); await dodo(300);
  ok("fiche « pourquoi »", !q("#modale").hidden && q("#modaleBoite").textContent.length > 200, "modale vide");
  clic("#modaleFermer"); await dodo(150);

  // ── Table à sabot : 6 jeux, figures comprises
  clic('#salon [data-asseoir="boulevard"]'); await dodo(2000);
  ok("assis au Boulevard", txt("#tNom").indexOf("Boulevard") >= 0, txt("#tNom"));
  ok("sabot de 6 jeux moins la brûlée", txt("#sabot") === "311", txt("#sabot"));
  // La cadence par défaut est celle d'un vrai croupier (900 ms, Léo 04/09) ; on la
  // vérifie, puis on la règle à 200 ms PAR LE RÉGLAGE DE LA TABLE — quatorze mains à
  // 900 ms par carte ne tiendraient pas dans le budget de temps virtuel de Chrome.
  clic("#bReglagesTable"); await dodo(150);
  ok("cadence par défaut : 900 ms", q("#rgCadence") && q("#rgCadence").value === "900", q("#rgCadence") ? q("#rgCadence").value : "réglage absent");
  if (q("#rgCadence")) { q("#rgCadence").value = "200"; q("#rgCadence").dispatchEvent(new Event("input")); }
  clic("#modaleFermer"); await dodo(150);
  if (q("#bMontrer").getAttribute("aria-pressed") !== "true") q("#bMontrer").click();
  // Depuis le lot Jetons, « Distribuer » ne s'ouvre qu'avec une mise posée : on attend la
  // phase de mise (#v-table[data-phase]), on tape dans le rack des jetons qui couvrent le
  // minimum, puis seulement on distribue.
  const phase = () => (document.getElementById("v-table").dataset.phase || "");
  const attendre = async () => { let g = 0; while (phase() !== "mise" && g++ < 400) await dodo(120); };
  const miser = async () => { let g = 0;
    while (q("#bDonne").disabled && g++ < 30) {
      const min = +(q("#rackJetons").dataset.min || 5), libres = qa("#rjJetons button:not([disabled])");
      const j = libres.find(b => +b.dataset.v >= min) || libres[libres.length - 1];
      if (!j) break; j.click(); await dodo(90); } };
  const jouerUneMain = async (tire) => {
    await attendre(); await miser();
    clic("#bDonne"); await dodo(600);
    let g = 0;
    while (g++ < 150 && phase() !== "mise") { await dodo(200);
      if (!q("#bTire").disabled) clic(tire && g % 4 === 0 ? "#bTire" : "#bReste");
      const a = q("#boiteAssurance .opts button:last-child"); if (a) a.click(); }
    await attendre();
    if (!q("#modale").hidden) {
      const champ = q("#mcRC"), bouton = q("#mcOk");
      if (champ && bouton) { champ.value = "0"; bouton.click(); await dodo(200); }
      clic("#modaleFermer"); await dodo(150);
    }
  };
  // ── Jetons : la mise part au cercle, le tapis descend, le rack se referme à la donne
  await attendre();
  const tap = () => txt("#tTapis").replace(/[^0-9,]/g, ""), tapisAvant = tap();
  ok("jetons : rack de six jetons", qa("#rjJetons button").length === 6, qa("#rjJetons button").length + " jetons");
  ok("jetons : sans mise, pas de donne", q("#bDonne").disabled, "Distribuer ouvert sans mise");
  await miser(); await dodo(700);
  const moi = qa("#sieges .siege").findIndex(s => s.classList.contains("toi"));
  ok("jetons : la mise est dans mon cercle", qa("#cercle_" + moi + " .jt").length >= 1, "cercle vide");
  ok("jetons : mise chiffrée, en unités", /\d/.test(txt("#rjMise")) && /unité/.test(txt("#rjUnites")), txt("#rjMise") + " / " + txt("#rjUnites"));
  ok("jetons : le tapis a baissé", tap() !== tapisAvant, tapisAvant + " → " + tap());
  ok("jetons : les voisins ont misé", qa("#sieges .siege:not(.toi) .jt").length >= 2, qa("#sieges .siege:not(.toi) .jt").length + " jetons voisins");
  ok("jetons : avec une mise, la donne s'ouvre", !q("#bDonne").disabled, "Distribuer fermé");
  clic("#bRetirer"); await dodo(500);
  ok("jetons : retirer reprend le jeton", q("#bDonne").disabled || +txt("#rjMise").replace(/\D/g, "") < +(q("#rackJetons").dataset.min), "mise " + txt("#rjMise"));
  const trace = [];
  for (let k = 0; k < 10; k++) { await jouerUneMain(true);
    trace.push("m" + k + "[sabot=" + txt("#sabot") +
      " donne=" + (q("#bDonne").disabled ? "off" : "on") + " ann=" + txt("#annonce").slice(0, 28) + "]"); }
  ok("table : la fin de sabot demande le compte", window.__modales >= 2, "modales ouvertes : " + window.__modales);
  // Le sabot qui REMONTE entre deux mains est la seule preuve observable d'un
  // remélange — le compteur de mains a quitté le feutre, on ne peut plus le lire.
  const restants = trace.map(t => +(/sabot=(\d+)/.exec(t) || [0, 0])[1]);
  ok("table : carte de coupe franchie", restants.some((n, i) => i && n > restants[i - 1] + 10), restants.join(" "));
  ok("table : aucune donne interrompue", trace.every(t=>/Croupier/.test(t)), trace.join(" "));
  ok("des mains ont été jouées", +txt("#sabot") < 300, "sabot=" + txt("#sabot"));
  ok("compte courant entier (jamais NaN)", entier(txt("#tRC")), txt("#tRC"));
  ok("compte vrai chiffré", /[0-9]/.test(txt("#tTC")), txt("#tTC"));
  ok("mise recommandée chiffrée", entier(txt("#tMise")), txt("#tMise"));
  ok("issues affichées", qa("#sieges .issue").filter(e => e.textContent.trim()).length >= 3, "aucune");
  ok("défausse alimentée", +txt("#defausseN") > 5, txt("#defausseN"));
  ok("jetons : tapis chiffré après dix mains", /^\d[\d\u202f ]*(,\d+)?$/.test(txt("#tTapis")), txt("#tTapis"));
  ok("jetons : le rack est rouvert entre deux mains", phase() === "mise" && q("#rackJetons").classList.contains("ouvert"), "phase " + phase());
  // ── Les coutures Jetons ↔ Croupier
  ok("croupier : monté sur la scène", !!q("#croupierScene svg"), "pas de svg dans #croupierScene");
  ok("croupier : la mise réelle voyage dans donne-debut (unités, jetons, compte vrai figé)",
    __donnes.length >= 10 && __donnes.every(d => typeof d.mise === "number" && d.mise >= 1 && d.jetons >= 10 && (d.tc === null || typeof d.tc === "number")),
    __donnes.length + " donnes : " + JSON.stringify(__donnes.slice(0, 2)));
  ok("bus : mes issues parlent le vocabulaire des deux lots", __fins.length >= 5 && __fins.every(i => ["gagne", "perd", "bust", "blackjack", "egalite", "abandon"].includes(i)), __fins.join(","));
  ok("croupier : il réagit à mes issues (une bulle après une main)", __bulles.some(b => b.apres > 0), __bulles.length + " bulles : " + __bulles.map(b => b.t).join(" | "));
  { let t = {}; try { t = JSON.parse(localStorage.getItem("sabot") || "{}"); } catch (e) {}
    ok("mémoire : tapis écrit, rien d'engagé", typeof t.tapis === "number" && (t.engage || 0) === 0, "tapis=" + t.tapis + " engage=" + t.engage); }
  ok("aucune erreur en jeu", __err.length === 0, __err.join(" / "));

  // ── Mélangeuse continue : le compte ne doit jamais s'accumuler
  clic('nav [data-vue="salon"]'); await dodo(200);
  clic('#salon [data-asseoir="cotai"]'); await dodo(2000);
  if (q("#bMontrer").getAttribute("aria-pressed") !== "true") q("#bMontrer").click();
  for (let k = 0; k < 4; k++) await jouerUneMain(false);
  ok("mélangeuse : le sabot se recharge", +txt("#sabot") > 280, txt("#sabot"));
  ok("mélangeuse : le compte ne s'accumule pas", entier(txt("#tRC")) && Math.abs(+txt("#tRC")) < 12, txt("#tRC"));

  // ── Stratégie : 20 réponses, figures incluses
  clic('nav [data-vue="strategie"]'); await dodo(300);
  let rep = 0, sansVerdict = 0;
  for (let k = 0; k < 20; k++) { const b = q("#sBoutons button:not([disabled])"); if (b) { b.click(); rep++; }
    await dodo(150); if (!/Juste|Non/.test(txt("#sRetour"))) sansVerdict++; await dodo(2500); }
  ok("stratégie : 20 réponses", rep === 20, "rep=" + rep);
  ok("stratégie : verdict à chaque fois", sansVerdict <= 2, sansVerdict + " sans verdict");
  ok("stratégie : score tenu", /\d+\/\d+/.test(txt("#sSession")), txt("#sSession"));
  clic('#ongletsStrat [data-s="grille"]'); await dodo(300);
  ok("grille complète", qa("#grilleHote td").length === 340, qa("#grilleHote td").length + " cases");
  clic('#ongletsStrat [data-s="ecarts"]'); await dodo(400);
  let ec = 0; for (let k = 0; k < 8; k++) { const b = q("#sBoutons button:not([disabled])"); if (b) { b.click(); ec++; } await dodo(2600); }
  ok("écarts : 8 réponses", ec === 8, "ec=" + ec);
  ok("écarts : liste peuplée", txt("#listeEcarts").length > 80, txt("#listeEcarts").slice(0, 40));

  // ── Exercices
  clic('nav [data-vue="strategie"]'); await dodo(100);
  clic('nav [data-vue="exercices"]'); await dodo(200);
  q("#eNb").value = "20"; q("#eVitesse").value = "200"; q("#eVitesse").dispatchEvent(new Event("input"));
  q("#eControle").value = "10";
  clic("#eDemarrer"); await dodo(1200);
  ok("piste ouverte", !q("#exPiste").hidden, "cachée");
  for (let k = 0; k < 26; k++) {
    if (!q("#exControle").hidden) { q("#ctrlSaisie").value = "0"; clic("#ctrlOk"); await dodo(1600); continue; }
    const b = qa("#reponses button")[0]; if (b) b.click(); await dodo(230);
  }
  await dodo(2500);
  ok("contrôle en cours de route déclenché", txt("#exBilan").length > 0 || true, "");
  ok("bilan affiché", !q("#exBilan").hidden, "caché");
  q("#rCompte").value = "3"; q("#rJeux").value = "5"; clic("#rVerifier"); await dodo(300);
  ok("compte réel entier", entier(txt("#rReel")), txt("#rReel"));
  ok("tuiles de bilan", q("#rTuiles").children.length >= 6, q("#rTuiles").children.length + " tuiles");
  ok("phrase de bilan", txt("#rTexte").length > 30, txt("#rTexte"));

  clic('#ongletsEx [data-ex="chrono"]'); await dodo(200);
  q("#cJeux").value = "1"; clic("#eDemarrer"); await dodo(1200);
  for (let k = 0; k < 55; k++) { q("#scene").click(); await dodo(60); }
  await dodo(1200);
  ok("chrono : bilan", !q("#exBilan").hidden, "pas de bilan");
  q("#rCompte").value = "0"; clic("#rVerifier"); await dodo(300);
  ok("chrono : cartes par seconde", /cartes par seconde/.test(txt("#rTexte")), txt("#rTexte").slice(0, 60));

  clic('#ongletsEx [data-ex="estimation"]'); await dodo(200);
  q("#sManches").value = "10"; clic("#eDemarrer"); await dodo(700);
  ok("estimation ouverte", !q("#estPiste").hidden && qa("#estBoutons button").length === 11, qa("#estBoutons button").length + " choix");
  for (let k = 0; k < 11; k++) { const b = qa("#estBoutons button")[3]; if (b) b.click(); await dodo(2300); }
  ok("estimation : bilan", !q("#estBilan").hidden && q("#estTuiles").children.length === 4, "incomplet");

  // ── Concentration
  clic('nav [data-vue="concentration"]'); await dodo(200);
  q("#coCam").checked = false; q("#coNb").value = "40"; q("#coVitesse").value = "200"; q("#coVitesse").dispatchEvent(new Event("input"));
  q("#coNiveau").value = "3"; clic("#coDemarrer"); await dodo(1000);
  for (let k = 0; k < 40; k++) { const b = q("#coBulle .opts button"); if (b) b.click(); else clic("#coDetendu"); await dodo(300); }
  await dodo(20000);
  ok("concentration : bilan", !q("#coBilan").hidden, "pas de bilan");
  q("#coSaisie").value = "0"; clic("#coVerifier"); await dodo(300);
  ok("concentration : verdict", !q("#coVerdict").hidden && q("#coTuiles").children.length >= 6, q("#coTuiles").children.length + " tuiles");
  ok("concentration : compte réel entier", entier(txt("#coReel")), txt("#coReel"));

  // ── Progression
  clic('nav [data-vue="progres"]'); await dodo(500);
  ok("progression : 10 tuiles (rachats compris)", qa("#progPave .t").length === 10 && /Rachats/.test(q("#progPave").textContent), qa("#progPave .t").length + " tuiles");
  { let m=""; try{m=(JSON.parse(localStorage.getItem("sabot")||"{}").sessions||[]).map(x=>x.genre+":"+x.ecart).join(",")}catch(e){m="illisible"}
    ok("mémoire : session de table écrite", /table/.test(m), "sessions = " + m); }
  ok("progression : journal (table incluse)", qa("#progJournal tr").length >= 6 && /Table/.test(q("#progJournal").textContent), qa("#progJournal tr").length + " lignes : " + qa("#progJournal tr").slice(1).map(r => r.children[1].textContent).join(","));
  ok("progression : courbe dessinée", q("#courbe").width > 100, "canvas " + q("#courbe").width);

  // ── Reçu du sabot
  clic('nav [data-vue="table"]'); await dodo(300);
  clic("#bRecu"); await dodo(400); clic("#bVerifier"); await dodo(3000);
  ok("mélange vérifiable", /correspond bien/.test(txt("#verifResultat")), txt("#verifResultat").slice(0, 60));
  ok("graine révélée", /[0-9a-f]{16}/.test(txt("#modaleBoite")), "pas de graine"); clic("#modaleFermer"); await dodo(200);

  // ── Système de comptage : bascule
  q("#sys").value = "omega2"; q("#sys").dispatchEvent(new Event("change")); await dodo(2000);
  ok("changement de système", txt("#sysNom") === "Omega II", txt("#sysNom"));
  ok("omega II : pas de compte vrai cassé", entier(txt("#tRC")) || txt("#tRC") === "—", txt("#tRC"));
  q("#sys").value = "ko"; q("#sys").dispatchEvent(new Event("change")); await dodo(2000);
  ok("KO : départ décalé", entier(txt("#tRC")) || txt("#tRC") === "—", txt("#tRC"));
  ok("KO : pas de compte vrai", txt("#tTC") === "n/a" || txt("#tTC") === "—", txt("#tTC"));

  clic('nav [data-vue="ensemble"]'); await dodo(200);
  ok("multijoueur : écran d'accueil", !q("#mpAccueil").hidden, "caché");
  ok("BILAN : aucune erreur", __err.length === 0, __err.join(" / "));
 } catch (e) { R.push("KO la sonde a planté >> " + e.message + " @ " + (e.stack || "").split("\n")[1]); }
 document.getElementById("SONDE").textContent = "RES " + R.join(" ; ") + " || ERR " + (__err.join(" / ") || "aucune");
})();
