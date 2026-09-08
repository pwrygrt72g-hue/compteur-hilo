// La table à plusieurs, SANS réseau : un hôte et des invités en mémoire, reliés par une
// file de messages qu'on livre à la main. Tout est déterministe : le sabot est écrit
// d'avance, l'horloge est un nombre qu'on avance.
//   node src/table-reseau.test.mjs
import * as E from "./engine.mjs";
import { creerPartie, creerSalle, codeSalon, formaterCode, normaliserCode, codeValide, MISE_DELAI, ELECTION_DELAI, TAPIS_DEPART,
  salonJauge, salonNettoyer, salonLigne,
  NB_SIEGES, NOMS_BOTS, TOUR_DELAI, TOUR_DELAI_MIN, TOUR_BUDGET_MS, tourDelai,
  couleurPropre, nomPropre } from "./table-reseau.mjs";

let pass = 0, fail = 0;
function ok(nom, a, b) {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A === B) pass++; else { fail++; console.log("  ÉCHEC :", nom, "\n    obtenu ", A, "\n    attendu", B); }
}
const R = E.RANKS;
const idx = r => R.indexOf(String(r));
const c = (r, s) => ({ r: R[idx(r)], i: idx(r), suit: s || "♠", col: s === "♥" || s === "♦" ? "r" : "n" });

/* ── Le faux transport : une file, livrée quand on le décide, sérialisée comme sur le fil ── */
class Fil {
  constructor() { this.file = []; this.bouts = new Map(); }
  attacher(id, salle) { this.bouts.set(id, salle); return { publier: m => this.file.push({ de: id, m: JSON.parse(JSON.stringify(m)) }) }; }
  detacher(id) { this.bouts.delete(id); }
  livrer(now) { let n = 0; while (this.file.length && n++ < 10000) { const { de, m } = this.file.shift(); for (const [id, s] of this.bouts) if (id !== de) s.recevoir(m, now); } }
}
// Un sabot écrit d'avance : la PREMIÈRE carte du tableau est la brûlée, puis l'ordre de distribution.
let nSabot = 0;
const sabotFixe = ordre => () => ({ cartes: ordre.slice().reverse(), empreinte: "emp-" + (++nSabot), graine: "graine-" + nSabot });
const attendre = () => new Promise(r => setTimeout(r, 0));

const REGLES = { decks: 6, h17: true, blackjackPays: 1.5, das: true, surrender: "late", doubleOn: "any", maxHands: 4, holeCard: true, peek: true, penetration: .75 };
// creerSalle lit o.transport au moment de publier : on branche le transport AVANT d'entrer.
function creer(fil, id, nom, createur, sabot, extra) {
  const bout = { publier: null };
  const s = creerSalle(Object.assign({
    moi: id, nom, couleur: "#f00", createur, cartesNeuves: sabot, horloge: () => 0, transport: bout,
    partie: { regles: REGLES, table: "boulevard", jeux: 6, miseMin: 10, miseMax: 1000, tapis: TAPIS_DEPART },
    onInfo: t => s.infos.push(t), onEtat: e => s.etats.push(e),
  }, extra || {}));
  s.infos = []; s.etats = [];
  const t = fil.attacher(id, s); bout.publier = t.publier;
  return s;
}
const dernier = s => s.etats[s.etats.length - 1];
async function avancer(salles, fil, t, jusqu, pas) {
  for (; t.now < jusqu; t.now += pas || 250) { for (const s of salles) s.tic(t.now); fil.livrer(t.now); await attendre(); fil.livrer(t.now); }
}

/* ── 1. Le code de salon ─────────────────────────────────────────────────── */
{
  const code = codeSalon();
  ok("code : huit caractères", code.length, 8);
  ok("code : ni 0, ni O, ni 1, ni I", /[01IO]/.test(code), false);
  ok("code groupé par quatre", formaterCode("A7K2M9PQ"), "A7K2-M9PQ");
  ok("code normalisé (minuscules, tiret, espaces)", normaliserCode(" a7k2-m9pq "), "A7K2M9PQ");
  ok("code valide à huit, pas à cinq", [codeValide("A7K2-M9PQ"), codeValide("A7K2M")], [true, false]);
}

