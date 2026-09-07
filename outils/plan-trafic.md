# Amener du monde sur wisehand21.com — le plan, sans promesse

Ce document ne contient **aucun code**. C'est la liste de ce que **Léo** doit faire
lui-même, dans l'ordre, avec les clics exacts. Le code (robots.txt, sitemap, page
d'article, version anglaise) est traité ailleurs ; ici on parle de ce qu'aucun
fichier ne peut faire à ta place.

Tout ce qui est chiffré vient soit du dépôt (fichier + ligne), soit d'une source
citée en bas. Quand je ne sais pas, je l'écris.

---

## Les deux choses honnêtes à savoir avant de commencer

### 1. « Apparaître premier sur "comment jouer au blackjack" » — non.

Ce n'est pas de la modestie, c'est de l'arithmétique. Cette requête est tenue par
des sites de casino et d'affiliation qui ont dix ans d'ancienneté, des centaines
de liens, et un budget publicitaire. Le domaine `wisehand21.com` a été acheté le
07/09/2026 : il a **zéro** lien entrant, zéro historique, zéro autorité.

Google le dit lui-même par la voix de John Mueller : l'ancienneté du domaine n'est
pas un facteur de classement en soi, mais les vieux domaines ont accumulé les liens
et la confiance qui, eux, en sont. Les délais couramment observés pour un domaine
neuf sur des requêtes concurrentielles sont de **6 à 12 mois**, et 12 à 24 mois sur
les termes les plus disputés.

Et surtout : **ce n'est pas la requête qu'on veut.** Celui qui tape « comment jouer
au blackjack » veut les règles du jeu en trois minutes. WiseHand n'est pas ça —
c'est un entraîneur de comptage. Le visiteur arriverait, ne trouverait pas ce
qu'il cherche, repartirait. Un mauvais visiteur en première position ne vaut rien.

Ce qui est **réellement gagnable en 3 à 6 mois**, c'est la longue traîne : quinze
requêtes précises listées plus bas, sur lesquelles ton application est
objectivement meilleure que tout ce qui existe, parce qu'elle **calcule** au lieu
de recopier.

### 2. On n'achète pas de liens. Jamais. Et voici pourquoi c'est pire pour toi.

Google appelle ça le *link spam* : « créer des liens vers ou depuis un site dans le
but principal de manipuler le classement ». Acheter des liens en est l'exemple
numéro un. La sanction s'appelle une **action manuelle** : un humain chez Google
regarde ton site, le déclasse, et il faut ensuite déposer une *demande de
réexamen* pour espérer sortir.

Sur un site établi, une action manuelle fait mal mais se plaide : il y a un
historique, du trafic légitime, des années de bonne conduite à montrer. Sur un
domaine acheté **hier**, il n'y a rien à montrer. Le profil ressemble exactement à
celui d'un site fait pour spammer — jeune, sans historique, avec des liens payés
apparus d'un coup. La décision la moins coûteuse pour Google est de le laisser
enterré. Tu n'aurais aucun argument, parce que factuellement tu aurais fait
exactement ce dont on t'accuserait.

Le domaine coûte **11,08 $ par an** (chiffre écrit dans l'application elle-même,
`src/app/corps.html`). Le racheter n'est pas le problème : ce que tu perdrais,
c'est le nom, et tous les liens honnêtes accumulés d'ici là. Le jeu n'en vaut
absolument pas la chandelle.

---

## Étape 0 — Trois choses cassées dans le dépôt, à réparer avant de communiquer

Vérifiées ligne par ligne aujourd'hui. Ce sont des fuites de trafic, pas des
détails.

### a) Le README envoie tout le monde sur l'ancienne adresse

`README.md`, ligne 7 :

```
**→ [Jouer en ligne](https://pwrygrt72g-hue.github.io/compteur-hilo/)**
```

Le dépôt GitHub est la première page que verront les gens à qui tu parleras du
projet (Hacker News, Reddit, listes GitHub). Ce bouton, aujourd'hui, envoie les
visiteurs **et les robots** sur `pwrygrt72g-hue.github.io`, pas sur
`wisehand21.com`. Tous les liens que tu vas gagner pointeront donc vers la
mauvaise adresse.

