// La table de blackjack À PLUSIEURS : l'HÔTE est autoritaire, et rien ici ne touche le DOM.
//
// Deux objets, testables sans navigateur (src/table-reseau.test.mjs) :
//   · la PARTIE (creerPartie) — l'état d'une table : sièges, mises, mains, sabot,
//     règlement. Une machine à étapes que l'hôte fait avancer (etape) et à laquelle
//     les joueurs soumettent des actions (action). Le règlement passe par engine.mjs,
//     jamais par une copie : mêmes mains, mêmes gains, à l'unité près.
//   · la SALLE (creerSalle) — le protocole autour d'un transport quelconque (MQTT en
//     vrai, une file en mémoire dans les tests) : présence des pairs, diffusion de
//     l'état versionné, actions vers l'hôte, élection quand l'hôte tombe.
//
// Ce qu'un invité reçoit est un ÉTAT complet, idempotent, versionné : il l'affiche
// tel quel et ne calcule jamais une issue de son côté. La carte cachée du croupier
// n'y figure pas tant qu'elle n'est pas retournée — on ne peut pas lire ce qu'on
// n'a pas reçu. Le sabot (l'ordre des cartes) ne quitte JAMAIS l'hôte : quand un
// nouvel hôte reprend l'état, il ne connaît pas les cartes à venir, donc la manche
// en cours est annulée, les mises rendues, et un sabot neuf est scellé — l'écran le dit.
import { newHand, handTotal, isSoft, isBust, isBlackjack, canSplit, canDouble, canSurrender,
  cardValue, isAce, settleHand, settleNoHoleCard, settleInsurance, makeRules } from "./engine.mjs";

export const TAPIS_DEPART = 1000;          // tout le monde s'assoit avec le même tapis
export const MISE_DELAI = 20000;           // la phase de mise, bornée
export const TOUR_DELAI = 30000;           // un joueur qui ne joue pas : il reste
export const ASSURANCE_DELAI = 12000;      // sans réponse : pas d'assurance
export const REGLEMENT_DELAI = 3200;       // les jetons glissent, puis on remet ça
export const ABSENCE_DELAI = 15000;        // un siège dont le joueur a disparu reste tenu ce temps-là
export const ELECTION_DELAI = 3000;        // un nouvel arrivant sans hôte connu attend avant d'en devenir un
export const NB_SIEGES = 5;
export const ACTIONS = ["asseoir", "lever", "mise", "rachat", "clore", "bots", "tirer", "rester", "doubler", "separer", "abandon", "assurance"];
export const NOMS_BOTS = ["Marc", "Sonia", "Karim", "Léa", "Paul"];
const arr = x => Math.round(x * 100) / 100;
const carteTxt = c => c.r + c.suit;

