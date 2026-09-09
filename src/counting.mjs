// Les systèmes de comptage. index 0 = as, 1 = deux … 9 = dix.
export const SYSTEMES = {
  hilo:   { nom: "Hi-Lo",    equilibre: true,  niveau: 1, v: [-1, 1, 1, 1, 1, 1, 0, 0, 0, -1],
            note: "Le standard. Un seul niveau, équilibré, et c'est celui pour lequel tous les écarts publiés existent." },
  ko:     { nom: "KO",       equilibre: false, niveau: 1, v: [-1, 1, 1, 1, 1, 1, 1, 0, 0, -1],
            note: "Déséquilibré : pas de division par les sabots restants, donc pas de compte vrai à tenir. On perd un peu de précision, on gagne beaucoup de charge mentale." },
  hiopt1: { nom: "Hi-Opt I", equilibre: true,  niveau: 1, v: [ 0, 0, 1, 1, 1, 1, 0, 0, 0, -1],
            note: "L'as est neutre : plus précis pour les décisions de jeu, mais il faut compter les as à part pour la mise." },
  omega2: { nom: "Omega II",  equilibre: true,  niveau: 2, v: [ 0, 1, 1, 2, 2, 2, 1, 0, -1, -2],
            note: "Deux niveaux. Nettement plus précis, nettement plus fatigant. À ne prendre que quand Hi-Lo est devenu automatique." },
};
export const compteInitial = (cle, jeux) => cle === "ko" ? 4 - 4 * jeux : 0;
export const compteVrai = (rc, jeuxRestants) => rc / Math.max(0.25, jeuxRestants);
// Mise recommandée : rampe linéaire adossée au compte vrai, plafonnée par l'écart de la table.
// ⚠️ Gardée exportée, mais elle NE BAT PAS sa table : mesurée par outils/mesurer-compteur.mjs
// au Boulevard, +0,001 ± 0,001 unité par main — c'est-à-dire zéro, à la précision près. Elle
// ne s'ouvre qu'à +3 et n'atteint jamais 12. Ce n'est plus elle que la table affiche comme
// conseil, et c'est elle qui montre qu'une rampe mal réglée annule tout le travail.
export const misesUnites = (tc, ecartMax) => {
  const u = Math.floor(tc) - 1;
  return Math.max(1, Math.min(u <= 0 ? 1 : u, ecartMax));
};
// La rampe de référence : deux unités par point de compte vrai au-dessus de +1, bornée à
// [1, plafond] (12 par défaut). Mesurée au Boulevard par outils/mesurer-compteur.mjs, sur
// 40 M de mains : +0,004 u/main à elle seule, +0,008 avec l'assurance et les écarts au
// compte. Les chiffres publiés viennent de src/pages/mesures-compteur.json, pas d'ici.
// Mémorisable en une phrase, et jouable — 3(TC−1) gagne plus mais se repère
// en trois mains. Un compte vrai absent (système déséquilibré) → le minimum.
export const miseRampe = (tc, plafond) =>
  tc === null || tc === undefined || isNaN(tc) ? 1 : Math.max(1, Math.min(plafond || 12, Math.floor(2 * (tc - 1))));