> ⚠️ **À vérifier toi-même, je n'ai pas pu :** je ne sais pas si GitHub Pages
> redirige automatiquement `pwrygrt72g-hue.github.io/compteur-hilo/` vers ton
> domaine. La documentation GitHub décrit les redirections entre l'apex et le
> `www`, mais **ne dit rien** sur la redirection depuis le domaine par défaut.
> Ne me crois pas sur parole, mesure-le. Dans un terminal :
>
> ```
> curl -sI https://pwrygrt72g-hue.github.io/compteur-hilo/ | head -5
> ```
>
> Si tu lis `HTTP/2 301` et une ligne `location: https://wisehand21.com/`, tout va
> bien. Si tu lis `HTTP/2 200`, alors **les deux adresses servent la même page** :
> c'est du contenu dupliqué, et Google devra deviner laquelle est la vraie. Dans
> ce cas il faut une balise `<link rel="canonical">` vers `https://wisehand21.com/`
> (c'est du code — à confier à l'autre chantier).

**Ce que tu fais dans les deux cas** : tu corriges le lien du README pour qu'il
pointe sur `https://wisehand21.com/`. Une ligne.

### b) Ton site publie un double complet de sa page d'accueil

`artefact.html` fait **2 245 171 octets** et il est suivi par git — donc publié.
Il est accessible en ce moment même à `https://wisehand21.com/artefact.html`. Or
`build.mjs` le décrit lui-même comme « le même corps SANS doctype ni `<head>` » :
c'est la version destinée à l'outil Artifact, pas au web. Pour Google, c'est une
deuxième page qui dit la même chose que la première, sans titre ni description :
le cas d'école du contenu dupliqué.

✅ **Déjà traité par le chantier code** : le `robots.txt` qui vient d'apparaître
dans le dépôt porte bien `Disallow: /artefact.html`. Rien à faire de ton côté,
sinon vérifier après déploiement que la ligne y est toujours.

### c) Le banc d'essai est en ligne

`outils/relais-banc.html` et `outils/visio-banc.html` sont eux aussi publiés. Ce
sont des pages d'outillage interne : deux bancs d'essai pour la vidéo. Elles
n'aident personne à trouver quoi que ce soit et elles diluent la qualité moyenne
du domaine.

⚠️ **Celle-là n'est PAS traitée.** Le `robots.txt` du dépôt interdit bien
`/artefact.html`, mais **pas `/outils/`**. Il manque une ligne :

```
Disallow: /outils/
```

Demande-la au chantier code, ou ajoute-la toi-même — c'est une ligne à coller
juste au-dessus du `Disallow: /artefact.html` existant.

*(C'est aussi la raison pour laquelle ce document est rangé dans `outils/` :
une fois `/outils/` interdit aux robots, ton plan de trafic n'est plus une page
indexable de ton propre site. Tant que la ligne n'est pas là, il l'est —
`.nojekyll` vient d'être ajouté au dépôt, donc GitHub Pages sert désormais les
fichiers tels quels, ce `.md` compris.)*

### d) Et le vrai plafond, qu'il faut regarder en face

J'ai mesuré le texte réellement lisible dans `index.html`, hors `<script>` et
hors `<style>` :

| | |
|---|---|
| Taille de `index.html` | 1 114 210 octets |
| Texte HTML indexable | **2 068 mots** |
| Leçons et descriptions des dix tables | **~543 mots, tous enfermés dans le `<script>`** |

Autrement dit : la matière qui ferait la différence — « le blackjack payé 6:5
repousse ton point d'équilibre bien au-delà de ce que le compte atteint jamais »,
« la mélangeuse continue tue le comptage, pas les règles », les dix avantages
maison **mesurés sur trois millions de mains** (`build.mjs`, ligne 14) — n'existe
pas dans le HTML. Elle vit dans un objet JavaScript, dans une section masquée
derrière la navigation.

Google exécute le JavaScript, donc il *peut* finir par la voir. Mais une page
unique d'application, avec 2 000 mots de menus et de réglages, n'a presque rien à
classer. **Sans les pages de contenu du chantier code, ce plan de trafic
plafonnera très bas, quoi que tu fasses par ailleurs.** Les deux moitiés ne
fonctionnent qu'ensemble.

---

## Étape 1 — Google Search Console (30 minutes, à faire aujourd'hui)

Sans ça tu es aveugle : tu ne sauras pas si Google a seulement vu ton site.

### Les clics, dans l'ordre

1. Va sur **`search.google.com/search-console`**, connecte-toi avec ton compte
   Google.