/* ── 2. Une manche complète : ordre des actions, refus hors tour, règlement ── */
{
  // Distribution : B (siège 0) · H (siège 2) · C (siège 4) · croupier visible, puis le 2ᵉ tour, puis la cachée.
  const ordre = [c("2"), c("10"), c("8"), c("A"), c("9"), c("6"), c("8", "♥"), c("R"), c("7"), c("5"), c("10", "♦")];
  const fil = new Fil(), t = { now: 1000 };
  const H = creer(fil, "a1", "Hugo", true, sabotFixe(ordre));
  const B = creer(fil, "b2", "Bea", false, sabotFixe(ordre));
  const C = creer(fil, "c3", "Cyril", false, sabotFixe(ordre));
  H.entrer(t.now); await attendre(); fil.livrer(t.now);
  B.entrer(t.now); C.entrer(t.now); fil.livrer(t.now); await attendre(); fil.livrer(t.now);
  ok("l'hôte est le créateur", [H.estHote(), B.estHote(), C.estHote()], [true, false, false]);
  ok("les invités ont reçu un état", [!!dernier(B), !!dernier(C)], [true, true]);
  ok("chacun connaît les deux autres", [H.pairs.size, B.pairs.size, C.pairs.size], [3, 3, 3]);
  ok("le sabot est scellé : empreinte publiée, graine tue", [dernier(B).sabot.empreinte, dernier(B).sabot.sabots[0].graine], ["emp-1", null]);
  H.agir("asseoir", 2, { nom: "Hugo", couleur: "#f00" }, t.now);
  B.agir("asseoir", 0, { nom: "Bea", couleur: "#0f0" }, t.now); C.agir("asseoir", 4, { nom: "Cyril", couleur: "#00f" }, t.now);
  fil.livrer(t.now);
  ok("les mises s'ouvrent dès le premier assis", dernier(C).phase, "mise");
  // Écrite en fonction de NB_SIEGES : ce test parle de QUI est assis où, pas du nombre de
  // places. Le figer à cinq le faisait tomber le jour où la table en a ouvert huit — un
  // échec qui ne désigne aucun défaut est un échec qu'on finit par ignorer.
  ok("trois sièges tenus, les autres vides", dernier(C).sieges.map(s => s ? s.nom : null),
    ["Bea", null, "Hugo", null, "Cyril"].concat(Array(NB_SIEGES - 5).fill(null)));
  ok("tout le monde part avec le même tapis", dernier(C).sieges.filter(Boolean).map(s => s.tapis), [1000, 1000, 1000]);
  B.agir("mise", 5, null, t.now); fil.livrer(t.now);
  ok("une mise sous le minimum est refusée, et dite", B.infos.some(i => /minimum/.test(i)), true);
  B.agir("mise", 20, null, t.now); H.agir("mise", 50, null, t.now); C.agir("mise", 100, null, t.now); fil.livrer(t.now);
  ok("les mises sont dans l'état de chacun", dernier(B).sieges.filter(Boolean).map(s => s.mise), [20, 50, 100]);
  ok("le tapis a baissé d'autant", dernier(B).sieges.filter(Boolean).map(s => s.tapis), [980, 950, 900]);
  C.agir("clore", null, null, t.now); fil.livrer(t.now);
  ok("seul l'hôte clôt les mises", C.infos.some(i => /hôte/.test(i)) && dernier(C).phase === "mise", true);
  // Le compte à rebours voyage : une seconde plus tard, il a baissé.
  const avant = dernier(B).miseRestant; await avancer([H, B, C], fil, t, t.now + 1500, 250);
  ok("le compte à rebours des mises baisse chez l'invité", dernier(B).miseRestant < avant, true);
  H.agir("clore", null, null, t.now); fil.livrer(t.now);
  ok("l'hôte clôt : la donne commence", dernier(B).phase, "donne");
  await avancer([H, B, C], fil, t, t.now + 12000, 250);
  const e = dernier(C);
  ok("la donne est finie, on joue", e.phase, "jeu");
  ok("chacun a deux cartes, dans l'ordre des sièges", e.sieges.filter(Boolean).map(s => s.mains[0].cards.map(x => x.r).join("")), ["106", "88", "AR"]);
  ok("la carte cachée du croupier n'est PAS dans l'état", [e.croupier[0].r, e.croupier[1].r, e.croupier[1].cachee], ["9", undefined, true]);
  ok("c'est au premier siège de jouer", e.actif, { siege: 0, main: 0 });
  C.agir("tirer", null, null, t.now); fil.livrer(t.now);
  ok("un invité hors tour est refusé, nommément", C.infos[C.infos.length - 1], "Ce n'est pas ton tour.");
  const r = H.agir("tirer", null, null, t.now);
  ok("l'hôte lui-même ne joue pas hors tour", r.ok, false);
  B.agir("doubler", null, null, t.now); fil.livrer(t.now);
  ok("doubler un 16 à deux cartes est légal ici, et Bea reçoit le 5 : 21", dernier(H).sieges[0].mains[0].cards.length === 3 && dernier(H).sieges[0].mains[0].doubled, true);
  ok("le tour passe à Hugo", dernier(B).actif, { siege: 2, main: 0 });
  H.agir("rester", null, null, t.now); fil.livrer(t.now);
  ok("Cyril a un blackjack : il ne joue pas, le croupier prend la main", dernier(B).phase, "croupier");
  await avancer([H, B, C], fil, t, t.now + 6000, 250);
  const f = dernier(C);
  ok("la carte cachée est révélée : 7", f.croupier[1].r, "7");
  ok("le croupier tire son 10 et saute", f.croupier.map(x => x.r), ["9", "7", "10"]);
  ok("règlement fait", f.phase, "reglement");
  ok("issues : gagné (doublé), gagné, blackjack", f.sieges.filter(Boolean).map(s => s.mains[0].result), ["gagné", "gagné", "blackjack"]);
  ok("tapis après règlement : +40, +50, +150", f.sieges.filter(Boolean).map(s => s.tapis), [1040, 1050, 1150]);
  // Le règlement est CELUI d'engine.mjs : on le recalcule à côté, main par main.
  const regles = E.makeRules(REGLES);
  const nets = f.sieges.filter(Boolean).map(s => s.mains[0].net);
  const attendus = f.sieges.filter(Boolean).map(s => E.settleHand(Object.assign(E.newHand(s.mains[0].cards, s.mains[0].bet), { doubled: s.mains[0].doubled, surrendered: s.mains[0].surrendered, fromSplit: s.mains[0].fromSplit }), f.croupier, regles).net);
  ok("règlement identique à engine.mjs", nets, attendus);
  ok("le journal a la manche : mises, cartes, issue, tapis", f.journal.length === 1 && f.journal[0].sieges.map(s => [s.nom, s.mains[0].mise, s.mains[0].cartes.join(" "), s.mains[0].issue, s.tapis]),
    [["Bea", 40, "10♠ 6♠ 5♠", "gagné", 1040], ["Hugo", 50, "8♠ 8♥", "gagné", 1050], ["Cyril", 100, "A♠ R♠", "blackjack", 1150]]);
  ok("les versions ne redescendent jamais", H.etats.every((x, i) => !i || x.v >= H.etats[i - 1].v), true);
  ok("un invité voit la même version que l'hôte", dernier(B).v, dernier(H).v);
  await avancer([H, B, C], fil, t, t.now + 4000, 250);
  ok("puis les mises rouvrent", dernier(B).phase, "mise");

  /* ── 3. Un invité rejoint mi-manche ── */
  B.agir("mise", 30, null, t.now); H.agir("mise", 10, null, t.now); C.agir("mise", 10, null, t.now); fil.livrer(t.now);
  H.agir("clore", null, null, t.now); fil.livrer(t.now);
  await avancer([H, B, C], fil, t, t.now + 12000, 250);
  ok("manche 2 en jeu", dernier(B).phase, "jeu");
  const D = creer(fil, "d4", "Dora", false, sabotFixe(ordre));
  D.entrer(t.now); fil.livrer(t.now); await attendre(); fil.livrer(t.now);
  ok("le retardataire reçoit l'état courant, en pleine manche", dernier(D) && dernier(D).phase, "jeu");
  ok("et pas la carte cachée", dernier(D).croupier[1].cachee, true);
  ok("l'hôte reste l'hôte", [D.estHote(), D.hote], [false, "a1"]);
  D.agir("asseoir", 1, { nom: "Dora", couleur: "#ff0" }, t.now); fil.livrer(t.now);
  ok("Dora prend un siège libre, sans main cette manche", [dernier(D).sieges[1].nom, dernier(D).sieges[1].mains.length], ["Dora", 0]);
  D.agir("tirer", null, null, t.now); fil.livrer(t.now);
  ok("elle ne peut pas jouer une main qu'elle n'a pas", D.infos[D.infos.length - 1], "Ce n'est pas ton tour.");
  // On finit la manche : chacun reste, le croupier joue.
  for (let g = 0; g < 6; g++) { const a = dernier(H).actif; if (!a) break; const s = [B, D, H, null, C][a.siege]; if (s) s.agir("rester", null, null, t.now); fil.livrer(t.now); }
  await avancer([H, B, C, D], fil, t, t.now + 16000, 250);
  ok("manche 2 réglée, les mises rouvrent pour quatre", [dernier(D).phase, dernier(D).sieges.filter(Boolean).length], ["mise", 4]);
  const tapisAvant = Object.fromEntries(dernier(D).sieges.filter(Boolean).map(s => [s.id, s.tapis]));

  /* ── 4. L'hôte tombe ── */
  D.agir("mise", 40, null, t.now); B.agir("mise", 30, null, t.now); fil.livrer(t.now);
  const vAvant = dernier(D).v, empreinteAvant = dernier(D).sabot.empreinte;
  fil.detacher("a1"); H.quitter(); fil.livrer(t.now);         // le testament : « adieu » de l'hôte
  ok("le plus petit identifiant restant reprend la main", [B.estHote(), C.estHote(), D.estHote()], [true, false, false]);
  await avancer([B, C, D], fil, t, t.now + 2000, 250);
  const g = dernier(D);
  ok("les invités suivent le nouvel hôte", [g.hote, C.hote, D.hote], ["b2", "b2", "b2"]);
  ok("la version continue de monter", g.v > vAvant, true);
  ok("le sabot est régénéré, et l'écran le dit", [g.sabot.empreinte !== empreinteAvant, g.regenere, D.etats.some(x => /sabot neuf/.test(x.message))], [true, true, true]);
  ok("les mises en cours sont rendues", [g.sieges[0].tapis, g.sieges[1].tapis], [tapisAvant.b2, tapisAvant.d4]);
  ok("le siège de l'ancien hôte est libéré", g.sieges[2], null);
  ok("les trois restants sont toujours assis", g.sieges.filter(Boolean).map(s => s.nom), ["Bea", "Dora", "Cyril"]);
  ok("le journal a survécu au changement d'hôte", g.journal.length, 2);
  ok("et la manche repart : les mises rouvrent", g.phase, "mise");
}

