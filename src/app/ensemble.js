/* ══════════════════════ À PLUSIEURS ══════════════════════ */
const MP = { api: null, code: "", moi: "", nom: "", pairs: new Map(), hote: false, url: "",
  cartes: [], i: -1, rc: 0, encours: false, minuteur: null, annonces: new Map(), graine: null, empreinte: "" };
function messageMP(o) { if (MP.api) MP.api.publier(NET.sujet(MP.code), JSON.stringify(o)); }
function rendrePairs() {
  const tous = [...MP.pairs.values()];
  const hoteId = [...MP.pairs.keys()].sort()[0];
  MP.hote = hoteId === MP.moi;
  $("mpPairs").innerHTML = tous.sort((a, b) => a.id.localeCompare(b.id)).map(p =>
    `<span class="pair ${p.id === MP.moi ? "moi" : ""} ${p.id === hoteId ? "croupier" : ""}"><span class="point"></span>${echap(p.nom)}${p.id === hoteId ? " · croupier" : ""}${p.id === MP.moi ? " · toi" : ""}</span>`).join("");
  $("mpLancer").disabled = !MP.hote || MP.encours;
  $("mpExplique").textContent = MP.hote
    ? "Tu es le croupier de ce sabot : c'est toi qui le lances. Ton propre compte n'entre pas au classement, puisque tu connais l'ordre des cartes. Ferme l'onglet et le rôle passe à quelqu'un d'autre."
    : "Le croupier lance le sabot. Compte en silence, puis annonce. Le compte réel n'est révélé qu'une fois que tout le monde a répondu.";
}
async function ouvrirSalon(code) {
  MP.code = code; MP.moi = "j" + SH.hex(crypto.getRandomValues(new Uint8Array(5)));
  MP.nom = prenom() || "Joueur";
  MP.pairs = new Map([[MP.moi, { id: MP.moi, nom: MP.nom }]]);
  $("mpEtat").textContent = "Recherche d'un courtier…";
  try {
    const { api, url } = await NET.connecterAvecRepli({
      clientId: "hilo-" + MP.moi,
      onEssai: (n, total, nom) => { $("mpEtat").textContent = `Essai ${n} sur ${total} — ${nom}…`; },
      onMessage: (_, brut) => { try { recevoirMP(JSON.parse(brut)); } catch (e) {} },
      onClose: () => { $("mpRelais").textContent = "Connexion perdue. Recharge la page pour revenir."; },
    });
    MP.api = api; MP.url = url;
    api.souscrire(NET.sujet(code));
    setTimeout(() => messageMP({ t: "salut", id: MP.moi, nom: MP.nom }), 220);
    $("mpAccueil").hidden = true; $("mpSalon").hidden = false;
    $("mpCodeAff").textContent = TR.formaterCode(code);
    $("mpRelais").textContent = "Relié par " + url.replace("wss://", "").split(":")[0] + ". Les messages passent en clair par un courtier public.";
    rendrePairs(); rendreClassement();
  } catch (e) {
    // ⚠️ L'adresse vient de visio.mjs (LIEN_SITE), la seule du dépôt, et le texte du
    // lien ne nomme AUCUN hébergeur : « la version GitHub Pages » deviendra faux le
    // jour du déménagement, et personne ne pense à relire un message d'erreur.
    $("mpEtat").innerHTML = `Aucun courtier n'a répondu. Deux causes possibles : ton réseau bloque les connexions WebSocket, ou tu es sur une page publiée dont la politique de sécurité les interdit — dans ce cas, joue sur <a href="${M.visio.LIEN_SITE}" target="_blank" rel="noopener">la version en ligne</a>. <b>Le reste de l'application fonctionne normalement.</b>`;
    son("ko");
  }
}
function recevoirMP(m) {
  if (!m || !m.id || m.id === MP.moi) {
    if (m && m.id === MP.moi) return;
  }
  if (m.t === "salut") {
    if (!MP.pairs.has(m.id)) { MP.pairs.set(m.id, { id: m.id, nom: m.nom || "Joueur" }); rendrePairs();
      messageMP({ t: "salut", id: MP.moi, nom: MP.nom }); }
    return;
  }
  if (m.t === "sabot") { demarrerSabotMP(m); return; }
  if (m.t === "carte") { afficherCarteMP(m); return; }
  if (m.t === "annonce") { MP.annonces.set(m.id, m.v); rendreClassement(); return; }
  if (m.t === "reveal") { MP.rcReel = m.rc; MP.graineHex = m.graine; rendreClassement(true); return; }
  if (m.t === "adieu") { MP.pairs.delete(m.id); rendrePairs(); return; }
}
/* ── Deux modes derrière les mêmes boutons : la TABLE (reseau.js) et la COURSE (ici).
   Le code est le même format partout — huit caractères, écrits A7K2-M9PQ. ── */
