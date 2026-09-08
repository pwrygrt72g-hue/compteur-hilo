// Banc de mesure responsive, sans dépendance : Node 22 a WebSocket en natif.
//
// ⚠️ `--window-size` est IGNORÉ par le headless de Chrome en `--dump-dom` — toutes
// les mesures rendent alors la même taille quelle que soit celle demandée, et un
// relevé « responsive » fait comme ça mesure toujours le même écran. Il faut passer
// par le protocole DevTools et `Emulation.setDeviceMetricsOverride`.
//
//   node outils/mesurer.mjs [vue…]
//
// « reseau » est une vue de plus : la table À PLUSIEURS (transport muet, deux amis
// fictifs assis, vignettes vidéo en attente), soumise aux MÊMES assertions que la table
// solo — elle doit tenir dans un écran avec ses têtes. À mettre en DERNIER : elle
// laisse la scène en mode réseau (on quitte la table à la fin, mais on ne rejoue pas la donne).
//
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { extname } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
// Ports tirés au sort : deux agents doivent pouvoir mesurer en même temps (le port fixe
// sérialisait tout le monde derrière un seul banc, cf. capturer.mjs qui tire déjà au sort).
const PORT = 8950 + Math.floor(Math.random() * 200), CDP = 9650 + Math.floor(Math.random() * 200);
const TAILLES = [
  ["téléphone étroit", 360, 640], ["iPhone SE", 375, 667], ["iPhone 14", 390, 844],
  ["TÉLÉPHONE COUCHÉ", 844, 390], ["tablette portrait", 768, 1024],
  ["tablette paysage", 1024, 768], ["portable", 1280, 800], ["grand écran", 1920, 1080],
];
const VUES = process.argv.slice(2).length ? process.argv.slice(2)
  // 🚨 « reseau » est DANS la liste par défaut, en DERNIER. L'en-tête ci-dessus la présente
  // depuis toujours comme « soumise aux MÊMES assertions » — elle ne l'était pas : il fallait
  // la nommer à la main, ce que la consigne des agents ne demande pas. La table à plusieurs
  // (huit sièges, vignettes vidéo) n'était donc couverte par AUCUN banc dans le geste
  // habituel : elle ne pouvait pas échouer, mais personne ne l'aurait su.
  : ["accueil", "salon", "table", "exercices", "strategie", "concentration", "ensemble", "progres", "dons", "reseau"];

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
const serveur = createServer((q, r) => {
  const f = (q.url === "/" ? "/index.html" : q.url).split("?")[0].replace(/\.\./g, "");
  let corps; try { corps = readFileSync("." + f); } catch (e) { r.writeHead(404); return r.end("non"); }
  r.writeHead(200, { "content-type": TYPES[extname(f)] || "text/plain" }); r.end(corps);
}).listen(PORT);

const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-sandbox",
  "--remote-debugging-port=" + CDP, "--remote-allow-origins=*", "about:blank"], { stdio: "ignore" });

const dodo = ms => new Promise(r => setTimeout(r, ms));
const attendre = async (url, n = 60) => {
  for (let i = 0; i < n; i++) { try { return await (await fetch(url)).json(); } catch (e) { await dodo(250); } }
  throw new Error("Chrome ne répond pas sur " + url);
};