/* ── La partie ─────────────────────────────────────────────────────────── */
export function creerPartie(o) {
  o = o || {};
  const regles = makeRules(o.regles || {});
  const P = {
    v: 0, hote: o.hote || "", table: o.table || "boulevard", sys: o.sys || "hilo", jeux: o.jeux || regles.decks,
    phase: "attente", manche: 0, sieges: Array.from({ length: o.nbSieges || NB_SIEGES }, () => null),
    croupier: [], cachee: false, actif: null, message: "", evenement: null,
    cartes: (o.cartes || []).slice(), empreinte: o.empreinte || "", graine: o.graine || null, prochain: null,
    coupe: 0, defausse: 0, rc: 0, vues: 0, bots: !!o.bots, csm: !!o.csm,
    miseMin: o.miseMin || 10, miseMax: o.miseMax || 1000, par5: !!o.par5, tapisDepart: o.tapis || TAPIS_DEPART,
    miseFin: 0, tourFin: 0, assuranceFin: 0, reglementFin: 0, prochaineEtape: 0, cadence: o.cadence || 900,
    journal: [], sabots: [], besoinRemelange: false, regenere: false,
    donne: [],                // les cartes de la donne initiale qui restent à distribuer
  };
  const valeur = o.valeur || (() => 0), rcInitial = o.rcInitial || (() => 0);
  const strategie = o.strategie || ((cards) => handTotal(cards) < 17 ? "H" : "S");
  const changer = () => { P.v++; return true; };
  const humain = st => st && !st.bot;
  const siegeDe = id => P.sieges.findIndex(s => s && s.id === id);
  const idHote = () => P.hote;

  function installerSabot(s, pendant) {
    if (P.empreinte) { const d = P.sabots.find(x => x.empreinte === P.empreinte); if (d && P.graine) d.graine = P.graine; }
    P.cartes = s.cartes.slice(); P.empreinte = s.empreinte; P.graine = s.graine || null;
    P.sabots.push({ empreinte: s.empreinte, graine: null, manche: P.manche + 1 }); if (P.sabots.length > 12) P.sabots.shift();
    // La carte de coupe = les cartes LAISSÉES derrière (le remélange se déclenche sur
    // `P.cartes.length <= P.coupe`), alors que la pénétration est la fraction JOUÉE.
    // Corrigé le 6 septembre 2026 : on écrivait `length * penetration`, soit l'inverse —
    // 78 cartes jouées au Boulevard au lieu de 234. Explication complète dans
    // src/app/table.js, au même endroit. La branche mélangeuse (`* .02`) est inerte :
    // `P.csm ||` court-circuite le test de remélange plus bas.
    P.coupe = P.csm ? Math.floor(P.cartes.length * .02) : Math.floor(P.cartes.length * (1 - (o.penetration || regles.penetration || .75)));
    P.cartes.pop(); P.defausse = 1;               // la carte brûlée
    P.rc = rcInitial(P.jeux); P.vues = 0; P.besoinRemelange = false; P.pendantDonne = !!pendant;
    P.evenement = { t: "remelange", pendantDonne: !!pendant };
  }
  // Une nouvelle graine est révélée quand le sabot qu'elle a produit est fini : le
  // reçu montre alors empreinte ET graine, et n'importe qui peut rejouer le mélange.
  // Un sabot qui arrive pendant une manche interrompue (phase « sabot ») la REPREND là où
  // elle s'est arrêtée : la carte manquante sera tirée au prochain pas.
  function remelanger(s, pendant) {
    const reprise = P.phase === "sabot";
    installerSabot(s, pendant || reprise);
    if (reprise) { P.phase = P.phaseAvantSabot || "attente"; P.phaseAvantSabot = ""; P.message = ""; }
    return changer();
  }
  function piocher() {
    if (!P.cartes.length) {
      if (P.prochain) { const s = P.prochain; P.prochain = null; installerSabot(s, true); }
      else { P.phaseAvantSabot = P.phase; P.phase = "sabot"; P.message = "Le sabot est vide : en attente d'un sabot neuf."; return null; }
    }
    return P.cartes.pop();
  }
  const assezDeCartes = n => P.cartes.length >= n || !!P.prochain;
  const voir = c => { P.rc += valeur(c); P.vues++; };

  /* ── Les sièges ── */
  function asseoir(id, nom, couleur, k, bot) {
    if (k < 0 || k >= P.sieges.length) return "Ce siège n'existe pas.";
    const deja = siegeDe(id);
    if (deja === k) return null;
    const occ = P.sieges[k];
    if (occ && !(occ.bot && !bot)) return "Ce siège est pris.";
    if (occ && occ.bot && P.phase !== "attente" && P.phase !== "mise") return "Attends la fin de la manche pour prendre ce siège.";
    if (deja >= 0) { if (P.phase !== "attente" && P.phase !== "mise") return "Tu ne changes pas de siège en pleine manche."; P.sieges[deja] = null; }
    P.sieges[k] = { id, nom: (nom || "Joueur").slice(0, 18), couleur: couleur || "", bot: !!bot, tapis: P.tapisDepart, mise: 0, rachats: 0, mains: [], passe: false, absent: 0 };
    // Un siège pris pendant les mises entre tout de suite dans la manche (il a le temps de miser).
    if (bot && P.phase === "mise") miserBot(P.sieges[k]);
    return null;
  }
  function lever(id) {
    const k = siegeDe(id); if (k < 0) return "Tu n'es pas assis.";
    const st = P.sieges[k];
    if (st.mise && P.phase === "mise") { st.tapis = arr(st.tapis + st.mise); st.mise = 0; }
    if (P.phase === "attente" || P.phase === "mise" || !st.mains.length) P.sieges[k] = null;
    else st.absent = 1;                            // la main se joue toute seule, le siège se libère après
    return null;
  }
  function quitter(id, now) { const k = siegeDe(id); if (k < 0) return false; P.sieges[k].absent = now || 1; return changer(); }
  function revenir(id) { const k = siegeDe(id); if (k < 0 || !P.sieges[k].absent) return false; P.sieges[k].absent = 0; return changer(); }
  function completerBots() {
    if (!P.bots) return;
    P.sieges.forEach((st, k) => { if (!st) asseoir("bot-" + k, NOMS_BOTS[k % NOMS_BOTS.length], "", k, true); });
  }
  function retirerBots() { P.sieges.forEach((st, k) => { if (st && st.bot) P.sieges[k] = null; }); }
  function libererAbsents(now) {
    let ch = false;
    P.sieges.forEach((st, k) => { if (st && st.absent && !st.mains.length && (!now || now - st.absent >= ABSENCE_DELAI)) { P.sieges[k] = null; ch = true; } });
    return ch;
  }

  /* ── Les mises ── */
  function miserBot(st) {
    if (st.tapis < P.miseMin) { st.tapis = P.tapisDepart; st.rachats++; }
    let m = Math.max(P.miseMin, Math.min(P.miseMax, st.tapis, P.miseMin * (1 + (P.manche % 3 === 0 ? 1 : 0))));
    if (P.par5) m = Math.max(P.miseMin, Math.floor(m / 5) * 5);
    st.tapis = arr(st.tapis + st.mise - m); st.mise = m;
  }
  function ouvrirMises(now) {
    if (P.besoinRemelange || !P.cartes.length) { P.phase = "sabot"; P.message = "Sabot fini : on remélange."; return;
    }
    P.sieges.forEach(st => { if (!st) return; st.mains = []; st.passe = false; st.assurance = undefined; if (st.absent) st.mise = 0; });
    libererAbsents(now);
    completerBots();
    P.phase = "mise"; P.miseFin = now + MISE_DELAI; P.croupier = []; P.cachee = false; P.actif = null;
    P.message = ""; P.evenement = { t: "mises" };
    P.sieges.forEach(st => { if (st && st.bot) miserBot(st); });
  }
  function miseValide(st, v) {
    if (typeof v !== "number" || isNaN(v) || v < 0) return "Mise illisible.";
    if (v > 0 && v < P.miseMin) return `Le minimum ici est de ${P.miseMin}.`;
    if (v > P.miseMax) return `Le maximum de la table est de ${P.miseMax}.`;
    if (P.par5 && v % 5 !== 0) return "Ici les mises vont par 5.";
    if (v > st.tapis + st.mise) return "Il ne te reste pas ça en main.";
    return null;
  }
  function clore(now) {
    if (P.phase !== "mise") return false;
    const joueurs = P.sieges.filter(st => st && st.mise >= P.miseMin && !st.absent);
    if (!joueurs.length) { P.miseFin = now + MISE_DELAI; P.message = "Personne n'a misé : les mises restent ouvertes."; return true; }
    P.sieges.forEach(st => { if (!st) return; st.passe = !(st.mise >= P.miseMin) || !!st.absent; st.mains = st.passe ? [] : [newHand([], st.mise)]; st.assurance = undefined; });
    P.phase = "donne"; P.manche++; P.message = ""; P.regenere = false;
    // L'ordre d'une vraie donne : un tour de table, la carte visible du croupier,
    // un second tour, puis la carte cachée (sauf table sans carte cachée).
    P.donne = [];
    for (let tour = 0; tour < 2; tour++) {
      P.sieges.forEach((st, k) => { if (st && !st.passe) P.donne.push({ siege: k, main: 0 }); });
      if (tour === 0) P.donne.push({ siege: "croupier", cachee: false });
      else if (regles.holeCard) P.donne.push({ siege: "croupier", cachee: true });
    }
    P.evenement = { t: "donne-debut" }; P.prochaineEtape = now;
    return true;
  }

  /* ── La donne, carte par carte ── */
  function etapeDonne(now) {
    const d = P.donne[0];
    if (d) {
      const c = piocher(); if (!c) return true;
      P.donne.shift();
      if (d.siege === "croupier") { c.cachee = !!d.cachee; P.croupier.push(c); P.cachee = P.cachee || !!d.cachee; if (!d.cachee) voir(c); }
      else { const st = P.sieges[d.siege]; if (st) { st.mains[d.main].cards.push(c); voir(c); } }
      P.evenement = { t: "carte", siege: d.siege, main: d.main || 0, cachee: !!d.cachee };
      P.prochaineEtape = now + P.cadence;
      return true;
    }
    // Donne finie : assurance si le croupier montre un as, puis il regarde sa carte.
    const up = P.croupier[0];
    if (regles.holeCard && up && cardValue(up) === 11 && P.sieges.some(st => st && !st.passe && !st.bot && !st.absent)) {
      P.phase = "assurance"; P.assuranceFin = now + ASSURANCE_DELAI; P.message = "Le croupier montre un as. Assurance ?";
      P.sieges.forEach(st => { if (st && !st.passe) st.assurance = st.bot || st.absent ? false : undefined; });
      P.evenement = { t: "assurance-offre" };
      return true;
    }
    return apresDonne(now);
  }
  function apresDonne(now) {
    const up = P.croupier[0];
    if (regles.holeCard && regles.peek && up && cardValue(up) >= 10) {
      if (handTotal(P.croupier) === 21) { reveler(); P.message = "Blackjack du croupier."; P.phase = "reglement"; regler(now); return true; }
    }
    P.phase = "jeu"; P.actif = null; P.message = "";
    avancer(now);
    return true;
  }
  function reveler() {
    const c = P.croupier.find(x => x.cachee); if (!c) return;
    c.cachee = false; P.cachee = false; voir(c); P.evenement = { t: "croupier-revele" };
  }
  function etapeAssurance(now) {
    const attend = P.sieges.some(st => st && !st.passe && st.assurance === undefined);
    if (attend && now < P.assuranceFin) return false;
    P.sieges.forEach(st => { if (st && !st.passe) { if (st.assurance === undefined) st.assurance = false; if (st.assurance) { const h = st.mains[0]; h.assurance = h.bet / 2; st.tapis = arr(st.tapis - h.assurance); } } });
    P.evenement = { t: "assurance-fin-offre" };
    return apresDonne(now);
  }

  /* ── Le jeu : le tour passe de siège en siège ── */
  function avancer(now) {
    let k = 0, hi = 0;
    if (P.actif) { k = P.actif.siege; hi = P.actif.main + 1; }
    for (; k < P.sieges.length; k++, hi = 0) {
      const st = P.sieges[k]; if (!st || st.passe) continue;
      for (; hi < st.mains.length; hi++) {
        const h = st.mains[hi];
        if (h.surrendered || h.result) continue;
        if (isBlackjack(h) && st.mains.length === 1) { h.result = "blackjack"; continue; }
        if (h.fromSplitAces && !regles.hitSplitAces && h.cards.length === 2) continue;
        if (handTotal(h.cards) >= 21) { if (isBust(h.cards)) sauter(h, k, hi); continue; }
        P.actif = { siege: k, main: hi }; P.tourFin = now + TOUR_DELAI; P.prochaineEtape = now + P.cadence;
        P.evenement = { t: "tour", siege: k, main: hi }; P.message = "";
        return;
      }
    }
    P.actif = null; P.phase = "croupier"; P.prochaineEtape = now + P.cadence * .6;
    P.evenement = { t: "tour", siege: "croupier", main: 0 };
  }
  function sauter(h, k, hi) { h.result = "sauté"; h.emis = true; P.evenement = { t: "main-fin", siege: k, main: hi, issue: "bust", montant: -h.bet * (h.doubled ? 2 : 1) }; }
  function mainActive() { if (!P.actif) return null; const st = P.sieges[P.actif.siege]; return st ? { st, h: st.mains[P.actif.main], k: P.actif.siege, hi: P.actif.main } : null; }
  const peutPayer = (st, h) => st.tapis >= h.bet;
  function jouer(a, now) {
    const m = mainActive(); if (!m) return "Ce n'est le tour de personne.";
    const { st, h, k, hi } = m;
    if (a === "tirer") { const c = piocher(); if (!c) return null; h.cards.push(c); voir(c); P.evenement = { t: "carte", siege: k, main: hi }; P.tourFin = now + TOUR_DELAI;
      if (isBust(h.cards)) { sauter(h, k, hi); avancer(now); } else if (handTotal(h.cards) >= 21) avancer(now); return null; }
    if (a === "rester") { avancer(now); return null; }
    if (a === "doubler") { if (!canDouble(h, st.mains, regles)) return "Tu ne peux pas doubler ici."; if (!peutPayer(st, h)) return "Il ne te reste pas de quoi doubler.";
      st.tapis = arr(st.tapis - h.bet); h.doubled = true; const c = piocher(); if (!c) return null; h.cards.push(c); voir(c);
      P.evenement = { t: "carte", siege: k, main: hi, double: true }; if (isBust(h.cards)) sauter(h, k, hi); avancer(now); return null; }
    if (a === "separer") { if (!canSplit(h, st.mains, regles)) return "Tu ne peux pas séparer ici."; if (!peutPayer(st, h)) return "Il ne te reste pas de quoi séparer.";
      if (!assezDeCartes(2)) { P.phaseAvantSabot = P.phase; P.phase = "sabot"; P.message = "Le sabot est vide : en attente d'un sabot neuf."; return null; }
      st.tapis = arr(st.tapis - h.bet); const c2 = h.cards.pop(), as = isAce(h.cards[0]);
      const nh = newHand([c2], h.bet, { fromSplit: true, fromSplitAces: as }); h.fromSplit = true; h.fromSplitAces = as;
      st.mains.splice(hi + 1, 0, nh);
      const a1 = piocher(), a2 = piocher(); if (!a1 || !a2) return null; h.cards.push(a1); nh.cards.push(a2); voir(a1); voir(a2);
      P.evenement = { t: "separe", siege: k, main: hi }; P.tourFin = now + TOUR_DELAI;
      if (as && !regles.hitSplitAces) avancer(now); else if (handTotal(h.cards) >= 21) avancer(now);
      return null; }
    if (a === "abandon") { if (!canSurrender(h, st.mains, regles)) return "Pas d'abandon ici."; h.surrendered = true; h.result = "abandon"; h.emis = true;
      P.evenement = { t: "main-fin", siege: k, main: hi, issue: "abandon", montant: -h.bet / 2 }; avancer(now); return null; }
    return "Action inconnue.";
  }
  function etapeJeu(now) {
    const m = mainActive(); if (!m) { avancer(now); return true; }
    const { st, h } = m;
    if (st.bot || st.absent) {
      if (now < P.prochaineEtape) return false;
      const a = st.absent ? "S" : strategie(h.cards, P.croupier[0], { mains: st.mains, main: h, regles, tapis: st.tapis, peutDoubler: canDouble(h, st.mains, regles) && peutPayer(st, h), peutSeparer: canSplit(h, st.mains, regles) && peutPayer(st, h), peutAbandonner: canSurrender(h, st.mains, regles) });
      const err = jouer({ H: "tirer", S: "rester", D: "doubler", P: "separer", U: "abandon" }[a] || "rester", now);
      if (err) jouer("rester", now);
      P.prochaineEtape = now + P.cadence; return true;
    }
    if (now >= P.tourFin) { P.message = `${st.nom} n'a pas joué : ${st.nom} reste.`; jouer("rester", now); return true; }
    return false;
  }
  function etapeCroupier(now) {
    if (now < P.prochaineEtape) return false;
    P.prochaineEtape = now + P.cadence;
    if (P.cachee) { reveler(); return true; }
    if (!regles.holeCard && P.croupier.length === 1) { const c = piocher(); if (!c) return true; P.croupier.push(c); voir(c); P.evenement = { t: "carte", siege: "croupier", main: 0 }; return true; }
    const vivants = P.sieges.some(st => st && !st.passe && st.mains.some(h => !h.surrendered && !isBust(h.cards) && !(isBlackjack(h) && st.mains.length === 1)));
    if (vivants) {
      const t = handTotal(P.croupier), soft = isSoft(P.croupier);
      if (!(t > 21 || t > 17 || (t === 17 && !(regles.h17 && soft)))) { const c = piocher(); if (!c) return true; P.croupier.push(c); voir(c); P.evenement = { t: "carte", siege: "croupier", main: 0 }; return true; }
    }
    P.phase = "reglement"; regler(now); return true;
  }

  /* ── Le règlement : engine.mjs tranche, la partie ne fait qu'encaisser ── */
  function regler(now) {
    const dt = handTotal(P.croupier), dBJ = regles.holeCard && P.croupier.length === 2 && dt === 21;
    const fins = [], entree = { manche: P.manche, empreinte: P.empreinte, croupier: P.croupier.map(carteTxt), total: dt, sieges: [] };
    P.sieges.forEach((st, k) => {
      if (!st || st.passe) return;
      let net = 0; const mains = [];
      st.mains.forEach((h, hi) => {
        if (h.assurance) { const ni = settleInsurance(h.bet, dBJ); net += ni; st.tapis = arr(st.tapis + h.assurance + ni); fins.push({ t: "assurance-fin", siege: k, main: hi, gagne: dBJ, montant: ni }); }
        const res = regles.holeCard ? settleHand(h, P.croupier, regles) : settleNoHoleCard(h, P.croupier, regles);
        h.result = res.result; h.net = res.net; net += res.net;
        const engage = h.surrendered ? h.bet : h.bet * (h.doubled ? 2 : 1);
        st.tapis = arr(st.tapis + engage + res.net);
        mains.push({ cartes: h.cards.map(carteTxt), issue: res.result, mise: h.bet * (h.doubled ? 2 : 1), net: res.net });
        if (!h.emis) fins.push({ t: "main-fin", siege: k, main: hi, issue: res.result, montant: res.net });
      });
      st.dernierNet = net; st.mise = 0;
      entree.sieges.push({ siege: k, id: st.id, nom: st.nom, bot: st.bot, mains, net: arr(net), tapis: st.tapis });
    });
    P.defausse += P.croupier.length + P.sieges.reduce((s, st) => s + (st ? st.mains.reduce((a, h) => a + h.cards.length, 0) : 0), 0);
    P.journal.push(entree); if (P.journal.length > 40) P.journal.shift();
    P.actif = null; P.reglementFin = now + REGLEMENT_DELAI;
    P.message = `Croupier ${dt > 21 ? "saute à " + dt : dt}.`;
    P.evenement = { t: "manche-fin", fins, croupier: dt };
    if (P.csm || P.cartes.length <= P.coupe) P.besoinRemelange = true;
  }
  function etapeReglement(now) {
    if (now < P.reglementFin) return false;
    // Ce qui est sur le feutre part à la défausse ; les mains restent visibles jusqu'aux prochaines mises.
    ouvrirMises(now);
    return true;
  }

  /* ── L'entrée unique des actions ── */
  function action(m, now) {
    now = now || 0;
    const a = m.a, id = m.id;
    if (!ACTIONS.includes(a)) return { ok: false, erreur: "Action inconnue." };
    if (a === "asseoir") { const err = asseoir(id, m.nom, m.couleur, +m.v, false); if (err) return { ok: false, erreur: err }; if (P.phase === "attente" && !P.besoinRemelange && P.cartes.length) ouvrirMises(now); return { ok: changer() }; }
    if (a === "lever") { const err = lever(id); if (err) return { ok: false, erreur: err }; return { ok: changer() }; }
    if (a === "clore") { if (id !== idHote()) return { ok: false, erreur: "Seul l'hôte clôt les mises." }; if (!clore(now)) return { ok: false, erreur: "Les mises ne sont pas ouvertes." }; return { ok: changer() }; }
    if (a === "bots") { if (id !== idHote()) return { ok: false, erreur: "Seul l'hôte décide des bots." }; P.bots = !!m.v; if (P.bots) { if (P.phase === "attente" || P.phase === "mise") completerBots(); } else if (P.phase === "attente" || P.phase === "mise") retirerBots(); return { ok: changer() }; }
    const k = siegeDe(id); if (k < 0) return { ok: false, erreur: "Prends d'abord un siège." };
    const st = P.sieges[k];
    if (a === "mise") { if (P.phase !== "mise") return { ok: false, erreur: "Les mises sont fermées." }; const v = arr(+m.v); const err = miseValide(st, v); if (err) return { ok: false, erreur: err };
      st.tapis = arr(st.tapis + st.mise - v); st.mise = v; return { ok: changer() }; }
    if (a === "rachat") { if (P.phase !== "mise" && P.phase !== "attente") return { ok: false, erreur: "Pas maintenant." }; if (st.mise || st.tapis >= P.miseMin) return { ok: false, erreur: "Tu as encore de quoi jouer." };
      st.tapis = P.tapisDepart; st.rachats++; P.evenement = { t: "rachat", siege: k }; return { ok: changer() }; }
    if (a === "assurance") { if (P.phase !== "assurance" || st.passe) return { ok: false, erreur: "Pas d'assurance à prendre." }; if (st.assurance !== undefined) return { ok: false, erreur: "Tu as déjà répondu." };
      if (m.v && st.tapis < st.mains[0].bet / 2) return { ok: false, erreur: "Tu n'as pas de quoi t'assurer." }; st.assurance = !!m.v; changer(); etapeAssurance(now); return { ok: true }; }
    if (P.phase !== "jeu") return { ok: false, erreur: "Ce n'est pas le moment de jouer." };
    if (!P.actif || P.actif.siege !== k) return { ok: false, erreur: "Ce n'est pas ton tour." };
    const err = jouer(a, now); if (err) return { ok: false, erreur: err };
    return { ok: changer() };
  }

  /* ── Une étape automatique : appelée par l'hôte à intervalle court ── */
  function etape(now) {
    now = now || 0;
    let ch = false;
    if (P.phase === "attente") { if (libererAbsents(now)) ch = true; if (P.cartes.length && !P.besoinRemelange && (P.bots || P.sieges.some(st => st && !st.absent))) { ouvrirMises(now); ch = true; } }
    else if (P.phase === "mise") { if (libererAbsents(now)) ch = true; if (now >= P.miseFin) ch = clore(now) || ch; }
    else if (P.phase === "donne") { if (now >= P.prochaineEtape) ch = etapeDonne(now); }
    else if (P.phase === "assurance") ch = etapeAssurance(now);
    else if (P.phase === "jeu") ch = etapeJeu(now);
    else if (P.phase === "croupier") ch = etapeCroupier(now);
    else if (P.phase === "reglement") ch = etapeReglement(now);
    return ch ? changer() : false;
  }

  /* ── L'état PUBLIC : ce qu'un invité reçoit, et rien de plus ── */
  function etatPublic(now) {
    now = now || 0;
    const croupier = P.croupier.map(c => c.cachee ? { cachee: true } : { r: c.r, i: c.i, suit: c.suit, col: c.col });
    return {
      v: P.v, hote: P.hote, table: P.table, sys: P.sys, jeux: P.jeux, phase: P.phase, manche: P.manche, bots: P.bots, message: P.message,
      evenement: P.evenement, regenere: P.regenere,
      miseMin: P.miseMin, miseMax: P.miseMax, par5: P.par5, tapisDepart: P.tapisDepart,
      miseRestant: P.phase === "mise" ? Math.max(0, Math.ceil((P.miseFin - now) / 1000)) : 0,
      tourRestant: P.phase === "jeu" && P.actif ? Math.max(0, Math.ceil((P.tourFin - now) / 1000)) : 0,
      assuranceRestant: P.phase === "assurance" ? Math.max(0, Math.ceil((P.assuranceFin - now) / 1000)) : 0,
      sieges: P.sieges.map(st => st && {
        id: st.id, nom: st.nom, couleur: st.couleur, bot: st.bot, tapis: st.tapis, mise: st.mise, rachats: st.rachats, passe: st.passe, absent: !!st.absent,
        assurance: st.assurance, dernierNet: st.dernierNet,
        mains: st.mains.map(h => ({ cards: h.cards.map(c => ({ r: c.r, i: c.i, suit: c.suit, col: c.col })), bet: h.bet, doubled: h.doubled, surrendered: h.surrendered,
          fromSplit: h.fromSplit, fromSplitAces: h.fromSplitAces, result: h.result, net: h.net, assurance: h.assurance || 0 })) }),
      croupier, cachee: P.cachee, actif: P.actif,
      sabot: { empreinte: P.empreinte, restantes: P.cartes.length, coupe: P.coupe, defausse: P.defausse, jeux: P.jeux, sabots: P.sabots.slice() },
      rc: P.rc, vues: P.vues, journal: P.journal.slice(-30),
    };
  }
  // Reprendre un état diffusé : nouvel hôte. La manche en cours est annulée (on ne connaît pas
  // le sabot), les mises rendues, les tapis et le journal conservés, la version continue.
  function reprendre(e, nouvelHote) {
    P.v = (e.v || 0) + 1; P.hote = nouvelHote; P.table = e.table; P.sys = e.sys || P.sys; P.jeux = e.jeux || P.jeux; P.bots = !!e.bots;
    P.manche = e.manche || 0; P.journal = (e.journal || []).slice(); P.sabots = ((e.sabot && e.sabot.sabots) || []).slice();
    P.miseMin = e.miseMin || P.miseMin; P.miseMax = e.miseMax || P.miseMax; P.par5 = !!e.par5; P.tapisDepart = e.tapisDepart || P.tapisDepart;
    P.sieges = (e.sieges || []).map(st => {
      if (!st || st.bot) return null;
      // Ce qui était sur le feutre revient en main : la mise posée (phase de mise), ou
      // l'engagement des mains non réglées (mise, doublement, assurance). Une main réglée
      // (net connu) a déjà été payée dans le tapis.
      const rendu = st.mains.length
        ? st.mains.reduce((s, h) => s + (h.net === undefined && h.net !== null ? h.bet * (h.doubled ? 2 : 1) + (h.assurance || 0) : 0), 0)
        : (st.mise || 0);
      return { id: st.id, nom: st.nom, couleur: st.couleur, bot: false, tapis: arr(st.tapis + rendu), mise: 0, rachats: st.rachats || 0, mains: [], passe: false, absent: st.absent ? 1 : 0 };
    });
    while (P.sieges.length < NB_SIEGES) P.sieges.push(null);
    P.croupier = []; P.cachee = false; P.actif = null; P.cartes = []; P.empreinte = ""; P.graine = null; P.prochain = null;
    P.phase = "sabot"; P.besoinRemelange = true; P.regenere = true;
    P.message = "L'hôte a quitté la table : manche annulée, mises rendues, sabot neuf.";
    P.evenement = { t: "reprise" };
    return P;
  }

  return {
    get etat() { return P; }, etatPublic, action, etape, remelanger, quitter, revenir, reprendre,
    fournirProchain(s) { P.prochain = s; },
    get besoinSabot() { return P.phase === "sabot" || !P.cartes.length || (P.besoinRemelange && (P.phase === "reglement" || P.phase === "attente")); },
    // Le sabot suivant, préparé d'avance, sert dès qu'il en faut un : pas d'attente à la table.
    remelangerAvecProchain() { if (!P.prochain) return false; const s = P.prochain; P.prochain = null; return remelanger(s, false); },
    get prochainManque() { return !P.prochain && P.cartes.length > 0 && P.cartes.length <= P.coupe + 8; },
    set cadence(ms) { P.cadence = ms; }, get cadence() { return P.cadence; },
    set hote(id) { P.hote = id; }, get hote() { return P.hote; },
  };
}

