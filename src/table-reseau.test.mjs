// La table à plusieurs, SANS réseau : un hôte et des invités en mémoire, reliés par une
// file de messages qu'on livre à la main. Tout est déterministe : le sabot est écrit
// d'avance, l'horloge est un nombre qu'on avance.
//   node src/table-reseau.test.mjs
import * as E from "./engine.mjs";
import { creerPartie, creerSalle, codeSalon, formaterCode, normaliserCode, codeValide, MISE_DELAI, ELECTION_DELAI, TAPIS_DEPART } from "./table-reseau.mjs";

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
  ok("trois sièges tenus, deux vides", dernier(C).sieges.map(s => s ? s.nom : null), ["Bea", null, "Hugo", null, "Cyril"]);
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
  ok("les bots complètent les sièges vides quand l'hôte le demande", dernier(S).sieges.map(s => s && s.bot), [true, true, false, true, true]);
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

console.log(`\n${pass} tests passés, ${fail} échecs`);
process.exit(fail ? 1 : 0);
