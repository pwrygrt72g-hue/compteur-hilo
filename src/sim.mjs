// Simulateur de blackjack à grande vitesse : mesure l'avantage réel d'une table
// en jouant la stratégie calculée par le solveur. Aucun chiffre recopié.
import { solve } from "./solver.mjs";
import { makeRules } from "./engine.mjs";

const VAL = i => i === 0 ? 11 : i + 1;
const bestT = (h, a) => h + (a && h + 10 <= 21 ? 10 : 0);

export function simulate(rulesIn, hands, seed) {
  const rules = makeRules(rulesIn);
  const { chart } = solve(rules);
  const D = rules.decks;
  const counts = new Int32Array(10), fresh = new Int32Array(10);
  for (let i = 0; i < 10; i++) fresh[i] = i === 9 ? 16 * D : 4 * D;
  const shoeSize = 52 * D, cut = Math.floor(shoeSize * rules.penetration);
  let left = 0, dealt = 0;
  // Générateur déterministe rapide (xorshift128+), suffisant pour une mesure statistique.
  let s0 = seed >>> 0 || 88675123, s1 = 362436069, s2 = 521288629, s3 = 2463534242;
  const rnd = () => { let t = s3; const s = s0; s3 = s2; s2 = s1; s1 = s;
    t ^= t << 11; t ^= t >>> 8; s0 = t ^ s ^ (s >>> 19); return (s0 >>> 0) / 4294967296; };
  const shuffle = () => { counts.set(fresh); left = shoeSize; dealt = 0; };
  function pick() {
    if (left <= 0) shuffle();
    let r = rnd() * left, i = 0;
    while (r >= counts[i]) { r -= counts[i]; i++; if (i > 9) { i = 9; break; } }
    counts[i]--; left--; dealt++;
    return i;
  }
  // Colonne du tableau : ordre naturel des index de rang.
  const colOf = u => u;
  const act = (h, a, pairIdx, u, canD, canP, canU) => {
    const t = bestT(h, a), soft = a && h + 10 <= 21;
    let x = (pairIdx != null && canP) ? chart.pair[pairIdx][u]
          : (soft && chart.soft[t]) ? chart.soft[t][u]
          : chart.hard[Math.max(5, Math.min(t, 20))][u];
    if (x === "P" && !canP) x = soft ? (t >= 19 ? "S" : "H") : chart.hard[Math.max(5, Math.min(t, 20))][u];
    if (x === "U" && !canU) { const b = chart.hard[Math.max(5, Math.min(t, 20))][u]; x = b === "U" ? (t >= 17 ? "S" : "H") : b; }
    if (x === "D" && !canD) x = soft ? (t >= 18 ? "S" : "H") : (t >= 17 ? "S" : "H");
    return x;
  };

  let net = 0, played = 0;
  shuffle();
  for (let n = 0; n < hands; n++) {
    if (dealt >= cut) shuffle();
    const p = [pick(), pick()], up = pick(), hole = pick();
    played++;
    const vraiBJ = (VAL(up) === 11 && VAL(hole) === 10) || (VAL(up) === 10 && VAL(hole) === 11);
    const dealerBJ = rules.peek && vraiBJ;   // seule une table qui REGARDE arrête la main tout de suite
    const playerBJ = (VAL(p[0]) + VAL(p[1]) === 21);
    if (playerBJ || dealerBJ) {
      // Sans carte cachée, un blackjack du joueur face à celui du croupier reste une égalité.
      net += (playerBJ && (dealerBJ || (!rules.peek && vraiBJ))) ? 0 : playerBJ ? rules.blackjackPays : -1;
      continue;
    }
    // Mains du joueur : [h, a, bet, doubled, surrendered, fromSplit, fromSplitAces]
    const hands_ = [[VAL(p[0]) === 11 ? 1 : VAL(p[0]), p[0] === 0, 0, 0, 0, 0, 0]];
    hands_[0][0] += (p[1] === 0 ? 1 : VAL(p[1])); hands_[0][1] = hands_[0][1] || p[1] === 0;
    const pairIdx0 = (rules.splitByRank ? p[0] === p[1] : VAL(p[0]) === VAL(p[1])) ? p[0] : null;
    hands_[0].pairIdx = pairIdx0;
    hands_[0].bet = 1;
    for (let hi = 0; hi < hands_.length; hi++) {
      const H = hands_[hi];
      for (;;) {
        const t = bestT(H[0], H[1]);
        if (t > 21) break;
        const two = (H.cards2 !== false);
        const canP = H.pairIdx != null && hands_.length < rules.maxHands && !(H[6] && !rules.hitSplitAces);
        const canD = two && (rules.doubleOn === "any" || rules.doubleOn.includes(t)) && !(H[5] && !rules.das) && !(H[6] && !rules.hitSplitAces);
        const canU = rules.surrender !== "none" && two && !H[5] && hands_.length === 1;
        if (H[6] && !rules.hitSplitAces) break; // as séparés : une seule carte
        const x = act(H[0], H[1], canP ? H.pairIdx : null, colOf(up), canD, canP, canU);
        if (x === "S") break;
        if (x === "U") { H[4] = 1; break; }
        if (x === "P") {
          const pi = H.pairIdx;
          const nh = [pi === 0 ? 1 : VAL(pi), pi === 0, 0, 0, 0, 1, pi === 0];
          H[0] = pi === 0 ? 1 : VAL(pi); H[1] = pi === 0; H[5] = 1; H[6] = pi === 0; H.pairIdx = null; H.cards2 = undefined;
          const c1 = pick(); H[0] += c1 === 0 ? 1 : VAL(c1); H[1] = H[1] || c1 === 0;
          H.pairIdx = (rules.splitByRank ? c1 === pi : VAL(c1) === VAL(pi)) ? pi : null;
          const c2 = pick(); nh[0] += c2 === 0 ? 1 : VAL(c2); nh[1] = nh[1] || c2 === 0;
          nh.pairIdx = (rules.splitByRank ? c2 === pi : VAL(c2) === VAL(pi)) ? pi : null;
          nh.bet = 1;
          hands_.splice(hi + 1, 0, nh);
          continue;
        }
        if (x === "D") { const c = pick(); H[0] += c === 0 ? 1 : VAL(c); H[1] = H[1] || c === 0; H[3] = 1; H.cards2 = false; break; }
        const c = pick(); H[0] += c === 0 ? 1 : VAL(c); H[1] = H[1] || c === 0; H.cards2 = false; H.pairIdx = null;
      }
    }
    // Le croupier joue, sauf si tout le monde a sauté ou abandonné.
    const vivants = hands_.some(H => !H[4] && bestT(H[0], H[1]) <= 21);
    let dh = (VAL(up) === 11 ? 1 : VAL(up)) + (VAL(hole) === 11 ? 1 : VAL(hole));
    let da = up === 0 || hole === 0;
    if (vivants) {
      for (;;) {
        const t = bestT(dh, da), soft = da && dh + 10 <= 21;
        if (t > 21) break;
        if (t > 17 || (t === 17 && !(rules.h17 && soft))) break;
        const c = pick(); dh += c === 0 ? 1 : VAL(c); da = da || c === 0;
      }
    }
    const dt = bestT(dh, da);
    // Jeu européen : le croupier n'a pas regardé. S'il retourne un blackjack à la fin,
    // le joueur perd aussi ce qu'il a doublé et séparé — c'est le vrai coût de la règle.
    if (!rules.peek && vraiBJ) {
      for (const H of hands_) {
        if (H[4]) { net -= 0.5; continue; }
        net -= rules.enhcLosesAll ? (H[3] ? 2 : 1) : 1;
      }
      continue;
    }
    for (const H of hands_) {
      const bet = 1 * (H[3] ? 2 : 1);
      if (H[4]) { net -= 0.5; continue; }
      const t = bestT(H[0], H[1]);
      if (t > 21) { net -= bet; continue; }
      if (dt > 21 || t > dt) net += bet;
      else if (t < dt) net -= bet;
    }
  }
  return { edge: -net / played * 100, hands: played };
}