/* ── 5. L'assurance, réglée par engine.mjs ── */
{
  const ordre = [c("2"), c("10"), c("A"), c("9"), c("R")];
  const fil = new Fil(), t = { now: 5000 };
  const H = creer(fil, "h1", "Hugo", true, sabotFixe(ordre));
  const B = creer(fil, "b2", "Bea", false, sabotFixe(ordre));
  H.entrer(t.now); await attendre(); fil.livrer(t.now); B.entrer(t.now); fil.livrer(t.now);
  B.agir("asseoir", 0, { nom: "Bea" }, t.now); fil.livrer(t.now);
  B.agir("mise", 20, null, t.now); fil.livrer(t.now);
  H.agir("clore", null, null, t.now); fil.livrer(t.now);
  await avancer([H, B], fil, t, t.now + 6000, 250);
  ok("le croupier montre un as : l'assurance est proposée", dernier(B).phase, "assurance");
  B.agir("assurance", true, null, t.now); fil.livrer(t.now);
  await avancer([H, B], fil, t, t.now + 3000, 250);
  const e = dernier(B);
  ok("le croupier avait blackjack : révélé, réglé", [e.phase, e.croupier[1].r], ["reglement", "R"]);
  ok("main perdue, assurance payée 2 contre 1 : tapis intact", [e.sieges[0].mains[0].result, e.sieges[0].tapis], ["perdu", 1000]);
  ok("l'assurance vaut ce qu'engine.mjs dit", E.settleInsurance(20, true), 20);
}

/* ── 6. Un arrivant seul devient hôte après le délai ; des bots complètent ── */
{
  const fil = new Fil(), t = { now: 9000 };
  const ordre = [c("2"), c("10"), c("5"), c("9"), c("8"), c("7"), c("6"), c("4"), c("3"), c("2"), c("10"), c("10"), c("10"), c("9"), c("9"), c("9"), c("9"), c("9"), c("9")];
  const S = creer(fil, "z9", "Zoé", false, sabotFixe(ordre), { cadence: 300 });
  S.entrer(t.now); fil.livrer(t.now);
  await avancer([S], fil, t, t.now + ELECTION_DELAI + 500, 250);
  ok("seul sur un code : il devient l'hôte", S.estHote(), true);
  S.agir("bots", true, null, t.now); S.agir("asseoir", 2, { nom: "Zoé" }, t.now); fil.livrer(t.now);
  ok("les bots complètent les sièges vides quand l'hôte le demande", dernier(S).sieges.map(s => s && s.bot),
    [true, true, false].concat(Array(NB_SIEGES - 3).fill(true)));
  ok("les bots ont misé", dernier(S).sieges.filter(s => s && s.bot).every(s => s.mise >= 10), true);
  S.agir("mise", 10, null, t.now); S.agir("clore", null, null, t.now); fil.livrer(t.now);
  await avancer([S], fil, t, t.now + 15000, 250);
  ok("les bots jouent seuls jusqu'à mon tour", dernier(S).phase === "jeu" && dernier(S).actif && dernier(S).actif.siege === 2, true);
}

/* ── 7. La partie nue : une mise qui dépasse le tapis, un rachat ── */
{
  const p = creerPartie({ regles: REGLES, miseMin: 10, miseMax: 1000, tapis: 1000, cartes: [c("2"), c("3")], empreinte: "x" });
  p.action({ id: "u", a: "asseoir", v: 0, nom: "U" }, 0);
  ok("mise au-delà du tapis refusée", p.action({ id: "u", a: "mise", v: 1500 }, 0).ok, false);
  ok("mise dans le tapis acceptée", p.action({ id: "u", a: "mise", v: 1000 }, 0).ok, true);
  ok("rachat refusé tant qu'il reste de quoi jouer", p.action({ id: "u", a: "rachat" }, 0).ok, false);
  p.action({ id: "u", a: "mise", v: 0 }, 0);
  p.etat.sieges[0].tapis = 4;
  ok("rachat accepté à tapis vide, compté", [p.action({ id: "u", a: "rachat" }, 0).ok, p.etat.sieges[0].tapis, p.etat.sieges[0].rachats], [true, 1000, 1]);
}

/* ── 8. La carte de coupe : le SENS de la pénétration ────────────────────────
   `P.coupe` compte les cartes LAISSÉES DERRIÈRE la carte de coupe, parce que le
   remélange se déclenche sur `cartes.length <= coupe`. La pénétration, elle, est la
   fraction du sabot qu'on JOUE : c'est la définition du catalogue (« on joue 75 % du
   sabot avant de remélanger ») et celle du simulateur qui calcule l'avantage maison
   affiché (sim.mjs). Les deux nombres sont donc COMPLÉMENTAIRES, pas égaux.
   Jusqu'au 6 septembre 2026 on écrivait `length * penetration` : au Boulevard on
   remélangeait après 78 cartes au lieu de 234, et Le Salon Privé — vendu sur sa
   pénétration de 0,85 — était la table la MOINS profonde du catalogue. Autrement dit
   l'application enseignait l'inverse de ce qu'elle affirmait.
   Ces tests figent le sens : quiconque « répare » en retirant le `1 -` tombe ici.
   Ne pas les assouplir sans relire sim.mjs et le catalogue. */
{
  const sabotDe = n => ({ cartes: Array.from({ length: n }, (_, k) => c(R[k % 13])), empreinte: "coupe-" + n, graine: null });
  const coupeDe = pen => {
    const p = creerPartie({ regles: REGLES, penetration: pen, cartes: [], empreinte: "" });
    p.remelanger(sabotDe(312), false);
    return p.etat.coupe;
  };
  ok("coupe : 6 jeux à 75 % de pénétration laissent 78 cartes derrière", coupeDe(.75), 78);
  ok("coupe : à 50 %, le sabot est coupé en deux", coupeDe(.5), 156);
  ok("coupe : PLUS on pénètre, MOINS il reste de cartes (Salon Privé 85 % > Boulevard 75 %)", coupeDe(.85) < coupeDe(.75), true);
  ok("coupe : jamais la fraction jouée elle-même (le bogue d'avant renvoyait 234)", coupeDe(.75) === 234, false);

  // Et la preuve par le jeu : on distribue jusqu'à ce que la table réclame un sabot,
  // puis on compte les cartes réellement consommées. À 75 %, il en faut au moins 234.
  {
    const p = creerPartie({ regles: REGLES, table: "boulevard", jeux: 6, bots: true, cadence: 0,
      penetration: .75, miseMin: 10, miseMax: 1000, tapis: 100000 });
    p.remelanger(sabotDe(312), false);
    const depart = p.etat.cartes.length;                 // 311 : la brûlée est déjà partie
    let now = 0;
    while (!p.etat.besoinRemelange && now < 4000000) { p.etape(now); now += 1000; }
    const jouees = depart - p.etat.cartes.length;
    ok("le sabot part au remélange APRÈS la fraction annoncée, pas avant", jouees >= 234, true);
    ok("... et une seule manche de trop, pas un sabot entier", jouees < 234 + 60, true);
    ok("... il reste alors moins de cartes que la carte de coupe", p.etat.cartes.length <= p.etat.coupe, true);
    ok("... et la table a joué plus de dix manches, pas cinq", p.etat.manche >= 10, true);
  }
}

