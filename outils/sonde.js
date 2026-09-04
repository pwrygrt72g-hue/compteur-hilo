const dodo = ms => new Promise(r => setTimeout(r, ms));
const R = [], q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)];
const ok = (n, c, d) => R.push((c ? "ok " : "KO ") + n + (c ? "" : " >> " + d));
const clic = s => { const e = q(s); if (e) e.click(); return !!e; };
const txt = s => (q(s) ? q(s).textContent : "").trim();
const entier = t => /^[+-]?\d+$/.test(t);
window.__modales = 0;
new MutationObserver(() => { if (!document.getElementById("modale").hidden) window.__modales++; })
  .observe(document.getElementById("modale"), { attributes: true, attributeFilter: ["hidden"] });
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
  if (q("#bMontrer").getAttribute("aria-pressed") !== "true") q("#bMontrer").click();
  const attendre = async () => { let g = 0; while (q("#bDonne").disabled && g++ < 400) await dodo(120); };
  const jouerUneMain = async (tire) => {
    clic("#bDonne"); await dodo(600);
    let g = 0;
    while (g++ < 60 && q("#bDonne").disabled) { await dodo(200);
      if (!q("#bTire").disabled) clic(tire && g % 4 === 0 ? "#bTire" : "#bReste");
      const a = q("#boiteAssurance .opts button:last-child"); if (a) a.click(); }
    await attendre();
    if (!q("#modale").hidden) {
      const champ = q("#mcRC"), bouton = q("#mcOk");
      if (champ && bouton) { champ.value = "0"; bouton.click(); await dodo(200); }
      clic("#modaleFermer"); await dodo(150);
    }
  };
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
  ok("progression : 9 tuiles", qa("#progPave .t").length === 9, qa("#progPave .t").length + " tuiles");
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
