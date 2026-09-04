import {simulate} from "./sim.mjs";
const N=2_000_000;
const T=[
 ["6 jeux · S17 · DAS · abandon · 3:2",{decks:6},0.43],
 ["6 jeux · H17 · DAS · abandon · 3:2",{decks:6,h17:true},0.57],
 ["6 jeux · S17 · DAS · sans abandon",{decks:6,surrender:"none"},0.51],
 ["6 jeux · S17 · sans DAS · sans abandon",{decks:6,das:false,surrender:"none"},0.63],
 ["6 jeux · S17 · DAS · abandon · 6:5",{decks:6,blackjackPays:1.2},1.82],
 ["8 jeux · S17 · DAS · abandon",{decks:8},0.45],
 ["2 jeux · S17 · DAS · abandon",{decks:2},0.33],
 ["1 jeu · S17 · sans DAS · sans abandon",{decks:1,das:false,surrender:"none"},0.18],
];
console.log(`Avantage de la maison mesuré sur ${(N/1e6)}M mains par table.\n`);
console.log("  table                                    mesuré   attendu   écart");
let ko=0;
for(const [nom,r,att] of T){
  const {edge}=simulate(r,N,12345);
  const e=Math.abs(edge-att); if(e>0.12)ko++;
  console.log(`  ${nom.padEnd(38)} ${edge.toFixed(3).padStart(6)}%  ${att.toFixed(2).padStart(6)}%  ${e.toFixed(3)}${e>0.12?"  <-- écart":""}`);
}
console.log(ko?`\n${ko} table(s) hors tolérance`:"\nToutes les tables tombent dans la tolérance des valeurs publiées.");