/* ── 9. HUIT JOUEURS ──────────────────────────────────────────────────────────
   La table entre amis ouvre huit places, une de plus que la plus grande table du
   catalogue. Ce n'est pas le nombre qui est difficile — c'est le TEMPS : les mises
   sont parallèles, mais la donne et les tours sont SÉQUENTIELS, donc tout ce qui est
   « par joueur » se multiplie par huit. Ces tests figent les trois arbitrages qui
   rendent huit places jouables, et surtout la NON-RÉGRESSION à cinq. */
{
  const REGLES8 = { decks: 6, h17: true, blackjackPays: 1.5, das: true, surrender: "late",
    doubleOn: "any", maxHands: 4, holeCard: true, peek: true, penetration: .75 };
  // Un sabot de « 6 » uniquement : aucune main de deux cartes ne vaut 21, personne n'a
  // de blackjack, donc CHAQUE siège consomme réellement son tour. C'est le pire cas.
  const sabotPlat = n => ({ cartes: Array.from({ length: n }, () => c("6")), empreinte: "plat", graine: null });

  ok("huit sièges, et la table les construit vraiment", [NB_SIEGES, creerPartie({ regles: REGLES8 }).etat.sieges.length], [8, 8]);
  // Les prénoms sont recyclés par modulo : moins de prénoms que de sièges, et deux
  // « Marc » s'assoient à la même table sans que rien ne le signale.
  ok("un prénom de bot par siège, tous différents", [NOMS_BOTS.length >= NB_SIEGES, new Set(NOMS_BOTS).size === NOMS_BOTS.length], [true, true]);
  {
    const p = creerPartie({ regles: REGLES8, bots: true, cartes: [c("2"), c("3")], empreinte: "x" });
    p.action({ id: "moi", a: "asseoir", v: 3, nom: "Moi" }, 0);
    const noms = p.etat.sieges.map(st => st.nom);
    ok("huit bots à table, huit noms distincts", new Set(noms).size, NB_SIEGES);
  }

  /* ── Le budget de tour : on borne le TOTAL, pas l'unité ── */
  ok("jusqu'à cinq joueurs, le tour ne bouge pas d'une milliseconde", [1, 2, 3, 4, 5].map(tourDelai), [1, 2, 3, 4, 5].map(() => TOUR_DELAI));
  ok("au-delà, le tour se resserre : 6, 7, 8 joueurs", [6, 7, 8].map(tourDelai), [25000, 21429, 18750]);
  ok("le budget de la table est tenu (8 × le tour ≈ deux minutes trente)", Math.abs(8 * tourDelai(8) - TOUR_BUDGET_MS) <= 8, true);
  ok("un plancher, pour qu'une table de douze ne fasse jamais subir le jeu", [tourDelai(12), tourDelai(40)], [TOUR_DELAI_MIN, TOUR_DELAI_MIN]);
  ok("le tour ne dépasse jamais le plafond, même à un seul joueur", tourDelai(1) <= TOUR_DELAI && tourDelai(0) <= TOUR_DELAI, true);

  /* ── La manche pire cas, chronométrée sur la vraie machine à étapes ──
     On la fait tourner au tic de 200 ms de reseau.js (RS.ticker), tous les sièges tenus
     par des humains qui ne jouent jamais. Mesuré le 6 septembre 2026 AVANT ce lot :
     5 joueurs 3 min 08 · 6 joueurs 3 min 40 · 7 joueurs 4 min 12 · 8 joueurs 4 min 44.
     Quatre minutes de mains mortes pour trente secondes de jeu : personne n'attend ça. */
  function pireCas(n) {
    const p = creerPartie({ regles: REGLES8, jeux: 6, penetration: .75, miseMin: 10, miseMax: 1000,
      tapis: 100000, cadence: 900, nbSieges: Math.max(n, NB_SIEGES) });
    p.remelanger(sabotPlat(312), false);
    for (let k = 0; k < n; k++) p.action({ id: "h" + k, a: "asseoir", v: k, nom: "J" + k }, 0);
    let now = 0, garde = 0;
    for (let k = 0; k < n; k++) p.action({ id: "h" + k, a: "mise", v: 10 }, now);
    const jalons = {}, tic = () => { p.etape(now); now += 200; };
    const jusqua = (test, nom) => { while (test() && garde++ < 40000) tic(); jalons[nom] = now; };
    jusqua(() => p.etat.manche === 0, "mise");
    jusqua(() => p.etat.phase === "donne", "donne");
    jusqua(() => p.etat.phase === "jeu" || p.etat.phase === "assurance", "jeu");
    jusqua(() => p.etat.phase === "croupier" || p.etat.phase === "reglement", "fin");
    return { total: jalons.fin, donne: jalons.donne - jalons.mise, jeu: jalons.jeu - jalons.donne };
  }
  const m5 = pireCas(5), m8 = pireCas(8);
  ok("à cinq, la manche pire cas n'a pas bougé : toujours 3 min 08", m5.total, 188200);
  ok("à huit, elle tombe sous 3 min 15 (elle faisait 4 min 44)", m8.total < 195000, true);
  ok("... et le gain est réel : plus d'une minute vingt de moins", 284200 - m8.total > 80000, true);
  // La donne est le seul moment sans décision : c'est le seul qu'on peut presser.
  ok("la donne à huit ne dure pas plus longtemps qu'à cinq aujourd'hui", m8.donne <= m5.donne, true);
  ok("le jeu à huit tient dans le budget de table", m8.jeu <= TOUR_BUDGET_MS + 2000, true);

  /* ── La cadence de donne est un PLAFOND, pas une consigne ──
     Le curseur du joueur va de 120 à 1400 ms (table.js). Imposer 600 ms à huit sièges
     ralentirait celui qui a choisi 300 : on plafonne, on n'impose jamais. */
  function dureeDonne(n, cadence) {
    const p = creerPartie({ regles: REGLES8, jeux: 6, penetration: .75, miseMin: 10, miseMax: 1000,
      tapis: 100000, cadence, nbSieges: Math.max(n, NB_SIEGES) });
    p.remelanger(sabotPlat(312), false);
    for (let k = 0; k < n; k++) { p.action({ id: "h" + k, a: "asseoir", v: k, nom: "J" + k }, 0); p.action({ id: "h" + k, a: "mise", v: 10 }, 0); }
    let now = 0, garde = 0;
    while (p.etat.manche === 0 && garde++ < 40000) { p.etape(now); now += 200; }
    const t0 = now;
    while (p.etat.phase === "donne" && garde++ < 40000) { p.etape(now); now += 200; }
    return now - t0;
  }
  ok("à huit et cadence par défaut, la donne tombe de 18,2 s à 11 s", dureeDonne(8, 900), 11000);
  ok("à cinq, la cadence choisie est respectée à la lettre", [dureeDonne(5, 900), dureeDonne(5, 1400)], [12200, 17000]);
  // Le plafond ne doit jamais RALLONGER la donne de celui qui a choisi vite : à 200 ms,
  // huit sièges distribuent en 3,8 s, pas en 11 s. C'est tout l'écart entre plafonner et imposer.
  ok("une cadence RAPIDE n'est jamais ralentie par le plafond", [dureeDonne(8, 200), dureeDonne(8, 200) < dureeDonne(8, 600)], [3800, true]);

  /* ── La marge de sabot suit le monde présent ──
     Elle dit quand réclamer le sabot SUIVANT. Mesuré le 6 septembre 2026 sur quarante
     sabots mélangés : une manche consomme 17,1 cartes à cinq sièges et 25,9 à huit.
     Huit cartes d'avance — la valeur d'avant — c'était un tiers de manche à huit
     joueurs : le sabot se vidait en pleine donne et la table s'arrêtait. */
  {
    const marge = nAssis => {
      const p = creerPartie({ regles: REGLES8, jeux: 6, penetration: .75, miseMin: 10, miseMax: 1000, tapis: 100000 });
      p.remelanger({ cartes: Array.from({ length: 312 }, () => c("6")), empreinte: "m", graine: null }, false);
      for (let k = 0; k < nAssis; k++) p.action({ id: "h" + k, a: "asseoir", v: k, nom: "J" + k }, 0);
      // On vide le sabot à la main jusqu'au premier « il m'en faut un autre ».
      while (!p.prochainManque && p.etat.cartes.length > 1) p.etat.cartes.pop();
      return p.etat.cartes.length - p.etat.coupe;
    };
    ok("cinq assis : dix-neuf cartes d'avance", marge(5), 19);
    ok("huit assis : vingt-huit, soit plus qu'une manche entière", marge(8), 28);
    ok("... la marge couvre la manche moyenne à huit (25,9 cartes mesurées)", marge(8) >= 26, true);
  }

  /* ── L'état diffusé porte moins d'HISTOIRE, pas moins d'ÉTAT ──
     Mesuré le 6 septembre 2026, journal plein, huit sièges : l'état pesait 43,6 kio dont
     39,0 de journal — 90 % d'un objet republié 30 à 40 fois par manche, pour des lignes
     lues seulement dans une modale ouverte à la demande. */
  {
    const p = creerPartie({ regles: REGLES8, cartes: [c("2")], empreinte: "x" });
    for (let k = 0; k < 25; k++) p.etat.journal.push({ manche: k, empreinte: "x", croupier: ["6♠"], total: 6, sieges: [] });
    const e = p.etatPublic(0);
    ok("la diffusion ne publie que les dix dernières manches", e.journal.length, 10);
    ok("... les plus RÉCENTES, pas les plus vieilles", [e.journal[0].manche, e.journal[9].manche], [15, 24]);
    ok("... et la table, elle, garde tout son journal en mémoire", p.etat.journal.length, 25);
    // L'état reste COMPLET : tout ce qui sert à afficher la table est toujours là.
    ok("l'état reste complet et idempotent", ["v", "phase", "sieges", "croupier", "sabot", "rc", "vues"].every(k => e[k] !== undefined), true);
  }

  /* ── La reprise ne fait JAMAIS disparaître un joueur ──
     Un nouvel hôte peut tourner une autre version que l'ancien. Le nombre de sièges reçu
     fait alors autorité vers le HAUT : compléter jusqu'à NB_SIEGES, jamais tronquer. */
  {
    const etatDe = n => ({ v: 3, table: "boulevard", manche: 2, journal: [], sabot: { sabots: [] },
      sieges: Array.from({ length: n }, (_, k) => ({ id: "j" + k, nom: "J" + k, tapis: 900, mise: 0, mains: [], rachats: 0 })) });
    const repris = n => { const p = creerPartie({ regles: REGLES8 }); p.reprendre(etatDe(n), "neuf"); return p.etat.sieges; };
    ok("un état plus petit est COMPLÉTÉ jusqu'à huit", [repris(3).length, repris(5).length], [NB_SIEGES, NB_SIEGES]);
    ok("un état PLUS GRAND garde ses sièges : personne ne disparaît", [repris(10).length, repris(10).filter(Boolean).length], [10, 10]);
    ok("et les joueurs assis sont tous là", repris(8).filter(Boolean).map(st => st.nom).join(","), "J0,J1,J2,J3,J4,J5,J6,J7");
  }
}

