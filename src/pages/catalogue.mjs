// LE CATALOGUE DES PAGES ÉDITORIALES — la seule liste qui fasse foi.
//
// Une entrée ici, un fragment dans src/pages/corps/, et outils/pages.mjs fait le reste :
// la coquille, les données structurées, le fil d'Ariane, le précédent/suivant, le plan
// du site et llms.txt. Une page qui n'est pas ici n'existe pas — et une page qui est
// ici sans son fragment fait ÉCHOUER la construction, plutôt que de disparaître en silence.
//
// Champs :
//   slug      le chemin, sans barre au début ni à la fin. "" serait la racine (réservée à l'application).
//   fichier   le fragment, dans src/pages/corps/
//   court     le nom dans le fil d'Ariane et dans les liens « leçon précédente / suivante »
//   fil       les échelons AVANT le dernier (celui-là est ajouté tout seul)
//   alt       le slug de la même page dans l'autre langue, pour hreflang et le sélecteur
//   section   "academie" pour entrer dans l'ordre du cours (voir ORDRE_ACADEMIE)
//   faq       les questions balisées en FAQPage. 🚨 Chacune DOIT être posée dans la page,
//             en <h3>, et sa réponse visible en toutes lettres : la construction le vérifie,
//             parce que Google en fait un motif d'action manuelle.
//   apropos   les sujets déclarés dans le JSON-LD (schema.org/about)

