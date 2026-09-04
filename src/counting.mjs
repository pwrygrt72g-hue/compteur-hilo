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
export const misesUnites = (tc, ecartMax) => {
  const u = Math.floor(tc) - 1;
  return Math.max(1, Math.min(u <= 0 ? 1 : u, ecartMax));
};
