// La visio autour de la table : chacun voit les vignettes des autres sièges.
//
// ══ Comment ça marche ══════════════════════════════════════════════════════
// Maillage complet (mesh) : chaque pair ouvre UNE RTCPeerConnection vers
// chacun des autres. Au-delà, il faudrait un serveur qui mélange les flux, et
// on n'en a pas.
//
// 🚨 LE MAILLAGE NE SUIT PAS LE NOMBRE DE SIÈGES — c'est le couplage qu'on a
// défait le 6 septembre 2026, quand la table est passée à huit places. DEUX
// nombres, pas un : PAIRS_MAX (les CONNEXIONS, donc les VOIX) et VIDEO_MAX
// (les IMAGES). Les VIDEO_MAX premières personnes assises échangent leurs images ;
// celles d'après sont en SON SEUL : elles parlent, elles entendent, elles gardent
// leur silhouette et leur nom — elles n'échangent pas d'images. À huit, ce sont
// donc la septième et la huitième. Voir le gros bloc au-dessus de ces constantes.
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
// n'est vu qu'au silence : sept secondes sans salut, ou quatre et demie si ICE
// est tombé en même temps. Dans tous les cas moins de douze.
//
// ══ Où ça marche, où c'est mort ═══════════════════════════════════════════
// · LE SITE (LIEN_SITE, plus bas — une seule constante dans tout le dépôt,
//   parce que l'adresse changera) : tout marche — WebSocket vers le courtier,
//   caméra, WebRTC, STUN et TURN.
// · L'ARTEFACT Claude : MORT. Sa politique de sécurité bloque tout WebSocket
//   externe, SANS erreur visible — la connexion échoue en quelques
//   millisecondes et net.mjs le dit (« connexion refusée »). La visio doit
//   détecter ça en moins de trois secondes (`sonderReseau`, 2,5 s au plus) et
//   afficher `MESSAGE_ARTEFACT` avec le lien du site, plutôt qu'une
//   roue qui tourne. La caméra y est le plus souvent refusée aussi (iframe
//   sans droit caméra) — camera.mjs le dit à son tour.
//
// ══ Où va la vidéo ════════════════════════════════════════════════════════
// NULLE PART ailleurs que chez tes amis. Le maillage est pair-à-pair : la
// vidéo va directement de ton navigateur au leur, chiffrée (DTLS-SRTP, c'est
// le protocole, pas une option). Le courtier MQTT ne voit que les offres et
// les candidats — du texte de négociation, jamais une image. STUN (Google) ne
// sert qu'à apprendre son adresse publique ; il ne stocke rien.
//
// ══ Le relais (TURN) : CONFIGURABLE, jamais un cadeau qu'on croit gratuit ═══
// Quand deux réseaux ne se voient pas (NAT symétriques, 4G derrière un CGNAT,
// boîtes d'entreprise), seul un relais TURN fait passer les paquets — chiffrés
// de bout en bout, il ne peut pas les lire. Sans relais, « ça marche chez moi »
// et pas chez l'ami en 4G.
// ⚠️ MESURÉ LE 5 SEPTEMBRE 2026 : le TURN « Open Relay » (openrelay.metered.ca,
// identifiants openrelayproject) qui était inscrit ici EST MORT — allocation
// refusée (400), certificat de turns:443 en hostname mismatch, ZÉRO candidat
// relay, et `iceGatheringState` qui ne passait JAMAIS à « complete ». Un TURN
// mort ne fait pas que ne rien relayer : il RALENTIT la collecte ICE de tout le
// monde, même entre deux amis qui se voyaient très bien en direct. Il est
// retiré. Le relais est désormais celui que l'utilisateur configure dans ⚙
// (`serveursIce(turn)`), testable par `testerRelais` ; sans identifiants on part
// en STUN seul, et on le DIT. Sur `failed` sans relais, l'appelant affiche
// pourquoi (jamais un échec silencieux) — cf. `SANS_RELAIS_MESSAGE`.
//
// ══ La PAROLE : ajoutée le 6 SEPTEMBRE 2026 ═══════════════════════════════
// Jusqu'au 5 septembre 2026, ce fichier portait « ⚠️ PAS DE MICRO. Vidéo seule,
// par décision : on compte en silence, la parole détruit la mémoire de travail ».
// LÉO A TRANCHÉ L'INVERSE LE 6 SEPTEMBRE 2026 : on peut se parler autour de la
// table. Le raisonnement n'était pas faux, il était trop large — parler pendant
// qu'on compte coûte cher, mais entre deux mains ça ne coûte rien, et une table
// muette n'est pas une table. Le silence devient donc un CHOIX DE CHACUN, pas une
// impossibilité : on arrive MICRO COUPÉ, un bouton l'ouvre, un bouton le referme.
// Qui veut compter en silence ne touche à rien et n'entend que ce qu'il a demandé
// d'entendre.
// ⚠️ Ne « répare » pas ça en retirant l'audio : la trace ci-dessus est là pour
// qu'on sache que le silence a été voulu, puis levé, et par qui.
//
// Ce que ça change ici : un SECOND transcepteur par paire, audio, à côté du vidéo et
// TOUJOURS DANS LE MÊME ORDRE (vidéo puis audio) — et la façon dont ces deux-là
// naissent, qui a dû être corrigée (cf. garnir() et adopter() plus bas). Le reste —
// négociation parfaite, file d'envoi à 130 ms, lots de candidats, ré-offre, testament,
// présence — n'a pas bougé d'une ligne. La voix coûte 24 à 40 kbit/s par pair en
// Opus : négligeable à côté de la vidéo, ce n'est pas elle qui limite à cinq.

import { sujet } from "./net.mjs";