/* ══ LE PLAFOND DE RACHATS (La Marina) ══════════════════════════════════════
   Léo, 07/09 : « pas de rachat illimité pour jouer intelligemment ». Ce qui est
   vérifié ici, ce n'est pas le bouton — c'est la MACHINE. L'état de la table est
   reconstruit par l'hôte à partir des actions reçues sur le fil : un pair modifié
   qui envoie « rachat » ne doit pas obtenir un tapis neuf que personne n'a
   autorisé. Le refus vit donc dans `action`, pas seulement dans l'écran.      */
{
  const neuve = o => {
    const p = creerPartie(Object.assign({ regles: REGLES, miseMin: 100, tapis: 500, cartes: [c("2"), c("3")], empreinte: "x" }, o || {}));
    p.action({ id: "a", a: "asseoir", v: 0, nom: "Ana" }, 0);
    return p;
  };
  const ruiner = p => { const st = p.etat.sieges[0]; st.tapis = 0; st.mise = 0; return st; };
  const racheter = p => p.action({ id: "a", a: "rachat" }, 0);

  {
    const p = neuve({ rachatsMax: 2 });
    ok("la cave vient de la TABLE, pas d'une constante", p.etat.sieges[0].tapis, 500);
    ruiner(p); ok("1er rachat accepté", racheter(p).ok, true);
    ok("...et il rend la cave de la table, pas 1 000", p.etat.sieges[0].tapis, 500);
    ruiner(p); ok("2e rachat accepté", racheter(p).ok, true);
    ruiner(p);
    const r = racheter(p);
    ok("le 3e est REFUSÉ par la machine", r.ok, false);
    ok("...et le refus dit pourquoi", /maximum de cette table/.test(r.erreur || ""), true);
    ok("...et le tapis n'a pas bougé", p.etat.sieges[0].tapis, 0);
    ok("le compte de rachats est publié", p.etat.sieges[0].rachats, 2);
    ok("...et le plafond aussi, pour que l'écran puisse le dire", p.etatPublic(0).rachatsMax, 2);
  }

  {
    // Une table qui ne se rachète pas du tout : 0 doit rester 0, pas devenir « illimité ».
    // C'est ce qu'un `o.rachatsMax || Infinity` aurait cassé en silence.
    const p = neuve({ rachatsMax: 0 });
    ruiner(p);
    const r = racheter(p);
    ok("rachatsMax 0 refuse dès le premier", r.ok, false);
    ok("...avec sa propre phrase", /cave unique/.test(r.erreur || ""), true);
  }

  {
    // 🚨 LE CAS QUI COMPTE : les neuf tables historiques ne passent PAS cette option.
    // Un défaut mal choisi (0, ou null) les casserait TOUTES, sans un mot.
    const p = neuve();
    let tous = true;
    for (let i = 0; i < 5; i++) { ruiner(p); if (!racheter(p).ok) tous = false; }
    ok("sans plafond, cinq rachats d'affilée passent", tous, true);
    ok("et l'état publie « illimité » comme -1, jamais comme null", p.etatPublic(0).rachatsMax, -1);
  }

  {
    // Les bots suivent la MÊME règle : sinon le joueur humain voit une contrainte qui ne
    // vaut que pour lui, à côté de voisins qui se renflouent indéfiniment.
    // ⚠️ Il faut une manche ENTIÈRE : `botsRuines` vit dans `ouvrirMises`, et asseoir le
    // premier joueur a DÉJÀ ouvert les mises. Casser les bots juste après et appeler
    // `etape` ne rejoue pas cette phase — le premier jet de ce test passait donc à côté
    // de ce qu'il croyait mesurer.
    const p = creerPartie({ regles: REGLES, miseMin: 100, tapis: 500, rachatsMax: 1, bots: true,
      cartes: Array.from({ length: 400 }, () => c("5")), empreinte: "x" });
    p.action({ id: "a", a: "asseoir", v: 0, nom: "Ana" }, 0);
    p.etat.sieges.forEach(st => { if (st && st.bot) { st.tapis = 0; st.mise = 0; st.rachats = 1; st.mains = []; } });
    p.action({ id: "a", a: "mise", v: 100 }, 0);
    for (let t = 1; t < 400000; t += 400) {
      p.etape(t);
      if (p.etat.manche >= 1 && p.etat.phase === "mise" && p.etat.sieges.some(st => st && st.bot && st.tapis > 0)) break;
    }
    const bots = p.etat.sieges.filter(st => st && st.bot);
    ok("un bot à court de rachats ne reste pas assis à zéro", bots.every(st => st.tapis > 0 || st.rachats < 1), true);
    ok("...il est remplacé, la table ne se vide pas", bots.length > 0, true);
    ok("...et le remplaçant repart d'une cave neuve, sans rachat", bots.every(st => (st.rachats || 0) === 0), true);
    ok("...et deux voisins n'ont jamais le même nom", new Set(bots.map(st => st.nom)).size, bots.length);
  }
}


