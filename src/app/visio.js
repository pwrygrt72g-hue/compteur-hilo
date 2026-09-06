/* ══════════════════════ LES TÊTES DES AMIS ══════════════════════
   LA VISIO AUTOUR DE LA TABLE À PLUSIEURS. Concaténé après reseau.js.
   Chaque siège tenu par un HUMAIN porte une vignette `.visage` (96×72 — pas `.tete`, qui est le conteneur de l'en-tête) à côté de son cercle de
   mise : les flux distants viennent de creerVisio (src/visio.mjs, maillage WebRTC
   signalé par le même courtier MQTT que la table), le tien de cameraPartagee
   (src/camera.mjs — la même caméra que le détecteur du mode Concentration, comptée par
   références).

   🚨 UNE VIGNETTE PAR SIÈGE, MAIS PAS UNE IMAGE PAR SIÈGE. La table compte huit
   places ; la vidéo s'arrête à six personnes (visio.mjs, VIDEO_MAX) parce que la
   SIGNALISATION ne suit pas au-delà — pas le débit, la signalisation. Les sièges
   au-delà gardent leur vignette, leur silhouette et leur nom, et la vignette DIT
   « son seul » : on s'entend et on se parle, on ne se voit pas. Ne va pas
   « réparer » ça en masquant ces vignettes ou en les noircissant : une place
   occupée qui n'affiche rien, c'est un siège qu'on croit vide.

   🔄 CE FICHIER A LONGTEMPS DIT « JAMAIS de micro : on compte en silence ». C'ÉTAIT UNE
   RÈGLE, ELLE EST LEVÉE — Léo, le 6 septembre 2026 : « c'est possible de rajouter la
   possibilité de parler entre nous sur la table ? » Le raisonnement d'origine (la parole
   détruit la mémoire de travail du comptage) n'était pas faux ; il concluait mal. On en
   tire maintenant la conclusion inverse et plus juste : LE SILENCE DEVIENT UN CHOIX, pas
   une impossibilité. Le micro arrive COUPÉ, toujours ; un bouton l'ouvre, un bouton le
   referme ; celui qui veut compter en silence ne clique pas et ne perd rien de ce qu'il
   avait avant. La trace reste ici pour qu'on ne « répare » pas cette page en y remettant
   le silence forcé : ce ne serait pas une correction, ce serait annuler une décision.
   Ce qui a été construit avec, et qu'il ne faut pas défaire :
   · le micro est une permission SÉPARÉE de la caméra (src/micro.mjs) — quelqu'un sans
     webcam doit pouvoir parler, et un refus de caméra ne doit pas emporter la voix ;
   · tout <video> reste `muted` et la voix des autres sort d'un <audio> DÉDIÉ par pair,
     sinon un ami qui coupe sa caméra deviendrait muet du même coup ;
   · qui parle se voit sur le SIÈGE (le nom en jade), pas seulement dans la vignette :
     c'est l'information qu'on cherche du coin de l'œil pendant qu'on compte.

   Comment on se greffe sans toucher au rendu de la scène :
   · reseau.js émet « sabot:reseau-entree » (le courtier est relié), « sabot:reseau-pairs »
     (la liste des pairs bouge) et « sabot:reseau-sortie » ; on s'y branche.
   · RS.onBrut est notre crochet sur les messages du courtier : les sujets visio/* sont
     pour nous, le reste repart à la table.
   · « sabot:sieges » (table.js) dit que les sièges viennent d'être redessinés : on y
     pose nos vignettes — dans une rangée `.rangee-bas` qui accueille aussi le cercle —
     puis on redemande à cartes.js de mesurer (la rangée compte dans la hauteur du siège).
   · Une vignette SANS flux est une silhouette et un mot, jamais un rectangle noir —
     et quand cet ami PARLE, la silhouette s'ÉCLAIRE au lieu de rester éteinte.
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
  $("bMicro").hidden = false; rvBoutonMicro();
  // La sortie audio naît AVANT le maillage : `onAudio` peut arriver dès la première
  // seconde, et un flux sans élément où le poser serait une voix perdue en silence.
  RVX.sortie = MIC.creerSortieAudio({ volume: DB.voixVolume / 100 });
  RVX.sortie.onBloque(b => { if ($("bSonAmis")) $("bSonAmis").hidden = !b; });
  const brut = d.api && d.api.brut;
  if (brut) {
    RV.visio = VI.creerVisio({
      reseau: brut, salon: d.code, moi: d.moi, nom: prenom() || "Joueur", turn: DB.turn,
      // `micro: null` est explicite : rvArreter vient de rendre la référence, on n'arrive
      // JAMAIS à une table en émettant. La voix se pose ensuite, par attacherMicro.
      flux: null, micro: null,
      onFlux: (id, flux) => { RV.flux.set(id, flux); rvRendre(id); },
      // ⚠️ Deux rappels, jamais un seul : `onFlux` ne voit que la VIDÉO, `onAudio` que la
      // VOIX. Pousser un flux sans image dans le <video> de la vignette ferait de la tête
      // de l'ami un rectangle noir le jour où il ouvre son micro.
      onAudio: (id, flux) => { if (!RVX.sortie) return; rvVumetrePair(id, RVX.sortie.poser(id, flux)); rvRendre(id); },
      onDepart: id => { RV.flux.delete(id); RV.etats.delete(id); RV.bloques.delete(id); RV.videos.delete(id); RVX.voix.delete(id);
        if (RVX.sortie) RVX.sortie.retirer(id); rvFermerVumetrePair(id); RVX.parlent.delete(id); rvRendre(id); },
      onEtat: rvEtat,
      // 🚨 « TU ES COUPÉE » — l'information la plus utilisée de toute application de
      // parole, et elle n'existait NULLE PART : le siège d'un ami était strictement
      // identique qu'il se taise, qu'il soit en sourdine ou qu'il n'ait jamais ouvert son
      // micro. Chacun annonce donc son état à la table (visio.mjs, `annoncerVoix`).
      onVoix: (id, v) => { RVX.voix.set(id, v); rvRendre(id); },
      onJournal: t => { if (window.__visioJournal) window.__visioJournal.push(t); },
    });
    RS.onBrut = (s, brut) => !!RV.visio && RV.visio.recevoir(s, brut);
    RV.visio.demarrer();
  }
  if (DB.camera) rvAllumer();
  // 🚨 ON NE PREND PLUS LE MICRO À L'ARRIVÉE, MÊME MÉMORISÉ. La version d'avant faisait
  // `if (DB.micro) rvPrendreMicro(false)` : rien n'était diffusé (la piste revenait en
  // sourdine), mais le CAPTEUR s'allumait — la pastille d'enregistrement de l'onglet et
  // le point orange du système apparaissaient sans qu'on ait rien touché, alors que ⚙
  // promet en toutes lettres « Micro fermé : rien n'est capté, et le voyant du navigateur
  // reste éteint ». Et le seul bouton rouge de la barre était là dès l'arrivée : l'instinct
  // est de cliquer dessus pour « réparer », ce qui mettait en diffusion. Ne rien reprendre
  // coûte UN clic et lève les deux. `DB.micro` reste la mémoire de ton dernier choix : il
  // sert à l'écran, plus à ouvrir le capteur tout seul.
  rvBoutonMicro(); rvVoixReglages();
  rvPoserVignettes();
}
function rvArreter() {
  if (RV.visio) { try { RV.visio.fermer(); } catch (e) {} }
  RV.visio = null; RS.onBrut = null;
  RV.flux.clear(); RV.etats.clear(); RV.bloques.clear(); RV.bloqueDit.clear(); RV.videos.clear(); RV.pairs = new Set();
  RVX.voix.clear(); RVX.annonce = "";
  rvEteindre();
  // La voix se rend exactement comme la caméra : le voyant du navigateur doit s'éteindre
  // en quittant la table, pas au prochain rechargement de la page.
  rvRendreMicro();
  for (const id of [...RVX.vumPairs.keys()]) rvFermerVumetrePair(id);
  RVX.parlent.clear();
  if (RVX.sortie) { try { RVX.sortie.fermer(); } catch (e) {} }
  RVX.sortie = null;
  if (RVX.boucle) { cancelAnimationFrame(RVX.boucle); RVX.boucle = 0; }
  $("bCamera").hidden = true;
  $("bMicro").hidden = true;
  $("bSonAmis").hidden = true;
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
// Suis-je en SON SEUL avec cet ami ? Le maillage relie huit personnes, mais les
// images s'arrêtent aux six premières assises (visio.mjs, VIDEO_MAX) — au-delà on
// se parle et on s'entend, on ne se voit pas. On lit le drapeau sur la paire
// elle-même plutôt que de passer par onEtat : les états ICE (« connected »…)
// écrasent tout ce qu'on poserait dans RV.etats, et le rationnement de l'image
// n'est pas un état de connexion, c'est une propriété de la paire.
//
// 🚨 CE DRAPEAU DIT « NI LUI NI MOI », ET C'EST CE QUI REND LA PHRASE HONNÊTE.
// Il a dit autre chose : jusqu'au 6 septembre 2026 il répondait « est-ce que
// J'ENVOIE mon image à lui ? », alors que la vignette qu'il étiquette montre ce
// que JE REÇOIS DE LUI. Les deux côtés ne classaient pas la table pareil (tri sur
// une horloge locale) : sur huit personnes, 12 paires sur 28 étaient asymétriques,
// et l'écran de celui qui ne recevait rien affichait « Relié, mais sa caméra est
// coupée » sur quelqu'un dont la caméra était allumée et qui émettait — soit
// exactement ce que le 🚨 vingt lignes plus bas interdit. visio.mjs décide
// désormais par PAIRE, sur une liste identique chez les deux : si l'un est en son
// seul, l'autre l'est aussi. Ne rebranche pas ce drapeau sur autre chose sans
// rendre la règle symétrique d'abord.
function rvSonSeul(id) {
  const p = RV.visio && RV.visio.pairs && RV.visio.pairs.get(id);
  return !!p && p.image === false;
}
// ⚠️ LES DEUX NOMBRES DE CES PHRASES SORTENT DES CONSTANTES, jamais de la frappe.
// Écrits en toutes lettres, ils MENTENT dès qu'on touche à VIDEO_MAX — et vu en
// capture le 6 septembre : un écran servi avec un plafond de trois annonçait
// tranquillement « vidéo limitée à 5 amis ». Un chiffre faux dans un message
// d'explication est pire que pas de message : il envoie chercher une cause qui
// n'existe pas.
// ⚠️ ON COMPTE DES PERSONNES ASSISES, PLUS DES « AMIS VISIBLES ». Depuis que le
// rationnement se décide par PAIRE (visio.mjs, repartirImages), la règle n'est plus
// « tu vois cinq personnes » — celui qui est hors de la tête de liste n'en voit
// AUCUNE. Ce qui est vrai pour tout le monde, c'est le seuil : les VIDEO_MAX
// premières personnes assises échangent leurs images. C'est donc ça qu'on affiche.
const rvPersonnesVideo = () => VI.VIDEO_MAX || 6;
const rvPersonnesMax = () => VI.PAIRS_MAX || 8;
// Ce que dit la vignette d'un ami sans flux, d'après l'état ICE de sa paire.
function rvEtatPair(id, st) {
  if (st.absent) return ["parti", "parti", "Il a quitté la table."];
  const e = RV.etats.get(id);
  // 🚨 « VIDÉO BLOQUÉE », « CINQ CAMÉRAS », « PAS DE VISIO » : trois libellés qui ne
  // parlaient que de l'image, alors que la VOIX voyage sur la même connexion et tombe
  // avec elle. Dans les trois cas on ne peut ni entendre ni être entendu, et le dire
  // « caméra » laissait croire qu'il restait la parole.
  // ⚠️ CE BLOC A LONGTEMPS AJOUTÉ « et pour la sixième personne d'une table, aucune
  // RTCPeerConnection n'est même créée » : c'était FAUX, et c'est précisément le
  // couplage que visio.mjs a défait. La sixième personne a une connexion complète et
  // une voix ; le refus sec (`ajouter()` rend null) ne tombe qu'au NEUVIÈME arrivant,
  // quand PAIRS_MAX est atteint. La phrase enseignait l'hypothèse « PAIRS_MAX =
  // VIDEO_MAX » que ce module passe cinquante lignes à démonter.
  if (RV.bloques.has(id) && e !== "connected" && e !== "completed")
    return ["bloque", "ni vu ni entendu", RV.visio && RV.visio.sansRelais ? VI.SANS_RELAIS_MESSAGE : VI.AVEC_RELAIS_MESSAGE];
  if (!RV.visio) return ["attente", "en attente", "La visio n'est pas reliée : ni image ni voix."];
  if (e === "refuse") return ["ko", "table pleine", rvPersonnesMax() + " personnes au plus autour de la table : au-delà, on n'est ni vu ni entendu."];
  if (e === "indisponible") return ["ko", "ni voix ni vidéo", "Ce navigateur n'a pas WebRTC : ni image ni voix."];
  if (e === "parti" || e === "closed") return ["parti", "parti", "Sa connexion est fermée."];
  if (e === "disconnected") return ["connexion", "coupure…", "Sa connexion hoquette ; on réessaie. Ni image ni voix en attendant."];
  // Relié sans image : la silhouette reste, mais si sa VOIX arrive elle s'éclaire et le
  // dit — « sans caméra » sur quelqu'un qu'on est en train d'entendre serait faux.
  //
  // 🚨 ET « SANS CAMÉRA » SERAIT FAUX AUSSI POUR UN SON SEUL : sa caméra est
  // peut-être allumée, c'est NOUS qui ne prenons pas son image. Le lui reprocher
  // sur sa vignette enverrait quelqu'un cliquer sur un bouton déjà allumé, puis
  // conclure que l'application est cassée. La limite se DIT, elle ne se devine
  // pas : la silhouette et le nom restent (jamais un rectangle noir), et le titre
  // explique que la voix, elle, passe dans les deux sens.
  if (e === "connected" || e === "completed") {
    const seul = rvSonSeul(id), qui = st.nom || "Ce joueur";
    if (RVX.parlent.has(id)) return ["sanscam", "parle", seul
      ? qui + " parle. Vous vous entendez, mais l'image s'arrête aux " + rvPersonnesVideo() + " premières personnes assises : aucun de vous deux ne voit l'autre."
      : "Il parle — sa caméra est coupée."];
    return seul
      ? ["sanscam", "son seul", "L'image s'arrête aux " + rvPersonnesVideo() + " premières personnes assises — tu es en son seul avec " + qui + " : vous vous entendez et vous vous parlez normalement, mais aucun de vous deux ne voit l'autre."]
      : ["sanscam", "sans caméra", "Relié, mais sa caméra est coupée."];
  }
  return ["connexion", "connexion…", "La visio se négocie avec " + (st.nom || "ce joueur") + "."];
}
function rvRendreVignette(t, st) {
  const moi = !!st.toi, id = st.id;
  const flux = moi ? (RV.tenu && CAM.cameraPartagee().flux) || null : RV.flux.get(id) || null;
  let etat = "ok", texte = "", titre = moi ? "Toi — en miroir" : (st.nom || "");
  if (!flux) [etat, texte, titre] = moi ? rvEtatMoi() : rvEtatPair(id, st);
  t.dataset.etat = etat;
  const vx = rvVoixTitre(st);
  const titreComplet = [titre, vx].filter(Boolean).join(" · ");
  if (titreComplet) t.title = titreComplet; else t.removeAttribute("title");
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
  // L'anneau de parole se REPOSE ici, et pas seulement au moment où quelqu'un ouvre la
  // bouche : table.js redessine les sièges à chaque carte, et une classe posée ailleurs
  // disparaîtrait au premier coup — on croirait que le micro s'est coupé tout seul.
  const parle = RVX.parlent.has(id);
  t.classList.toggle("parle", parle);
  const sg = t.closest(".siege"); if (sg) sg.classList.toggle("parle", parle);
  rvVoixVignette(t, st);
}
// Le micro d'un ami, sur sa vignette. Trois signes, trois questions différentes :
//   anneau jade + nom jade  · il parle EN CE MOMENT (le son reçu, hystérésis de micro.mjs)
//   point jade discret      · son micro est ouvert : il peut parler, et il t'entend
//   micro barré             · il s'est mis en SOURDINE — c'est le « tu es coupée » qu'on
//                             ne pouvait dire à personne jusqu'ici
//   rien                    · il n'a pas ouvert son micro (l'état par défaut, et le plus
//                             fréquent : une table qui compte en silence reste propre)
function rvVoixEtatDe(st) {
  if (st.toi) return RVX.tenu && RVX.etat === "active" ? (DB.pousserPourParler || !RVX.coupe ? "ouvert" : "coupe") : "ferme";
  return RVX.voix.get(st.id) || "";
}
function rvVoixVignette(t, st) {
  const v = rvVoixEtatDe(st);
  if (v === "ouvert" || v === "coupe") t.dataset.voix = v; else delete t.dataset.voix;
  let m = t.querySelector(".voix-marque");
  if (v !== "coupe") { if (m) m.remove(); return; }
  // Le mot « muet » est posé par la feuille (::before) : le marqueur n'est qu'un support,
  // et l'information part dans le `title` de la vignette — un `title` sur un enfant
  // aria-hidden ne serait lu par personne.
  if (!m) { m = document.createElement("span"); m.className = "voix-marque"; m.setAttribute("aria-hidden", "true"); t.appendChild(m); }
}
// La phrase du micro, ajoutée au titre de la vignette : c'est le seul endroit qu'un
// lecteur d'écran lit.
function rvVoixTitre(st) {
  const v = rvVoixEtatDe(st);
  if (v === "coupe") return st.toi ? "Tu es en sourdine." : (st.nom || "Ce joueur") + " s'est mis en sourdine : il ne t'entend pas parler pour rien.";
  if (v === "ouvert") return st.toi ? "Ton micro est ouvert." : (st.nom || "Ce joueur") + " a son micro ouvert.";
  return "";
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

/* ══════════════════════ LA VOIX ══════════════════════
   Se parler autour de la table (Léo, 6 septembre 2026 — cf. l'en-tête : le « jamais de
   micro » d'origine est levé, le silence est devenu un choix). Le transport est fait
   ailleurs et ne se réécrit pas ici : micro.mjs tient le capteur (compté par références,
   MUET tant qu'on n'a pas ouvert) et visio.mjs porte la piste dans le transcepteur audio
   qui existe depuis la création de chaque paire. Il reste, ici, l'écran :

   · UN BOUTON, SIX ÉTATS, et le libellé change avec eux — « Micro » / « Micro… » /
     « Je parle » / « Micro coupé » / « Maintiens M » / la panne (« Micro refusé »,
     « Pas de micro », « Micro occupé »…). Un point de couleur seul ne se lit pas quand
     on est en train de compter des cartes. LARGEUR FIXE : c'est le bouton qu'on bascule
     le plus souvent, il poussait « Plus » de 54 px à chaque coupure et on ratait sa
     cible. La barre sous le bouton est TON niveau : c'est la réponse à « est-ce que mon
     micro marche ? », la première question de tout le monde, et elle doit se répondre
     SANS parler à personne. Elle bat même en sourdine, parce que micro.mjs mesure une
     COPIE de la piste exprès pour ça — d'où sa couleur, qui suit l'état. ⚠️ Le niveau
     dit « ça capte », JAMAIS « on m'entend » : c'est pourquoi le bouton, lui, compte les
     paires réellement reliées avant d'affirmer que la table t'entend (rvQuiEntend).
   · UNE PANNE RESTE ÉCRITE, et dit quoi faire ensuite. Un bandeau de quatre secondes
     puis un bouton redevenu identique à ce qu'il était avant le clic, c'est un écran
     qu'on croit mort : on reclique, on rerate le bandeau, on abandonne. La caméra garde
     bien son « refusée » en rouge sur la vignette, indéfiniment.
   · UN TÉMOIN HORS TABLE. #bMicro part avec la barre de la table dès qu'on change
     d'écran ; sans lui, on continuait de parler à toute la table sans un signe nulle
     part. Il ne coupe rien tout seul — être coupé sans l'avoir demandé serait pire — il
     MONTRE, et il donne le bouton pour se taire.
   · UN <audio> PAR PAIR, hors champ mais DANS le document, et tous les <video> restent
     `muted`. Si la voix sortait du <video> de la vignette, un ami qui coupe sa caméra
     deviendrait muet du même coup et personne ne comprendrait pourquoi. Et sur Chrome,
     un flux distant qui n'est lu nulle part ne s'analyse pas : sans cet élément joué,
     le vumètre des autres resterait plat et on croirait que personne ne parle.
   · QUI PARLE se voit SUR LE SIÈGE (le nom qui s'éclaircit vers le jade, un anneau sur
     la vignette), à hystérésis — l'anneau s'allume à la voix et ne s'éteint qu'après un
     silence tenu, sinon il clignoterait à chaque syllabe et on cesserait de le regarder.
     ⚠️ Le nom s'ÉCLAIRCIT : le jade pur, seule couleur du nuancier proche du feutre, lui
     faisait PERDRE du contraste (4,19:1 → 3,48:1, mesuré au pixel) au moment précis où
     il a quelque chose à dire.
   · ET QUI EST EN SOURDINE. « Tu es coupée » est l'information la plus utilisée de toute
     application de parole, et elle n'existait nulle part : trois situations sans rapport
     — il se tait, il est coupé, il n'a jamais ouvert son micro — donnaient exactement le
     même siège. Chacun ANNONCE donc son micro à la table (visio.mjs, `annoncerVoix`), et
     la vignette porte un point jade (ouvert) ou un « muet » cinabre (en sourdine). Rien
     du tout pour « pas de micro » : c'est le cas le plus fréquent, une table qui compte
     en silence doit rester propre. ⚠️ En appui-pour-parler on annonce « ouvert » et non
     la sourdine de chaque syllabe : deux messages par phrase noieraient le courtier.
   · L'OR EST AU JEU, LE JADE EST À LA VOIX. L'or dit « c'est son tour », « c'est sa
     mise », « sa vidéo est reliée » ; un anneau or qui voudrait dire « il parle » se
     lirait comme « c'est à lui de jouer ». Deux langages, jamais mélangés.
   · Là où la vidéo marche, la voix marche : le site oui, artefact non (le
     WebSocket y est bloqué et reseau.js le dit en moins de trois secondes — on n'arrive
     jamais jusqu'ici, donc le micro n'est jamais demandé pour rien). Aucun chemin
     d'échec de plus.
   ═══════════════════════════════════════════════════════════════════ */