export const PAGES = [
  {
      "slug": "blackjack",
      "fichier": "blackjack.html",
      "lang": "fr",
      "type": "Article",
      "priorite": "0.9",
      "titre": "Comment jouer au blackjack : règles, stratégie et comptage",
      "court": "Le blackjack",
      "desc": "Les règles du blackjack, la stratégie de base, et ce que le comptage des cartes fait vraiment — avec l’avantage de dix tables, mesuré et non recopié.",
      "publie": "2026-09-07",
      "modifie": "2026-09-08",
      "fil": [
          [
              "Accueil",
              "/"
          ]
      ],
      "alt": "en/blackjack",
      "apropos": [
          "Blackjack",
          "Comptage des cartes",
          "Stratégie de base"
      ],
      "faq": [
        {
            "q": "Compter les cartes est-il illégal ?",
            "r": "Non. Compter les cartes, c'est se souvenir de ce qu'on a vu : aucune loi ne l'interdit, en France comme aux États-Unis, tant qu'aucun appareil n'est utilisé. En revanche, un casino est un établissement privé et reste libre de refuser un joueur ou de lui interdire le blackjack. Ce n'est donc pas un délit, mais ça peut coûter l'accès à la salle."
        },
        {
            "q": "Combien rapporte le comptage des cartes ?",
            "r": "Beaucoup moins qu'on ne le raconte. Le comptage retire quelques dixièmes de pour cent à l'avantage de la maison — il ne le renverse pas d'un coup. Mesurée au Boulevard, une table à six jeux, un comptage parfait — la rampe de mise de référence, l'assurance et les écarts au compte — rapporte environ 0,008 unité par main : à 10 € l'unité, c'est de l'ordre de 8 centimes par main, avec une variance qui dépasse largement ce gain sur une session."
        },
        {
            "q": "Quelle est la valeur des cartes au blackjack ?",
            "r": "Les cartes de 2 à 10 valent leur chiffre. Le valet, la dame et le roi valent 10. L'as vaut 1 ou 11, au choix, toujours celui qui arrange le joueur : une main contenant un as compté 11 sans dépasser 21 est dite « souple »."
        },
        {
            "q": "Qu'est-ce que la stratégie de base au blackjack ?",
            "r": "C'est la décision qui perd le moins pour chaque combinaison possible entre votre main et la carte visible du croupier : tirer, rester, doubler, séparer ou abandonner. Elle n'est pas une opinion — elle se calcule à partir des règles exactes de la table. Changer une règle, comme le nombre de jeux ou le fait que le croupier tire sur 17 souple, change la table de stratégie."
        },
        {
            "q": "Que veut dire un blackjack payé 6:5 ?",
            "r": "Cela signifie qu'un blackjack rapporte 12 € pour 10 € misés au lieu de 15 €. C'est la modification de règle la plus coûteuse du jeu : elle ajoute à elle seule environ 1,4 point d'avantage à la maison. Sur les tables de WiseHand qui la portent, l'avantage maison mesuré atteint 1,85 % et 2,07 %, quand les huit tables payées 3:2 tiennent entre 0,36 % et 0,63 %. Aucun comptage ne rattrape cela."
        },
        {
            "q": "Peut-on compter les cartes avec une mélangeuse continue ?",
            "r": "Non. Une mélangeuse automatique continue réintroduit les cartes jouées dans le sabot après chaque main : la composition du sabot ne s'appauvrit jamais, le compte vrai reste collé à zéro, et l'information sur laquelle repose le comptage n'existe plus. La table peut par ailleurs être excellente pour un joueur de stratégie de base — une bonne table et une table battable sont deux questions différentes."
        }
    ]
  },
  {
      "slug": "strategie-de-base-blackjack",
      "fichier": "strategie-de-base.html",
      "lang": "fr",
      "type": "Article",
      "priorite": "0.9",
      "titre": "Tableau de stratégie de base au blackjack, calculé",
      "court": "Le tableau",
      "sous": "Les 290 cases, calculées — et les 31 qui changent de table en table",
      "desc": "Le tableau complet de stratégie de base au blackjack, calculé par un solveur pour deux jeux de règles — et les 31 cases qui changent d'une table à l'autre.",
      "publie": "2026-09-09",
      "modifie": "2026-09-09",
      "fil": [
          [
              "Accueil",
              "/"
          ]
      ],
      "apropos": [
          "Blackjack",
          "Stratégie de base"
      ],
      "faq": [
        {
            "q": "Qu'est-ce que la stratégie de base au blackjack ?",
            "r": "C'est la décision qui perd le moins pour chaque combinaison possible entre votre main et la carte visible du croupier : tirer, rester, doubler, séparer ou abandonner. Elle ne se discute pas et ne s'improvise pas — elle se calcule à partir des règles exactes de la table. Jouée sans faute, elle ramène l'avantage de la maison à quelques dixièmes de pour cent, ce qui en fait le meilleur tarif de l'établissement."
        },
        {
            "q": "Existe-t-il un seul tableau de stratégie de base ?",
            "r": "Non, et c'est l'erreur la plus répandue. Un tableau est celui d'une table. Entre une table américaine à six jeux et une table européenne sans carte cachée, au doublement limité et sans abandon, trente et une des 290 cases changent. Jouer le mauvais tableau coûte de l'argent sur chacune de ces cases."
        },
        {
            "q": "Faut-il apprendre le tableau par cœur ?",
            "r": "Pas case par case. Les décisions se rangent en blocs — 17 et plus on reste, 13 à 16 on reste contre une carte faible du croupier, 11 se double presque partout, on sépare toujours les as et les 8 et jamais les 10 ni les 5. Une poignée de règles couvre la grande majorité des mains, et le reste s'apprend par les exceptions, en jouant."
        },
        {
            "q": "La stratégie de base permet-elle de gagner au blackjack ?",
            "r": "Non. Elle ramène l'avantage de la maison au minimum que les règles autorisent, elle ne le renverse pas : sur la table étalon de ce site, il reste 0,583 % en faveur du casino. Joué parfaitement, le blackjack se perd lentement au lieu de se perdre vite. Seul le comptage des cartes retourne l'avantage, de quelques dixièmes de point, et seulement sur une table qui s'y prête."
        },
        {
            "q": "Que veut dire « D » quand on ne peut pas doubler ?",
            "r": "Le doublement n'est possible qu'à deux cartes, et certaines tables le limitent à certains totaux. Là où il est impossible, un « D » se joue comme un tirage. De même, un « U » sur une table sans abandon se joue comme un tirage — à l'exception de 17 contre as, où l'on reste."
        }
    ]
  },
  {
      "slug": "methode",
      "fichier": "methode.html",
      "lang": "fr",
      "type": "Article",
      "priorite": "0.7",
      "titre": "D'où viennent les chiffres de ce site — la méthode",
      "court": "La méthode",
      "sous": "Le solveur, le simulateur, le vérificateur — et ce qu'ils ne savent pas dire",
      "desc": "Un solveur calcule les décisions, un simulateur mesure les avantages sur trois millions de mains, un vérificateur casse la construction au premier écart.",
      "publie": "2026-09-09",
      "modifie": "2026-09-09",
      "fil": [
          [
              "Accueil",
              "/"
          ]
      ],
      "apropos": [
          "Blackjack",
          "Méthode de mesure"
      ],
      "faq": [
        {
            "q": "Les chiffres de ce site sont-ils vérifiables ?",
            "r": "Oui, de deux façons. À la lecture d'abord : chaque page indique le volume de simulation et la date du dernier calcul. Par le code ensuite : le solveur, le simulateur et le vérificateur vivent dans le dépôt du site, sous licence MIT, et la graine du générateur est fixe — rejouer le calcul rend le même nombre."
        },
        {
            "q": "Pourquoi vos chiffres diffèrent-ils de ceux d'autres sites ?",
            "r": "Le plus souvent parce qu'ils ne décrivent pas la même table. Un avantage maison n'existe pas dans l'absolu : il dépend du nombre de jeux, du paiement du blackjack, du comportement du croupier sur 17 souple et de quelques règles de plus. Beaucoup de pages citent une valeur unique sans dire à quel règlement elle correspond, ce qui la rend invérifiable — et souvent fausse pour la table où vous êtes assis."
        },
        {
            "q": "Qui écrit ce site ?",
            "r": "Léo Lejeau, qui a écrit l'application, les pages et l'outillage de mesure. Ce n'est pas un site d'affiliation et il n'a pas de rédaction : quand une phrase avance un chiffre, ce chiffre vient du dépôt, et le vérificateur casse la construction s'il cesse de correspondre."
        },
        {
            "q": "Ce site conseille-t-il de jouer ?",
            "r": "Non. Le blackjack reste un jeu d'argent, et un jeu d'argent se perd à long terme : même jouée parfaitement, la stratégie de base laisse l'avantage à la maison, et le comptage ne le retourne que de quelques dixièmes de point, sur des milliers de mains, et seulement sur une table qui s'y prête. Ici, les jetons ne valent rien et le tapis se rachète d'un clic ; dehors, c'est autre chose."
        }
    ]
  },
  {
      "slug": "en/blackjack",
      "fichier": "en-blackjack.html",
      "lang": "en",
      "type": "Article",
      "priorite": "0.9",
      "titre": "How to Play Blackjack: Rules, Basic Strategy and Card Counting",
      "court": "Blackjack",
      "desc": "The rules of blackjack, the full basic strategy chart, and what card counting really does — with the house edge of ten tables, measured, not copied.",
      "publie": "2026-09-07",
      "modifie": "2026-09-08",
      "fil": [
          [
              "Home",
              "/"
          ]
      ],
      "alt": "blackjack",
      "apropos": [
          "Blackjack",
          "Card counting",
          "Basic strategy"
      ],
      "faq": [
          {
              "q": "Is counting cards illegal?",
              "r": "No. Keeping a mental tally of cards that have been dealt in front of you is not a crime anywhere. Casinos are private property and can refuse service, so counters get asked to leave or barred — but that is a business decision, not a legal one. Using a device or an accomplice to help you count is illegal in many jurisdictions, including Nevada."
          },
          {
              "q": "Does another player's bad play cost me money?",
              "r": "No, and this is the most persistent myth at the table. When the player next to you hits a 15 and takes \"the dealer's bust card\", they were equally likely to have taken a card that would have saved you. Over any meaningful number of hands the effect is exactly zero. Their decisions change the order of the cards, not the odds. Play your own hand."
          },
          {
              "q": "Why do I have to hit 16 against a 10? I always bust.",
              "r": "You do, 61.5% of the time. But if you stand you win only when the dealer busts, which they do about 23% of the time when showing a 10 (having already checked for blackjack). Hitting is not a good play — it is the less bad of two losing plays. If the table offers surrender, the chart says to take it, which is the cheapest of the three."
          },
          {
              "q": "Should I always split 8s, even against a 10?",
              "r": "Yes — with one exception in this rule set. A hard 16 is the worst hand in blackjack; two hands starting with an 8 are both better than one hand of 16, even against a strong up-card. You are not splitting to win, you are splitting to lose less. The exception: against an Ace at an H17 table with surrender available, the chart says surrender instead."
          },
          {
              "q": "Can you count cards against a continuous shuffling machine?",
              "r": "No. A CSM returns cards to the shuffler after every hand, so the composition never drifts away from a full shoe and the true count stays pinned near zero. There is nothing to track. No counting system defeats a CSM."
          },
          {
              "q": "Does basic strategy mean I will win?",
              "r": "No. Basic strategy is the best available play, and the best available play still loses money slowly at every table listed above. It reduces the house edge from roughly 2% for an average player to a few tenths of a point. That is the whole benefit, and it is worth having — but it is a reduction in cost, not a profit."
          },
          {
              "q": "What is the best blackjack table to look for?",
              "r": "In order: 3:2 blackjack (non-negotiable), dealer stands on soft 17, double on any two cards, double after splitting, surrender available, and fewer decks. Check the payout first. It outweighs everything else combined."
          },
          {
              "q": "Is there a betting system that beats blackjack?",
              "r": "No. Martingale, Paroli, D'Alembert and every other progression change the shape of your results — many small wins and rare catastrophic losses, or the reverse — without changing the expected value by a single cent. No sequence of bet sizes can turn a negative-expectation game positive. Only changing the odds does that, which is what counting attempts and why it is hard."
          }
      ]
  }
,
  {
      "slug": "academie",
      "fichier": "academie.html",
      "lang": "fr",
      "type": "Course",
      "priorite": "0.9",
      "titre": "L'Académie du blackjack : dix leçons pour compter les cartes",
      "court": "L'Académie",
      "desc": "Le sommaire de l'Académie WiseHand : dix leçons gratuites sur le blackjack et le comptage des cartes, des valeurs Hi-Lo au choix d'une table de casino.",
      "publie": "2026-09-09",
      "modifie": "2026-09-09",
      "fil": [
          [
              "Accueil",
              "/"
          ]
      ],
      "section": "academie",
      "faq": [
        {
            "q": "Qu'est-ce que l'Académie WiseHand ?",
            "r": "C'est le cours écrit qui accompagne l'entraîneur WiseHand : dix leçons gratuites qui expliquent le comptage des cartes au blackjack, des valeurs du système Hi-Lo jusqu'au choix d'une table de casino. Chaque leçon traite une question et une seule, et s'appuie sur les mesures du solveur et du simulateur du dépôt plutôt que sur des chiffres recopiés ailleurs."
        },
        {
            "q": "Faut-il lire les leçons dans l'ordre ?",
            "r": "Non. Chaque leçon est autonome et se lit seule. L'ordre proposé sur cette page est simplement celui qui demande le moins d'efforts quand on part de zéro, parce qu'il traite les valeurs des cartes avant le compte vrai, et le compte vrai avant les écarts à la stratégie de base."
        },
        {
            "q": "L'Académie apprend-elle à gagner de l'argent au blackjack ?",
            "r": "Non, et c'est le contraire de son objet. Le comptage des cartes retire quelques dixièmes de pour cent à l'avantage de la maison, sur des milliers de mains, à condition de ne jamais se tromper et de jouer une table qui s'y prête — sur trois des dix tables du catalogue, il ne rapporte rien du tout. Une des dix leçons est consacrée à ce que le comptage rapporte réellement, chiffres mesurés à l'appui."
        },
        {
            "q": "Pour quel système de comptage ce cours est-il écrit ?",
            "r": "Pour le Hi-Lo, qui est le standard et celui pour lequel les écarts publiés existent : les cartes de 2 à 6 valent +1, les 7, 8 et 9 valent zéro, les dix et les as valent −1. L'entraîneur propose aussi le KO, le Hi-Opt I et l'Omega II, et le solveur recalcule les seuils pour chacun, mais les leçons s'en tiennent au Hi-Lo."
        },
        {
            "q": "L'Académie est-elle gratuite ?",
            "r": "Oui, entièrement, et il n'y a rien d'autre à débloquer ailleurs. Les dix leçons et l'entraîneur sont accessibles sans compte, sans publicité, sans argent réel et sans version payante, et le code de l'application est ouvert sous licence MIT."
        }
    ]
  },
  {
      "slug": "academie/valeurs-des-cartes-hi-lo",
      "fichier": "academie-valeurs-des-cartes-hi-lo.html",
      "lang": "fr",
      "type": "Article",
      "priorite": "0.8",
      "titre": "Les valeurs des cartes en Hi-Lo : le tableau expliqué",
      "court": "Les valeurs Hi-Lo",
      "desc": "En Hi-Lo, 2 à 6 valent +1, 7 à 9 valent 0, dix et as valent −1. Le tableau, l'origine exacte de ces valeurs, et la comparaison avec KO, Hi-Opt I et Omega II.",
      "publie": "2026-09-09",
      "modifie": "2026-09-09",
      "fil": [
          [
              "Accueil",
              "/"
          ],
          [
              "L'Académie",
              "/academie/"
          ]
      ],
      "section": "academie",
      "faq": [
        {
            "q": "Pourquoi l'as vaut-il −1 en Hi-Lo alors qu'il peut valoir 1 ou 11 ?",
            "r": "Parce que la valeur Hi-Lo d'une carte ne décrit pas ce qu'elle vaut dans une main, mais ce que son départ du sabot fait à votre espérance. L'as fabrique des blackjacks, qui vous sont payés une fois et demie votre mise et qui ne rapportent au croupier que la mise simple : un sabot vidé de ses as vous dessert. C'est ce déséquilibre de paiement, et non la souplesse de l'as dans une main, que le −1 enregistre."
        },
        {
            "q": "Pourquoi les 7, 8 et 9 valent-ils zéro ?",
            "r": "Parce que leur retrait ne déplace presque pas l'espérance : ils ne complètent pas les mains faibles du croupier aussi bien qu'un 5, et ils ne font pas de blackjacks. Leur effet réel n'est pas rigoureusement nul — le 7 penche légèrement du côté du joueur, ce que KO et Omega II reconnaissent en lui donnant +1 — mais il est assez petit pour qu'un système à trois valeurs ait raison de l'ignorer."
        },
        {
            "q": "Hi-Lo est-il le meilleur système de comptage ?",
            "r": "Non, et il ne cherche pas à l'être. Omega II épouse de bien plus près la courbe des effets de retrait, et Hi-Opt I décide mieux les mains parce qu'il ne laisse pas les as brouiller le compte. Hi-Lo reste pourtant le bon choix pour presque tout le monde, parce que l'écart de précision entre ces systèmes est plus petit que l'écart entre un compte tenu sans faute et un compte tenu approximativement."
        },
        {
            "q": "Pourquoi KO ne demande-t-il pas de compte vrai ?",
            "r": "Parce que ses valeurs ne s'annulent pas sur un jeu complet : leur somme vaut +4 par jeu, et un compte qui dérive avec la profondeur ne se divise pas utilement par les jeux restants. KO compense en démarrant à un nombre négatif calculé sur la taille du sabot, soit −20 pour six jeux, et pilote la mise avec le compte courant seul. On économise une division et une estimation à vue, on perd un peu de précision."
        }
    ],
    "sous": "pourquoi les cartes de 2 à 6 comptent +1, les dix et les as −1, et ce que ce seul nombre mesure réellement dans le sabot"
  },
  {
      "slug": "academie/compte-vrai",
      "fichier": "academie-compte-vrai.html",
      "lang": "fr",
      "type": "Article",
      "priorite": "0.8",
      "titre": "Le compte vrai au blackjack : le calcul et l'estimation",
      "court": "Le compte vrai",
      "desc": "Le compte vrai, c'est le compte courant divisé par les jeux restants. Pourquoi cette division est indispensable, et comment estimer le sabot à vue.",
      "publie": "2026-09-09",
      "modifie": "2026-09-09",
      "fil": [
          [
              "Accueil",
              "/"
          ],
          [
              "L'Académie",
              "/academie/"
          ]
      ],
      "section": "academie",
      "faq": [
        {
            "q": "Comment calcule-t-on le compte vrai au blackjack ?",
            "r": "On divise le compte courant par le nombre de jeux qui restent dans le sabot, estimé à vue et arrondi au demi-jeu : +6 avec deux jeux restants donne un compte vrai de +3. Le compte courant seul ne permet aucune décision, parce qu'il ne dit pas sur combien de cartes son excédent est réparti."
        },
        {
            "q": "Comment estimer le nombre de jeux restants sans compteur ?",
            "r": "On regarde la défausse plutôt que le sabot, on lit le tas en demi-jeux, et on soustrait du total connu du sabot. La défausse est posée à plat, immobile et bien éclairée, alors que le sabot est incliné et souvent masqué par la main du croupier. La hauteur d'un jeu se calibre au premier mélange, sur la table où vous êtes assis : elle dépend des cartes, de leur usure et du bac."
        },
        {
            "q": "Une erreur d'un demi-jeu, c'est grave ?",
            "r": "Cela dépend entièrement du moment du sabot, et l'écart entre les deux extrêmes est énorme. À cinq jeux restants, un demi-jeu d'erreur déplace le compte vrai d'un ou deux dixièmes et ne change aucune décision. À un jeu restant, avec un compte courant de +8, la même erreur fait passer le compte vrai de +5,3 à +16 — au moment où la mise est la plus grosse."
        },
        {
            "q": "Faut-il diviser par les jeux restants ou par les demi-jeux ?",
            "r": "Les deux conventions existent et aucune n'est fausse, mais il faut en choisir une et s'y tenir, puisqu'un seuil publié appartient à une échelle et à une seule. Diviser par les demi-jeux restants donne un nombre deux fois plus petit : deux jeux au sabot font quatre demi-jeux, donc +8 y vaut +2 au lieu de +4. WiseHand divise par les jeux entiers, parce que c'est l'échelle des écarts publiés et celle sur laquelle son solveur calcule les siens."
        }
    ],
    "sous": "la division par les jeux restants, l'étape que presque tout le monde saute, et celle qui décide de la mise"
  },
  {
      "slug": "academie/penetration-du-sabot",
      "fichier": "academie-penetration-du-sabot.html",
      "lang": "fr",
      "type": "Article",
      "priorite": "0.8",
      "titre": "Pénétration du sabot au blackjack : définition et effets",
      "court": "La pénétration",
      "desc": "La pénétration est la part du sabot jouée avant le remélange : ce que la carte de coupe décide vraiment, mesuré sur les dix tables de WiseHand.",
      "publie": "2026-09-09",
      "modifie": "2026-09-09",
      "fil": [
          [
              "Accueil",
              "/"
          ],
          [
              "L'Académie",
              "/academie/"
          ]
      ],
      "section": "academie",
      "faq": [
        {
            "q": "Qu'est-ce que la pénétration au blackjack",
            "r": "La pénétration est la part du sabot que le croupier distribue avant de tout remélanger, et elle est fixée par la position de la carte de coupe insérée au montage du sabot. Une pénétration de 75 % sur six jeux signifie que 234 cartes seront jouées et que 78 cartes retourneront au mélange sans avoir été vues."
        },
        {
            "q": "La pénétration change-t-elle l'avantage de la maison",
            "r": "Non, pas de façon mesurable. Le simulateur de WiseHand ne détecte aucune tendance lisible sur l'avantage maison quand on ne fait varier que la position de la carte de coupe, parce que la stratégie de base ne consulte jamais le sabot restant et joue la même carte contre la même carte à la première manche comme à la dernière."
        },
        {
            "q": "Quelle pénétration faut-il pour que compter les cartes serve à quelque chose",
            "r": "La question est mal posée tant qu'elle porte sur un pourcentage, car ce qui compte est le nombre de jeux laissés derrière la carte de coupe et non la fraction jouée. Un jeu unique coupé à 60 % laisse 21 cartes inconnues et produit des comptes vrais très élevés, alors que huit jeux coupés à 70 % en laissent 125 et n'en produisent presque jamais."
        },
        {
            "q": "Comment connaître la pénétration d'une table avant de s'asseoir",
            "r": "Il faut regarder jouer un sabot entier depuis l'extérieur de la table et repérer le moment où la carte de coupe sort, car aucun panneau ne donne cette information. Estimez ensuite l'épaisseur de ce qui n'a pas été joué et convertissez-la en jeux plutôt qu'en pourcentage."
        }
    ],
    "sous": "pourquoi les mêmes six jeux, à règles presque identiques, se comptent bien mieux avec une carte de coupe plantée à 85 % qu'à 75 %, et pourquoi une coupe basse affaiblit une table sans pour autant tuer le comptage"
  },
  {
      "slug": "academie/assurance",
      "fichier": "academie-assurance.html",
      "lang": "fr",
      "type": "Article",
      "priorite": "0.8",
      "titre": "Assurance au blackjack : quand la prendre (compte vrai +3)",
      "court": "L'assurance",
      "desc": "Jamais, sauf au compte vrai +3 ou plus : le calcul complet du pari, le seuil d'un tiers de dix, et pourquoi l'index est le même sur les dix tables.",
      "publie": "2026-09-09",
      "modifie": "2026-09-09",
      "fil": [
          [
              "Accueil",
              "/"
          ],
          [
              "L'Académie",
              "/academie/"
          ]
      ],
      "section": "academie",
      "faq": [
        {
            "q": "Faut-il prendre l'assurance quand on a un blackjack ?",
            "r": "Non, sauf au compte vrai +3 ou plus, exactement comme avec n'importe quelle autre main. L'assurance à égalité proposée sur un blackjack est le même pari sous un autre nom, et la refuser dans un sabot neutre rapporte en moyenne un vingt-sixième de mise de plus que l'accepter."
        },
        {
            "q": "L'assurance protège-t-elle vraiment ma mise ?",
            "r": "Non. C'est un pari séparé qui porte sur la seule carte cachée du croupier, et votre propre main n'entre à aucun moment dans le calcul de sa rentabilité. Comme il paie 2:1, il n'est gagnant que si plus d'un tiers des cartes restantes valent 10, alors qu'un sabot neutre en contient 16 sur 52."
        },
        {
            "q": "À partir de quel compte vrai prend-on l'assurance ?",
            "r": "À +3 et au-dessus, jamais en dessous : c'est l'index que le solveur de WiseHand publie pour les dix tables. Le point de bascule réel n'est pas un entier — l'algèbre le place à 10/3, soit un peu plus de 3,33 — et l'index publié en est le plancher, parce qu'un compte vrai annoncé « +3 » couvre en réalité tout l'intervalle qui va de +3 à +4."
        },
        {
            "q": "Le nombre de jeux change-t-il l'index d'assurance ?",
            "r": "Non, le solveur du dépôt renvoie +3 sur les dix tables de WiseHand, du jeu unique au sabot de huit jeux. Le seuil porte sur une proportion de cartes et le compte vrai est déjà une valeur ramenée au jeu restant, si bien que le nombre de jeux disparaît purement et simplement du calcul."
        }
    ],
    "sous": "perdant les yeux fermés, rentable à partir d'un compte vrai de +3 : d'où vient ce seuil, et pourquoi il ne se devine pas"
  },
  {
      "slug": "academie/illustrious-18",
      "fichier": "academie-illustrious-18.html",
      "lang": "fr",
      "type": "Article",
      "priorite": "0.8",
      "titre": "Illustrious 18 : la liste des écarts au compte, calculée",
      "court": "Les dix-huit écarts",
      "desc": "L'Illustrious 18 : les écarts au compte qui rapportent le plus, recalculés par WiseHand pour chaque règlement, avec l'index exact de chaque décision.",
      "publie": "2026-09-09",
      "modifie": "2026-09-09",
      "fil": [
          [
              "Accueil",
              "/"
          ],
          [
              "L'Académie",
              "/academie/"
          ]
      ],
      "section": "academie",
      "faq": [
        {
            "q": "Faut-il apprendre l'Illustrious 18 par cœur ?",
            "r": "Seulement après la stratégie de base et le compte vrai, jamais avant. Un écart appliqué sur un compte mal tenu coûte plus cher que le même écart correctement joué ne rapporte, et la stratégie de base est ce qui vous fait perdre le moins pendant que vous apprenez le reste."
        },
        {
            "q": "L'Illustrious 18 est-il valable sur toutes les tables ?",
            "r": "Non, et c'est son principal malentendu. Sur les dix-huit écarts calculés pour Le Boulevard, trois seulement se retrouvent à l'identique au Cercle et un seul au Néon, parce qu'un écart dépend du nombre de jeux, du droit de doubler, du droit d'abandonner et de la présence d'une carte cachée."
        },
        {
            "q": "Quel est l'écart le plus rentable de la liste ?",
            "r": "La liste classique met l'assurance en tête, et Don Schlesinger lui attribue à elle seule plus de 30 % du gain que rapportent les écarts. Le dépôt ne mesure pas ces parts : il calcule des seuils, pas leur rendement. Ce qu'il établit, c'est que l'assurance est le seul index qui ne dépend d'aucune règle de table, puisqu'il ne dépend que de la proportion de cartes de valeur 10 restantes — il vaut +3 sur les dix tables du salon, avec la réserve que les jeux à un ou deux paquets justifient un seuil plus bas."
        },
        {
            "q": "Combien d'écarts faut-il connaître ?",
            "r": "Le dépôt en calcule 79 pour Le Boulevard, plus 16 situations d'abandon, mais les apprendre tous n'a pas de sens, parce que plus un index est éloigné de zéro, plus la situation qui le déclenche est rare. Commencez par l'assurance, puis par les quatre écarts d'index 0, dont le seuil tombe sur le compte le plus courant."
        },
        {
            "q": "Un écart d'index négatif sert-il vraiment ?",
            "r": "Oui, et il se joue à l'envers des autres. Un index négatif signifie que la stratégie de base a raison au compte neutre et qu'il faut cesser de la suivre uniquement quand le sabot devient défavorable, ce qui arrive plus souvent qu'un compte très positif."
        }
    ],
    "sous": "ce que devient la liste classique quand on la recalcule pour une table précise, où le dépôt trouve 79 écarts de jeu et 16 abandons sur la seule table étalon"
  },
  {
      "slug": "academie/blackjack-6-5",
      "fichier": "academie-blackjack-6-5.html",
      "lang": "fr",
      "type": "Article",
      "priorite": "0.8",
      "titre": "Le blackjack payé 6:5 : pourquoi il faut éviter ces tables",
      "court": "Le 6:5",
      "desc": "Une mise de 10 rapporte 12 au lieu de 15 : le blackjack payé 6:5 coûte près de 1,4 % d'avantage maison, et aucun compteur de cartes ne rattrape un tel écart.",
      "publie": "2026-09-09",
      "modifie": "2026-09-09",
      "fil": [
          [
              "Accueil",
              "/"
          ],
          [
              "L'Académie",
              "/academie/"
          ]
      ],
      "section": "academie",
      "faq": [
        {
            "q": "Pourquoi faut-il éviter le blackjack payé 6:5 ?",
            "r": "Parce qu'il coûte près de 1,4 % d'avantage maison à lui seul, plus que toute autre règle courante du jeu. Sur une mise de 10, un blackjack rapporte 12 au lieu de 15, et un blackjack tombe environ une main sur vingt et une. Les deux tables 6:5 de WiseHand sont mesurées à 1,850 % et 2,073 % d'avantage maison, quand les huit tables 3:2 du salon tiennent toutes entre 0,359 % et 0,631 %."
        },
        {
            "q": "Un compteur de cartes peut-il battre une table 6:5 ?",
            "r": "Non. Le comptage rapporte quelques dixièmes de point sur des milliers de mains, quand une table 6:5 part avec plus d'un point de retard supplémentaire à combler. Le compte fort produit surtout des blackjacks, c'est-à-dire exactement la main que la table sous-paie, et il les produit au moment précis où la mise est la plus grosse."
        },
        {
            "q": "Combien coûte vraiment une table 6:5 sur cent mains ?",
            "r": "Sur cent mains à 10 jetons de mise initiale, soit 1 000 jetons engagés, une table 3:2 comme Le Boulevard prend en moyenne 5,8 jetons, Le Néon en prend 18,5 et L'Aquarium 20,7. Ces montants comptent des mains et non des heures, parce que WiseHand ne mesure pas le nombre de mains distribuées par heure : cette cadence dépend du croupier et du nombre de joueurs, et elle varie assez pour changer le classement d'une table à l'autre."
        },
        {
            "q": "Comment savoir si une table paie 6:5 avant de s'asseoir ?",
            "r": "C'est écrit sur le feutre, mais souvent en petit. Une table 3:2 annonce « BLACKJACK PAIE 3 CONTRE 2 » en grandes lettres au centre du tapis, tandis qu'une table 6:5 le mentionne volontiers sur un petit panneau posé au coin. Un autre indice aide : six pour cinq ne tombe sur un nombre entier qu'à des mises multiples de cinq, et ces tables imposent souvent ce pas. En cas de doute, la question se pose au croupier."
        },
        {
            "q": "Le blackjack payé 6:5, est-ce une arnaque ?",
            "r": "Non. Le rapport est imprimé sur le tapis, il est le même pour tout le monde, et il est connu avant que la première carte ne sorte. Ce n'est pas un mensonge, c'est une règle qui coûte cher et qui ne se voit pas pendant qu'on joue, puisqu'elle ne se voit qu'avant, sur le feutre, et après, sur le solde."
        }
    ],
    "sous": "ce que coûte réellement un blackjack payé 12 € au lieu de 15 € pour 10 € misés : environ 1,4 point d'avantage supplémentaire, qu'aucun comptage ne rattrape"
  },
  {
      "slug": "academie/s17-h17",
      "fichier": "academie-s17-h17.html",
      "lang": "fr",
      "type": "Article",
      "priorite": "0.8",
      "titre": "S17 ou H17 au blackjack : ce que ça change vraiment",
      "court": "S17 ou H17",
      "desc": "H17 (le croupier tire sur 17 souple) est pire pour le joueur que S17 : environ deux dixièmes de point, et six cases de stratégie de base qui changent.",
      "publie": "2026-09-09",
      "modifie": "2026-09-09",
      "fil": [
          [
              "Accueil",
              "/"
          ],
          [
              "L'Académie",
              "/academie/"
          ]
      ],
      "section": "academie",
      "faq": [
        {
            "q": "S17 ou H17, quelle table choisir ?",
            "r": "À règles égales par ailleurs, choisissez S17 : le croupier qui reste sur 17 souple vous laisse environ deux dixièmes de point d'avantage maison de moins à combattre. Mais cette règle ne se lit jamais seule, et elle arrive loin derrière le paiement du blackjack."
        },
        {
            "q": "Le H17 coûte-t-il vraiment 0,2 point au joueur ?",
            "r": "Oui, et WiseHand le mesure au lieu de le recopier. Aucune paire de tables du catalogue ne diffère par cette seule règle, mais le simulateur peut la changer seule : en reprenant le règlement du Boulevard et en ne retournant que le 17 souple, l'écart mesuré est de 0,2 point d'avantage maison. Les deux paires de tables réelles les plus proches, La Marina et Le Salon Privé face au Boulevard, donnent 0,224 et 0,199 point, carte de coupe comprise."
        },
        {
            "q": "Combien de cases de stratégie de base changent entre S17 et H17 ?",
            "r": "Sur un sabot de six jeux avec abandon tardif, le solveur du dépôt en trouve exactement six : 11 dur contre l'as, A,7 contre 2, A,8 contre 6, 15 dur contre l'as, 17 dur contre l'as et la paire de 8 contre l'as. Sans abandon, il n'en reste que trois, les trois premières."
        },
        {
            "q": "Faut-il vraiment abandonner un 17 en H17 ?",
            "r": "Oui, face à un as, et uniquement si la table propose l'abandon tardif. Un 17 dur contre un as est une main perdue la plupart du temps, et récupérer la moitié de la mise vaut mieux que la jouer quand le croupier a le droit de relancer son 17 souple."
        },
        {
            "q": "Une table S17 est-elle toujours meilleure qu'une table H17 ?",
            "r": "Non. Dans le catalogue mesuré de WiseHand, Le Cercle reste sur 17 souple et affiche pourtant 0,601 % d'avantage maison, quand La Main Chaude, qui tire dessus, tient à 0,381 %. Le Cercle cumule trois autres handicaps : pas de carte cachée, pas d'abandon, et un doublement limité à 9, 10 et 11. Le règlement complet décide, jamais une règle isolée."
        }
    ],
    "sous": "ce que change le fait que le croupier tire ou non sur un 17 souple : près de 0,2 point d'avantage maison, et plusieurs cases de votre table de stratégie"
  },
  {
      "slug": "academie/melangeuse-continue",
      "fichier": "academie-melangeuse-continue.html",
      "lang": "fr",
      "type": "Article",
      "priorite": "0.8",
      "titre": "Mélangeuse continue au blackjack : le comptage ne sert plus",
      "court": "La mélangeuse continue",
      "desc": "Une mélangeuse continue remet les cartes jouées dans le sabot à chaque main : le compte vrai reste à zéro. Pourquoi c'est une bonne table quand même.",
      "publie": "2026-09-09",
      "modifie": "2026-09-09",
      "fil": [
          [
              "Accueil",
              "/"
          ],
          [
              "L'Académie",
              "/academie/"
          ]
      ],
      "section": "academie",
      "faq": [
        {
            "q": "Peut-on compter les cartes face à une mélangeuse continue ?",
            "r": "Non. Les cartes jouées retournent dans le sabot après chaque main, si bien que le compte courant ne s'accumule jamais et que le nombre de jeux restants ne diminue jamais : le compte vrai reste collé à zéro et ne fournit plus aucune information exploitable. Ce n'est pas une difficulté à surmonter par l'entraînement, c'est une donnée que la table ne produit plus."
        },
        {
            "q": "Une table à mélangeuse continue est-elle une mauvaise table ?",
            "r": "Souvent, c'est l'inverse. Le Cotai, la table à mélangeuse continue du catalogue de WiseHand, affiche 0,463 % d'avantage maison mesuré, contre 0,583 % pour la table étalon de Las Vegas et 2,073 % pour la table touristique du catalogue. Pour un joueur de stratégie de base qui ne compte pas, c'est une bonne table ; pour un compteur, elle est sans intérêt. Une bonne table et une table battable sont deux questions différentes."
        },
        {
            "q": "Quelle est la différence entre une CSM et une mélangeuse automatique ?",
            "r": "Une mélangeuse continue réintègre les cartes jouées dans le stock après chaque main, tandis qu'une mélangeuse automatique par lots se contente de préparer un sabot pendant que l'autre est en jeu. La première supprime le comptage, la seconde le laisse entièrement valide et ne fait que supprimer la pause de mélange. Pour les distinguer, regardez si le croupier rend les cartes de la main terminée à la machine ou à un bac de défausse."
        },
        {
            "q": "Perd-on plus d'argent sur une table à mélangeuse continue ?",
            "r": "C'est possible, et c'est le point que l'on oublie presque toujours. Ce que vous perdez par heure est l'avantage maison multiplié par le nombre de mains jouées, or la machine supprime les pauses de mélange et fait donc distribuer davantage de mains dans le même temps. Il suffit qu'elle fasse jouer environ un quart de mains en plus par heure pour que l'écart entre 0,463 % et 0,583 % soit entièrement consommé."
        },
        {
            "q": "La mélangeuse continue est-elle truquée ?",
            "r": "Rien ne permet de l'affirmer, et la maison n'en a aucun besoin : son avantage est déjà inscrit dans les règles du jeu, mesurable et suffisant. Ces appareils sont soumis au contrôle des autorités de jeu là où ils sont installés. La bonne raison de se méfier d'une table n'est pas sa machine : c'est un blackjack payé 6:5, affiché sur le tapis, et qui coûte bien davantage."
        }
    ],
    "sous": "pourquoi elle peut faire une excellente table pour un joueur de stratégie de base et une table sans le moindre intérêt pour un compteur"
  },
  {
      "slug": "academie/combien-rapporte-le-comptage",
      "fichier": "academie-combien-rapporte-le-comptage.html",
      "lang": "fr",
      "type": "Article",
      "priorite": "0.8",
      "titre": "Combien rapporte le comptage de cartes au blackjack",
      "court": "Ce que ça rapporte",
      "desc": "Un comptage parfait rapporte environ 0,008 unité de mise par main, pour un écart-type de 2,6 unités : les chiffres mesurés, la variance et la caisse.",
      "publie": "2026-09-09",
      "modifie": "2026-09-09",
      "fil": [
          [
              "Accueil",
              "/"
          ],
          [
              "L'Académie",
              "/academie/"
          ]
      ],
      "section": "academie",
      "faq": [
        {
            "q": "Combien rapporte le comptage des cartes par main ?",
            "r": "De l'ordre de 0,008 unité de mise par main sur la table étalon de WiseHand, six jeux avec une carte de coupe à 75 %, en jouant un comptage parfait : la rampe de mise de référence, l'assurance au compte vrai +3 et les écarts au compte. Sans les écarts au compte, la même rampe, assurance comprise, ne rapporte que 0,005 unité par main. Le gain se mesure en unités de mise et non en euros, parce qu'il dépend du minimum de la table, du nombre de mains jouées par heure et de la caisse dont vous disposez. Sur une table plus profonde il monte ; sur une table payée 6:5 il tombe à zéro ou passe en négatif."
        },
        {
            "q": "Quelle caisse faut-il pour compter les cartes ?",
            "r": "Dans la simulation, un compteur parfait qui démarre avec cent unités de mise se ruine dans près de trois cas sur quatre avant d'avoir joué cinquante mille mains. Il faut de l'ordre de mille unités pour que le risque de ruine descende autour de 2 %. La caisse n'améliore pas le gain : elle sert uniquement à survivre à la variance assez longtemps pour que l'avantage se manifeste."
        },
        {
            "q": "Peut-on vivre du comptage de cartes ?",
            "r": "Rien dans ces chiffres ne le laisse penser pour la quasi-totalité des gens. Il faut de l'ordre de cent mille mains pour que l'avantage dépasse seulement le bruit, une caisse de mille fois la mise minimale, l'accès durable à des tables profondes payées 3:2, et une exactitude tenue pendant des heures. Même dans ces conditions, près d'une carrière simulée sur quatre finit dans le rouge après cinquante mille mains."
        },
        {
            "q": "Une erreur de comptage annule-t-elle l'avantage ?",
            "r": "Pas une erreur isolée, contrairement à ce qu'on lit souvent. En injectant une erreur de comptage par sabot dans la simulation, le gain ne bouge pas de façon mesurable, parce que les écarts dans un sens et dans l'autre se compensent et qu'une unité de compte courant pèse peu une fois divisée par les jeux restants. C'est l'estimation des jeux restants qui coûte cher, et seulement quand elle est biaisée toujours du même côté : surestimer d'un demi-jeu ce qui reste dans le sabot divise le gain par deux. Se tromper d'un demi-jeu au hasard, tantôt dans un sens tantôt dans l'autre, ne coûte rien en espérance — cela fait miser un peu plus gros, donc jouer un peu plus risqué : l'écart-type monte avec le gain."
        }
    ],
    "sous": "le gain mesuré, en unités par main, la variance qui l'écrase sur une session, et le nombre de mains qu'il faudrait pour que la moyenne l'emporte"
  },
  {
      "slug": "academie/compter-les-cartes-est-ce-legal",
      "fichier": "academie-compter-les-cartes-est-ce-legal.html",
      "lang": "fr",
      "type": "Article",
      "priorite": "0.8",
      "titre": "Compter les cartes est-il légal ? Ce que dit vraiment la loi",
      "court": "Est-ce légal ?",
      "desc": "Oui, compter les cartes est légal : c'est de la mémoire, pas un appareil. Mais un casino privé peut vous refuser sa table. Les textes, sources à l'appui.",
      "publie": "2026-09-09",
      "modifie": "2026-09-09",
      "fil": [
          [
              "Accueil",
              "/"
          ],
          [
              "L'Académie",
              "/academie/"
          ]
      ],
      "section": "academie",
      "faq": [
        {
            "q": "Compter les cartes peut-il me valoir une condamnation ?",
            "r": "Non, pas pour le comptage lui-même. Retenir de tête les cartes déjà distribuées devant vous n'est une infraction dans aucun des textes consultés pour cette page, au Nevada comme au Royaume-Uni comme en France. Une condamnation ne devient possible que si vous y ajoutez un appareil, une carte marquée ou une entente avec un employé."
        },
        {
            "q": "Un casino a-t-il le droit de m'interdire le blackjack ?",
            "r": "Oui, presque partout. Au Nevada, la loi précise qu'elle ne restreint pas le droit d'un établissement de jeu d'exclure quiconque ou de l'expulser des lieux. En France, l'article 24 de l'arrêté du 14 mai 2007 permet à la direction de refuser l'accès à toute personne qu'elle estime susceptible de troubler l'ordre, la tranquillité ou la régularité des jeux. L'exception est Atlantic City, où la Cour suprême du New Jersey a jugé en 1982 que seul le régulateur pouvait exclure un compteur."
        },
        {
            "q": "Puis-je compter avec une application sur mon téléphone ?",
            "r": "Non, et c'est là que le droit pénal apparaît. Au Nevada, NRS 465.075 interdit d'utiliser ou de détenir dans l'intention d'utiliser tout dispositif électronique ou logiciel conçu pour obtenir un avantage au jeu, en citant nommément l'appareil qui tient le compte des cartes jouées. La première infraction est une category C felony, passible d'un à cinq ans de prison et d'une amende pouvant atteindre 10 000 dollars."
        },
        {
            "q": "Compter les cartes est-il légal en France ?",
            "r": "Je n'ai trouvé aucune disposition française qui l'interdise. L'arrêté du 14 mai 2007, qui réglemente le blackjack jusqu'à la position de la carte d'arrêt, ne dit rien du comptage, de la mémorisation ni du suivi du sabot. Cela ne prouve pas qu'aucun texte n'existe, et cette page n'est pas un conseil juridique. Le casino, lui, peut vous refuser l'accès sans autre motif que le trouble supposé à la régularité des jeux."
        },
        {
            "q": "Que se passe-t-il concrètement si un casino me repère ?",
            "r": "Rien de spectaculaire, dans l'immense majorité des cas : on mélange le sabot plus souvent, on limite votre mise, puis un responsable vient vous dire que le blackjack ne vous est plus proposé. C'est une décision commerciale, sans suite judiciaire tant que vous partez quand on vous le demande."
        }
    ],
    "sous": "ce que dit la loi, ce qu'un casino a le droit de faire malgré elle, et où passe exactement la ligne entre compter et tricher"
  },
  {
      "slug": "histoire-du-blackjack",
      "fichier": "histoire-du-blackjack.html",
      "lang": "fr",
      "type": "Article",
      "priorite": "0.7",
      "titre": "Histoire du blackjack : des origines à l'invention du comptage",
      "court": "L'histoire du blackjack",
      "desc": "L'histoire du blackjack, de la veintiuna espagnole au 6:5 moderne : les dates et les noms vérifiés, et qui a réellement inventé le comptage des cartes.",
      "publie": "2026-09-09",
      "modifie": "2026-09-09",
      "fil": [
          [
              "Accueil",
              "/"
          ]
      ],
      "faq": [
        {
            "q": "Qui a inventé le comptage des cartes ?",
            "r": "Edward O. Thorp. Il n'est pas le premier à avoir eu l'intuition qu'un sabot entamé change les probabilités, mais il est le premier à l'avoir démontré et publié : dans un article des Proceedings of the National Academy of Sciences en 1961, puis dans le livre « Beat the Dealer » en 1962. Ses calculs ont été menés sur un IBM 704 pendant qu'il enseignait au Massachusetts Institute of Technology."
        },
        {
            "q": "En quelle année le blackjack a-t-il été inventé ?",
            "r": "Aucune année ne convient, parce que le jeu n'a pas été inventé mais transformé. Son ancêtre espagnol, la veintiuna, est décrit par Cervantes dans une nouvelle antérieure à 1605 et publiée en 1613. Le vingt-et-un français apparaît au XVIIIe siècle, avec des datations qui varient selon les historiens. Le nom de blackjack s'impose aux États-Unis au tournant du XXe siècle, et la stratégie de base n'est calculée qu'en 1956."
        },
        {
            "q": "Pourquoi le jeu s'appelle-t-il blackjack ?",
            "r": "L'explication répétée partout est qu'une maison de jeu américaine aurait payé une prime pour une main formée de l'as de pique et d'un valet noir. Aucun document ne l'atteste : l'historien des jeux David Parlett relève que personne n'en a jamais produit la moindre preuve écrite. L'historien des cartes à jouer Thierry Depaulis propose une autre piste, celle des chercheurs d'or du Klondike, chez qui blackjack désignait aussi un minerai associé aux filons."
        },
        {
            "q": "Les casinos ont-ils réussi à empêcher le comptage des cartes ?",
            "r": "Pas par la surveillance, mais par le règlement. Les fichiers de compteurs et la reconnaissance faciale ont produit peu de résultats et beaucoup de litiges, tandis que deux modifications discrètes ont suffi : la mélangeuse continue, qui supprime l'information sur laquelle repose le comptage, et le paiement du blackjack à 6:5, qui ajoute environ 1,4 point d'avantage à la maison. Sur les deux tables de WiseHand qui paient 6:5, l'avantage maison mesuré atteint 1,850 % et 2,073 %."
        },
        {
            "q": "Ken Uston a-t-il gagné son procès contre les casinos ?",
            "r": "Oui, et cela n'a pas changé grand-chose. Le 5 mai 1982, la Cour suprême du New Jersey a jugé qu'un casino d'Atlantic City ne pouvait pas écarter un joueur au motif qu'il compte les cartes, ce pouvoir appartenant à la seule commission de contrôle des jeux. Celle-ci a aussitôt laissé les casinos se défendre autrement, en mélangeant plus souvent et en ajoutant des jeux au sabot. Dans le Nevada, où cette décision ne s'applique pas, un casino reste libre de refuser un joueur."
        }
    ]
  },
  {
      "slug": "films-comptage-de-cartes",
      "fichier": "films-comptage-de-cartes.html",
      "lang": "fr",
      "type": "Article",
      "priorite": "0.7",
      "titre": "Les films sur le comptage des cartes : le vrai du faux",
      "court": "Les films",
      "desc": "Rain Man, Las Vegas 21, Very Bad Trip : pour chaque film, ce qu'il montre du comptage des cartes et ce qui est vrai, confronté à des chiffres mesurés.",
      "publie": "2026-09-09",
      "modifie": "2026-09-09",
      "fil": [
          [
              "Accueil",
              "/"
          ]
      ],
      "faq": [
        {
            "q": "Quel est le film le plus réaliste sur le comptage des cartes ?",
            "r": "Ce n'est pas une fiction mais un documentaire : Holy Rollers: The True Story of Card Counting Christians , réalisé par Bryan Storkel en 2011, est le seul titre courant qui montre le comptage tel qu'il se pratique — les entraînements, la caisse commune, les exclusions de casino, et de longues heures sans rien d'autre à faire qu'additionner. Parmi les fictions, The Last Casino (2004) est plus sobre que Las Vegas 21 , dont il partage la matière première."
        },
        {
            "q": "Le comptage des cartes est-il illégal, comme le suggère Very Bad Trip ?",
            "r": "Compter les cartes de tête est légal : c'est de l'observation et du calcul mental, et aucune loi ne l'interdit. Ce qu'un casino peut faire ensuite dépend de l'endroit. Dans le Nevada, un établissement privé peut écarter un joueur qu'il soupçonne de compter, et c'est ce que montrent correctement Rain Man et Las Vegas 21 . À Atlantic City, non : la Cour suprême du New Jersey l'a interdit le 5 mai 1982, dans l'arrêt Uston contre Resorts International , en jugeant que seule la commission de contrôle des casinos pouvait décider d'exclure un joueur habile. Utiliser un appareil, marquer des cartes ou s'entendre avec un croupier est en revanche un délit, et n'a rien à voir avec le comptage."
        },
        {
            "q": "Las Vegas 21 raconte-t-il une histoire vraie ?",
            "r": "En partie seulement. L'équipe de blackjack du MIT a existé et a fonctionné par intermittence de 1979 au début des années 2000, et l'organisation en spotters et big player montrée dans le film est exacte. Mais le Boston Globe a jugé que le livre de Ben Mezrich dont le film est tiré n'était pas un ouvrage de non-fiction en un sens utile du terme, et Jeff Ma, le compteur qui a inspiré le personnage principal et conseillé la production, a déclaré qu'un seul personnage du livre correspondait à une personne réelle et que des ressorts entiers du scénario étaient inventés."
        },
        {
            "q": "Faut-il une mémoire d'exception, comme Raymond dans Rain Man, pour compter les cartes ?",
            "r": "Non, et c'est l'erreur que ce film a le plus répandue. Le système Hi-Lo ne demande de retenir qu'un seul nombre : on ajoute +1 pour chaque carte de 2 à 6, 0 pour les 7, 8 et 9, et −1 pour chaque 10, figure ou as. Le comptage est à la portée de quiconque sait compter jusqu'à vingt ; c'est le tenir sans se tromper pendant des heures, puis le diviser par les jeux restants, qui est difficile."
        },
        {
            "q": "Peut-on gagner 80 000 dollars en une soirée, comme dans les films ?",
            "r": "Pas par le comptage. Sur la table de référence de WiseHand, à six jeux avec blackjack payé 3:2, un comptage parfait rapporte environ 0,008 unité par main, soit huit centimes par main pour une unité à dix euros. Un gain de plusieurs dizaines de milliers de dollars en une session relève de la chance, exactement comme une perte du même ordre : c'est de la variance, pas une méthode."
        }
    ]
  }
];

// L'ORDRE DU COURS. Il pilote « leçon précédente / suivante », le sommaire et la charge
// de travail déclarée. Le premier élément est le sommaire lui-même : il n'a pas de
// « précédent », et il n'est pas compté dans la durée du cours.
export const ORDRE_ACADEMIE = [
  "academie",
  "academie/valeurs-des-cartes-hi-lo",
  "academie/compte-vrai",
  "academie/penetration-du-sabot",
  "academie/assurance",
  "academie/illustrious-18",
  "academie/blackjack-6-5",
  "academie/s17-h17",
  "academie/melangeuse-continue",
  "academie/combien-rapporte-le-comptage",
  "academie/compter-les-cartes-est-ce-legal",
];