const cibles = await attendre(`http://127.0.0.1:${CDP}/json/list`);
const ws = new WebSocket(cibles.find(c => c.type === "page").webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener("open", r));
let id = 0; const attentes = new Map();
ws.addEventListener("message", e => {
  const m = JSON.parse(e.data);
  if (m.id && attentes.has(m.id)) { attentes.get(m.id)(m); attentes.delete(m.id); }
});
const cdp = (method, params = {}) => new Promise(res => {
  const n = ++id; attentes.set(n, res); ws.send(JSON.stringify({ id: n, method, params }));
});
const evaluer = async expr => {
  const r = await cdp("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result && r.result.exceptionDetails) return { erreur: r.result.exceptionDetails.text };
  return r.result && r.result.result ? r.result.result.value : null;
};

await cdp("Page.enable"); await cdp("Runtime.enable");

// Une mesure sur un écran POSÉ. Un jeton encore EN VOL (le rail est sous le feutre : il part de
// y = 776 sur une fenêtre de 800) faisait dépasser le document de 27 px — un défaut « 1,04 écran »
// qui n'existait qu'une fois sur deux, selon que la sonde tombait pendant ou après le vol (mesuré le
// 05/09, 1280 × 800, Salon Privé). On attend que plus aucun jeton ne vole, 2,5 s au plus.
//
// 🚨 …ET SUR UNE POLICE PEINTE. Les trois fontes viennent de Google Fonts : tant que la fonte
// de repli n'a pas été remplacée, les métriques diffèrent d'un pixel. Mesuré le 07/09 : les
// MÊMES boutons d'« Exercices » font 33 px au lieu de 34, et la tolérance du banc
// (`^BUTTON \d+×3[4-9]$`) ne couvre que l'état peint — donc le banc invente un défaut. Trois
// passages d'affilée ont donné trois verdicts DIFFÉRENTS sur un dépôt inchangé : propre,
// « SUMMARY 1080×44 », puis trois « BUTTON 95×33 ». Un banc qui échoue au hasard ne prouve plus
// rien, et il empêche surtout de savoir si le changement qu'on vient d'écrire a cassé quelque
// chose. `document.fonts.ready` résout quand le chargement est terminé ; les deux images
// d'attente laissent la mise en page se refaire avec les nouvelles métriques.
// ⚠️ Plafonné comme le reste : une police injoignable doit laisser passer la mesure, pas la geler.
const POSE = `(async () => {
  const dodo = ms => new Promise(r => setTimeout(r, ms));
  const image = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  await Promise.race([document.fonts.ready, dodo(3000)]);
  await image();
  return new Promise(res => { const t0 = performance.now(); const tic = () => {
    const n = document.querySelectorAll("#jetonsCalque .jt-vol").length;
    if (!n || performance.now() - t0 > 2500) res(n); else setTimeout(tic, 80); }; tic(); });
})()`;

// La sonde : ce qui compte pour juger un écran, pas ce qui est facile à mesurer.
const SONDE = `(() => {
  const q = s => document.querySelector(s);
  const vh = innerHeight, vw = innerWidth;
  const doc = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  const dep = [...document.querySelectorAll("body *")].filter(e => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && (r.right > vw + 1 || r.left < -1);
  }).slice(0, 4).map(e => (e.id ? "#" + e.id : e.className && typeof e.className === "string" ? "." + e.className.split(" ")[0] : e.tagName));
  const y = s => { const e = q(s); if (!e) return null; const r = e.getBoundingClientRect(); return Math.round(r.bottom); };
  const h = s => { const e = q(s); if (!e) return null; return Math.round(e.getBoundingClientRect().height); };
  // Une case à cocher ou un bouton radio DANS un <label> : c'est le label qui reçoit le
  // doigt (cliquer le texte coche la case), donc c'est LUI qu'on mesure — nommé par l'id
  // de la case, pour retrouver le champ. Une case nue, hors label, reste mesurée telle quelle.
  const cible = e => (e.matches("input[type=checkbox],input[type=radio]") && e.closest("label")) || e;
  const petits = [...document.querySelectorAll("button:not([hidden]), input, select, summary")]
    // 🚨 UNE DEMI-DÉCIMALE DE TOLÉRANCE, sinon le banc crie au loup. Un élément qui
    // mesure EXACTEMENT 44 (un <summary> des Exercices) rend tantôt 44, tantôt 43,99
    // selon l'arrondi sous-pixel du moteur : mesuré le 07/09, deux passages d'affilée sur
    // un arbre INCHANGÉ, l'un vert et l'autre rouge. C'est le même défaut que la bascule
    // à 33,5 px des boutons, corrigée deux jours plus tôt — un banc qui échoue au hasard
    // finit par n'être plus lu, et c'est alors qu'il rate un vrai défaut.
    .filter(e => { const r = cible(e).getBoundingClientRect(); return r.width > 0 && (r.height < 43.5 || r.width < 23.5); })
    // 🚨 UNE DÉCIMALE SUR LA HAUTEUR, et ce n'est pas de la coquetterie. Les boutons
    // d'« Exercices » mesurent EXACTEMENT 33,500 px (mesuré quatre fois de suite, police
    // Archivo peinte, valeur identique au millième). Un arrondi de 33,5 rend 34 ou 33 selon
    // le dernier bit du calcul de mise en page — et la tolérance ci-dessous, écrite contre la
    // CHAÎNE arrondie, basculait avec lui : trois passages sur un dépôt inchangé donnaient
    // trois verdicts différents. La géométrie était déterministe, c'est l'arrondi qui ne
    // l'était pas. Une décimale déplace la comparaison hors de la frontière.
    .map(e => { const r = cible(e).getBoundingClientRect(); return (e.id || e.className || e.tagName) + " " + Math.round(r.width) + "×" + (Math.round(r.height * 10) / 10); });
  const largeurDoc = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  // Ce qui dépasse EN BAS de la fenêtre (le document fait plus d'un écran) : nommé, sinon on
  // cherche à l'aveugle. Mesuré le 05/09 : « 1,07 écran » au Salon Privé à 1024 × 768 sans savoir quoi.
  const depasseBas = [...document.querySelectorAll("body *")].filter(e => {
    const r = e.getBoundingClientRect();
    return r.height > 0 && r.bottom + scrollY > vh + 2 && getComputedStyle(e).display !== "none";
  }).slice(0, 5).map(e => { const r = e.getBoundingClientRect(); return (e.id ? "#" + e.id : e.className && typeof e.className === "string" ? "." + e.className.split(" ")[0] : e.tagName) + " " + Math.round(r.top + scrollY) + "→" + Math.round(r.bottom + scrollY); });
  // L'écart entre les cartes du croupier et les tiennes (au Salon Privé à 1280 × 800, mesuré le 05/09 :
  // 1 px), et le lettrage doré du feutre (« BLACKJACK PAIE 3 CONTRE 2 » n'était jamais dessiné).
  const dm = q("#dMain"), tm = q(".siege.toi .main"), rdm = dm && dm.getBoundingClientRect(), rtm = tm && tm.getBoundingClientRect();
  const ecartCroupier = rdm && rtm && rdm.height && rtm.height ? Math.round(rtm.top - rdm.bottom) : null;
  const lettrage = (q("#lettrage") || {}).textContent || "";
  // Pourquoi l'arc n'est pas là, quand il n'est pas là : la clé et la mesure du dernier rendu
  // (table.js expose LETTRAGE) — sans elles, un feutre nu une fois sur trois ne s'explique pas.
  const L = window.__lettrage || {}, lettrageInfo = (L.cle || "").slice(0, 60) + " " + JSON.stringify(L.mesure || null);
  const wTable = q("#plateau") ? parseFloat(getComputedStyle(q("#plateau")).getPropertyValue("--w-table")) || null : null;
  // 🚨 LE NOM D'UN SIÈGE PEUT ÊTRE EFFACÉ PAR L'ARC DU FEUTRE. Mesuré au pixel à 1280 × 800,
  // table à cinq : « JOUEUR » (le siège de gauche, LE TIEN par défaut) et « KARIM » (celui
  // de droite) étaient peints ENTIÈREMENT hors de la demi-lune, donc retirés par son clip —
  // pas atténués, absents, leur mise avec. Or c'est là que la voix pose son signal
  // principal (« qui parle » = le nom en jade). elementsFromPoint au PLURIEL : un bandeau
  // qui passe par-dessus ne compte pas, on cherche un nom RETIRÉ de la pile.
  // ⚠️ « Hors fenêtre » ne suffit pas : sous 1000 px la rangée devient une PELLICULE qui
  // défile (style.css), et ses sièges débordent LARGEMENT de leur boîte visible tout en
  // restant dans la fenêtre. Mesuré à 375 × 667 : le défileur va de x=52 à x=323, or
  // « Sonia » pose son nom à x=43 et « Karim » à x=332 — dehors des deux côtés, donc
  // hors du clip, donc intouchables. Les compter « effacés par l'arc » était faux : ils
  // sont simplement plus loin dans le défilement. On borne donc par la boîte du défileur,
  // et SEULEMENT quand il clippe pour de vrai — au bureau (≥ 1000 px) #sieges ne clippe
  // rien, le garde est inerte, et un nom vraiment mangé par la demi-lune sort toujours.
  const rangee = q("#sieges"), boiteRangee = rangee ? rangee.getBoundingClientRect() : null;
  const rangeeClippe = rangee ? getComputedStyle(rangee).overflowX !== "visible" : false;
  const nomsEffaces = [...document.querySelectorAll("#sieges .siege")].map(d => {
    const n = d.querySelector(".nom"); if (!n) return null;
    const r = n.getBoundingClientRect(); if (!r.width || !r.height) return null;
    const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
    if (x < 2 || y < 2 || x > vw - 2 || y > vh - 2) return null;   // hors fenêtre : plus loin, pas effacé
    if (rangeeClippe && (x < boiteRangee.left + 2 || x > boiteRangee.right - 2)) return null;  // hors du défilement
    return document.elementsFromPoint(x, y).some(e => d.contains(e)) ? null : ((n.textContent || "").trim() || "?");
  }).filter(Boolean);
  return { vw, vh, doc, defile: Math.max(0, doc - vh), ecrans: +(doc / vh).toFixed(2), ecartCroupier, wTable, nomsEffaces, lettrage: lettrage.replace(/\s+/g, " ").trim(), depasseBas, lettrageInfo,
    deborde: largeurDoc > vw + 1 ? dep : [], largeurDoc, hEntete: h("header"),
    yCoups: y("#coups"), hTapis: h("#plateau"), hSieges: h("#sieges"),
    bandes: { tete: h(".tete"), padHaut: q("header") ? parseFloat(getComputedStyle(q("header")).paddingTop) : null,
      barre: h(".hud"), salle: h(".salle"), haute: h(".rangee-haute"), annonce: h("#annonce"), conseil: h("#conseil"),
      actions: h(".zone-actions"), vTable: h("#v-table"), main: h("main") },
    petits: [...new Set(petits)].slice(0, 6) };
})()`;

const MISER = `(async () => { const q = s => document.querySelector(s), dodo = ms => new Promise(r => setTimeout(r, ms));
  for (let g = 0; g < 30 && q("#bDonne") && q("#bDonne").disabled; g++) {
    const rack = q("#rackJetons"), min = rack ? +(rack.dataset.min || 5) : 5;
    const libres = [...document.querySelectorAll("#rjJetons button:not([disabled])")];
    const j = libres.find(b => +b.dataset.v >= min) || libres[libres.length - 1];
    if (!j) break; j.click(); await dodo(90);
  } })()`;
const rapport = [];
for (const [nom, L, H] of TAILLES) {
  await cdp("Emulation.setDeviceMetricsOverride", { width: L, height: H, deviceScaleFactor: 1, mobile: L < 900 });
  await cdp("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html` });
  await dodo(1400);
  for (const v of VUES) {
    if (v === "reseau") {
      await evaluer(`(document.querySelector('nav [data-vue="ensemble"]')||{click(){}}).click()`); await dodo(300);
      await evaluer(`window.__reseauTransport = o => { window.__reseauEntrant = o.onMessage; return { publier() {}, fermer() {} }; }; document.getElementById("mpCreer").click()`); await dodo(1500);
      await evaluer(`(document.querySelector("#sieges .siege.vide .asseoir")||{click(){}}).click()`); await dodo(500);
      await evaluer(`(() => { const r = window.__reseauEntrant; if (!r) return; for (const [id, nom, c, k] of [["jAmi1", "Sonia", "#c0392b", 2], ["jAmi2", "Karim", "#1f6f4a", 4]]) { r({ t: "salut", id, nom, couleur: c }); r({ t: "action", id, a: "asseoir", v: k, nom, couleur: c }); } })()`);
      await dodo(700); await evaluer(MISER); await dodo(400);
      const m = (await evaluer(POSE), await evaluer(SONDE));
      if (m && !m.erreur) rapport.push({ taille: nom, L, H, vue: v, ...m });
      await evaluer(`document.getElementById("bReseau").click()`); await dodo(200);
      await evaluer(`(document.getElementById("rsQuitter")||{click(){}}).click()`); await dodo(800);
      continue;
    }
    await evaluer(`(document.querySelector('nav [data-vue="${v}"]')||{click(){}}).click()`);
    await dodo(v === "table" ? 900 : 350);
    // 🚨 Depuis le 08/09 les dix portes de tables, les trois onglets de filtre et les dix
    // « Pourquoi ? » vivent dans un <details>. Replié, leur rect est NUL : ils sortent
    // purement et simplement du banc (la récolte filtre sur `r.width > 0`), et la mesure
    // annonce « tout passe » sans les avoir regardés. On l'ouvre INCONDITIONNELLEMENT —
    // pas en s'appuyant sur l'ouverture « pour qui revient », qui dépend de DB et
    // rendrait le banc non déterministe d'une taille d'écran à l'autre.
    if (v === "accueil" || v === "salon") {
      await evaluer(`{ const d = document.getElementById("lesTables"); if (d) d.open = true; }`);
      await dodo(250);
    }
    // La donne exige une mise (lot Jetons) : on tape un jeton qui couvre le minimum avant de distribuer.
    if (v === "table") { await evaluer(MISER); await dodo(300); await evaluer(`(document.getElementById("bDonne")||{click(){}}).click()`); await dodo(2600); }
    const m = (await evaluer(POSE), await evaluer(SONDE));
    if (m && !m.erreur) rapport.push({ taille: nom, L, H, vue: v, ...m });
    // Le Salon Privé (trois sièges) : la même donne, la même sonde — c'est la table où les cartes du
    // croupier touchaient les tiennes (les critiques, 05/09). On y va par le hall, on en revient pareil.
    if (v === "table") {
      await evaluer(`(document.querySelector('nav [data-vue="salon"]')||{click(){}}).click()`); await dodo(300);
      await evaluer(`{ const d = document.getElementById("lesTables"); if (d) d.open = true; }`); await dodo(200);
      await evaluer(`(document.querySelector('#salon [data-asseoir="salonprive"]')||{click(){}}).click()`); await dodo(900);
      await evaluer(MISER); await dodo(300); await evaluer(`(document.getElementById("bDonne")||{click(){}}).click()`); await dodo(2600);
      const m3 = (await evaluer(POSE), await evaluer(SONDE));
      if (m3 && !m3.erreur) rapport.push({ taille: nom, L, H, vue: "table3", ...m3 });
      await evaluer(`(document.querySelector('nav [data-vue="salon"]')||{click(){}}).click()`); await dodo(300);
      await evaluer(`{ const d = document.getElementById("lesTables"); if (d) d.open = true; }`); await dodo(200);
      await evaluer(`(document.querySelector('#salon [data-asseoir="boulevard"]')||{click(){}}).click()`); await dodo(600);
    }
  }
}

console.log("\n" + "═".repeat(96));
console.log("ÉCRANS À DÉFILER — 1,0 signifie « tout tient dans la fenêtre »");
console.log("═".repeat(96));
const vues = [...new Set(rapport.map(r => r.vue))];
process.stdout.write("vue".padEnd(16));
for (const [n, L, H] of TAILLES) process.stdout.write((L + "×" + H).padStart(11));
console.log();
for (const v of vues) {
  process.stdout.write(v.padEnd(16));
  for (const [n, L, H] of TAILLES) {
    const r = rapport.find(x => x.vue === v && x.L === L && x.H === H);
    const e = r ? r.ecrans : null;
    process.stdout.write((e === null ? "—" : (e > 1.05 ? "▲" : " ") + e.toFixed(2) + "×").padStart(11));
  }
  console.log();
}
const pb = rapport.filter(r => r.deborde.length);
console.log("\nDÉBORDEMENTS HORIZONTAUX :", pb.length ? pb.map(r => `${r.L}×${r.H}/${r.vue} → ${r.deborde.join(",")}`).join(" · ") : "aucun");
const t = rapport.filter(r => r.vue === "table" || r.vue === "table3" || r.vue === "reseau");
console.log("\nTABLE — hauteur d'en-tête · bas des coups · feutre · sièges (« reseau » = la table à plusieurs, avec ses vignettes)");
for (const r of t) { const b = r.bandes;
  console.log(`  ${(r.L + "×" + r.H).padEnd(10)}${r.vue === "reseau" ? " (à plusieurs)" : r.vue === "table3" ? " (Salon Privé, 3 sièges)" : ""} entête ${String(r.hEntete).padStart(4)} px (tete ${b.tete}, pad ${b.padHaut}) · coups à y=${String(r.yCoups).padStart(5)} (fenêtre ${r.vh}) ${r.yCoups > r.vh ? "❌ HORS ÉCRAN" : "✓"} · feutre ${r.hTapis} · sièges ${r.hSieges}`);
  console.log(`             bandes : barre ${b.barre} · salle ${b.salle} · rangée haute ${b.haute} · annonce ${b.annonce} · conseil ${b.conseil} · actions ${b.actions} · #v-table ${b.vTable} · main ${b.main}`);
  console.log(`             croupier → ta main : ${r.ecartCroupier === null ? "—" : r.ecartCroupier + " px"} (carte ${r.wTable} px) · lettrage : ${r.lettrage ? "« " + r.lettrage.slice(0, 60) + " »" : "AUCUN"}`); }
const cibles44 = [...new Set(rapport.flatMap(r => r.petits))];
console.log("\nCIBLES TACTILES SOUS 44 px :", cibles44.length ? cibles44.slice(0, 10).join(" · ") : "aucune");

// ── Assertions ────────────────────────────────────────────────────────────
// Le banc IMPRIMAIT ; il ne tombait pas. Six des sept chantiers sont de la mise
// en page : sans assertion par taille, tout se vérifie à l'œil, donc jamais.
// Ordinateur d'abord (Léo, 04/09) : les assertions ne portent que sur les tailles
// ≥ 1024 px. Les lignes téléphone restent IMPRIMÉES — de l'information, pas un
// verdict — jusqu'au jour où le téléphone entre dans le périmètre.
const LARGEUR_STRICTE = 1024;
const echecs = [], infos = [];
let courant = null;
const exiger = (cond, msg) => { if (!cond) (courant && courant.L >= LARGEUR_STRICTE ? echecs : infos).push(msg); };
// Cibles tactiles tolérées sous 44 px : les puces de nav (38 px, scroll-snap),
// la marque (un lien, pas un bouton d'action), et les entrées de formulaire.
// ⚠️ La borne basse est 33, pas 34 : les boutons d'« Exercices » font 33,5 px depuis toujours.
// L'auteur avait écrit `3[4-9]` en lisant « 34 » à l'écran — un arrondi, pas une mesure.
// La partie décimale est optionnelle : une hauteur ronde n'en porte pas.
const TOLERE = /^(marque|prenom|eJeux|sys)\b|^BUTTON \d+×3[3-9](\.\d)?$/;
for (const r of rapport) {
  courant = r;
  const ou = `${r.L}×${r.H}/${r.vue}`;
  exiger(r.largeurDoc <= r.vw + 1, `${ou} : la page déborde horizontalement (${r.largeurDoc} > ${r.vw}) → ${r.deborde.join(",")}`);
  exiger(r.hEntete <= 64, `${ou} : en-tête de ${r.hEntete} px (plafond 64 — une seule rangée)`);
  if (r.vue === "table" || r.vue === "table3" || r.vue === "reseau") {
    exiger(r.ecrans <= 1.03, `${ou} : la table demande ${r.ecrans} écran(s), elle doit tenir dans un — dépasse : ${(r.depasseBas || []).join(", ") || "?"}`);
    exiger(r.yCoups !== null && r.yCoups <= r.vh, `${ou} : les coups sont hors écran (bas à y=${r.yCoups}, fenêtre ${r.vh})`);
    exiger(r.hSieges >= 60, `${ou} : sièges écrasés à ${r.hSieges} px`);
    exiger(!(r.nomsEffaces || []).length, `${ou} : l'arc du feutre efface le nom de ${(r.nomsEffaces || []).length} siège(s) — ${(r.nomsEffaces || []).join(", ")}`);
    // Les cartes du croupier ne touchent JAMAIS les tiennes : au moins 0,3 carte d'écart (25 px à 84).
    const mini = Math.round((r.wTable || 84) * .3);
    exiger(r.ecartCroupier === null || r.ecartCroupier >= mini, `${ou} : les cartes du croupier touchent les tiennes (écart ${r.ecartCroupier} px, minimum ${mini})`);
    // Un feutre imprimé : le paiement du blackjack est TOUJOURS dessiné sur ordinateur (tables solo).
    // Sous 400 px de feutre (téléphone), les arcs n'ont plus la place de porter une règle :
    // on imprime la version courte, « BLACKJACK 3:2 ». Un feutre nu reste un défaut.
    if (r.vue !== "reseau") exiger(/BLACKJACK/.test(r.lettrage), `${ou} : le feutre est nu — le paiement du blackjack n'est pas dessiné (lettrage : « ${r.lettrage.slice(0, 40)} » · dernier rendu : ${r.lettrageInfo})`);
  }
  for (const c of r.petits) if (!TOLERE.test(c)) exiger(false, `${ou} : cible tactile ${c} sous 44 px`);
}
const uniques = [...new Set(echecs)];
const infosU = [...new Set(infos)];
if (infosU.length) console.log("\nℹ️ téléphone (hors périmètre pour l'instant, non bloquant) : " + infosU.length + " remarque(s)\n  " + infosU.slice(0, 8).join("\n  "));
console.log("\n" + (uniques.length ? "✗ " + uniques.length + " DÉFAUT(S) DE MISE EN PAGE (≥ 1024 px)\n  " + uniques.join("\n  ") : "✓ MISE EN PAGE : tout passe (≥ 1024 px)"));
ws.close(); chrome.kill(); serveur.close(); process.exit(uniques.length ? 1 : 0);