const MIC = M.micro;
const RVX = { sortie: null, tenu: false, etat: "eteinte", raison: "", coupe: true, abonne: false,
  vum: null, vumPairs: new Map(), parlent: new Set(), boucle: 0, dernierTic: 0, pousse: false,
  // La voix des AUTRES, telle qu'ils l'annoncent : « ouvert », « coupe », « ferme ».
  voix: new Map(), annonce: "" };
// 🚨 UNE PANNE DE MICRO LAISSE UNE TRACE, comme un refus de caméra en laisse une sur la
// vignette du siège. Avant, un refus tenait 4,2 s de bandeau puis le bouton redevenait
// EXACTEMENT ce qu'il était avant le clic : celui qui regardait ses cartes ratait le
// bandeau, recliquait, reratait, et concluait que le bouton était mort. Ces états-là
// SURVIVENT donc à la fermeture, et chacun dit ce qu'il faut faire ensuite — un message
// qui nomme la panne sans nommer la sortie est un cul-de-sac.
const RV_PANNES = {
  refusee:      ["Micro refusé",  "Rouvre-le depuis le cadenas, à gauche de la barre d'adresse, puis reclique."],
  absente:      ["Pas de micro",  "Branche un micro ou un casque, puis reclique."],
  occupee:      ["Micro occupé",  "Ferme l'autre application qui l'utilise (visio, enregistreur), puis reclique."],
  indisponible: ["Micro bloqué",  ""],
  coupee:       ["Micro arrêté",  "Rebranche ton casque, ou rends l'autorisation dans la barre d'adresse, puis reclique."],
};
const rvPanne = () => RV_PANNES[RVX.etat] || null;
if (DB.micro === undefined) DB.micro = false;
if (typeof DB.voixVolume !== "number" || isNaN(DB.voixVolume)) DB.voixVolume = 100;
if (DB.pousserPourParler === undefined) DB.pousserPourParler = false;