/* ── Le code de salon : huit caractères, groupés par quatre, lisibles au téléphone ── */
const ALPHA = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function codeSalon(random) {
  const a = new Uint8Array(8); (random || (b => crypto.getRandomValues(b)))(a);
  return [...a].map(x => ALPHA[x % ALPHA.length]).join("");
}
export const normaliserCode = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
export const formaterCode = c => { const n = normaliserCode(c); return n.length > 4 ? n.slice(0, 4) + "-" + n.slice(4) : n; };
export const codeValide = c => normaliserCode(c).length === 8;

/* ── La salle : le protocole autour d'un transport ─────────────────────────
   transport.publier(objet) envoie à tous les autres ; la salle reçoit par recevoir(m).
   Les messages :
     salut   { id, nom, couleur }          je suis là (réponse : un salut, et l'état si je suis l'hôte)
     demande { id }                        renvoyez-moi l'état
     etat    { id, etat }                  l'état complet, versionné, publié par l'hôte
     action  { id, a, v, … }               un joueur vers l'hôte
     refus   { id, pour, raison }          l'hôte refuse une action (à celui qui l'a demandée)
     adieu   { id }                        départ (explicite, ou testament posé chez le courtier)
   ────────────────────────────────────────────────────────────────────────── */
export function creerSalle(o) {
  const S = {
    moi: o.moi, nom: o.nom || "Joueur", couleur: o.couleur || "", createur: !!o.createur,
    pairs: new Map(), hote: o.createur ? o.moi : null, partie: null, etat: null, attenteDepuis: 0, entre: false,
    sabotEnCours: false, prochainEnCours: false, cadence: o.cadence || 900,
  };
  S.pairs.set(S.moi, { id: S.moi, nom: S.nom, couleur: S.couleur });
  const pub = m => { try { o.transport.publier(m); } catch (e) { o.onErreur && o.onErreur(e); } };
  const info = t => o.onInfo && o.onInfo(t);
  const estHote = () => S.hote === S.moi && !!S.partie;
  // Les options de la partie peuvent être une FONCTION : un invité élu hôte plus tard lit
  // alors les règles de la table adoptée, pas celles qu'il avait au moment d'entrer.
  const optionsPartie = () => Object.assign({}, (typeof o.partie === "function" ? o.partie() : o.partie) || {}, { hote: S.moi, cadence: S.cadence });

  function diffuser(now) {
    if (!S.partie) return;
    const e = S.partie.etatPublic(now);
    S.etat = e; pub({ t: "etat", id: S.moi, etat: e });
    o.onEtat && o.onEtat(e, true);
  }
  // Un sabot neuf est demandé à l'appelant (scellé : empreinte publiée avant, graine révélée après).
  function assurerSabot(now) {
    if (!S.partie || S.sabotEnCours) return;
    if (S.partie.besoinSabot) {
      if (S.partie.remelangerAvecProchain()) { diffuser(now); return; }
      S.sabotEnCours = true;
      Promise.resolve(o.cartesNeuves()).then(s => { S.sabotEnCours = false; if (!S.partie) return; S.partie.remelanger(s, false); diffuser(o.horloge ? o.horloge() : now); }, () => { S.sabotEnCours = false; });
    } else if (S.partie.prochainManque && !S.prochainEnCours) {
      S.prochainEnCours = true;
      Promise.resolve(o.cartesNeuves()).then(s => { S.prochainEnCours = false; if (S.partie) S.partie.fournirProchain(s); }, () => { S.prochainEnCours = false; });
    }
  }
  function devenirHote(now, repris) {
    S.hote = S.moi;
    S.partie = creerPartie(optionsPartie());
    if (repris) S.partie.reprendre(repris, S.moi);
    // Les pairs présents sont bien là ; les sièges dont le joueur a disparu (l'ancien hôte) se libèrent.
    for (const id of S.pairs.keys()) S.partie.revenir(id);
    for (const st of S.partie.etat.sieges) if (st && !st.bot && !S.pairs.has(st.id)) S.partie.quitter(st.id, 1);
    info(repris ? "L'hôte a quitté la table : tu reprends la main. Manche annulée, mises rendues, sabot neuf scellé." : "Tu ouvres la table.");
    assurerSabot(now); diffuser(now);
  }
  function elire(now) {
    const ids = [...S.pairs.keys()].sort();
    const nouveau = ids[0];
    if (nouveau === S.moi) devenirHote(now, S.etat);
    else { S.hote = nouveau; info("L'hôte a quitté la table : " + ((S.pairs.get(nouveau) || {}).nom || nouveau) + " reprend la main."); }
  }

  S.entrer = now => {
    S.entre = true; S.attenteDepuis = now;
    pub({ t: "salut", id: S.moi, nom: S.nom, couleur: S.couleur });
    if (S.createur) devenirHote(now, null); else pub({ t: "demande", id: S.moi });
  };
  S.recevoir = (m, now) => {
    if (!m || !m.id || m.id === S.moi) return;
    if (m.t === "salut") {
      const nouveau = !S.pairs.has(m.id);
      S.pairs.set(m.id, { id: m.id, nom: m.nom || "Joueur", couleur: m.couleur || "" });
      if (nouveau) pub({ t: "salut", id: S.moi, nom: S.nom, couleur: S.couleur });
      if (estHote()) { S.partie.revenir(m.id); diffuser(now); }
      o.onPairs && o.onPairs(S.pairs);
      return;
    }
    if (m.t === "demande") { if (estHote()) diffuser(now); return; }
    if (m.t === "etat") {
      if (!m.etat) return;
      // Deux hôtes (une élection croisée) : le plus petit identifiant garde la main, l'autre se range.
      if (estHote()) { if (m.id >= S.moi) return; S.partie = null; S.hote = m.id; info("Deux hôtes : " + ((S.pairs.get(m.id) || {}).nom || "l'autre") + " garde la main."); }
      if (S.hote !== m.id) {
        // Un autre expéditeur que l'hôte connu : accepté s'il a été élu (l'ancien hôte n'est plus
        // là, ou le nouveau a un identifiant plus petit) — jamais un simple pair qui s'inventerait hôte.
        if (S.hote && S.pairs.has(S.hote) && m.id > S.hote) return;
        S.hote = m.id;
      } else if (S.etat && m.etat.v < S.etat.v) return;   // la même version peut revenir : c'est le compte à rebours qui bouge
      S.etat = m.etat; o.onEtat && o.onEtat(m.etat, false);
      return;
    }
    if (m.t === "action") { if (!estHote()) return; const r = S.partie.action(m, now); if (r.ok) diffuser(now); else if (r.erreur) pub({ t: "refus", id: S.moi, pour: m.id, raison: r.erreur }); return; }
    if (m.t === "refus") { if (m.pour === S.moi) info(m.raison); return; }
    if (m.t === "adieu") {
      S.pairs.delete(m.id); o.onPairs && o.onPairs(S.pairs);
      if (estHote()) { if (S.partie.quitter(m.id, now)) diffuser(now); }
      if (m.id === S.hote) elire(now);
      return;
    }
  };
  S.agir = (a, v, extra, now) => {
    const m = Object.assign({ t: "action", id: S.moi, a, v }, extra || {});
    if (estHote()) { const r = S.partie.action(m, now); if (r.ok) diffuser(now); else if (r.erreur) info(r.erreur); return r; }
    pub(m); return { ok: true, envoye: true };
  };
  S.tic = now => {
    if (S.entre && !S.hote && now - S.attenteDepuis >= ELECTION_DELAI) {
      if (S.pairs.size === 1) devenirHote(now, null); else elire(now);
    }
    if (!estHote()) return;
    S.partie.cadence = S.cadence;
    assurerSabot(now);
    if (S.partie.etape(now)) { diffuser(now); return; }
    // Les comptes à rebours : une diffusion par seconde, pour que chacun voie le temps passer.
    const e = S.partie.etat;
    const compte = e.phase === "mise" ? Math.ceil((e.miseFin - now) / 1000) : e.phase === "jeu" && e.actif ? Math.ceil((e.tourFin - now) / 1000) : e.phase === "assurance" ? Math.ceil((e.assuranceFin - now) / 1000) : -1;
    if (compte >= 0 && compte !== S.dernierCompte) { S.dernierCompte = compte; diffuser(now); }
  };
  S.quitter = () => { pub({ t: "adieu", id: S.moi }); S.partie = null; S.entre = false; };
  S.estHote = estHote;
  return S;
}