/* ═══ La reprise ne perd plus ce qui définit la table (07/09/2026) ═══
   L'hôte s'en va, un autre reprend le sabot. Jusqu'ici `reprendre` restaurait la mise
   minimum, la mise maximum, le 6:5 et la cave — mais NI le plafond de recaves, NI le fait
   que la table soit publique. Deux dégâts invisibles : La Marina redevenait une table à
   recaves illimitées, et une table vivante sortait du salon pour toujours. */
{
  const source = creerPartie({ regles: REGLES, miseMin: 100, tapis: 5000, rachatsMax: 2 });
  const e = source.etatPublic(0);
  ok("l'état diffuse le plafond de recaves", e.rachatsMax, 2);

  const repris = creerPartie({ regles: REGLES });                 // partie NEUVE = illimité
  ok("avant reprise : illimité", repris.etatPublic(0).rachatsMax, -1);
  repris.reprendre(e, "b");
  ok("après reprise : le plafond de la table est retenu", repris.etatPublic(0).rachatsMax, 2);

  // …et il MORD vraiment : la 3e recave doit être refusée.
  // ⚠️ `reprendre` laisse la partie en phase « sabot » — on ne connaît pas le sabot de
  // l'ancien hôte, la manche est annulée. Or le rachat répond « Pas maintenant » dans
  // cette phase : sans sabot neuf, ce test mesurerait ce refus-là et pas le plafond.
  // (Premier jet : deux échecs qui n'accusaient nullement le code.)
  repris.remelanger({ cartes: Array.from({ length: 400 }, () => c("5")), empreinte: "neuf" });
  repris.action({ id: "b", a: "asseoir", v: 0, nom: "Bea" }, 0);
  const k = repris.etat.sieges.findIndex(x => x && x.id === "b");
  const essai = () => { const st = repris.etat.sieges[k]; st.tapis = 0; st.mise = 0; return repris.action({ id: "b", a: "rachat" }, 0).ok; };
  ok("1re recave acceptée après reprise", essai(), true);
  ok("2e recave acceptée après reprise", essai(), true);
  ok("3e recave REFUSÉE après reprise", essai(), false);
}
{
  const libre = creerPartie({ regles: REGLES });
  const r = creerPartie({ regles: REGLES, rachatsMax: 0 });
  r.reprendre(libre.etatPublic(0), "b");
  ok("-1 se relit « illimité », jamais « zéro »", r.etatPublic(0).rachatsMax, -1);

  // Un état émis par une version d'AVANT ce champ : on garde le nôtre plutôt que de le
  // remettre à zéro en silence — un champ absent ne veut pas dire « aucune recave ».
  const vieux = creerPartie({ regles: REGLES, rachatsMax: 3 }).etatPublic(0);
  delete vieux.rachatsMax;
  const b = creerPartie({ regles: REGLES, rachatsMax: 3 });
  b.reprendre(vieux, "b");
  ok("champ absent : on conserve le plafond local", b.etatPublic(0).rachatsMax, 3);
}
{
  const pub = creerPartie({ regles: REGLES, publique: true });
  ok("l'état porte « publique »", pub.etatPublic(0).publique, true);
  const a = creerPartie({ regles: REGLES });
  ok("une partie neuve n'est pas publique par défaut", a.etatPublic(0).publique, false);
  a.reprendre(pub.etatPublic(0), "b");
  ok("le nouvel hôte en hérite : la table reste dans le salon", a.etatPublic(0).publique, true);

  // 🚨 Le sens inverse compte autant : une table PRIVÉE ne devient pas publique en
  // changeant de mains. C'est ce qui interdit d'écrire « je suis hôte donc j'annonce ».
  const prive = creerPartie({ regles: REGLES, publique: false }).etatPublic(0);
  const d = creerPartie({ regles: REGLES, publique: true });
  d.reprendre(prive, "b");
  ok("une table privée reste privée", d.etatPublic(0).publique, false);
}