/* ── Le bouton de la barre ──────────────────────────────────────────────── */
function rvEtatBouton() {
  if (RVX.tenu) {
    if (RVX.etat === "demande") return "demande";
    if (RVX.etat === "active") return RVX.coupe ? (DB.pousserPourParler ? "arme" : "coupe") : "ouvert";
  }
  // Tenu ou pas : une panne se dit. C'est la seule trace qui reste quand le bandeau est parti.
  return rvPanne() ? "panne" : "eteint";
}
function rvBoutonMicro() {
  const b = $("bMicro"); if (!b) return;
  const e = rvEtatBouton();
  b.dataset.etat = e;
  // `aria-pressed` dit « on t'entend », rien d'autre : tenir le micro en sourdine n'est
  // pas parler, et un lecteur d'écran qui annoncerait « activé » sur un micro muet
  // ferait exactement le contresens qu'on essaie d'éviter.
  b.setAttribute("aria-pressed", e === "ouvert" ? "true" : "false");
  const pa = rvPanne();
  // ⚠️ « Maintiens M », pas « Micro coupé », en appui-pour-parler : le rouge permanent se
  // lisait comme une panne, et le geste évident — cliquer dessus — RENDAIT le micro,
  // c'est-à-dire l'exact contraire de ce qu'on cherchait. Le mode se dit sur le bouton,
  // pas seulement dans une infobulle qu'on ne survole pas en pleine main.
  const mot = e === "ouvert" ? "Je parle" : e === "arme" ? "Maintiens M" : e === "coupe" ? "Micro coupé"
    : e === "demande" ? "Micro…" : e === "panne" && pa ? pa[0] : "Micro";
  const t = b.querySelector(".voix-txt");
  if (t) t.textContent = mot;
  b.title = e === "ouvert" ? rvQuiEntend()
    : e === "arme" ? "Micro tenu, en sourdine — maintiens M pour parler (clique pour le rendre)"
    : e === "coupe" ? "Tu es en sourdine — clique pour parler"
    : e === "demande" ? "Le micro est demandé au navigateur… — clique pour annuler"
    : e === "panne" && pa ? (RVX.raison || pa[0]) + (pa[1] ? " " + pa[1] : "")
    : "Ta voix, pour parler à la table — muet tant que tu ne l'ouvres pas";
  // Le libellé change, le mot lu par un lecteur d'écran aussi : sans ça, « Micro refusé »
  // ne serait qu'une couleur pour qui ne voit pas l'écran.
  b.setAttribute("aria-label", e === "panne" && pa ? pa[0] + " — " + (RVX.raison || "") : mot);
  if (e !== "ouvert" && e !== "coupe" && e !== "arme") b.style.setProperty("--voix", "0");
  rvVoixTemoin();
}
// La barre de niveau et les anneaux : une seule boucle, qui s'arrête d'elle-même quand
// plus aucun vumètre ne vit. Elle échantillonne à ~20 Hz : l'œil ne voit pas la
// différence avec 60, et on ne réveille pas le processeur pour rien pendant une partie.
function rvBoucleVoix() {
  if (RVX.boucle) return;
  const pas = () => {
    RVX.boucle = 0;
    const t = (window.performance || Date).now();
    if (t - RVX.dernierTic >= 45) { RVX.dernierTic = t; rvTicVoix(); }
    if (RVX.vum || RVX.vumPairs.size) RVX.boucle = requestAnimationFrame(pas);
  };
  RVX.boucle = requestAnimationFrame(pas);
}
function rvTicVoix() {
  const b = $("bMicro");
  if (RVX.vum) {
    // RMS 0,17 remplit la barre : une voix normale à trente centimètres tourne autour de
    // 0,02 à 0,08 (micro.mjs). Sans ce facteur la barre ne quitterait jamais le premier
    // dixième et ne prouverait rien.
    if (b) b.style.setProperty("--voix", Math.min(1, RVX.vum.niveau() * 6).toFixed(3));
    rvMarquerParle(RV.moi, !RVX.coupe && RVX.vum.parle());
  }
  for (const [id, v] of RVX.vumPairs) rvMarquerParle(id, v.parle());
}
// Un seul endroit qui décide « celui-là parle » : il ne touche au DOM qu'aux TRANSITIONS.
// L'hystérésis de micro.mjs en fait quelques-unes par phrase, pas soixante par seconde.
function rvMarquerParle(id, oui) {
  if (!id || oui === RVX.parlent.has(id)) return;
  if (oui) RVX.parlent.add(id); else RVX.parlent.delete(id);
  rvRendre(id);
}
function rvVumetrePair(id, el) {
  rvFermerVumetrePair(id);
  const c = typeof ac === "function" ? ac() : null;
  if (!c || !el || !el.srcObject) return;
  // ⚠️ On mesure `el.srcObject`, c'est-à-dire le flux que cet <audio> EST EN TRAIN DE
  // LIRE. Chrome ne rend que du silence sur un flux distant qui n'est joué nulle part.
  const v = MIC.creerVumetre({ ac: c, flux: el.srcObject });
  if (v && v.vivant) { RVX.vumPairs.set(id, v); rvBoucleVoix(); } else if (v) v.fermer();
}
function rvFermerVumetrePair(id) {
  const v = RVX.vumPairs.get(id); if (!v) return;
  RVX.vumPairs.delete(id); try { v.fermer(); } catch (e) {}
}

