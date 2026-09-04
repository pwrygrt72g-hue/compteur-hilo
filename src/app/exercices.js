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
