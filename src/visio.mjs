// La visio autour de la table : chacun voit les vignettes des autres sièges.
//
// ══ Comment ça marche ══════════════════════════════════════════════════════
// Maillage complet (mesh) : chaque pair ouvre UNE RTCPeerConnection vers
// chacun des autres, jusqu'à cinq pairs — un par siège. À cinq, ça fait
// quatre flux sortants de 320×240 à 15 i/s par personne : ~1 Mbit/s de
// montée, ce qu'une 4G moyenne tient. Au-delà de cinq il faudrait un serveur
// qui mélange les flux, et on n'en a pas.
//
// La SIGNALISATION (offres, réponses, candidats ICE) passe par le courtier
// MQTT public de net.mjs — le même que les cartes du mode « À plusieurs ». Pas
// de serveur à nous. Sujets :
//   compteur-hilo/v1/<salon>/visio/<de>/tous   présence (salut·adieu), à tout le monde
//   compteur-hilo/v1/<salon>/visio/<de>/<a>    signalisation adressée à UN pair
// ⚠️ Comme pour les cartes : deux amis reliés à deux courtiers différents ne se
// voient pas. net.mjs prend le premier courtier qui répond ; il est le même
// pour tout le monde presque toujours, pas absolument toujours.
//
// La NÉGOCIATION est la « négociation parfaite » du W3C : les deux côtés
// peuvent offrir en même temps, le côté POLI (l'identifiant lexicographiquement
// le plus petit) annule sa propre offre et répond à l'autre. En pratique on
// ÉVITE la collision : l'impoli offre tout de suite, le poli attend 2,5 s et
// n'offre que si rien n'est venu. Trickle ICE, mais PAR LOTS (cf. ci-dessous).
// Sur `failed`, on redémarre ICE.
//
// ⚠️ MESURÉ LE 4 SEPTEMBRE 2026 : broker.emqx.io — le premier de la liste de
// net.mjs, donc le courtier de presque tout le monde — NE DÉLIVRE QUE ~10
// MESSAGES PAR SECONDE ET PAR CLIENT, et jette le reste SANS RIEN DIRE
// (40 messages d'un coup : 10 arrivent ; espacés de 250 ms : tous). HiveMQ et
// Mosquitto délivrent tout. Le trickle ICE naïf — un message par candidat, huit
// à dix par paire et par côté — dépassait ce quota dès qu'un troisième pair
// arrivait : ICE se connectait mais la seconde ronde de négociation se perdait,
// et un flux sur deux ne passait pas (vu au banc, quatre fois sur quatre).
// D'où, quel que soit le courtier :
//   · une FILE D'ENVOI cadencée à un message par 130 ms par client ;
//   · les candidats ICE partent PAR LOTS (250 ms), et chaque offre ou réponse
//     EMPORTE les candidats déjà connus ;
//   · une offre sans réponse est RENVOYÉE après 4 s (avec ses candidats) —
//     un message perdu coûte quatre secondes, jamais la visio.
//
// La PRÉSENCE : un `salut` à l'arrivée puis toutes les deux secondes, un
// `adieu` au départ — et le TESTAMENT MQTT de net.mjs publie cet adieu à ta
// place si ton onglet meurt brutalement (le courtier le fait dès que la
// connexion tombe, en moins d'une seconde). Sans testament, un pair mort
// n'est vu qu'au silence : sept secondes sans salut, ou trois si ICE est
// tombé en même temps. Dans tous les cas moins de douze.
//
// ══ Où ça marche, où c'est mort ═══════════════════════════════════════════
// · GitHub Pages (https://pwrygrt72g-hue.github.io/compteur-hilo/) : tout
//   marche — WebSocket vers le courtier, caméra, WebRTC, STUN et TURN.
// · L'ARTEFACT Claude : MORT. Sa politique de sécurité bloque tout WebSocket
//   externe, SANS erreur visible — la connexion échoue en quelques
//   millisecondes et net.mjs le dit (« connexion refusée »). La visio doit
//   détecter ça en moins de trois secondes (`sonderReseau`, 2,5 s au plus) et
//   afficher `MESSAGE_ARTEFACT` avec le lien GitHub Pages, plutôt qu'une
//   roue qui tourne. La caméra y est le plus souvent refusée aussi (iframe
//   sans droit caméra) — camera.mjs le dit à son tour.
//
// ══ Où va la vidéo ════════════════════════════════════════════════════════
// NULLE PART ailleurs que chez tes amis. Le maillage est pair-à-pair : la
// vidéo va directement de ton navigateur au leur, chiffrée (DTLS-SRTP, c'est
// le protocole, pas une option). Le courtier MQTT ne voit que les offres et
// les candidats — du texte de négociation, jamais une image. Quand deux
// réseaux ne se voient pas (NAT symétriques, boîtes d'entreprise), le TURN
// d'Open Relay RELAIE les paquets — mais chiffrés de bout en bout, il ne peut
// pas les lire. Sans TURN, « ça marche chez moi » et pas chez l'ami ; c'est
// lui qui fait passer les réseaux difficiles. STUN (Google) ne sert qu'à
// apprendre son adresse publique. Ni l'un ni l'autre ne stocke quoi que ce soit.
//
// ⚠️ PAS DE MICRO. Vidéo seule, par décision (cf. camera.mjs) : on compte en
// silence, la parole détruit la mémoire de travail.