/* ── « On t'entend » ne s'affirme pas sans regarder ─────────────────────── */
// 🚨 « La table t'entend » était dit SANS jamais regarder s'il y avait une table, ni si
// elle recevait quoi que ce soit : seul à une table, connexions en échec, ou lecture du
// son bloquée chez l'autre, l'écran affirmait exactement la même chose. Et la jauge jade
// sous le bouton ne prouve rien de plus — micro.mjs mesure une COPIE de ta propre
// capture, elle bat pareil quand aucun octet ne quitte la machine. On compte donc les
// paires RÉELLEMENT reliées, et on le dit.
function rvAudienceVoix() {
  if (!RV.visio) return { autres: 0, relies: 0, relie: false };
  let autres = 0, relies = 0;
  for (const id of RV.pairs) {
    if (id === RV.moi) continue;
    autres++;
    const e = RV.etats.get(id);
    if (e === "connected" || e === "completed") relies++;
  }
  return { autres, relies, relie: true };
}
function rvQuiEntend() {
  const { autres, relies, relie } = rvAudienceVoix();
  if (!relie) return "Micro ouvert, mais la visio n'est pas reliée : personne ne t'entend.";
  if (!autres) return "Micro ouvert — tu es seul à la table pour l'instant.";
  if (!relies) return "Micro ouvert, mais aucune connexion n'aboutit : personne ne t'entend encore.";
  if (relies < autres) return "Micro ouvert : " + relies + " joueur" + (relies > 1 ? "s" : "") + " sur " + autres + " t'entendent — clique pour te couper.";
  return "Micro ouvert : " + (autres > 1 ? "les " + autres + " autres t'entendent" : "l'autre joueur t'entend") + " — clique pour te couper.";
}
// 🚨 HORS DE LA VUE « TABLE », #bMicro EST CACHÉ AVEC ELLE — et plus rien à l'écran ne
// disait qu'on était en train de parler. On ouvrait son micro, on allait voir « Progrès »,
// et on continuait de parler à la table sans un signe nulle part (le voyant du navigateur
// restant le seul témoin). On ne coupe PAS pour autant — être coupé sans avoir rien
// demandé serait pire — on le MONTRE, et on donne le bouton pour se taire.
function rvVoixTemoin() {
  const t = $("voixTemoin"); if (!t) return;
  const e = rvEtatBouton();
  const parle = e === "ouvert" || e === "arme" || e === "coupe";
  const cache = !$("bMicro") || $("bMicro").hidden || !$("bMicro").offsetParent;
  const on = parle && cache;
  t.hidden = !on;
  if (!on) return;
  t.dataset.etat = e;
  const m = t.querySelector(".voix-txt");
  if (m) m.textContent = e === "ouvert" ? "Micro ouvert" : "Micro en sourdine";
  t.title = e === "ouvert" ? "Tu parles toujours à la table — clique pour te couper"
    : "Ton micro est tenu, en sourdine — clique pour le rendre";
}

