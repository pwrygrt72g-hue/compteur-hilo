import {computeIndices} from "./indices.mjs";
import {makeRules} from "./engine.mjs";
const HILO=[-1,1,1,1,1,1,0,0,0,-1]; // index 0 = as … 9 = dix
const LBL=["A","2","3","4","5","6","7","8","9","10"];
const {deviations,abandons,insurance}=computeIndices(makeRules({decks:6}),HILO);
const key=(f,k,u)=>`${f}:${k}:${u}`;
const M=new Map(); for(const d of deviations){const K=key(d.fam,d.key,d.up); if(!M.has(K))M.set(K,d);}
const nom=(f,k)=>f==="hard"?`${k}`:f==="soft"?`A,${k-11}`:(k===0?"A,A":`${k+1},${k+1}`);
console.log("Écarts calculés (Hi-Lo, 6 jeux, S17, DAS, abandon tardif)\n");
console.log(`  Assurance : à partir de ${insurance.index>=0?"+":""}${insurance.index}  (bascule exacte ${insurance.exact})   [publié : +3]`);
const I18=[["hard",16,9,0],["hard",15,9,4],["pair",9,4,5],["pair",9,5,4],["hard",10,9,4],["hard",12,2,2],
 ["hard",12,1,3],["hard",11,0,1],["hard",9,1,1],["hard",10,0,4],["hard",9,6,3],["hard",16,8,5],
 ["hard",13,1,-1],["hard",12,3,0],["hard",12,4,-2],["hard",12,5,-1],["hard",13,2,-2]];
console.log("\n  cellule            calculé   Illustrious 18   ");
let ok=0,tot=0;
for(const [f,k,u,att] of I18){
  const d=M.get(key(f,k,u)); tot++;
  const got=d?d.index:null;
  const bon = got!==null && Math.abs(got-att)<=1; if(bon)ok++;
  console.log(`  ${(nom(f,k)+" contre "+LBL[u]).padEnd(18)} ${got===null?"  —  ":String(got>=0?"+"+got:got).padStart(5)}   ${String(att>=0?"+"+att:att).padStart(5)}   ${bon?"ok":"écart"}`);
}
console.log(`\n  ${ok}/${tot} écarts retrouvés à une unité près.`);
console.log("\n  Abandons (famille Fab 4) :");
const F4=[["hard",14,9,3],["hard",15,8,2],["hard",15,0,1],["hard",15,9,0]];
for(const [f,k,u,att] of F4){
  const a=abandons.find(x=>x.fam===f&&x.key===k&&x.up===u);
  console.log(`    ${(nom(f,k)+" contre "+LBL[u]).padEnd(18)} ${a?String(a.index>=0?"+"+a.index:a.index).padStart(3):" — "}   publié ${att>=0?"+"+att:att}`);
}
console.log("\n  Les vingt écarts les plus proches de zéro (les plus rentables à connaître) :");
deviations.filter(d=>Math.abs(d.index)<=6).sort((a,b)=>Math.abs(a.index)-Math.abs(b.index)).slice(0,20)
 .forEach(d=>console.log(`    ${(nom(d.fam,d.key)+" contre "+LBL[d.up]).padEnd(18)} ${String(d.index>=0?"+"+d.index:d.index).padStart(3)} : ${d.de} -> ${d.vers}`));