2. En haut à gauche, menu déroulant des propriétés → **« Ajouter une propriété »**.
3. Deux colonnes s'affichent. Prends celle de **gauche : « Domaine »** (pas
   « Préfixe d'URL »). Elle couvre `wisehand21.com`, `www.wisehand21.com`, http et
   https d'un coup. Tape `wisehand21.com` — sans `https://`, sans `www`.
4. Google affiche un texte qui commence par **`google-site-verification=`**.
   Copie-le **en entier**, tel quel.
5. Ouvre un autre onglet sur **Porkbun** → **Domain Management** → ton domaine →
   bouton **« Details »** → l'icône crayon à côté de **« DNS Records »**.
6. Ajoute l'enregistrement :
   - **Type** : `TXT`
   - **Host** : **laisser VIDE** (c'est le point où tout le monde se trompe — ni
     `@`, ni `wisehand21.com`, ni rien)
   - **Answer / Value** : la chaîne `google-site-verification=...` collée sans
     guillemets autour
   - **TTL** : laisse la valeur par défaut
7. Clique **« Add »**.
8. Retourne dans Search Console, clique **« Valider »**.

> Si ça échoue du premier coup, **attends cinq à dix minutes et recommence** :
> c'est le DNS qui n'a pas fini de se propager, pas une erreur de ta part.
> Porkbun le dit dans sa propre documentation.

> **Ça ne casse rien.** Tu viens d'ajouter neuf enregistrements — c'est exactement
> le compte d'une configuration GitHub Pages sur domaine racine (4 `A` + 4 `AAAA`
> pour l'apex, 1 `CNAME` pour le `www`). Le `TXT` sera le dixième. Un
> enregistrement TXT ne dit à personne où est le site : il ne fait que porter une
> preuve de propriété. Il **s'ajoute**, il ne remplace rien.

### Une fois validé, trois choses à faire tout de suite

- **Sitemaps** (menu de gauche) → entrer `sitemap.xml` → **Envoyer**.
  *(À faire seulement une fois que le fichier existe — c'est le chantier code.
  S'il n'existe pas encore, reviens ici après le déploiement.)*
- **Inspection de l'URL** (barre du haut) → colle `https://wisehand21.com/` →
  **« Demander une indexation »**. Fais-le pour la page d'accueil, la page
  d'article et la page anglaise dès qu'elles existent.
  ⚠️ Le quota quotidien est limité et Google ne publie pas le chiffre exact.
  Compte quelques URL par jour, pas cinquante. Et ce bouton **accélère la visite,
  il ne garantit pas le classement**.
- Note la date. C'est ton point zéro : tout ce que tu liras ensuite se compte à
  partir de là.

## Étape 2 — Bing Webmaster Tools (5 minutes, juste après)

Bing représente une part de recherche bien plus petite que Google, mais c'est
cinq minutes, et **ChatGPT s'appuie sur l'index de Bing** — donc pour le « GEO »
(être cité par les IA), c'est la porte d'entrée.

1. **`bing.com/webmasters`** → se connecter (compte Microsoft, ou Google).
2. Choisir **« Importer depuis Google Search Console »**.
3. Autoriser Bing à lire tes propriétés, cocher `wisehand21.com`, **Importer**.

Les sites importés sont **vérifiés automatiquement** : pas de deuxième
enregistrement DNS à poser. Les données de trafic mettent jusqu'à **48 heures** à
apparaître.

⚠️ Bing revalide périodiquement la propriété en se synchronisant avec ton compte
Google. Si tu retires un jour l'accès, il faudra revérifier autrement. Pas
grave, mais sache-le.

---

## Étape 3 — Les liens. Ce qui est légitime, ce qui te brûle.

### La règle, en une phrase

Un lien est légitime quand **quelqu'un d'autre décide de le poser** parce que la
chose lui a plu. Il est illégitime quand **tu obtiens sa pose** — en payant, en
échangeant, ou en le collant toi-même là où personne ne t'a rien demandé.

Ton projet a de vrais atouts pour la première catégorie, et il faut les mettre en
avant à chaque fois, parce que ce sont eux qui font qu'on te répond au lieu de
te supprimer :

- **gratuit, sans publicité, sans compte, sans donnée revendue** ;
- **code ouvert sous MIT** ;
- **rien n'est recopié** : la stratégie de base sort d'un solveur, les écarts
  d'une recherche par dichotomie, l'avantage maison de trois millions de mains
  simulées ;