/* ── Prendre, ouvrir, couper, rendre ────────────────────────────────────── */
// `ouvrir` vrai = prendre ET ouvrir en un geste (micro.mjs le fait pour qu'on ne puisse
// pas se retrouver, sans le vouloir, avec un micro tenu et muet que l'écran croit ouvert).
async function rvPrendreMicro(ouvrir) {
  const mic = MIC.microPartage();
  if (RVX.tenu) { if (ouvrir) rvCouper(false); return; }
  if (!RVX.abonne) {
    RVX.abonne = true;
    // Le micro peut mourir sans nous : casque débranché, permission retirée dans la barre
    // d'adresse. On le DIT, au lieu de laisser quelqu'un parler dans le vide.
    mic.onEtat((etat, raison) => {
      if (!RVX.tenu) return;
      RVX.etat = etat; RVX.raison = raison || "";
      // 🚨 UN MICRO QUI S'ARRÊTE TOUT SEUL EST L'ÉVÉNEMENT LE PLUS ALARMANT DU LOT — il
      // avait le bandeau le plus court (2,6 s contre 4,2 pour un refus) et, pire,
      // rvRendreMicro effaçait l'état juste avant : trente secondes plus tard l'écran
      // disait « Micro fermé : rien n'est capté », la phrase d'une fermeture VOULUE.
      // On garde donc la panne, et on la dit aussi longtemps qu'un refus.
      if (etat === "coupee") { rvRendreMicro(true); DB.micro = false; garder(); rvBandeauPanne(); return; }
      rvBoutonMicro(); rvRendreMoi(); rvVoixReglages(); rvAnnoncerVoix();
    });
    // La sourdine peut aussi être posée depuis ⚙ ou par la touche M : une seule vérité.
    mic.onSourdine(c => { RVX.coupe = c; if (c) rvMarquerParle(RV.moi, false); rvBoutonMicro(); rvRendreMoi(); rvVoixReglages(); rvAnnoncerVoix(); });
  }
  RVX.tenu = true; RVX.etat = "demande"; RVX.raison = ""; rvBoutonMicro(); rvVoixReglages();
  const r = ouvrir ? await mic.ouvrir() : await mic.prendre();
  if (!RVX.tenu) return;                     // rendu pendant la demande : la référence est déjà lâchée
  RVX.etat = r.etat; RVX.raison = r.raison || ""; RVX.coupe = mic.estCoupe();
  if (r.flux) {
    if (RV.visio) RV.visio.attacherMicro(r.flux);
    const c = typeof ac === "function" ? ac() : null;
    if (c) { RVX.vum = mic.mesurer(c); rvBoucleVoix(); }
  } else {
    RVX.tenu = false; mic.rendre(); DB.micro = false; garder();
    rvBandeauPanne();
  }
  rvBoutonMicro(); rvRendreMoi(); rvVoixReglages(); rvAnnoncerVoix();
}
// Le bandeau d'une panne : la phrase de micro.mjs (ce qui s'est passé) ET la sortie (quoi
// faire ensuite). Sans la seconde, recliquer rejoue le même bandeau indéfiniment — après
// un refus dur, Chrome ne redemande plus, et rien à l'écran ne dit qu'il faut passer par
// le cadenas de la barre d'adresse.
function rvBandeauPanne() {
  const pa = rvPanne();
  const phrase = RVX.raison || (pa ? pa[0] : "Micro indisponible ici.");
  bandeau(phrase + (pa && pa[1] ? " " + pa[1] : ""), 5200);
}
// `garderPanne` : le micro s'est arrêté TOUT SEUL — l'état reste pour que l'écran puisse
// encore le dire dans une minute. Une fermeture voulue, elle, efface tout.
function rvRendreMicro(garderPanne) {
  if (RVX.tenu) { RVX.tenu = false; MIC.microPartage().rendre(); }
  RVX.vum = null;                             // micro.mjs ferme le vumètre au dernier rendu
  if (RV.visio) RV.visio.attacherMicro(null);
  if (!garderPanne) { RVX.etat = "eteinte"; RVX.raison = ""; }
  RVX.coupe = true; RVX.pousse = false;
  rvMarquerParle(RV.moi, false);
  rvBoutonMicro(); rvRendreMoi(); rvVoixReglages(); rvAnnoncerVoix();
}
function rvCouper(v) {
  if (!RVX.tenu) return;
  MIC.microPartage().couper(v);               // onSourdine rafraîchit l'écran
}
// Ce que la table doit savoir de ma voix : « ouvert », « coupe » (tenu mais muet),
// « ferme » (pas de micro du tout).
// ⚠️ EN APPUI-POUR-PARLER, LA SOURDINE VA ET VIENT À CHAQUE SYLLABE : l'annoncer telle
// quelle publierait deux messages par phrase sur un courtier qui en jette au-delà de
// dix par seconde — et ferait clignoter un badge chez tout le monde. Dans ce mode, un
// micro tenu est un micro ARMÉ : on annonce « ouvert », et c'est l'anneau de parole
// (qui, lui, vient du son reçu) qui dit quand ça parle vraiment.
function rvVoixAnnoncable() {
  if (!RVX.tenu || RVX.etat !== "active") return "ferme";
  if (DB.pousserPourParler) return "ouvert";
  return RVX.coupe ? "coupe" : "ouvert";
}
function rvAnnoncerVoix() {
  if (!RV.visio || !RV.visio.annoncerVoix) return;
  const v = rvVoixAnnoncable();
  if (v === RVX.annonce) return;              // rien de neuf : rien ne part
  RVX.annonce = v; RV.visio.annoncerVoix(v);
}
$("bMicro").onclick = () => {
  // 🚨 PENDANT L'INVITE DE PERMISSION, UN CLIC VEUT DIRE « ANNULE ». Il voulait dire
  // « bascule la sourdine » — sur une sourdine pas encore établie, que le `couper(false)`
  // de `ouvrir()` écrasait ensuite de toute façon : mesuré, TROIS clics « annuler »
  // pendant une invite finissaient en « Je parle », micro diffusé. Le geste qui voulait
  // arrêter était exactement celui qui garantissait d'être entendu. On rend donc la
  // référence : micro.mjs voit qu'on a tout rendu pendant la demande et ARRÊTE la piste
  // qu'il vient d'obtenir (rien ne s'allume). Un double-clic d'impatience annule aussi —
  // c'est un clic à refaire, contre une diffusion qu'on n'a pas demandée.
  if (RVX.tenu && RVX.etat === "demande") { DB.micro = false; garder(); rvRendreMicro(); return; }
  if (!RVX.tenu) { DB.micro = true; garder(); rvPrendreMicro(!DB.pousserPourParler); }
  // En « appuyer pour parler », le bouton n'a que deux positions : tenu, ou fermé. Le
  // basculer en sourdine n'aurait aucun sens — c'est la touche qui commande la parole.
  else if (DB.pousserPourParler) { DB.micro = false; garder(); rvRendreMicro(); }
  else rvCouper(!RVX.coupe);
};
$("bSonAmis").onclick = () => { if (RVX.sortie) RVX.sortie.rejouer(); };
// Le témoin hors table : le seul moyen de se taire quand la barre de la table n'est plus
// là. Il ferme le micro plutôt que de le mettre en sourdine — on n'est plus à la table,
// on n'y revient pas par ce bouton.
if ($("voixTemoin")) $("voixTemoin").onclick = () => { DB.micro = false; garder(); rvRendreMicro(); };

