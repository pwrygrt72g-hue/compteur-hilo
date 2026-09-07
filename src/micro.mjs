// Un seul micro pour toute l'application, compté par références. Jumeau de camera.mjs.
//
// ⚠️ LE MICRO EST UNE PERMISSION SÉPARÉE DE LA CAMÉRA, et ce fichier existe pour ça.
// Ajouter `audio: true` aux contraintes de camera.mjs aurait été deux lignes de moins
// et faux trois fois : quelqu'un sans webcam ne pourrait plus parler ; un refus de
// caméra emporterait la voix ; et le détecteur de visage du mode Concentration, qui
// prend la caméra pour surveiller ton attention, allumerait un micro que personne n'a
// demandé. Deux capteurs, deux permissions, deux voyants, deux modules.
//
// ⚠️ COUPÉ À L'ARRIVÉE, TOUJOURS. `prendre()` rend une piste EN SOURDINE : on tient le
// capteur, on n'émet rien. Personne n'est diffusé sans avoir cliqué — c'est ce qui
// permet de garder l'esprit d'origine (« on compte en silence ») tout en donnant la
// parole à qui la veut. Le bouton « parler » de l'écran appelle `ouvrir()`, qui est
// `prendre()` suivi de `couper(false)` ; s'il appelait `prendre()` seul, il tiendrait
// un micro muet et personne ne comprendrait pourquoi. Au dernier `rendre()`, la
// sourdine se remet toute seule : la fois d'après on arrive muet à nouveau.
//
// ⚠️ NE PAS CONFONDRE `coupee` ET `estCoupe()`. L'ÉTAT `coupee` veut dire « le micro
// s'est arrêté TOUT SEUL » (permission retirée dans la barre d'adresse, casque
// débranché) : il faut une phrase à l'écran. `estCoupe()` veut dire « TU t'es mis en
// sourdine » : la piste est vivante, il faut un bouton. Les deux mots se ressemblent,
// les deux situations n'ont rien à voir. Les noms d'états sont ceux de camera.mjs, au
// féminin comme là-bas, parce que ce sont des IDENTIFIANTS de contrat — l'écran peut
// traiter les deux capteurs avec le même aiguillage. La prose, elle, est dans `raison`
// et parle bien du micro.
//
// Rien ici ne lève : un refus, un micro absent ou occupé se lit dans `etat` et
// `raison`. L'appelant affiche une phrase, il ne rattrape pas une exception.

// ⚠️ LES TROIS TRAITEMENTS SONT OBLIGATOIRES, l'annulation d'écho en premier : cinq
// personnes dans la même pièce virtuelle, sans elle, produisent un larsen en trois
// secondes — chacun renvoie dans son micro ce qui sort de ses haut-parleurs. Le bruit
// et le gain automatique, eux, rendent audible un portable posé sur une table.
// `video: false` est explicite, pas implicite : c'est la moitié du sujet de ce fichier.
export const CONTRAINTES_MICRO = {
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  video: false,
};

// Les mêmes états que la caméra, mot pour mot (cf. l'en-tête) :
//   eteinte        personne ne le tient
//   demande        getUserMedia est en cours
//   active         une piste tourne, `flux` est posé (en sourdine tant qu'on n'a pas ouvert)
//   refusee        tu as dit non (ou la page publiée n'y a pas droit)
//   absente        aucun micro sur cet appareil
//   occupee        une autre application tient le capteur
//   indisponible   pas de navigator.mediaDevices : contexte non sécurisé, ou
//                  page enveloppée sans droit micro (l'artefact)
//   coupee         la piste s'est arrêtée toute seule (débranchée, permission retirée)
export const ETATS_MICRO = ["eteinte", "demande", "active", "refusee", "absente", "occupee", "indisponible", "coupee"];

// Les seuils du vumètre, à HYSTÉRÉSIS : on s'allume à `OUVRE`, on ne s'éteint qu'en
// dessous de `FERME` et seulement après `MAINTIEN_MS` de calme. Avec un seuil unique,
// l'anneau du siège clignote à chaque syllabe — entre deux mots, la voix passe sous
// n'importe quel seuil. Mesuré à l'oreille : 0,02 en RMS, c'est une voix normale à
// trente centimètres ; 0,012, c'est le souffle de la pièce.
export const SEUIL_OUVRE = 0.02;
export const SEUIL_FERME = 0.012;
export const MAINTIEN_MS = 400;