/* ── Le salon ne doit pas promettre une place qui n'existe pas ─────────────── */
{
  const siege = (id, bot) => ({ id, bot: !!bot, nom: id, mains: [], mise: 0 });
  // Trois bots, deux humains, huit sièges : la table est PLEINE. En ne comptant que
  // les humains, elle s'annonçait « 2/8 » et le bouton disait « Rejoindre ».
  const pleine = { phase: "mise", sieges: [siege("a"), siege("b"), siege("x", 1), siege("y", 1), siege("z", 1), siege("w", 1), siege("v", 1), siege("u", 1)] };
  ok("salon : un bot occupe un siège, donc il compte", salonJauge(pleine, 2).pris, 8);
  ok("salon : la table pleine de bots est vue pleine", salonJauge(pleine, 2).pris >= 8, true);

  // …et le contraire : trois personnes DEBOUT, aucun siège pris. « 0/8 » a l'air
  // désert ; c'est `gens` qui dit qu'il y a du monde.
  const debout = { phase: "mise", sieges: [null, null, null, null, null, null, null, null] };
  ok("salon : personne d'assis, mais du monde relié", salonJauge(debout, 3).gens, 3);
  ok("salon : et zéro siège pris", salonJauge(debout, 3).pris, 0);
  ok("salon : un siège vide ne compte pas", salonJauge({ phase: "mise", sieges: [siege("a"), null] }, 1).pris, 1);

  // `gens` ne descend jamais sous 1 : l'hôte qui annonce est forcément là.
  ok("salon : au moins une personne, toujours", salonJauge(debout, 0).gens, 1);
  ok("salon : pas encore d'état = rien d'assis", salonJauge(null, 1).pris, 0);

  // Une manche en cours : on n'entre pas au milieu d'une donne.
  for (const ph of ["donne", "jeu", "assurance", "croupier", "reglement"])
    ok("salon : « " + ph + " » = manche en cours", salonJauge({ phase: ph, sieges: [] }, 1).jeu, true);
  for (const ph of ["mise", "sabot"])
    ok("salon : « " + ph + " » = on peut entrer tout de suite", salonJauge({ phase: ph, sieges: [] }, 1).jeu, false);
}
{
  // 🚨 Le courtier est PUBLIC. Ce nettoyage est ce qui empêche une annonce forgée
  // d'atteindre innerHTML — il reste la seule barrière pour les nombres.
  const sale = salonNettoyer({ code: "ABCD1234", pris: '<img src=x onerror=alert(1)>', places: "8", hote: "x".repeat(90), nom: "n".repeat(90), gens: -4, jeu: "1", miseMin: "50", rachats: -1 });
  ok("annonce : un nombre forgé retombe sur son défaut", sale.pris, 1);
  ok("annonce : le nom de l'hôte est tronqué", sale.hote.length, 18);
  ok("annonce : le nom de la table est tronqué", sale.nom.length, 40);
  ok("annonce : un négatif interdit retombe sur son défaut", sale.gens, 0);
  ok("annonce : « recaves illimitées » survit", sale.rachats, -1);
  ok("annonce : la mise mini traverse", sale.miseMin, 50);
  ok("annonce : jeu accepte la chaîne « 1 »", sale.jeu, 1);

  // ⚠️ Un onglet plus ancien n'envoie NI `gens` NI `jeu`. 0 veut dire « on ne sait
  // pas » — le rendu n'affiche alors rien, plutôt que d'inventer « 1 joueur ».
  const vieux = salonNettoyer({ code: "ABCD1234", pris: 2, places: 8, hote: "Léo", nom: "Table", miseMin: 10, rachats: 2 });
  ok("annonce d'un vieil onglet : gens inconnu", vieux.gens, 0);
  ok("annonce d'un vieil onglet : jeu inconnu", vieux.jeu, 0);
  ok("annonce d'un vieil onglet : le reste passe", vieux.pris + "/" + vieux.places, "2/8");
}

/* ── Rejoindre une table morte ne doit pas ressembler à un succès ──────────── */
{
  // Léo clique « Rejoindre » sur une entrée de salon dont l'hôte est parti : l'annonce
  // survit jusqu'à sa péremption, donc la table est encore listée. Personne ne répond.
  const fil = new Fil(); const t = { now: 0 };
  const seul = creer(fil, "zz", "Léo", false, sabotFixe(["AS"]));
  seul.entrer(t.now);
  await avancer([seul], fil, t, ELECTION_DELAI + 600);
  const dit = seul.infos.join(" | ");
  ok("table morte : on n'annonce pas « Tu ouvres la table »", /Tu ouvres la table/.test(dit), false);
  ok("table morte : on dit qu'il n'y a personne", /personne à cette table/i.test(dit), true);
  ok("table morte : on redonne le geste utile (partager le code)", /partage-le/i.test(dit), true);
  ok("table morte : je tiens quand même le sabot", seul.hote, "zz");
}
{
  // …et le créateur, lui, garde sa phrase : le correctif ne déborde pas.
  const fil = new Fil(); const t = { now: 0 };
  const h = creer(fil, "aa", "Hôte", true, sabotFixe(["AS"]));
  h.entrer(t.now);
  await avancer([h], fil, t, ELECTION_DELAI + 600);
  ok("ouvrir une table : la phrase ne change pas", /Tu ouvres la table/.test(h.infos.join(" | ")), true);
  ok("ouvrir une table : on ne parle pas de table vide", /personne à cette table/i.test(h.infos.join(" | ")), false);
}
{
  // L'hôte part EN COURS DE PARTIE : la reprise garde sa phrase à elle. C'est le cas
  // que les deux nouveaux motifs ne doivent surtout pas manger.
  const fil = new Fil(); const t = { now: 0 };
  const H = creer(fil, "aa", "Hôte", true, sabotFixe(["AS", "KS", "QS", "JS", "TS", "9S"]));
  const B = creer(fil, "bb", "B", false, sabotFixe(["AS"]));
  H.entrer(t.now); await attendre(); fil.livrer(t.now);
  B.entrer(t.now); fil.livrer(t.now); await attendre(); fil.livrer(t.now);
  await avancer([H, B], fil, t, ELECTION_DELAI + 600);
  B.infos.length = 0;
  fil.detacher("aa");
  B.recevoir({ t: "adieu", id: "aa" }, t.now);
  await avancer([B], fil, t, t.now + 1200);
  const dit = B.infos.join(" | ");
  ok("l'hôte s'en va : la phrase de reprise est conservée", /reprends la main/i.test(dit), true);
  ok("l'hôte s'en va : on ne dit pas « il n'y a personne »", /personne à cette table/i.test(dit), false);
}

