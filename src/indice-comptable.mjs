// ─────────────────────────────────────────────────────────────────────────────
// L'indice de comptabilité : ce que la table laisse VRAIMENT à un compteur.
// La pénétration domine, le paiement du blackjack peut tout annuler.
//
// 🚨 SOURCE UNIQUE. Cette formule vivait dans src/app/salon.js, donc uniquement
// dans le navigateur : le hall rendu côté serveur devait la réimplémenter, et
// src/precalcul.json ne la porte pas (il n'a que chart, ecarts, abandons,
// assurance, avantage). Deux copies auraient divergé au premier ajustement du
// coefficient, l'écran affichant une valeur et le HTML servi l'autre — sans que
// rien ne le dise. build.mjs l'importe pour remplir les données ; l'application
// se contente désormais de LIRE le résultat.
//
// ⚠️ Ce fichier n'entre NI dans la liste d'empreinte de build.mjs, NI dans les
// SOURCES de outils/mesurer-compteur.mjs, NI dans ORDRE : il ne touche aucune
// mesure. L'y ajouter invaliderait precalcul.json et rejouerait trois millions
// de mains par table pour rien.
// ─────────────────────────────────────────────────────────────────────────────

// Au-dessus, compter rapporte. C'est le seuil du filtre « Où compter rapporte »
// et celui de la teinte du hall : les deux DOIVENT rester égaux.
export const SEUIL_BATTABLE = 25;

export function indiceComptable(t) {
  if (t.melange === "melangeuse_continue") return 0;
  if (t.blackjackPays < 1.5) return Math.max(0, Math.round(12 - t.jeux));
  const pen = t.penetration, jeux = t.jeux;
  const brut = 100 * (pen - .45) * (1.55 - .06 * jeux);
  return Math.max(4, Math.min(99, Math.round(brut)));
}
