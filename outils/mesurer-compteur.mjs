// Ce que le COMPTAGE rapporte, MESURÉ — le banc qui prouve les chiffres de la leçon
// /academie/combien-rapporte-le-comptage/ (et le « 0,00x unité par main » cité ailleurs).
//
//   node outils/mesurer-compteur.mjs                     → écrit src/pages/mesures-compteur.json
//   MAINS=3000000 node outils/mesurer-compteur.mjs        → plus vite, moins précis (pour essayer)
//   (19 mesures indépendantes, lancées en PARALLELE processus — ~25 min sur 8 cœurs ; en
//   série ce serait deux heures : chaque mesure est un processus fils, TRAVAIL=<n>)
//
// 🚨 POURQUOI CE FICHIER EST DANS LE DÉPÔT (09/09/2026). La leçon a été écrite avec un
// banc qui vivait dans /tmp : ses chiffres étaient MESURÉS (12 M de mains, 1 000
// carrières), mais personne ne pouvait les REJOUER — la doctrine du dépôt (« chaque
// chiffre publié se prouve contre la source qui le mesure ») exigeait le banc lui-même.
// Il reprend la boucle de src/sim.mjs (même générateur, mêmes règles, même solveur) et y
// ajoute ce que l'avantage maison ne dit pas : le compte Hi-Lo tenu carte par carte, la
// rampe de mise de référence de counting.mjs, l'assurance à son index, les écarts au
// compte de indices.mjs, puis des carrières entières pour le risque de ruine.
// outils/verifier-pages.mjs relit le JSON : un chiffre de la leçon qui n'y est pas est
// une faute — et un JSON dont l'empreinte des sources a changé est PÉRIMÉ.
import { readFileSync, writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { cpus } from "node:os";
import { createHash } from "node:crypto";
import { solve } from "../src/solver.mjs";
import { makeRules } from "../src/engine.mjs";
import { computeIndices } from "../src/indices.mjs";
import { TABLES, reglesDe } from "../src/tables.mjs";
import { SYSTEMES, compteVrai, miseRampe, misesUnites } from "../src/counting.mjs";

const MAINS = +(process.env.MAINS || 12_000_000);
const GRAINE = +(process.env.GRAINE || 20260904);
const MAINS_DECOMP = +(process.env.MAINS_DECOMP || 40_000_000); // la leçon dit « quarante millions de mains »
const CARRIERES = +(process.env.CARRIERES || 1000), MAINS_CARRIERE = 50_000;
const PARALLELE = +(process.env.PARALLELE || Math.max(1, Math.min(8, cpus().length - 2)));
const CAISSES = [50, 100, 200, 400, 600, 1000];
const SORTIE = process.env.SORTIE || "src/pages/mesures-compteur.json";
// La même empreinte que build.mjs pour precalcul.json : changer une table, un système, le
// solveur, la rampe — ou CE FICHIER, dont la boucle de jeu est aussi une source — rend ces
// mesures périmées, et le vérificateur le dira. Oui, éditer un commentaire ici oblige à
// relancer le banc : c'est le prix pour qu'un JSON présent veuille dire « à jour ».
export const SOURCES = ["src/solver.mjs", "src/indices.mjs", "src/sim.mjs", "src/tables.mjs", "src/counting.mjs", "src/engine.mjs", "outils/mesurer-compteur.mjs"];
export const empreinteSources = () => createHash("sha256").update(SOURCES.map(f => readFileSync(f, "utf8")).join(" ")).digest("hex").slice(0, 16);

const VAL = i => i === 0 ? 11 : i + 1;
const bestT = (h, a) => h + (a && h + 10 <= 21 ? 10 : 0);
const TAGS = SYSTEMES.hilo.v;
// La mélangeuse continue : le sabot est rebrassé presque à chaque main, le compte ne
// s'écarte jamais de zéro — c'est ce que 2 % de pénétration modélisent (comme sim.mjs).
const regles = t => { const r = reglesDe(t); return t.melange === "melangeuse_continue" ? { ...r, penetration: 0.02 } : r; };

// opts : { ecarts:false → stratégie de base pure ; assurance:false → jamais d'assurance ;
//          rampe:"intuitive" → misesUnites (celle qui n'ouvre qu'à +3) au lieu de miseRampe ;
//          plafond (12) ; erreurCompteParSabot ; biaisJeux ; aleaJeux ; carrieres, mainsParCarriere }
// Le solveur et la recherche d'index coûtent des dizaines de secondes par règlement ;
// le Boulevard est mesuré neuf fois. On mémorise par règlement — sinon le banc passe
// plus de temps à résoudre qu'à jouer (vécu : 5 min sans une seule main affichée).
const MEMO = new Map();
const memo = (cle, f) => { if (!MEMO.has(cle)) MEMO.set(cle, f()); return MEMO.get(cle); };

export function simCompteur(rulesIn, hands, seed, opts = {}) {
  const rules = makeRules(rulesIn);
  const cle = JSON.stringify(rules);
  const chartJeu = memo("jeu:" + cle, () => solve(Object.assign({}, rules, { surrender: "none" })).chart);
  const { deviations, abandons, insurance } = memo("idx:" + cle, () => computeIndices(rules, TAGS));
  const avecEcarts = opts.ecarts !== false, avecAssurance = opts.assurance !== false && insurance;
  const idxAss = avecAssurance ? insurance.index : Infinity;
  const dev = new Map(), aba = new Map();
  if (avecEcarts) {
    for (const d of deviations) { const k = d.fam + "|" + d.key + "|" + d.up; if (!dev.has(k)) dev.set(k, []); dev.get(k).push(d); }
    for (const [, v] of dev) v.sort((a, b) => a.index - b.index);
    for (const a of abandons) aba.set(a.fam + "|" + a.key + "|" + a.up, a.index);
  }
  const baseJeu = (fam, key, u) => { const c = chartJeu[fam]; return c && c[key] ? c[key][u] : null; };
  const actionAt = (fam, key, u, tc) => {
    const list = dev.get(fam + "|" + key + "|" + u);
    let a = baseJeu(fam, key, u);
    if (list) { a = list[0].de; for (const d of list) if (tc >= d.index) a = d.vers; }
    return a;
  };
  // Sans écarts, l'abandon suit la stratégie de base de la table (avec abandon), comme sim.mjs.
  const chartBase = avecEcarts ? null : memo("base:" + cle, () => solve(rules).chart);

  const D = rules.decks;
  const counts = new Int32Array(10), fresh = new Int32Array(10);
  for (let i = 0; i < 10; i++) fresh[i] = i === 9 ? 16 * D : 4 * D;
  const shoeSize = 52 * D, cut = Math.floor(shoeSize * rules.penetration);
  let left = 0, dealt = 0, rc = 0, erreurPosee = false;
  let s0 = seed >>> 0 || 88675123, s1 = 362436069, s2 = 521288629, s3 = 2463534242;
  const rnd = () => { let t = s3; const s = s0; s3 = s2; s2 = s1; s1 = s;
    t ^= t << 11; t ^= t >>> 8; s0 = t ^ s ^ (s >>> 19); return (s0 >>> 0) / 4294967296; };
  const shuffle = () => { counts.set(fresh); left = shoeSize; dealt = 0; rc = 0; erreurPosee = false; };
  function pick() {
    if (left <= 0) shuffle();
    let r = rnd() * left, i = 0;
    while (r >= counts[i]) { r -= counts[i]; i++; if (i > 9) { i = 9; break; } }
    counts[i]--; left--; dealt++; return i;
  }
  const voir = i => { rc += TAGS[i]; };

  const decide = (h, a, pairIdx, u, canD, canP, canU, tc) => {
    const t = bestT(h, a), soft = a && h + 10 <= 21, th = Math.max(5, Math.min(t, 20));
    if (!avecEcarts) {
      let x = (pairIdx != null && canP) ? chartBase.pair[pairIdx][u] : (soft && chartBase.soft[t]) ? chartBase.soft[t][u] : chartBase.hard[th][u];
      if (x === "P" && !canP) x = soft ? (t >= 19 ? "S" : "H") : chartBase.hard[th][u];
      if (x === "U" && !canU) { const b = chartBase.hard[th][u]; x = b === "U" ? (t >= 17 ? "S" : "H") : b; }
      if (x === "D" && !canD) x = soft ? (t >= 18 ? "S" : "H") : (t >= 17 ? "S" : "H");
      return x;
    }
    if (canU) { const ai = aba.get((pairIdx != null ? "pair|" + pairIdx : soft ? "soft|" + t : "hard|" + th) + "|" + u); if (ai !== undefined && tc >= ai) return "U"; }
    let x = (pairIdx != null && canP) ? actionAt("pair", pairIdx, u, tc) : (soft && chartJeu.soft[t]) ? actionAt("soft", t, u, tc) : actionAt("hard", th, u, tc);
    if (x === "P" && !canP) x = soft ? (t >= 19 ? "S" : "H") : actionAt("hard", th, u, tc);
    if (x === "U") x = t >= 17 ? "S" : "H";
    if (x === "D" && !canD) x = soft ? (t >= 18 ? "S" : "H") : (t >= 17 ? "S" : "H");
    return x;
  };

  const plafond = opts.plafond || 12;
  let played = 0, som = 0, som2 = 0, misesHautes = 0, sommeMises = 0;
  const carrieres = opts.carrieres || 0, mainsParCarriere = opts.mainsParCarriere || 0;
  const finaux = [], creux = [];
  let cumul = 0, minCumul = 0, dansCarriere = 0;
  const compter = gain => { som += gain; som2 += gain * gain;
    if (carrieres) { cumul += gain; if (cumul < minCumul) minCumul = cumul;
      if (++dansCarriere === mainsParCarriere) { finaux.push(cumul); creux.push(minCumul); cumul = 0; minCumul = 0; dansCarriere = 0; shuffle(); } } };
  shuffle();
  const total = carrieres ? carrieres * mainsParCarriere : hands;
  for (let n = 0; n < total; n++) {
    if (dealt >= cut) shuffle();
    if (opts.erreurCompteParSabot && !erreurPosee && dealt > shoeSize * 0.15) { rc += rnd() < 0.5 ? 1 : -1; erreurPosee = true; }
    let jr = left / 52;
    if (opts.biaisJeux) jr = Math.max(0.1, jr + opts.biaisJeux);
    if (opts.aleaJeux) jr = Math.max(0.1, jr + (rnd() < 0.5 ? -opts.aleaJeux : opts.aleaJeux));
    const tc = compteVrai(rc, jr);
    const mise = opts.rampe === "intuitive" ? misesUnites(tc, plafond) : miseRampe(tc, plafond);
    sommeMises += mise; if (mise > 1) misesHautes++;
    const p = [pick(), pick()], up = pick(), hole = pick();
    played++;
    let gain = 0, holeVu = false;
    voir(p[0]); voir(p[1]); voir(up);
    const vraiBJ = (VAL(up) === 11 && VAL(hole) === 10) || (VAL(up) === 10 && VAL(hole) === 11);
    const dealerBJ = rules.peek && vraiBJ;
    const playerBJ = (VAL(p[0]) + VAL(p[1]) === 21);
    if (rules.peek && VAL(up) === 11 && tc >= idxAss) gain += (VAL(hole) === 10) ? mise : -0.5 * mise;
    if (playerBJ || dealerBJ) {
      if (dealerBJ) { voir(hole); holeVu = true; }
      gain += (playerBJ && (dealerBJ || (!rules.peek && vraiBJ))) ? 0 : playerBJ ? rules.blackjackPays * mise : -mise;
      if (!rules.peek && vraiBJ && !holeVu) voir(hole);
      compter(gain); continue;
    }
    const H0 = [VAL(p[0]) === 11 ? 1 : VAL(p[0]), p[0] === 0, 0, 0, 0, 0, 0];
    H0[0] += (p[1] === 0 ? 1 : VAL(p[1])); H0[1] = H0[1] || p[1] === 0;
    const hands_ = [H0];
    H0.pairIdx = (rules.splitByRank ? p[0] === p[1] : VAL(p[0]) === VAL(p[1])) ? p[0] : null;
    for (let hi = 0; hi < hands_.length; hi++) {
      const H = hands_[hi];
      for (;;) {
        const t = bestT(H[0], H[1]);
        if (t > 21) break;
        const two = (H.cards2 !== false);
        const canP = H.pairIdx != null && hands_.length < rules.maxHands && !(H[6] && !rules.hitSplitAces);
        const canD = two && (rules.doubleOn === "any" || rules.doubleOn.includes(t)) && !(H[5] && !rules.das) && !(H[6] && !rules.hitSplitAces);
        const canU = rules.surrender !== "none" && two && !H[5] && hands_.length === 1;
        if (H[6] && !rules.hitSplitAces) break;
        const x = decide(H[0], H[1], canP ? H.pairIdx : null, up, canD, canP, canU, tc);
        if (x === "S") break;
        if (x === "U") { H[4] = 1; break; }
        if (x === "P") {
          const pi = H.pairIdx;
          const nh = [pi === 0 ? 1 : VAL(pi), pi === 0, 0, 0, 0, 1, pi === 0];
          H[0] = pi === 0 ? 1 : VAL(pi); H[1] = pi === 0; H[5] = 1; H[6] = pi === 0; H.pairIdx = null; H.cards2 = undefined;
          const c1 = pick(); voir(c1); H[0] += c1 === 0 ? 1 : VAL(c1); H[1] = H[1] || c1 === 0;
          H.pairIdx = (rules.splitByRank ? c1 === pi : VAL(c1) === VAL(pi)) ? pi : null;
          const c2 = pick(); voir(c2); nh[0] += c2 === 0 ? 1 : VAL(c2); nh[1] = nh[1] || c2 === 0;
          nh.pairIdx = (rules.splitByRank ? c2 === pi : VAL(c2) === VAL(pi)) ? pi : null;
          hands_.splice(hi + 1, 0, nh); continue;
        }
        if (x === "D") { const c = pick(); voir(c); H[0] += c === 0 ? 1 : VAL(c); H[1] = H[1] || c === 0; H[3] = 1; H.cards2 = false; break; }
        const c = pick(); voir(c); H[0] += c === 0 ? 1 : VAL(c); H[1] = H[1] || c === 0; H.cards2 = false; H.pairIdx = null;
      }
    }
    const vivants = hands_.some(H => !H[4] && bestT(H[0], H[1]) <= 21);
    let dh = (VAL(up) === 11 ? 1 : VAL(up)) + (VAL(hole) === 11 ? 1 : VAL(hole));
    let da = up === 0 || hole === 0;
    if (vivants) {
      voir(hole); holeVu = true;
      for (;;) {
        const t = bestT(dh, da), soft = da && dh + 10 <= 21;
        if (t > 21) break;
        if (t > 17 || (t === 17 && !(rules.h17 && soft))) break;
        const c = pick(); voir(c); dh += c === 0 ? 1 : VAL(c); da = da || c === 0;
      }
    }
    const dt = bestT(dh, da);
    if (!rules.peek && vraiBJ) {
      if (!holeVu) voir(hole);
      for (const H of hands_) { if (H[4]) { gain -= 0.5 * mise; continue; } gain -= (rules.enhcLosesAll ? (H[3] ? 2 : 1) : 1) * mise; }
    } else {
      for (const H of hands_) {
        const bet = mise * (H[3] ? 2 : 1);
        if (H[4]) { gain -= 0.5 * mise; continue; }
        const t = bestT(H[0], H[1]);
        if (t > 21) { gain -= bet; continue; }
        if (dt > 21 || t > dt) gain += bet; else if (t < dt) gain -= bet;
      }
    }
    compter(gain);
  }
  const ev = som / played, va = som2 / played - ev * ev;
  return { ev, sd: Math.sqrt(va), played, partHautes: misesHautes / played, miseMoy: sommeMises / played, finaux, creux, idxAss: isFinite(idxAss) ? idxAss : null };
}

// ── Les 19 mesures, chacune indépendante (sa graine, ses options) ─────────────────────
const TRAVAUX = () => {
  const B = TABLES.find(t => t.id === "boulevard"), rB = regles(B), l = [];
  // Les plus longues d'abord : c'est elles qui fixent la durée totale.
  l.push({ cle: "boulevard.carrieres", nom: "carrières", regles: rB, mains: 0, graine: 777001, opts: { carrieres: CARRIERES, mainsParCarriere: MAINS_CARRIERE } });
  l.push({ cle: "boulevard.decomposition.mise_plate", nom: "mise plate", regles: rB, mains: MAINS_DECOMP, graine: GRAINE, opts: { plafond: 1, ecarts: false, assurance: false } });
  l.push({ cle: "boulevard.decomposition.rampe_seule", nom: "rampe seule", regles: rB, mains: MAINS_DECOMP, graine: GRAINE, opts: { ecarts: false, assurance: false } });
  l.push({ cle: "boulevard.decomposition.rampe_assurance", nom: "rampe + assurance", regles: rB, mains: MAINS_DECOMP, graine: GRAINE, opts: { ecarts: false } });
  l.push({ cle: "boulevard.decomposition.parfait", nom: "parfait (+ écarts)", regles: rB, mains: MAINS_DECOMP, graine: GRAINE, opts: {} });
  l.push({ cle: "boulevard.rampe_intuitive", nom: "rampe intuitive (ouvre à +3)", regles: rB, mains: MAINS, graine: GRAINE, opts: { rampe: "intuitive" } });
  // Le Boulevard n'est PAS remesuré ici : sa ligne du tableau des tables EST la mesure
  // « parfait » de la décomposition (40 M de mains). Deux mesures du même jeu, à deux
  // volumes, s'arrondiraient un jour différemment — la page se contredirait elle-même.
  for (const t of TABLES) if (t.id !== "boulevard") l.push({ cle: "tables." + t.id, nom: t.nom, regles: regles(t), mains: MAINS, graine: GRAINE, opts: {} });
  l.push({ cle: "boulevard.fragilite.erreur_par_sabot", nom: "une erreur de compte par sabot", regles: rB, mains: MAINS, graine: GRAINE, opts: { erreurCompteParSabot: 1 } });
  l.push({ cle: "boulevard.fragilite.demi_jeu_au_hasard", nom: "jeux restants ± un demi au hasard", regles: rB, mains: MAINS, graine: GRAINE, opts: { aleaJeux: 0.5 } });
  l.push({ cle: "boulevard.fragilite.demi_jeu_de_trop", nom: "un demi-jeu de trop", regles: rB, mains: MAINS, graine: GRAINE, opts: { biaisJeux: 0.5 } });
  l.push({ cle: "boulevard.fragilite.demi_jeu_de_moins", nom: "un demi-jeu de moins", regles: rB, mains: MAINS, graine: GRAINE, opts: { biaisJeux: -0.5 } });
  return l;
};
const r6 = x => +x.toFixed(6), r3 = x => +x.toFixed(3), r4 = x => +x.toFixed(4);
const resume = s => ({ ev: r6(s.ev), sd: r3(s.sd), ic95: r6(1.96 * s.sd / Math.sqrt(s.played)), part_mises_hautes: r4(s.partHautes), mise_moyenne: r3(s.miseMoy), mains: s.played });
// Une mesure = un objet JSON autoportant (ce que le fichier final range sous sa clé).
const mesurer = w => {
  const s = simCompteur(w.regles, w.mains, w.graine, w.opts);
  if (w.opts.carrieres) {
    const f = s.finaux.slice().sort((a, b) => a - b);
    const q = p => Math.round(f[Math.min(f.length - 1, Math.floor(p * f.length))]);
    const ruine = {}; for (const B0 of CAISSES) ruine[B0] = r4(s.creux.filter(x => x <= -B0).length / s.creux.length);
    return { n: w.opts.carrieres, mains: w.opts.mainsParCarriere, graine: w.graine, ev: r6(s.ev), sd: r3(s.sd),
      pire: Math.round(f[0]), decile_1: q(0.10), mediane: q(0.50), decile_9: q(0.90), meilleure: Math.round(f[f.length - 1]),
      moyenne: Math.round(f.reduce((a, b) => a + b, 0) / f.length), part_negative: r4(f.filter(x => x < 0).length / f.length), ruine };
  }
  return { ...(w.cle.startsWith("tables.") ? { nom: w.nom } : {}), ...resume(s), index_assurance: s.idxAss };
};
const poser = (o, chemin, v) => { const k = chemin.split("."); let c = o; for (const x of k.slice(0, -1)) c = c[x] ??= {}; c[k[k.length - 1]] = v; };

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const travaux = TRAVAUX(), dire = s => process.stderr.write(s + "\n");
  if (process.env.TRAVAIL !== undefined) {
    // Mode fils : UNE mesure, résultat JSON sur stdout.
    process.stdout.write(JSON.stringify(mesurer(travaux[+process.env.TRAVAIL])));
  } else {
    const t0 = Date.now();
    const sortie = { genere: new Date().toISOString().slice(0, 10), empreinte: empreinteSources(), graine: GRAINE, mains: MAINS, mains_decomposition: MAINS_DECOMP,
      rampe: "miseRampe : deux unités par point de compte vrai au-dessus de +1, plafond 12", systeme: "hilo", tables: {}, boulevard: {} };
    dire(`${travaux.length} mesures (comptage Hi-Lo : rampe + assurance + écarts), ${MAINS.toLocaleString("fr-FR")} mains par table, ${MAINS_DECOMP.toLocaleString("fr-FR")} pour la décomposition, ${CARRIERES} carrières — ${PARALLELE} processus, graine ${GRAINE}`);
    const fils = i => new Promise((res, rej) => execFile(process.execPath, [process.argv[1]], { env: { ...process.env, TRAVAIL: String(i) }, maxBuffer: 1 << 24 }, (e, out, err) => {
      if (e) return rej(new Error(`${travaux[i].nom} : ${err || e.message}`));
      const m = JSON.parse(out); poser(sortie, travaux[i].cle, m);
      const ev = m.ev, ic = m.ic95 !== undefined ? ` ±${m.ic95.toFixed(4)}` : "";
      dire(`  ${travaux[i].nom.padEnd(34)} ${(ev >= 0 ? "+" : "") + ev.toFixed(4)}${ic}  sd=${m.sd.toFixed(2)}  ${Math.round((Date.now() - t0) / 1000)} s`);
      res();
    }));
    let suivant = 0;
    const ouvrier = async () => { while (suivant < travaux.length) await fils(suivant++); };
    await Promise.all(Array.from({ length: Math.min(PARALLELE, travaux.length) }, ouvrier));
    // Le Boulevard de la liste des tables est le même que « parfait » de la décomposition,
    // mesuré moins longtemps : les deux figurent, chacun avec son intervalle.
    sortie.tables.boulevard = { nom: TABLES.find(t => t.id === "boulevard").nom, ...sortie.boulevard.decomposition.parfait };
    const c = sortie.boulevard.carrieres;
    dire(`carrières : pire ${c.pire} · d1 ${c.decile_1} · médiane ${c.mediane} · d9 ${c.decile_9} · meilleure ${c.meilleure} · négatives ${(c.part_negative * 100).toFixed(1)} %`);
    for (const B0 of CAISSES) dire(`  caisse ${String(B0).padStart(4)} : ${(c.ruine[B0] * 100).toFixed(1)} % ruinés`);
    writeFileSync(SORTIE, JSON.stringify(sortie, null, 1) + "\n");
    dire(`${SORTIE} écrit — ${Math.round((Date.now() - t0) / 1000)} s`);
  }
}
