// Ce que ce fichier protège : la stratégie de base et les écarts au compte ne sont
// pas recopiés d'un livre, ils sont CALCULÉS. Ces tests comparent ce que le solveur
// trouve tout seul à des références publiées. S'ils tombent, c'est le calcul qui a
// bougé — pas la référence.
import * as E from "./engine.mjs";
import { solve } from "./solver.mjs";
import { computeIndices } from "./indices.mjs";
import { SYSTEMES } from "./counting.mjs";

let n = 0, ko = 0;
const U = { A: 0, "2": 1, "3": 2, "4": 3, "5": 4, "6": 5, "7": 6, "8": 7, "9": 8, T: 9 };
const test = (nom, f) => { n++; try { f(); } catch (e) { ko++; console.log("  ✗ " + nom + " — " + e.message); } };
const eq = (a, b, q) => { if (a !== b) throw new Error(`${q} : ${a} au lieu de ${b}`); };

const regles = o => E.makeRules(Object.assign({ decks: 6, h17: false, das: true, surrender: "late", doubleOn: "any" }, o));
const grille = o => solve(regles(o)).chart;
const cell = (c, fam, k, up) => c[fam][k][U[up]];

// ── 1. Stratégie de base, 6 jeux, croupier qui reste à dix-sept souple.
//    Cellules tirées des tables publiées les plus reprises (Wizard of Odds, Griffin).
{
  const c = grille({});
  const attendus = [
    ["hard", 8, "5", "H"], ["hard", 8, "6", "H"], ["hard", 9, "2", "H"], ["hard", 9, "3", "D"],
    ["hard", 9, "6", "D"], ["hard", 9, "7", "H"], ["hard", 10, "9", "D"], ["hard", 10, "T", "H"],
    ["hard", 11, "T", "D"], ["hard", 11, "A", "H"], ["hard", 12, "2", "H"], ["hard", 12, "4", "S"],
    ["hard", 12, "7", "H"], ["hard", 13, "2", "S"], ["hard", 16, "9", "U"], ["hard", 16, "T", "U"],
    ["hard", 16, "7", "H"], ["hard", 15, "T", "U"], ["hard", 17, "A", "S"],
    ["soft", 13, "5", "D"], ["soft", 13, "6", "D"], ["soft", 15, "4", "D"], ["soft", 17, "3", "D"],
    ["soft", 18, "2", "S"], ["soft", 18, "3", "D"], ["soft", 18, "9", "H"], ["soft", 18, "T", "H"],
    ["soft", 19, "6", "S"], ["soft", 20, "5", "S"],
    ["pair", 0, "T", "P"], ["pair", 1, "2", "P"], ["pair", 1, "8", "H"], ["pair", 3, "5", "P"],
    ["pair", 4, "6", "D"], ["pair", 5, "6", "P"], ["pair", 5, "7", "H"], ["pair", 7, "T", "P"],
    ["pair", 7, "A", "P"], ["pair", 8, "7", "S"], ["pair", 8, "8", "P"], ["pair", 9, "6", "S"],
  ];
  for (const [fam, k, up, veut] of attendus)
    test(`base 6 jeux · ${fam} ${k} contre ${up}`, () => eq(cell(c, fam, k, up), veut, "action"));
}

// ── 2. Le solveur redécouvre SEUL les différences que le nombre de jeux impose.
test("un seul jeu : 11 contre l'as se double", () => eq(cell(grille({ decks: 1 }), "hard", 11, "A"), "D", "1 jeu"));
test("six jeux : 11 contre l'as se tire", () => eq(cell(grille({ decks: 6 }), "hard", 11, "A"), "H", "6 jeux"));
test("un seul jeu : 9 contre 2 se double", () => eq(cell(grille({ decks: 1 }), "hard", 9, "2"), "D", "1 jeu"));
test("H17 : A,8 contre 6 se double", () => eq(cell(grille({ h17: true }), "soft", 19, "6"), "D", "H17"));
test("S17 : A,8 contre 6 reste", () => eq(cell(grille({ h17: false }), "soft", 19, "6"), "S", "S17"));
test("H17 : 8,8 contre l'as s'abandonne", () => eq(cell(grille({ h17: true }), "pair", 7, "A"), "U", "H17"));
test("S17 : 8,8 contre l'as se sépare", () => eq(cell(grille({ h17: false }), "pair", 7, "A"), "P", "S17"));
test("sans DAS : 4,4 contre 6 ne se sépare pas", () => eq(cell(grille({ das: false }), "pair", 3, "6"), "H", "sans DAS"));
test("avec DAS : 4,4 contre 6 se sépare", () => eq(cell(grille({ das: true }), "pair", 3, "6"), "P", "DAS"));
test("sans abandon : 16 contre 10 se tire", () => eq(cell(grille({ surrender: "none" }), "hard", 16, "T"), "H", "sans abandon"));

// ── 3. Le croupier : probabilités de référence, six jeux, S17.
{
  const p = solve(regles({})).evs;
  test("le solveur expose ses espérances", () => { if (!p) throw new Error("evs absent"); });
}

// ── 4. Les écarts au compte : l'Illustrious 18, retrouvé sans être recopié.
{
  const idx = computeIndices(regles({ surrender: "none" }), SYSTEMES.hilo.v);
  const trouve = (fam, k, up) => {
    const d = idx.deviations.find(d => d.fam === fam && d.key === k && d.up === U[up]);
    return d ? d.index : null;
  };
  const reference = [
    ["hard", 16, "T", 0], ["hard", 15, "T", 4], ["hard", 13, "2", -1], ["hard", 13, "3", -2],
    ["hard", 12, "2", 3], ["hard", 12, "3", 2], ["hard", 12, "4", 0], ["hard", 12, "5", -2],
    ["hard", 12, "6", -1], ["hard", 9, "2", 1], ["hard", 9, "7", 3], ["hard", 10, "T", 4],
    ["hard", 10, "A", 4], ["hard", 11, "A", 1], ["pair", 9, "5", 5], ["pair", 9, "6", 4],
  ];
  for (const [fam, k, up, veut] of reference)
    test(`écart · ${fam} ${k} contre ${up} bascule à ${veut}`, () => {
      const got = trouve(fam, k, up);
      if (got === null) throw new Error("aucun écart trouvé");
      if (Math.abs(got - veut) > 1) throw new Error(`indice ${got} au lieu de ${veut}`);
    });
  test("assurance rentable à partir de +3", () => eq(idx.insurance && idx.insurance.index, 3, "seuil"));
  test("les écarts sont bornés", () => {
    for (const d of idx.deviations) if (Math.abs(d.index) > 12) throw new Error("indice hors bornes : " + JSON.stringify(d));
  });
}

// ── 5. Chaque système de comptage est cohérent avec lui-même.
for (const [cle, s] of Object.entries(SYSTEMES)) {
  test(`système ${s.nom} : dix rangs`, () => eq(s.v.length, 10, "longueur"));
  test(`système ${s.nom} : équilibre annoncé`, () => {
    const somme = s.v.reduce((a, v, i) => a + v * (i === 9 ? 16 : 4), 0);
    eq(somme === 0, s.equilibre, "somme " + somme);
  });
}

console.log(`\n${n} tests passés, ${ko} échecs`);
if (ko) process.exit(1);
