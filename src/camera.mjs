// Une seule caméra pour toute l'application, comptée par références.
//
// Le détecteur de visage du mode Concentration et la visio autour de la table
// veulent la même chose : ta caméra frontale, en petit. Deux getUserMedia
// séparés allumeraient deux fois le voyant, demanderaient deux fois la
// permission, et sur certains téléphones le second échoue parce que le premier
// tient déjà le capteur. Ici, on ne demande qu'une fois ; chacun prend une
// référence, la rend quand il a fini, et la caméra s'éteint au dernier rendu.
//
// ⚠️ VIDÉO SEULE — et depuis le 6 SEPTEMBRE 2026 ce n'est plus une interdiction,
// c'est un PARTAGE DU TRAVAIL. Ce fichier portait jusque-là « JAMAIS DE MICRO.
// Décision : on ne demande jamais l'audio. La parole détruit la mémoire de travail
// du comptage — on compte en silence ». LÉO A LEVÉ CETTE DÉCISION LE 6 SEPTEMBRE
// 2026 : on peut se parler autour de la table. Le silence n'est plus une
// impossibilité, c'est le CHOIX DE CHACUN — on arrive micro coupé, un bouton
// l'ouvre, un bouton le referme. Qui veut compter en silence ne touche à rien.
//
// 🚨 MAIS L'AUDIO NE REVIENT PAS ICI : il vit dans micro.mjs, un module jumeau avec
// sa propre permission et son propre compteur de références. Ajouter `audio: true`
// aux contraintes ci-dessous serait plus court et faux trois fois : quelqu'un sans
// webcam ne pourrait plus parler ; un refus de caméra emporterait la voix ; et le
// détecteur de visage du mode Concentration, qui prend la caméra pour surveiller ton
// attention, allumerait un micro que personne n'a demandé. `audio: false` reste donc
// écrit noir sur blanc, et c'est délibéré — ce n'est pas un oubli à combler.
//
// Rien ici ne lève : un refus, une caméra absente ou occupée se lit dans
// `etat` et `raison`. L'appelant affiche une phrase, il ne rattrape pas une
// exception.

// 320×240 à 15 images par seconde : des vignettes, pas du cinéma. C'est ce
// qui tient dans un maillage à cinq sans faire souffler un portable.
export const CONTRAINTES = {
  video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15, max: 15 }, facingMode: "user" },
  audio: false,
};

// États possibles, tous explicites :
//   eteinte        personne ne la tient
//   demande        getUserMedia est en cours
//   active         un flux tourne, `flux` est posé
//   refusee        tu as dit non (ou la page publiée n'y a pas droit)
//   absente        aucune caméra sur cet appareil
//   occupee        une autre application tient le capteur
//   indisponible   pas de navigator.mediaDevices : contexte non sécurisé, ou
//                  page enveloppée sans droit caméra (l'artefact)
//   coupee         le flux s'est arrêté tout seul (câble, permission retirée)
export const ETATS_CAMERA = ["eteinte", "demande", "active", "refusee", "absente", "occupee", "indisponible", "coupee"];

function classerErreur(e) {
  const n = (e && e.name) || "";
  if (n === "NotAllowedError" || n === "PermissionDeniedError" || n === "SecurityError") return ["refusee", "Tu as refusé la caméra, ou cette page n'y a pas droit."];
  if (n === "NotFoundError" || n === "DevicesNotFoundError" || n === "OverconstrainedError") return ["absente", "Aucune caméra sur cet appareil."];
  if (n === "NotReadableError" || n === "TrackStartError" || n === "AbortError") return ["occupee", "Une autre application tient déjà la caméra."];
  return ["indisponible", "Caméra indisponible ici (" + (n || "erreur inconnue") + ")."];
}

let INSTANCE = null;

export function cameraPartagee() {
  if (INSTANCE) return INSTANCE;
  let refs = 0, flux = null, etat = "eteinte", raison = "", detail = "", enCours = null;
  const abonnes = new Set();
  const poser = (e, r, d) => { etat = e; raison = r || ""; detail = d || ""; abonnes.forEach(f => { try { f(etat, raison, flux); } catch (_) {} }); };
  const eteindre = () => {
    if (flux) flux.getTracks().forEach(t => { try { t.stop(); } catch (_) {} });
    flux = null;
  };
  const demander = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      poser("indisponible", "Pas de caméra dans ce contexte : ouvre le site (GitHub Pages) plutôt que la page publiée.", "navigator.mediaDevices absent");
      return null;
    }
    poser("demande", "");
    try {
      const f = await navigator.mediaDevices.getUserMedia(CONTRAINTES);
      // Le voyant peut s'éteindre sans nous : permission retirée dans la barre
      // d'adresse, caméra débranchée. On le DIT au lieu d'afficher une vignette noire.
      f.getVideoTracks().forEach(t => t.addEventListener("ended", () => {
        if (flux !== f) return;
        eteindre(); poser("coupee", "La caméra s'est arrêtée.");
      }));
      // Quelqu'un a tout rendu pendant la demande : on n'allume pas un voyant
      // que personne ne regarde.
      if (refs <= 0) { f.getTracks().forEach(t => t.stop()); poser("eteinte", ""); return null; }
      flux = f; poser("active", ""); return f;
    } catch (e) {
      const [ee, rr] = classerErreur(e);
      // `detail` garde le nom et le message techniques : la phrase est pour l'écran, le détail pour le journal.
      poser(ee, rr, ((e && e.name) || "") + (e && e.message ? " : " + e.message : "")); return null;
    }
  };
  INSTANCE = {
    // Prend une référence. Rend TOUJOURS { flux, etat, raison } — jamais une exception.
    async prendre() {
      refs++;
      if (flux) return { flux, etat, raison };
      if (!enCours) enCours = demander().finally(() => { enCours = null; });
      const f = await enCours;
      return { flux: f, etat, raison };
    },
    // Rend une référence. Au dernier rendu, le voyant s'éteint.
    rendre() {
      refs = Math.max(0, refs - 1);
      if (refs === 0 && flux) { eteindre(); poser("eteinte", ""); }
    },
    // S'abonner aux changements d'état : f(etat, raison, flux). Renvoie le désabonnement.
    onEtat(f) { abonnes.add(f); return () => abonnes.delete(f); },
    get flux() { return flux; },
    get etat() { return etat; },
    get raison() { return raison; },
    get detail() { return detail; },
    get references() { return refs; },
  };
  return INSTANCE;
}
