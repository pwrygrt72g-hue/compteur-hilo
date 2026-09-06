/* ══════════════════════ EXERCICES ══════════════════════ */
const X = { genre: "defilement", sabot: [], cartes: [], cachees: [], i: -1, minuteur: null, rc: 0, rep: [], encours: false,
  jeux: 6, t0: 0, delais: [], controles: [], prochainControle: 0, pause: false, depart: 0, chrono: null, silence: false, par: 1 };
function ongletEx(g) {
  X.genre = g;
  $("ongletsEx").querySelectorAll("button").forEach(b => b.setAttribute("aria-selected", b.dataset.ex === g ? "true" : "false"));
  $("opDefilement").hidden = g !== "defilement"; $("opChrono").hidden = g !== "chrono"; $("opEstimation").hidden = g !== "estimation";
  ["exPiste", "exBilan", "estPiste", "estBilan"].forEach(id => { $(id).hidden = true; });
  $("exReglages").hidden = false;
  rendreSceneExo();
}
/* ── Le tiroir des réglages et la scène de démonstration ───────────────────
   Mesuré le 05/09 : sept sélecteurs, un curseur et deux cases AVANT « Commencer », puis
   60 % d'écran vide — un formulaire de réglages, pas un exercice. Le tiroir est replié
   (son résumé dit ce qu'il contient), « Commencer » est dans le bandeau, et la scène
   occupe l'espace : trois cartes de dos, le compteur à zéro, ce qui va se passer. Elle
   s'efface avec le tiroir dès que la piste ou le bilan est là (style.css, :has). */