- **le hasard est vérifiable** : l'empreinte de la graine est publiée avant la
  première carte, la graine est révélée à la carte de coupe, et le bouton « Le
  reçu du sabot » recopie un vérificateur de vingt lignes à coller dans n'importe
  quelle console ;
- **`node src/regles.test.mjs` compare le tout à des références publiées** — 78
  vérifications.

C'est *ça* ton argument, pas « venez essayer mon site ».

### 🚨 Wikipédia : NON. Ce point du brief est une erreur.

On m'a suggéré Wikipédia comme piste. **Il faut l'écarter, pour trois raisons
cumulées :**

1. **Tous les liens externes de Wikipédia sont en `nofollow`.** La valeur SEO
   directe est donc **exactement zéro**. C'est écrit dans leur documentation.
2. **Ajouter un lien vers son propre site est un conflit d'intérêts** (`WP:COI`).
   Les liens « destinés principalement à promouvoir un site » sont explicitement
   dans la liste des liens à éviter.
3. **Le risque est asymétrique.** Wikipédia tient une *liste noire de spam* qui
   bloque un domaine sur l'ensemble des projets Wikimedia. Et les demandes de
   retrait de cette liste « ne sont que rarement examinées quand elles émanent
   d'un contributeur en conflit d'intérêts ». Tu risquerais donc de faire
   blacklister `wisehand21.com` **pour un lien qui ne t'aurait rien rapporté**.

Le seul chemin acceptable : si un jour quelqu'un d'autre, sans lien avec toi,
juge le projet digne d'être cité — tant mieux. Tu ne le provoques pas.

### Les endroits qui, eux, ont du sens

Classés par ce que ça t'apporte réellement. Pour chacun : la règle, et ce qui
fait supprimer un message.

> ⚠️ **Vérifie chaque site avant de poster.** Les communautés meurent, les règles
> changent, et je liste ici ce qui existait au moment où j'écris. Lis la page
> « règles » de chaque endroit **avant** ton premier message, pas après.

#### 1. Hacker News — « Show HN »

**Ce que ça vaut** : de loin le plus gros coup possible en une journée si ça
prend, et les gens qui y passent écrivent des blogs — ce sont eux qui posent les
liens durables ensuite.

**Les règles, mot pour mot :**
- *« Show HN is for something you've made that other people can play with »* —
  ton cas exact. Une application qu'on ouvre et qu'on essaie.
- **Lie directement la chose**, pas une page de présentation. Donc
  `https://wisehand21.com/`, pas un article.
- *« Please don't ask friends to upvote or comment. That's not ok on HN. »*
- Ne republie pas après un échec : c'est mal vu et ça a l'air manipulateur.
- Titre plat : `Show HN: WiseHand – a blackjack card-counting trainer that
  computes its own strategy tables`. Pas d'adjectif publicitaire, pas de point
  d'exclamation.
- **Reste dans le fil toute la journée** pour répondre. C'est la moitié du travail.

**Ce qui te fait bannir** : demander des votes à des amis. La sanction s'attache
**au domaine**, pas seulement au compte — elle te suivrait sur toutes tes
tentatives futures. C'est le pire rapport risque/bénéfice de toute cette liste.

#### 2. Reddit

**Ce que ça vaut** : du trafic ciblé immédiat, et des gens qui reviennent.

**La règle universelle : le 9 pour 1.** Pour un message qui parle de ton projet,
neuf contributions qui n'en parlent pas. Reddit ne nomme pas explicitement
l'« auto-promotion » dans sa politique, mais la traite via le *spam* — défini
comme des « actions répétées, non désirées ou non sollicitées ».

**Ce qui te fait supprimer, puis bannir :**
- poster ton lien comme **première action** d'un compte neuf ;
- poster le **même lien dans plusieurs subreddits le même jour** → shadowban, tes
  messages deviennent invisibles **sans qu'on te prévienne** ;
- ignorer la règle locale : une étude de 2026 a trouvé que **61 %** des
  subreddits où les fondateurs se présentent **interdisent purement** l'auto-
  promotion. Certains ne l'autorisent que dans un fil hebdomadaire dédié.

**Où** : commence par `r/blackjack`. Passe deux semaines à y répondre à des
questions de stratégie — tu en es capable, tu as un solveur. **Ensuite** seulement
tu montres l'outil, dans un message qui répond à une question réelle.