/* ── Appuyer pour parler : M, et rien d'autre ───────────────────────────── */
// ⚠️ `m` est la SEULE lettre libre dans les quatre vues de clavier.js : t/r/d/s/a sont
// les coups, 1-6 les jetons, Espace et Entrée distribuent, les flèches répondent aux
// exercices, Retour arrière reprend un jeton. Une touche qui volerait un coup au
// blackjack serait pire que pas de raccourci du tout. Les gardes sont les mêmes que
// celles de clavier.js — champ de saisie, modale ouverte, vue courante.
// 🚨 UN RELÂCHÉ FERME TOUJOURS. C'était le défaut le plus grave de tout ce chantier : les
// trois gardes ci-dessous (champ de saisie, modale ouverte, vue courante) s'appliquaient
// AUSSI au `keyup`, si bien qu'une modale ouverte entre l'appui et le relâché faisait
// sortir la fonction avant la sourdine — et le micro restait OUVERT, indéfiniment, dans
// le mode qu'on choisit précisément pour NE PAS l'être. L'application fournissait
// elle-même le déclencheur : reseau.js ouvre « Plus un jeton » toute seule dès que le
// tapis passe sous la mise minimum. Ces gardes existent pour ne pas VOLER un coup au
// blackjack ; un relâché ne vole rien, aucune n'a de raison de s'y appliquer.
function rvRelacher() {
  if (!RVX.pousse) return;
  RVX.pousse = false; rvCouper(true);
}
function rvTouchePousser(e, enfonce) {
  if (!DB.pousserPourParler || !RVX.tenu) return;
  if ((e.key || "").toLowerCase() !== "m") return;
  if (!enfonce) { if (!RVX.pousse) return; e.preventDefault(); rvRelacher(); return; }
  if (e.repeat) return;
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target && e.target.tagName)) return;
  if ($("modale") && !$("modale").hidden) return;
  if (vue !== "table") return;        // socle.js (premier morceau) l'a posé bien avant
  e.preventDefault();
  RVX.pousse = true; rvCouper(false);
}
document.addEventListener("keydown", e => rvTouchePousser(e, true));
document.addEventListener("keyup", e => rvTouchePousser(e, false));
// Changer de fenêtre en pleine phrase ne doit pas laisser le micro ouvert : le `keyup`
// n'arrive jamais si la page a perdu le focus, et on parlerait sans le savoir. Même
// raison pour l'onglet qu'on quitte et pour la vue qu'on change — trois portes de sortie
// pour un `keyup` qui peut ne jamais venir.
window.addEventListener("blur", rvRelacher);
document.addEventListener("visibilitychange", () => { if (document.hidden) rvRelacher(); });
document.addEventListener("sabot:vue", () => { rvRelacher(); rvVoixTemoin(); });

