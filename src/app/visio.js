/* ══════════════════════ LES TÊTES DES AMIS ══════════════════════
   LA VISIO AUTOUR DE LA TABLE À PLUSIEURS. Concaténé après reseau.js.
   Chaque siège tenu par un HUMAIN porte une vignette `.visage` (96×72 — pas `.tete`, qui est le conteneur de l'en-tête) à côté de son cercle de
   mise : les flux distants viennent de creerVisio (src/visio.mjs, maillage WebRTC
   signalé par le même courtier MQTT que la table), le tien de cameraPartagee
   (src/camera.mjs — la même caméra que le détecteur du mode Concentration, comptée par
   références). JAMAIS de micro : on compte en silence.

   Comment on se greffe sans toucher au rendu de la scène :
   · reseau.js émet « sabot:reseau-entree » (le courtier est relié), « sabot:reseau-pairs »
     (la liste des pairs bouge) et « sabot:reseau-sortie » ; on s'y branche.
   · RS.onBrut est notre crochet sur les messages du courtier : les sujets visio/* sont
     pour nous, le reste repart à la table.
   · « sabot:sieges » (table.js) dit que les sièges viennent d'être redessinés : on y
     pose nos vignettes — dans une rangée `.rangee-bas` qui accueille aussi le cercle —
     puis on redemande à cartes.js de mesurer (la rangée compte dans la hauteur du siège).
   · Une vignette SANS flux est une silhouette et un mot, jamais un rectangle noir muet.
   · Sur « failed » sans relais, la vignette et un bandeau disent quoi faire (⚙) —
     un échec de connexion directe ne se répare pas tout seul.
   · Avec le transport muet de la sonde (api.brut absent), pas de visio : les vignettes
     restent des silhouettes « en attente », et le bouton Caméra marche quand même.
   · Dans l'ARTEFACT (WebSocket bloqué), on n'arrive jamais ici : reseau.js le dit en
     moins de trois secondes et n'ouvre pas la table — la caméra n'est donc jamais
     demandée pour rien.
   ═══════════════════════════════════════════════════════════════════ */
const VI = M.visio, CAM = M.camera;
const RV = { visio: null, code: "", moi: "", flux: new Map(), etats: new Map(), bloques: new Set(), bloqueDit: new Set(),
  videos: new Map(), pairs: new Set(), tenu: false, camEtat: "eteinte", camRaison: "", camAbonne: false };
if (DB.camera === undefined) DB.camera = false;
if (!DB.turn || typeof DB.turn !== "object") DB.turn = { url: "", user: "", pass: "" };
DB.turn = Object.assign({ url: "", user: "", pass: "" }, DB.turn);
// La silhouette : une tête et des épaules en ivoire éteint — le contraire d'un rectangle noir.
const SILHOUETTE = `<svg class="silhouette" viewBox="0 0 96 72" aria-hidden="true" focusable="false"><circle cx="48" cy="26" r="12" fill="currentColor"/><path d="M18 72c0-18 12-27 30-27s30 9 30 27z" fill="currentColor"/></svg>`;

