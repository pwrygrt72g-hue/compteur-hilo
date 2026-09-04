# Compteur Hi-Lo

Entraînement au comptage de cartes au blackjack, dans le navigateur. Aucune mise, aucun argent : c'est un outil pour s'entraîner.

**→ [pwrygrt72g-hue.github.io/compteur-hilo](https://pwrygrt72g-hue.github.io/compteur-hilo/)**

Installable sur téléphone depuis le menu du navigateur, et utilisable hors ligne.

## Les exercices

| | |
|---|---|
| **Défilement** | Les cartes passent à la vitesse choisie. Tu cliques la valeur ou tu comptes en silence, avec des contrôles surprises en cours de route. |
| **Sabot chrono** | Un jeu complet le plus vite possible, et retomber sur le bon compte. |
| **Estimation** | Tu regardes le tas de défausse et tu annonces combien de jeux y sont passés. C'est ce coup d'œil qui transforme un compte courant en compte vrai. |
| **Table** | Croupier, jusqu'à cinq autres joueurs en stratégie de base, carte brûlée, carte cachée, assurance, doubler, séparer, abandon, carte de coupe. |
| **Stratégie** | La stratégie de base main par main, puis les écarts au compte : Illustrious 18 et Fab 4. Les mains ratées reviennent plus souvent. |
| **Concentration** | Le chef de table te surveille pendant que tu comptes. Questions des voisins, calculs, regards. Détecteur caméra optionnel pour les lèvres qui bougent et le regard figé. |
| **Progression** | Historique, courbe de l'écart au compte réel, taux de réussite par exercice. |

## Détails

- Systèmes de comptage : **Hi-Lo**, **KO**, **Hi-Opt I**, **Omega II**.
- Mélange par `crypto.getRandomValues`, sans biais modulo.
- Stratégie de base 6 jeux avec variantes S17 / H17, doubler après séparation, abandon tardif.
- Tout est stocké dans le navigateur. La caméra ne quitte jamais l'appareil, aucune image n'est envoyée nulle part.

## Développement

`index.html` est autonome, sans dépendance ni build. Ouvre-le, modifie-le, pousse-le.