Ensuite, à explorer (vérifie l'existence, les règles et la taille de chacun avant
d'y aller) : les communautés de projets personnels, d'open source, et le côté
francophone. **Un subreddit à la fois, espacé de plusieurs jours.**

#### 3. Les forums de blackjack — le meilleur public, et le plus exigeant

Ce sont les gens pour qui l'application est faite. Ils sont peu nombreux mais ils
écrivent, et ils lient.

- **Wizard of Vegas** (`wizardofvegas.com/forum`) — forum généraliste casino avec
  une section blackjack active, où le comptage se discute ouvertement.
- **Blackjack Apprenticeship** — la communauté de Colin Jones, joueurs sérieux :
  stratégies avancées, gestion de caisse, conditions de jeu en casino.
- **Two Plus Two** — section blackjack, fréquentée par des joueurs expérimentés et
  des mathématiciens.
- **BlackjackInfo** — le site du moteur de stratégie de base historique.

**La règle** : ces gens détestent qu'on leur vende quelque chose, et ils vont
**contester tes chiffres**. C'est une chance, pas un risque : tu es le seul à
pouvoir répondre « voilà la méthode, voilà le fichier, lancez le test vous-même ».
Présente-toi, participe à trois ou quatre discussions, puis publie dans la
section « outils » ou l'équivalent — pas en message d'ouverture.

**Ce qui te fait supprimer** : un premier message qui est un lien. Partout.

#### 4. Product Hunt

Un lancement, une fois. Il faut un compte « maker », et c'est mieux avec un
*hunter*. **Le lien sortant est en `nofollow`** : la valeur n'est pas dans le lien
mais dans le trafic du jour et les reprises éventuelles. À faire quand le site est
prêt — on ne lance qu'une fois.

#### 5. Les listes GitHub (« awesome-lists »)

Cherche sur GitHub `awesome blackjack`, `awesome open source games`, `awesome
no-backend`, `awesome pwa`. Pour chaque liste trouvée : **lis son
`CONTRIBUTING.md` avant d'ouvrir la moindre pull request**, respecte le format à
la virgule près, **une entrée par PR**.

**Ce qui fait refuser une PR** : ne pas suivre le format, ajouter plusieurs
entrées d'un coup, ou proposer son propre projet là où la liste l'interdit
explicitement — certaines le font.

#### 6. Les annuaires d'outils

- **AlternativeTo** — accepte les outils gratuits, gros trafic.
- **Free Software Directory** (FSF) — ton code est sous MIT, il y a sa place.

Fiche honnête, pas d'exagération. Une fiche promotionnelle se fait modérer.

#### 7. Le francophone — ton public premier, et le moins concurrentiel

L'application est **entièrement en français** (`<html lang="fr">`). C'est ton plus
gros avantage : la concurrence française sur le comptage de cartes est bien plus
faible que l'anglaise.

- **Le Journal du Hacker** (`journalduhacker.net`) — agrégateur communautaire
  francophone (logiciel libre, technologies), actif depuis 2014. Fonctionnement
  proche de Hacker News : tu proposes un lien, la communauté vote.
- **Framalibre** (`framalibre.org`) — l'annuaire du libre francophone, porté par
  Framasoft. Collaboratif : tu crées un compte et tu rédiges une notice.
- **LinuxFr.org** — journaux et dépêches, public francophone technique.

**Ce qui fait supprimer** : le ton publicitaire. Sur ces sites on décrit ce qu'on
a fait et comment, on ne vend pas.

#### 8. Écrire toi-même, ailleurs

Un article technique sur **dev.to** ou ton propre blog — pas « découvrez mon
site », mais *« comment j'ai calculé la stratégie de base au lieu de la recopier »*
ou *« publier l'empreinte du sabot avant la première carte »*. Ça, ça se lie tout
seul, et ça te met en position d'auteur plutôt que de vendeur.

---

## Étape 4 — Les quinze requêtes réellement gagnables

> ⚠️ **Je ne peux pas te donner de volumes de recherche** : je n'ai pas d'outil
> pour les mesurer, et j'aime mieux te le dire que d'inventer des chiffres.
> Ce que je peux justifier, c'est **pourquoi chacune est accessible** — et ça
> repose sur trois critères vérifiables : l'intention est *informationnelle* (pas
> commerciale, donc les affiliés de casino ne se battent pas dessus), la requête
> est assez précise pour que peu de pages la visent exactement, et **ton
> application répond déjà à la question avec des données qu'elle a calculées.**

