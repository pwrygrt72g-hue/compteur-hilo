import {solve} from "./solver.mjs";
import {makeRules} from "./engine.mjs";
// index de rang : 0 = as, 1 = deux … 9 = dix. L'ordre d'affichage habituel est 2..10 puis l'as.
const ORD=[1,2,3,4,5,6,7,8,9,0], LBL=["2","3","4","5","6","7","8","9","10","A"];
const col=u=>ORD[u];
function show(title,rules){
  const {chart,evs}=solve(rules);
  console.log("\n=== "+title+" ===");
  console.log("      "+LBL.map(u=>u.padStart(2)).join(" "));
  for(let t=20;t>=5;t--)console.log(String(t).padStart(4)+"  "+ORD.map(u=>chart.hard[t][u].padStart(2)).join(" "));
  console.log("  -- souples --");
  for(let t=20;t>=13;t--)console.log(("A,"+(t-11)).padStart(4)+"  "+ORD.map(u=>(chart.soft[t]||chart.hard[t])[u].padStart(2)).join(" "));
  console.log("  -- paires --");
  for(const i of [0,9,8,7,6,5,4,3,2,1])console.log((i===0?"A,A":`${i+1},${i+1}`).padStart(4)+"  "+ORD.map(u=>chart.pair[i][u].padStart(2)).join(" "));
  return {chart,evs};
}
const s17=show("6 jeux · S17 · DAS · abandon tardif",makeRules());
const h17=show("6 jeux · H17 · DAS · abandon tardif",makeRules({h17:true}));
const nosurr=solve(makeRules({surrender:"none"}));
const U={"2":1,"3":2,"4":3,"5":4,"6":5,"7":6,"8":7,"9":8,"10":9,"A":0};
console.log("\n=== contrôles contre les tableaux publiés ===");
const T=[
 ["S17 16 c. 10 abandon",s17.chart.hard[16][U["10"]],"U"],["S17 16 c. 7 tirer",s17.chart.hard[16][U["7"]],"H"],
 ["S17 16 c. 2 rester",s17.chart.hard[16][U["2"]],"S"],["S17 12 c. 3 tirer",s17.chart.hard[12][U["3"]],"H"],
 ["S17 12 c. 4 rester",s17.chart.hard[12][U["4"]],"S"],["S17 13 c. 2 rester",s17.chart.hard[13][U["2"]],"S"],
 ["S17 10 c. 10 tirer",s17.chart.hard[10][U["10"]],"H"],["S17 10 c. 9 doubler",s17.chart.hard[10][U["9"]],"D"],
 ["S17 9 c. 3 doubler",s17.chart.hard[9][U["3"]],"D"],["S17 9 c. 2 tirer",s17.chart.hard[9][U["2"]],"H"],
 ["S17 9 c. 7 tirer",s17.chart.hard[9][U["7"]],"H"],
 ["S17 A,7 c. 9 tirer",s17.chart.soft[18][U["9"]],"H"],["S17 A,7 c. 2 doubler",s17.chart.soft[18][U["2"]],"D"],
 ["S17 A,7 c. 7 rester",s17.chart.soft[18][U["7"]],"S"],["S17 A,8 c. 6 rester",s17.chart.soft[19][U["6"]],"S"],
 ["H17 A,8 c. 6 doubler",h17.chart.soft[19][U["6"]],"D"],["S17 A,2 c. 5 doubler",s17.chart.soft[13][U["5"]],"D"],
 ["S17 A,6 c. 2 tirer",s17.chart.soft[17][U["2"]],"H"],
 ["S17 8,8 c. 10 séparer",s17.chart.pair[7][U["10"]],"P"],["S17 8,8 c. A séparer",s17.chart.pair[7][U["A"]],"P"],
 ["H17 8,8 c. A abandon",h17.chart.pair[7][U["A"]],"U"],
 ["S17 9,9 c. 7 rester",s17.chart.pair[8][U["7"]],"S"],["S17 9,9 c. 6 séparer",s17.chart.pair[8][U["6"]],"P"],
 ["S17 9,9 c. A rester",s17.chart.pair[8][U["A"]],"S"],["S17 A,A c. 10 séparer",s17.chart.pair[0][U["10"]],"P"],
 ["S17 5,5 c. 6 doubler",s17.chart.pair[4][U["6"]],"D"],["S17 5,5 c. A tirer",s17.chart.pair[4][U["A"]],"H"],
 ["S17 4,4 c. 5 séparer",s17.chart.pair[3][U["5"]],"P"],["S17 4,4 c. 7 tirer",s17.chart.pair[3][U["7"]],"H"],
 ["S17 2,2 c. 3 séparer",s17.chart.pair[1][U["3"]],"P"],["S17 7,7 c. 8 tirer",s17.chart.pair[6][U["8"]],"H"],
 ["S17 6,6 c. 2 séparer(DAS)",s17.chart.pair[5][U["2"]],"P"],["S17 10,10 c. 6 rester",s17.chart.pair[9][U["6"]],"S"],
 ["H17 15 c. A abandon",h17.chart.hard[15][U["A"]],"U"],["H17 17 c. A abandon",h17.chart.hard[17][U["A"]],"U"],
 ["sans abandon 16 c. 10 tirer",nosurr.chart.hard[16][U["10"]],"H"],
];
let ko=0;
for(const [n,got,want] of T){const good=got===want;if(!good)ko++;console.log(`  ${(good?"ok":"ÉCHEC").padEnd(6)} ${n.padEnd(30)} ${got}${good?"":" (attendu "+want+")"}`);}
console.log("\n=== cases serrées : écart d'espérance entre les deux meilleures options ===");
for(const [n,fam,key,u] of [["S17 11 contre as","hard",11,"A"],["S17 A,7 contre as","soft",18,"A"],["S17 8,8 contre as","pair",7,"A"],["S17 12 contre 2","hard",12,"2"],["H17 A,8 contre 6","soft",19,"6"]]){
  const src=n.startsWith("H17")?h17:s17;
  console.log(`  ${n.padEnd(22)} ${src.chart[fam][key][U[u]]}   espérance ${src.evs[fam][key][U[u]].toFixed(4)}`);
}
console.log(ko?`\n${ko} divergences`:`\nLes ${T.length} cases de contrôle concordent avec les tableaux publiés.`);
console.log("\n=== sensibilité au nombre de jeux (le solveur retrouve seul les écarts connus) ===");
for(const d of [1,2,6,8]){
  const c=solve(makeRules({decks:d}));
  console.log(`  ${d} jeu(x) : 11 contre as -> ${c.chart.hard[11][U["A"]]}   A,8 contre 6 -> ${c.chart.soft[19][U["6"]]}   9 contre 2 -> ${c.chart.hard[9][U["2"]]}`);
}
console.log("  Attendu : un seul jeu double 11 contre as et A,8 contre 6, pas les sabots multiples.");
