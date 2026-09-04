// Calcul des ÉCARTS AU COMPTE (index plays) à partir du solveur.
// Rien n'est recopié : on déforme la composition du sabot pour qu'elle porte le compte
// vrai visé, on résout, et on cherche par dichotomie le compte exact où la meilleure
// action bascule. Ça marche donc pour N'IMPORTE QUEL système de comptage et n'importe
// quelles règles de table — y compris des combinaisons qu'aucun livre ne publie.
import { solve, shoeCounts } from "./solver.mjs";

// Un sabot dont le compte vrai vaut `tc` : on retire des cartes des rangs positifs
// et on en ajoute autant aux rangs négatifs, à effectif total constant.
export function countedShoe(decks, tc, tags) {
  const base = shoeCounts(decks);
  const bas = [], haut = [];
  for (let i = 0; i < 10; i++) { if (tags[i] > 0) bas.push(i); if (tags[i] < 0) haut.push(i); }
  if (!bas.length || !haut.length) return base;
  const pb = bas.reduce((a, i) => a + base[i], 0), ph = haut.reduce((a, i) => a + base[i], 0);
  const k = tc * decks / 2;              // moitié par retrait, moitié par ajout
  const out = base.slice();
  for (const i of bas) out[i] -= k * base[i] / pb;
  for (const i of haut) out[i] += k * base[i] / ph;
  return out.map(x => Math.max(1e-6, x));
}

// L'assurance est rentable dès que la proportion de dix dépasse un tiers.
export const insuranceEV = counts => 3 * (counts[9] / counts.reduce((a, b) => a + b, 0)) - 1;

// Le point de bascule est un nombre réel. L'index PRATIQUE est son plancher :
// un compte vrai affiché « +3 » couvre en réalité l'intervalle [3, 4[.
const plancher = x => Math.floor(x + 1e-9);

function bissection(f, lo, hi, prec = 0.02) {
  while (hi - lo > prec) { const m = (lo + hi) / 2; if (f(m)) hi = m; else lo = m; }
  return hi;
}

export function computeIndices(rules, tags, { min = -12, max = 12 } = {}) {
  // Les écarts de JEU se calculent sans abandon : sinon l'abandon masque la bascule
  // tirer/rester, qui est précisément celle que les tableaux publient.
  const jeu = Object.assign({}, rules, { surrender: "none" });
  const cache = new Map();
  const chartAt = tc => {
    const k = tc.toFixed(3);
    if (!cache.has(k)) cache.set(k, solve(jeu, countedShoe(rules.decks, tc, tags)).chart);
    return cache.get(k);
  };
  const cells = [];
  for (let t = 5; t <= 20; t++) cells.push(["hard", t]);
  for (let t = 13; t <= 20; t++) cells.push(["soft", t]);
  for (let i = 0; i < 10; i++) cells.push(["pair", i]);

  const deviations = [];
  for (const [fam, key] of cells) {
    for (let u = 0; u < 10; u++) {
      const act = tc => { const c = chartAt(tc)[fam]; return c && c[key] ? c[key][u] : null; };
      let prev = act(min);
      for (let tc = min + 1; tc <= max; tc++) {
        const a = act(tc);
        if (a && prev && a !== prev) {
          const x = bissection(m => act(m) === a, tc - 1, tc);
          deviations.push({ fam, key, up: u, exact: +x.toFixed(2), index: plancher(x), de: prev, vers: a });
        }
        prev = a || prev;
      }
    }
  }
  // L'abandon a sa propre famille d'écarts (les « Fab 4 ») : on compare la meilleure
  // action jouable à l'abandon sec, qui vaut toujours la moitié de la mise.
  const abandons = [];
  if (rules.surrender !== "none") {
    const avec = new Map();
    const chartU = tc => {
      const k = tc.toFixed(3);
      if (!avec.has(k)) avec.set(k, solve(rules, countedShoe(rules.decks, tc, tags)).chart);
      return avec.get(k);
    };
    for (const [fam, key] of cells) {
      for (let u = 0; u < 10; u++) {
        const estU = tc => { const c = chartU(tc)[fam]; return c && c[key] ? c[key][u] === "U" : false; };
        for (let tc = min + 1; tc <= max; tc++) {
          if (!estU(tc - 1) && estU(tc)) {
            const x = bissection(estU, tc - 1, tc);
            abandons.push({ fam, key, up: u, exact: +x.toFixed(2), index: plancher(x) });
            break;
          }
        }
      }
    }
  }
  // Assurance.
  let ins = null;
  for (let tc = min + 1; tc <= max; tc++) {
    if (insuranceEV(countedShoe(rules.decks, tc, tags)) > 0) {
      const x = bissection(m => insuranceEV(countedShoe(rules.decks, m, tags)) > 0, tc - 1, tc);
      ins = { exact: +x.toFixed(2), index: plancher(x) };
      break;
    }
  }
  return { deviations, abandons, insurance: ins };
}