/* ── Entrer, sortir, suivre les pairs ───────────────────────────────────── */
function rvDemarrer(d) {
  rvArreter();
  RV.code = d.code; RV.moi = d.moi; RV.pairs = new Set([d.moi]);
  $("bCamera").hidden = false; rvBoutonCamera();
  const brut = d.api && d.api.brut;
  if (brut) {
    RV.visio = VI.creerVisio({
      reseau: brut, salon: d.code, moi: d.moi, nom: prenom() || "Joueur", turn: DB.turn,
      onFlux: (id, flux) => { RV.flux.set(id, flux); rvRendre(id); },
      onDepart: id => { RV.flux.delete(id); RV.etats.delete(id); RV.bloques.delete(id); RV.videos.delete(id); rvRendre(id); },
      onEtat: rvEtat,
      onJournal: t => { if (window.__visioJournal) window.__visioJournal.push(t); },
    });
    RS.onBrut = (s, brut) => !!RV.visio && RV.visio.recevoir(s, brut);
    RV.visio.demarrer();
  }
  if (DB.camera) rvAllumer();
  rvPoserVignettes();
}
function rvArreter() {
  if (RV.visio) { try { RV.visio.fermer(); } catch (e) {} }
  RV.visio = null; RS.onBrut = null;
  RV.flux.clear(); RV.etats.clear(); RV.bloques.clear(); RV.bloqueDit.clear(); RV.videos.clear(); RV.pairs = new Set();
  rvEteindre();
  $("bCamera").hidden = true;
}
// La salle (table-reseau.mjs) tient la présence par le testament du courtier : un pair
// qui meurt y est vu en moins d'une seconde. On le répercute sur le maillage.
function rvPairs(pairs) {
  if (!RV.visio) return;
  const ids = new Set(pairs.keys());
  for (const id of ids) if (!RV.pairs.has(id) && id !== RV.moi) RV.visio.arrivee(id);
  for (const id of RV.pairs) if (!ids.has(id) && id !== RV.moi) RV.visio.depart(id);
  RV.pairs = ids;
}
function rvEtat(id, et) {
  if (et === "bloque") {
    RV.bloques.add(id);
    if (!RV.bloqueDit.has(id)) { RV.bloqueDit.add(id); bandeau(RV.visio && RV.visio.sansRelais ? VI.SANS_RELAIS_MESSAGE : VI.AVEC_RELAIS_MESSAGE, 6500); son("ko"); }
  } else if (et === "connected" || et === "completed") RV.bloques.delete(id);
  RV.etats.set(id, et);
  rvRendre(id);
}
document.addEventListener("sabot:reseau-entree", e => rvDemarrer(e.detail));
document.addEventListener("sabot:reseau-sortie", () => rvArreter());
document.addEventListener("sabot:reseau-pairs", e => rvPairs(e.detail.pairs));
document.addEventListener("sabot:sieges", () => { if (T.reseau) rvPoserVignettes(); });

/* ── Ta caméra : un bouton, mémorisé, jamais de micro ───────────────────── */
function rvBoutonCamera() {
  const b = $("bCamera"); if (!b) return;
  const on = RV.tenu && RV.camEtat !== "eteinte";
  b.setAttribute("aria-pressed", on ? "true" : "false");
  b.title = on ? "Couper ta caméra" : "Ta caméra, pour que tes amis te voient sur ton siège — vidéo seule, jamais de micro";
}
async function rvAllumer() {
  if (RV.tenu) return;
  const cam = CAM.cameraPartagee();
  if (!RV.camAbonne) {
    RV.camAbonne = true;
    // La caméra peut s'éteindre sans nous (permission retirée, câble) : on le dit sur la vignette.
    cam.onEtat((etat, raison) => { if (!RV.tenu) return; RV.camEtat = etat; RV.camRaison = raison;
      if (etat === "coupee") { RV.tenu = false; cam.rendre(); if (RV.visio) RV.visio.attacherFlux(null); DB.camera = false; garder(); bandeau("La caméra s'est arrêtée."); }
      rvBoutonCamera(); rvRendreMoi(); });
  }
  RV.tenu = true; RV.camEtat = "demande"; RV.camRaison = ""; rvBoutonCamera(); rvRendreMoi();
  const { flux, etat, raison } = await cam.prendre();
  if (!RV.tenu) return;                      // coupée pendant la demande : la référence est déjà rendue
  RV.camEtat = etat; RV.camRaison = raison || "";
  if (flux) { if (RV.visio) RV.visio.attacherFlux(flux); }
  else { RV.tenu = false; cam.rendre(); DB.camera = false; garder(); bandeau(raison || "Caméra indisponible ici.", 4200); }
  rvBoutonCamera(); rvRendreMoi();
}
function rvEteindre() {
  if (RV.tenu) { RV.tenu = false; CAM.cameraPartagee().rendre(); }
  if (RV.visio) RV.visio.attacherFlux(null);
  RV.camEtat = "eteinte"; RV.camRaison = "";
  rvBoutonCamera(); rvRendreMoi();
}
$("bCamera").onclick = () => {
  if (RV.tenu) { DB.camera = false; garder(); rvEteindre(); }
  else { DB.camera = true; garder(); rvAllumer(); }
};