| # | Requête | Pourquoi elle est accessible |
|---|---|---|
| 1 | `compte vrai blackjack calcul` | Question technique pure. Zéro intention d'achat. Ton exercice « Estimation » existe précisément pour ça. |
| 2 | `hi-lo blackjack tableau valeurs des cartes` | Requête de référence, courte à satisfaire. Ton application implémente Hi-Lo, KO, Hi-Opt I et Omega II. |
| 3 | `blackjack 6:5 pourquoi éviter` | **C'est littéralement la leçon du Néon et de L'Aquarium.** Tu as le chiffre mesuré : 1,85 % et 2,07 % d'avantage maison. Personne d'autre ne le montre côte à côte. |
| 4 | `stratégie de base blackjack 6 jeux H17 tableau` | Très précise. Ton solveur produit exactement cette grille-là, pour ces règles-là. |
| 5 | `différence S17 H17 blackjack` | Question de règle, sans concurrence commerciale. Tu as les deux dans le catalogue. |
| 6 | `mélangeuse continue blackjack comptage` | Leçon du Cotai, mot pour mot : « la mélangeuse tue le comptage, pas les règles ». Sujet mal traité ailleurs. |
| 7 | `pénétration sabot blackjack définition` | Terme de niche. Leçon du Salon Privé : la coupe à 85 % contre 75 %. |
| 8 | `illustrious 18 liste écarts` | Ton application **retrouve les dix-sept premiers par calcul**. Argument imbattable face aux pages qui recopient un tableau. |
| 9 | `assurance blackjack quand la prendre` | Ton solveur trouve le seuil à +3 exactement. Réponse chiffrée, pas une opinion. |
| 10 | `compter les cartes est-ce légal` | Grosse question, mais informationnelle. À traiter avec prudence et honnêteté — c'est aussi ta page la plus responsable. |
| 11 | `exercice compter les cartes en ligne gratuit` | **Intention d'usage direct.** Le visiteur veut exactement ce que tu as. Le mot « gratuit » élimine la concurrence payante. |
| 12 | `blackjack européen sans carte cachée doubler` | Leçon du Cercle : tu perds aussi tes doublements. Très peu de pages françaises l'expliquent. |
| 13 | `estimer nombre de jeux défausse blackjack` | Ultra-spécifique, et tu as un exercice dédié. Presque personne ne vise ça. |
| 14 | `avantage maison blackjack selon les règles` | Tu as **dix tables mesurées**, de 0,38 % à 2,07 %. C'est une donnée, pas un avis. |
| 15 | `combien rapporte le comptage de cartes` | Question que tout le monde se pose. Ta réponse honnête — « quelques dixièmes de pour cent, sur des milliers de mains, sans jamais se tromper » — est meilleure que les promesses des autres. |

**Le fil rouge** : sur chacune de ces quinze, tu peux écrire une phrase que
personne d'autre ne peut écrire, parce qu'elle sort d'un calcul que tu as fait.
C'est ce qui fait la différence entre une page de plus et une page qui monte.

**Pour la version anglaise**, les mêmes en plus concurrentiel — vise le plus
spécifique : `blackjack 6:5 vs 3:2 house edge`, `true count conversion drill`,
`continuous shuffle machine card counting`, `deck penetration explained`,
`illustrious 18 calculated`. Attends-toi à des résultats plus lents qu'en
français : c'est le marché principal des affiliés américains.

---

## Étape 5 — Le calendrier honnête

Je ne te donnerai pas de nombre de visiteurs : je serais en train de l'inventer,
et tu le verrais bien assez tôt. Voici plutôt **ce qui est normal** et **ce qui
doit t'alerter**.

### Semaines 1 à 2
- **Ce qui se passe** : Google découvre le site. Search Console commence à
  afficher des pages indexées.
- **Ton trafic** : celui que tu envoies toi-même. Rien d'autre.
- **Normal** : quelques pages seulement indexées.
- **Anormal** : zéro page indexée après dix jours alors que tu as demandé
  l'indexation → regarde la couverture dans Search Console, quelque chose bloque.

### Mois 1
- **Ce qui se passe** : les premières **impressions** apparaissent (le nombre de
  fois où tu es apparu dans une page de résultats), pour des positions
  généralement profondes — au-delà de la 30ᵉ. C'est normal et ça ne veut pas dire
  que c'est raté.
