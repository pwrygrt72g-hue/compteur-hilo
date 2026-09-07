/* ══════════════════════ PROGRESSION ══════════════════════ */
const GENRE = { defilement: "Défilement", chrono: "Sabot chrono", table: "Table", concentration: "Concentration", estimation: "Estimation" };
const pctDe = a => a[0] + a[1] ? Math.round(100 * a[0] / (a[0] + a[1])) + " %" : "—";
function rendreProgres() {
  const S = DB.sessions;
  $("progTitre").textContent = prenom() ? `Tes sessions, ${prenom()}` : "Tes sessions";
  // Sans session : UN seul état vide — le titre, une phrase, un bouton vers les exercices. Le
  // graphique, le journal et « Effacer l'historique » n'existent pas tant qu'il n'y a rien à
  // montrer ni à effacer (les critiques, 05/09 : trois panneaux vides et un bouton actif sur du vide).
  const vide = !S.length;
  ["progVide"].forEach(id => { if ($(id)) $(id).hidden = !vide; });
  ["progPave", "progCourbeBloc", "progJournalBloc", "progEffacerRang"].forEach(id => { if ($(id)) $(id).hidden = vide; });
  if ($("progEffacer")) $("progEffacer").disabled = vide;
  if (vide) { $("progPave").innerHTML = ""; $("progJournal").innerHTML = ""; return; }
  const ex = S.filter(s => s.exact).length;
  const rts = S.filter(s => s.reaction); const rt = rts.length ? rts.reduce((a, s) => a + s.reaction, 0) / rts.length : null;
  const chr = S.filter(s => s.genre === "chrono" && s.exact && s.secondes);
  const best = chr.length ? Math.min(...chr.map(s => s.secondes / s.n * 52)) : null;
  // L'estimation du sabot, moyennée sur les CINQ dernières : une session ne fait que dix
  // manches — trop court pour un niveau — et dix sessions d'estimation peuvent remonter
  // à des semaines. Les sessions d'avant le 6 septembre n'ont pas de `pct` : elles sont
  // simplement ignorées, plutôt que comptées pour zéro.
  const est = S.filter(s => s.genre === "estimation" && typeof s.pct === "number").slice(-5);
  const estPct = est.length ? Math.round(est.reduce((a, s) => a + s.pct, 0) / est.length) : null;
  let serie = 0; for (let i = S.length - 1; i >= 0 && S[i].exact; i--) serie++;
  const d10 = S.slice(-10), ex10 = d10.filter(s => s.exact).length;
  // Les trois mesures qui SE SITUENT portent leur palier, en pastille, sous le chiffre.
  // Le barème vit dans REPERES (exercices.js, concaténé avant ce fichier) : la même
  // table que les bilans, pour que le bureau ne puisse pas contredire l'exercice qu'on
  // vient de finir. Elles sont voisines à l'écran, c'est la lecture de niveau d'un coup.
  $("progPave").innerHTML = [
    [S.length, "Sessions"], [Math.round(100 * ex / S.length) + " %", "Comptes exacts"],
    [Math.round(100 * ex10 / d10.length) + " %", "Sur les 10 dernières"], [serie, "Série en cours"],
    [rt !== null ? fr1(rt) + " s" : "—", "Réaction moyenne", badgeRepere("reaction", rt)],
    [best !== null ? fr1(best) + " s" : "—", "Meilleur jeu de 52", badgeRepere("jeu52", best)],
    [estPct !== null ? estPct + " %" : "—", "Estimation", badgeRepere("estimation", estPct)],
    [pctDe(DB.strat.base), "Stratégie de base"], [pctDe(DB.strat.ecarts), "Écarts au compte"], [pctDe(DB.strat.assurance), "Assurance"],
    [DB.rachats || 0, "Rachats de tapis"]
  ].map(([b, l, r]) => `<div class="laque t"><b>${b}</b><span class="grave">${l}</span>${r || ""}</div>`).join("");
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
  DB.sessions = []; DB.strat = { base: [0, 0], ecarts: [0, 0], assurance: [0, 0] }; DB.fautes = []; DB.rachats = 0;
  garder(); rendreProgres(); bandeau("Historique effacé.");
};
window.addEventListener("resize", () => { if (vue === "progres") dessinerCourbe(DB.sessions.filter(x => x.genre !== "estimation").slice(-30)); });