/* ── Les vignettes sur les sièges ───────────────────────────────────────── */
// Après chaque redessin des sièges : une rangée cercle + vignette pour chaque humain.
function rvPoserVignettes() {
  if (!T.reseau) return;
  let neuf = false;
  document.querySelectorAll("#sieges .siege").forEach((d, k) => {
    const st = T.sieges[k]; if (!st || st.vide || st.bot || !st.id) return;
    let rb = d.querySelector(".rangee-bas");
    if (!rb) { const ce = d.querySelector(".cercle"); if (!ce) return; rb = document.createElement("div"); rb.className = "rangee-bas"; ce.replaceWith(rb); rb.appendChild(ce); neuf = true; }
    d.classList.toggle("gauche", parseFloat(d.style.getPropertyValue("--ecart")) < 0);
    // La largeur que cartes.js a donnée au siège : la vignette s'y ajuste (CSS) pour tenir sur la rangée du cercle.
    if (d.style.width) d.style.setProperty("--siege-w", d.style.width);
    let t = d.querySelector(".visage");
    if (!t) { t = document.createElement("div"); t.className = "visage"; rb.appendChild(t); neuf = true; }
    t.dataset.id = st.id; t.classList.toggle("moi", !!st.toi);
    rvRendreVignette(t, st);
  });
  // La rangée du bas a changé de hauteur et de largeur : cartes.js remesure les cartes et l'arc.
  if (neuf && typeof dimensionnerCartes === "function") dimensionnerCartes();
}
function rvRendre(id) {
  const t = document.querySelector(`#sieges .visage[data-id="${CSS.escape(id)}"]`);
  const st = T.sieges.find(s => s && s.id === id);
  if (t && st) rvRendreVignette(t, st); else if (!t && st) rvPoserVignettes();
}
function rvRendreMoi() { if (T.toi && T.toi.id) rvRendre(T.toi.id); }
// Ce que dit ma vignette quand elle n'a pas de flux.
function rvEtatMoi() {
  const e = RV.camEtat, r = RV.camRaison;
  if (e === "demande") return ["demande", "caméra…", "La caméra est demandée au navigateur."];
  if (e === "refusee") return ["ko", "refusée", r];
  if (e === "absente") return ["ko", "pas de caméra", r];
  if (e === "occupee") return ["ko", "occupée", r];
  if (e === "indisponible") return ["ko", "indisponible", r];
  if (e === "coupee") return ["ko", "coupée", r];
  return ["eteinte", "coupée", "Ta caméra est coupée : clique « Caméra » pour que tes amis te voient."];
}
// Ce que dit la vignette d'un ami sans flux, d'après l'état ICE de sa paire.
function rvEtatPair(id, st) {
  if (st.absent) return ["parti", "parti", "Il a quitté la table."];
  const e = RV.etats.get(id);
  if (RV.bloques.has(id) && e !== "connected" && e !== "completed")
    return ["bloque", "vidéo bloquée", RV.visio && RV.visio.sansRelais ? VI.SANS_RELAIS_MESSAGE : VI.AVEC_RELAIS_MESSAGE];
  if (!RV.visio) return ["attente", "en attente", "La visio n'est pas reliée."];
  if (e === "refuse") return ["ko", "table pleine", "Cinq caméras au plus : la sixième n'est pas relayée."];
  if (e === "indisponible") return ["ko", "pas de visio", "Ce navigateur n'a pas WebRTC."];
  if (e === "parti" || e === "closed") return ["parti", "parti", "Sa connexion est fermée."];
  if (e === "disconnected") return ["connexion", "coupure…", "Sa connexion hoquette ; on réessaie."];
  if (e === "connected" || e === "completed") return ["sanscam", "sans caméra", "Relié, mais sa caméra est coupée."];
  return ["connexion", "connexion…", "La visio se négocie avec " + (st.nom || "ce joueur") + "."];
}
function rvRendreVignette(t, st) {
  const moi = !!st.toi, id = st.id;
  const flux = moi ? (RV.tenu && CAM.cameraPartagee().flux) || null : RV.flux.get(id) || null;
  let etat = "ok", texte = "", titre = moi ? "Toi — en miroir" : (st.nom || "");
  if (!flux) [etat, texte, titre] = moi ? rvEtatMoi() : rvEtatPair(id, st);
  t.dataset.etat = etat;
  if (titre) t.title = titre; else t.removeAttribute("title");
  let v = t.querySelector("video");
  if (flux) {
    if (!v) {
      v = RV.videos.get(id) || document.createElement("video");
      v.autoplay = true; v.playsInline = true; v.muted = true; v.setAttribute("playsinline", ""); v.setAttribute("muted", "");
      RV.videos.set(id, v); t.prepend(v);
    }
    if (v.srcObject !== flux) v.srcObject = flux;
    v.play().catch(() => {});
    const s = t.querySelector(".silhouette"); if (s) s.remove();
  } else {
    if (v) v.remove();
    if (!t.querySelector(".silhouette")) t.insertAdjacentHTML("afterbegin", SILHOUETTE);
  }
  let e = t.querySelector(".visage-etat");
  if (!e) { e = document.createElement("span"); e.className = "visage-etat"; t.appendChild(e); }
  e.textContent = texte;
}

