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
// La caméra est CELLE de camera.mjs, partagée avec la visio de la table et comptée par
// références : un seul voyant, une seule permission, et le détecteur continue de tourner
// si tes amis te voient déjà. Rien ne lève : un refus se lit dans `etat` et `raison`.
async function lancerCamera() {
  arreterCamera(); $("coCamHors").hidden = false;
  $("coCamEtat").textContent = ""; $("coCamEtat").removeAttribute("data-ton"); $("coCamEtat").title = "";
  if (!CO.cam) { $("coCamHors").textContent = "Caméra désactivée : seuls les signes de comportement comptent."; return; }
  const cam = M.camera.cameraPartagee(); CO.camRef = true;
  const { flux, etat, raison } = await cam.prendre();
  if (!CO.camRef) return;                                   // arrêtée pendant la demande : la référence est déjà rendue
  if (!flux) { CO.camRef = false; cam.rendre(); CO.cam = false; $("coCamHors").textContent = (raison || "Caméra indisponible (" + etat + ").") + " Ouvre le site plutôt que la page publiée."; return; }
  CO.flux = flux;
  const v = $("coVideo"); v.srcObject = flux; await v.play().catch(() => {});
  $("coCamHors").hidden = true; $("coCamEtat").textContent = "Détecteur actif";
  CO.raf = requestAnimationFrame(camTick);
}
function arreterCamera() { cancelAnimationFrame(CO.raf); if (CO.camRef) { CO.camRef = false; M.camera.cameraPartagee().rendre(); } CO.flux = null; }
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
    let visage = 0, nv = 0, bo = 0, nb = 0, lum = 0;
    for (let y = Math.round(LH * .1); y < Math.round(LH * .9); y++)
      for (let x = Math.round(LW * .25); x < Math.round(LW * .75); x++) {
        const df = Math.abs(g[y * LW + x] - CO.prec[y * LW + x]);
        const dedans = x >= bouche.x0 && x < bouche.x1 && y >= bouche.y0 && y < bouche.y1;
        lum += g[y * LW + x];
        if (dedans) { bo += df; nb++; } else { visage += df; nv++; }
      }
    lum /= (nv + nb); visage /= nv; bo /= nb;
    const immobile = visage < 1.2 && bo < 1.2; CO.fige = immobile ? CO.fige + 80 : 0;
    const levres = bo > 7 && bo > visage * 2.6;
    direEtatCam(visage, bo, lum, levres);
    if (CO.encours) {
      if (levres) indice(niveau() === 3 ? 9 : 6, "Tes lèvres bougent. Tu comptes à voix basse ?");
      if (CO.fige > (niveau() === 3 ? 6000 : 9000)) { CO.fige = 0; indice(7, "Visage figé, regard vissé sur les cartes."); }
    }
  }
  CO.prec = g;
}
/* ── CE QUE LE DÉTECTEUR DIT DE LUI-MÊME ─────────────────────────────────────
   Il écrivait « visage 1.4 · bouche 0.8 » sous la vignette : des moyennes de
   différence de luminance sur une image de 64 × 48, dans une échelle que personne
   ne connaît, mises à jour douze fois par seconde. Ça ne dit rien à qui joue, et ça
   fait croire à un écran de débogage oublié en place. Les SEUILS ne bougent pas —
   ce sont les mêmes que les pénalités juste au-dessus, à la ligne près : seule la
   phrase change. Les nombres restent dans le `title`, pour qui veut vérifier.
   ⚠️ « lum » est un ajout : sous un certain plancher de lumière, une différence entre
   deux images ne veut plus rien dire — tout est noir, donc tout est « immobile ». Le
   détecteur le dit, au lieu de laisser croire qu'il voit quelque chose. 22 sur 255,
   c'est 8 % de l'échelle : en dessous, l'image est un aplat. */
function direEtatCam(visage, bo, lum, levres) {
  const e = $("coCamEtat"); if (!e) return;
  const [txt, ton] = lum < 22 ? ["Approche-toi, on ne te voit pas", "alerte"]
    : levres ? ["Tes lèvres bougent", "alerte"]
    : CO.fige > 3000 ? [`Visage figé depuis ${Math.round(CO.fige / 1000)} s`, "attention"]
    : ["Détecteur actif", ""];
  if (e.textContent !== txt) e.textContent = txt;
  if (ton) e.dataset.ton = ton; else e.removeAttribute("data-ton");
  e.title = `visage ${visage.toFixed(1)} · bouche ${bo.toFixed(1)} · lumière ${Math.round(lum)} sur 255`;
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