const pluriel = (n, mot) => n + " " + mot + (n > 1 ? (/eu$/.test(mot) ? "x" : "s") : "");
function resumeExo() {
  if (X.genre === "chrono") return `${pluriel(+$("cJeux").value, "jeu")} · ${pluriel(+$("cParVue").value, "carte")} à la fois · ${pluriel(+$("cCachees").value, "retirée")}`;
  if (X.genre === "estimation") return `sabot de ${$("sJeux").value} jeux · ${$("sManches").value} manches`;
  const silence = $("eMode").value === "silence", par = +$("eParVue").value, ctrl = $("eControle").value;
  // En clair : « une carte toutes les 1,2 s · tu cliques la valeur » — un résumé de réglage codé
  // (« 1,2 s · je clique la valeur ») ne disait pas ce qu'on attend (les critiques, 05/09).
  return `${pluriel(+$("eJeux").value, "jeu")} · une carte toutes les ${fr1(+$("eVitesse").value / 1000)} s · ${silence ? "tu comptes en silence" : "tu cliques la valeur"}` +
    (silence && par > 1 ? ` · ${par} à la fois` : "") + (ctrl !== "0" ? " · contrôle surprise" : "");
}
// La légende du système sélectionné, en puces : « +1 2 3 4 5 6 · 0 7 8 9 · −1 10 V D R A ».
function legendeSysteme() {
  const v = sys().v, groupes = {};
  RANKS.forEach((r, i) => { const k = v[i >= 9 ? 9 : i]; (groupes[k] = groupes[k] || []).push(r); });
  // De gauche à droite comme les boutons de réponse et les touches fléchées : −1, 0, +1.
  return Object.keys(groupes).map(Number).sort((a, b) => a - b)
    .map(k => `<span class="regle ${k > 0 ? "bien" : k < 0 ? "mal" : ""}" title="Ces cartes valent ${sgn(k)}">${sgn(k)}&nbsp; ${groupes[k].join(" ")}</span>`).join("");
}
// La consigne des boutons, GÉNÉRÉE depuis le système : « Trois boutons : −1 pour A, 10, V, D, R ;
// 0 pour 7, 8, 9 ; +1 pour 2 à 6 ». Les touches 1…5 n'existent que pour un système à cinq valeurs.
function consigneBoutons() {
  const v = sys().v, vals = [...new Set(v)].sort((a, b) => a - b);
  const mots = ["", "un", "deux", "trois", "quatre", "cinq", "six"];
  const rangsDe = x => { const rs = RANKS.filter((r, i) => v[i >= 9 ? 9 : i] === x);
    return rs.length > 4 && rs.every((r, i) => !i || RANKS.indexOf(r) === RANKS.indexOf(rs[i - 1]) + 1) ? rs[0] + " à " + rs[rs.length - 1] : rs.join(", "); };
  const mot = mots[vals.length] || String(vals.length);
  const boutons = `${mot.charAt(0).toUpperCase() + mot.slice(1)} boutons : ` + vals.map(x => `<b>${sgn(x)}</b> pour ${rangsDe(x)}`).join(" ; ");
  const touches = vals.length === 3 ? `<kbd>←</kbd> −1 · <kbd>espace</kbd> 0 · <kbd>→</kbd> +1` : `<kbd>1…${vals.length}</kbd> les boutons de gauche à droite`;
  return boutons + ". Au clavier : " + touches + ".";
}
function rendreSceneExo() {
  const r = $("exResume"), cadre = $("exoCadre"); if (!r || !cadre) return;
  r.textContent = resumeExo();
  if (!cadre.children.length) for (let k = 0; k < 3; k++) cadre.appendChild(carteEl({}, true));
  const c = $("exScene").querySelector(".exo-compte"), lab = c.querySelector(".grave"), val = c.querySelector("b");
  const sec = fr1(+$("eVitesse").value / 1000);
  // La légende AVANT le départ : elle n'apparaissait que sur les boutons, une fois lancé.
  if ($("exoLegende")) $("exoLegende").innerHTML = X.genre === "estimation" ? "" : legendeSysteme();
  lab.textContent = X.genre === "estimation" ? "Jeux dans le tas" : "Compte courant"; val.textContent = X.genre === "estimation" ? "?" : "0";
  $("exoQuoi").innerHTML = X.genre === "estimation"
    ? "Un tas de défausse, manche après manche : tu annonces combien de jeux y sont passés. C'est ce coup d'œil qui fait le compte vrai — tolérance : un demi-jeu."
    : X.genre === "chrono"
    ? "Tu fais défiler toi-même — <kbd>espace</kbd>, clic ou <kbd>→</kbd>. Le chrono part à la première carte, le compte t'est demandé à la fin."
    : $("eMode").value === "silence"
    ? `Les cartes tombent ici, une toutes les <b>${sec} s</b> ; tu tiens le compte en silence, on te le demande à la fin.`
    : `Les cartes tombent ici, une toutes les <b>${sec} s</b> ; tu annonces la valeur de chacune. ${consigneBoutons()}`;
}
$("exReglages").addEventListener("change", rendreSceneExo);
$("exReglages").addEventListener("input", rendreSceneExo);
rendreSceneExo();
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
if ($("eDemarrer2")) $("eDemarrer2").onclick = demarrerExercice;   // le même bouton, sous les cartes
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
    // Un nombre ENTIER de jeux retombe toujours sur le même compte (0 en Hi-Lo) :
    // la réponse serait connue d'avance. D'où « au hasard », « jusqu'à la coupe »
    // (on ne voit jamais la fin d'un sabot en salle), et des cartes retirées.
    const choix = $("eNb").value;
    const n = choix === "coupe" ? Math.floor(X.sabot.length * (.65 + Math.random() * .15))
      : choix === "alea" ? 30 + alea(16) : Math.min(+choix, X.sabot.length);
    X.cartes = X.sabot.slice(0, n); X.silence = $("eMode").value === "silence"; X.par = X.silence ? +$("eParVue").value : 1;
    retirerCachees(n % 52 === 0 ? +$("eCachees").value : 0);
  } else {
    X.jeux = +$("cJeux").value;
    const s = await sabotProuvable(X.jeux);
    X.sabot = s.cartes; X.cartes = X.sabot.slice(); X.silence = true; X.par = +$("cParVue").value;
    retirerCachees(+$("cCachees").value);
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
// Les cartes retirées sortent de la séquence montrée mais restent dans le sabot :
// ton compte final, sur un paquet entier, révèle ce qu'elles valaient.
function retirerCachees(k) {
  X.cachees = [];
  for (let i = 0; i < k && X.cartes.length > 5; i++) X.cachees.push(X.cartes.splice(alea(X.cartes.length), 1)[0]);
}
$("cCachees").onchange = () => { $("cCacheesL").textContent = $("cCachees").value; };
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
  const rc = $("rCachees"); rc.hidden = !X.cachees.length;
  if (X.cachees.length) {
    const somme = X.cachees.reduce((a, c) => a + valeurCompte(c), 0);
    const cible = CT.compteInitial(DB.sys, X.jeux) + (sys().equilibre ? 0 : 4 * X.jeux);
    const entier = (X.cartes.length + X.cachees.length) % 52 === 0;
    rc.innerHTML = `<p class="grave">Retirées face cachée</p><div class="groupe"></div><p></p>`;
    const g = rc.querySelector(".groupe"); X.cachees.forEach(c => g.appendChild(carteEl(c)));
    rc.querySelector("p:last-child").textContent = entier
      ? `Elles valent ${sgn(somme)}. Le paquet entier retombe sur ${sgn(cible)} : un compte juste de ${sgn(X.rc)} les révélait${exact ? " — et tu l'as fait." : "."}`
      : `Elles valent ${sgn(somme)}.`;
  }
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
