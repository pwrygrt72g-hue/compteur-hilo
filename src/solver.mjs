// Solveur exact de stratégie de base, sensible à la composition du sabot.
// La stratégie n'est PAS recopiée d'un tableau : elle est CALCULÉE depuis les règles de la table.
// Conséquence : chaque table du lobby a sa propre stratégie, forcément cohérente avec ses règles,
// et la table à un seul jeu ne donne pas les mêmes réponses que celle à huit jeux — ce qui est vrai.
//
// Modèle : retrait des cartes connues (les deux du joueur et celle du croupier), puis probabilités
// figées pour les tirages suivants. C'est l'approximation standard « one-card removal » : elle
// capte l'essentiel de l'effet du nombre de jeux pour un coût de calcul négligeable.

const VAL = i => i === 0 ? 11 : i + 1;              // index 0 = as, 1 = deux … 9 = dix
const best = (h, a) => h + (a && h + 10 <= 21 ? 10 : 0);
const isSoftHand = (h, a) => a && h + 10 <= 21;
const draw = (h, a, i) => [h + (i === 0 ? 1 : VAL(i)), a || i === 0];
// (h, a) : h compte TOUS les as pour 1, a dit qu'il y a au moins un as.
// C'est la seule représentation qui survit à un deuxième as : A,A,A vaut 13 et reste souple.

export function shoeCounts(decks) {
  const c = new Array(10).fill(4 * decks);
  c[9] = 16 * decks; // dix, valet, dame, roi
  return c;
}

// Un évaluateur pour une composition de sabot donnée. Tous les mémos lui appartiennent.
function evaluator(counts, rules) {
  const tot = counts.reduce((a, b) => a + b, 0);
  const P = counts.map(x => x / tot);
  const dealerMemo = new Map(), hitMemo = new Map();

  function dealerRec(h, a) {
    const k = h * 2 + (a ? 1 : 0);
    if (dealerMemo.has(k)) return dealerMemo.get(k);
    const t = best(h, a), soft = isSoftHand(h, a);
    let out;
    if (t > 21) out = { bust: 1 };
    else if (t > 17 || (t === 17 && !(rules.h17 && soft))) out = { [t]: 1 };
    else {
      out = {};
      for (let i = 0; i < 10; i++) {
        if (!P[i]) continue;
        const [h2, a2] = draw(h, a, i), sub = dealerRec(h2, a2);
        for (const key in sub) out[key] = (out[key] || 0) + P[i] * sub[key];
      }
    }
    dealerMemo.set(k, out);
    return out;
  }

  function dealerDist(upIdx) {
    const [h0, a0] = draw(0, false, upIdx);
    const res = {};
    let norm = 0;
    for (let i = 0; i < 10; i++) {
      if (!P[i]) continue;
      // Le croupier a regardé sa carte : on écarte les cas où il a déjà un blackjack.
      if (rules.peek && ((upIdx === 0 && i === 9) || (upIdx === 9 && i === 0))) continue;
      const [h1, a1] = draw(h0, a0, i), sub = dealerRec(h1, a1);
      for (const key in sub) res[key] = (res[key] || 0) + P[i] * sub[key];
      norm += P[i];
    }
    for (const key in res) res[key] /= norm;
    return res;
  }

  const distCache = new Map();
  const dist = u => { if (!distCache.has(u)) distCache.set(u, dealerDist(u)); return distCache.get(u); };

  function standEV(total, u) {
    const d = dist(u);
    let ev = 0;
    for (const key in d) {
      const p = d[key];
      if (key === "bust") ev += p;
      else { const dt = +key; ev += p * (total > dt ? 1 : total < dt ? -1 : 0); }
    }
    return ev;
  }
  function hitEV(h, a, u) {
    const k = (h * 2 + (a ? 1 : 0)) * 10 + u;
    if (hitMemo.has(k)) return hitMemo.get(k);
    let ev = 0;
    for (let i = 0; i < 10; i++) {
      if (!P[i]) continue;
      const [h2, a2] = draw(h, a, i), t = best(h2, a2);
      ev += P[i] * (t > 21 ? -1 : Math.max(standEV(t, u), hitEV(h2, a2, u)));
    }
    hitMemo.set(k, ev);
    return ev;
  }
  function doubleEV(h, a, u) {
    let ev = 0;
    for (let i = 0; i < 10; i++) {
      if (!P[i]) continue;
      const [h2, a2] = draw(h, a, i), t = best(h2, a2);
      ev += P[i] * 2 * (t > 21 ? -1 : standEV(t, u));
    }
    return ev;
  }
  function playedEV(h, a, u, allowDouble) {
    const t = best(h, a);
    if (t > 21) return -1;
    let b = Math.max(standEV(t, u), hitEV(h, a, u));
    if (allowDouble) b = Math.max(b, doubleEV(h, a, u));
    return b;
  }
  function acesOne(u) {
    let ev = 0;
    for (let i = 0; i < 10; i++) { if (!P[i]) continue; const [h2, a2] = draw(1, true, i); ev += P[i] * standEV(best(h2, a2), u); }
    return ev;
  }
  // Espérance d'UNE main issue d'une séparation, re-séparations comprises.
  function oneSplitHand(pairIdx, u, splitsLeft) {
    const [hb, ab] = draw(0, false, pairIdx);
    const acesOnly = pairIdx === 0 && !rules.hitSplitAces;
    let ev = 0;
    for (let i = 0; i < 10; i++) {
      if (!P[i]) continue;
      const [h2, a2] = draw(hb, ab, i);
      const joue = acesOnly ? standEV(best(h2, a2), u) : playedEV(h2, a2, u, rules.das);
      if (i === pairIdx && splitsLeft > 0) {
        const resep = 2 * (acesOnly ? acesOne(u) : oneSplitHand(pairIdx, u, splitsLeft - 1));
        ev += P[i] * Math.max(joue, resep);
      } else ev += P[i] * joue;
    }
    return ev;
  }
  const splitEV = (pairIdx, u) => 2 * oneSplitHand(pairIdx, u, Math.max(0, rules.maxHands - 2));

  return { standEV, hitEV, doubleEV, splitEV, dist, P };
}

