import {TABLES, reglesDe} from "./tables.mjs";
import {simulate} from "./sim.mjs";
const N=3_000_000;
console.log("Avantage maison MESURÉ (3M mains par table, stratégie calculée par le solveur)\n");
console.log("  table               jeux  croupier  BJ    pén.   avantage maison");
for(const t of TABLES){
  const r=reglesDe(t);
  // Une mélangeuse continue ne se simule pas par la pénétration : on remélange chaque main.
  const rr = t.melange==="melangeuse_continue" ? {...r, penetration:0.02} : r;
  const {edge}=simulate(rr,N,20260904);
  console.log(`  ${t.nom.padEnd(18)} ${String(t.jeux).padStart(3)}   ${t.h17?"H17":"S17"}    ${t.blackjackPays===1.5?"3:2":"6:5"}  ${String(Math.round((t.penetration||0)*100)+"%").padStart(4)}   ${edge.toFixed(3).padStart(6)} %`);
}