/* ══════════════════════ GARDER SA PROGRESSION ══════════════════════
   Léo, 07/09/2026 : « garder sa progression […] mais tu précises que c'est pour garder
   la progression, pas pour collecter des données ».

   🚨 POURQUOI UN FICHIER, ET NI UNE ADRESSE IP NI UN COMPTE :
   · L'ADRESSE IP est un faux ami. Elle n'identifie personne — quatre personnes derrière
     la même box en partagent une, et la tienne change au redémarrage — donc elle rendrait
     la progression d'un inconnu à l'un et perdrait la sienne à l'autre. Et il faudrait un
     SERVEUR pour la retenir, c'est-à-dire précisément la collecte qu'on veut éviter.
   · UN COMPTE (Google ou autre) suppose lui aussi un endroit où poser les données. La
     seule variante honnête — les écrire dans le Drive de la personne, jamais chez nous —
     demande à Google une vérification d'application. C'est possible, ce n'est pas gratuit
     en temps, et ça ne change rien pour qui refuse de se connecter.
   · Un FICHIER n'a besoin de rien : il part sur SA machine, il se relit sur n'importe
     quelle autre, et il n'existe aucun endroit où il pourrait fuir. C'est la seule
     solution qui tient la promesse écrite sur la page des dons.

   ⚠️ On n'exporte QUE ce qui est à soi. `engage` (les jetons posés sur le feutre d'une
   main interrompue) est délibérément EXCLU : réimporté, il rendrait une mise à quelqu'un
   qui n'a pas la main correspondante, et le tapis se mettrait à mentir. */
const SAUVE_VERSION = 1;
{
  const dire = (m, err) => { const e = $("progGarderEtat"); if (e) { e.textContent = m; e.style.color = err ? "var(--bad-txt, var(--red))" : ""; } };

  $("progExporter") && ($("progExporter").onclick = () => {
    const { engage, ...reste } = DB;
    const paquet = { app: "wisehand", v: SAUVE_VERSION, le: new Date().toISOString().slice(0, 10), db: reste };
    const nom = `wisehand-${paquet.le}.wisehand`;
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify(paquet, null, 1)], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = nom; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      dire(`Fichier « ${nom} » enregistré. Garde-le : c'est toute ta progression.`);
    } catch (e) { dire("Ce navigateur a refusé le téléchargement.", true); }
  });

  $("progImporter") && ($("progImporter").onclick = () => $("progFichier").click());

  $("progFichier") && ($("progFichier").onchange = e => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";                       // rejouer le MÊME fichier doit remarcher
    if (!f) return;
    if (f.size > 4e6) return dire("Ce fichier est trop gros pour être une sauvegarde WiseHand.", true);
    const lect = new FileReader();
    lect.onerror = () => dire("Fichier illisible.", true);
    lect.onload = () => {
      let p; try { p = JSON.parse(lect.result); } catch (err) { return dire("Ce fichier n'est pas une sauvegarde WiseHand.", true); }
      // 🚨 On vérifie la SIGNATURE avant tout : un JSON quelconque déposé ici écraserait
      // une vraie progression par du vide, sans retour possible.
      if (!p || p.app !== "wisehand" || !p.db || typeof p.db !== "object") return dire("Ce fichier n'est pas une sauvegarde WiseHand.", true);
      if (+p.v > SAUVE_VERSION) return dire("Cette sauvegarde vient d'une version plus récente de WiseHand.", true);
      const n = Array.isArray(p.db.sessions) ? p.db.sessions.length : 0;
      if (!confirm(`Relire cette sauvegarde du ${p.le || "?"} ?\n\n${n} session${n > 1 ? "s" : ""} y sont enregistrées. Ta progression actuelle sera remplacée.`)) return dire("");
      // On ne prend QUE les clés qu'on connaît : un fichier bricolé ne doit pas pouvoir
      // semer n'importe quoi dans DB, que le reste du code relit sans se méfier.
      const permis = ["prenom", "son", "sys", "theme", "table", "sessions", "strat", "fautes", "tapis", "rachats", "volume", "couleur", "turn", "quete"];
      for (const k of permis) if (p.db[k] !== undefined) DB[k] = p.db[k];
      DB.sessions = Array.isArray(DB.sessions) ? DB.sessions : [];
      DB.fautes = Array.isArray(DB.fautes) ? DB.fautes : [];
      DB.strat = Object.assign({ base: [0, 0], ecarts: [0, 0], assurance: [0, 0] }, DB.strat || {});
      DB.engage = 0;
      garder();
      dire(`Progression restaurée : ${n} session${n > 1 ? "s" : ""}.`);
      // ⚠️ On RECHARGE : le thème, le prénom, le système de comptage, la table et le tapis
      // sont lus au démarrage par une dizaine d'endroits. Les rafraîchir un par un, c'est
      // la garantie d'en oublier un et de laisser l'écran mentir sur ce qui est en base.
      setTimeout(() => location.reload(), 900);
    };
    lect.readAsText(f);
  });
}