- **Ce qui compte** : regarde **quelles** requêtes remontent. Elles ne seront pas
  celles que tu as prévues. **Ce sont elles qui te disent quoi écrire ensuite.**
- **Ton trafic** : essentiellement les pics de tes propres publications (Reddit,
  forums), qui retombent en 48 h. C'est attendu.

### Mois 3
- **Ce qui se passe** : si les pages de contenu existent et si trois ou quatre
  liens honnêtes sont arrivés, les premières longues traînes atteignent la
  deuxième ou la troisième page.
- **Ton trafic** : une base organique commence à exister — faible, mais elle ne
  retombe plus à zéro entre deux publications. C'est le signal qui compte,
  beaucoup plus que le volume.
- **Anormal** : toujours aucune impression sur aucune des quinze requêtes → soit
  les pages de contenu n'existent pas, soit elles ne parlent pas de ces sujets.

### Mois 6
- **Ce qui se passe** : quelques requêtes de la liste sur la première page, **si**
  les pages existent depuis plusieurs mois et si des liens réels sont arrivés.
  Rappel de l'ordre de grandeur : 6 à 12 mois pour un domaine parti de zéro.
- **Ce qui ne se passera pas** : « comment jouer au blackjack ». Ni en 6 mois, ni
  en 12.
- **Le vrai gain de cette période** : les visiteurs qui reviennent. Une
  application d'entraînement se garde ; un article de blog se lit une fois.

### Le point le plus important de toute cette page

**Si tu ne publies aucune page de contenu, la courbe reste plate indéfiniment.**
Une application d'une seule page avec 2 068 mots de menus ne peut se classer sur
rien. Aucune démarche de cette liste ne compense ça — ni Search Console, ni les
forums, ni les liens. Les deux moitiés du chantier ne valent qu'ensemble.

---

## Étape 6 — Ce qu'il ne faut jamais faire

| Tentation | Pourquoi c'est non |
|---|---|
| **Acheter des liens** | Exemple explicite de *link spam* chez Google. Sur un domaine de quelques semaines, le profil est indéfendable en demande de réexamen. |
| **Échanger des liens** (« je mets le tien, tu mets le mien ») | Même politique : des liens créés dans le but principal de manipuler le classement. Un motif d'échange se repère mécaniquement. |
| **Créer des blogs satellites qui pointent vers toi** | C'est la définition d'un réseau de liens. Détectable, et ça condamne le domaine, pas seulement les satellites. |
| **Demander des votes sur Hacker News** | Interdit textuellement. La pénalité **s'attache au domaine** et taxe toutes tes tentatives futures, pendant des années. |
| **Poster le même lien dans dix subreddits** | Shadowban : tes messages deviennent invisibles **sans notification**. Tu continues à poster dans le vide sans le savoir. |
| **Générer cinquante pages d'articles d'un coup** | Google sanctionne le contenu produit en masse à seule fin de classement. Trois pages excellentes valent mieux que cinquante creuses. |
| **Bourrer les mots-clés** | Ne marche plus depuis quinze ans, et rend les pages illisibles — donc contre-productif même si ça marchait. |
| **Ajouter ton lien sur Wikipédia** | `nofollow` (valeur nulle) + conflit d'intérêts + risque de liste noire à l'échelle de tout Wikimedia. |
| **Promettre de gagner de l'argent** | Malhonnête *et* pénalisé. Ta propre application dit le contraire : « compter ne rend pas le blackjack gagnant ». C'est cette phrase-là qui te distingue. |

### Et la responsabilité, qui n'est pas négociable

Le blackjack est un jeu d'argent. Chaque page publique que tu ajoutes doit porter
la même exigence que l'application, qui affiche déjà, en toutes lettres :

> « Compter ne rend pas le blackjack gagnant — ça retire quelques dixièmes de
> pour cent à la maison, sur des milliers de mains, à condition de ne jamais se
> tromper. »
>
> « Si le jeu a cessé d'être un jeu : **Joueurs Info Service, 09 74 75 13 13** —
> anonyme et non surtaxé, tous les jours de 8 h à 2 h. »
>
> — `src/app/corps.html`

Ce n'est pas seulement une question d'éthique : une page qui promet de gagner de
l'argent au casino entre dans la catégorie la plus surveillée de Google (celle
qui touche à l'argent et à la santé). Elle sera jugée bien plus sévèrement qu'une
page qui explique honnêtement pourquoi quatre des dix tables sont imbattables.