/* ── Le relais, dans ⚙ ──────────────────────────────────────────────────── */
function rvRelaisPhrase() {
  return VI.relaisConfigure(DB.turn)
    ? "Relais renseigné : il sera proposé à chaque nouvelle connexion vidéo (pas à celles déjà ouvertes). Teste-le une fois."
    : "Sans identifiants : STUN seul (stun.l.google.com). La vidéo passe en direct quand les deux connexions le permettent — un ami en 4G ou derrière un réseau strict ne se verra pas.";
}
function rvRendreRelais(txt, ok) {
  if (!$("turnUrl")) return;
  if (document.activeElement !== $("turnUrl")) $("turnUrl").value = DB.turn.url || "";
  if (document.activeElement !== $("turnUser")) $("turnUser").value = DB.turn.user || "";
  if (document.activeElement !== $("turnPass")) $("turnPass").value = DB.turn.pass || "";
  const e = $("turnEtat"); e.textContent = txt || rvRelaisPhrase();
  if (ok === undefined) delete e.dataset.ok; else e.dataset.ok = ok ? "1" : "0";
}
if ($("turnUrl")) {
  rvRendreRelais();
  [["turnUrl", "url"], ["turnUser", "user"], ["turnPass", "pass"]].forEach(([id, k]) => {
    $(id).addEventListener("input", () => { DB.turn[k] = $(id).value; garder(); rvRendreRelais(); });
  });
  $("turnTester").onclick = async () => {
    const b = $("turnTester"); b.disabled = true;
    rvRendreRelais("Test en cours — huit secondes au plus…");
    const r = await VI.testerRelais(DB.turn);
    b.disabled = false;
    rvRendreRelais(r.ok ? `✓ Relais joignable : un candidat relay en ${fr1(r.ms / 1000)} s${r.candidat ? " (" + r.candidat + (r.protocole ? ", " + r.protocole : "") + ")" : ""}. Il sera utilisé si la connexion directe échoue.`
      : "✗ " + r.raison, r.ok);
    son(r.ok ? "ok" : "ko");
  };
  // La feuille ⚙ emprunte le bloc #outils : à chaque ouverture, on relit ce qui est mémorisé.
  $("bReglages").addEventListener("click", () => setTimeout(() => rvRendreRelais(), 0));
}