import { sujet } from "./net.mjs";

export const PAIRS_MAX = 5;
export const LIEN_PAGES = "https://pwrygrt72g-hue.github.io/compteur-hilo/";
export const MESSAGE_ARTEFACT = "La visio ne peut pas marcher sur cette page publiée : sa politique de sécurité bloque les connexions vers le courtier. Ouvre le site pour voir tes amis : " + LIEN_PAGES;
export const SERVEURS_ICE = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: ["turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:443", "turns:openrelay.metered.ca:443"],
    username: "openrelayproject", credential: "openrelayproject" },
];
export const SALUT_INTERVALLE_MS = 2000;   // un salut toutes les 2 s (quarante octets — rien, même à cinq)
export const SILENCE_MAX_MS = 7000;        // 7 s sans salut = parti (repli si le testament n'est pas arrivé)
export const SILENCE_ICE_MS = 3000;        // ICE coupé ET 3 s sans salut = parti (un onglet mort, pas un réseau qui hoquette)
export const ENVOI_ECART_MS = 130;         // un message par 130 ms par client : sous le quota d'emqx (~10/s), mesuré
export const LOT_CANDIDATS_MS = 250;       // les candidats ICE partent par lots de 250 ms
export const ATTENTE_POLIE_MS = 2500;      // le poli laisse l'impoli offrir d'abord
export const REOFFRE_MS = 4000;            // une offre sans réponse est renvoyée après 4 s

export const sujetVisio = (salon, de, a) => `${sujet(salon)}/visio/${de}/${a}`;
// Le testament à donner à net.connecter() : l'adieu que le courtier publiera
// pour toi si ton onglet meurt. Sans lui, tes amis te voient dix secondes de trop.
export const testamentVisio = (salon, moi) => ({ sujet: sujetVisio(salon, moi, "tous"), message: JSON.stringify({ t: "adieu" }) });

// Détecte en moins de trois secondes si le réseau est mort (artefact, proxy
// d'entreprise). Rend true si UN WebSocket vers `url` s'ouvre, false sinon.
// Ne lève jamais.
export function sonderReseau(url, delai = 2500) {
  return new Promise(res => {
    let ws, fini = false;
    const conclure = v => { if (fini) return; fini = true; clearTimeout(m); try { ws && ws.close(); } catch (_) {} res(v); };
    const m = setTimeout(() => conclure(false), delai);
    try { ws = new WebSocket(url, "mqtt"); } catch (e) { return conclure(false); }
    ws.onopen = () => conclure(true);
    ws.onerror = () => conclure(false);
    ws.onclose = () => conclure(false);
  });
}
// Ce que dit la visio quand rien ne passe : la phrase + le lien, jamais une roue.
export function expliquerEchec(e) {
  const msg = (e && e.message) || "";
  if (/refus|poignée|délai|aucun courtier/i.test(msg) || !msg) return MESSAGE_ARTEFACT;
  return "La visio n'a pas pu se connecter (" + msg + "). " + MESSAGE_ARTEFACT;
}

const hex = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(x => x.toString(16).padStart(2, "0")).join(""); };

