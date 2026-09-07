// Le catalogue du salon. Chaque table est un vrai règlement de casino, et chacune
// porte UNE leçon. L'avantage maison n'est pas recopié : il est mesuré par simulation
// au moment de la construction du fichier (voir build.mjs).
//
// mise_min / mise_max : les limites de la table, en jetons. Une seule monnaie pour
// les dix lieux. Tout le monde s'assoit avec le même tapis de 1 000, SAUF à La Marina
// (`tapis_depart`), et des
// minimums plausibles dans leur lieu : 5 sur Fremont Street, 100 au Salon Privé.
// Le minimum est l'UNITÉ de mise : la rampe de comptage se lit en multiples de lui.

export const TABLES = [
  {
    id: "boulevard", nom: "Le Boulevard", lieu: "Las Vegas Strip",
    jeux: 6, h17: true, blackjackPays: 1.5, penetration: 0.75, sieges: 5,
    das: true, surrender: "late", doubleOn: "any", maxHands: 4, hitSplitAces: false,
    holeCard: true, peek: true, melange: "sabot", cadence: 70,
    mise_min: 10, mise_max: 1000,
    lecon: "Voilà à quoi ressemble un travail.",
    detail: "La table étalon. Un demi-point d'avantage par heure de jeu parfait : une session de trois heures qui finit en dessous de zéro est parfaitement normale. Toutes les autres tables se lisent par rapport à celle-ci.",
  },
  {
    id: "neon", nom: "Le Néon", lieu: "Downtown, Fremont Street",
    jeux: 1, h17: true, blackjackPays: 1.2, penetration: 0.5, sieges: 5,
    das: false, surrender: "none", doubleOn: [9, 10, 11], maxHands: 2, hitSplitAces: false,
    holeCard: true, peek: true, melange: "main", cadence: 209,
    mise_min: 5, mise_max: 500,
    piege: "6:5",
    lecon: "Peu de jeux ne veut pas dire bon jeu.",
    detail: "Un seul jeu donne les meilleures fréquences de comptes forts du catalogue. Et pourtant tu perds : le blackjack payé 6:5 repousse ton point d'équilibre bien au-delà de ce que le compte atteint jamais. Le paiement du blackjack se lit AVANT le nombre de jeux.",
  },
  {
    id: "frontdemer", nom: "Le Front de Mer", lieu: "Atlantic City",
    jeux: 8, h17: false, blackjackPays: 1.5, penetration: 0.70, sieges: 7,
    das: true, surrender: "late", doubleOn: "any", maxHands: 4, hitSplitAces: false,
    holeCard: true, peek: true, melange: "sabot", cadence: 52,
    mise_min: 15, mise_max: 1500,
    lecon: "Les meilleures règles ne compensent pas la lenteur.",
    detail: "Le meilleur jeu à sabot du catalogue pour la stratégie de base. Mais huit jeux coupés à 70 %, et sept joueurs autour de la table, ne produisent presque jamais de compte fort. Le rendement d'un compteur, c'est l'espérance multipliée par la cadence.",
  },
  {
    id: "cotai", nom: "Le Cotai", lieu: "Macao, Cotai Strip",
    jeux: 6, h17: false, blackjackPays: 1.5, penetration: 0, sieges: 6,
    das: true, surrender: "none", doubleOn: "any", maxHands: 4, hitSplitAces: false,
    holeCard: true, peek: true, melange: "melangeuse_continue", cadence: 84,
    mise_min: 25, mise_max: 2500,
    piege: "csm",
    lecon: "La mélangeuse continue tue le comptage, pas les règles.",
    detail: "Objectivement le meilleur jeu du catalogue : un joueur de stratégie de base doit s'y précipiter. Un compteur n'a rien à y faire. Les cartes jouées retournent dans le sabot, le compte vrai reste collé à zéro, et la machine te fait perdre ton désavantage plus vite. Une bonne table et une table battable sont deux questions différentes.",
  },
  {
    id: "cercle", nom: "Le Cercle", lieu: "Londres · Monte-Carlo",
    jeux: 6, h17: false, blackjackPays: 1.5, penetration: 0.75, sieges: 7,
    das: true, surrender: "none", doubleOn: [9, 10, 11], maxHands: 4, hitSplitAces: false,
    holeCard: false, peek: false, enhcLosesAll: true, melange: "sabot", cadence: 60,
    mise_min: 20, mise_max: 2000,
    piege: "enhc",
    lecon: "Sans carte cachée, tu perds aussi tes doublements.",
    detail: "Le croupier ne prend qu'une carte. Tu doubles ton 11 contre son 10, il retourne un valet à la fin : tu perds deux unités, pas une. Ta table de stratégie appartient à la table de jeu, pas à toi.",
  },
  {
    id: "mainchaude", nom: "La Main Chaude", lieu: "double jeu, Vegas",
    jeux: 2, h17: true, blackjackPays: 1.5, penetration: 0.65, sieges: 5,
    das: true, surrender: "none", doubleOn: "any", maxHands: 4, hitSplitAces: false,
    holeCard: true, peek: true, melange: "sabot", cadence: 95,
    mise_min: 25, mise_max: 1000,
    lecon: "La géométrie bat les règles.",
    detail: "Avantage maison moins bon que Le Front de Mer, et pourtant bien plus rentable à compter : deux jeux, ça bouge. Le compte vrai grimpe et redescend sans arrêt. Pour un compteur, la variance du compte vaut plus qu'un dixième de point d'avantage maison.",
  },
  {
    id: "salonprive", nom: "Le Salon Privé", lieu: "high limit",
    jeux: 6, h17: false, blackjackPays: 1.5, penetration: 0.85, sieges: 3,
    das: true, surrender: "late", doubleOn: "any", maxHands: 4, hitSplitAces: false,
    holeCard: true, peek: true, melange: "sabot", cadence: 104,
    mise_min: 100, mise_max: 10000,
    lecon: "La carte de coupe est le seul chiffre qui compte.",
    detail: "Les mêmes six jeux que Le Boulevard, presque les mêmes règles. Une seule différence décisive : la coupe est plantée à 85 % au lieu de 75 %. C'est la seule information qu'aucun panneau n'affiche, et elle vaut plus que toutes les autres réunies.",
  },
  {
    id: "reno", nom: "Le Vieux Reno", lieu: "jeu unique, bridé",
    jeux: 1, h17: true, blackjackPays: 1.5, penetration: 0.60, sieges: 4,
    das: false, surrender: "none", doubleOn: [10, 11], maxHands: 2, hitSplitAces: false,
    holeCard: true, peek: true, melange: "main", cadence: 150,
    mise_min: 5, mise_max: 200,
    lecon: "Une table bridée peut être excellente.",
    detail: "Pas d'abandon, pas de doublement après séparation, doubler seulement sur 10 et 11 : sur le papier c'est mesquin. Et pourtant c'est l'une des meilleures tables du catalogue à compter, et celle qui demande la plus petite caisse. Les restrictions coûtent des dixièmes, la géométrie du sabot rapporte des unités.",
  },
  {
    // 🚨 LA TABLE DU MULTIJOUEUR (Léo 07/09 : « une table spéciale pour le multijoueur où
    // les mises sont plus grosses, et pas de rachat illimité pour jouer intelligemment »).
    // Les neuf autres portent une leçon sur les RÈGLES ; celle-ci porte la seule leçon
    // qu'aucune ne portait : la CAISSE. D'où les deux champs que personne d'autre n'a —
    // `tapis_depart` (on ne s'assoit pas ici avec 1 000) et `rachats_max` (on ne se
    // renfloue pas indéfiniment). Absents ailleurs = comportement d'avant, inchangé.
    id: "marina", nom: "La Marina", lieu: "Marina Bay, Singapour",
    jeux: 6, h17: false, blackjackPays: 1.5, penetration: 0.78, sieges: 7,
    das: true, surrender: "late", doubleOn: "any", maxHands: 4, hitSplitAces: false,
    holeCard: true, peek: true, melange: "sabot", cadence: 88,
    mise_min: 100, mise_max: 25000,
    tapis_depart: 5000, rachats_max: 2,
    lecon: "Ta caisse décide avant ta stratégie.",
    detail: "Les neuf autres tables t'apprennent à reconnaître un bon jeu. Celle-ci t'apprend ce qui arrive une fois que tu en as trouvé un. Le minimum est à 100, et à plusieurs on s'y assied avec 5 000 jetons — cinquante mises — et deux recaves, pas une de plus. Un compteur qui monte à cinq unités sur les comptes forts engage sa caisse entière en dix manches favorables. Avoir raison sur chaque décision et finir à zéro n'est pas de la malchance — c'est l'issue la plus fréquente quand la caisse est trop courte pour la variance.",
  },
  {
    id: "aquarium", nom: "L'Aquarium", lieu: "zone touristes",
    jeux: 8, h17: true, blackjackPays: 1.2, penetration: 0.65, sieges: 7,
    das: true, surrender: "none", doubleOn: "any", maxHands: 4, hitSplitAces: false,
    holeCard: true, peek: true, melange: "sabot", cadence: 60,
    mise_min: 10, mise_max: 500,
    piege: "6:5",
    lecon: "Il y a des tables qu'on ne bat pas.",
    detail: "Huit jeux et un blackjack payé 6:5. Le point d'équilibre est si haut que la rampe de mise ne s'ouvre jamais, quel que soit l'écart. Cette table existe pour qu'on apprenne à la refuser, pas pour qu'on la joue. Savoir se lever est la compétence la moins spectaculaire et la plus rentable.",
  },
];

export const reglesDe = t => ({
  decks: t.jeux, h17: t.h17, blackjackPays: t.blackjackPays, das: t.das,
  surrender: t.surrender, doubleOn: t.doubleOn, maxHands: t.maxHands,
  hitSplitAces: t.hitSplitAces, holeCard: t.holeCard, peek: t.peek,
  enhcLosesAll: !!t.enhcLosesAll, penetration: t.penetration || 0.75, seats: t.sieges,
  splitByRank: false,
});