/* ── Ce que la ligne du salon dit vraiment ────────────────────────────────── */
{
  const base = { hote: "Léo", pris: 3, places: 8, gens: 2, jeu: 0, rachats: -1 };
  ok("ligne : l'essentiel, sans bavardage",
     salonLigne(base, "10 €").join(" · "), "chez Léo · 2 joueurs · 3/8 sièges · min 10 €");
  ok("ligne : une seule personne, au singulier",
     salonLigne(Object.assign({}, base, { gens: 1 }), "10 €")[1], "1 joueur");
  ok("ligne : une manche en cours se dit",
     salonLigne(Object.assign({}, base, { jeu: 1 }), "10 €").includes("manche en cours"), true);
  ok("ligne : au repos, on n'en parle pas",
     salonLigne(base, "10 €").includes("manche en cours"), false);
  ok("ligne : les recaves bornées se disent",
     salonLigne(Object.assign({}, base, { rachats: 2 }), "10 €").pop(), "2 recaves");
  ok("ligne : une recave, au singulier",
     salonLigne(Object.assign({}, base, { rachats: 1 }), "10 €").pop(), "1 recave");
  ok("ligne : recaves illimitées = on n'en parle pas",
     salonLigne(base, "10 €").some(x => /recave/.test(x)), false);
  // ⚠️ Le cas de l'onglet plus ancien : `gens` vaut 0. On saute le morceau au lieu
  // d'annoncer « 0 joueur » (une table déserte) ou d'inventer « 1 joueur ».
  ok("ligne : personne compté = aucun morceau, pas « 0 joueur »",
     salonLigne(Object.assign({}, base, { gens: 0 }), "10 €").join(" · "), "chez Léo · 3/8 sièges · min 10 €");
  ok("ligne : hôte sans nom, on reste poli",
     salonLigne(Object.assign({}, base, { hote: "" }), "10 €")[0], "chez quelqu'un");
  // 🚨 LA FRONTIÈRE ANTI-INJECTION EST CHEZ L'APPELANT (`.map(echapper)`), et elle y
  // reste : ce helper ne fabrique aucun balisage, et laisse passer l'entrée telle
  // quelle. Le jour où il rendrait du HTML tout fait, l'échappement de l'appelant
  // deviendrait une double-protection illusoire — le premier test le verrait.
  ok("ligne : le helper n'invente aucun balisage",
     salonLigne(base, "10 €").some(x => /[<>&]/.test(x)), false);
  ok("ligne : l'entrée ressort telle quelle — c'est l'appelant qui échappe",
     salonLigne(Object.assign({}, base, { hote: "<img src=x onerror=alert(1)>" }), "10 €")[0],
     "chez <img src=x onerror=alert(1)>");
}

/* ── Une table complétée par des BOTS doit rester REJOIGNABLE ────────────────────
   L'hôte coche « Compléter les sièges vides » — le geste naturel quand personne
   n'arrive — et sa table sortait du jeu pour toujours : le salon annonçait
   « Complète » (bouton mort) et, sur le lien direct, aucun siège n'offrait de porte.
   La MACHINE, elle, acceptait déjà : `asseoir` cède un siège de bot à un humain. */
{
  const cartes = []; for (let i = 0; i < 312; i++) cartes.push(c("5"));
  const p = creerPartie({ regles: REGLES, hote: "h", cartes, empreinte: "e", miseMin: 10 });
  p.action({ id: "h", a: "asseoir", v: 0, nom: "Hôte" }, 0);
  p.action({ id: "h", a: "bots", v: true }, 0);
  const j = salonJauge(p.etatPublic(0), 1);
  ok("bots : les huit sièges sont occupés", j.pris, NB_SIEGES);
  ok("bots : sept d'entre eux sont des bots", j.bots, NB_SIEGES - 1);
  ok("bots : il reste donc sept places pour un humain", j.libres, NB_SIEGES - 1);
  ok("bots : la machine cède le siège", p.action({ id: "z", a: "asseoir", v: 3, nom: "Zoé" }, 0).ok, true);
  ok("bots : le bot a laissé sa place", [p.etat.sieges[3].nom, p.etat.sieges[3].bot], ["Zoé", false]);

  const humains = { phase: "mise", sieges: Array.from({ length: NB_SIEGES }, (_, i) => ({ id: "h" + i, bot: false })) };
  ok("huit humains : zéro place, le bouton reste mort", salonJauge(humains, 8).libres, 0);
  ok("ligne : les bots se disent", salonLigne({ hote: "L", pris: 8, places: 8, bots: 7, gens: 1, jeu: 0, rachats: -1 }, "10 €").indexOf("7 bots") >= 0, true);
  ok("ligne : un seul bot au singulier", salonLigne({ hote: "L", pris: 8, places: 8, bots: 1, gens: 7, jeu: 0, rachats: -1 }, "10 €").indexOf("1 bot") >= 0, true);
  ok("ligne : sans bot, aucun morceau ajouté", salonLigne({ hote: "L", pris: 3, places: 8, gens: 2, jeu: 0, rachats: -1 }, "10 €").some(x => /bot/.test(x)), false);
  // Un onglet d'avant le 08/09 n'annonce pas `libres` : on retombe sur le comportement
  // d'avant (places − pris), jamais sur 0 — qui grillerait le bouton d'une table ouverte.
  ok("annonce d'un vieil onglet : `libres` se déduit", salonNettoyer({ code: "ABCD1234", pris: 3, places: 8 }).libres, 5);
  ok("annonce d'un vieil onglet : `bots` vaut zéro, pas undefined", salonNettoyer({ code: "ABCD1234", pris: 3, places: 8 }).bots, 0);
  ok("annonce complète : `libres` est repris tel quel", salonNettoyer({ code: "ABCD1234", pris: 8, places: 8, bots: 7, libres: 7 }).libres, 7);
}

/* ── Ce qui vient du courtier PUBLIC est borné ──────────────────────────────────
   La couleur finit dans un attribut `style` et la page n'a aucune CSP : `echap`
   interdit de SORTIR de l'attribut, jamais d'y AJOUTER des déclarations. */
{
  ok("couleur : une couleur hexadécimale passe", [couleurPropre("#f00"), couleurPropre("#8a8f8bcc")], ["#f00", "#8a8f8bcc"]);
  ok("couleur : une déclaration greffée est REFUSÉE", couleurPropre("red;position:fixed;inset:0;z-index:9999"), "");
  ok("couleur : une requête sortante est refusée", couleurPropre("url(https://exemple.test/x)"), "");
  ok("couleur : un nom CSS n'est pas une couleur d'ici", couleurPropre("red"), "");
  ok("couleur : rien du tout reste rien du tout", [couleurPropre(""), couleurPropre(null), couleurPropre(undefined)], ["", "", ""]);
  ok("nom : borné à dix-huit, comme à table", nomPropre("z".repeat(90)).length, 18);
  ok("nom : vide = poli", nomPropre(""), "Joueur");
  // Et la borne s'applique VRAIMENT dans la partie, pas seulement dans le helper.
  const cartes = []; for (let i = 0; i < 312; i++) cartes.push(c("5"));
  const p = creerPartie({ regles: REGLES, hote: "h", cartes, empreinte: "e", miseMin: 10 });
  p.action({ id: "m", a: "asseoir", v: 1, nom: "z".repeat(90), couleur: "red;position:fixed;inset:0" }, 0);
  ok("asseoir : le nom est tronqué", p.etat.sieges[1].nom.length, 18);
  ok("asseoir : la couleur greffée n'atteint pas le siège", p.etat.sieges[1].couleur, "");
}

console.log(`\n${pass} tests passés, ${fail} échecs`);
process.exit(fail ? 1 : 0);