/* ── La voix, dans ⚙ ────────────────────────────────────────────────────── */
// L'appareil réellement pris, tel que le navigateur le nomme : « est-ce le bon micro ? »
// ne se répond pas autrement. Le CHOIX, lui, se fait dans le navigateur — micro.mjs prend
// l'entrée par défaut du système, et lui passer un deviceId n'est pas de notre ressort.
function rvNomMicro() {
  const f = MIC.microPartage().flux, p = f && f.getAudioTracks && f.getAudioTracks()[0];
  return (p && p.label) || "";
}
// À TABLE ou non : c'est la question que ⚙ ne se posait pas, et c'est ce qui rendait son
// bouton dangereux (cf. plus bas).
const rvALaTable = () => !!(typeof T === "object" && T && T.reseau);
function rvVoixPhrase() {
  const pa = rvPanne();
  if (!RVX.tenu) {
    // Une panne survit à la fermeture : dire « rien n'est capté » après un casque
    // débranché, c'est décrire une fermeture volontaire qui n'a pas eu lieu.
    if (pa) return (RVX.raison || pa[0]) + (pa[1] ? " " + pa[1] : "");
    return "Micro fermé : rien n'est capté, et le voyant du navigateur reste éteint.";
  }
  if (RVX.etat === "demande") return "Le micro est demandé au navigateur…";
  if (RVX.etat !== "active") return pa ? (RVX.raison || pa[0]) + (pa[1] ? " " + pa[1] : "") : (RVX.raison || "Micro indisponible ici.");
  const nom = rvNomMicro();
  return (RVX.coupe
    ? (DB.pousserPourParler ? "Micro tenu, en sourdine : maintiens M pour parler." : "Micro tenu, en sourdine : personne ne t'entend.")
    : rvQuiEntend().replace(/ — clique pour te couper\.$/, ".")) + (nom ? " Appareil : " + nom + "." : "");
}
function rvVoixReglages() {
  if (!$("voixEtat")) return;
  const e = $("voixEtat"); e.textContent = rvVoixPhrase();
  // Vert = on t'entend. Rouge = ça a échoué. NEUTRE pour « tenu, en sourdine » : c'est
  // un état voulu, pas une panne — le peindre en rouge ferait chercher un problème.
  const ok = !RVX.tenu || RVX.etat === "demande" ? null : RVX.etat !== "active" ? "0" : RVX.coupe ? null : "1";
  if (ok === null) delete e.dataset.ok; else e.dataset.ok = ok;
  const b = $("voixBascule");
  if (b) { b.textContent = RVX.tenu ? "Fermer mon micro" : "Ouvrir mon micro";
    // 🚨 HORS D'UNE TABLE, CE BOUTON PRENAIT LE MICRO POUR RIEN — et il n'y avait plus
    // AUCUN moyen de le rendre à l'écran : #bMicro n'est révélé qu'à l'arrivée à une
    // table, donc il restait caché, pendant que ⚙ affirmait « la table t'entend » alors
    // qu'il n'y avait pas de table. Le voyant d'enregistrement du navigateur s'allumait
    // et y restait. Sans table, il n'y a personne à qui parler : le bouton se ferme.
    b.disabled = !RVX.tenu && !rvALaTable();
    b.title = RVX.tenu ? "Rend le micro : le voyant du navigateur s'éteint"
      : b.disabled ? "Assieds-toi à une table à plusieurs : c'est là qu'on se parle"
      : "Demande le micro et ouvre la parole"; }
  const h = $("voixHorsTable"); if (h) h.hidden = RVX.tenu || rvALaTable();
  if ($("voixVol") && document.activeElement !== $("voixVol")) $("voixVol").value = DB.voixVolume;
  if ($("voixVolL")) $("voixVolL").textContent = DB.voixVolume + " %";
  if ($("voixPousser")) $("voixPousser").checked = !!DB.pousserPourParler;
}
if ($("voixBascule")) {
  rvVoixReglages();
  $("voixBascule").onclick = () => {
    if (RVX.tenu) { DB.micro = false; garder(); rvRendreMicro(); }
    else if (!rvALaTable()) bandeau("Assieds-toi à une table à plusieurs : c'est là qu'on se parle.", 4200);
    else { DB.micro = true; garder(); rvPrendreMicro(!DB.pousserPourParler); }
  };
  $("voixVol").addEventListener("input", () => {
    DB.voixVolume = Math.max(0, Math.min(100, +$("voixVol").value || 0)); garder();
    if (RVX.sortie) RVX.sortie.volume(DB.voixVolume / 100);
    $("voixVolL").textContent = DB.voixVolume + " %";
  });
  $("voixPousser").addEventListener("change", () => {
    DB.pousserPourParler = !!$("voixPousser").checked; garder();
    // Passer en « appuyer pour parler » alors qu'on est OUVERT doit couper tout de suite :
    // sinon on continue d'être diffusé en croyant le contraire.
    if (DB.pousserPourParler && RVX.tenu && !RVX.coupe) rvCouper(true);
    RVX.pousse = false; rvBoutonMicro(); rvVoixReglages();
  });
  $("bReglages").addEventListener("click", () => setTimeout(() => rvVoixReglages(), 0));
}