// creerVisio({ reseau, salon, moi, flux?, nom?, onFlux, onDepart, onEtat, onJournal? })
//   reseau   : l'api de net.connecter() — { publier(sujet, message), souscrire(sujet) }
//   salon    : le code du salon (le même que pour les cartes)
//   moi      : mon identifiant dans le salon (celui des pairs de net.mjs)
//   flux     : mon MediaStream local (camera.mjs), ou rien — je verrai sans être vu
//   onFlux(id, MediaStream)   un flux distant est arrivé (ou a changé)
//   onDepart(id)              ce pair est parti, sa vignette doit disparaître
//   onEtat(id, etat)          ice : new·checking·connected·completed·disconnected·failed·closed
//                             + refuse (sixième pair), + parti
// Rend { demarrer(), recevoir(sujet, brut), attacherFlux(flux), arrivee(id), depart(id),
//        fermer(), pairs (Map id → { id, pc, session, polite, ice }) }.
// ⚠️ L'appelant DOIT relayer chaque message reçu de net.mjs à `recevoir` : net.mjs
// n'a qu'un seul onMessage, posé à la connexion. Les sujets étrangers sont ignorés.
export function creerVisio({ reseau, salon, moi, flux = null, nom = "", onFlux, onDepart, onEtat, onJournal } = {}) {
  const session = hex(6);            // change à chaque rechargement : un pair relancé est reconnu comme neuf
  const pairs = new Map();
  const base = `${sujet(salon)}/visio/`;
  let local = flux, salutMinuteur = null, menageMinuteur = null, ferme = false;
  const journal = (...a) => { if (onJournal) try { onJournal(a.join(" ")); } catch (_) {} };
  const etat = (id, e) => { if (onEtat) try { onEtat(id, e); } catch (_) {} };
  const publier = (a, o) => { try { reseau.publier(base + moi + "/" + a, JSON.stringify(Object.assign({ s: session }, o))); } catch (e) { journal("publication ratée", e.message); } };

  // ── La file d'envoi cadencée ─────────────────────────────────────────────
  // Tout ce qui part passe ici, un message par ENVOI_ECART_MS. Le courtier
  // emqx jette sans bruit ce qui dépasse ~10 messages par seconde ; une file
  // qui déborde chez nous vaut mieux qu'une file qui déborde chez lui.
  const file = []; let pompe = null, dernierEnvoi = 0;
  const pomper = () => {
    if (pompe || !file.length || ferme) return;
    pompe = setTimeout(() => {
      pompe = null;
      const e = file.shift();
      if (e && (!e.p || pairs.get(e.p.id) === e.p)) { dernierEnvoi = Date.now(); publier(e.a, e.o); }
      pomper();
    }, Math.max(0, ENVOI_ECART_MS - (Date.now() - dernierEnvoi)));
  };
  const pousser = (a, o, p) => { file.push({ a, o, p }); pomper(); };
  const salut = a => pousser(a || "tous", { t: "salut", n: nom });

  const disponible = () => typeof RTCPeerConnection === "function";
  // Une offre ou une réponse emporte les candidats déjà connus : si elle doit être
  // renvoyée, elle repart complète, et le lot en cours n'a plus à les porter.
  const envoyerDescription = p => {
    p.lot = []; clearTimeout(p.lotMinuteur); p.lotMinuteur = null;
    p.dernierEnvoiOffre = Date.now();
    journal("→", p.id, p.pc.localDescription.type, "(" + p.pc.signalingState + ", " + p.candidats.length + " candidats)");
    pousser(p.id, { t: "description", d: p.pc.localDescription, c: p.candidats }, p);
  };
  const envoyerLot = p => {
    clearTimeout(p.lotMinuteur); p.lotMinuteur = null;
    if (!p.lot.length) return;
    const c = p.lot; p.lot = [];
    pousser(p.id, { t: "candidats", c }, p);
  };
  async function offrir(p, pourquoi) {
    const pc = p.pc;
    if (pc.signalingState !== "stable") return;
    try {
      p.makingOffer = true;
      await pc.setLocalDescription();
      journal("offre", p.id, pourquoi);
      envoyerDescription(p);
    } catch (e) { journal("offre ratée", p.id, e.message); }
    finally { p.makingOffer = false; }
  }

  function ajouter(id, sess) {
    if (pairs.has(id)) return pairs.get(id);
    if (pairs.size >= PAIRS_MAX - 1) { etat(id, "refuse"); journal("refusé (table pleine)", id); return null; }
    if (!disponible()) { etat(id, "indisponible"); return null; }
    const polite = moi < id;
    const p = { id, session: sess, polite, ice: "new", vu: Date.now(), ne: Date.now(), pc: null,
      makingOffer: false, ignoreOffer: false, answerPending: false, attente: [], redemarrages: 0,
      candidats: [], lot: [], lotMinuteur: null, dernierEnvoiOffre: 0, attentePolie: null };
    const pc = new RTCPeerConnection({ iceServers: SERVEURS_ICE });
    p.pc = pc;
    pairs.set(id, p);
    // Un seul émetteur/récepteur vidéo par paire, créé tout de suite pour que la
    // négociation parte même sans caméra locale (on veut VOIR sans être vu).
    const piste = local && local.getVideoTracks()[0];
    p.tr = pc.addTransceiver(piste || "video", { direction: piste ? "sendrecv" : "recvonly" });
    pc.onnegotiationneeded = () => {
      // Première négociation : l'impoli offre, le poli attend qu'on lui offre.
      // Deux offres croisées se règlent (négociation parfaite), mais coûtent une
      // ronde de plus — et sous le quota du courtier, une ronde de plus se perd.
      if (p.polite && !pc.remoteDescription && !p.attentePolie) {
        p.attentePolie = setTimeout(() => { p.attentePolie = null; if (pairs.get(id) === p && !pc.remoteDescription) offrir(p, "(le poli n'a rien reçu)"); }, ATTENTE_POLIE_MS);
        return;
      }
      if (p.polite && !pc.remoteDescription) return;   // l'attente court déjà
      offrir(p, p.redemarrages ? "(redémarrage ICE)" : "");
    };
    pc.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      p.candidats.push(candidate); p.lot.push(candidate);
      if (!p.lotMinuteur) p.lotMinuteur = setTimeout(() => envoyerLot(p), LOT_CANDIDATS_MS);
    };
    pc.onicegatheringstatechange = () => { if (pc.iceGatheringState === "complete") envoyerLot(p); };
    pc.onsignalingstatechange = () => journal("signalisation", id, pc.signalingState);
    pc.oniceconnectionstatechange = () => {
      p.ice = pc.iceConnectionState; etat(id, p.ice);
      if (p.ice === "failed" && pairs.get(id) === p) {
        // On redémarre ICE, mais pas en boucle serrée : deux secondes, cinq fois.
        if (p.redemarrages++ < 5) setTimeout(() => { if (pairs.get(id) === p && pc.signalingState !== "closed") { journal("redémarrage ICE", id); pc.restartIce(); } }, 2000);
      }
    };
    pc.ontrack = ({ track, streams }) => {
      const s = streams[0] || new MediaStream([track]);
      if (onFlux) try { onFlux(id, s); } catch (_) {}
    };
    journal("pair ajouté", id, polite ? "(je suis poli)" : "(je suis impoli)");
    return p;
  }
  function retirer(id, pourquoi) {
    const p = pairs.get(id); if (!p) return;
    pairs.delete(id);
    clearTimeout(p.lotMinuteur); clearTimeout(p.attentePolie);
    try { p.pc.onnegotiationneeded = p.pc.onicecandidate = p.pc.ontrack = p.pc.oniceconnectionstatechange = p.pc.onsignalingstatechange = p.pc.onicegatheringstatechange = null; p.pc.close(); } catch (_) {}
    journal("pair retiré", id, pourquoi || "");
    etat(id, "parti");
    if (onDepart) try { onDepart(id); } catch (_) {}
  }
  async function description(p, d, cands) {
    const pc = p.pc;
    const pret = !p.makingOffer && (pc.signalingState === "stable" || p.answerPending);
    const collision = d.type === "offer" && !pret;
    p.ignoreOffer = !p.polite && collision;
    journal("←", p.id, d.type, "(" + pc.signalingState + (p.makingOffer ? ", offre en cours" : "") + ", " + (cands ? cands.length : 0) + " candidats)", collision ? "COLLISION" : "");
    if (p.ignoreOffer) { journal("offre ignorée (collision, je suis impoli)", p.id); return; }
    p.answerPending = d.type === "answer";
    await pc.setRemoteDescription(d);   // le côté poli annule sa propre offre ici s'il le faut
    p.answerPending = false;
    if (d.type === "offer") { await pc.setLocalDescription(); envoyerDescription(p); }
    // Les candidats portés par la description, puis ceux arrivés avant elle.
    const q = [...(cands || []), ...p.attente]; p.attente = [];
    for (const c of q) await candidat(p, c);
  }
  async function candidat(p, c) {
    if (!p.pc.remoteDescription) { p.attente.push(c); return; }
    try { await p.pc.addIceCandidate(c); }
    catch (e) { if (!p.ignoreOffer) journal("candidat refusé", p.id, e.message); }
  }
  // Un pair qu'on connaissait revient avec une autre session : c'est un
  // rechargement de page. On ferme l'ancienne connexion et on repart.
  function accueillir(id, sess) {
    const p = pairs.get(id);
    if (p && p.session !== sess) retirer(id, "session changée");
    const q = pairs.get(id);
    if (q) { q.vu = Date.now(); return q; }
    const n = ajouter(id, sess);
    if (n) salut(id);   // qu'il me connaisse tout de suite, sans attendre mon prochain salut général
    return n;
  }
  // Le testament du courtier dit un départ brutal en moins d'une seconde ; ceci
  // est le REPLI, pour un portable qui ferme son couvercle (aucun paquet ne part).
  // Un pair vivant salue toutes les deux secondes par le courtier — une voie
  // indépendante du média : ICE qui tombe SANS que les saluts cessent, c'est un
  // réseau qui hoquette, et ICE se redémarre tout seul. Les deux qui cessent
  // ensemble, c'est un pair mort.
  // Et la RÉ-OFFRE : le courtier peut avoir jeté une offre ou une réponse. Une
  // offre restée sans réponse repart après REOFFRE_MS ; une paire sans aucune
  // description distante au bout du même délai en émet une.
  function menage() {
    const t = Date.now();
    for (const p of [...pairs.values()]) {
      const silence = t - p.vu;
      if (silence > SILENCE_MAX_MS) { retirer(p.id, "silence"); continue; }
      if (silence > SILENCE_ICE_MS && (p.ice === "disconnected" || p.ice === "failed" || p.ice === "closed")) { retirer(p.id, "ICE coupé et silence"); continue; }
      const pc = p.pc;
      if (pc.signalingState === "have-local-offer" && t - p.dernierEnvoiOffre > REOFFRE_MS) { journal("ré-offre", p.id, "(pas de réponse)"); envoyerDescription(p); }
      else if (pc.signalingState === "stable" && !pc.remoteDescription && !p.makingOffer && t - p.ne > REOFFRE_MS && t - p.dernierEnvoiOffre > REOFFRE_MS) offrir(p, "(rien reçu depuis " + Math.round((t - p.ne) / 1000) + " s)");
    }
  }

  const api = {
    pairs,
    get session() { return session; },
    demarrer() {
      if (ferme) return;
      reseau.souscrire(base + "+/tous");
      reseau.souscrire(base + "+/" + moi);
      salut();
      salutMinuteur = setInterval(salut, SALUT_INTERVALLE_MS);
      menageMinuteur = setInterval(menage, 1000);
    },
    // Relaye un message net.mjs. Rend true s'il était pour la visio.
    recevoir(s, brut) {
      if (typeof s !== "string" || !s.startsWith(base)) return false;
      const [de, a] = s.slice(base.length).split("/");
      if (!de || de === moi || (a !== "tous" && a !== moi)) return true;
      let m; try { m = JSON.parse(brut); } catch (e) { return true; }
      // L'adieu du TESTAMENT est écrit par le courtier, sans session : on le prend avant tout.
      if (m && m.t === "adieu") { retirer(de, "adieu"); return true; }
      if (!m || !m.s) return true;
      if (m.t === "salut") { accueillir(de, m.s); return true; }
      const p = accueillir(de, m.s);   // une description d'un inconnu vaut un salut
      if (!p) return true;
      if (m.t === "description" && m.d) description(p, m.d, m.c).catch(e => journal("description ratée", de, e.message));
      else if (m.t === "candidats" && Array.isArray(m.c)) (async () => { for (const c of m.c) await candidat(p, c); })();
      return true;
    },
    // Pose (ou remplace) mon flux local : chaque paire passe en sendrecv, la
    // renégociation part toute seule. Null pour cesser d'être vu.
    attacherFlux(f) {
      local = f;
      const piste = f && f.getVideoTracks()[0];
      for (const p of pairs.values()) {
        try { p.tr.sender.replaceTrack(piste || null); p.tr.direction = piste ? "sendrecv" : "recvonly"; }
        catch (e) { journal("flux non attaché", p.id, e.message); }
      }
    },
    // Pour l'app qui tient déjà sa présence (salut/adieu des cartes) : un coup de coude.
    arrivee(id) { if (id && id !== moi) salut(id); },
    depart(id) { retirer(id, "départ annoncé"); },
    fermer() {
      if (ferme) return; ferme = true;
      clearInterval(salutMinuteur); clearInterval(menageMinuteur); clearTimeout(pompe);
      publier("tous", { t: "adieu" });   // tout de suite, pas par la file : la page se ferme
      for (const id of [...pairs.keys()]) retirer(id, "fermeture");
    },
  };
  return api;
}