// ══ COMBIEN DE MONDE, ET COMBIEN D'IMAGES ═════════════════════════════════
// 🚨 DEUX NOMBRES, ET IL FAUT QU'ILS RESTENT DEUX. Le maillage accueille huit
// personnes (PAIRS_MAX) ; les images, elles, s'arrêtent à six (VIDEO_MAX).
// ⚠️ AUCUN DES DEUX N'EST LE NOMBRE DE SIÈGES. Celui-là vit ailleurs (NB_SIEGES,
// table-reseau.mjs) et ce fichier n'a pas à le recopier : un commentaire qui
// annonce un chiffre qu'il ne possède pas devient faux le jour où l'autre bouge,
// et personne ne va relire un commentaire. Faire suivre le maillage par les
// sièges — « autant de vignettes que de places » — casse la visio de TOUT LE
// MONDE, et pas pour la raison qu'on croit : le mur n'est pas le débit, c'est la
// SIGNALISATION.
//
// ⚠️ MESURÉ LE 6 SEPTEMBRE 2026, en faisant tourner ce fichier contre un faux
// courtier qui horodate ce qu'il délivre (scénario : une table installée, une
// personne de plus qui entre — c'est elle qui prend la salve). Rappel du quota
// d'emqx : ~10 messages par seconde et par client, et ce qui dépasse est jeté
// SANS RIEN DIRE.
//   maillage = sièges, réglages d'avant, 8 personnes ......... 20 msg/s
//   + lots de candidats à 2,5 s, salut à 3 s, les deux gigues . 13 msg/s
//   + images bornées à VIDEO_MAX ............................. 13 msg/s
//
// 🚨 LISEZ BIEN LA DERNIÈRE LIGNE : VIDEO_MAX NE FAIT PAS BAISSER LES MESSAGES.
// C'est contre-intuitif et ça vaut d'être écrit, parce que quelqu'un le
// re-supposera : une paire SANS image coûte exactement la même signalisation
// qu'une paire avec (même offre, même réponse, mêmes candidats ICE — ils sont
// par CONNEXION, pas par piste). Ce qui fait baisser les messages, ce sont les
// cadences et les gigues, au-dessus. VIDEO_MAX, lui, économise du DÉBIT : cinq
// flux sortants au lieu de sept, et plus sobres (PALIERS_ENCODAGE).
// ⚠️ Il n'y a QU'UNE façon de descendre à 7 msg/s à huit : refuser la CONNEXION
// aux deux derniers, donc leur retirer la voix. Ç'a été mesuré, et écarté — voir
// le bloc suivant. On ne fait pas taire quelqu'un pour gagner trois messages.
//
// Pour mémoire, ce qui TOURNAIT EN PRODUCTION à cinq personnes : 14 msg/s. Le
// même fichier après ce changement, à cinq : 10 msg/s. Autrement dit une table
// de huit coûte à peu près ce que coûtait une table de cinq la veille — et une
// table de cinq, elle, est passée sous le quota.
//
// ⚠️ Ce qui a été essayé et qui NE MARCHE PAS, pour qu'on ne le refasse pas :
// ralentir la file d'envoi (ENVOI_ECART_MS de 130 à 200 puis 260) ne change
// RIEN à la pointe reçue. Le levier est le NOMBRE de messages, jamais leur
// cadence — un émetteur plus lent est un émetteur qui parle plus longtemps.
//
// 🚨 ET LA VOIX N'EST PAS PLAFONNÉE. Elle coûte 24 à 40 kbit/s par pair : à
// huit, ~280 kbit/s, rien du tout à côté d'une seule vignette. Quelqu'un qui
// n'a pas d'image DOIT entendre et être entendu normalement — c'est le sens
// même de « tu es en son seul », et une table où deux personnes sont muettes
// n'est pas une table. Ne « simplifie » pas ces deux constantes en une seule :
// ce serait rendre muettes les deux dernières personnes assises.
//
// ⚠️ Le prix payé, dit franchement : à huit, la pointe reçue (13 msg/s) reste
// au-dessus du quota d'emqx pendant la seconde où la dernière personne entre.
// Ce n'est pas un échec, c'est le fonctionnement décrit plus haut — un message
// jeté est renvoyé après REOFFRE_MS, « quatre secondes, jamais la visio », et
// c'est celui qui ARRIVE qui les attend, pas la table. Le marché est donc :
// la huitième personne met quelques secondes de plus à voir tout le monde,
// contre deux personnes définitivement muettes. On a choisi les secondes.
export const PAIRS_MAX = 8;    // CONNEXIONS, donc VOIX : tout le monde, jusqu'à sept pairs
export const VIDEO_MAX = 6;    // IMAGES : moi et cinq vignettes distantes, pas une de plus
// Les paliers d'encodage de MA caméra, choisis d'après le nombre de pairs à qui
// je l'envoie vraiment. La vignette fait 56 à 96 px de côté CSS, soit 112 à 192
// px physiques : 320 px est DÉJÀ 1,7 fois trop grand, et la réduction ne se voit
// pas. À cinq images sortantes : ~0,75 Mbit/s de montée, moins qu'aujourd'hui à
// quatre. On les recalcule à chaque arrivée et à chaque départ.
// ⚠️ Ça se règle ICI, sur l'ÉMETTEUR, jamais dans camera.mjs : la caméra est
// PARTAGÉE avec le mode Concentration, et un applyConstraints dégraderait aussi
// le détecteur de présence, qui n'a rien demandé.
export const PALIERS_ENCODAGE = [
  { pairs: 4, bits: 250000, images: 15, reduction: 1 },      // 1 à 4 : ce qu'on faisait déjà
  { pairs: 7, bits: 150000, images: 12, reduction: 1.33 },   // 5 et plus : 240×180, invisible
];
// Ce qu'un pair peut dire de son micro. « ferme » (pas de micro du tout) et « coupe »
// (tenu, mais muet) se ressemblent pour l'oreille — jamais pour ce qu'on en fait : on
// relance quelqu'un en sourdine, on n'attend rien de quelqu'un sans micro. Le SILENCE,
// lui, ne s'en déduit pas : il se lit sur le son reçu (l'anneau de parole).
export const ETATS_VOIX = ["ferme", "coupe", "ouvert"];
// 🚨 L'ADRESSE DU SITE, UNE FOIS POUR TOUTES. Elle était recopiée à six endroits,
// et — pire — les textes NOMMAIENT l'hébergeur (« la version GitHub Pages »).
// Le jour où l'application déménage sous son propre nom de domaine, une constante
// se change ; six phrases qui nomment un hébergeur, on en oublie toujours une, et
// celle-là envoie un joueur sur une page morte. Les textes visibles disent donc
// « le site » ou « la version en ligne » — jamais qui l'héberge.
export const LIEN_SITE = "https://wisehand21.com/";
export const MESSAGE_ARTEFACT = "La visio ne peut pas marcher sur cette page publiée : sa politique de sécurité bloque les connexions vers le courtier. Ouvre le site pour voir tes amis : " + LIEN_SITE;
// STUN seul : deux serveurs de Google, gratuits, qui ne font qu'apprendre à chacun
// son adresse publique. C'est ce qu'on a quand aucun relais n'est configuré.
export const SERVEURS_STUN = ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"];
// Ce que dit la vignette quand la connexion directe échoue et qu'aucun relais n'est là.
// 🚨 « VIDÉO », TOUT SEUL, ÉTAIT UN MENSONGE PAR OMISSION : l'image et la VOIX voyagent
// dans la MÊME RTCPeerConnection (même BUNDLE, même ICE). Quand elle échoue, les deux
// tombent ensemble — et celui qui gardait exprès sa caméra fermée pour ne faire que
// parler lisait « la vidéo est bloquée », en concluait « tant mieux » et ne comprenait
// jamais pourquoi personne ne lui répondait. Ces libellés dataient d'avant la voix.
export const SANS_RELAIS_MESSAGE = "Ta connexion bloque le lien direct : ni image ni voix ne passent. Ajoute un relais dans ⚙";
export const AVEC_RELAIS_MESSAGE = "Rien ne passe, même par le relais : ni image ni voix. Teste-le dans ⚙";
// Les URL d'un relais, telles qu'on les tape dans ⚙ : une ou plusieurs, séparées par
// des virgules, des espaces ou des retours à la ligne ; « host:port » sans schéma
// devient « turn:host:port ». Une ligne vide ou illisible est ignorée.
export function urlsRelais(brut) {
  return String(brut || "").split(/[\s,;]+/).map(u => u.trim()).filter(Boolean)
    // Un « http://… » collé par erreur n'est pas un relais : jeté, pas préfixé.
    // Sans schéma, on accepte « host » ou « host:port » — rien d'autre.
    .filter(u => !/\/\//.test(u) && (/^(turns?|stuns?):/i.test(u) || /^[^:?]+(:\d+)?(\?.*)?$/.test(u)))
    .map(u => /^(turns?|stuns?):/i.test(u) ? u : "turn:" + u)
    .filter(u => /^(turns?|stuns?):[^\s/:]+(:\d+)?(\?.*)?$/i.test(u));
}
// Construit la liste des serveurs ICE : STUN toujours, puis le relais s'il est complet
// (une URL ET un utilisateur ET un mot de passe — un TURN sans identifiants est refusé
// par tout serveur sérieux, autant ne pas l'envoyer). `turn` = { url, user, pass } ou rien.
export function serveursIce(turn) {
  const ice = [{ urls: SERVEURS_STUN.slice() }];
  const t = turn || {};
  const urls = urlsRelais(t.url).filter(u => /^turns?:/i.test(u));
  const user = String(t.user || "").trim(), pass = String(t.pass || "");
  if (urls.length && user && pass) ice.push({ urls, username: user, credential: pass });
  return ice;
}
export const relaisConfigure = turn => serveursIce(turn).length > 1;
// La liste par défaut, sans relais. Gardée pour qui l'importait.
export const SERVEURS_ICE = serveursIce(null);
export const SALUT_INTERVALLE_MS = 3000;   // un salut toutes les 3 s (quarante octets — mais huit personnes en émettent)
// ⚠️ LES DEUX GIGUES. Elles ne « lissent » pas par élégance : sans elles, huit
// navigateurs qui ouvrent la table à la même seconde envoient leur salve à la
// même seconde, et le courtier en jette la moitié. Mesuré : le seul réglage des
// cadences, sans gigue, laissait la pointe à 22 msg/s au lieu de 13.
// 🚨 LA GIGUE DÉCALE TOUT LE CALENDRIER, pas seulement le premier salut : un
// setTimeout suivi d'un setInterval PARTI EN MÊME TEMPS que celui des autres se
// resynchronise dès la deuxième ronde, et on n'a rien gagné. C'est la faute qui
// a été faite d'abord, et elle ne se voit pas — les chiffres, eux, la voient.
export const GIGUE_SALUT_MS = 1500;        // 0 à 1,5 s avant mon premier salut, puis l'horloge en découle
export const GIGUE_OFFRE_MS = 1200;        // 0 à 1,2 s avant ma première offre à un pair
export const SILENCE_MAX_MS = 7000;        // 7 s sans salut = parti (repli si le testament n'est pas arrivé)
// 🚨 CES DEUX SEUILS SE LISENT EN NOMBRE DE SALUTS, JAMAIS EN SECONDES. Ils comptent
// des saluts manqués ; le jour où SALUT_INTERVALLE_MS bouge et qu'eux ne bougent pas,
// ils changent de sens sans que rien ne le dise. C'est arrivé le 6 septembre 2026 : le
// salut est passé de 2 s à 3 s pour tenir sous le quota du courtier, et ce seuil-ci est
// resté à 3 s. Le rapport est alors tombé à 1,00 — c'est-à-dire ZÉRO marge : mesuré, un
// pair PARFAITEMENT VIVANT qui saluait à la cadence normale mais dont ICE hoquetait
// était retiré à 3,00 s, avant même son deuxième salut. Or « disconnected » est l'état
// passager par excellence (4G, wifi qui vacille) — exactement la population que le
// travail sur le relais vise — et le retrait jette la RTCPeerConnection entière, donc
// les cinq redémarrages ICE prévus, là où un simple redémarrage suffisait.
// ⚠️ ET LES DEUX SIGNAUX NE SONT PAS INDÉPENDANTS : le salut passe par le courtier,
// donc par le même réseau qu'ICE. Un hoquet les retarde ENSEMBLE — la coïncidence que
// le commentaire d'origine croyait improbable est en fait le cas courant.
// 4500 ms rend le rapport de 1,5 qu'avait la version d'avant (3000 / 2000) : il faut
// rater un salut ENTIER pour être déclaré parti, et la promesse du haut de ce fichier
// (« dans tous les cas moins de douze secondes ») tient toujours.
export const SILENCE_ICE_MS = 4500;        // ICE coupé ET un salut entier manqué = parti (un onglet mort, pas un réseau qui hoquette)
export const ENVOI_ECART_MS = 130;         // un message par 130 ms par client : sous le quota d'emqx (~10/s), mesuré
// 2,5 s : les candidats d'une paire partent en UN lot à la fin de la collecte
// (elle dure ~0,6 s) plutôt qu'en trois. Trois messages deviennent un, par paire
// et par côté — c'est la moitié de l'économie mesurée. Le prix est ~1,5 s de plus
// avant que l'image apparaisse ; on l'a payé volontiers.
export const LOT_CANDIDATS_MS = 2500;      // les candidats ICE partent par lots de 2,5 s
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
// Teste un relais : une RTCPeerConnection en `iceTransportPolicy: "relay"` ne peut
// produire QUE des candidats relay — s'il en arrive un, le TURN a accepté l'allocation.
// Rend { ok, raison, ms, candidat? } en moins de `delai` ms, ne lève jamais. Un relais
// mort se voit ici en trois façons, toutes dites : collecte terminée sans candidat,
// erreur d'allocation (`icecandidateerror`, avec son code : 401 = identifiants, 400 =
// relais hors service), ou rien du tout au bout du délai.
export function testerRelais(turn, delai = 8000) {
  return new Promise(res => {
    const serveurs = serveursIce(turn).filter(s => s.username);
    if (!serveurs.length) return res({ ok: false, ms: 0, raison: "Aucun relais configuré : il faut une adresse, un utilisateur et un mot de passe." });
    if (typeof RTCPeerConnection !== "function") return res({ ok: false, ms: 0, raison: "WebRTC n'est pas disponible dans ce navigateur." });
    let pc; try { pc = new RTCPeerConnection({ iceServers: serveurs, iceTransportPolicy: "relay" }); }
    catch (e) { return res({ ok: false, ms: 0, raison: "Adresse de relais refusée par le navigateur (" + e.message + ")." }); }
    const t0 = Date.now(); let fini = false, erreur = "";
    const conclure = r => { if (fini) return; fini = true; clearTimeout(m); try { pc.close(); } catch (_) {} res(Object.assign({ ms: Date.now() - t0 }, r)); };
    const m = setTimeout(() => conclure({ ok: false, raison: erreur || ("Aucun candidat relay en " + Math.round(delai / 1000) + " s : le relais ne répond pas.") }), delai);
    pc.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      const type = candidate.type || (/\btyp (\w+)/.exec(candidate.candidate || "") || [])[1];
      if (type === "relay") conclure({ ok: true, raison: "", candidat: (candidate.address || candidate.ip || "") + (candidate.port ? ":" + candidate.port : ""), protocole: candidate.protocol || "" });
    };
    pc.onicecandidateerror = e => {
      const code = e && e.errorCode, txt = e && e.errorText;
      if (code === 401 || code === 403) erreur = "Le relais refuse les identifiants (" + code + (txt ? " " + txt : "") + ")." ;
      else if (code) erreur = "Le relais a répondu " + code + (txt ? " (" + txt + ")" : "") + ".";
    };
    pc.onicegatheringstatechange = () => { if (pc.iceGatheringState === "complete") conclure({ ok: false, raison: erreur || "Collecte terminée sans aucun candidat relay : le relais n'a rien alloué." }); };
    try { pc.createDataChannel("relais"); } catch (_) {}
    pc.createOffer().then(o => pc.setLocalDescription(o)).catch(e => conclure({ ok: false, raison: "Négociation impossible (" + e.message + ")." }));
  });
}
// Ce que dit la visio quand rien ne passe : la phrase + le lien, jamais une roue.
export function expliquerEchec(e) {
  const msg = (e && e.message) || "";
  if (/refus|poignée|délai|aucun courtier/i.test(msg) || !msg) return MESSAGE_ARTEFACT;
  return "La visio n'a pas pu se connecter (" + msg + "). " + MESSAGE_ARTEFACT;
}