function classerErreur(e) {
  const n = (e && e.name) || "";
  if (n === "NotAllowedError" || n === "PermissionDeniedError" || n === "SecurityError") return ["refusee", "Tu as refusé le micro, ou cette page n'y a pas droit."];
  if (n === "NotFoundError" || n === "DevicesNotFoundError" || n === "OverconstrainedError") return ["absente", "Aucun micro sur cet appareil."];
  if (n === "NotReadableError" || n === "TrackStartError" || n === "AbortError") return ["occupee", "Une autre application tient déjà le micro."];
  return ["indisponible", "Micro indisponible ici (" + (n || "erreur inconnue") + ")."];
}

// ── Le vumètre ─────────────────────────────────────────────────────────────
// Rend { niveau(), parle(), fermer() }. Ne lève jamais : sans contexte audio, sans
// flux ou sans AnalyserNode, il rend un vumètre MORT (niveau 0, parle false) plutôt
// qu'une exception — un indicateur de volume ne doit jamais casser une conversation.
//
// ⚠️ ON NE CRÉE PAS D'AudioContext ICI. L'appelant passe le sien (socle.js en fabrique
// un au chargement, `creerAC()`). Un second contexte coûte plus d'une demi-seconde de
// gel à l'ouverture et peut être refusé net par le navigateur hors geste utilisateur.
//
// ⚠️ SUR CHROME, UN FLUX DISTANT NE S'ANALYSE QUE S'IL EST AUSSI EN TRAIN D'ÊTRE LU.
// Un AnalyserNode branché sur un MediaStream venu d'une RTCPeerConnection rend du
// silence tant que ce flux n'est pas attaché à un élément média en cours de lecture.
// Garde donc l'élément <audio> dans le document et joue-le (cf. creerSortieAudio) :
// sans ça le vumètre des autres reste plat et on croit que personne ne parle.
//
// La lecture est « tirée », pas « poussée » : rien ne tourne en boucle ici, c'est
// l'appel à niveau() ou parle() qui échantillonne. L'écran décide de sa cadence — et
// un écran qui cesse de demander ne consomme plus rien.
export function creerVumetre({ ac, flux, ouvre = SEUIL_OUVRE, ferme = SEUIL_FERME, maintien = MAINTIEN_MS } = {}) {
  let source = null, an = null, tampon = null, actif = false, depuis = 0, dernier = 0, mort = false;
  try {
    if (ac && flux && typeof ac.createMediaStreamSource === "function" && flux.getAudioTracks && flux.getAudioTracks().length) {
      // Le contexte peut dormir (aucun geste depuis le chargement) : un contexte
      // suspendu rend des zéros, ce qui se lit comme « il ne parle pas ».
      if (ac.state === "suspended" && ac.resume) ac.resume().catch(() => {});
      source = ac.createMediaStreamSource(flux);
      an = ac.createAnalyser();
      an.fftSize = 512; an.smoothingTimeConstant = 0.2;
      source.connect(an);
      // ⚠️ L'analyseur est un CUL-DE-SAC : on ne le connecte JAMAIS à ac.destination.
      // Le faire rejouerait ta propre voix dans tes haut-parleurs, avec le retard du
      // traitement — c'est-à-dire le larsen que l'annulation d'écho essaie d'éviter.
      tampon = new Float32Array(an.fftSize);
    }
  } catch (e) { source = null; an = null; }
  const lire = () => {
    if (!an || mort) return 0;
    try { an.getFloatTimeDomainData(tampon); } catch (e) { return dernier; }
    let s = 0; for (let i = 0; i < tampon.length; i++) s += tampon[i] * tampon[i];
    const n = Math.sqrt(s / tampon.length);
    dernier = n;
    const t = Date.now();
    if (n >= ouvre) { actif = true; depuis = t; }
    else if (n >= ferme) { depuis = t; }                       // encore au-dessus du seuil bas : on tient
    else if (actif && t - depuis > maintien) actif = false;    // vraiment silencieux, et depuis assez longtemps
    return n;
  };
  return {
    // Le volume instantané, de 0 à 1 (RMS). 0 si le vumètre est mort.
    niveau() { return lire(); },
    // Vrai tant que ça parle, hystérésis comprise. Échantillonne au passage.
    parle() { lire(); return actif; },
    // Vrai si ce vumètre ne mesurera jamais rien (pas de contexte, pas de piste).
    get vivant() { return !!an; },
    fermer() {
      mort = true; actif = false; dernier = 0;
      try { if (source) source.disconnect(); } catch (e) {}
      try { if (an) an.disconnect(); } catch (e) {}
      source = null; an = null;
    },
  };
}