MP.mode = "table";
const MP_TEXTES = {
  table: ["Une vraie table, jusqu'à cinq", "Vous vous asseyez autour de la même table, chacun sur son siège, avec le même tapis de 1 000 jetons. Le croupier donne, chacun joue sa main à son tour, et les gains glissent vers qui les a mérités. Celui qui ouvre la table tient le sabot — scellé, vérifiable par tous.", "Ouvrir une table", "Code de la table"],
  course: ["Le même sabot, chacun son compte", "Les cartes sortent du même sabot, chacun compte en silence, et à la fin chacun annonce son compte. Celui qui tombe juste gagne — pas celui qui a le plus de chance.", "Ouvrir une course", "Code de la course"],
};
function rendreModeMP() {
  const [titre, texte, bouton, code] = MP_TEXTES[MP.mode];
  $("mpTitre").textContent = titre; $("mpModeTexte").textContent = texte; $("mpCreer").textContent = bouton;
  $("mpCode").previousElementSibling.textContent = code;
  $("mpCouleurs").hidden = MP.mode !== "table";
  $("mpModes").querySelectorAll("button").forEach(b => b.setAttribute("aria-selected", b.dataset.mode === MP.mode ? "true" : "false"));
  $("mpEtat").textContent = "";
}
$("mpModes").querySelectorAll("button").forEach(b => b.onclick = () => { MP.mode = b.dataset.mode; rendreModeMP(); });
$("mpNom").value = prenom(); $("mpNom").oninput = () => { DB.prenom = $("mpNom").value; garder(); $("prenom").value = DB.prenom; };
// Le code se tape comme on veut (minuscules, tiret, espaces) et s'affiche groupé.
$("mpCode").addEventListener("input", () => { const p = $("mpCode").selectionStart; $("mpCode").value = TR.formaterCode($("mpCode").value); if (p !== null) $("mpCode").setSelectionRange(p, p); });
$("mpCode").addEventListener("keydown", e => { if (e.key === "Enter") $("mpRejoindre").click(); });
$("mpCreer").onclick = () => { const code = TR.codeSalon(); MP.mode === "table" ? ouvrirTable(code, true) : ouvrirSalon(code); };
$("mpRejoindre").onclick = () => {
  const c = TR.normaliserCode($("mpCode").value);
  if (!TR.codeValide(c)) { $("mpEtat").textContent = "Il faut le code complet : huit caractères, comme A7K2-M9PQ."; son("ko"); return; }
  MP.mode === "table" ? ouvrirTable(c, false) : ouvrirSalon(c);
};
rendreModeMP();
$("mpQuitter").onclick = () => {
  messageMP({ t: "adieu", id: MP.moi }); if (MP.api) MP.api.fermer();
  MP.api = null; $("mpSalon").hidden = true; $("mpAccueil").hidden = false; $("mpEtat").textContent = "";
};
$("mpCopier").onclick = () => {
  const lien = location.origin + location.pathname + "#course=" + MP.code;
  navigator.clipboard && navigator.clipboard.writeText(lien).then(() => bandeau("Lien copié : envoie-le à tes amis."), () => bandeau("Code : " + MP.code));
};
$("mpLancer").onclick = async () => {
  if (!MP.hote) return;
  const s = await sabotProuvable(2);
  MP.graine = s.graine; MP.empreinte = s.empreinte;
  const cartes = s.cartes.slice(0, 60);
  messageMP({ t: "sabot", id: MP.moi, n: cartes.length, empreinte: s.empreinte });
  demarrerSabotMP({ n: cartes.length, empreinte: s.empreinte });
  for (let k = 0; k < cartes.length; k++) {
    await dodo(1400);
    if (!MP.encours) break;
    const c = cartes[k];
    messageMP({ t: "carte", id: MP.moi, k, i: c.i, s: c.suit, col: c.col, r: c.r });
    afficherCarteMP({ k, i: c.i, s: c.suit, col: c.col, r: c.r, n: cartes.length });
  }
  await dodo(900);
  if (MP.encours) { MP.encours = false; $("mpAnnoncer").disabled = false;
    $("mpTitreDefi").textContent = "Sabot terminé — annonce ton compte"; rendrePairs(); }
};
function demarrerSabotMP(m) {
  MP.cartes = []; MP.i = -1; MP.rc = CT.compteInitial(DB.sys, 2); MP.encours = true;
  MP.annonces = new Map(); MP.rcReel = null; MP.total = m.n;
  $("mpTitreDefi").textContent = "Sabot en cours"; $("mpAnnoncer").disabled = true;
  $("mpScene").innerHTML = ""; $("mpPos").textContent = `0 / ${m.n}`;
  rendreClassement(); rendrePairs();
}
function afficherCarteMP(m) {
  const c = { r: m.r, i: m.i, suit: m.s, col: m.col };
  MP.rc += valeurCompte(c); MP.i = m.k;
  $("mpScene").innerHTML = ""; const e = carteEl(c); e.classList.add("carte--entre");
  e.style.setProperty("--dx", "180px"); e.style.setProperty("--dy", "-120px");
  $("mpScene").appendChild(e); son("carte");
  const n = MP.total || m.n || 60;
  $("mpPos").textContent = `${m.k + 1} / ${n}`;
  $("mpBarre").style.transition = "width .2s"; $("mpBarre").style.width = (100 * (m.k + 1) / n) + "%";
}
$("mpAnnoncer").onclick = () => {
  ouvrirModale(`<h2>Ton compte</h2><div class="demande" style="justify-content:center">
    <input type="number" id="mpSaisie" placeholder="0"><button class="btn" id="mpOk">Annoncer</button></div>`);
  const envoyer = () => {
    const g = $("mpSaisie").value.trim(); if (g === "") return;
    const v = parseInt(g, 10);
    MP.annonces.set(MP.moi, v); messageMP({ t: "annonce", id: MP.moi, v });
    $("modale").hidden = true; $("mpAnnoncer").disabled = true; rendreClassement();
    if (MP.hote) setTimeout(() => { messageMP({ t: "reveal", id: MP.moi, rc: MP.rc, graine: SH.hex(MP.graine) });
      MP.rcReel = MP.rc; MP.graineHex = SH.hex(MP.graine); rendreClassement(true); }, 2600);
  };
  $("mpOk").onclick = envoyer;
  $("mpSaisie").addEventListener("keydown", e => { if (e.key === "Enter") envoyer(); });
  setTimeout(() => $("mpSaisie").focus(), 40);
};
function rendreClassement(revele) {
  const hoteId = [...MP.pairs.keys()].sort()[0];
  const lignes = [...MP.pairs.values()].map(p => {
    const a = MP.annonces.get(p.id);
    const ecart = (revele && MP.rcReel !== null && a !== undefined) ? Math.abs(a - MP.rcReel) : null;
    return { nom: p.nom, croupier: p.id === hoteId, a, ecart };
  }).sort((x, y) => (x.ecart === null ? 99 : x.ecart) - (y.ecart === null ? 99 : y.ecart));
  $("mpClassement").innerHTML = `<tr><th>Joueur</th><th>Annonce</th><th>Écart</th></tr>` + lignes.map(l =>
    `<tr><td>${echap(l.nom)}${l.croupier ? ' <span class="muet">· croupier</span>' : ""}</td>
     <td class="n">${l.a === undefined ? "—" : sgn(l.a)}</td>
     <td class="n" style="color:${l.ecart === 0 ? "var(--jade)" : l.ecart ? "var(--cinabre)" : "inherit"}">${l.ecart === null ? "—" : l.ecart === 0 ? "exact" : l.ecart}</td></tr>`).join("")
    + (revele && MP.rcReel !== null ? `<tr><td colspan="3" class="muet" style="padding-top:10px">Compte réel : <b class="cadran">${sgn(MP.rcReel)}</b>. Graine du mélange : <span class="cadran" style="font-size:11px;word-break:break-all">${echap(MP.graineHex || "")}</span></td></tr>` : "");
}
// Un lien reçu : #course=CODE ouvre la course (l'ancien #salon= aussi), #table=CODE la table (reseau.js).
if (/^#(course|salon)=/.test(location.hash)) {
  const c = TR.normaliserCode(location.hash.split("=")[1]);
  if (c.length >= 4) { MP.mode = "course"; rendreModeMP(); aller("ensemble"); setTimeout(() => ouvrirSalon(c), 300); }
}