// Cache d'évaluateurs : deux compositions identiques partagent leurs mémos.
function evalFactory(rules) {
  const cache = new Map();
  return counts => {
    const k = counts.join(",");
    if (!cache.has(k)) cache.set(k, evaluator(counts, rules));
    return cache.get(k);
  };
}
const without = (counts, ...idx) => {
  const c = counts.slice();
  for (const i of idx) c[i] = Math.max(0, c[i] - 1);
  return c;
};

export function solve(rules, customCounts) {
  const base = customCounts || shoeCounts(rules.decks);
  const get = evalFactory(rules);
  const canDbl = t => rules.doubleOn === "any" || rules.doubleOn.includes(t);
  const surrEV = rules.surrender === "none" ? -Infinity : -0.5;
  const chart = { hard: {}, soft: {}, pair: {} }, evs = { hard: {}, soft: {}, pair: {} };
  const pickBest = o => o.reduce((a, b) => b[1] > a[1] ? b : a);

  // Totaux durs : on moyenne sur toutes les compositions à deux cartes possibles,
  // pondérées par leur fréquence réelle dans le sabot. C'est ainsi que se construit
  // un tableau « par total » honnête, et non par une composition choisie au hasard.
  for (let total = 5; total <= 20; total++) {
    const comps = [];
    for (let i = 1; i <= 9; i++) for (let j = i; j <= 9; j++) {
      if (VAL(i) + VAL(j) !== total) continue;
      if (VAL(i) === VAL(j)) continue;           // les paires ont leur propre tableau
      comps.push([i, j, base[i] * base[j] * 2]);
    }
    // Une main souple ne peut pas être un « total dur » : les as sont exclus ci-dessus.
    if (!comps.length) { // 21 impossible ici, mais 5 = 2+3 etc. couvre tout ; sécurité
      comps.push([1, 1, 1]);
    }
    chart.hard[total] = []; evs.hard[total] = [];
    for (let u = 0; u < 10; u++) {
      const acc = {};
      let W = 0;
      for (const [i, j, w] of comps) {
        const ev = get(without(base, i, j, u));
        const o = [["S", ev.standEV(total, u)], ["H", ev.hitEV(total, false, u)]];
        if (canDbl(total)) o.push(["D", ev.doubleEV(total, false, u)]);
        if (surrEV > -Infinity) o.push(["U", surrEV]);
        for (const [a, v] of o) acc[a] = (acc[a] || 0) + w * v;
        W += w;
      }
      const o = Object.entries(acc).map(([a, v]) => [a, v / W]);
      const ch = pickBest(o);
      chart.hard[total].push(ch[0]); evs.hard[total].push(+ch[1].toFixed(5));
    }
  }
  // Totaux souples A,2 … A,9 : la composition est unique.
  for (let other = 2; other <= 9; other++) {
    const total = 11 + other, oi = other - 1;
    chart.soft[total] = []; evs.soft[total] = [];
    for (let u = 0; u < 10; u++) {
      const ev = get(without(base, 0, oi, u));
      const o = [["S", ev.standEV(total, u)], ["H", ev.hitEV(other + 1, true, u)]];
      if (canDbl(total)) o.push(["D", ev.doubleEV(other + 1, true, u)]);
      const ch = pickBest(o);
      chart.soft[total].push(ch[0]); evs.soft[total].push(+ch[1].toFixed(5));
    }
  }
  // Paires.
  for (let i = 0; i < 10; i++) {
    const h = i === 0 ? 2 : VAL(i) * 2, a = i === 0;
    chart.pair[i] = []; evs.pair[i] = [];
    for (let u = 0; u < 10; u++) {
      const ev = get(without(base, i, i, u));
      const o = [["S", ev.standEV(best(h, a), u)], ["H", ev.hitEV(h, a, u)], ["P", ev.splitEV(i, u)]];
      if (canDbl(best(h, a))) o.push(["D", ev.doubleEV(h, a, u)]);
      if (surrEV > -Infinity) o.push(["U", surrEV]);
      const ch = pickBest(o);
      chart.pair[i].push(ch[0]); evs.pair[i].push(+ch[1].toFixed(5));
    }
  }
  return { chart, evs };
}

// Repli quand l'action idéale n'est pas jouable ici et maintenant.
export function actionFor(chart, ctx) {
  const { total, soft, pairIdx, upIdx, canD, canP, canU } = ctx;
  const hard = t => chart.hard[Math.max(5, Math.min(t, 20))][upIdx];
  let a = (pairIdx != null && canP) ? chart.pair[pairIdx][upIdx]
        : (soft && chart.soft[total]) ? chart.soft[total][upIdx]
        : hard(total);
  if (a === "P" && !canP) a = soft ? (total >= 19 ? "S" : "H") : hard(total);
  if (a === "U" && !canU) a = soft ? (total >= 18 ? "S" : "H") : (hard(total) === "U" ? (total >= 17 ? "S" : "H") : hard(total));
  if (a === "D" && !canD) a = soft ? (total >= 18 ? "S" : "H") : (total >= 17 ? "S" : "H");
  return a;
}