// ── Le son des autres ──────────────────────────────────────────────────────
// Un élément <audio> DÉDIÉ par pair, jamais le <video> de sa vignette.
//
// 🚨 UN <video> RESTE `muted`, TOUJOURS. Si le son distant sortait du <video> de la
// vignette, un ami qui coupe sa caméra deviendrait MUET du même coup — la vignette
// n'a plus d'élément vidéo, donc plus de son, et personne ne comprendrait pourquoi.
// L'image et la voix arrivent par deux pistes indépendantes : elles sortent par deux
// éléments indépendants. Et ton propre flux ne se rejoue JAMAIS chez toi.
//
// 🚨 LA LECTURE AUTOMATIQUE PEUT ÊTRE REFUSÉE. `play()` rend une promesse qui peut
// être rejetée par la politique du navigateur (aucun geste sur la page). On l'attrape,
// on le DIT (`onBloque`) et `rejouer()` relance tout d'un coup — c'est ce que fait le
// bouton « 🔊 Activer le son ». Un silence sans explication fait croire que la
// fonction ne marche pas ; ici on a une phrase et un bouton.
export function creerSortieAudio({ conteneur = null, volume = 1 } = {}) {
  const elements = new Map();   // ⚠️ pas de `this` dans ce qui suit : l'appelant déstructure
  const abonnes = new Set();
  let bloque = false, vol = Math.max(0, Math.min(1, volume));
  const hote = () => conteneur || (typeof document !== "undefined" ? document.body : null);
  const dire = () => abonnes.forEach(f => { try { f(bloque); } catch (e) {} });
  const jouer = a => {
    const p = a.play();
    if (p && p.catch) p.catch(() => { if (!bloque) { bloque = true; dire(); } });
  };
  const sortie = {
    // Pose (ou remplace) le flux audio d'un pair. Rend l'élément, pour qu'un vumètre
    // puisse s'y brancher en sachant qu'il est bien en train d'être lu (cf. Chrome).
    poser(id, flux) {
      const h = hote(); if (!h) return null;
      let a = elements.get(id);
      if (!a) {
        a = document.createElement("audio");
        a.autoplay = true; a.playsInline = true; a.setAttribute("playsinline", "");
        a.dataset.pair = id;
        // Hors de l'écran mais DANS le document : un élément détaché ne joue pas, et
        // un flux qui ne joue pas ne s'analyse pas.
        a.style.cssText = "position:absolute;width:0;height:0;opacity:0;pointer-events:none";
        elements.set(id, a); h.appendChild(a);
      }
      if (a.srcObject !== flux) a.srcObject = flux;
      a.volume = vol; a.muted = false;
      jouer(a);
      return a;
    },
    retirer(id) {
      const a = elements.get(id); if (!a) return;
      elements.delete(id);
      try { a.pause(); a.srcObject = null; a.remove(); } catch (e) {}
    },
    element(id) { return elements.get(id) || null; },
    // Le volume des autres, de 0 à 1 (le réglage de ⚙).
    volume(v) {
      if (v !== undefined) { vol = Math.max(0, Math.min(1, Number(v) || 0)); elements.forEach(a => { a.volume = vol; }); }
      return vol;
    },
    // Le bouton « 🔊 Activer le son » : dans un geste utilisateur, tout repart.
    rejouer() { bloque = false; elements.forEach(jouer); dire(); return !bloque; },
    get bloque() { return bloque; },
    onBloque(f) { abonnes.add(f); return () => abonnes.delete(f); },
    get pairs() { return [...elements.keys()]; },
    fermer() { for (const id of [...elements.keys()]) sortie.retirer(id); abonnes.clear(); },
  };
  return sortie;
}

