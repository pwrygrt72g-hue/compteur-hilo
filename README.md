# Le Sabot

Entraînement au comptage de cartes au blackjack, dans le navigateur. Aucune mise, aucun argent : c'est un outil pour s'entraîner.

**→ [pwrygrt72g-hue.github.io/compteur-hilo](https://pwrygrt72g-hue.github.io/compteur-hilo/)**

Installable sur téléphone depuis le menu du navigateur, et utilisable hors ligne.

## Ce qui est calculé, pas recopié

La plupart des applications de ce genre embarquent une image de la stratégie de base et une liste d'écarts trouvée dans un livre. Ici, les deux sont **calculés au moment de la construction**, table par table, à partir des règles de chacune :

- **La stratégie de base** sort d'un solveur exact qui tient compte du nombre de jeux, du comportement du croupier sur dix-sept souple, du doublement après séparation, de l'abandon et de la carte cachée. Il retrouve seul les différences que les tables publiées attribuent au nombre de jeux : onze contre l'as se double à un seul jeu et se tire à six, huit-huit contre l'as se sépare en S17 et s'abandonne en H17.
- **Les écarts au compte** sont obtenus en déformant la composition du sabot jusqu'à ce qu'il porte un compte vrai donné, puis en cherchant le point de bascule par dichotomie. Les dix-sept premiers écarts de l'Illustrious 18 en ressortent, et l'assurance devient rentable à +3 exactement.
- **L'avantage maison** de chaque table est **mesuré**, pas annoncé : trois millions de mains jouées en stratégie parfaite avant chaque publication.

`node src/regles.test.mjs` compare tout ça à des références publiées — 78 vérifications.

## Les neuf tables

Chaque table est un règlement réel et une leçon. Deux d'entre elles sont imbattables et le disent en toutes lettres : le blackjack payé six pour cinq et la mélangeuse continue tuent le comptage, quoi que fassent les autres règles.

| Table | Ce qu'elle apprend | Avantage maison |
|---|---|---|
| Le Boulevard | Voilà à quoi ressemble un travail | 0,58 % |
| Le Néon | Peu de jeux ne veut pas dire bon jeu | 1,85 % |
| Le Front de Mer | Les meilleures règles ne compensent pas la lenteur | 0,38 % |
| Le Cotai | La mélangeuse tue le comptage, pas les règles | 0,46 % |
| Le Cercle | Sans carte cachée, tu perds aussi tes doublements | 0,60 % |
| La Main Chaude | La géométrie bat les règles | 0,38 % |
| Le Salon Privé | La carte de coupe est le seul chiffre qui compte | 0,38 % |
| Le Vieux Reno | Une table bridée peut être excellente | 0,63 % |
| L'Aquarium | Il y a des tables qu'on ne bat pas | 2,07 % |

## Les exercices

| | |
|---|---|
| **Défilement** | Les cartes passent à la vitesse choisie. Tu cliques la valeur ou tu comptes en silence, avec des contrôles surprises en cours de route. |
| **Sabot chrono** | Un jeu complet le plus vite possible, et retomber sur le bon compte. |
| **Estimation** | Tu regardes le tas de défausse et tu annonces combien de jeux y sont passés. C'est ce coup d'œil qui transforme un compte courant en compte vrai. |
| **Table** | Croupier, jusqu'à six autres joueurs en stratégie de base, carte brûlée, carte cachée, assurance, doubler, séparer, abandon, carte de coupe. Le compte est masqué : c'est à toi de le tenir, et la carte de coupe te le demande. |
| **Stratégie** | La stratégie de base main par main, puis les écarts au compte, calculés pour la table où tu es assis. Les mains ratées reviennent plus souvent. |
| **Concentration** | Le chef de table te surveille pendant que tu comptes. Questions des voisins, calculs, regards. Détecteur caméra optionnel pour les lèvres qui bougent et le regard figé. |
| **À plusieurs** | Tes amis rejoignent la même table avec un code, voient les mêmes cartes, et annoncent leur compte à la fin. |
| **Progression** | Historique, courbe de l'écart au compte réel, taux de réussite par exercice. |

Quatre systèmes de comptage : Hi-Lo, KO, Hi-Opt I et Omega II. Le KO est déséquilibré, donc sans compte vrai à tenir — l'application ajuste son point de départ et masque la division.

## Le hasard

Le mélange n'est pas `Math.random()`. Chaque sabot est tiré d'une graine de 32 octets, étendue par HMAC-SHA-256 en compteur, avec rejet des valeurs qui biaiseraient le modulo, puis Fisher-Yates. L'empreinte SHA-256 de la graine est **publiée avant la première carte** ; la graine elle-même est révélée à la carte de coupe.

Le bouton « Le reçu du sabot » rejoue le mélange sous tes yeux, et copie un vérificateur de vingt lignes que tu peux coller dans la console de n'importe quel navigateur : personne n'a à me croire sur parole.

En multijoueur, chaque joueur apporte sa graine et le sabot est tiré de leur combinaison — aucun participant seul ne décide de l'ordre des cartes.

## À plusieurs, sans serveur

Le mode « À plusieurs » parle MQTT sur WebSocket vers un courtier public, avec un client écrit à la main (quarante lignes, aucune dépendance). Il n'y a pas de serveur à héberger et rien n'est stocké : le code de salon vit le temps de la session.

⚠️ Les messages passent en clair par un courtier public. C'est un jeu d'entraînement, pas un canal privé.

## Construire

Aucune dépendance, aucun `npm install`.

```
node build.mjs          # calcule les grilles, mesure les tables, écrit index.html et artefact.html
node src/engine.test.mjs   # 37 tests du moteur de règles
node src/regles.test.mjs   # 78 tests de stratégie et d'écarts
./outils/verifier.sh       # pilote l'application entière dans un Chrome headless
```

`build.mjs` produit deux fichiers depuis les mêmes pièces : `index.html`, document complet pour l'hébergement, et `artefact.html`, le même corps sans `<head>` pour les plateformes qui l'enveloppent elles-mêmes.

Le code source vit dans `src/` : `engine.mjs` (les règles), `solver.mjs` (la stratégie), `indices.mjs` (les écarts), `sim.mjs` (l'avantage maison), `shuffle.mjs` (le hasard), `net.mjs` (le multijoueur), `tables.mjs` et `counting.mjs` (les données), et `app/` (l'interface).
