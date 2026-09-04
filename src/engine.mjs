// Moteur de blackjack pur : aucune dépendance au DOM, entièrement piloté par les règles de la table.
// Mêmes entrées, mêmes sorties : c'est ce qui permet de rejouer une main à l'identique et de la tester.

export const RANKS = ["A","2","3","4","5","6","7","8","9","10","V","D","R"];
export const SUITS = [["♠","n"],["♥","r"],["♦","r"],["♣","n"]];

export const cardValue = c => c.i === 0 ? 11 : (c.i >= 9 ? 10 : c.i + 1);
export const isAce = c => c.i === 0;

export function handTotal(cards) {
  let t = 0, aces = 0;
  for (const c of cards) { t += cardValue(c); if (isAce(c)) aces++; }
  while (t > 21 && aces) { t -= 10; aces--; }
  return t;
}
export function isSoft(cards) {
  let t = 0, aces = 0;
  for (const c of cards) { t += cardValue(c); if (isAce(c)) aces++; }
  return aces > 0 && t <= 21;
}
export const isBust = cards => handTotal(cards) > 21;
// Un blackjack, c'est deux cartes d'origine. Une main issue d'une séparation ne peut pas en être un.
export const isBlackjack = h => h.cards.length === 2 && !h.fromSplit && handTotal(h.cards) === 21;

export function newHand(cards, bet, extra) {
  return Object.assign({ cards: cards || [], bet: bet || 1, doubled: false, surrendered: false,
    fromSplit: false, fromSplitAces: false, done: false, result: null, payout: 0 }, extra || {});
}

export function canSplit(hand, seatHands, rules) {
  if (hand.cards.length !== 2 || hand.done) return false;
  if (seatHands.length >= rules.maxHands) return false;
  if (hand.fromSplitAces && !rules.hitSplitAces) return false;
  const [a, b] = hand.cards;
  return rules.splitByRank ? a.i === b.i : cardValue(a) === cardValue(b);
}
export function canDouble(hand, seatHands, rules) {
  if (hand.cards.length !== 2 || hand.done) return false;
  if (hand.fromSplitAces && !rules.hitSplitAces) return false;
  if (hand.fromSplit && !rules.das) return false;
  const t = handTotal(hand.cards);
  return rules.doubleOn === "any" || rules.doubleOn.includes(t);
}
export function canSurrender(hand, seatHands, rules) {
  return rules.surrender !== "none" && hand.cards.length === 2 && !hand.fromSplit && seatHands.length === 1;
}

// Le croupier joue sa main. Rien d'aléatoire ici : les cartes viennent du sabot fourni.
export function playDealer(cards, draw, rules) {
  const out = cards.slice();
  for (;;) {
    const t = handTotal(out);
    if (t > 21) break;
    if (t > 17) break;
    if (t === 17) { if (!(rules.h17 && isSoft(out))) break; }
    out.push(draw());
  }
  return out;
}

// Règlement d'une main. Renvoie le gain NET en unités de mise.
export function settleHand(hand, dealerCards, rules) {
  const bet = hand.bet * (hand.doubled ? 2 : 1);
  if (hand.surrendered) return { result: "abandon", net: -hand.bet / 2 };
  if (isBust(hand.cards)) return { result: "sauté", net: -bet };
  const pBJ = isBlackjack(hand);
  const dBJ = dealerCards.length === 2 && handTotal(dealerCards) === 21;
  if (pBJ && dBJ) return { result: "égalité", net: 0 };
  if (pBJ) return { result: "blackjack", net: hand.bet * rules.blackjackPays };
  if (dBJ) return { result: "perdu", net: -bet };
  const p = handTotal(hand.cards), d = handTotal(dealerCards);
  if (d > 21) return { result: "gagné", net: bet };
  if (p > d) return { result: "gagné", net: bet };
  if (p < d) return { result: "perdu", net: -bet };
  return { result: "égalité", net: 0 };
}

// Assurance : mise à moitié, payée 2 contre 1 si le croupier a blackjack.
export const settleInsurance = (bet, dealerHasBJ) => dealerHasBJ ? bet : -bet / 2;

// Sans carte cachée (jeu européen) : le croupier ne prend sa deuxième carte qu'à la fin.
// Le joueur perd alors aussi ce qu'il a doublé ou séparé, sauf si la table dit le contraire.
export function settleNoHoleCard(hand, dealerCards, rules) {
  const dBJ = dealerCards.length === 2 && handTotal(dealerCards) === 21;
  if (!dBJ) return settleHand(hand, dealerCards, rules);
  if (hand.surrendered) return { result: "abandon", net: -hand.bet / 2 };
  if (isBlackjack(hand)) return { result: "égalité", net: 0 };
  const perdu = rules.enhcLosesAll ? hand.bet * (hand.doubled ? 2 : 1) : hand.bet;
  return { result: "perdu", net: -perdu };
}

export const DEFAULT_RULES = {
  decks: 6, h17: false, blackjackPays: 1.5, das: true, surrender: "late",
  doubleOn: "any", maxHands: 4, hitSplitAces: false, splitByRank: false,
  holeCard: true, enhcLosesAll: false, penetration: 0.75, seats: 5, peek: true,
};
export const makeRules = o => Object.assign({}, DEFAULT_RULES, o || {});