// ── Le micro partagé ───────────────────────────────────────────────────────
// L'usine. Dans l'APPLICATION on passe toujours par `microPartage()` : deux micros
// créés à la main, ce sont deux getUserMedia, deux voyants, et sur certains appareils
// le second échoue parce que le premier tient le capteur. `creerMicro()` est là pour
// les tests, qui ont besoin d'une machine à états neuve à chaque fois.
export function creerMicro() {
  let refs = 0, flux = null, etat = "eteinte", raison = "", detail = "", enCours = null;
  let coupe = true;                       // en sourdine à l'arrivée, toujours
  let vumetre = null, pisteMesure = null;
  const abonnes = new Set(), sourdineAbonnes = new Set();
  const poser = (e, r, d) => { etat = e; raison = r || ""; detail = d || ""; abonnes.forEach(f => { try { f(etat, raison, flux); } catch (_) {} }); };
  const direSourdine = () => sourdineAbonnes.forEach(f => { try { f(coupe); } catch (_) {} });
  const appliquer = () => { if (flux) flux.getAudioTracks().forEach(t => { try { t.enabled = !coupe; } catch (_) {} }); };
  const fermerMesure = () => {
    if (vumetre) { try { vumetre.fermer(); } catch (_) {} vumetre = null; }
    if (pisteMesure) { try { pisteMesure.stop(); } catch (_) {} pisteMesure = null; }
  };
  const eteindre = () => {
    fermerMesure();
    if (flux) flux.getTracks().forEach(t => { try { t.stop(); } catch (_) {} });
    flux = null;
  };
  const demander = async () => {
    if (!navigator || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      poser("indisponible", "Pas de micro dans ce contexte : ouvre le site plutôt que la page publiée.", "navigator.mediaDevices absent");
      return null;
    }
    poser("demande", "");
    try {
      const f = await navigator.mediaDevices.getUserMedia(CONTRAINTES_MICRO);
      // La piste peut mourir sans nous : casque débranché, permission retirée dans la
      // barre d'adresse. On le DIT, au lieu de laisser quelqu'un parler dans le vide.
      f.getAudioTracks().forEach(t => t.addEventListener("ended", () => {
        if (flux !== f) return;
        eteindre(); poser("coupee", "Le micro s'est arrêté.");
      }));
      // Quelqu'un a tout rendu pendant la demande : on n'allume pas un voyant que
      // personne ne regarde.
      if (refs <= 0) { f.getTracks().forEach(t => t.stop()); poser("eteinte", ""); return null; }
      flux = f; appliquer(); poser("active", ""); return f;
    } catch (e) {
      const [ee, rr] = classerErreur(e);
      // `detail` garde le nom et le message techniques : la phrase est pour l'écran, le détail pour le journal.
      poser(ee, rr, ((e && e.name) || "") + (e && e.message ? " : " + e.message : "")); return null;
    }
  };
  // Compte les CHANGEMENTS de sourdine. Sert à `ouvrir()` : cf. l'avertissement là-bas.
  let versionSourdine = 0;
  const api = {
    // Prend une référence. Rend TOUJOURS { flux, etat, raison, coupe } — jamais une
    // exception. La piste rendue est EN SOURDINE : tenir le micro n'est pas parler.
    async prendre() {
      refs++;
      if (flux) return { flux, etat, raison, coupe };
      if (!enCours) enCours = demander().finally(() => { enCours = null; });
      const f = await enCours;
      return { flux: f, etat, raison, coupe };
    },
    // Prendre ET ouvrir, en un geste : c'est ce que fait le bouton « parler ». Séparé
    // de `prendre()` pour qu'on ne puisse pas se retrouver, sans le vouloir, avec un
    // micro tenu et muet que l'écran croit ouvert.
    //
    // 🚨 SI QUELQU'UN A TOUCHÉ À LA SOURDINE PENDANT LA DEMANDE, SON GESTE GAGNE. Cet
    // `await` dure le temps que le navigateur affiche son invite de permission, c'est-à-dire
    // aussi longtemps qu'on veut : pendant ce temps un clic sur le bouton, la touche M ou ⚙
    // peuvent demander la sourdine. Un `couper(false)` inconditionnel à l'arrivée écrasait
    // ces gestes — mesuré : TROIS clics « me couper » pendant l'invite finissaient en micro
    // OUVERT, c'est-à-dire l'exact contraire de ce qu'on venait de demander trois fois. On
    // n'ouvre donc que si personne n'a rien dit entre-temps.
    async ouvrir() {
      const v = versionSourdine;
      const r = await api.prendre();
      if (r.flux && versionSourdine === v) api.couper(false);
      return { flux: r.flux, etat, raison, coupe };
    },
    // Rend une référence. Au dernier rendu, le capteur s'éteint ET la sourdine
    // revient : la prochaine arrivée est muette, comme la première.
    rendre() {
      refs = Math.max(0, refs - 1);
      if (refs > 0) return;
      const tenait = !!flux || !!vumetre;
      eteindre();
      if (!coupe) { coupe = true; direSourdine(); }
      // Un refus ou un appareil absent GARDE son état : l'écran doit pouvoir dire
      // pourquoi ça n'a pas marché même après avoir tout rendu. On ne repasse à
      // « eteinte » que si on tenait vraiment quelque chose.
      if (tenait) poser("eteinte", "");
    },
    // La sourdine. `couper(true)` met en sourdine, `couper(false)` ouvre.
    //
    // 🚨 ON BASCULE `enabled`, ON NE RETIRE PAS LA PISTE. C'est instantané, ça ne
    // renégocie rien, et le pair d'en face ne voit pas sa connexion vaciller — alors
    // qu'un replaceTrack(null) déclenche une ronde de négociation à chaque clic, et
    // sous le quota du courtier MQTT une ronde de plus, c'est une ronde qui se perd.
    // Conséquence à connaître : une piste coupée n'émet PLUS RIEN, donc un vumètre
    // branché dessus lirait zéro — c'est pour ça que `mesurer()` écoute une copie.
    couper(v) {
      // ⚠️ La version bouge à chaque APPEL, pas à chaque changement : `couper(true)` sur
      // un micro déjà muet ne change rien, mais c'est bien quelqu'un qui vient de dire
      // « tais-moi » — et c'est exactement ce que `ouvrir()` ne doit pas écraser (le
      // micro arrive muet, donc pendant l'invite l'annulation est toujours un no-op).
      versionSourdine++;
      const n = v === undefined ? !coupe : !!v;
      if (n === coupe) return coupe;
      coupe = n; appliquer(); direSourdine();
      return coupe;
    },
    estCoupe() { return coupe; },
    // S'abonner à la sourdine : f(coupe). Renvoie le désabonnement.
    onSourdine(f) { sourdineAbonnes.add(f); return () => sourdineAbonnes.delete(f); },
    // S'abonner aux changements d'état : f(etat, raison, flux). Renvoie le désabonnement.
    onEtat(f) { abonnes.add(f); return () => abonnes.delete(f); },
    // Branche le vumètre sur TA voix, avec l'AudioContext de l'appelant (socle.js).
    //
    // ⚠️ IL MESURE UNE COPIE DE LA PISTE, et c'est tout l'intérêt : la piste envoyée
    // est mise en sourdine par `enabled = false`, ce qui la rend SILENCIEUSE pour
    // n'importe quel analyseur. Sans copie, « est-ce que mon micro marche ? » — la
    // première question de tout le monde — ne se répondrait qu'en parlant à quelqu'un.
    // La copie est un clone du même capteur : ni permission ni voyant de plus, et elle
    // ne part nulle part (l'analyseur ne sort sur rien).
    // ⚠️ `niveau()` dit donc « mon micro capte », JAMAIS « on m'entend ». C'est
    // `estCoupe()` qui dit si on t'entend, et l'écran doit distinguer les deux.
    mesurer(ac) {
      if (vumetre) return vumetre;
      if (!flux || !ac) return null;
      let source = flux;
      try {
        const p = flux.getAudioTracks()[0];
        if (p && typeof p.clone === "function" && typeof MediaStream === "function") {
          pisteMesure = p.clone(); pisteMesure.enabled = true;
          source = new MediaStream([pisteMesure]);
        }
      } catch (e) { source = flux; }        // pas de clone : on mesure la piste réelle, donc zéro en sourdine
      vumetre = creerVumetre({ ac, flux: source });
      return vumetre;
    },
    // 0 à 1 : ce que le micro capte, en sourdine comme ouvert. 0 sans `mesurer()`.
    niveau() { return vumetre ? vumetre.niveau() : 0; },
    // Vrai tant que ça parle (hystérésis). Faux sans `mesurer()`.
    parle() { return vumetre ? vumetre.parle() : false; },
    get vumetre() { return vumetre; },
    get flux() { return flux; },
    get etat() { return etat; },
    get raison() { return raison; },
    get detail() { return detail; },
    get references() { return refs; },
    get coupe() { return coupe; },
  };
  return api;
}

let INSTANCE = null;
export function microPartage() {
  if (!INSTANCE) INSTANCE = creerMicro();
  return INSTANCE;
}
