import * as E from "./engine.mjs";
let pass=0,fail=0;
const c=(r,s)=>({r:E.RANKS[r],i:r,suit:s||"♠",col:"n"});
const H=(...is)=>E.newHand(is.map(i=>c(i)));
function ok(name,a,b){const A=JSON.stringify(a),B=JSON.stringify(b);
  if(A===B){pass++;}else{fail++;console.log("  ÉCHEC:",name,"\n    obtenu ",A,"\n    attendu",B);}}

const R=E.makeRules();
// --- totaux ---
ok("A+10 = 21",E.handTotal([c(0),c(9)]),21);
ok("A+A+9 = 21",E.handTotal([c(0),c(0),c(8)]),21);
ok("A+6+10 = 17 dur",E.handTotal([c(0),c(5),c(9)]),17);
ok("A+6 est souple",E.isSoft([c(0),c(5)]),true);
ok("A+6+10 n'est plus souple",E.isSoft([c(0),c(5),c(9)]),false);
ok("10+10+2 saute",E.isBust([c(9),c(9),c(1)]),true);
// --- blackjack ---
ok("A+R est un blackjack",E.isBlackjack(H(0,12)),true);
ok("21 en 3 cartes n'en est pas un",E.isBlackjack(H(6,6,6)),false);
{const h=H(0,9);h.fromSplit=true;ok("21 après séparation n'en est pas un",E.isBlackjack(h),false);}
// --- croupier ---
{const draw=(()=>{const q=[c(5)];return()=>q.shift();})();
 ok("S17 : le croupier reste sur 17 souple",E.playDealer([c(0),c(5)],draw,E.makeRules()).length,2);}
{const draw=(()=>{const q=[c(1),c(2)];return()=>q.shift();})();
 const out=E.playDealer([c(0),c(5)],draw,E.makeRules({h17:true}));
 ok("H17 : le croupier tire sur 17 souple",out.length>2,true);}
{const draw=()=>c(9);
 ok("le croupier reste sur 18 dur",E.playDealer([c(9),c(7)],draw,R).length,2);}
// --- règlements ---
ok("blackjack payé 3:2",E.settleHand(H(0,12),[c(9),c(8)],R).net,1.5);
ok("blackjack payé 6:5",E.settleHand(H(0,12),[c(9),c(8)],E.makeRules({blackjackPays:1.2})).net,1.2);
ok("blackjack contre blackjack = égalité",E.settleHand(H(0,12),[c(0),c(9)],R).net,0);
ok("main sautée perd la mise doublée",(()=>{const h=H(9,5);h.doubled=true;h.cards.push(c(9));return E.settleHand(h,[c(9),c(7)],R).net;})(),-2);
ok("abandon perd la moitié",(()=>{const h=H(9,5);h.surrendered=true;return E.settleHand(h,[c(9),c(7)],R).net;})(),-0.5);
ok("le croupier saute : on gagne",E.settleHand(H(9,5),[c(9),c(5),c(9)],R).net,1);
ok("égalité à 20",E.settleHand(H(9,9),[c(9),c(9)],R).net,0);
ok("doublé gagnant paie double",(()=>{const h=H(5,4);h.doubled=true;h.cards.push(c(9));return E.settleHand(h,[c(9),c(7)],R).net;})(),2);
ok("le blackjack du croupier bat un 20",E.settleHand(H(9,9),[c(0),c(9)],R).net,-1);
// --- assurance ---
ok("assurance gagnante",E.settleInsurance(1,true),1);
ok("assurance perdue",E.settleInsurance(1,false),-0.5);
// --- sans carte cachée ---
{const h=H(5,4);h.doubled=true;h.cards.push(c(9));
 ok("ENHC : le doublement est perdu aussi",E.settleNoHoleCard(h,[c(0),c(9)],E.makeRules({holeCard:false,enhcLosesAll:true})).net,-2);
 ok("ENHC clément : seule la mise d'origine est perdue",E.settleNoHoleCard(h,[c(0),c(9)],E.makeRules({holeCard:false,enhcLosesAll:false})).net,-1);}
ok("ENHC : blackjack contre blackjack reste une égalité",E.settleNoHoleCard(H(0,12),[c(0),c(9)],E.makeRules({holeCard:false})).net,0);
// --- séparations et doublements ---
ok("on peut séparer deux 8",E.canSplit(H(7,7),[H(7,7)],R),true);
ok("on peut séparer 10 et valet par valeur",E.canSplit(H(9,10),[H(9,10)],R),true);
ok("mais pas si la table sépare par rang",E.canSplit(H(9,10),[H(9,10)],E.makeRules({splitByRank:true})),false);
ok("pas de cinquième main",E.canSplit(H(7,7),[1,2,3,4].map(()=>H(7,7)),R),false);
{const h=H(7,7);h.fromSplit=true;ok("doubler après séparation autorisé",E.canDouble(h,[h],R),true);
 ok("doubler après séparation interdit",E.canDouble(h,[h],E.makeRules({das:false})),false);}
{const h=H(0,9);h.fromSplitAces=true;ok("une seule carte sur les as séparés",E.canDouble(h,[h],R),false);}
ok("doubler limité à 9-11",E.canDouble(H(9,1),[H(9,1)],E.makeRules({doubleOn:[9,10,11]})),false);
ok("doubler autorisé sur 11",E.canDouble(H(5,4),[H(5,4)],E.makeRules({doubleOn:[9,10,11]})),true);
ok("pas d'abandon après séparation",(()=>{const h=H(9,5);h.fromSplit=true;return E.canSurrender(h,[h,h],R);})(),false);
ok("pas d'abandon si la table l'interdit",E.canSurrender(H(9,5),[H(9,5)],E.makeRules({surrender:"none"})),false);

console.log(`\n${pass} tests passés, ${fail} échecs`);
process.exit(fail?1:0);