**Ton honnêteté est ton meilleur atout de référencement.** Ce n'est pas un slogan :
c'est la seule chose que les sites d'affiliation ne peuvent pas copier.

---

## Le tableau de bord — quoi regarder, et à quel rythme

**Une fois par semaine, dix minutes**, dans Search Console → *Performances* :

1. **Requêtes** : lesquelles remontent ? Note celles que tu n'avais pas prévues —
   ce sont tes prochaines pages.
2. **Pages** : laquelle attire ? Si c'est une seule, écris-en une deuxième sur le
   même sujet.
3. **Position moyenne** : ne regarde pas le chiffre absolu, regarde **la pente**.
   Passer de la 60ᵉ à la 35ᵉ place est un excellent mois, même à zéro clic.

**Une fois par mois**, dans *Indexation* → *Pages* : vérifie qu'aucune page utile
n'est exclue, et qu'`artefact.html` et `/outils/` **n'y sont pas**.

**Ce qu'il ne faut pas faire** : regarder tous les jours. Il ne se passe rien en
un jour, et tu prendrais des décisions sur du bruit.

---

## Sources

Les affirmations chiffrées ou réglementaires de ce document viennent de :

- [Règles concernant le spam pour la recherche Google — Google Search Central](https://developers.google.com/search/docs/essentials/spam-policies) — définition du *link spam*, achat de liens, actions manuelles.
- [How to verify your domain with Google Search Console — Porkbun Knowledge Base](https://kb.porkbun.com/article/166-how-to-verify-your-domain-with-google-search-console) — étapes exactes, champ *Host* laissé vide, délai de propagation.
- [How to Add DNS Records on Porkbun — Porkbun Knowledge Base](https://kb.porkbun.com/article/231-how-to-add-dns-records-on-porkbun)
- [Show HN — Hacker News](https://news.ycombinator.com/showhn.html) — ce qui qualifie, interdiction de solliciter des votes.
- [Hacker News Guidelines](https://news.ycombinator.com/newsguidelines.html)
- [Wikipedia:External links](https://en.wikipedia.org/wiki/Wikipedia:External_links) et [Wikipedia:Spam-blacklisting](https://en.wikipedia.org/wiki/Wikipedia:Spam-blacklisting) — `nofollow` généralisé, conflit d'intérêts, liste noire.
- [Import sites from Search Console to Bing Webmaster Tools — Bing Blogs](https://blogs.bing.com/webmaster/september-2019/Import-sites-from-Search-Console-to-Bing-Webmaster-Tools) — vérification automatique, délai de 48 h.
- [Managing a custom domain for your GitHub Pages site — GitHub Docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) — redirections apex/www ; **ne documente pas** la redirection depuis `github.io`.
- [We Checked the Self-Promotion Rules of 49 Subreddits — OneUp](https://oneup.today/blogs/reddit-selfpromo-rules-study-2026) — 61 % des subreddits étudiés interdisent l'auto-promotion.
- [The complete guide to Reddit self-promotion rules](https://redship.io/blog/reddit-self-promotion-rules) — règle 9:1, shadowban.
- [How Long Does a New Domain Take to Rank](https://blogpipeline.com/blog/new-domain-seo-authority-timeline/) et [How Long Does SEO Take to Work? What Google & Experts Say](https://welldressedwalrus.com/how-long-seo-takes-to-work-according-to-google-and-experts/) — 6 à 12 mois pour un domaine neuf ; position de John Mueller sur l'ancienneté du domaine.
- [Top 10 Blackjack Forums](https://forums.feedspot.com/blackjack_forums/) et [Blackjack Forum — Wikipedia](https://en.wikipedia.org/wiki/Blackjack_Forum) — communautés de comptage actives.
- [Le blog du Journal du hacker](https://blog.journalduhacker.net/) et [Framalibre — Framablog](https://framablog.org/2023/12/26/offrez-le-cadeau-du-logiciel-libre-avec-framalibre/) — agrégateur et annuaire francophones.

Les chiffres du dépôt (2 068 mots indexables, 543 mots enfermés dans le script,
2 245 171 octets d’`artefact.html`, `MAINS = 3_000_000`, 111 fichiers publiés,
`README.md:7`, 11,08 $ de domaine, le numéro d'aide au jeu) ont été mesurés
directement dans les fichiers le 07/09/2026.
