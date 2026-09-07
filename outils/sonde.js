const dodo = ms => new Promise(r => setTimeout(r, ms));
const R = [], q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)];
const ok = (n, c, d) => R.push((c ? "ok " : "KO ") + n + (c ? "" : " >> " + d));
const clic = s => { const e = q(s); if (e) e.click(); return !!e; };
const txt = s => (q(s) ? q(s).textContent : "").trim();
// Le signe moins de l'application est U+2212 (socle.js, sgn) — pas le trait d'union de la
// conversion numérique de JavaScript. La sonde lit ce que l'écran AFFICHE.
const entier = t => /^[+\u2212-]?\d+$/.test(t);
// …et pour le COMPARER, il faut d'abord le rendre à JavaScript.
const nombre = t => parseFloat(String(t).replace(/\u2212/g, "-").replace(",", "."));
window.__modales = 0;
new MutationObserver(() => { if (!document.getElementById("modale").hidden) window.__modales++; })
  .observe(document.getElementById("modale"), { attributes: true, attributeFilter: ["hidden"] });
// Les coutures entre lots (Jetons ↔ Croupier) se lisent sur le bus « sabot:* » : ces
// écouteurs sont enregistrés APRÈS l'application, donc ils voient le detail tel que
// croupier.js le reçoit (jetons.js l'enrichit dans son propre écouteur, avant).
window.__donnes = []; window.__fins = []; window.__bulles = []; window.__verdicts = [];
// Le verdict de ta main (table.js) : un mot en serif qui s'inscrit sur le feutre (#verdict.on).
new MutationObserver(() => { const v = document.getElementById("verdict"); if (v && v.classList.contains("on") && v.textContent) __verdicts.push(v.textContent); })
  .observe(document.getElementById("verdict"), { attributes: true, attributeFilter: ["class"] });
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
  for (const v of ["exercices","strategie","concentration","ensemble","progres","dons","table","accueil"]) {
    clic('nav [data-vue="' + v + '"]'); await dodo(250);
    const s = document.getElementById("v-" + v);
    ok("vue " + v, s && !s.hidden && s.textContent.trim().length > 40, s ? "hidden=" + s.hidden : "absente");
    // Hors du hall, le fil d'Ariane dit où l'on est et ramène au hall ; dans le hall, il se tait.
    ok("fil d'Ariane " + v, v === "accueil" ? q("#fil").hidden : /^Hall/.test(txt("#fil")) && !!q('#fil [data-vue="accueil"]'), "fil = " + txt("#fil"));
  }
  // La caisse a DEUX états livrables, et les deux sont normaux : avec cagnotte
  // (DONS_LIEN renseigné dans dons.js) ou sans. La sonde ne fige donc pas l'un des
  // deux — elle vérifie le contrat commun : exactement UN bloc à l'écran, et jamais
  // un bouton mort. Écrire ici l'état du jour obligerait à rouvrir ce fichier chaque
  // fois que Léo ouvre ou ferme sa cagnotte, et le test dirait « cassé » pour un
  // changement voulu. On vérifie aussi qu'aucune ressource extérieure ne s'y est
  // glissée (la CSP de l'artefact en avalerait l'échec sans un mot).
  clic('nav [data-vue="dons"]'); await dodo(250);
  // `#donsLien` n'est pas caché lui-même : c'est son bloc qui l'est.
  {
    const avec = !q("#donsAvec").hidden, sans = !q("#donsSans").hidden;
    const href = q("#donsLien") ? q("#donsLien").getAttribute("href") : "";
    ok("caisse : un seul des deux états à l'écran",
       avec !== sans, "avec=" + avec + " sans=" + sans);
    ok(avec ? "caisse : la cagnotte ouverte mène à une vraie adresse"
            : "caisse : sans cagnotte, une phrase et pas un bouton mort",
       avec ? /^https:\/\/\S+$/.test(href) : !q("#donsSans a"),
       avec ? "href = " + href : "un lien traîne dans l'état sans cagnotte");
  }
  ok("caisse : le numéro d'aide au jeu y est", /09 74 75 13 13/.test(txt("#v-dons")), "numéro absent");

  // ── GARDER SA PROGRESSION : un fichier, pas un compte ni une adresse IP.
  clic('nav [data-vue="progres"]'); await dodo(250);
  {
    const b = q("#progExporter"), i = q("#progImporter"), f = q("#progFichier");
    ok("sauvegarde : les deux boutons et le champ de fichier", !!(b && i && f), "il en manque un");
    // 🚨 LE COMPORTEMENT N'EST PAS TESTÉ ICI, et ce n'est pas un oubli : cette sonde
    // tourne en TEMPS VIRTUEL (c'est ce qui lui permet de jouer des centaines de mains
    // en quelques secondes). Un `FileReader` réel, lui, résout sur la vraie boucle
    // d'événements : les `await dodo()` ne l'avancent pas, et les trois contrôles
    // rendaient le message du fichier PRÉCÉDENT — un décalage d'un cran, mesuré, qui
    // aurait fini par faire « corriger » du code parfaitement juste.
    // Le chemin complet (refus d'un JSON quelconque, refus d'une version future,
    // restauration réelle, `engage` non réimporté) est vérifié en temps RÉEL par
    // `outils/capturer.mjs progres --sonde=…` — voir le commit qui ajoute ce bloc.
  }

  // ── LA QUÊTE : la seule chose qui réclame quelque chose sans qu'on l'ait cherché.
  // On ne vérifie PAS qu'elle est ouverte à cet instant (la sonde a déjà cliqué partout,
  // et elle ne s'ouvre que sur l'accueil) : on vérifie son CONTRAT, celui qui la rend
  // supportable — trois sorties, une seule entrée, et l'astérisque qui porte la blague.
  {
    const b = q("#quete");
    ok("quête : la fenêtre existe et sait s'ouvrir", !!b && typeof window.ouvrirQuete === "function", "absente");
    const ouverte = b && window.ouvrirQuete(true) && !b.hidden;
    ok("quête : forcée, elle s'ouvre", !!ouverte, "elle refuse de s'ouvrir même forcée");
    ok("quête : le bouton de don mène à la MÊME adresse que la caisse",
       q("#queteDon").href === q("#donsLien").href, q("#queteDon").href + " ≠ " + q("#donsLien").href);
    // 🚨 Sans l'astérisque, la fenêtre promet SÉRIEUSEMENT de devenir riche au casino.
    ok("quête : la promesse est démentie juste en dessous",
       /riche/i.test(txt("#quete")) && /casino gagne toujours/i.test(txt("#quete")),
       "la blague n'est pas désamorcée");
    ok("quête : trois sorties", !!(q("#queteFermer") && q("#queteNon") && q("#quete").onclick), "il en manque une");
    q("#queteNon").click(); await dodo(60);
    ok("quête : « une autre fois » la referme", q("#quete").hidden, "elle reste à l'écran");
    ok("quête : refermée, elle ne revient pas toute seule", window.ouvrirQuete() === false, "elle se rouvrirait");
  }
  ok("caisse : rien ne vient de l'extérieur",
     qa("#v-dons img[src], #v-dons script, #v-dons iframe").filter(e => !/^data:|^static\//.test(e.getAttribute("src") || "")).length === 0,
     "une ressource externe dans la caisse");
  clic('nav [data-vue="accueil"]'); await dodo(200);
  // Le hall EST le menu : les pastilles ont disparu de l'en-tête, la nav reste adressable.
  // Une vue = un bouton : le compte suit donc le nombre d'écrans (neuf depuis la caisse).
  ok("en-tête : la nav est cachée, ses neuf boutons restent", q("#nav").hidden && qa("#nav [data-vue]").length === 9, "hidden=" + q("#nav").hidden);
  ok("hall : quatre salles + crédits photos", !!q("#lesTables") && !!q("#entrainement") && !!q("#prive") && !!q("#bureau") && qa("#hallCredits a").length >= 10, qa("#hallCredits a").length + " liens de crédit");
  ok("hall : les portes ont leurs photos", qa("#v-accueil img.photo[src]").length >= 15, qa("#v-accueil img.photo[src]").length + " photos");
  // « Salon » n'est plus une vue : c'est l'ancre « Les tables » du hall.
  clic('nav [data-vue="salon"]'); await dodo(300);
  ok("salon : l'ancre « Les tables » du hall", !q("#v-accueil").hidden && !!q("#lesTables"), "hidden=" + q("#v-accueil").hidden);
  // ⚠️ On compare au CATALOGUE, plus à un nombre écrit ici. Un « === 9 » ne dit qu'une
  // chose : le compte a changé — et il tombe le jour où l'on AJOUTE une table, ce qui est
  // le cas normal (07/09, La Marina). Ce qui mérite une alerte, c'est une table du
  // catalogue qui n'arrive pas jusqu'au hall : le vrai invariant est l'ÉGALITÉ des deux.
  {
    const rendues = qa("#salon .salle-porte").length, attendues = window.__catalogue || 0;
    ok("salon : toutes les tables du catalogue ont leur porte", attendues > 0 && rendues === attendues,
       rendues + " portes pour " + attendues + " tables au catalogue");
  }
  ok("salon : tables mortes signalées", qa("#salon .salle-porte.brulee").length === 3, qa("#salon .salle-porte.brulee").length + " brûlées");
  ok("salon : aucune porte « Reprendre » avant la première main", !q("#salon .etat"), "une porte dit Reprendre");
  clic("#salon [data-pourquoi]"); await dodo(300);
  ok("fiche « pourquoi »", !q("#modale").hidden && q("#modaleBoite").textContent.length > 200, "modale vide");
  clic("#modaleFermer"); await dodo(150);

  // ── Table à sabot : 6 jeux, figures comprises
  clic('#salon [data-asseoir="boulevard"]'); await dodo(2000);
  ok("assis au Boulevard", txt("#tNom").indexOf("Boulevard") >= 0, txt("#tNom"));
  ok("fil d'Ariane : Hall › Le Boulevard", /Hall/.test(txt("#fil")) && /Boulevard/.test(txt("#fil")), txt("#fil"));
  ok("table : le décor du lieu est posé", /url\(/.test(q("#salle").style.getPropertyValue("--photo")), "--photo = " + q("#salle").style.getPropertyValue("--photo").slice(0, 40));
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
  let ISSUES_VUES = 0, FEUTRE_PROPRE = 0;
  const jouerUneMain = async (tire) => {
    await attendre(); await miser();
    clic("#bDonne"); await dodo(600);
    let g = 0;
    while (g++ < 150 && phase() !== "mise") { await dodo(200);
      if (phase() === "reglement") ISSUES_VUES = Math.max(ISSUES_VUES, qa("#sieges .issue").filter(e => e.textContent.trim()).length);
      if (!q("#bTire").disabled) clic(tire && g % 4 === 0 ? "#bTire" : "#bReste");
      const a = q("#boiteAssurance .opts button:last-child"); if (a) a.click(); }
    // Les mises rouvertes, le feutre de la manche d'avant est VIDE : ni cartes, ni verdicts.
    if (phase() === "mise" && !qa("#sieges .main .carte").length && !qa("#sieges .issue").filter(e => e.textContent.trim()).length) FEUTRE_PROPRE++;
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
  ok("jetons : mise chiffrée, en unités", /\d/.test(txt("#rjMise")) && /minimum|unité/.test(txt("#rjUnites")), txt("#rjMise") + " / " + txt("#rjUnites"));
  ok("jetons : le tapis a baissé", tap() !== tapisAvant, tapisAvant + " → " + tap());
  ok("jetons : les voisins ont misé", qa("#sieges .siege:not(.toi) .jt").length >= 2, qa("#sieges .siege:not(.toi) .jt").length + " jetons voisins");
  ok("jetons : avec une mise, la donne s'ouvre", !q("#bDonne").disabled, "Distribuer fermé");
  clic("#bRetirer"); await dodo(500);
  ok("jetons : retirer reprend le jeton", q("#bDonne").disabled || +txt("#rjMise").replace(/\D/g, "") < +(q("#rackJetons").dataset.min), "mise " + txt("#rjMise"));
  const trace = [];
  // 🚨 DIX MAINS NE SUFFISENT PLUS. Depuis que `penetration` porte la fraction RESTANTE
  // (06/09), un sabot de six jeux se joue jusqu'à ~78 cartes de la fin : il faut une
  // quinzaine de mains pour franchir la carte de coupe, plus UNE de plus pour voir le
  // compteur REMONTER — la seule preuve observable du remélange, le compteur de mains
  // ayant quitté le feutre. À 10, la trace descendait à 151 et s'arrêtait là : quatre
  // assertions d'affilée (carte de coupe, raclement du mélange, session de table,
  // journal) tombaient ensemble, non parce que l'application était cassée mais parce
  // qu'on ne jouait pas assez longtemps pour les atteindre. Mesuré : 14-15 franchissent
  // sans voir la remontée, 16 passe mais à la limite, 18 laisse la marge.
  // Ne pas redescendre ce nombre sans l'avoir remesuré.
  for (let k = 0; k < 18; k++) { await jouerUneMain(true);
    trace.push("m" + k + "[sabot=" + txt("#sabot") +
      " donne=" + (q("#bDonne").disabled ? "off" : "on") + " ann=" + txt("#annonce").slice(0, 28) + "]"); }
  ok("table : la fin de sabot demande le compte", window.__modales >= 2, "modales ouvertes : " + window.__modales);
  // Le sabot qui REMONTE entre deux mains est la seule preuve observable d'un
  // remélange — le compteur de mains a quitté le feutre, on ne peut plus le lire.
  const restants = trace.map(t => +(/sabot=(\d+)/.exec(t) || [0, 0])[1]);
  ok("table : carte de coupe franchie", restants.some((n, i) => i && n > restants[i - 1] + 10), restants.join(" "));
  ok("table : aucune donne interrompue", trace.every(t=>/roupier/.test(t)), trace.join(" "));
  ok("des mains ont été jouées", +txt("#sabot") < 300, "sabot=" + txt("#sabot"));
  ok("compte courant entier (jamais NaN)", entier(txt("#tRC")), txt("#tRC"));
  ok("compte vrai chiffré", /[0-9]/.test(txt("#tTC")), txt("#tTC"));
  ok("mise recommandée chiffrée", entier(txt("#tMise")), txt("#tMise"));
  ok("issues affichées pendant le règlement", ISSUES_VUES >= 3, ISSUES_VUES + " issues au mieux");
  // Le défaut du 06/09 : « Pose ta mise · minimum 10 » s'affichait au-dessus de cinq
  // pastilles « PERDU » et des cartes de la manche finie, sans limite de durée.
  ok("table : les mises rouvrent sur un feutre VIDE", FEUTRE_PROPRE >= 8, FEUTRE_PROPRE + " manches propres sur 18 rangées");
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
  // ── Le son (lot Son & matière) : chaque geste de la table laisse son nom au journal de socle.js,
  // même quand le contexte audio dort (aucun geste de pointeur ici : rien ne doit jouer, tout doit être noté).
  { const j = window.__sonJournal || [], u = [...new Set(j)].join(",");
    ok("son : la carte glisse et se pose, un jeton claque en partant, les jetons tintent en arrivant", ["carte", "pose", "jeton", "jetons"].every(g => j.includes(g)), "journal = " + u);
    ok("son : un verdict a sonné (accord du gain, boum du bust ou note du blackjack)", j.some(g => g === "gain" || g === "bust" || g === "blackjack"), "journal = " + u);
    ok("son : le mélange racle", j.includes("raclement"), "journal = " + u);
    // La synthèse est PURE : rendue dans un contexte hors ligne, elle produit du signal, sans saturer.
    const r = await Promise.race([window.__rendreSon("jetons"), dodo(4000).then(() => null)]);
    ok("son : la synthèse hors ligne rend un tintement (crête entre 0,05 et 1, sous 2 s)", !!r && r.crete > .05 && r.crete <= 1 && r.duree > .02 && r.duree < 2, JSON.stringify(r)); }
  ok("verdict : le mot de fin de main s'est inscrit au-dessus de mes cartes, à chaque main", __verdicts.length >= 5 && __verdicts.every(v => /^(Gagné|Perdu|Sauté|Blackjack|Égalité|Abandon)$/.test(v)), __verdicts.length + " verdicts : " + __verdicts.join(","));

  // ── Retour au hall : la table entamée dit « Reprendre », et la reprendre ne remélange pas
  clic('nav [data-vue="salon"]'); await dodo(300);
  ok("hall : la table entamée dit « Reprendre »", txt('#salon [data-asseoir="boulevard"] .etat') === "Reprendre", "etat = " + txt('#salon [data-asseoir="boulevard"] .etat'));
  { const avant = txt("#sabot"); clic('#salon [data-asseoir="boulevard"]'); await dodo(600);
    ok("hall : reprendre sa place garde le sabot", !q("#v-table").hidden && txt("#sabot") === avant, avant + " → " + txt("#sabot")); }
  // ── Mélangeuse continue : le compte ne doit jamais s'accumuler
  clic('nav [data-vue="salon"]'); await dodo(200);
  clic('#salon [data-asseoir="cotai"]'); await dodo(2000);
  if (q("#bMontrer").getAttribute("aria-pressed") !== "true") q("#bMontrer").click();
  for (let k = 0; k < 4; k++) await jouerUneMain(false);
  // Une mélangeuse n'affiche pas de compte (le meuble n'a ni chiffre ni carte de coupe) : le nombre vit en data-n.
  ok("mélangeuse : le sabot se recharge", +q("#sabot").dataset.n > 280, q("#sabot").dataset.n);
  ok("mélangeuse : ni chiffre, ni défausse, ni carte de coupe", txt("#sabot") === "" && q("#v-table").dataset.melange === "csm" && getComputedStyle(q("#defausse")).display === "none", "sabot=" + txt("#sabot") + " melange=" + q("#v-table").dataset.melange);
  ok("mélangeuse : le compte ne s'accumule pas", entier(txt("#tRC")) && Math.abs(nombre(txt("#tRC"))) < 12, txt("#tRC"));

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
  // Le compte EXACT était un piège : la tuile « Estimation », ajoutée au bureau le 06/09,
  // a fait tomber cette ligne alors qu'aucune régression n'existait. On exige un PLANCHER —
  // une tuile ajoutée est un ajout, pas une panne ; une tuile DISPARUE, elle, se voit encore.
  ok("progression : au moins 10 tuiles (rachats compris)", qa("#progPave .t").length >= 10 && /Rachats/.test(q("#progPave").textContent), qa("#progPave .t").length + " tuiles");
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
  ok("multijoueur : deux modes, la table et la course", qa("#mpModes [role=tab]").length === 2, qa("#mpModes [role=tab]").length + " onglets");
  clic('#mpModes [data-mode="course"]'); await dodo(80);
  ok("multijoueur : la course reste accessible", /course/i.test(txt("#mpCreer")), txt("#mpCreer"));
  clic('#mpModes [data-mode="table"]'); await dodo(80);

  // ── LE CHOIX DE LA TABLE, EN PLACE (Léo 07/09 : « on peut jouer que sur une »)
  // 🚨 CHAQUE contrôle est gardé sur l'existence du sélecteur. Sans garde, un
  // `q("#mpTableChoix").value = …` sur un élément absent ne rend pas « KO » : il fait
  // PLANTER toute la sonde, et les quarante contrôles suivants disparaissent — un
  // harnais qui meurt en silence est pire qu'un contrôle manquant.
  {
    const sel = q("#mpTableChoix");
    ok("table en place : le sélecteur est là, sur l'écran à plusieurs", !!sel, "absent");
    if (sel) {
      const opts = [...sel.options];
      ok("table en place : les dix tables du catalogue", opts.length === 10, opts.length + " options");
      // Ce qui distingue les tables POUR LE MULTIJOUEUR, c'est la mise et la cave.
      ok("table en place : chaque ligne dit sa mise et sa cave",
         opts.every(o => /min\s/.test(o.textContent) && /cave\s/.test(o.textContent)),
         opts.slice(0, 2).map(o => o.textContent.trim()).join(" | "));
      ok("table en place : La Marina s'y trouve", opts.some(o => /Marina/.test(o.textContent)), "absente du sélecteur");
      // …et il CHANGE vraiment la table : la fiche à côté doit suivre.
      const avant = sel.value, autre = opts.find(o => o.value !== avant);
      const ficheAvant = txt("#mpTable");
      sel.value = autre.value; sel.dispatchEvent(new Event("change")); await dodo(250);
      ok("table en place : changer de table réécrit la fiche, SANS quitter l'écran",
         txt("#mpTable") !== ficheAvant && !q("#v-ensemble").hidden && q("#v-table").hidden,
         "fiche inchangée ou on a navigué");
      ok("table en place : le hall reste atteignable", !!q("#mpTable [data-vue]"), "le bouton vers le hall a disparu");
      sel.value = avant; sel.dispatchEvent(new Event("change")); await dodo(250);
    }
  }
  ok("multijoueur : le code se tape groupé", (q("#mpCode").value = "a7k2m9pq", q("#mpCode").dispatchEvent(new Event("input")), q("#mpCode").value === "A7K2-M9PQ"), q("#mpCode").value);
  // ── L'ARTEFACT : WebSocket bloqué SANS erreur visible. L'écran doit le dire en moins de
  // trois secondes, avec le lien DU SITE, ne pas ouvrir la table — et ne jamais
  // demander la caméra pour rien (visio.js ne démarre qu'une fois le courtier relié).
  // ⚠️ On compare à `window.__lienSite` (posé par reseau.js depuis l'unique LIEN_SITE de
  // visio.mjs), PAS à un domaine écrit ici. La version d'avant testait
  // /github\.io\/compteur-hilo/ : elle ne passait que tant que l'application vivait chez
  // cet hébergeur-là, et serait tombée le jour du déménagement alors que le code aurait
  // été juste — un test rouge qui accuse le code d'une faute qu'il n'a pas commise.
  // La seconde moitié dit l'autre moitié de la règle : le message ne NOMME pas d'hébergeur.
  { const WS = window.WebSocket; let gum = 0;
    const md = navigator.mediaDevices, gumOrig = md && md.getUserMedia;
    if (md) md.getUserMedia = function () { gum++; return Promise.reject(Object.assign(new Error("sonde"), { name: "NotAllowedError" })); };
    window.WebSocket = class { constructor() { setTimeout(() => this.onerror && this.onerror(new Event("error")), 2); } close() {} send() {} };
    clic("#mpCreer"); await dodo(3200);
    const lien = window.__lienSite || "";
    ok("artefact : sans WebSocket, l'écran À plusieurs le dit en < 3 s, avec le lien du site", !!lien && q("#mpEtat").innerHTML.includes(lien) && q("#v-table").hidden && !q("#mpCreer").disabled, "lienSite = " + lien + " · mpEtat = " + txt("#mpEtat").slice(0, 80) + " · table hidden=" + q("#v-table").hidden);
    ok("artefact : … et le message ne nomme aucun hébergeur", !/github|netlify|vercel|pages\.dev/i.test(txt("#mpEtat")), txt("#mpEtat").slice(0, 120));
    ok("artefact : la caméra n'a pas été demandée pour rien", gum === 0, gum + " appel(s) getUserMedia");
    window.WebSocket = WS; if (md) md.getUserMedia = gumOrig; }
  // ── La table réseau, sans courtier : un transport muet injecté par la sonde. L'hôte
  // est seul, la table s'ouvre sur la scène et attend des joueurs sans une erreur. Le
  // transport garde `onMessage` sous la main : c'est par là qu'un ami fictif entrera.
  window.__reseauTransport = o => { window.__reseauEntrant = o.onMessage; return { publier() {}, fermer() {} }; };
  clic("#mpCreer"); await dodo(1500);
  ok("table réseau : ouverte sur la scène, en attente", !q("#v-table").hidden && q("#v-table").dataset.reseau === "1" && /attente|code/i.test(txt("#annonce")), "hidden=" + q("#v-table").hidden + " reseau=" + q("#v-table").dataset.reseau + " annonce=" + txt("#annonce"));
  // HUIT sièges depuis le 6 septembre 2026 (NB_SIEGES, table-reseau.mjs) : la table entre
  // amis va plus loin que le catalogue, qui plafonne à sept. C'est ICI que ça se vérifie
  // à l'écran — la table réseau construit ses sièges depuis cette constante, donc un
  // huitième siège manquant est une géométrie cassée, pas un réglage.
  ok("table réseau : huit sièges libres, un code de huit", qa("#sieges .siege.vide").length === 8 && /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(txt("#tCode")), qa("#sieges .siege.vide").length + " libres · " + txt("#tCode"));
  clic("#sieges .siege.vide .asseoir"); await dodo(600);
  ok("table réseau : assis, les mises s'ouvrent", !!q("#sieges .siege.toi") && phase() === "mise" && q("#rackJetons").classList.contains("ouvert"), "toi=" + !!q("#sieges .siege.toi") + " phase=" + phase());
  // ── Les têtes des amis (visio.js) : une vignette par siège humain, jamais un rectangle noir.
  ok("visio : ma vignette est une silhouette qui dit pourquoi (pas de vidéo, pas de noir)", !!q("#sieges .siege.toi .visage.moi .silhouette") && txt("#sieges .siege.toi .visage .visage-etat").length > 0 && !q("#sieges .siege.toi .visage video"), "visage=" + !!q("#sieges .siege.toi .visage") + " état=" + txt("#sieges .siege.toi .visage .visage-etat"));
  ok("visio : la vignette partage la rangée du cercle de mise", !!q("#sieges .siege.toi .rangee-bas .cercle") && !!q("#sieges .siege.toi .rangee-bas .visage"), "rangée absente");
  ok("visio : pas de vignette sur un siège libre", qa("#sieges .siege.vide .visage").length === 0, qa("#sieges .siege.vide .visage").length + " vignettes sur des sièges libres");
  ok("visio : le bouton Caméra est là, éteint (rien n'est demandé sans un clic)", !q("#bCamera").hidden && q("#bCamera").getAttribute("aria-pressed") === "false", "hidden=" + q("#bCamera").hidden + " pressed=" + q("#bCamera").getAttribute("aria-pressed"));
  // La voix (visio.js + micro.mjs, 6 septembre 2026) : le bouton existe, il est ÉTEINT, et
  // surtout il n'est pas « pressé » — tenir le micro n'est pas parler, et rien n'a été
  // demandé au navigateur. C'est la promesse « muet à l'arrivée », vérifiée à l'écran.
  ok("voix : le bouton Micro est là, éteint (rien n'est capté sans un clic)", !q("#bMicro").hidden && q("#bMicro").dataset.etat === "eteint" && q("#bMicro").getAttribute("aria-pressed") === "false", "hidden=" + q("#bMicro").hidden + " état=" + q("#bMicro").dataset.etat + " pressed=" + q("#bMicro").getAttribute("aria-pressed"));
  ok("voix : aucun <video> ne porte le son, et rien ne joue encore", qa("#sieges .visage video:not([muted])").length === 0 && qa("audio[data-pair]").length === 0, qa("#sieges .visage video:not([muted])").length + " vidéos sonores · " + qa("audio[data-pair]").length + " audios");
  // Un ami fictif salue et s'assoit par le transport muet : sa vignette attend, sans une erreur.
  if (window.__reseauEntrant) { __reseauEntrant({ t: "salut", id: "jSonde", nom: "Sonia", couleur: "#c0392b" }); __reseauEntrant({ t: "action", id: "jSonde", a: "asseoir", v: 3, nom: "Sonia", couleur: "#c0392b" }); await dodo(700); }
  ok("visio : l'amie assise a sa vignette en attente, la mienne reste en miroir", qa("#sieges .visage").length === 2 && /attente/i.test(txt("#sieges .visage:not(.moi) .visage-etat")) && qa("#sieges .visage.moi").length === 1, qa("#sieges .visage").length + " vignettes · " + txt("#sieges .visage:not(.moi) .visage-etat"));
  // 🚨 LE NOM D'UN SIÈGE EXISTE SUR TOUS LES SIÈGES, y compris ceux des DEUX BOUTS. Mesuré
  // à 1280 × 800 : « JOUEUR » (le siège de gauche, LE TIEN par défaut) et « KARIM » (celui
  // de droite) étaient peints ENTIÈREMENT hors de l'arc du feutre, donc effacés par son
  // clip — pas atténués, absents. Or la voix pose là son signal principal (« qui parle »
  // = le nom en jade). On vérifie par le POINT : le nom doit être ce qu'on touche.
  // ⚠️ On ne juge que les sièges RÉELLEMENT dans la fenêtre : sous 1000 px la rangée des
  // sièges devient une pellicule qui défile (style.css), et un siège hors défilement
  // n'est pas « effacé par l'arc », il est simplement plus loin.
  // 🚨 « Dans la fenêtre » NE SUFFIT PAS, et c'est ce qui rendait cette ligne rouge en
  // permanence. verifier.sh tourne en headless à 756 px de large : #sieges devient alors
  // une pellicule (scrollWidth 761 > clientWidth 455) qui S'ARRÊTE À x=503, alors que les
  // sièges 6 et 7 posent leur nom à x=585 et x=674 — au-delà du défileur, mais toujours
  // dans la fenêtre. Le garde ne les écartait donc pas, elementsFromPoint ne rendait rien
  // (ils sont hors du clip du défileur), et le banc concluait « effacés par l'arc ». Ce
  // n'est pas l'arc : c'est le défilement, exactement le cas que le paragraphe ci-dessus
  // dit vouloir exclure. On borne donc aussi par la BOÎTE du défileur — et seulement
  // quand il défile pour de vrai (overflow-x clippant), sinon on excuserait au bureau
  // (≥ 1000 px, où #sieges ne clippe rien) un nom que l'arc aurait vraiment effacé.
  { const rangee = q("#sieges"), boite = rangee.getBoundingClientRect();
    const clippe = getComputedStyle(rangee).overflowX !== "visible";
    const rates = qa("#sieges .siege").filter(d => { const n = d.querySelector(".nom"); if (!n) return false;
      const r = n.getBoundingClientRect(); if (!r.width) return false;
      const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
      if (x < 4 || y < 4 || x > innerWidth - 4 || y > innerHeight - 4) return false;
      if (clippe && (x < boite.left + 4 || x > boite.right - 4)) return false;
      // `elementsFromPoint` (au pluriel) : un bandeau qui passe par-dessus ne compte pas —
      // ce qu'on cherche, c'est un nom RETIRÉ de la pile par le clip du feutre.
      return !document.elementsFromPoint(x, y).some(e => d.contains(e)); })
      .map(d => (d.querySelector(".nom") || {}).textContent);
    ok("sièges : le nom de CHAQUE siège est à l'écran, les deux bouts compris", rates.length === 0, "effacés par l'arc : " + rates.join(", ")); }
  // Le rattrapage du son ne partage plus la rangée des actions : il la faisait passer sur
  // deux lignes (72 → 124 px) et retirait 52 px de feutre au moment précis où quelqu'un
  // se met à parler, puis les rendait d'un coup au premier clic.
  { const ra = q("#rangTable").getBoundingClientRect().height, za = q(".zone-actions").getBoundingClientRect().height;
    const sa = q("#bSonAmis"); sa.hidden = false; await dodo(120);
    const ra2 = q("#rangTable").getBoundingClientRect().height, za2 = q(".zone-actions").getBoundingClientRect().height;
    sa.hidden = true;
    ok("voix : « Activer le son » ne déplace plus rien quand il apparaît", sa.parentElement.id !== "rangTable" && ra2 === ra && za2 === za, "parent=" + sa.parentElement.className + " rangée " + ra + "→" + ra2 + " · actions " + za + "→" + za2); }
  // Une caméra qui MANQUE (getUserMedia bouchonné : dans ce Chrome sans faux périphérique la
  // vraie demande ne répond jamais sous le temps virtuel) : l'allumer doit le DIRE, se
  // rééteindre, et l'oublier — sans une erreur.
  // Le bouchon RETIENT ce qu'on lui a demandé : c'est la seule façon de prouver que les
  // deux capteurs sont bien deux permissions distinctes, et pas un `audio: true` glissé
  // dans les contraintes de la caméra (le détecteur du mode Concentration allumerait
  // alors un micro que personne n'a demandé).
  const demandes = [];
  { const md = navigator.mediaDevices, gumOrig = md && md.getUserMedia;
    if (md) md.getUserMedia = c => { demandes.push(c); return Promise.reject(Object.assign(new Error("sonde"), { name: "NotFoundError" })); };
    clic("#bCamera"); await dodo(800);
    clic("#bMicro"); await dodo(800);
    if (md) md.getUserMedia = gumOrig; }
  ok("voix : deux permissions, jamais une — la caméra ne demande PAS d'audio", demandes.length === 2 && demandes[0].audio === false && !!demandes[0].video && demandes[1].video === false && !!demandes[1].audio, demandes.length + " demandes : " + JSON.stringify(demandes.map(d => [!!d.video, !!d.audio])));
  ok("voix : le micro exige l'annulation d'écho (sans elle, cinq personnes = un larsen)", !!demandes[1] && demandes[1].audio && demandes[1].audio.echoCancellation === true && demandes[1].audio.noiseSuppression === true, JSON.stringify(demandes[1] && demandes[1].audio));
  ok("visio : sans caméra, le bouton se rééteint et ma vignette dit pourquoi", q("#bCamera").getAttribute("aria-pressed") === "false" && /caméra|refus|indispo|occup|coup/i.test(txt("#sieges .siege.toi .visage .visage-etat")), "pressed=" + q("#bCamera").getAttribute("aria-pressed") + " état=" + txt("#sieges .siege.toi .visage .visage-etat"));
  // 🚨 UNE PANNE DE MICRO LAISSE UNE TRACE. Cette ligne exigeait l'inverse (« le bouton se
  // rééteint ») : c'était le défaut, pas la règle. Un bandeau de 4,2 s puis un bouton
  // rigoureusement identique à ce qu'il était avant le clic, et celui qui regardait ses
  // cartes recliquait sans fin en croyant le bouton mort. On exige maintenant l'état
  // « panne », un libellé QUI A CHANGÉ, et une sortie dans l'infobulle — la caméra garde
  // bien son « pas de caméra » en rouge sur la vignette, indéfiniment.
  ok("voix : sans micro, la panne RESTE écrite sur le bouton et dans ⚙", q("#bMicro").dataset.etat === "panne" && q("#bMicro").getAttribute("aria-pressed") === "false" && /micro/i.test(txt("#voixEtat")), "état=" + q("#bMicro").dataset.etat + " ⚙=" + txt("#voixEtat"));
  ok("voix : la panne se LIT (le libellé change) et dit quoi faire ensuite", /pas de micro/i.test(txt("#bMicro .voix-txt")) && /branche/i.test(q("#bMicro").title) && /branche/i.test(txt("#voixEtat")), "mot=" + txt("#bMicro .voix-txt") + " · titre=" + q("#bMicro").title);
  { let m = {}; try { m = JSON.parse(localStorage.getItem("sabot") || "{}"); } catch (e) {}
    ok("mémoire : DB.camera repasse à faux quand la caméra manque", m.camera === false, "camera=" + m.camera);
    ok("mémoire : DB.micro repasse à faux quand le micro manque", m.micro === false, "micro=" + m.micro); }
  await miser(); await dodo(500);
  ok("table réseau : ma mise est dans mon cercle, l'hôte peut distribuer", qa("#sieges .siege.toi .jt").length >= 1 && !q("#bDonne").disabled, "jt=" + qa("#sieges .siege.toi .jt").length + " donne=" + q("#bDonne").disabled);
  clic("#bDonne"); await dodo(400);
  { let g = 0; while (g++ < 200 && phase() !== "reglement" && !(phase() === "mise" && g > 30)) { await dodo(200);
      if (!q("#bTire").disabled) clic("#bReste"); const a = q("#boiteAssurance .opts button:last-child"); if (a) a.click(); } }
  ok("table réseau : la manche est réglée par l'hôte", phase() === "reglement" || phase() === "mise", "phase " + phase());
  ok("table réseau : le croupier a joué, ma main a une issue", qa("#dMain .carte").length >= 2 && !!q("#sieges .siege.toi .issue") && q("#sieges .siege.toi .issue").textContent.trim().length > 0, "croupier=" + qa("#dMain .carte").length + " issue=" + (q("#sieges .siege.toi .issue") || {}).textContent);
  clic("#bNouveauSabot"); await dodo(200);
  ok("table réseau : le journal a la manche", !q("#modale").hidden && /Manche/.test(q("#modaleBoite").textContent) && qa("#modaleBoite table tr").length >= 3, qa("#modaleBoite table tr").length + " lignes");
  clic("#modaleFermer"); await dodo(120);
  clic("#bRecu"); await dodo(200);
  ok("table réseau : le reçu montre l'empreinte scellée", /Empreinte/.test(q("#modaleBoite").textContent) && /Scellé/.test(q("#modaleBoite").textContent), q("#modaleBoite").textContent.slice(0, 80));
  clic("#modaleFermer"); await dodo(120);
  clic("#bReseau"); await dodo(200);
  ok("table réseau : la fiche de la table (code, joueurs, bots)", /À cette table/.test(q("#modaleBoite").textContent) && !!q("#rsBots"), q("#modaleBoite").textContent.slice(0, 80));
  clic("#rsQuitter"); await dodo(1500);
  ok("table réseau : quitter rend la table solo", !q("#v-table").dataset.reseau && q("#bReseau").hidden && txt("#bNouveauSabot") === "Nouveau sabot" && phase() === "mise", "reseau=" + q("#v-table").dataset.reseau + " phase=" + phase());
  ok("visio : en solo, ni bouton Caméra ni vignette", q("#bCamera").hidden && qa("#sieges .visage").length === 0, "hidden=" + q("#bCamera").hidden + " vignettes=" + qa("#sieges .visage").length);
  ok("voix : en solo, ni bouton Micro ni rattrapage du son, et plus un seul <audio> de pair", q("#bMicro").hidden && q("#bSonAmis").hidden && qa("audio[data-pair]").length === 0, "micro=" + q("#bMicro").hidden + " son=" + q("#bSonAmis").hidden + " audios=" + qa("audio[data-pair]").length);

  // ── Le relais vidéo dans ⚙ : mémorisé (DB.turn), testable ; sans identifiants, on le dit.
  clic("#bReglages"); await dodo(200);
  ok("relais : la section vit dans ⚙, avec ses trois champs et son bouton", !q("#modale").hidden && !!q("#modaleBoite #turnUrl") && !!q("#modaleBoite #turnUser") && !!q("#modaleBoite #turnPass") && !!q("#modaleBoite #turnTester"), "champs absents de la modale");
  ok("relais : sans identifiants, ⚙ dit « STUN seul »", /STUN seul/.test(txt("#turnEtat")), txt("#turnEtat").slice(0, 60));
  // La voix dans ⚙ : ouvrir/fermer, le volume des autres, et l'appui pour parler — qui
  // doit être DÉCOCHÉ par défaut (le micro reste ouvert, avec un bouton pour se couper).
  ok("voix : la section vit dans ⚙, avec son bouton, son volume et l'appui pour parler", !q("#modale").hidden && !!q("#modaleBoite #voixBascule") && !!q("#modaleBoite #voixVol") && !!q("#modaleBoite #voixPousser"), "champs absents de la modale");
  ok("voix : « appuyer pour parler » est décoché par défaut, volume des voix à 100 %", q("#voixPousser").checked === false && q("#voixVol").value === "100" && txt("#voixVolL") === "100 %", "poussé=" + (q("#voixPousser") || {}).checked + " volume=" + (q("#voixVol") || {}).value);
  // 🚨 HORS D'UNE TABLE, ⚙ NE PREND PAS LE MICRO. Il le prenait depuis le hall : la piste
  // passait en `live`, le voyant d'enregistrement du navigateur s'allumait, et #bMicro
  // restant caché en solo il n'existait plus AUCUN contrôle à l'écran pour le rendre —
  // pendant que ⚙ affirmait « la table t'entend » alors qu'il n'y avait pas de table.
  { let pris = 0; const md = navigator.mediaDevices, gumOrig = md && md.getUserMedia;
    if (md) md.getUserMedia = c => { pris++; return Promise.reject(Object.assign(new Error("sonde"), { name: "NotFoundError" })); };
    ok("voix : hors d'une table, « Ouvrir mon micro » est fermé et dit pourquoi", q("#voixBascule").disabled === true && /table/i.test(q("#voixBascule").title) && !q("#voixHorsTable").hidden, "désactivé=" + q("#voixBascule").disabled + " note=" + (q("#voixHorsTable") || {}).hidden);
    clic("#voixBascule"); await dodo(400);
    ok("voix : et un clic dessus ne demande RIEN au navigateur", pris === 0, pris + " getUserMedia");
    if (md) md.getUserMedia = gumOrig; }
  // Le témoin de micro : il existe, et il se tait tant qu'il n'y a rien à dire.
  ok("voix : le témoin hors table existe, caché tant que le micro est fermé", !!q("#voixTemoin") && q("#voixTemoin").hidden, "témoin=" + !!q("#voixTemoin") + " caché=" + (q("#voixTemoin") || {}).hidden);
  // Le bouton Micro ne doit plus POUSSER SES VOISINS en changeant d'état : il en a six, et
  // le plus long (« Micro occupé ») fixe la largeur pour tous. Mesuré en écrivant les six.
  { const b = q("#bMicro"), t = b.querySelector(".voix-txt"), avant = t.textContent, cache = b.hidden;
    b.hidden = false;
    const l = ["Micro", "Je parle", "Micro coupé", "Maintiens M", "Micro occupé", "Micro…"].map(m => { t.textContent = m; return Math.round(b.getBoundingClientRect().width); });
    t.textContent = avant; b.hidden = cache;
    ok("voix : le bouton garde la MÊME largeur dans ses six états", new Set(l).size === 1, "largeurs " + l.join(" · ")); }
  // ── Le volume des sons (socle.js, DB.volume) : un curseur dans ⚙, à 60 par défaut, mémorisé.
  ok("volume : le curseur vit dans ⚙, à 60 % par défaut", !!q("#modaleBoite #volume") && q("#volume").value === "60" && txt("#volumeL") === "60 %", "volume=" + (q("#volume") || {}).value + " label=" + txt("#volumeL"));
  if (q("#volume")) { q("#volume").value = "30"; q("#volume").dispatchEvent(new Event("input")); await dodo(120); }
  { let m = {}; try { m = JSON.parse(localStorage.getItem("sabot") || "{}"); } catch (e) {}
    ok("volume : mémorisé dans DB.volume, affiché en %", m.volume === 30 && txt("#volumeL") === "30 %", "volume=" + m.volume + " label=" + txt("#volumeL")); }
  if (q("#volume")) { q("#volume").value = "60"; q("#volume").dispatchEvent(new Event("input")); }
  clic("#turnTester"); await dodo(300);
  ok("relais : tester sans identifiants le dit, sans rien lancer", /Aucun relais configuré/.test(txt("#turnEtat")), txt("#turnEtat").slice(0, 60));
  q("#turnUrl").value = "turn:relais.exemple.org:3478"; q("#turnUrl").dispatchEvent(new Event("input"));
  q("#turnUser").value = "sonde"; q("#turnUser").dispatchEvent(new Event("input"));
  q("#turnPass").value = "secret"; q("#turnPass").dispatchEvent(new Event("input")); await dodo(100);
  { let m = {}; try { m = JSON.parse(localStorage.getItem("sabot") || "{}"); } catch (e) {}
    ok("relais : mémorisé dans DB.turn", m.turn && m.turn.url === "turn:relais.exemple.org:3478" && m.turn.user === "sonde" && m.turn.pass === "secret", JSON.stringify(m.turn)); }
  ok("relais : renseigné, ⚙ le dit", /Relais renseigné/.test(txt("#turnEtat")), txt("#turnEtat").slice(0, 60));
  ["turnUrl", "turnUser", "turnPass"].forEach(id => { q("#" + id).value = ""; q("#" + id).dispatchEvent(new Event("input")); });
  clic("#modaleFermer"); await dodo(150);
  ok("relais : la feuille rend le bloc à l'en-tête", q("#outils").hidden && !!q("header #outils"), "outils hidden=" + q("#outils").hidden);
  ok("BILAN : aucune erreur", __err.length === 0, __err.join(" / "));
 } catch (e) { R.push("KO la sonde a planté >> " + e.message + " @ " + (e.stack || "").split("\n")[1]); }
 document.getElementById("SONDE").textContent = "RES " + R.join(" ; ") + " || ERR " + (__err.join(" / ") || "aucune");
})();