const hex = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(x => x.toString(16).padStart(2, "0")).join(""); };

// creerVisio({ reseau, salon, moi, flux?, nom?, turn?, onFlux, onDepart, onEtat, onJournal? })
//   reseau   : l'api de net.connecter() — { publier(sujet, message), souscrire(sujet) }
//   salon    : le code du salon (le même que pour les cartes)
//   moi      : mon identifiant dans le salon (celui des pairs de net.mjs)
//   flux     : mon MediaStream local (camera.mjs), ou rien — je verrai sans être vu
//   micro    : mon MediaStream de voix (micro.mjs), ou rien — j'entendrai sans parler
//   turn     : { url, user, pass } du relais configuré dans ⚙, ou rien (STUN seul)
//   onFlux(id, MediaStream)   une VIDÉO distante est arrivée (ou a changé)
//   onAudio(id, MediaStream)  une VOIX distante est arrivée (ou a changé)
//   onDepart(id)              ce pair est parti, sa vignette doit disparaître
//   onVoix(id, voix)          ce pair dit où en est SON micro : « ouvert », « coupe », « ferme »
//   onEtat(id, etat)          ice : new·checking·connected·completed·disconnected·failed·closed
//                             + refuse (au-delà de PAIRS_MAX personnes, donc au
//                               NEUVIÈME arrivant — pas au sixième : celui-là est
//                               connecté, il est seulement en son seul), + parti,
//                             + bloque (ICE `failed` : la connexion directe ne passe pas —
//                               `api.sansRelais` dit si un relais aurait pu aider)
// 🚨 `onFlux` NE VOIT QUE LA VIDÉO, `onAudio` QUE LA VOIX — deux rappels, jamais un
// seul avec un genre en troisième argument. Un écran écrit avant la parole ignorerait
// ce troisième argument et poserait un flux SANS IMAGE dans son <video> : la tête de
// l'ami deviendrait un rectangle noir le jour où il ouvre son micro. Deux rappels, rien
// à casser, et l'écran d'aujourd'hui continue de marcher pendant qu'on branche le son.
// Rend { demarrer(), recevoir(sujet, brut), attacherFlux(flux), attacherMicro(flux),
//        couperMicro(bool), microCoupe(), arrivee(id), depart(id), fermer(),
//        pairs (Map id → { id, pc, session, polite, ice, collecteMs, tr, trA }), sansRelais }.
// `collecteMs` : durée de la collecte ICE (null tant qu'elle n'est pas finie) — avec un
// TURN mort elle ne finissait jamais ; le banc l'exige sous 5 s.
// ⚠️ L'appelant DOIT relayer chaque message reçu de net.mjs à `recevoir` : net.mjs
// n'a qu'un seul onMessage, posé à la connexion. Les sujets étrangers sont ignorés.
export function creerVisio({ reseau, salon, moi, flux = null, micro = null, nom = "", turn = null, onFlux, onAudio, onDepart, onEtat, onVoix, onJournal } = {}) {
  const iceServers = serveursIce(turn), sansRelais = iceServers.length < 2;
  const session = hex(6);            // change à chaque rechargement : un pair relancé est reconnu comme neuf
  const pairs = new Map();
  const base = `${sujet(salon)}/visio/`;
  let local = flux, localMicro = micro, salutMinuteur = null, menageMinuteur = null, ferme = false;
  // 🚨 L'INSTANT OÙ JE ME SUIS ASSIS, ET IL VOYAGE. C'est la seule donnée qui permet
  // aux deux côtés d'une paire de classer la table DANS LE MÊME ORDRE — voir le gros
  // bloc devant repartirImages(). Il part dans le salut, qui est déjà périodique :
  // zéro message de plus, exactement comme l'état de ma voix.
  const monArrivee = Date.now();
  const journal = (...a) => { if (onJournal) try { onJournal(a.join(" ")); } catch (_) {} };
  const etat = (id, e) => { if (onEtat) try { onEtat(id, e); } catch (_) {} };
  // Ce qu'un pair dit de SON micro : « ouvert », « coupe », « ferme ». On ne le déduit
  // jamais du son reçu — un silence n'est pas une sourdine, et c'est justement la
  // confusion qu'on essaie de lever.
  const voix = (id, v) => { if (onVoix && ETATS_VOIX.includes(v)) try { onVoix(id, v); } catch (_) {} };
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
  // ⚠️ L'ÉTAT DE MA VOIX VOYAGE AVEC LE SALUT, en plus d'être publié quand il change.
  // Le salut est déjà périodique : un pair qui arrive en retard, ou un message perdu
  // sous le quota du courtier, se rattrapent tout seuls à la prochaine ronde — sans
  // quoi un badge « en sourdine » pourrait rester faux jusqu'à la fin de la partie.
  let maVoix = "ferme";
  const salut = a => pousser(a || "tous", { t: "salut", n: nom, v: maVoix, a: monArrivee });

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
  // ── Les deux transcepteurs d'une paire ───────────────────────────────────
  // Un pour l'image, un pour la voix, posés une fois pour toutes : ensuite on allume,
  // on coupe et on rallume en REMPLAÇANT la piste, sans jamais ajouter de section m=.
  // Ils existent même sans caméra ni micro, pour qu'on puisse VOIR sans être vu et
  // ENTENDRE sans parler, et pour que la négociation parte tout de suite.
  //
  // 🚨 CELUI QUI RÉPOND NE LES CRÉE PAS. C'est contre-intuitif, et ça a coûté cher :
  // setRemoteDescription n'associe PAS un transcepteur né d'addTransceiver à une
  // section m= offerte — il en fabrique un neuf à côté. Les nôtres restaient donc sans
  // mid et repartaient dans une SECONDE offre. Mesuré au banc, deux navigateurs, sans
  // la moindre collision d'offres : celui qui répond se retrouvait avec QUATRE sections
  // (vidéo, audio, vidéo, audio), sa réponse annonçait « recvonly » alors qu'il avait
  // sa caméra, et il lui fallait une ronde de plus — celle que tout ce fichier
  // s'applique à éviter — pour se montrer. Ça marchait quand même, donc personne ne le
  // voyait. Jusqu'à ce qu'un micro s'ouvre plus tard : les sections en trop tombent
  // hors du groupe BUNDLE, et l'image GELAIT SEPT SECONDES DES DEUX CÔTÉS pendant que
  // le son, lui, continuait de passer. C'est ce gel qui a fini par trahir la
  // duplication, des mois après qu'elle a commencé.
  //
  // Donc : l'offreur CRÉE (garnir), celui qui répond ADOPTE (adopter) ce que la
  // description distante vient de faire naître. Une paire, deux sections m=, une ronde.
  //
  // 🚨 L'ORDRE RESTE UN CONTRAT : VIDÉO PUIS AUDIO. C'est garnir() qui le fixe ; comme
  // l'offreur est toujours l'un de nous deux, celui qui répond en hérite. Ne pas
  // séparer ni inverser ces deux lignes.
  //
  // ── Qui a droit à l'image, et à quelle qualité ───────────────────────────
  // 🚨 LA RÈGLE DOIT DONNER LA MÊME RÉPONSE DES DEUX CÔTÉS D'UNE PAIRE. Ce n'est
  // pas une élégance : `p.image` est lu par l'écran pour dire « vous êtes en son
  // seul, vous ne vous voyez pas » (app/visio.js, rvSonSeul). Une paire où l'un
  // envoie et l'autre non fait afficher à celui qui ne reçoit rien « sa caméra
  // est coupée » — sur quelqu'un dont la caméra est allumée et qui émet.
  //
  // 🚨 ELLE NE L'A PAS TOUJOURS FAIT, ET IL FAUT DIRE POURQUOI. La règle d'avant
  // triait les pairs par `ne`, l'instant où JE les ai rencontrés, et donnait
  // l'image aux VIDEO_MAX - 1 premiers. Le commentaire qui l'accompagnait
  // affirmait « les deux navigateurs ont vu la table dans le même ordre, donc ils
  // tombent d'accord tout seuls » : c'est FAUX, et mesuré faux. `ne` est une
  // horloge LOCALE — le dernier arrivé rencontre tout le monde à la même seconde
  // alors que tout le monde l'a rencontré en dernier. Mesuré le 6 septembre 2026,
  // huit personnes qui s'asseyent l'une après l'autre, ce fichier contre un faux
  // courtier : sur 28 paires, 12 étaient ASYMÉTRIQUES en régime établi (20 pendant
  // les arrivées). Et le plafond lui-même sautait : quatre personnes RECEVAIENT
  // six ou sept flux vidéo là où VIDEO_MAX promet « moi et cinq vignettes ».
  //
  // Ce qu'on fait à la place : chacun classe LA TABLE ENTIÈRE, lui compris, et les
  // VIDEO_MAX premiers échangent leurs images ENTRE EUX. Une paire échange donc
  // ses images si et seulement si SES DEUX MEMBRES sont dans cette tête de liste —
  // un prédicat sur la PAIRE, calculé sur une liste identique chez les deux, donc
  // forcément symétrique. Les autres sont en son seul avec tout le monde, ce que
  // le haut de ce fichier décrit déjà mot pour mot (« elle n'échange pas d'images »).
  // Chacun émet vers cinq personnes au plus, et en reçoit cinq au plus : les deux
  // moitiés du budget sont tenues, pas seulement celle qui monte.
  //
  // 🚨 LA CLÉ DE TRI DOIT ÊTRE LA MÊME CHEZ TOUT LE MONDE — c'est là qu'était la
  // faute. On trie donc sur l'instant d'arrivée que CHACUN ANNONCE (`a` du salut),
  // jamais sur une horloge locale, et l'identifiant départage les ex æquo. Deux
  // horloges mal réglées ne cassent RIEN : tout le monde lit les mêmes valeurs
  // annoncées, donc tout le monde trie pareil ; seule l'équité de l'ordre en
  // souffrirait, jamais sa symétrie.
  // ⚠️ Tant qu'un pair n'a pas encore salué, on se rabat sur l'instant où on l'a
  // rencontré — la valeur d'avant. C'est le SEUL moment où un désaccord subsiste,
  // il dure au plus une ronde de saluts (SALUT_INTERVALLE_MS), et il se corrige
  // tout seul. Un vieux client qui n'annonce rien retombe dans ce cas : la table
  // se comporte alors comme avant ce correctif, pas plus mal.
  //
  // ⚠️ On la rejoue à CHAQUE arrivée, à CHAQUE départ et à chaque arrivée qu'on
  // apprend, et c'est le point : une place qui se libère doit RENDRE SON IMAGE à
  // quelqu'un. Sans ça, la septième personne resterait une silhouette jusqu'à la
  // fin de la partie alors que la table s'est vidée — et personne ne comprendrait.
  //
  // L'instant d'arrivée d'un pair, tel que TOUT LE MONDE le lit : celui qu'il
  // annonce, et à défaut celui où je l'ai rencontré.
  // 🚨 LE DÉFAUT EST BORNÉ APRÈS LE MIEN, ET CE N'EST PAS UNE PRÉCAUTION GRATUITE :
  // `ne` et `monArrivee` sortent de la MÊME horloge, et huit onglets ouverts d'un
  // coup les posent dans la même milliseconde. L'égalité passe alors la main à
  // l'identifiant — qui peut très bien me placer huitième de ma propre table et me
  // retirer l'image que je viens de m'accorder. Or je me suis forcément assis AVANT
  // de rencontrer qui que ce soit : `monArrivee + 1` n'invente rien, il écrit ce
  // qu'on sait déjà. Un pair qui ANNONCE son arrivée n'est jamais concerné.
  const arriveeDe = p => p.arrivee || Math.max(p.ne, monArrivee + 1);
  function repartirImages() {
    // ⚠️ Pas pendant la fermeture : fermer() retire les pairs UN PAR UN, et chaque
    // retrait rejouerait la répartition sur des connexions qu'on est en train de
    // clore — des replaceTrack sur des RTCPeerConnection fermées, une renégociation
    // par pair, tout ça pour une table qui n'existe plus dans deux millisecondes.
    if (ferme) return;
    // 🚨 MOI COMPRIS : c'est ce qui rend la liste identique chez les huit. Une liste
    // qui ne contient que MES pairs n'est pas la même que celle du voisin, et on
    // retombe exactement sur le défaut qu'on vient de réparer.
    const table = [{ id: moi, t: monArrivee }]
      .concat([...pairs.values()].map(p => ({ id: p.id, t: arriveeDe(p) })));
    table.sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
    const enImage = new Set(table.slice(0, VIDEO_MAX).map(x => x.id));
    const jenSuis = enImage.has(moi);
    const changes = [];
    for (const p of pairs.values()) {
      // Les deux conditions sont la même chez lui, sur la même liste : s'il me voit,
      // je le vois, et si l'un de nous deux est hors de la tête de liste, personne
      // n'envoie rien. C'est ça, « vous ne vous voyez pas » — et c'est vrai.
      const droit = jenSuis && enImage.has(p.id);
      if (p.image !== droit) { p.image = droit; changes.push(p); }
    }
    // On ne rebranche QUE ceux qui changent : un replaceTrack pour rien renégocie
    // pour rien, et c'est huit fois rien qui fait une salve.
    for (const p of changes) { journal(p.image ? "image rendue" : "image retirée", p.id); if (p.tr) brancher(p, "image"); }
    reglerEncodage();
  }
  // Le palier d'encodage de MA caméra : il ne dépend QUE du nombre de pairs à qui
  // je l'envoie vraiment — ceux qui sont en son seul ne coûtent rien.
  function reglerEncodage() {
    const n = [...pairs.values()].filter(p => p.image).length;
    const pal = PALIERS_ENCODAGE.find(x => n <= x.pairs) || PALIERS_ENCODAGE[PALIERS_ENCODAGE.length - 1];
    for (const p of pairs.values()) {
      const env = p.tr && p.tr.sender;
      // Un vieux navigateur — ou la fausse RTCPeerConnection d'un banc — n'a pas
      // ces deux méthodes : on s'en passe, la visio marche, elle est juste moins
      // économe. Jamais une exception pour un réglage de confort.
      if (!env || typeof env.getParameters !== "function" || typeof env.setParameters !== "function") continue;
      let prm; try { prm = env.getParameters(); } catch (e) { continue; }
      if (!prm) continue;
      if (!prm.encodings || !prm.encodings.length) prm.encodings = [{}];
      const e = prm.encodings[0];
      if (e.maxBitrate === pal.bits && e.maxFramerate === pal.images && e.scaleResolutionDownBy === pal.reduction) continue;
      e.maxBitrate = pal.bits; e.maxFramerate = pal.images; e.scaleResolutionDownBy = pal.reduction;
      try {
        const r = env.setParameters(prm);
        if (r && typeof r.catch === "function") r.catch(x => journal("encodage refusé", p.id, x.message));
      } catch (x) { journal("encodage refusé", p.id, x.message); }
    }
  }
  // `seulement` vaut "image", "voix", ou rien du tout pour les deux. Attacher la
  // caméra ne doit pas venir remuer le transcepteur de la voix, ni l'inverse : ce sont
  // deux gestes indépendants et un `replaceTrack` de trop est un risque pour rien.
  function brancher(p, seulement) {
    const v = p.image ? (local && local.getVideoTracks()[0]) : null;
    const a = localMicro && localMicro.getAudioTracks()[0];
    for (const [tr, piste, quoi] of [[p.tr, v, "image"], [p.trA, a, "voix"]]) {
      if (!tr || (seulement && seulement !== quoi)) continue;   // je réponds et l'offre n'est pas encore là : adopter() s'en chargera
      try { tr.sender.replaceTrack(piste || null); tr.direction = piste ? "sendrecv" : "recvonly"; }
      catch (e) { journal(quoi + " non branchée", p.id, e.message); }
    }
  }
  function garnir(p) {
    if (p.tr) return;
    // ⚠️ `p.image` FAUX ne supprime PAS la ligne vidéo : elle reste, en recvonly et
    // sans piste — exactement comme quelqu'un qui n'a pas allumé sa caméra. C'est
    // ce qui permet de la rallumer plus tard (une place se libère) par un simple
    // replaceTrack, sans jamais toucher à l'ORDRE des sections m=, qui est un
    // contrat entre les deux côtés.
    const v = p.image ? (local && local.getVideoTracks()[0]) : null;
    p.tr = p.pc.addTransceiver(v || "video", { direction: v ? "sendrecv" : "recvonly" });
    const a = localMicro && localMicro.getAudioTracks()[0];
    p.trA = p.pc.addTransceiver(a || "audio", { direction: a ? "sendrecv" : "recvonly" });
    reglerEncodage();
  }
  // Après une offre distante : les transcepteurs qui portent un mid sont ceux qui
  // comptent, on prend ceux-là. Et on ferme les nôtres restés SANS mid : deux offres
  // croisées peuvent nous en avoir laissé un, et un orphelin ajouterait une section m=
  // à la prochaine offre — c'est-à-dire qu'il rejouerait le défaut ci-dessus.
  function adopter(p) {
    const pris = { video: null, audio: null };
    for (const t of ((p.pc.getTransceivers && p.pc.getTransceivers()) || [])) {
      const k = (t.receiver && t.receiver.track && t.receiver.track.kind) || "";
      if ((k === "video" || k === "audio") && t.mid !== null && !pris[k]) pris[k] = t;
    }
    for (const [k, mien] of [["video", p.tr], ["audio", p.trA]]) {
      if (pris[k] && mien && mien !== pris[k] && mien.mid === null) {
        try { mien.stop(); journal("transcepteur orphelin fermé", p.id, k); }
        catch (e) { journal("orphelin non fermé", p.id, e.message); }
      }
    }
    p.tr = pris.video || p.tr;
    p.trA = pris.audio || p.trA;
    brancher(p);   // ma caméra et ma voix partent DANS LA RÉPONSE, pas dans une ronde de plus
    reglerEncodage();
  }
  async function offrir(p, pourquoi) {
    const pc = p.pc;
    // makingOffer en plus de l'état : garnir() déclenche negotiationneeded, qui rappelle
    // offrir() avant que setLocalDescription ait eu le temps de quitter « stable » —
    // sans ce garde, deux offres partiraient pour une seule paire.
    if (p.makingOffer || pc.signalingState !== "stable") return;
    try {
      p.makingOffer = true;
      garnir(p);
      await pc.setLocalDescription();
      journal("offre", p.id, pourquoi);
      envoyerDescription(p);
    } catch (e) { journal("offre ratée", p.id, e.message); }
    finally { p.makingOffer = false; }
  }

  function ajouter(id, sess) {
    if (pairs.has(id)) return pairs.get(id);
    // ⚠️ CE PLAFOND-CI EST CELUI DES CONNEXIONS, donc des VOIX — huit personnes,
    // sept pairs. Il n'a plus rien à voir avec les images : celles-là sont
    // rationnées par repartirImages(), plus bas, sans refuser personne.
    if (pairs.size >= PAIRS_MAX - 1) { etat(id, "refuse"); journal("refusé (table pleine)", id); return null; }
    if (!disponible()) { etat(id, "indisponible"); return null; }
    const polite = moi < id;
    // `image` : ai-je le droit d'échanger mon image avec lui ? Faux au départ, posé
    // pour de bon par repartirImages() quelques lignes plus bas — AVANT la première
    // offre, donc garnir() le lit déjà juste. `arrivee` reste à 0 tant qu'il n'a pas
    // salué ; arriveeDe() se rabat alors sur `ne`.
    const p = { id, session: sess, polite, image: false, arrivee: 0, ice: "new", vu: Date.now(), ne: Date.now(), pc: null,
      makingOffer: false, ignoreOffer: false, answerPending: false, attente: [], redemarrages: 0,
      candidats: [], lot: [], lotMinuteur: null, dernierEnvoiOffre: 0, attentePolie: null, collecteMs: null,
      tr: null, trA: null };   // posés par garnir() si j'offre, par adopter() si je réponds
    const pc = new RTCPeerConnection({ iceServers });
    p.pc = pc;
    pairs.set(id, p);
    // Les deux transcepteurs (un vidéo, un audio) sont posés plus bas : par garnir()
    // si c'est nous qui offrons, par adopter() si c'est nous qui répondons. Voir le
    // gros avertissement devant ces deux fonctions — les créer ICI, des deux côtés,
    // était le défaut qui doublait les sections m= et gelait l'image sept secondes.
    //
    // Ce rappel-ci ne sert qu'aux renégociations d'APRÈS : on allume sa caméra, on
    // ouvre son micro. La PREMIÈRE négociation, elle, est lancée en toutes lettres au
    // bas de cette fonction.
    pc.onnegotiationneeded = () => {
      if (p.makingOffer) return;   // c'est garnir() qui vient de poser les transcepteurs
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
    pc.onicegatheringstatechange = () => { if (pc.iceGatheringState === "complete") { if (p.collecteMs === null) { p.collecteMs = Date.now() - p.ne; journal("collecte ICE finie", id, p.collecteMs + " ms"); } envoyerLot(p); } };
    pc.onsignalingstatechange = () => journal("signalisation", id, pc.signalingState);
    pc.oniceconnectionstatechange = () => {
      p.ice = pc.iceConnectionState; etat(id, p.ice);
      if (p.ice === "failed" && pairs.get(id) === p) {
        // On le DIT avant de réessayer : un échec de connexion directe sans relais ne se
        // répare pas tout seul, et une vignette muette ferait croire à un ami sans caméra.
        etat(id, "bloque");
        // On redémarre ICE, mais pas en boucle serrée : deux secondes, cinq fois.
        if (p.redemarrages++ < 5) setTimeout(() => { if (pairs.get(id) === p && pc.signalingState !== "closed") { journal("redémarrage ICE", id); pc.restartIce(); } }, 2000);
      }
    };
    pc.ontrack = ({ track, streams }) => {
      // Les pistes arrivent chacune dans son flux : on les ajoute par `addTransceiver`
      // sans les associer à un MediaStream, donc `streams` est vide et on en fabrique
      // un par piste. L'image et la voix ne se mélangent jamais, ni ici ni à l'écran.
      const s = streams[0] || new MediaStream([track]);
      const rappel = track.kind === "audio" ? onAudio : onFlux;
      if (rappel) try { rappel(id, s); } catch (_) {}
    };
    journal("pair ajouté", id, polite ? "(je suis poli)" : "(je suis impoli)");
    // 🚨 C'EST ICI QUE LA NÉGOCIATION PART, ET IL FAUT LE DIRE EN TOUTES LETTRES.
    // Elle partait toute seule tant que les transcepteurs naissaient avec la paire :
    // addTransceiver lève `negotiationneeded`. Maintenant qu'ils ne naissent qu'au
    // moment d'offrir, plus RIEN ne la déclenche — et le filet de menage() ne la
    // rattrapait qu'après REOFFRE_MS, soit QUATRE SECONDES d'écran noir. Mesuré au
    // banc : la collecte ICE passait de 0,3 s à 4,8 s, jusqu'à dépasser son plafond.
    // L'impoli offre tout de suite, le poli laisse passer ATTENTE_POLIE_MS — mot pour
    // mot ce que faisait onnegotiationneeded, mais déclenché explicitement.
    // ⚠️ ET ELLE PART AVEC UNE GIGUE, des deux côtés. Sept pairs qui offrent tous
    // à la même milliseconde à celui qui vient d'entrer, c'est sa salve — et le
    // courtier en jette le tiers. Étalée, elle passe.
    // 🚨 MAIS LA GIGUE EST PROPORTIONNELLE À LA FOULE, et c'est tout l'intérêt :
    // à deux, elle vaut ZÉRO — la paire se négocie exactement comme avant, sans
    // une milliseconde de plus, et l'impoli offre encore de façon SYNCHRONE.
    // Une table pleine l'étale sur GIGUE_OFFRE_MS entier. On ne fait pas payer à
    // deux amis le prix d'une salve qui ne peut pas se produire chez eux.
    // 🚨 Le total (ATTENTE_POLIE_MS + GIGUE_OFFRE_MS = 3,7 s) doit RESTER SOUS
    // REOFFRE_MS : au-delà, le filet de menage() offrirait par-dessus l'attente
    // polie et on aurait deux offres pour une paire — la collision qu'on évite.
    const foule = Math.min(1, Math.max(0, pairs.size - 1) / Math.max(1, PAIRS_MAX - 2));
    const attente = (polite ? ATTENTE_POLIE_MS : 0) + Math.random() * GIGUE_OFFRE_MS * foule;
    repartirImages();
    if (!attente) offrir(p, "");
    else p.attentePolie = setTimeout(() => {
      p.attentePolie = null;
      if (pairs.get(id) === p && !pc.remoteDescription) offrir(p, polite ? "(le poli n'a rien reçu)" : "");
    }, attente);
    return p;
  }
  function retirer(id, pourquoi) {
    const p = pairs.get(id); if (!p) return;
    pairs.delete(id);
    clearTimeout(p.lotMinuteur); clearTimeout(p.attentePolie);
    try { p.pc.onnegotiationneeded = p.pc.onicecandidate = p.pc.ontrack = p.pc.oniceconnectionstatechange = p.pc.onsignalingstatechange = p.pc.onicegatheringstatechange = null; p.pc.close(); } catch (_) {}
    journal("pair retiré", id, pourquoi || "");
    repartirImages();   // une place libérée rend son image à quelqu'un
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
    if (d.type === "offer") { adopter(p); await pc.setLocalDescription(); envoyerDescription(p); }
    // Les candidats portés par la description, puis ceux arrivés avant elle.
    const q = [...(cands || []), ...p.attente]; p.attente = [];
    for (const c of q) await candidat(p, c);
  }
  async function candidat(p, c) {
    if (!p.pc.remoteDescription) { p.attente.push(c); return; }
    try { await p.pc.addIceCandidate(c); }
    catch (e) { if (!p.ignoreOffer) journal("candidat refusé", p.id, e.message); }
  }
  // L'instant d'arrivée qu'un pair annonce dans son salut. On le RETIENT et on
  // rejoue la répartition : sans ça, la clé de tri resterait l'horloge locale et
  // les deux côtés d'une paire ne classeraient pas la table pareil.
  // ⚠️ Le salut revient toutes les SALUT_INTERVALLE_MS : on ne rejoue la répartition
  // que si la valeur CHANGE, sinon on renégocierait à chaque ronde, pour rien.
  function noterArrivee(id, t) {
    const p = pairs.get(id), n = +t;
    if (!p || !n || !isFinite(n) || p.arrivee === n) return;
    p.arrivee = n;
    repartirImages();
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
    sansRelais,
    get session() { return session; },
    demarrer() {
      if (ferme) return;
      reseau.souscrire(base + "+/tous");
      reseau.souscrire(base + "+/" + moi);
      // 🚨 L'INTERVALLE NAÎT DANS LE setTimeout, pas à côté : c'est ce qui décale
      // le calendrier ENTIER. Lancé dehors, il repartirait à la même seconde que
      // celui des autres et tout se resynchroniserait à la deuxième ronde.
      salutMinuteur = setTimeout(() => {
        if (ferme) return;
        salut();
        salutMinuteur = setInterval(salut, SALUT_INTERVALLE_MS);
      }, Math.random() * GIGUE_SALUT_MS);
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
      if (m.t === "salut") { accueillir(de, m.s); noterArrivee(de, m.a); if (m.v) voix(de, m.v); return true; }
      const p = accueillir(de, m.s);   // une description d'un inconnu vaut un salut
      if (!p) return true;
      if (m.t === "description" && m.d) description(p, m.d, m.c).catch(e => journal("description ratée", de, e.message));
      else if (m.t === "candidats" && Array.isArray(m.c)) (async () => { for (const c of m.c) await candidat(p, c); })();
      else if (m.t === "voix" && m.v) voix(de, m.v);
      return true;
    },
    // Pose (ou remplace) mon flux local : chaque paire passe en sendrecv, la
    // renégociation part toute seule. Null pour cesser d'être vu.
    attacherFlux(f) {
      local = f;
      for (const p of pairs.values()) brancher(p, "image");
    },
    // Pose (ou remplace) ma voix : même geste que pour la caméra, dans le transcepteur
    // audio qui existe depuis la création de la paire. Null pour cesser d'être entendu.
    // ⚠️ Ceci sert à ALLUMER ou ÉTEINDRE le micro, pas à se taire une seconde : pour la
    // sourdine, c'est `couperMicro` — retirer la piste renégocie, `enabled` non.
    attacherMicro(f) {
      localMicro = f;
      for (const p of pairs.values()) brancher(p, "voix");
    },
    // La sourdine : `enabled = false` sur la piste locale, RIEN D'AUTRE. Aucune
    // renégociation, aucun message sur le courtier, aucun vacillement chez le pair
    // d'en face — juste des paquets vides jusqu'au prochain clic.
    // ⚠️ C'est LA MÊME piste que celle de micro.mjs : `visio.couperMicro(true)` et
    // `microPartage().couper(true)` ont exactement le même effet, il n'y a pas deux
    // vérités. L'application passe par micro.mjs (qui prévient l'écran) ; celui-ci
    // existe pour les bancs, qui n'ont pas de micro partagé.
    couperMicro(v) {
      const pistes = localMicro ? localMicro.getAudioTracks() : [];
      const n = v === undefined ? !(pistes.length && !pistes[0].enabled) : !!v;
      pistes.forEach(t => { try { t.enabled = !n; } catch (e) {} });
      return n;
    },
    microCoupe() {
      const t = localMicro && localMicro.getAudioTracks()[0];
      return !t || !t.enabled;
    },
    // Dit à toute la table où en est MON micro. Un message par CHANGEMENT, jamais un par
    // syllabe : l'appelant coalesce (visio.js, rvAnnoncerVoix), et le salut périodique le
    // répète pour ceux qui l'auraient manqué. Rend l'état retenu.
    annoncerVoix(v) {
      if (!ETATS_VOIX.includes(v) || v === maVoix) return maVoix;
      maVoix = v;
      pousser("tous", { t: "voix", v });
      return maVoix;
    },
    get voixAnnoncee() { return maVoix; },
    // Pour l'app qui tient déjà sa présence (salut/adieu des cartes) : un coup de coude.
    arrivee(id) { if (id && id !== moi) salut(id); },
    depart(id) { retirer(id, "départ annoncé"); },
    fermer() {
      if (ferme) return; ferme = true;
      // ⚠️ `salutMinuteur` est un TIMEOUT tant que la gigue court, un INTERVAL
      // ensuite : on coupe les deux, sinon fermer() pendant la gigue laisse un
      // salut partir depuis une visio qu'on vient de fermer.
      clearTimeout(salutMinuteur); clearInterval(salutMinuteur); clearInterval(menageMinuteur); clearTimeout(pompe);
      publier("tous", { t: "adieu" });   // tout de suite, pas par la file : la page se ferme
      for (const id of [...pairs.keys()]) retirer(id, "fermeture");
    },
  };
  return api;
}
