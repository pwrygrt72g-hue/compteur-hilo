/* ══════════════════════ CROUPIER ══════════════════════
   LE CROUPIER — le personnage, ses gestes, ses humeurs (lot Croupier, version 2).
   Concaténé après jetons.js. Il dessine dans #croupierScene et écoute le bus
   « sabot:* » documenté en tête de socle.js ; il ne touche pas aux lignes de table.js.

   Ce qu'il faut savoir avant de toucher à ce fichier :
   · Le rig est UN SVG (viewBox 520 × 200). La ligne y = 200 est le BORD de la
     table (le haut du rail) : le buste s'arrête là, le rack le recouvre, les bras
     passent par-dessus (overflow visible) et vont chercher le feutre. La scène
     fait exactement la hauteur de la bande au-dessus du rail, donc l'échelle est
     bande / 200 : à 1920 il grandit avec la table, et un point d'écran se
     convertit en unités de rig sans getScreenCTM.
   · Chaque articulation est DEUX groupes : le parent pose le pivot par un
     translate, l'enfant porte la rotation. Jamais de transform-origin sur un
     <g> : la rotation autour de (0,0) est vraie par construction, partout.
     Chaîne d'un bras : épaule > bras (rotation) > coude (translate 0,L1) >
     avant-bras (rotation) > [gaine (scaleY) · cap de coude · main (translateY)
     > poignet (rotation)].
   · Le bras est en 2,5 D. Le haut du bras a une longueur FIXE et son coude reste
     au niveau du bord de table (un coude posé sur le feutre, c'est un bras qui
     traîne sur la table — mesuré le 05/09 avec une cinématique inverse plane :
     coude à 45 px dans le feutre). L'avant-bras, lui, RACCOURCIT : sa gaine est
     mise à l'échelle sur la distance coude → poignet, c'est le raccourci d'un
     avant-bras qui pointe vers nous. Aucune pose n'est écrite en dur : le rack,
     le sabot, la défausse et les sièges sont lus à l'écran.
   · La carte n'est PAS accrochée à la main : pendant le geste, la main tient une
     PETITE carte (un rect dans la paume) qui disparaît quand la vraie carte s'en
     va ; la vraie carte, c'est table.js qui la lance, et tirer() n'a rien à
     savoir de nous.
   · element.animate() IGNORE prefers-reduced-motion : MOUVEMENT_REDUIT est
     testé ici, à chaque geste. En mouvement réduit la pose est posée d'un
     coup (l'information reste), le trajet disparaît.
   · Le croupier ne change JAMAIS un chiffre : ni la cadence, ni le compte, ni
     une décision. Il regarde ta MISE — c'est le seul tell honnête.
   ═══════════════════════════════════════════════════════════════════ */

/* ── Mouvement réduit : lu à chaque geste, et suivi quand il bascule ───── */
const MOUVEMENT_REDUIT = (() => {
  const mq = matchMedia("(prefers-reduced-motion: reduce)");
  const o = { on: mq.matches };
  mq.addEventListener("change", e => { o.on = e.matches; if (o.on) crStopperAmbiance(); });
  return o;
})();

/* ── Le gabarit. « @ » est le préfixe des identifiants : le même rig sert la
   scène, les cinq vignettes du sélecteur et le chef du mode Concentration sans
   qu'un url(#…) se trompe de croupier. Repère : centre x = 260, bord de table
   y = 200, tête entre y = 14 et 114, épaules à y = 136. ──────────────────── */
const CR_L1 = 92, CR_L2_MIN = 36, CR_L2_MAX = 172, CR_GAINE = 120;   // unités de rig
const CR_EPAULE = { G: [166, 146], D: [354, 146] };
// La main, vue de dos, doigts vers les joueurs : une paume plus large aux jointures qu'au
// poignet, un POUCE qui s'écarte, quatre doigts aux longueurs décroissantes (le majeur le plus
// long, l'auriculaire le plus court), bouts ronds, une phalange suggérée d'un trait. Et 15 %
// plus petite : mesuré le 05/09, des gants à quatre doigts rectangulaires de la largeur d'un
// siège à 1920. L'échelle est posée sur le groupe intérieur, le poignet reste à l'origine.
const CR_MAIN = cote => `<g id="@crMain${cote}"><g id="@crPoignet${cote}"><g transform="scale(${cote === "G" ? "-.85" : ".85"},.85)">
   <path d="M-17-13h34l-2 17h-30z" fill="var(--cr-poignet,#F1ECE0)"/>
   <path d="M-17-9h34" stroke-opacity=".16"/>
   <circle cx="12" cy="-4" r="2.1" fill="var(--cr-or,#D9B45B)" stroke="none"/>
   <path d="M-16 2C-19 12-19 24-15 34L15 34C19 24 19 12 16 2Z" fill="var(--cr-peau,#D6A579)"/>
   <g id="@crCarte${cote}" opacity="0"><rect x="-16" y="34" width="32" height="46" rx="3" fill="#F7F3EA" stroke="#2A1A10" stroke-opacity=".55" transform="rotate(-14 -16 34)"/><path d="M-10 62l6-9 6 9z" fill="#A8231E" transform="rotate(-14 -16 34)"/></g>
   <path d="M-16 5C-24 6-31 13-32 22C-33 30-28 35-23 33C-19 31-17 25-15 20Z" fill="var(--cr-peau,#D6A579)"/>
   <path d="M-23 32c-3-5-2-11 1-15" stroke-opacity=".14" fill="none"/>
   <rect x="-15.5" y="30" width="8.4" height="29" rx="4.2" fill="var(--cr-peau,#D6A579)"/>
   <rect x="-6.2" y="31" width="8.8" height="32" rx="4.4" fill="var(--cr-peau,#D6A579)"/>
   <rect x="3.4" y="31" width="8.4" height="29" rx="4.2" fill="var(--cr-peau,#D6A579)"/>
   <rect x="12.4" y="29" width="7.2" height="23" rx="3.6" fill="var(--cr-peau,#D6A579)"/>
   <path d="M-14 43q3-2 6 0M-5 45q3-2 7 0M4.5 44q3-2 6 0M13 41q2.5-2 5.5 0M-14 52q3-2 6 0M-5 54q3-2 7 0M4.5 53q3-2 6 0M13 47q2.5-2 5.5 0" stroke-opacity=".15" fill="none"/>
   <path d="M-15 31q4-3 8 0M-5 32q4-3 8 0M4 32q4-3 7 0M13 30q3-3 6 0" stroke-opacity=".22" fill="none"/>
   <path d="M-11 4c1 10 1 18 0 27" stroke-opacity=".08"/>
  </g></g></g>`;
const CR_BRAS = cote => `<g transform="translate(${CR_EPAULE[cote][0]},${CR_EPAULE[cote][1]})"><g id="@crBras${cote}">
 <path d="M-18-4C-11-16 11-16 18-4L15 88C9 97-9 97-15 88Z" fill="var(--cr-manche,#1E242A)"/>
 <path d="M-18-4C-11-16 11-16 18-4L15 88C9 97-9 97-15 88Z" fill="url(#@lumB)" stroke="none"/>
 <path d="M-18-4C-11-16 11-16 18-4L15 88C9 97-9 97-15 88Z" fill="url(#@cyl)" stroke="none"/>
 <path d="M-11 58c5 4 17 4 22 0" stroke-opacity=".28" stroke-width="2" stroke-linecap="round"/>
 <!-- le pli du COUDE : deux cassures de tissu juste au-dessus de l'articulation, un ourlet à la
      jonction — sans elles le bras se lisait comme un tuyau d'arrosage (les critiques, 05/09) -->
 <path d="M-14 74c4 5 24 5 28 0M-13 82c4 4 22 4 26 0" stroke-opacity=".34" stroke-width="2" stroke-linecap="round" fill="none"/>
 <path d="M-15 88c6 3 24 3 30 0" stroke="#000" stroke-opacity=".28" stroke-width="3" stroke-linecap="round" fill="none"/>
 <g transform="translate(0,${CR_L1})"><g id="@crAvant${cote}">
  <g id="@crGaine${cote}">
   <path d="M-16-3C-8-10 8-10 16-3L13 ${CR_GAINE}L-13 ${CR_GAINE}Z" fill="var(--cr-manche,#1E242A)"/>
   <path d="M-16-3C-8-10 8-10 16-3L13 ${CR_GAINE}L-13 ${CR_GAINE}Z" fill="url(#@cyl)" stroke="none"/>
   <path d="M-13 46c4 3 22 3 26 0M-12 92c4-3 20-3 24 0" stroke-opacity=".22" stroke-width="1.6" stroke-linecap="round" fill="none"/>
  </g>
  <circle r="16" fill="var(--cr-manche,#1E242A)" stroke="none"/><circle r="16" fill="url(#@cyl)" stroke="none"/>
  <path d="M-15 2c5 8 25 8 30 0" stroke="#000" stroke-opacity=".22" stroke-width="2.2" stroke-linecap="round" fill="none"/>
  <path d="M-10 9c4 4 16 4 20 0" stroke-opacity=".26" stroke-width="1.8" stroke-linecap="round"/>
  ${CR_MAIN(cote)}
 </g></g>
</g></g>`;
// 🚨 CR_RIG est un LITTÉRAL GABARIT : pas un seul accent grave à l'intérieur, pas même dans
// un commentaire SVG. Un « ` » y ferme la chaîne au milieu du dessin et tout le fichier cesse
// de parser — donc plus de croupier du tout. Et rien ne le dit : build.mjs concatène sans
// analyser, la page se construit, elle est juste morte. Vécu le 06/09 en écrivant le
// commentaire des coiffes juste en dessous. Écrire « sourcils », jamais `sourcils`.
const CR_RIG = `<svg class="cr-svg" viewBox="0 0 520 200" preserveAspectRatio="xMidYMax meet" overflow="visible" aria-hidden="true" focusable="false">
<defs>
<pattern id="@crT" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(40)"><line x1="0" y1="0" x2="0" y2="4" stroke="#000" stroke-width="1.3"/></pattern>
<linearGradient id="@lum" gradientUnits="userSpaceOnUse" x1="0" y1="112" x2="0" y2="206"><stop offset="0" stop-color="#FFE9C8" stop-opacity=".3"/><stop offset=".4" stop-color="#FFE9C8" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".36"/></linearGradient>
<linearGradient id="@lumB" gradientUnits="userSpaceOnUse" x1="0" y1="-14" x2="0" y2="104"><stop offset="0" stop-color="#FFE9C8" stop-opacity=".24"/><stop offset=".38" stop-color="#FFE9C8" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>
<linearGradient id="@cyl" gradientUnits="userSpaceOnUse" x1="-24" y1="0" x2="24" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".3"/><stop offset=".32" stop-color="#000" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".09"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".34"/></linearGradient>
<radialGradient id="@peauL" cx=".5" cy=".28" r=".72"><stop offset="0" stop-color="#FFF2DC" stop-opacity=".2"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#3A1A0C" stop-opacity=".28"/></radialGradient>
<g id="@o-noeud"><path d="M260 134l-23-10c-3-1-6 1-6 4v13c0 3 3 5 6 4zM260 134l23-10c3-1 6 1 6 4v13c0 3-3 5-6 4z"/><rect x="253" y="127" width="14" height="15" rx="4"/><path d="M237 129l20 5-20 6M283 129l-20 5 20 6" fill="none" stroke="#000" stroke-opacity=".28" stroke-width="1.4"/></g>
<g id="@o-cravate"><path d="M260 128l-9 8 4 8-6 44 11 12 11-12-6-44 4-8z"/><path d="M256 146l4 34M263 146l-4 34" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="1.4"/></g>
<g id="@o-lavalliere"><path d="M260 132c-10-7-23-5-25 3-2 8 5 14 13 14 6 0 10-2 12-6 2 4 6 6 12 6 8 0 15-6 13-14-2-8-15-10-25-3z"/><path d="M253 146l-8 34 15-11 15 11-8-34z" opacity=".85"/></g>
<g id="@o-mao"><path d="M240 114h40v10h-40z" fill="var(--cr-or,#F2C15A)"/><path d="M238 118l22 20 22-20 7 5-29 27-29-27z" fill="var(--cr-or,#F2C15A)" opacity=".9"/><circle cx="260" cy="156" r="2.6" fill="var(--cr-or,#F2C15A)" stroke="none"/><circle cx="260" cy="172" r="2.6" fill="var(--cr-or,#F2C15A)" stroke="none"/><circle cx="260" cy="188" r="2.6" fill="var(--cr-or,#F2C15A)" stroke="none"/></g>
<g id="@a-rien"/>
<g id="@a-chaine" fill="none" stroke="var(--cr-or,#D9B45B)" stroke-width="1.8"><path d="M262 178c10 6 22 8 34 4" stroke-dasharray="2.5 2"/><circle cx="296" cy="184" r="4.5" fill="var(--cr-or,#D9B45B)" stroke="none"/></g>
<g id="@a-epingle"><rect x="254" y="158" width="12" height="2.6" rx="1.3" fill="var(--cr-or,#D9B45B)" stroke="none"/></g>
<!-- Les COIFFES. Règle dure : entre x = 224 et x = 296 le bord BAS de la coiffe reste à
     y = 32 ou PLUS HAUT, jamais plus bas. Sous cette ligne il n'y a plus de front, et un
     sourcil qui MONTE finit sous les cheveux. Avant le 06/09 la ligne était à 40-46 pour
     un sourcil dont le haut est à 37-39 : mesuré sur les 5 croupiers × 7 émotions, le
     sourcil mordait dans la coiffe dans 28 cases sur 35, et le sourcil LEVÉ de
     « moqueur » était caché à 100 % chez Vince, Ada et le Chef — c'est-à-dire exactement
     la moquerie qu'on voulait montrer. Les TEMPES ne bougent pas (210 / 310 à y = 62-68) :
     c'est elles qui donnent la forme du crâne, et c'est pour ça que la silhouette est la
     même. Le sourcil fait 11 à 23 unités de haut selon le croupier (champ « sourcils »), d'où la
     règle. Une coiffe ajoutée ici se vérifie de la même façon : le bord bas à x = 241 et
     x = 279 au moins 4 unités au-dessus du haut du sourcil sur la MÊME verticale, dans
     les 8 émotions. (c-degarni n'a rien au-dessus du front : elle était déjà bonne.) -->
<path id="@c-courts" d="M260 13C228 13 210 36 210 62C213 47 217 35 224 32L296 32C303 35 307 47 310 62C310 36 292 13 260 13Z"/>
<path id="@c-plaque" d="M260 13C228 13 210 36 210 64C213 50 218 35 225 32C241 33 262 31 284 26C296 34 305 50 310 64C310 36 292 13 260 13Z"/>
<path id="@c-degarni" d="M210 68C209 52 215 40 226 32C231 41 232 53 226 63C222 69 214 71 210 68ZM310 68C311 52 305 40 294 32C289 41 288 53 294 63C298 69 306 71 310 68ZM244 24c6-5 14-8 22-8-1 3-2 5-3 7-6 0-13 1-19 1zM266 16c8 0 15 3 20 8-6 0-12 0-18-1 0-2-1-4-2-7z"/>
<path id="@c-chignon" d="M260 13C228 13 210 36 210 64C213 49 217 35 224 32C240 31 280 31 296 32C303 35 307 49 310 64C310 36 292 13 260 13ZM290 3c10-1 18 6 18 14 0 7-6 12-13 12-2-8-6-14-12-18 2-4 4-7 7-8z"/>
<path id="@c-carre" d="M260 12C224 12 206 36 206 66L206 98C206 104 212 106 216 104L216 66C216 48 220 35 226 32L294 32C300 35 306 48 306 66L304 104C308 106 314 104 314 98L314 66C314 36 296 12 260 12Z"/>
<g id="@l-rien"/>
<!-- Les LUNETTES. Règle dure : le bord HAUT de la monture reste SOUS le sourcil, jamais
     dessus. Les sourcils sont peints APRÈS elles (l'ordre du rig), donc un sourcil qui
     descend sur la monture est peint PAR-DESSUS LE VERRE — un sourcil à l'intérieur d'un
     verre de lunettes n'existe pas, et c'était l'anomalie la plus immédiatement « fausse »
     d'Ada : au repos ses sourcils s'appuyaient déjà sur le rebord (haut à y = 52, bas du
     sourcil à 52,2), et sur « hilare » ils passaient franchement dedans. La monture
     descend de 3 unités et se resserre de 2 : elle entoure toujours l'œil (54 → 70) et
     dégage la bande de front. L'écart se mesure sur la page rendue, pas à l'œil. -->
<g id="@l-rondes" fill="none" stroke="var(--cr-monture,#3A2A1C)" stroke-width="2.6"><circle cx="241" cy="65" r="12"/><circle cx="279" cy="65" r="12"/><path d="M253 64h14M229 61l-14-4M291 61l14-4"/></g>
<g id="@l-carrees" fill="none" stroke="var(--cr-monture,#3A2A1C)" stroke-width="2.6"><rect x="226" y="55" width="30" height="19" rx="4"/><rect x="264" y="55" width="30" height="19" rx="4"/><path d="M256 64h8M226 61l-12-3M294 61l12-3"/></g>
<g id="@m-rien"/>
<!-- Les MOUSTACHES. Règle dure : leur bord BAS reste au-dessus de y = 91 — le haut de la
     bouche la plus haute (« grand », le rire, dont le trait de 3,4 remonte à 91,3). Avant
     le 06/09 la brosse descendait à 97,6 : elle RECOUVRAIT entièrement la bouche « ferme »
     (concentré) et la bouche « boude » (agacé), si bien que Marcel n'avait plus, sur ces
     deux visages, qu'une paire d'ergots aux commissures. La brosse s'élargit (38 unités
     au lieu de 36) et s'amincit (9,8 au lieu de 17) : c'est sa LARGEUR et ses bouts carrés
     qui font la brosse, pas son épaisseur. La fine remonte de 4 : sur « hilare » elle
     tranchait les dents en diagonale, ce qui se lisait comme un défaut de rendu. -->
<path id="@m-brosse" d="M241 86c5-6 12-7 19-4 7-3 14-2 19 4-1 4-9 5-19 4-10 1-18 0-19-4z"/>
<path id="@m-fine" d="M245 85c5-3 10-3 15-1 5-2 10-2 15 1-2 3-8 4-15 3-7 1-13 0-15-3z"/>
<!-- Les BARBES. Règle dure, exactement l'inverse de celle des moustaches : leur bord HAUT
     au menton reste SOUS y = 110 — la bouche la plus basse est « grand » (le rire), dont le
     ventre descend à 108 et le trait de 3,4 jusqu'à 109,7. Sur les CÔTÉS la contrainte
     s'inverse encore : la bouche y est haute (ses commissures sont à 93), donc la barbe
     peut y remonter jusqu'à 96 sans jamais la croiser. C'est cette dissymétrie — basse au
     menton, haute aux joues — qui donne à un croissant deux points le dessin d'une barbe
     plutôt qu'un bavoir. Le menton du visage est à 114 : une barbe PEND, donc elle passe
     dessous jusqu'à 122, sinon elle se lit comme une ombre sur la peau.
     ⚠️ Elles se peignent APRÈS la bouche, comme la moustache : le poil pousse SUR la peau,
     donc devant elle. Le pli du menton (opacité .18) passe dessous et disparaît — c'est
     voulu, un menton barbu n'a pas de pli visible. -->
<!-- Les VISAGES. Cinq croupiers qui partagent un seul ovale, ce sont cinq recoloriages
     de la même personne — c'est ce que Léo a vu tout de suite. La moitié HAUTE ne bouge
     jamais (M260 14 → 210 64) : les oreilles sont posées à x = 212 et 308 entre y = 58
     et 76, les tempes ombrées juste dessous, la coiffe taillée sur ce crâne-là. Toute
     l'identité se joue donc SOUS la ligne des oreilles — la mâchoire et le menton, qui
     sont de toute façon ce qu'on lit d'un visage. Le menton va de 112 (rond) à 119
     (long) : sept unités suffisent, parce que la LARGEUR à mi-joue change avec.
     ⚠️ Le tracé existe en DEUX exemplaires — le fond peau et le calque de lumière
     url(#@peauL) — et les deux doivent porter la MÊME forme, sinon la lumière déborde
     du visage. C'est la seule raison pour laquelle il y a deux fentes et non une.
     ⚠️ Le bord extérieur des barbes est calé sur l'ovale de référence : il descend à 119
     (pleine) et 117 (collier), donc SOUS le menton le plus bas. Une barbe qui flotte au
     lieu de coller se voit ; une barbe qui déborde de trois unités passe derrière le col. -->
<g id="@b-rien"/>
<!-- Le bord EXTÉRIEUR de chaque barbe est le contour du visage lui-même (210,64 → 222,98 →
     260,114, et son miroir) : un poil pousse SUR la peau, pas à côté. La barbe pleine le
     déborde de 4 unités sous le menton — elle PEND, c'est ce qui la distingue d'une ombre.
     Le bord INTÉRIEUR est ce qui fait le modèle : haut sur les joues (y = 83) pour la
     pleine, à dix unités du contour pour le collier, rien du tout pour le bouc.
     🚨 La bouche n'est PAS un trou percé dans la barbe : c'est le bord INTÉRIEUR qui
     plonge autour d'elle (96 sur les joues, 109 au milieu). Un second sous-chemin en
     fill-rule evenodd a été essayé le 07/09 et donne l'inverse de ce qu'on croit — posé
     là où la bande ne passe PAS (le milieu du visage, au-dessus du menton), il ne perce
     rien, il REMPLIT : Marcel s'est retrouvé avec un bloc gris à la place de la bouche.
     Un bord qui contourne ne peut pas se tromper de sens.
     ⚠️ Ce bord descend à 109, soit une unité sous le rire (« grand » atteint 109,7) et
     trois sous les bouches au repos. C'est la marge minimale : la remonter découvrirait
     le menton, la baisser mangerait la lèvre. -->
<path id="@b-pleine" d="M216 72C217 89 221 102 229 109C237 116 247 120 260 120C273 120 283 116 291 109C299 102 303 89 304 72C302 84 297 92 290 96C285 98 281 101 278 105C274 108 268 109 260 109C252 109 246 108 242 105C239 101 235 98 230 96C223 92 218 84 216 72Z"/>
<path id="@b-collier" d="M214 70C215 88 219 101 227 109C235 116 246 120 260 120C274 120 285 116 293 109C301 101 305 88 306 70C304 84 300 95 293 102C285 110 274 114 260 114C246 114 235 110 227 102C220 95 216 84 214 70Z"/>
<path id="@b-bouc" d="M243 102C249 108 253 110 260 110C267 110 271 108 277 102C277 110 274 117 268 120C264 123 256 123 252 120C246 117 243 110 243 102Z"/>
<path id="@b-favoris" d="M212 54C212 74 216 89 224 100C227 104 230 107 233 109C227 107 222 101 218 93C214 84 212 70 212 54ZM308 54C308 74 304 89 296 100C293 104 290 107 287 109C293 107 298 101 302 93C306 84 308 70 308 54Z"/>
<path id="@b-naissante" opacity=".34" d="M216 72C217 89 221 102 229 109C237 116 247 120 260 120C273 120 283 116 291 109C299 102 303 89 304 72C302 84 297 92 290 96C285 98 281 101 278 105C274 108 268 109 260 109C252 109 246 108 242 105C239 101 235 98 230 96C223 92 218 84 216 72Z"/>
</defs>
<g id="@crCorps" fill="none" stroke="var(--cr-encre,#0A0D0C)" stroke-opacity=".5" stroke-width="2" stroke-linejoin="round">
<g id="@crBuste">
<!-- ── TORSE : veste ouverte sur gilet et chemise, col, ornement, pochette ── -->
<g id="@crTorse">
 <path d="M254 116C236 118 200 122 180 130C158 140 140 162 132 206L388 206C380 162 362 140 340 130C320 122 284 118 266 116Z" fill="var(--cr-veste,#171C21)"/>
 <path d="M254 116C236 118 200 122 180 130C158 140 140 162 132 206L388 206C380 162 362 140 340 130C320 122 284 118 266 116Z" fill="url(#@lum)" stroke="none"/>
 <path d="M246 92h28v28c0 6-6 10-14 10s-14-4-14-10z" fill="var(--cr-peau,#D6A579)"/>
 <path d="M246 100c4 8 8 12 14 12s10-4 14-12v20c0 6-6 10-14 10s-14-4-14-10z" fill="#3A1A0C" opacity=".32" stroke="none"/>
 <path d="M236 118L260 176L284 118Z" fill="var(--cr-chemise,#F1ECE0)"/>
 <path d="M260 124v50" stroke-opacity=".16"/>
 <path d="M232 128C246 148 256 160 260 170C264 160 274 148 288 128L300 140C304 168 302 190 300 206L220 206C218 190 216 168 220 140Z" fill="var(--cr-gilet,#28313A)"/>
 <path d="M232 128C246 148 256 160 260 170C264 160 274 148 288 128L300 140C304 168 302 190 300 206L220 206C218 190 216 168 220 140Z" fill="url(#@crT)" opacity=".14" stroke="none"/>
 <path d="M232 128C246 148 256 160 260 170C264 160 274 148 288 128L300 140C304 168 302 190 300 206L220 206C218 190 216 168 220 140Z" fill="url(#@lum)" stroke="none" opacity=".6"/>
 <circle cx="260" cy="182" r="2.6" fill="var(--cr-bouton,#1A1410)" stroke="none"/><circle cx="260" cy="196" r="2.6" fill="var(--cr-bouton,#1A1410)" stroke="none"/>
 <path d="M252 116C232 132 222 160 230 206L214 206C206 166 216 134 250 114Z" fill="var(--cr-veste,#171C21)"/>
 <path d="M252 116C232 132 222 160 230 206L214 206C206 166 216 134 250 114Z" fill="#FFE9C8" opacity=".08" stroke="none"/>
 <path d="M268 116C288 132 298 160 290 206L306 206C314 166 304 134 270 114Z" fill="var(--cr-veste,#171C21)"/>
 <path d="M268 116C288 132 298 160 290 206L306 206C314 166 304 134 270 114Z" fill="#FFE9C8" opacity=".08" stroke="none"/>
 <path d="M312 150l17-3-5 12z" fill="var(--cr-pochette,#F1ECE0)" stroke-width="1.4"/>
 <path d="M240 116l20 18 20-18 6 6-26 22-26-22z" fill="var(--cr-chemise,#F1ECE0)"/>
 <use id="@crAcc" href="#@a-rien"/>
 <use id="@crOrne" href="#@o-noeud" fill="var(--cr-orne,#8E2018)"/>
</g>
<!-- ── TÊTE : g(pivot au cou) > g(animé) > g(retour au repère) ──────────
     Le contour n'est plus un ŒUF : il casse à (222,98) et (298,98) — l'angle de la
     mâchoire — puis file au menton en (260,114). La largeur ne bouge pas (l'ancienne
     courbe passait déjà par x = 222,7 à y = 98) : ce qui change, c'est qu'il y a
     maintenant un ANGLE là où l'os en fait un, donc un bas de visage. ⚠️ Le tracé
     existe en DEUX exemplaires — le fond peau et le calque de lumière url(#@peauL) —
     et ils doivent rester identiques, sinon le modelé déborde du visage. -->
<g transform="translate(260,112)"><g id="@crTete"><g transform="translate(-260,-112)">
 <path id="@crVisage" d="M260 14C228 14 210 36 210 64C210 78 214 90 222 98C230 108 244 114 260 114C276 114 290 108 298 98C306 90 310 78 310 64C310 36 292 14 260 14Z" fill="var(--cr-peau,#D6A579)"/>
 <path id="@crVisageL" d="M260 14C228 14 210 36 210 64C210 78 214 90 222 98C230 108 244 114 260 114C276 114 290 108 298 98C306 90 310 78 310 64C310 36 292 14 260 14Z" fill="url(#@peauL)" stroke="none"/>
 <path d="M212 58c-7-2-12 3-11 10 1 7 6 10 11 8zM308 58c7-2 12 3 11 10-1 7-6 10-11 8z" fill="var(--cr-peau,#D6A579)"/>
 <path d="M206 66c0-2 2-4 4-3M314 66c0-2-2-4-4-3" stroke-opacity=".3"/>
 <path d="M218 70C217 82 221 93 229 101C224 101 220 93 217 83C216 77 216 73 218 70ZM302 70C303 82 299 93 291 101C296 101 300 93 303 83C304 77 304 73 302 70Z" fill="#3A1A0C" opacity=".1" stroke="none"/>
 <use id="@crCoiffe" href="#@c-courts" fill="var(--cr-cheveux,#191411)"/>
 <!-- 🚨 LE GROUPE QUI FAIT LE TROIS-QUARTS. Avant, tourner la tête ne faisait que
      l'INCLINER : le visage restait vissé au milieu du crâne, donc le croupier ne
      regardait jamais personne, il penchait. Sur une planche de personnage, ce qui
      distingue une vue de face d'une vue de trois-quarts, ce n'est pas l'angle du
      crâne — c'est que les yeux, le nez et la bouche ont GLISSÉ sur lui pendant que
      l'ovale bougeait à peine. Ce groupe porte ce glissement, et lui seul : la
      coiffe est taillée sur ce crâne-là et les oreilles y sont vissées, les faire
      glisser les décollerait. -->
 <g id="@crFace">
 <ellipse class="cr-joue" id="@crJoueG" cx="232" cy="82" rx="9" ry="5.2" fill="#D9584F" stroke="none" opacity="0"/>
 <ellipse class="cr-joue" id="@crJoueD" cx="288" cy="82" rx="9" ry="5.2" fill="#D9584F" stroke="none" opacity="0"/>
 <!-- les yeux : pivot au centre, l'iris glisse, la paupière descend depuis le haut -->
 <g transform="translate(241,62)" stroke="none"><g id="@crOrbG"><g id="@crOeilG" class="cr-oeil"><ellipse rx="11" ry="8" fill="#F8F4EB"/><g id="@crIrisG"><circle cx="1" r="5.4" fill="var(--cr-iris,#3A2A1C)"/><circle id="@crPupG" cx="1" r="2.6" fill="#0B0906"/><circle cx="-1" cy="-2" r="1.5" fill="#fff" opacity=".9"/></g><g transform="translate(0,-8.2)"><path id="@crPaupG" d="M-11.4 8.2a11.4 8.2 0 0 1 22.8 0z" fill="var(--cr-peau,#D6A579)" style="transform:scaleY(0)"/></g><ellipse rx="11" ry="8" fill="none" stroke="var(--cr-encre,#0A0D0C)" stroke-opacity=".3" stroke-width="1.3"/></g></g></g>
 <g transform="translate(279,62)" stroke="none"><g id="@crOrbD"><g id="@crOeilD" class="cr-oeil"><ellipse rx="11" ry="8" fill="#F8F4EB"/><g id="@crIrisD"><circle cx="1" r="5.4" fill="var(--cr-iris,#3A2A1C)"/><circle id="@crPupD" cx="1" r="2.6" fill="#0B0906"/><circle cx="-1" cy="-2" r="1.5" fill="#fff" opacity=".9"/></g><g transform="translate(0,-8.2)"><path id="@crPaupD" d="M-11.4 8.2a11.4 8.2 0 0 1 22.8 0z" fill="var(--cr-peau,#D6A579)" style="transform:scaleY(0)"/></g><ellipse rx="11" ry="8" fill="none" stroke="var(--cr-encre,#0A0D0C)" stroke-opacity=".3" stroke-width="1.3"/></g></g></g>
 <!-- sourcils DISSYMÉTRIQUES : deux miroirs exacts font « vecteur généré ».
      ⚠️ Le sourcil se TAILLE VERS LA TEMPE (extrémité extérieure fine, 3 unités ; racine
      épaisse, 6). Ce n'est pas de la coquetterie anatomique, c'est la règle qui l'empêche
      d'entrer dans l'ŒIL. Le pivot des rotations est le centre du sourcil : lever une
      extrémité PLONGE l'autre, et le bras de levier étant de 13 unités, 22° suffisent à
      faire descendre la pointe de 5. Avant le 06/09 cette pointe descendait jusqu'à y = 9
      (× l'épaisseur du croupier, 1,45 chez le Chef) : sur « hilare » et « moqueur » elle
      atterrissait SUR le blanc de l'œil — pas un froncement, une collision de formes. La
      pointe s'arrête maintenant à 5. Le bord HAUT n'a pas bougé d'une unité : la règle des
      4 unités de front libre sous la coiffe, gagnée juste avant, est intacte.
      ⚠️ La couleur passe par --cr-sourcil, qui retombe sur --cr-cheveux quand on ne dit
      rien : chez Marcel les deux sont le même gris, et un sourcil gris sur des touffes
      grises n'a plus d'angle — donc plus d'expression. -->
 <g transform="translate(241,45)"><path id="@crSourcilG" d="M-13 1C-7-4 4-6 13-1L12 5C4 2-4 2-12 4Z" fill="var(--cr-sourcil,var(--cr-cheveux,#191411))" stroke="none"/></g>
 <g transform="translate(279,45)"><path id="@crSourcilD" d="M13 2C7-4-4-6-13-2L-12 4C-4 2 4 2 12 5Z" fill="var(--cr-sourcil,var(--cr-cheveux,#191411))" stroke="none"/></g>
 <!-- 🚨 LES LUNETTES SE PEIGNENT APRÈS LES SOURCILS, et c'est de la physique, pas du goût :
      une monture est POSÉE SUR le visage, donc devant tout ce qu'elle croise. Elles étaient
      peintes avant, si bien qu'Ada portait ses sourcils PAR-DESSUS ses verres — mesuré sur
      la page rendue, jusqu'à 11,6 unités à l'intérieur du verre sur « furieux ». Dans cet
      ordre-ci, un sourcil qui fronce passe DERRIÈRE le rebord haut, exactement comme sur un
      vrai visage, et il reste entièrement lisible : le verre n'a pas de fond (fill:none),
      seule la barre de la monture le coupe. -->
 <use id="@crLunettes" href="#@l-rien" fill="none"/>
 <path d="M263 68c3 8 6 13 4 17-1 3-5 3-8 1" stroke-opacity=".34" stroke-width="2.4" stroke-linecap="round"/>
 <path d="M257.6 85c-.5 2.6-.4 4.6 0 6.4M262.4 85c.5 2.6.4 4.6 0 6.4" stroke-opacity=".2" stroke-width="1.6" stroke-linecap="round"/>
 <!-- La BOUCHE. L'ombre de la lèvre inférieure et les deux COINS sont dessinés AVANT
      le trait : ils ne changent pas avec la forme, et c'est justement ça qui la tient.
      Une bouche qui n'est qu'un trait se déforme dans le vide ; deux commissures fixes
      lui donnent un point d'attache, quelle que soit la forme qu'on y claque — et la
      bouche ouverte (« grand », « serre ») les recouvre, donc elles ne gênent jamais. -->
 <g transform="translate(260,96)">
  <path d="M-9 5C-4 8 4 8 9 5" stroke="#3A1A0C" stroke-opacity=".13" stroke-width="3" stroke-linecap="round"/>
  <path d="M-12.6-.6c-.8 1.4-1 2.6-.8 3.6M12.6-.6c.8 1.4 1 2.6.8 3.6" stroke="var(--cr-levres,#3A1A14)" stroke-opacity=".3" stroke-width="2" stroke-linecap="round"/>
  <path id="@crBouche" d="M-13 0C-6 4 6 4 13 0" stroke="var(--cr-levres,#3A1A14)" stroke-opacity=".85" stroke-width="3.4" stroke-linecap="round"/>
  <path id="@crDents" d="M-11-2h22l-2 4h-18z" fill="#F6F1E4" stroke="none" opacity="0"/>
 </g>
 <path d="M250 106c4 3 16 3 20 0" stroke-opacity=".18" stroke-width="1.8" stroke-linecap="round"/>
 <use id="@crBarbe" href="#@b-rien" fill="var(--cr-barbe,var(--cr-cheveux,#191411))" stroke="none"/>
 <use id="@crMoustache" href="#@m-rien" fill="var(--cr-cheveux,#191411)" stroke="none"/>
 </g>
</g></g></g>
</g>
<!-- ── BRAS : gauche-écran (côté défausse) puis droite-écran (celui qui distribue) ── -->
<g stroke="var(--cr-trait,#3A2416)" stroke-opacity=".5" stroke-width="1.8">
${CR_BRAS("G")}
${CR_BRAS("D")}
</g>
<!-- ── TÊTES DE MANCHE : la seule pièce de la veste dessinée APRÈS les bras ──────
     Sans elles le bras est un tube posé sur le buste : sa calotte arrondie et sa couture
     restaient visibles, et le pivot (166/354, 146) tombe 16 unités SOUS le coin de veste
     qui tenait lieu de ligne d'épaule — il n'y avait donc pas d'épaule du tout, juste un
     manche accroché au flanc. Une tête de manche est cousue PAR-DESSUS le corps de la
     veste : c'est pour ça qu'elle vient en dernier, après les deux bras.
     Elle est STATIQUE — elle ne suit pas le bras, elle le cache à la racine. Chacune
     couvre un disque de rayon ≥ 21 autour de son pivot : c'est ce que balaie la calotte
     du bras (ses coins sont à hypot(18,4) = 18,4 du pivot) quand il tourne, donc le tube
     ne peut jamais sortir par le haut ni ouvrir un trou sur le fond, quelle que soit la
     pose. Même couleur que le corps de la veste (les cinq croupiers ont --cr-veste
     == --cr-manche), donc la jonction ne se voit pas : ce qui donne le volume, c'est le
     dégradé @lum et le pli d'emmanchure. -->
<g id="@crEpaules" stroke="none">
 <path d="M192 120C170 117 150 123 144 141C140 152 143 166 150 178C160 188 178 188 188 178C190 160 191 138 192 120Z" fill="var(--cr-veste,#171C21)"/>
 <path d="M328 120C350 117 370 123 376 141C380 152 377 166 370 178C360 188 342 188 332 178C330 160 329 138 328 120Z" fill="var(--cr-veste,#171C21)"/>
 <path d="M192 120C170 117 150 123 144 141C140 152 143 166 150 178C160 188 178 188 188 178C190 160 191 138 192 120Z" fill="url(#@lum)"/>
 <path d="M328 120C350 117 370 123 376 141C380 152 377 166 370 178C360 188 342 188 332 178C330 160 329 138 328 120Z" fill="url(#@lum)"/>
 <path d="M188 128C186 144 186 162 189 175M332 128C334 144 334 162 331 175" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="2" stroke-linecap="round"/>
 <path d="M153 128C147 137 143 149 143 161M367 128C373 137 377 149 377 161" fill="none" stroke="#FFE9C8" stroke-opacity=".1" stroke-width="2.4" stroke-linecap="round"/>
</g>
</g></svg>`;
const crSvg = prefixe => CR_RIG.replaceAll("@", prefixe);

/* ── Les cinq. Un croupier = un nom, un look (variables + créneaux <use>), un
   tempérament : quelles répliques, à quelle intensité, et ce qu'il surveille.
   `piquant` = probabilité de se moquer d'une perte, `colere` = de râler d'un
   gain, `vigilance` 0-3 = réaction à une mise qui bouge avec le compte.
   ⚠️ `bust` n'est PAS `moqueur`. Perdre contre la main du croupier, c'est le sabot ;
   sauter, c'est un choix qu'on a fait tout seul — et le croupier n'a même pas eu à
   jouer. Ses répliques doivent donc être plus dures, et pointer la DÉCISION. Une
   banque `bust` vide retombe sur `moqueur` : rien ne casse si on n'en écrit pas. ──── */
const CROUPIERS = {
  vince: { nom: "Vince", lieu: "Las Vegas Strip", trait: "Gominé, gouailleur. Parle beaucoup, pardonne peu.",
    coiffe: "c-plaque", visage: "v-rond", orne: "o-noeud", lunettes: "l-rien", moustache: "m-rien", barbe: "b-bouc", acc: "a-rien", sourcils: 1, oeil: [1, .94],
    p: { "--cr-peau": "#D8A57C", "--cr-cheveux": "#14100E", "--cr-veste": "#171C21", "--cr-manche": "#171C21", "--cr-gilet": "#4A2028",
      "--cr-chemise": "#F2EDE1", "--cr-poignet": "#F2EDE1", "--cr-orne": "#9E3A31", "--cr-iris": "#3A2A1C", "--cr-pochette": "#9E3A31" },
    piquant: .95, colere: .8, vigilance: 1, repos: "content",
    dit: {
      accueil: ["Bienvenue au Boulevard. Asseyez-vous, on va bien s'entendre.", "Salut. Vegas, baby."],
      assurance: ["Un as. Assurance ? {cout}, la moitié de votre mise.", "Je montre un as. Assurance ? {cout}."],
      bust: ["Vingt-deux !", "Vous vous êtes fait ça tout seul.", "Il fallait rester.", "Ha ! Magnifique.", "Personne ne vous a poussé.", "Brûlé. Au suivant.",
        "Une de plus pour la maison.", "C'était écrit, ça."],
      moqueur: ["Ça pique.", "La maison vous remercie.", "On remet ça ?", "Dommage. Sincèrement.", "Vegas, baby.", "Les cartes ne vous aiment pas ce soir.",
        "Vous reviendrez. Ils reviennent tous.", "Aïe.", "Je compatis. Un peu.", "Le sabot avait ses raisons.", "Et voilà le travail.", "Tirer là-dessus… audacieux."],
      agace: ["Coup de chance.", "Profitez-en.", "Le chef de table regarde.", "Mouais.", "Ça n'arrivera pas deux fois.", "Encore vous ?",
        "Le sabot se vengera.", "Bon. Très bien.", "Hm.", "Je note.", "Ne vous habituez pas.", "La chance, ça se retourne."],
      serie: ["Trois de suite. Trois.", "Là, vous m'agacez.", "Le chef arrive, ne bougez pas."],
      furieux: ["Un blackjack. Évidemment.", "Vous plaisantez ?", "Non mais…", "Payé. À contrecœur.", "Ce sabot est truqué, c'est sûr.", "Je vais vérifier ce sabot."],
      soupcon: ["Vous misez gros, tout à coup.", "Curieux, cette mise.", "Vous avez vu quelque chose ?", "On monte la mise… pourquoi ?", "Je vous ai à l'œil."],
      abandon: ["Vous abandonnez ? Déjà ?", "Moitié perdue, moitié gardée. Petit joueur.", "Sage. Ou peureux."],
      egalite: ["Égalité. Personne ne bouge.", "Push. On respire."],
    } },
  // 🚨 MARCEL EST LE SEUL À PORTER --cr-sourcil, et c'est ce qui lui rend son visage. Ses
  // cheveux sont gris (#A9A196) sur une peau claire (#E2B896) : le sourcil, peint dans la
  // couleur des cheveux comme chez tout le monde, ne se détachait ni de la peau ni des
  // touffes des tempes, dont il n'est séparé que de 2 à 5 unités. Les deux lisaient comme
  // UN SEUL anneau gris autour des yeux — on ne voyait plus l'angle du sourcil, donc plus
  // rien de ce qu'il exprime. Avec sa moustache en brosse qui recouvrait la bouche,
  // « neutre », « concentré », « soupçon » et « agacé » étaient LE MÊME visage à la couleur
  // des joues près : quatre émotions sur huit perdues. Le brun sombre ci-dessous garde son
  // âge (il reste plus clair que le noir des autres) sans se confondre avec sa chevelure.
  marcel: { nom: "Marcel", lieu: "Vieux Reno", trait: "Vieux briscard, moustache en brosse. Lent, exact, et il a tout vu.",
    coiffe: "c-degarni", visage: "v-carre", orne: "o-noeud", lunettes: "l-rien", moustache: "m-brosse", barbe: "b-pleine", acc: "a-chaine", sourcils: 1.35, oeil: [1, .8],
    p: { "--cr-peau": "#E2B896", "--cr-cheveux": "#A9A196", "--cr-sourcil": "#5A4C3E", "--cr-barbe": "#857C71", "--cr-veste": "#3A2E26", "--cr-manche": "#3A2E26", "--cr-gilet": "#6B5A44",
      "--cr-chemise": "#F3EEE2", "--cr-poignet": "#F3EEE2", "--cr-orne": "#6E4A22", "--cr-iris": "#4A6070", "--cr-pochette": "#D9B45B" },
    piquant: .85, colere: .9, vigilance: 2,
    dit: {
      accueil: ["Assieds-toi, fiston. Ici c'est Reno.", "Prenez votre temps. Moi j'en ai."],
      assurance: ["J'ai un as, fiston. Assurance ? {cout}.", "Un as. Vous vous assurez ? {cout}."],
      bust: ["Vingt-deux, fiston !", "Tu t'es fait ça tout seul.", "Fallait rester.", "Ha ! Trente ans que je vois ça.", "Brûlé.", "Personne t'a poussé, hein.",
        "Le seize, ça se garde.", "Et voilà le travail."],
      moqueur: ["Dommage, fiston.", "La maison vous remercie.", "J'ai vu pire. Rarement.", "Ça pique, hein ?", "Le sabot a parlé.", "On remet ça ?",
        "C'est Reno, ici.", "Ça arrive aux meilleurs. Et aux autres.", "Un de plus pour la maison.", "Ravalez-moi cette grimace.", "Tirer sur seize, hein…", "Dommage."],
      agace: ["Coup de chance.", "Profitez-en, ça ne dure pas.", "Ho.", "Bon.", "Chance de débutant.", "Le chef regarde.",
        "Encore ?", "Je vous connais, vous.", "Ça sent l'écurie.", "Ne vous emballez pas.", "Vous m'énervez, un peu.", "Bien joué. Grmpf."],
      serie: ["Trois. Ça suffit.", "Là, je commence à compter aussi.", "Le chef ! Le chef !"],
      furieux: ["Blackjack ! Nom d'un chien.", "Vous vous fichez de moi ?", "Payé. Payé.", "Ce sabot est maudit.", "J'ai pas signé pour ça.", "Bon sang."],
      soupcon: ["Vous misez gros, tout à coup.", "Pourquoi cette mise, là ?", "Vous comptez, vous ?", "J'ai l'œil, jeune homme.", "Drôle de mise."],
      abandon: ["Abandonner ? De mon temps…", "La moitié. Pff.", "Sage. Ennuyeux, mais sage."],
      egalite: ["Égalité. Ni vu ni connu.", "On ne bouge pas."],
    } },
  lin: { nom: "Lin", lieu: "Cotai, Macao", trait: "Impassible. Puis cinglante, quand vous perdez trop.",
    modele3d: "femme", coiffe: "c-chignon", visage: "v-long", orne: "o-mao", lunettes: "l-rien", moustache: "m-rien", barbe: "b-rien", acc: "a-rien", sourcils: .85, oeil: [.98, .84],
    p: { "--cr-peau": "#E6C29B", "--cr-cheveux": "#0F0C0B", "--cr-veste": "#4A0F0D", "--cr-manche": "#4A0F0D", "--cr-gilet": "#7A1410",
      "--cr-chemise": "#EFE7D6", "--cr-poignet": "#EFE7D6", "--cr-orne": "#F2C15A", "--cr-or": "#F2C15A", "--cr-iris": "#241A12", "--cr-pochette": "#F2C15A" },
    piquant: .45, colere: .6, vigilance: 1,
    dit: {
      accueil: ["Bonsoir.", "Prenez place. La machine ne dort jamais."],
      assurance: ["As. Assurance ? {cout}."],
      bust: ["Sauté.", "Vous vous êtes fait ça seule.", "Il fallait rester.", "Vingt-deux.", "C'était votre main. Pas la mienne.", "Brûlée.",
        "Personne ne vous a forcée.", "Voilà."],
      moqueur: ["Dommage.", "C'était prévisible.", "La table encaisse.", "Encore ?", "Vous comptiez sur quoi ?", "Le hasard a tranché.",
        "Perdu.", "La mélangeuse s'en souvient.", "Rien à dire.", "Prochaine main.", "Ça ira mieux. Peut-être.", "…"],
      agace: ["Bien.", "Hm.", "Une fois.", "Payé.", "Le hasard, seulement le hasard.", "N'y prenez pas goût.",
        "De la chance, pas du talent.", "Intéressant.", "Je note.", "Encore une, et on discute.", "Ne souriez pas.", "La maison a la mémoire longue."],
      serie: ["Trois. On discute.", "Cessez de sourire.", "Le chef de table est prévenu."],
      furieux: ["Blackjack.", "…Payé.", "Ce sabot mérite une vérification.", "Je ne dirai rien.", "Vraiment ?", "Le chef de table sera informé."],
      soupcon: ["Vous misez gros, tout à coup.", "Cette mise m'intrigue.", "Vous avez changé de rythme.", "Mise curieuse.", "Le chef vous regarde."],
      abandon: ["Abandon.", "La moitié. Soit.", "Prudent."],
      egalite: ["Égalité.", "Rien ne bouge."],
    } },
  ada: { nom: "Ada", lieu: "Monte-Carlo", trait: "Lunettes carrées, carré strict. Glaciale, précise, jamais un mot de trop.",
    modele3d: "femme", coiffe: "c-carre", visage: "v-ovale", orne: "o-lavalliere", lunettes: "l-carrees", moustache: "m-rien", barbe: "b-rien", acc: "a-rien", sourcils: .9, oeil: [1.05, 1.06],
    p: { "--cr-peau": "#EBD2BA", "--cr-cheveux": "#3A2418", "--cr-veste": "#1B2A4E", "--cr-manche": "#1B2A4E", "--cr-gilet": "#2A4070",
      "--cr-chemise": "#FBF8F0", "--cr-poignet": "#FBF8F0", "--cr-orne": "#D4B46A", "--cr-iris": "#38506B", "--cr-monture": "#20201E", "--cr-pochette": "#FBF8F0" },
    piquant: .6, colere: .7, vigilance: 2,
    dit: {
      accueil: ["Les jeux sont faits.", "Bonsoir. Le règlement est affiché."],
      assurance: ["Assurance. {cout}.", "Un as. Assurance ? {cout}."],
      bust: ["Vingt-deux. Sauté.", "Vous vous êtes fait ça tout seul.", "Il fallait rester.", "La table n'y est pour rien.", "Brûlé.", "Une décision. Une conséquence.",
        "Personne ne vous a poussé.", "Noté."],
      moqueur: ["Dommage.", "La maison vous remercie.", "Ce n'était pas une décision.", "Perdu.", "Pas de commentaire.", "Vous reviendrez, ils reviennent tous.",
        "Une main de moins.", "C'est fini.", "Sans surprise.", "Voilà.", "La table encaisse.", "Prochaine."],
      agace: ["Coup de chance.", "Soit.", "Le chef de table regarde.", "Profitez-en.", "Payé.", "Ne vous méprenez pas.",
        "Une fois n'est pas coutume.", "Hm.", "Curieux.", "Ça ne se reproduira pas.", "Bien.", "Noté."],
      serie: ["Trois. Je note l'heure.", "Ne vous méprenez pas : je vois.", "Le chef de table est appelé."],
      furieux: ["Blackjack.", "…Payé.", "Je demande une vérification.", "Inadmissible.", "Le sabot sera changé.", "Très bien."],
      soupcon: ["Vous misez gros, tout à coup.", "Cette mise n'est pas innocente.", "Je vous observe.", "Justifiez cette mise.", "Le chef de table est prévenu."],
      abandon: ["Abandon. Noté.", "La moitié vous reste. Pour l'instant.", "Prudent. Ou lucide."],
      egalite: ["Égalité.", "Personne ne gagne. Surtout pas vous."],
    } },
  // ⚠️ `sourcils` du Chef est passé de 1,6 à 1,45 le 06/09. Ce n'est pas un caprice : à 1,6
  // ses sourcils faisaient 24 à 27 unités de haut sur un visage de 100, et ils sortaient du
  // front dès qu'ils se LEVAIENT, quelle que soit la hauteur de la ligne de cheveux — il
  // était le seul des cinq à ne pas tenir la règle des 4 unités. À 1,45 il reste, avec
  // Marcel, le sourcil le plus épais de la table, et ses huit émotions passent.
  chef: { nom: "Le Chef", lieu: "Salon privé", trait: "Chef de table, détecteur de triche. Il ne regarde pas vos cartes : il regarde vos mises.",
    coiffe: "c-courts", visage: "v-anguleux", orne: "o-cravate", lunettes: "l-rien", moustache: "m-fine", barbe: "b-collier", acc: "a-epingle", sourcils: 1.45, oeil: [.93, .8],
    p: { "--cr-peau": "#A9724A", "--cr-cheveux": "#26221F", "--cr-veste": "#0F1418", "--cr-manche": "#0F1418", "--cr-gilet": "#1C242B",
      "--cr-chemise": "#FBF8F0", "--cr-poignet": "#FBF8F0", "--cr-orne": "#141A20", "--cr-iris": "#2A3A46", "--cr-pochette": "#C9A65A" },
    piquant: .8, colere: .9, vigilance: 3, repos: "concentre",
    dit: {
      accueil: ["Chef de table. Je surveille, vous jouez.", "Bonsoir. Vos mises m'intéressent plus que vos cartes."],
      assurance: ["Un as. Vous vous assurez ? {cout}.", "As. Assurance ? {cout}."],
      bust: ["Vingt-deux. Sauté.", "Vous vous êtes fait ça tout seul.", "Il fallait rester.", "Le compte disait de rester.", "Brûlé.", "Même les compteurs sautent.",
        "Personne ne vous a poussé.", "Et voilà."],
      moqueur: ["Dommage.", "Ça pique.", "La maison vous remercie.", "Perdu. Encore.", "On remet ça ?", "Le compte ne fait pas tout.",
        "Une main de compteur, ça.", "Rien ne vous sauvera.", "Je compte aussi, vous savez.", "Et hop.", "Vous pouvez partir.", "Merci pour votre contribution."],
      agace: ["Coup de chance.", "Je surveille.", "Profitez-en.", "Le chef de table, c'est moi.", "Ça se voit, vous savez.", "Encore un et je note.",
        "Vous avez de la suite dans les idées.", "Hm hm.", "Tenez votre visage.", "Combien, le compte ?", "Trop régulier pour être honnête.", "Je vous ai à l'œil."],
      serie: ["Trois de suite. La sécurité est prévenue.", "Personne n'a autant de chance.", "Vous comptez. J'en suis sûr."],
      furieux: ["Blackjack. Bien sûr.", "Vous comptez. J'en suis sûr.", "Payé. Pour l'instant.", "Je préviens la sécurité.", "Ce n'est pas de la chance.", "On va discuter."],
      soupcon: ["Vous misez gros, tout à coup.", "Mise et compte, main dans la main…", "Cette rampe de mise vous trahit.", "Vous montez quand le sabot est riche.", "Je vois clair dans votre jeu."],
      abandon: ["Abandon. Un compteur qui doute ?", "La moitié. Je note.", "Prudent. Trop."],
      egalite: ["Égalité.", "Rien. Continuez."],
    } },
};
// Le lieu de la table propose son croupier ; un choix explicite le verrouille.
const CROUPIER_DEFAUT = { boulevard: "vince", mainchaude: "vince", neon: "marcel", reno: "marcel", cotai: "lin", aquarium: "lin",
  cercle: "ada", frontdemer: "chef", salonprive: "chef" };
if (!DB.croupier || typeof DB.croupier !== "object") DB.croupier = { id: typeof DB.croupier === "string" ? DB.croupier : "", nom: "", noms: {} };
DB.croupier.noms = DB.croupier.noms || {};
if (DB.croupier.id && !CROUPIERS[DB.croupier.id]) DB.croupier.id = "";
const crEffectif = () => DB.croupier.id || CROUPIER_DEFAUT[tableCourante().id] || "vince";
const crPerso = () => CROUPIERS[CR.id] || CROUPIERS.vince;
const crNom = () => (DB.croupier.noms[CR.id] || "").trim() || crPerso().nom;
// Le visage de repos n'est pas le même pour tout le monde : Vince sourit en coin,
// le Chef ne se déride jamais. `CR.base` y retombe entre deux manches.
const crRepos = () => crPerso().repos || "neutre";
const crAuRepos = () => CR.emotion === "neutre" || CR.emotion === crRepos();
// Rire au nez d'un joueur qui saute, ça se mérite — et ça ne va pas à tout le monde. Lin est
// écrite « impassible », Ada « glaciale, jamais un mot de trop » : les faire glousser, ce
// serait leur retirer leur seul trait. On réutilise le curseur qui existe déjà (`piquant`,
// celui qui décide si elles ouvrent la bouche) au lieu d'en inventer un second : au-dessus de
// .7 il rit (Vince .95, Marcel .85, le Chef .8), en dessous son mépris reste un sourire en coin.
const crRire = () => (crPerso().piquant || 0) >= .7 ? "hilare" : "moqueur";

/* ── L'état ──────────────────────────────────────────────────────────── */
const CR = { id: "", el: null, scene: null, bulle: null, visible: false, salue: false, fixe: false,
  j: {}, seg: {}, an: {}, arme: false, base: "neutre", emotion: "neutre", jeton: 0, gestes: 0,
  dernier: {}, gains: 0, pertes: 0, mises: [], derniereAlerte: -9,
  // La tête tourne de deux angles ADDITIONNÉS : le regard (vers un siège) et le penché (une
  // émotion), plus une avancée (le menton qui vient). Une émotion sans penché la redresse,
  // sans toucher au regard.
  regard: 0, penche: 0, avance: 0, annonceT: 0, bulleGenre: "", paieFin: 0,
  // L'articulation est une BOUCLE : un jeton pour l'annuler, une minuterie, la forme de repos.
  articule: 0, articuleT: null, articuleRetour: "calme" };
const CR_RESSORT = "cubic-bezier(.22,.72,.24,1)";

const crQ = s => CR.el ? CR.el.querySelector(s) : null;
const crMinuteur = (f, ms) => setTimeout(f, ms);

/* ── Monter le croupier dans #croupierScene ─────────────────────────── */
// ⚠️ --cr-sourcil est OPTIONNELLE et le reste : `crLook` pose "" quand un croupier ne la
// donne pas, ce qui RETIRE la propriété, et le fill retombe alors sur --cr-cheveux. Elle
// n'existe que pour les têtes dont les cheveux ne contrastent plus avec la peau — Marcel.
const VISAGES = {
  "v-ovale": "M260 14C228 14 210 36 210 64C210 78 214 90 222 98C230 108 244 114 260 114C276 114 290 108 298 98C306 90 310 78 310 64C310 36 292 14 260 14Z",
  "v-rond": "M260 14C228 14 210 36 210 64C210 81 216 94 226 102C234 108 246 112 260 112C274 112 286 108 294 102C304 94 310 81 310 64C310 36 292 14 260 14Z",
  "v-carre": "M260 14C228 14 210 36 210 64C210 80 211 95 219 105C227 113 242 117 260 117C278 117 293 113 301 105C309 95 310 80 310 64C310 36 292 14 260 14Z",
  "v-long": "M260 14C228 14 210 36 210 64C210 78 215 93 225 103C233 113 247 119 260 119C273 119 287 113 295 103C305 93 310 78 310 64C310 36 292 14 260 14Z",
  "v-anguleux": "M260 14C228 14 210 36 210 64C210 80 212 96 220 106C229 114 243 118 260 118C277 118 291 114 300 106C308 96 310 80 310 64C310 36 292 14 260 14Z",
};
const CR_VARS = ["--cr-peau", "--cr-cheveux", "--cr-sourcil", "--cr-barbe", "--cr-veste", "--cr-manche", "--cr-gilet", "--cr-chemise", "--cr-poignet", "--cr-orne", "--cr-iris", "--cr-monture", "--cr-pochette", "--cr-or"];
function crLook(svg, c, prefixe) {
  for (const k of CR_VARS) svg.style.setProperty(k, c.p[k] || (k === "--cr-monture" ? "#3A2A1C" : k === "--cr-or" ? "#D9B45B" : ""));
  const u = (id, href) => { const e = svg.querySelector("#" + prefixe + id); if (e) e.setAttribute("href", "#" + prefixe + href); };
  u("crCoiffe", c.coiffe); u("crOrne", c.orne); u("crLunettes", c.lunettes); u("crMoustache", c.moustache); u("crAcc", c.acc || "a-rien");
  u("crBarbe", c.barbe || "b-rien");
  // Le VISAGE s'écrit, il ne se référence pas : un <use> aurait été plus court, mais son
  // instance n'hérite pas du fill posé sur la fente — mesuré le 07/09, le tracé changeait
  // de FORME et gardait la couleur de repli, si bien que les cinq peaux redevenaient une
  // seule. Deux setAttribute lus dans la même table ne peuvent pas diverger non plus.
  const dv = VISAGES[c.visage] || VISAGES["v-ovale"];
  ["crVisage", "crVisageL"].forEach(k => { const e = svg.querySelector("#" + prefixe + k); if (e) e.setAttribute("d", dv); });
  // La FORME DES YEUX, posée sur l'orbite et pas sur l'œil : le clignement anime
  // #crOeil* en scaleY et repartirait de 1, ce qui ferait sauter une paupière tombante
  // à chaque battement. Un cran au-dessus, l'échelle tient et le clignement s'y compose.
  const oe = c.oeil || [1, 1];
  ["crOrbG", "crOrbD"].forEach(k => { const e = svg.querySelector("#" + prefixe + k); if (e) e.style.transform = `scale(${oe[0]},${oe[1]})`; });
  // L'épaisseur des sourcils fait la moitié d'un caractère : posée avec la pose
  // neutre, par le même chemin que les émotions (crVisage la conserve).
  ["crSourcilG", "crSourcilD"].forEach(k => { const e = svg.querySelector("#" + prefixe + k); if (e) e.style.transform = `scaleY(${c.sourcils || 1})`; });
}
/* ── LE CROUPIER 3D : une OPTION, et le dessin reste le croupier ──────
   🚨 ESSAYÉ EN DÉFAUT LE 07/09/2026, REFUSÉ LE JOUR MÊME. Léo l'avait demandé
   deux fois, puis a vu le résultat en ligne : « remets les anciens, je n'aime
   pas du tout ceux-là ». La 3D reste disponible derrière la case des réglages,
   elle ne s'allume plus toute seule, et on ne réessaiera pas sans qu'il le
   redemande.

   POURQUOI ça ne marche pas, pour que personne ne le retente à l'aveugle : les
   modèles CC0 n'ont AUCUN morph target, donc le visage est FIGÉ — Vince annonce
   « 14 contre un dix » avec exactement la tête qu'il aura quand tu sauteras. Et
   ils ne portent aucun des cinq signes qui font les cinq croupiers : la
   moustache en brosse de Marcel, son crâne dégarni, le chignon de Lin, les
   lunettes carrées d'Ada. Le dessin fait les deux. Un vrai croupier 3D demande
   des modèles sculptés avec des morphs faciaux — ça se paie, ça ne se télécharge
   pas.

   ⚠️ LE SVG NE PART PAS : il porte la bulle, les gestes de bras et tout le jeu,
   il est le repli quand la 3D échoue, et il est le SEUL croupier de l'artefact
   publié. Le supprimer laisserait une table vide là-bas.

   Deux modèles pour cinq croupiers (Lin et Ada sont des femmes) : ils viennent
   du MÊME lot, donc même squelette, mêmes clips, et l'un remplace l'autre sans
   une ligne de plus dans le moteur.

   ⚠️ Rien n'est téléchargé tant qu'on n'ouvre pas une table : 655 Ko de three.js
   et ~1,5 Mo de modèle vivent dans static/, hors du fichier unique, et n'arrivent
   qu'au premier montage. C'est la raison d'être du `import()` dynamique — et un
   seul des deux modèles part, celui du croupier de la table.
   ⚠️ Indisponible dans l'ARTEFACT, et il faut le DIRE : sa politique de sécurité
   bloque toute requête externe, donc le module et le modèle n'arriveraient
   jamais — silencieusement, comme la visio. On détecte l'artefact au même
   signal que le hall : window.PHOTOS_PETIT n'existe qu'en mode « pages ». */
const CR3D = { api: null, etat: { regard: 0, penche: 0, clip: "repos" }, occupe: false, panne: "", modele: "" };
const cr3dPossible = () => !!window.PHOTOS_PETIT;
// 🚨 ÉTEINTE PAR DÉFAUT. Elle a été allumée par défaut pendant une heure le
// 07/09, puis Léo a tranché en la voyant : « remets les anciens, je n'aime pas
// du tout ceux-là ». `=== 1` et pas `!== 0` : il faut avoir coché SOI-MÊME.
// Ne pas ré-inverser sans une demande explicite — ça a déjà été essayé.
const cr3dVoulu = () => DB.croupier.tri3d === 1 && cr3dPossible();
// Deux modèles seulement, et c'est assumé : les cinq croupiers ne se
// distinguent plus que par le corps (homme/femme) et par la palette.
const cr3dModele = c => "static/modeles/" + (c.modele3d || "croupier") + ".glb";
// Même palette que le SVG : les cinq croupiers sont les mêmes gens des deux côtés.
const cr3dPalette = c => { const p = c.p || {}, t = {};
  for (const k of ["peau", "cheveux", "sourcil", "veste", "chemise", "orne"]) t[k] = p["--cr-" + k] || "";
  t.sourcil = t.sourcil || t.cheveux; t.encre = "#141110"; return t; };
async function cr3dMonter() {
  const hote = $("croupierScene"); if (!hote || CR3D.occupe || CR3D.api) return;
  CR3D.occupe = true; CR3D.panne = "";
  try {
    const m = await import("./static/3d/croupier3d.js");
    if (!cr3dVoulu()) return;                       // éteint pendant le chargement
    const c = crPerso(), url = cr3dModele(c);
    CR3D.api = await m.monter({ hote, modele: url, palette: cr3dPalette(c), etat: CR3D.etat });
    CR3D.modele = url;
    hote.classList.add("en3d");
  } catch (e) {
    // Un échec doit se DIRE : un croupier absent sans un mot passe pour une panne
    // de l'application entière. On repasse au dessin, qui lui marche toujours.
    CR3D.panne = String(e && e.message || e); DB.croupier.tri3d = 0; garder();
    log3d();
  } finally { CR3D.occupe = false; }
}
function cr3dDemonter() {
  const hote = $("croupierScene");
  if (CR3D.api) { try { CR3D.api.demonter(); } catch (e) { console.debug("croupier 3D : démontage", e); } CR3D.api = null; CR3D.modele = ""; }
  if (hote) hote.classList.remove("en3d");
}
function log3d() { if (CR3D.panne) console.warn("croupier 3D indisponible : " + CR3D.panne); }

function monterCroupier() {
  const scene = $("croupierScene"); if (!scene) return;
  const id = crEffectif(); if (id === CR.id && CR.el) return;
  CR.id = id; const c = crPerso();
  scene.innerHTML = crSvg("cr-");
  CR.el = scene.querySelector("svg"); CR.scene = scene;
  crLook(CR.el, c, "cr-");
  CR.j = {}; CR.seg = {}; CR.an = {}; CR.arme = false;
  CR.base = crRepos(); CR.emotion = CR.base; crVisage(EMOTIONS[CR.base]);
  crReposer(1);
  crLancerAmbiance();
  // Le SVG est monté quoi qu'il arrive : c'est lui le repli si la 3D échoue,
  // et c'est lui qui porte la bulle, les gestes de bras et le reste du jeu.
  // ⚠️ Changer de croupier peut changer de MODÈLE (Lin et Ada sont des femmes) :
  // repeindre ne suffit pas, il faut redémonter. Même modèle ⇒ on repeint, et la
  // 3D ne recharge rien.
  if (!cr3dVoulu()) cr3dDemonter();
  else if (CR3D.api && CR3D.modele !== cr3dModele(c)) { cr3dDemonter(); cr3dMonter(); }
  else if (!CR3D.api) cr3dMonter();
  if (CR3D.api) CR3D.api.poser(cr3dPalette(c));
}

/* ── Écran → rig. Pas de getScreenCTM : la boîte de l'<svg> suffit, parce que
   viewBox + « meet » + largeur automatique rendent le rapport exact — et un
   ancêtre HTML transformé (c'est le cas de #croupierScene) ne trompe plus
   personne. ────────────────────────────────────────────────────────── */
function crRepere() {
  if (!CR.el) return null;
  const r = CR.el.getBoundingClientRect(); if (r.width < 8 || r.height < 8) return null;
  const s = Math.min(r.width / 520, r.height / 200);
  return { s, x0: r.left + (r.width - 520 * s) / 2, y0: r.top + (r.height - 200 * s), r };
}
// Un point d'écran, exprimé en unités de rig.
function crVersRig(x, y, rep) {
  rep = rep || crRepere(); if (!rep) return null;
  return { x: (x - rep.x0) / rep.s, y: (y - rep.y0) / rep.s };
}
const crRect = id => { const e = $(id); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? r : null; };
// Le bord de la table à l'écran (le haut du rail) : là où le buste s'arrête.
const crBordTable = rep => { const p = crRect("plateau"); return p ? p.top : rep.y0 + 200 * rep.s; };

/* ── Les articulations : WAAPI, interruptible, sans fuite ─────────────
   Une animation fill:"forwards" reste vivante à jamais : on CUIT la pose
   finale en style en ligne puis on libère. La branche de rejet est vide et
   OBLIGATOIRE — cancel() rejette `finished`, et verifier.sh compte les
   unhandledrejection. Interrompre un geste repart de l'angle RÉEL (lu sur la
   progression), sinon le bras saute à la cible du geste précédent. ─────── */
const FORME = (cle, v) => {
  if (cle === "crTete") return `translate(${(v * .55).toFixed(2)}px,${CR.avance.toFixed(1)}px) rotate(${v.toFixed(2)}deg)`;
  // Le visage glisse de .8 unité par degré de regard, EN PLUS des .55 du crâne : c'est
  // l'écart entre les deux qui se lit comme un trois-quarts, pas leur somme. Le penché
  // (l'inclinaison d'une émotion) n'y entre pas — on penche la tête sans tourner le nez.
  if (cle === "crFace") return `translateX(${(v * .8).toFixed(2)}px)`;
  if (cle.startsWith("crGaine")) return `scaleY(${v.toFixed(3)})`;
  if (cle.startsWith("crMain")) return `translateY(${v.toFixed(2)}px)`;
  return `rotate(${v.toFixed(2)}deg)`;
};
function crCourant(cle) {
  const an = CR.an[cle];
  if (!an || an.playState !== "running") return CR.j[cle] || 0;
  const p = an.effect.getComputedTiming().progress || 0;
  const [d0, d1] = CR.seg[cle] || [0, 0];
  return d0 + (d1 - d0) * (p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
}
function crBouger(cle, a, ms, o) {
  const e = crQ("#cr-" + cle); if (!e) return;
  o = o || {};
  const de = crCourant(cle); CR.j[cle] = a;
  if (CR.an[cle]) { CR.an[cle].cancel(); CR.an[cle] = null; }
  if (MOUVEMENT_REDUIT.on || !ms || ms < 24 || Math.abs(a - de) < .05) { e.style.transform = FORME(cle, a); return; }
  CR.seg[cle] = [de, a];
  // fill:"both" — pendant le RETARD (le geste attend la carte, o.delai), le membre tient sa
  // position de départ ; avec "forwards" il retombait sur la pose cuite d'avant.
  const an = e.animate([{ transform: FORME(cle, de) }, { transform: FORME(cle, a) }],
    { duration: ms, delay: o.delai || 0, easing: o.easing || CR_RESSORT, fill: "both" });
  an.finished.then(() => { if (CR.an[cle] === an) { e.style.transform = FORME(cle, CR.j[cle]); an.cancel(); CR.an[cle] = null; } }, () => {});
  CR.an[cle] = an;
}

/* ── La pose d'un bras : le POIGNET va à un point d'ÉCRAN, en ms ─────────
   Le coude se place d'abord : à une longueur fixe de l'épaule, vers le bas et
   l'extérieur, d'autant plus bas que la cible est basse — jamais loin sous le bord
   de table (θ ≤ 55°), jamais en aile de poulet (θ ≥ 22°). L'avant-bras va du coude
   au poignet, raccourci ou allongé (36…172), la gaine mise à l'échelle et la main
   translatée au bout. Hors de portée, la main s'arrête au bout du bras : il ne
   se casse pas. `o` : { delai, easing, theta } — le même retard pour les cinq
   membres, sinon les moitiés du bras ne partent pas ensemble ; `theta` impose
   l'angle du coude, `doigtsBas` fait pendre la main verticale (le repos). ── */
function crPoseBras(cote, x, y, ms, poignet, o) {
  const rep = crRepere(), p = crVersRig(x, y, rep); if (!p) return false;
  const S = CR_EPAULE[cote], k = cote === "D" ? 1 : -1;
  const a = Math.atan2(p.y - S[1], k * (p.x - S[0])) * 180 / Math.PI;   // 0 = sortant à l'horizontale, 90 = vers le bas
  const th = o && o.theta ? o.theta : Math.max(22, Math.min(55, 38 + (a - 40) * .35)), t1 = th * Math.PI / 180;
  const ex = S[0] + k * CR_L1 * Math.cos(t1), ey = S[1] + CR_L1 * Math.sin(t1);
  let fx = p.x - ex, fy = p.y - ey, d = Math.hypot(fx, fy) || 1;
  const dd = Math.max(CR_L2_MIN, Math.min(CR_L2_MAX, d)); fx *= dd / d; fy *= dd / d; d = dd;
  const phi1 = k === 1 ? th : 180 - th, phi2 = Math.atan2(fy, fx) * 180 / Math.PI;
  const rot1 = phi1 - 90; let rot2 = phi2 - phi1; rot2 = ((rot2 + 540) % 360) - 180;
  crBouger("crBras" + cote, rot1, ms, o); crBouger("crAvant" + cote, rot2, ms, o);
  crBouger("crGaine" + cote, d / CR_GAINE, ms, o); crBouger("crMain" + cote, d, ms, o);
  // `doigtsBas` : la main pend verticale quel que soit l'avant-bras (le repos sur le rail,
  // où l'intervalle libre est trop étroit pour des doigts en biais) — poignet borné à ±50°.
  const poi = o && o.doigtsBas ? Math.max(-50, Math.min(50, 90 - phi2)) : (poignet || 0);
  crBouger("crPoignet" + cote, poi, ms, o);
  return true;
}
// Un poignet qui viendrait SUR les cartes du croupier est repoussé sur le côté le plus
// proche : payer le siège du milieu ou lui servir une carte passait par-dessus la carte
// cachée (mesuré le 05/09). La main descend à côté de ses cartes, jamais dessus.
function crEviterCartes(x, y) {
  const dm = crRect("dMain"), rep = crRepere(); if (!dm || !rep) return x;
  const m = 46 * rep.s;
  if (y < dm.top - 10 * rep.s || y > dm.bottom + 70 * rep.s || x < dm.left - m || x > dm.right + m) return x;
  return x - dm.left < dm.right - x ? dm.left - m : dm.right + m;
}
// La petite carte dans la paume : visible pendant le coup de poignet seulement.
function crCarteEnMain(cote, on) { const e = crQ("#cr-crCarte" + cote); if (e) e.setAttribute("opacity", on ? "1" : "0"); }

/* ── Les poses. Toutes lues à l'écran : le rack, le sabot et la défausse sont là
   où la scène les a mis, la course des bras suit. ───────────────────────── */
// La bouche du sabot : là où la carte sort, le poignet juste à gauche d'elle.
// La PAUME sur le centre du sabot — là d'où la carte part (table.js, --dx/--dy) — pour que la main
// et la carte partagent la même ligne de vol. La main pend du poignet le long de l'avant-bras :
// le poignet vise donc le centre du sabot RECULÉ de la longueur de la paume, dans la direction
// de l'épaule. Mesuré le 05/09 avec le poignet au coin haut-gauche : la main plongeait de 48 px
// sous la ligne de vol, et pendant trois images on voyait deux cartes à 44 px l'une de l'autre ;
// au bord gauche à mi-hauteur, hors de portée, la main pendait SOUS le sabot et la manche le barrait.
function crCibleSabot() {
  const r = crRect("sabot"), rep = crRepere(); if (!r || !rep) return null;
  const cx = r.left + r.width * .5, cy = r.top + r.height * .46;
  const sx = rep.x0 + CR_EPAULE.D[0] * rep.s, sy = rep.y0 + CR_EPAULE.D[1] * rep.s;
  const dx = cx - sx, dy = cy - sy, d = Math.hypot(dx, dy) || 1, recul = 44 * rep.s;
  return { x: cx - dx / d * recul, y: cy - dy / d * recul };
}
// Au repos, les mains sont POSÉES sur le feutre de chaque côté du rack, juste sous ses
// coins, doigts vers les joueurs — pas vissées sur la défausse et le sabot (les critiques,
// 05/09). Chaque main se place d'après ce qui l'entoure, lu à l'écran : la gauche entre
// le rack et le libellé « Croupier » (mesuré le 05/09, elle en mordait le C), la droite
// entre le rack et le sabot ; les doigts s'arrêtent au-dessus du libellé. À 1280 le rack
// est large et cache le coude, à 1920 il est étroit et le coude se voit sur le rail.
// Sans rack (téléphone), devant soi.
const CR_THETA_REPOS = 50;   // le coude au repos : à 50°, il est sous le poignet, l'avant-bras pointe vers nous
function crCibleRepos(cote) {
  const rep = crRepere(); if (!rep) return null;
  const rk = crRect("rack"), top = crBordTable(rep), s = rep.s, cx = rep.x0 + 260 * s, y = top + 46 * s, k = cote === "D" ? 1 : -1;
  // Le poignet sous le coude, si la place le permet ; sinon dans l'intervalle libre, et si
  // l'intervalle est plus étroit que la main, en son milieu (à 1920 sur Cotai, 42 px entre
  // le rack et le sabot pour une main de 42).
  const voulu = rep.x0 + (CR_EPAULE[cote][0] + k * CR_L1 * Math.cos(CR_THETA_REPOS * Math.PI / 180)) * s;
  const cale = (x, lo, hi) => hi < lo ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, x));
  if (!rk) return { x: voulu, y };
  // À droite, JAMAIS sur le sabot (mesuré le 05/09 : Salon Privé à 1280, Cotai à 1920, la main
  // recouvrait le chrome). Quand l'intervalle rack → sabot est plus étroit que la main, elle se
  // pose contre le sabot et déborde sur le bord du rack — un croupier a la main sur son rack,
  // pas sur son sabot.
  // 30 px de dégagement, pas 22 : au repos la main droite est TOURNÉE vers le sabot
  // (crReposer) et son gabarit déborde — mesuré le 06/09, elle mordait le chrome du sabot.
  if (cote === "D") { const sb = crRect("sabot"); const hi = sb ? sb.left - 30 * s : Infinity, lo = rk.right + 12 * s;
    return { x: hi < lo ? hi : Math.max(lo, Math.min(hi, voulu)), y }; }
  const qui = document.querySelector(".croupier .qui"), q = qui && qui.getBoundingClientRect(), df = crRect("defausse");
  return { x: cale(voulu, df ? df.right + 24 * s : -Infinity, Math.min(rk.left - 14 * s, q && q.width ? q.left - 24 * s : Infinity)), y };
}
function crReposer(ms) {
  ms = ms === undefined ? 340 : ms; CR.arme = false;
  const d = crCibleRepos("D"), g = crCibleRepos("G"); if (!d) return;
  // Les deux mains ne sont PAS le miroir l'une de l'autre : la droite est tournée vers le
  // sabot — c'est d'elle que sortent les cartes —, la gauche posée à plat. Mesuré le 06/09 :
  // deux mains identiques, symétriques, doigts écartés, à 200 px de part et d'autre du rack,
  // se lisaient comme un mannequin. (Les bras BOUGENT bien à la donne, crFlick les emmène au
  // sabot puis vers le siège ; c'est la pose de REPOS qui ne racontait rien.)
  crPoseBras("D", d.x, d.y, ms, -8, { theta: CR_THETA_REPOS, doigtsBas: true }); crPoseBras("G", g.x, g.y, ms, 5, { theta: CR_THETA_REPOS, doigtsBas: true });
}
function crArmer(ms, o) {
  const c = crCibleSabot(); if (!c) return false;
  CR.arme = true;
  return crPoseBras("D", c.x, c.y, ms || 320, 12, o);
}
// Le retour au sabot d'une main tendue : la même courbe que l'aller, jamais le ressort (qui
// fait 55-70 % du trajet dans les 17 premières ms — mesuré le 05/09, 119 px en UNE image).
const CR_RETOUR = "cubic-bezier(.4,0,.2,1)";
/* LE geste. La main part du sabot, une petite carte dans la paume, et l'ACCOMPAGNE vers
   le siège : même retard que la vraie carte (`delai`), même courbe à démarrage doux, 55 %
   de sa durée et 34 % de son trajet (150 px au plus : au-delà, mesuré le 05/09, la main
   passait SUR ses propres cartes pour servir le siège du milieu) — puis la carte continue seule, comme lancée, et la
   main revient au sabot. `duree`/`delai` viennent de l'événement (table.js les fige sur la
   carte) ; sans eux, l'ancien barème sur la cadence. Sous ~145 ms de cadence il ne revient
   pas au sabot, il enchaîne — ce que fait un vrai croupier lancé. */
function crFlick(vers, v, o) {
  if (!CR.el || !CR.visible) return;
  if (CR3D.api) { CR3D.etat.clip = "geste"; crMinuteur(() => { CR3D.etat.clip = "repos"; }, 900); }
  const c = crCibleSabot(); if (!c) return;
  o = o || {};
  if (!CR.arme) crArmer(Math.min(200, v));
  const dx = vers.x - c.x, dy = vers.y - c.y, d = Math.hypot(dx, dy) || 1;
  let ms, pas, opt;
  if (o.duree) { ms = Math.max(80, Math.round(o.duree * .55)); pas = Math.min(150, d * .34); opt = { delai: o.delai || 0, easing: "cubic-bezier(.4,0,.2,1)" }; }
  else {
    const amp = Math.max(.55, Math.min(1, v / 450));
    const don = parseFloat(getComputedStyle($("plateau")).getPropertyValue("--don")) || 300;
    ms = Math.max(90, Math.min(don * .55, v * .6)); pas = Math.min(150, d * .5) * amp; opt = {};
  }
  crCarteEnMain("D", true);
  const tx = c.x + dx / d * pas, ty = c.y + dy / d * pas;
  crPoseBras("D", vers.el && vers.el.closest && vers.el.closest("#dMain") ? tx : crEviterCartes(tx, ty), ty, ms, -24, opt);
  crRegarde(vers.x, vers.y, ms * 1.3);
  CR.gestes++; const n = CR.gestes;
  // La petite carte s'éteint dès que la VRAIE commence à bouger (son retard + une image) :
  // mesuré le 05/09 à mi-geste, on voyait deux cartes à 8-45 px l'une de l'autre pendant trois images.
  crMinuteur(() => { if (CR.gestes === n) crCarteEnMain("D", false); }, (opt.delai || 0) + Math.min(55, ms * .5));
  const retour = ms + (opt.delai || 0) + 20;
  // Le retour prend au moins 160 ms, sur la courbe de l'aller : un retour en 3 images (175 px en
  // 67 ms, mesuré le 05/09) arrachait l'œil de la carte qui volait encore.
  if (v > retour + 70) crMinuteur(() => { if (CR.arme && CR.gestes === n) crArmer(Math.max(160, Math.min(v - retour - 30, v * .45)), { easing: CR_RETOUR }); }, retour);
  else crMinuteur(() => { if (CR.gestes === n) crCarteEnMain("D", false); }, retour);
}
// Sa propre carte cachée : la main DROITE — déjà armée au sabot, à 60 px de la carte — vient
// SUR elle (le poignet au tiers haut-gauche, les doigts posés dessus), un coup de poignet, la
// carte pivote sous la main, et la main repart au sabot. Mesuré le 05/09 avec la gauche : en
// bout de course, elle s'arrêtait 35 px à côté et 20 px trop haut, sur la carte VISIBLE.
function crRetourne(el) {
  if (!CR.el || !CR.visible || !el) return;
  const r = el.getBoundingClientRect(); if (!r.width) return;
  CR.arme = false; CR.gestes++; const n = CR.gestes;
  crPoseBras("D", r.left + r.width * .3, r.top + r.height * .3, 240, 26, { easing: CR_RETOUR });
  crMinuteur(() => { if (CR.gestes === n) crBouger("crPoignetD", -30, 180); }, 250);
  crMinuteur(() => { if (CR.gestes === n) crArmer(320, { easing: CR_RETOUR }); }, 560);
  crRegarde(r.left + r.width / 2, r.top, 260);
}
function crReposerGauche(ms) { const g = crCibleRepos("G"); if (g) crPoseBras("G", g.x, g.y, ms, 0, { theta: CR_THETA_REPOS, doigtsBas: true }); }
// Le règlement : payer, c'est POUSSER vers le siège (la main part du rack quand les jetons
// en sortent, jetons.js) ; ramasser, c'est balayer vers soi. Les main-fin arrivent en rafale
// et jetons.js les espace de 140 ms (J.attente) : on lit ce retard pour être sur le même
// tempo, sans y toucher. Après le dernier siège, les mains reviennent au rail.
function crPaie(si, issue, retard) {
  if (!CR.el || !CR.visible) return;
  const ce = crRect("cercle_" + si) || crRect("m_" + si + "_0"); if (!ce) return;
  const rep = crRepere(); if (!rep) return;
  const cote = ce.left + ce.width / 2 >= rep.x0 + 260 * rep.s ? "D" : "G";
  // Un pas vers le siège (jamais plus de 120 px), à côté de ses cartes.
  const r0 = crCibleRepos(cote) || { x: rep.x0 + 260 * rep.s, y: crBordTable(rep) };
  let dx = ce.left + ce.width / 2 - r0.x, dy = ce.top + ce.height / 2 - r0.y; const d = Math.hypot(dx, dy) || 1, pas = Math.min(120 * rep.s / .69, d * .5);
  const cy = r0.y + dy / d * pas, cx = crEviterCartes(r0.x + dx / d * pas, cy);
  const gagne = issue === "gagne" || issue === "blackjack";
  const fin = performance.now() + (retard || 0) + (gagne ? 520 : 380);
  CR.paieFin = Math.max(CR.paieFin, fin);
  crMinuteur(() => {
    if (!CR.el || !CR.visible) return;
    CR.arme = false;
    if (gagne) { crPoseBras(cote, cx, cy, 380, cote === "D" ? -14 : 14); crRegarde(cx, cy, 300); }
    else { crPoseBras(cote, cx, cy, 200, cote === "D" ? 18 : -18); crMinuteur(() => { if (performance.now() >= CR.paieFin - 60) crReposer(360); }, 230); }
  }, retard || 0);
  crMinuteur(() => { if (performance.now() >= CR.paieFin - 30) crReposer(380); }, (retard || 0) + (gagne ? 540 : 400));
}
// Le mélange : les deux mains ramassent au centre et se croisent, 1,2 s.
// Mesuré le 06/09 : les deux mains atterrissaient sur (570-740, 250-320) et couvraient le
// tiers haut de la carte visible du croupier, index de rang compris — `crFlick` a pourtant
// `crEviterCartes` pour exactement ce problème. Un croupier ne mélange jamais par-dessus une
// main en cours : les mains passent par le même évitement, et le pas est repoussé sous les cartes.
function crMelange() {
  if (!CR.el || !CR.visible || MOUVEMENT_REDUIT.on) return;
  const rd = crRect("defausse"), rs = crRect("sabot"); if (!rd || !rs) return;
  const dm = crRect("dMain");
  const cx = (rd.right + rs.left) / 2, e = rd.width * .9;
  let cy = rd.top + rd.height * .3;
  // S'il y a des cartes au centre, on mélange SOUS elles, pas dessus.
  if (dm && dm.height) cy = Math.max(cy, dm.bottom + 10);
  const ev = (x, y) => { const p = crEviterCartes(x, y); return [p, y]; };
  const pas = [[cx - e, cy + 22, cx + e, cy + 22], [cx + e * .5, cy + 4, cx - e * .5, cy + 4], [cx - e, cy + 26, cx + e, cy + 26], [cx + e * .4, cy, cx - e * .4, cy]];
  pas.forEach((p, i) => crMinuteur(() => {
    const [gx, gy] = ev(p[0], p[1]), [dx2, dy2] = ev(p[2], p[3]);
    crPoseBras("G", gx, gy, 230, i % 2 ? 18 : -16); crPoseBras("D", dx2, dy2, 230, i % 2 ? -18 : 16);
  }, i * 240));
  crMinuteur(() => { if (!CR.arme) crReposer(360); }, 1000);
  crRegarde(cx, cy, 240);
  crVisage(EMOTIONS.concentre); crMinuteur(() => { if (CR.emotion === CR.base) crVisage(EMOTIONS[CR.base]); }, 1300);
}
/* Le regard : tête ET iris vers un point d'écran, −1…+1 sur la largeur des sièges. */
function crRegarde(x, y, ms) {
  const rep = crRepere(); if (!rep) return;
  const cx = rep.x0 + 260 * rep.s;
  let demi = 320; document.querySelectorAll("#sieges .siege").forEach(s => { const r = s.getBoundingClientRect(); demi = Math.max(demi, Math.abs(r.left + r.width / 2 - cx)); });
  const u = Math.max(-1, Math.min(1, (x - cx) / demi));
  const v = y === undefined ? .4 : Math.max(-1, Math.min(1, (y - rep.y0 - 100 * rep.s) / (420 * rep.s)));
  // L'ŒIL D'ABORD, LA TÊTE APRÈS. Un vrai regard commence par une saccade — l'œil arrive en
  // 30 ms — et la tête ne suit qu'ensuite. Ici la tête glissait sur 260-700 ms pendant que
  // l'iris sautait AU MÊME INSTANT : les deux partaient ensemble et l'œil était déjà arrivé
  // quand la tête entamait son virage. C'est le tell le plus fiable d'un pantin. On garde le
  // saut de l'iris (une saccade EST instantanée) et on retarde la tête de 90 ms : fill:"both"
  // lui fait tenir sa position de départ pendant l'attente.
  CR.regard = u * 7; crTeteMaj(ms || 260, 90);
  const iris = `translate(${(u * 3.2).toFixed(2)}px,${(v * 2.2).toFixed(2)}px)`;
  ["crIrisG", "crIrisD"].forEach(k => { const e = crQ("#cr-" + k); if (e) e.style.transform = iris; });
}
// Le regard vers un siège (index, ou « croupier » pour ses cartes, ou « toi »).
function crRegardeSiege(siege, ms) {
  let el = null;
  if (siege === "croupier") el = $("dMain");
  else if (siege === "toi") el = document.querySelector("#sieges .siege.toi");
  else el = document.querySelectorAll("#sieges .siege")[siege];
  if (!el) return; const r = el.getBoundingClientRect(); if (!r.width) return;
  crRegarde(r.left + r.width / 2, siege === "croupier" ? r.top + r.height : r.top, ms || 260);
}
// La tête va à (regard + penché) : un seul geste, quelle que soit la composante qui a changé.
// `delai` n'est posé que par le REGARD (l'œil part devant) ; une émotion, elle, redresse la
// tête tout de suite — il n'y a pas d'œil à attendre.
function crTeteMaj(ms, delai) {
  const o = delai ? { delai } : undefined;
  crBouger("crTete", CR.regard + CR.penche, ms, o);
  crBouger("crFace", CR.regard, ms, o);
  // La 3D LIT cet état à chaque image : rien à faire circuler, et les deux
  // moteurs regardent forcément au même endroit puisqu'ils lisent la même valeur.
  CR3D.etat.regard = CR.regard; CR3D.etat.penche = CR.penche;
}

/* ── Le visage. Sourcils = [descente px, rotation deg], jamais symétriques ;
   la bouche est ÉCHANGÉE, jamais interpolée — une bouche qui se déforme
   continûment est du morphing, une qui claque est du dessin animé. Huit
   formes : calme, sourire, grand (dents), en coin, fermée, moue, dents serrées,
   ouverte. ───────────────────────────────────────────────────────────── */
const BOUCHES = {
  calme: ["M-13 0C-6 4 6 4 13 0"], sourire: ["M-15-3C-8 8 8 8 15-3"], grand: ["M-16-3C-8 12 8 12 16-3Z", "#4A1A16", 1],
  encoin: ["M-12 1C-4 4 6 3 15-5"], ferme: ["M-13 0h26"], boude: ["M-12 3C-5-3 5-3 12 3"],
  serre: ["M-14-2C-6-5 6-5 14-2C12 8-12 8-14-2z", "#4A1A16", 1], ouverte: ["M-9-3C-4-8 4-8 9-3C9 8-9 8-9-3z", "#4A1A16"],
  // La PINCÉE : courte, et surtout DE TRAVERS. Elle existe pour que le soupçon ne partage
  // pas sa bouche avec la concentration — deux émotions qui portent la même bouche ET les
  // mêmes sourcils baissés ne sont pas deux émotions.
  // ⚠️ Elle était « plate, un coin plus haut que l'autre » : 1 unité de dénivelé sur 18 de
  // long, c'est-à-dire, à 86 px de tête, exactement le même petit trait sombre que la
  // « ferme » de la concentration (26 unités, parfaitement horizontale). Deux longueurs
  // qu'on ne compare pas côte à côte ne sont PAS un signal. Le dénivelé passe à 5 sur 16 :
  // une bouche visiblement de travers ne se confond avec aucune autre — et une pente, ce
  // n'est pas une moue (« boude » est un arc SYMÉTRIQUE qui descend des deux côtés).
  pincee: ["M-8-2C-3 0 2 1 8 3"],
  // La mi-ouverte : entre « ouverte » et « calme ». Trois formes, c'est le minimum pour que la
  // bouche ait l'air de FORMER des sons plutôt que de battre.
  mi: ["M-11-1C-5-4 5-4 11-1C10 5-10 5-11-1z", "#4A1A16"],
};
/* Huit émotions, et la règle qui les sépare : chacune porte AU MOINS DEUX signaux que
   personne d'autre ne porte de la même façon. Sur une tête de 69 px, une seule courbe de
   bouche ne suffit pas — c'est ce qui rendait « neutre » et « content » jumeaux, et
   « concentré » et « soupçon » interchangeables.
   Les six leviers : sourcils [descente px, rotation deg] (jamais symétriques) · bouche
   (ÉCHANGÉE, jamais interpolée) · joues · paupières · penché de tête · `iris`.
   · `penche` est non nul PARTOUT sauf « neutre » : une tête parfaitement droite est un
     visage de notice. Le signe compte : on se penche EN AVANT quand on veut (content,
     moqueur, hilare), EN ARRIÈRE quand on juge (concentré, agacé, soupçon).
   · `iris` multiplie le rayon de la PUPILLE (2,6 au repos). Elle se contracte sous la
     colère et se dilate sous le plaisir — trois lignes de code, et ça sépare à soi seul
     « furieux » (0,7) de « hilare » (1,18) même figés côte à côte. Elle CLAQUE avec la
     bouche, sans transition : c'est la doctrine du fichier, le visage se pose, il ne fond pas. */
const EMOTIONS = {
  neutre: { sg: [0, 0], sd: [0, 0], bouche: "calme", joues: 0, plisse: [0, 0], iris: 1 },
  // Concentré : symétrique, léger, il se penche EN AVANT sur le sabot et la pupille se
  // resserre. C'est le visage de la donne — il ne doit accuser personne.
  concentre: { sg: [2.2, 6], sd: [2.2, -6], bouche: "ferme", joues: 0, plisse: [.26, .26], iris: .85, penche: -3, avance: 1.5 },
  // Content : sourcils qui S'ARQUENT (7°) plus qu'ils ne montent, joues, et les yeux qui se
  // plissent un peu — un sourire qui ne monte pas aux yeux ne se lit pas comme un sourire.
  content: { sg: [-1.5, -7], sd: [-1.5, 7], bouche: "sourire", joues: .16, plisse: [.12, .12], iris: 1.12, penche: 4 },
  // Moqueur : sourcil gauche haut, le droit bas, l'œil droit à demi fermé, sourire en coin,
  // et la tête PENCHE (crEmotion). À 1280 px, c'est le penché qui se lit de loin.
  // Le levé est passé de [-7, -18] à [-2.8, -30] : un sourcil qui monte S'ARQUE plus qu'il ne
  // se TRANSLATE. Translaté, il sortait par le haut et se perdait dans les cheveux ; arqué,
  // il reste sur le front, où on le voit — et il se lit mieux, parce qu'un sourcil levé, ce
  // qu'on en voit, c'est l'angle. Les deux chiffres ont été RÉGLÉS À LA MESURE, pas choisis :
  // ce sont les plus généreux qui gardent 4 unités de front libre chez les cinq croupiers.
  moqueur: { sg: [-2.8, -30], sd: [3.5, 9], bouche: "encoin", joues: .06, plisse: [.06, .5], iris: 1.05, penche: 9 },
  // Hilare : le RIRE, pas le cri. Les deux se dessinent avec la même bouche ouverte ; ce qui
  // les sépare, ce sont les paupières HAUTES (.55) SOUS des sourcils LEVÉS — le plissement du
  // rire. Des paupières ouvertes sous des sourcils levés, ce serait la peur. C'est la seule
  // émotion qui se sert de BOUCHES.grand, la seule bouche ouverte SOURIANTE du jeu : elle
  // était écrite depuis le début et aucune émotion ne l'appelait, donc personne ne l'a
  // jamais vue. Même règle de front que « moqueur » : levé mesuré, pas choisi.
  hilare: { sg: [-2.4, -25], sd: [-2, 20], bouche: "grand", joues: .28, plisse: [.55, .55], iris: 1.18, penche: 12 },
  // Agacé : sourcils en V, joues, et le menton qui vient (avance) — la mâchoire.
  agace: { sg: [4.5, 15], sd: [4.5, -15], bouche: "boude", joues: .3, plisse: [.35, .35], iris: .9, penche: -6, avance: 3 },
  furieux: { sg: [7, 26], sd: [7, -26], bouche: "serre", joues: .55, plisse: [.5, .5], iris: .7, secoue: true, avance: 4, penche: -3 },
  // Soupçon : ce qui le distingue de « concentré », c'est l'ASYMÉTRIE, la bouche pincée de
  // travers, et le penché en ARRIÈRE le plus fort de la table — il te regarde de haut, et
  // il te regarde TOI (fixe).
  // ⚠️ L'asymétrie était trop timide pour SE VOIR : deux sourcils baissés tous les deux
  // (10° et −3°, soit 1,5 px d'écart sur la page rendue) au-dessus d'une bouche qui, à la
  // taille de jeu, ressemblait à celle de la concentration. Il ne restait donc qu'UN signal
  // réel, les paupières, là où la règle du fichier en exige deux. Un sourcil MONTE
  // maintenant pendant que l'autre descend : c'est le visage du doute, et rien d'autre ne
  // le porte à cette table. ⚠️ « moqueur » lève aussi un sourcil, mais trois fois plus fort
  // (−30°), penche EN AVANT au lieu d'en arrière, et ferme l'œil DROIT quand celui-ci ferme
  // le GAUCHE : les deux ne se confondent pas.
  soupcon: { sg: [1, -11], sd: [5.5, -2], bouche: "pincee", joues: 0, plisse: [.58, .42], iris: .8, fixe: true, penche: -7 },
};
function crVisage(o) {
  if (!CR.el) return;
  const c = crPerso(), ep = c.sourcils || 1;
  const sg = crQ("#cr-crSourcilG"), sd = crQ("#cr-crSourcilD"), b = crQ("#cr-crBouche"), d = crQ("#cr-crDents");
  if (sg) sg.style.transform = `translate(0,${o.sg[0]}px) rotate(${o.sg[1]}deg) scaleY(${ep})`;
  if (sd) sd.style.transform = `translate(0,${o.sd[0] * .86}px) rotate(${o.sd[1] * 1.1}deg) scaleY(${ep})`;
  if (b) { const f = BOUCHES[o.bouche] || BOUCHES.calme; b.setAttribute("d", f[0]); b.setAttribute("fill", f[1] || "none"); }
  if (d) d.setAttribute("opacity", (BOUCHES[o.bouche] || [])[2] ? "1" : "0");
  ["crJoueG", "crJoueD"].forEach(k => { const e = crQ("#cr-" + k); if (e) e.setAttribute("opacity", o.joues || 0); });
  const pl = o.plisse || [0, 0];
  ["crPaupG", "crPaupD"].forEach((k, i) => { const e = crQ("#cr-" + k); if (e) e.style.transform = `scaleY(${pl[i]})`; });
  // La pupille. On touche `r` et pas le transform : celui de #crIris* porte le REGARD, posé
  // par crRegarde — un scale écrit au même endroit serait effacé au premier coup d'œil.
  const ir = o.iris || 1;
  ["crPupG", "crPupD"].forEach(k => { const e = crQ("#cr-" + k); if (e) e.setAttribute("r", (2.6 * ir).toFixed(2)); });
  CR.fixe = !!o.fixe;
}
/* La bouche articule TANT QUE la bulle est ouverte. Mesuré le 06/09 en rAF : l'ancienne
   version ouvrait et fermait deux fois en 400 ms, quelle que soit la durée de la réplique —
   dernier mouvement à t=417, bulle encore là à t=5001, soit 4584 ms de mannequin figé, 92 %
   du temps où il parle. Pour la question d'assurance, qui n'a AUCUNE minuterie, il restait
   bouche close aussi longtemps qu'on ne répondait pas.
   Trois formes tirées au sort (ouverte / mi / calme), 110-160 ms chacune ; après 1,5 s le
   cycle ralentit — on passe d'« il parle » à « il attend », plutôt que de tout couper. */
function crArreteArticule(retour) {
  if (CR.articuleT) { clearTimeout(CR.articuleT); CR.articuleT = null; }
  CR.articule = 0;
  const b = crQ("#cr-crBouche"), d = crQ("#cr-crDents"); if (!b) return;
  const f = BOUCHES[retour || CR.articuleRetour] || BOUCHES.calme;
  b.setAttribute("d", f[0]); b.setAttribute("fill", f[1] || "none"); if (d) d.setAttribute("opacity", f[2] ? "1" : "0");
}
function crArticule(retour) {
  if (!CR.el || MOUVEMENT_REDUIT.on) return;
  const b = crQ("#cr-crBouche"), d = crQ("#cr-crDents"); if (!b) return;
  CR.articuleRetour = retour;
  const jeton = ++CR.articule, depart = performance.now();
  const f = BOUCHES[retour] || BOUCHES.calme, formes = [BOUCHES.ouverte, BOUCHES.mi || BOUCHES.ouverte, f];
  const poser = g => { b.setAttribute("d", g[0]); b.setAttribute("fill", g[1] || "none"); if (d) d.setAttribute("opacity", g[2] ? "1" : "0"); };
  const pas = () => {
    if (CR.articule !== jeton) return;
    // La bulle fermée, la bouche se repose : c'est ELLE qui commande, pas une durée.
    const b2 = CR.bulle;
    if (!b2 || !b2.classList.contains("on")) { crArreteArticule(retour); return; }
    const age = performance.now() - depart;
    // Passé ~2,7 s il n'articule plus, il ATTEND : la bouche se repose au lieu de battre dans
    // le vide (une bulle d'annonce ou de question peut rester des dizaines de secondes).
    if (age > 2700) { crArreteArticule(retour); return; }
    const lent = age > 1500;
    poser(lent ? f : formes[alea(formes.length)]);
    CR.articuleT = crMinuteur(pas, lent ? 300 + alea(260) : 110 + alea(50));
  };
  poser(BOUCHES.ouverte); CR.articuleT = crMinuteur(pas, 120);
}
function crSecoue() {
  if (!CR.el || MOUVEMENT_REDUIT.on) return;
  const t = crQ("#cr-crTete"); if (!t) return;
  const a = CR.j.crTete || 0;
  const an = t.animate([-4, 4, -3, 3, -1, 0].map(dx => ({ transform: `translate(${dx + a * .55}px,${CR.avance}px) rotate(${a}deg)` })), { duration: 420, easing: "ease-out" });
  an.finished.then(() => an.cancel(), () => {});
}

/* ── La bulle : hors de #croupierScene (qui est aria-hidden), dans un
   aria-live poli, 1,8 s, Instrument Serif. Elle SUIT la tête : posée à droite
   du visage, à la hauteur des yeux, d'après la boîte réelle de la tête. ─── */
// Vrai si la bulle est ouverte À CET INSTANT. C'est la seule définition de « le croupier parle ».
function crParleMaj() {
  const v = $("v-table"); if (!v) return;
  v.classList.toggle("cr-parle", !!(CR.visible && CR.bulle && CR.bulle.classList.contains("on")));
}
function crBulleEl() {
  if (CR.bulle) return CR.bulle;
  const salle = $("salle"); if (!salle) return null;
  const b = document.createElement("div"); b.className = "cr-bulle"; b.setAttribute("role", "status"); b.setAttribute("aria-live", "polite");
  b.innerHTML = `<b class="cr-nom"></b><span class="cr-texte"></span><span class="cr-aide"></span><span class="cr-opts"></span>`;
  salle.appendChild(b); CR.bulle = b; return b;
}
// Une question dans la bulle : le texte, une ligne d'aide, des boutons — et PAS de minuterie,
// la bulle reste tant qu'on n'a pas répondu. C'est l'assurance (table.js, « sabot:assurance-
// question ») : une seule voix, celle du croupier, à la première personne.
function crDireQuestion(texte, aide, options, sur) {
  const b = crBulleEl(); if (!b) return false;
  clearTimeout(CR.bulleT); clearTimeout(CR.bulleR);
  crPoserBulle(b);
  b.querySelector(".cr-nom").textContent = crNom();
  b.querySelector(".cr-texte").textContent = texte;
  b.querySelector(".cr-aide").textContent = aide || "";
  const o = b.querySelector(".cr-opts"); o.innerHTML = "";
  options.forEach(([libelle, valeur, defaut]) => {
    const bt = document.createElement("button"); bt.type = "button"; bt.textContent = libelle; if (defaut) bt.className = "defaut";
    bt.onclick = () => { o.innerHTML = ""; b.querySelector(".cr-aide").textContent = ""; b.classList.remove("question", "on"); CR.bulleGenre = ""; crParleMaj(); crArreteArticule("ferme"); sur(valeur); };
    o.appendChild(bt);
  });
  CR.bulleGenre = "question"; b.classList.add("question", "on"); crParleMaj();
  crPoserBulle(b);   // la classe .question change sa largeur ET son ancrage : on repose après
  crArticule("ferme");
  setTimeout(() => { const d = o.querySelector(".defaut"); if (d && d.isConnected) d.focus(); }, 80);
  return true;
}
/* Mesuré le 06/09 : ancrée par son COIN HAUT à droite du visage, la bulle d'assurance
   (675→1116 × 147→300) recouvrait 161 × 83 px du bras droit (597→834 × 209→453) — la moitié
   de sa boîte —, laissait la main visible en dessous (une main flottante détachée d'un
   moignon) et posait sa pointe 56 px SOUS la bouche. Une réplique de 897 px de large, c'est
   35 % de l'écran et 151 px du plateau à jetons recouverts.
   Trois règles : on ancre par la POINTE (elle arrive à hauteur de bouche), on ne traverse
   jamais un bras (une question grandit VERS LE HAUT, là où il n'y a rien), et on bascule à
   gauche du visage quand la place manque à droite. */
function crPoserBulle(b) {
  const t = crQ("#cr-crTete"), salle = $("salle"); if (!t || !salle) return;
  const r = t.getBoundingClientRect(), sr = salle.getBoundingClientRect(); if (!r.width) return;
  const question = b.classList.contains("question");
  // La bulle doit être mesurable : on la rend visible (opacité pilotée par .on) avant de lire.
  b.style.maxWidth = "";
  // La largeur ne dépasse jamais la place réellement libre entre la tête et le bord de la salle.
  const libreD = Math.max(0, sr.right - (r.right - r.width * .04) - 14);
  const libreG = Math.max(0, (r.left + r.width * .04) - sr.left - 14);
  const aDroite = libreD >= Math.min(300, libreG) || libreD >= libreG;
  const place = Math.max(180, Math.min(aDroite ? libreD : libreG, sr.width * .34));
  b.style.maxWidth = Math.round(place) + "px";
  const h = b.offsetHeight || 90, w = b.offsetWidth || 240;
  // Ancrage vertical par la pointe : le ::before est à 6 px du bas, la bouche est à ~62 %
  // de la hauteur de la tête. Une question monte au-dessus de la tête, elle ne coupe rien.
  const bouche = r.top + r.height * .62 - sr.top;
  let top = question ? Math.round(r.top - sr.top - h - 8) : Math.round(bouche - h + 14);
  top = Math.max(4, Math.min(top, sr.height - h - 6));
  b.style.top = top + "px";
  b.classList.toggle("a-gauche", !aDroite);
  b.style.left = aDroite ? Math.round(r.right - r.width * .04 - sr.left) + "px"
    : Math.round(Math.max(4, r.left + r.width * .04 - sr.left - w)) + "px";
}
// o.genre = « annonce » (ce que dit la table : le règlement, le sabot neuf, l'assurance…) ou
// « replique » (le personnage). Une bulle déjà ouverte se REFERME avant de changer de texte
// (mesuré le 05/09 : « Salut. Vegas, baby. » devenait « On remet ça ? » d'un coup, largeur
// 270 → 240 px, opacité déjà à 1).
function crDire(texte, ms, o) {
  const b = crBulleEl(); if (!b || !texte) return;
  if (CR.bulleGenre === "question") return;        // une question attend sa réponse : rien ne passe devant
  o = o || {};
  const poser = () => {
    crPoserBulle(b);
    b.querySelector(".cr-nom").textContent = crNom();
    b.querySelector(".cr-texte").textContent = texte;
    CR.bulleGenre = o.genre || "replique"; if (CR.bulleGenre === "annonce") CR.annonceT = performance.now();
    b.classList.add("on"); crParleMaj();
    crPoserBulle(b);   // reposée une fois la hauteur réelle connue (le texte vient d'être écrit)
    if (!o.muet) crArticule((EMOTIONS[CR.emotion] || EMOTIONS.neutre).bouche);
    clearTimeout(CR.bulleT); CR.bulleT = setTimeout(() => { b.classList.remove("on"); CR.bulleGenre = ""; crParleMaj(); }, ms || 1800);
  };
  clearTimeout(CR.bulleT); clearTimeout(CR.bulleR);
  if (b.classList.contains("on") && b.querySelector(".cr-texte").textContent !== texte && !MOUVEMENT_REDUIT.on) {
    b.classList.remove("on"); crParleMaj(); CR.bulleR = setTimeout(poser, 170);
  } else poser();
}
// Fermer la bulle tout de suite : le croupier ne parle pas pendant qu'il distribue.
// `genre` : ne fermer que ce genre-là (une réplique sans texte ne coupe pas une annonce en cours).
function crTaire(genre) {
  if (genre && CR.bulleGenre && CR.bulleGenre !== genre) return;
  if (CR.bulleGenre === "question" && genre !== "question") return;
  clearTimeout(CR.bulleT); clearTimeout(CR.bulleR); CR.bulleGenre = ""; if (CR.bulle) CR.bulle.classList.remove("on");
  crParleMaj(); crArreteArticule();
}
function crReplique(genre) {
  const banque = crPerso().dit[genre] || []; if (!banque.length) return "";
  let i, g = 0; do { i = alea(banque.length); } while (banque.length > 1 && i === CR.dernier[genre] && g++ < 8);
  CR.dernier[genre] = i; return banque[i];
}

/* ── Une émotion : un visage, une réplique, un retour à la base ─────────── */
// o.apres : la réplique attend (ms) — le visage change tout de suite, la bulle vient après.
// C'est ce qui laisse lire l'ANNONCE du règlement (« Croupier saute à 26… ») avant la pique.
function crEmotion(nom, o) {
  o = o || {}; const e = EMOTIONS[nom] || EMOTIONS.neutre;
  CR.emotion = nom; const jeton = ++CR.jeton;
  // 🚨 C'EST ICI QU'ON TRADUIT, et nulle part ailleurs : le lot CC0 n'a que
  // trois animations qui aient un sens derrière une table (repos, salut, geste)
  // et AUCUN morph target — les huit visages du SVG n'ont pas d'équivalent 3D.
  // Plutôt que de faire semblant, on ne joue que ce qui existe vraiment.
  CR3D.etat.clip = nom === "content" && !CR.salue ? "salut" : "repos";
  const apres = o.apres || 0, tenue = (o.tenue || 2400) + apres;
  crVisage(e);
  if (e.secoue) crSecoue();
  // Le penché et l'avancée de CETTE émotion — zéro si elle n'en a pas : la tête se redresse,
  // le regard reste.
  if (!MOUVEMENT_REDUIT.on) {
    CR.penche = e.penche || 0; CR.avance = e.avance || 0; crTeteMaj(e.penche || e.avance ? 220 : 300);
    if (e.penche || e.avance) crMinuteur(() => { if (CR.jeton === jeton) { CR.penche = 0; CR.avance = 0; crTeteMaj(420); } }, tenue - 300);
  }
  if (e.fixe) crRegardeSiege("toi", 220);
  if (o.texte) {
    const dire = () => { if (CR.jeton !== jeton) return; crDire(o.texte, Math.min(o.ms || 1800, o.tenue || 2400), { muet: true }); crArticule(e.bouche); };
    if (apres) crMinuteur(dire, apres); else dire();
  } else crTaire("replique");
  crMinuteur(() => { if (CR.jeton === jeton) { CR.emotion = CR.base; crVisage(EMOTIONS[CR.base] || EMOTIONS.neutre); } }, tenue);
}
// Une réplique qui tombe pendant qu'une annonce vient d'être dite attend qu'on l'ait lue.
const crApresAnnonce = () => (CR.bulleGenre === "annonce" && performance.now() - CR.annonceT < 1700) ? 1500 : 0;

/* ── Ce que dit la TABLE, c'est le croupier qui le dit (table.js, annoncer). Sur ordinateur
   la pastille du feutre se tait dès qu'il est là (#v-table.cr-parle, style.css) : un feutre
   imprimé ne s'efface pas pour afficher un message. L'annonce vide ferme la bulle. */
document.addEventListener("sabot:annonce", e => {
  if (!CR.el || !CR.visible || !matchMedia("(min-width:1000px)").matches || $("v-table").dataset.reseau) return;
  const t = ((e.detail || {}).texte || "").trim();
  if (!t) { crTaire("annonce"); return; }
  // 3,4 s, c'était le temps qu'une phrase reste lisible — pas le temps qu'elle reste VRAIE.
  // « À toi : 17 souple contre un 5 » disparaissait pendant qu'on réfléchissait encore, et
  // rien ne la reprenait (le repli du feutre était éteint en permanence, cf. crParleMaj).
  // Ce que dit la TABLE tient jusqu'à ce que la table dise autre chose : c'est `annoncer("")`
  // qui referme, comme pour la question d'assurance.
  crDire(t, 60000, { genre: "annonce" });
});
// L'assurance : LE croupier pose la question, dans sa bulle, à la première personne, avec le
// montant ; Oui/Non dedans ; il te regarde, concentré, jusqu'à la réponse. Sur ordinateur, en
// solo (à plusieurs, reseau.js a sa boîte à minuterie). q.prise = true dit à table.js de ne pas
// ouvrir sa boîte.
document.addEventListener("sabot:assurance-question", e => {
  const q = e.detail || {};
  if (!CR.el || !CR.visible || !matchMedia("(min-width:1000px)").matches || $("v-table").dataset.reseau || typeof q.repondre !== "function") return;
  const texte = (crReplique("assurance") || "Un as. Assurance ? {cout}.").replace("{cout}", fmtJ(q.cout));
  const aide = "Un pari à part, payé 2 contre 1 si j'ai un blackjack. " + (q.conseil || "");
  crVisage(EMOTIONS.concentre); CR.fixe = true; crRegardeSiege("toi", 220);
  const ok = crDireQuestion(texte, aide, [["Oui", true], ["Non", false, true]], prise => {
    CR.fixe = false; crVisage(EMOTIONS[CR.emotion] || EMOTIONS.neutre);
    q.repondre(prise);
  });
  if (ok) q.prise = true; else CR.fixe = false;
});
// L'appel à miser (jetons.js) : « Vos mises, s'il vous plaît. » — une fois par phase de mise.
document.addEventListener("sabot:appel-mise", e => {
  if (!CR.el || !CR.visible) return;
  const d = e.detail || {};
  const texte = d.ruine ? "Il vous manque des jetons pour le minimum." : (crPerso().dit.mises || [])[0] || "Vos mises, s'il vous plaît.";
  crEmotion("content", { texte, tenue: 2600, ms: 2600 });
});
// Pour les captures et la console : window.__croupierEmotion("moqueur"), window.__croupierGeste("flick")
window.__croupierEmotion = nom => { monterCroupier(); crEmotion(nom, { texte: crReplique(nom === "content" ? "accueil" : nom) || crReplique("moqueur"), tenue: 60000, ms: 60000 }); };
window.__croupierGeste = nom => {
  monterCroupier(); CR.visible = true;
  const toi = document.querySelector("#sieges .siege.toi"), ti = toi ? [...document.querySelectorAll("#sieges .siege")].indexOf(toi) : 0;
  const cible = () => { const r = crRect("m_" + ti + "_0") || (toi && toi.getBoundingClientRect()); return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: innerWidth / 2, y: innerHeight * .7 }; };
  // Geler la pose = invalider les minuteries de retour (elles testent `CR.gestes === n`),
  // pas ralentir le geste. Il se joue à sa vitesse NATURELLE et reste là où il est arrivé.
  const figer = ms => { CR.paieFin = performance.now() + 600000; crMinuteur(() => { CR.gestes++; CR.arme = false; }, ms); };
  if (nom === "armer") crArmer(320);
  else if (nom === "flick") { crArmer(1); crFlick(cible(), 900); figer(360); }
  else if (nom === "retourne") { crRetourne($("dMain").children[1] || $("dMain")); figer(300); }
  else if (nom === "paie") { crPaie(ti, "gagne", 0); figer(420); }
  else if (nom === "ramasse") { crPaie(ti, "perd", 0); figer(240); }
  else if (nom === "melange") { crMelange(); figer(620); }
  else if (nom === "regarde") crRegardeSiege(ti, 240);
  else crReposer(300);
};

/* ── L'ambiance : la respiration, le transfert de poids, un coup d'œil aux
   joueurs, des clignements, un clin d'œil de temps en temps. Rien de tout ça
   en mouvement réduit, et jamais un regard qui s'échappe quand il te FIXE. */
function crCligne(ms, unSeul) {
  if (!CR.el || MOUVEMENT_REDUIT.on || CR.fixe) return;
  ["crOeilG", "crOeilD"].forEach((k, i) => {
    if (unSeul && i === 1) return;
    const e = crQ("#cr-" + k); if (!e) return;
    const an = e.animate([{ transform: "scaleY(1)" }, { transform: "scaleY(.06)", offset: .45 }, { transform: "scaleY(1)" }], { duration: ms || 150, easing: "ease-in-out" });
    an.finished.then(() => an.cancel(), () => {});
  });
}
function crLancerAmbiance() {
  crStopperAmbiance();
  if (MOUVEMENT_REDUIT.on) return;
  // La respiration : le torse se soulève d'un pixel toutes les 4 s. Une figurine posée
  // ne respire pas ; c'est ce qui la distingue d'un personnage. Le buste (tête comprise)
  // transfère son poids d'une jambe sur l'autre de temps en temps — un autre élément, une
  // autre animation, elles ne se disputent pas la même propriété.
  const torse = crQ("#cr-crTorse");
  if (torse) CR.souffle = torse.animate([{ transform: "translateY(0)" }, { transform: "translateY(1.2px)" }, { transform: "translateY(0)" }],
    { duration: 4000, iterations: Infinity, easing: "ease-in-out" });
  const poids = () => {
    const b = crQ("#cr-crBuste"); if (!b) return;
    const dx = (Math.random() < .5 ? -1 : 1) * (1.5 + Math.random() * 1.5);
    const an = b.animate([{ transform: "translate(0,0)" }, { transform: `translate(${dx}px,.6px)` }], { duration: 1400, easing: "ease-in-out", fill: "forwards" });
    an.finished.then(() => { if (CR.poidsAn === an) { b.style.transform = `translate(${dx}px,.6px)`; an.cancel(); } }, () => {});
    CR.poidsAn = an;
    CR.poidsT = setTimeout(poids, 7000 + Math.random() * 5000);
  };
  CR.poidsT = setTimeout(poids, 3000 + Math.random() * 4000);
  const tic = () => {
    if (!CR.el) return;
    const clin = crAuRepos() && !CR.arme && Math.random() < .16;
    if (clin) { crCligne(320, true); crVisage(EMOTIONS.content); crMinuteur(() => { if (crAuRepos()) crVisage(EMOTIONS[CR.base] || EMOTIONS.neutre); }, 700); }
    else crCligne(150);
    CR.ambiance = setTimeout(tic, 2600 + Math.random() * 3800);
  };
  CR.ambiance = setTimeout(tic, 1800);
  // Le coup d'œil : toutes les 6 à 10 s, un siège au hasard, puis le regard revient.
  const oeil = () => {
    if (!CR.el) return;
    if (crAuRepos() && !CR.arme && !CR.fixe) {
      const sieges = document.querySelectorAll("#sieges .siege");
      if (sieges.length) { crRegardeSiege(alea(sieges.length), 620); crMinuteur(() => { if (crAuRepos() && !CR.arme && !CR.fixe) { CR.regard = 0; crTeteMaj(700); ["crIrisG", "crIrisD"].forEach(k => { const e = crQ("#cr-" + k); if (e) e.style.transform = "translate(0,.6px)"; }); } }, 1400 + Math.random() * 900); }
    }
    CR.oeilT = setTimeout(oeil, 6000 + Math.random() * 4000);
  };
  CR.oeilT = setTimeout(oeil, 2500 + Math.random() * 3000);
}
function crStopperAmbiance() {
  clearTimeout(CR.ambiance); clearTimeout(CR.oeilT); clearTimeout(CR.poidsT); CR.ambiance = CR.oeilT = CR.poidsT = null;
  if (CR.souffle) { CR.souffle.cancel(); CR.souffle = null; }
  if (CR.poidsAn) { CR.poidsAn.cancel(); CR.poidsAn = null; }
}

/* ── La surveillance : un croupier ne regarde pas ton COMPTE, il regarde ta
   MISE. Un saut brusque, ou une rampe qui suit le compte vrai sur plusieurs
   mains, et il te fixe. Le Chef réagit dès deux unités et à une corrélation
   plus faible ; Vince ne regarde presque jamais. La mise vient du detail de
   « sabot:donne-debut » (lot Jetons) ; sinon de #tMise, qui n'est chiffré que
   quand le compte est affiché. ───────────────────────────────────────── */
function crLireNombre(id) { const t = ($(id) || {}).textContent || ""; const n = parseFloat(t.replace(",", ".").replace("+", "")); return isNaN(n) ? null : n; }
function crSurveille(mise, tc) {
  const c = crPerso(), v = c.vigilance;
  if (mise === null || mise === undefined) return;
  const prec = CR.mises.length ? CR.mises[CR.mises.length - 1] : null;
  CR.mises.push({ mise, tc }); if (CR.mises.length > 10) CR.mises.shift();
  if (CR.gestes - CR.derniereAlerte < 3) return;
  let alerte = false;
  const seuil = [Infinity, 4, 3, 2][v];
  if (prec && prec.mise !== null && mise - prec.mise >= seuil) alerte = true;
  // Corrélation mise ↔ compte vrai sur les dernières mains (Pearson).
  const pts = CR.mises.filter(m => m.tc !== null && m.tc !== undefined);
  if (!alerte && v > 0 && pts.length >= 5) {
    const n = pts.length, mx = pts.reduce((s, p) => s + p.mise, 0) / n, my = pts.reduce((s, p) => s + p.tc, 0) / n;
    let sxy = 0, sxx = 0, syy = 0; for (const p of pts) { sxy += (p.mise - mx) * (p.tc - my); sxx += (p.mise - mx) ** 2; syy += (p.tc - my) ** 2; }
    const r = sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
    const etendue = Math.max(...pts.map(p => p.mise)) - Math.min(...pts.map(p => p.mise));
    if (etendue >= 3 && r >= [1, .85, .75, .55][v]) alerte = true;
  }
  if (!alerte) return;
  CR.derniereAlerte = CR.gestes;
  crEmotion("soupcon", { texte: crReplique("soupcon"), tenue: 1400 + v * 400, ms: 1400 + v * 400 });
}

/* ── Le bus ────────────────────────────────────────────────────────────── */
document.addEventListener("sabot:table", () => { monterCroupier(); CR.mises = []; CR.gains = 0; CR.pertes = 0; });
document.addEventListener("sabot:remelange", () => { if (CR.visible) crMelange(); });
document.addEventListener("sabot:donne-debut", e => {
  if (!CR.el) monterCroupier();
  if (crAuRepos()) { CR.emotion = "concentre"; crVisage(EMOTIONS.concentre); }
  CR.base = "concentre"; crTaire();
  // Un coup d'œil à TA mise, puis la main droite va au sabot et y reste armée.
  const toi = document.querySelector("#sieges .siege.toi .cercle"); if (toi) { const r = toi.getBoundingClientRect(); if (r.width) crRegarde(r.left + r.width / 2, r.top, 200); }
  crArmer(320);
  const d = e.detail || {};
  const mise = d.mise !== undefined ? d.mise : crLireNombre("tMise");
  const tc = d.tc !== undefined ? d.tc : (d.compte !== undefined ? d.compte : crLireNombre("tTC"));
  crSurveille(mise, tc);
});
document.addEventListener("sabot:carte", e => { const d = e.detail || {}; if (d.vers) crFlick(d.vers, rythme(), { duree: d.duree, delai: d.delai }); });
document.addEventListener("sabot:tour", e => {
  const d = e.detail || {}; if (!CR.el || !CR.visible) return;
  crRegardeSiege(d.siege, 260);
});
document.addEventListener("sabot:croupier-revele", e => crRetourne((e.detail || {}).el));
document.addEventListener("sabot:main-fin", e => {
  const d = e.detail || {}; if (!CR.el) return;
  const c = crPerso();
  // Le geste de règlement, au tempo de jetons.js (son J.attente vient d'être incrémenté de
  // 140 ms pour CE siège : le retard du geste est celui de ses jetons).
  if (typeof d.siege === "number") crPaie(d.siege, d.issue, typeof J === "object" && J && typeof J.attente === "number" ? Math.max(0, J.attente - 140) : 0);
  if (!d.toi) { // un voisin qui saute : le croupier en rit, sans un mot
    if (d.issue === "bust" && CR.emotion === CR.base) { crVisage(EMOTIONS[crRire()]); crMinuteur(() => { if (CR.emotion === CR.base) crVisage(EMOTIONS[CR.base]); }, 900); }
    return;
  }
  // La réaction se LIT : 2,6 s de bulle et 3 s de visage. À 1,8 s (mesuré le 05/09) la
  // bulle partait pile quand on regardait ses cartes filer à la défausse.
  if (d.issue === "bust") {
    // SAUTER n'est pas PERDRE. C'était la même branche que « perd » : même visage, mêmes
    // répliques, alors que le croupier n'a pas eu à jouer — on s'est fait ça tout seul, et
    // c'est le seul moment où il a vraiment de quoi rire. Il rit donc (bouche « grand »,
    // la seule bouche ouverte souriante du jeu, qui ne servait à AUCUNE émotion) et il a
    // ses propres répliques, plus dures.
    CR.pertes++; CR.gains = 0;
    const piquant = CR.id === "lin" ? Math.min(.95, .3 + .3 * CR.pertes) : c.piquant;
    crEmotion(crRire(), { texte: Math.random() < piquant ? (crReplique("bust") || crReplique("moqueur")) : "", ms: 2800, tenue: 3200, apres: crApresAnnonce() });
  } else if (d.issue === "perd") {
    CR.pertes++; CR.gains = 0;
    const piquant = CR.id === "lin" ? Math.min(.95, .3 + .3 * CR.pertes) : c.piquant;
    crEmotion("moqueur", { texte: Math.random() < piquant ? crReplique("moqueur") : "", ms: 2600, tenue: 3000, apres: crApresAnnonce() });
  } else if (d.issue === "gagne") {
    CR.gains++; CR.pertes = 0;
    if (CR.gains >= 3) crEmotion("furieux", { texte: crReplique("serie"), ms: 2800, tenue: 3200, apres: crApresAnnonce() });
    else crEmotion("agace", { texte: Math.random() < c.colere ? crReplique("agace") : "", ms: 2200, tenue: 2600, apres: crApresAnnonce() });
  } else if (d.issue === "blackjack") {
    CR.gains++; CR.pertes = 0; crEmotion("furieux", { texte: crReplique("furieux"), ms: 2800, tenue: 3200, apres: crApresAnnonce() });
  } else if (d.issue === "abandon") {
    crEmotion("moqueur", { texte: Math.random() < c.piquant * .7 ? crReplique("abandon") : "" });
  } else if (d.issue === "egalite") {
    if (Math.random() < .4) crEmotion("neutre", { texte: crReplique("egalite"), tenue: 1200, apres: crApresAnnonce() });
  }
});
document.addEventListener("sabot:manche-fin", () => {
  CR.base = crRepos(); if (CR.emotion === "concentre") { CR.emotion = CR.base; crVisage(EMOTIONS[CR.base]); }
  // Les mains reviennent au rail quand le dernier paiement est parti.
  const reste = Math.max(600, CR.paieFin - performance.now() + 80);
  crMinuteur(() => { const b = $("bDonne"); if (!b || !b.disabled) crReposer(380); }, reste);
});

// La scène n'a de taille que quand la vue Table est visible : on ne pose une
// pose qu'à ce moment-là, et le croupier salue à la première apparition.
if (window.ResizeObserver && $("croupierScene")) new ResizeObserver(entries => {
  const r = entries[0].contentRect, avant = CR.visible; CR.visible = r.width > 20 && r.height > 20;
  // « cr-parle » disait « le croupier est à l'écran » — et style.css cachait la pastille du
  // feutre en permanence, donc « À toi : 17 souple contre un 5 » n'apparaissait JAMAIS sur
  // ordinateur (mesuré le 06/09 : à 8 s, le texte est dans le DOM en display:none, la bulle à
  // opacité 0). La classe suit maintenant la BULLE ; « cr-la » porte la présence.
  $("v-table").classList.toggle("cr-la", CR.visible);
  if (!CR.visible) crParleMaj();
  if (!CR.visible) return;
  if (!CR.el) monterCroupier();
  if (!CR.arme) crReposer(avant ? 200 : 1);
  if (!CR.salue) { CR.salue = true; crMinuteur(() => { if (crAuRepos()) crEmotion("content", { texte: crReplique("accueil"), tenue: 2200, ms: 2200 }); }, 700); }
}).observe($("croupierScene"));
addEventListener("resize", () => { if (CR.visible && !CR.arme) crReposer(1); });

/* ── ⚙ Réglages de la table : choisir et renommer son croupier. On se greffe
   sur le bouton (après son onclick, d'où le setTimeout) et on ajoute notre
   section dans la modale déjà ouverte — pas une ligne dans table.js. ─── */
function rendreChoixCroupier() {
  const boite = $("modaleBoite"); if (!boite || !$("rgCadence") || $("crReglage")) return;
  const t = tableCourante(), defaut = CROUPIER_DEFAUT[t.id] || "vince";
  const choix = [["", "Selon la table", `${CROUPIERS[defaut].nom} ici`]].concat(Object.entries(CROUPIERS).map(([id, c]) => [id, c.nom, c.lieu]));
  const sec = document.createElement("div"); sec.id = "crReglage"; sec.className = "cr-reglage";
  sec.innerHTML = `<span class="grave">Croupier</span>
    <div class="cr-choix" role="radiogroup" aria-label="Choix du croupier">${choix.map(([id, nom, sous]) =>
      `<label class="cr-carte${(DB.croupier.id || "") === id ? " on" : ""}"><input type="radio" name="crChoix" value="${id}"${(DB.croupier.id || "") === id ? " checked" : ""}>
        <span class="cr-vignette">${id ? crSvg("v" + id + "-") : `<span class="cr-auto">⌂</span>`}</span><b>${echap(nom)}</b><i>${echap(sous)}</i></label>`).join("")}</div>
    <p class="muet cr-trait" id="crTrait"></p>
    <label class="ch"><span class="grave">Son nom à cette table</span><input type="text" id="crNomSaisie" maxlength="18" placeholder="${echap(crPerso().nom)}" value="${echap(DB.croupier.noms[crEffectif()] || "")}"></label>
    <label class="ch ligne"><input type="checkbox" id="cr3d"${cr3dVoulu() ? " checked" : ""}${cr3dPossible() ? "" : " disabled"}>
      <span>Croupier en 3D <i class="muet">${cr3dPossible()
        ? "un modèle animé, mais sans les expressions du croupier dessiné"
        : "indisponible ici : cette page publiée bloque le téléchargement du modèle"}</i></span></label>`;
  const fermer = $("modaleFermer"); const rang = fermer && fermer.parentNode;
  if (rang) boite.insertBefore(sec, rang); else boite.appendChild(sec);
  sec.querySelectorAll(".cr-carte").forEach(l => {
    const id = l.querySelector("input").value, svg = l.querySelector("svg");
    if (svg && CROUPIERS[id]) { crLook(svg, CROUPIERS[id], "v" + id + "-"); svg.setAttribute("viewBox", "168 2 184 172"); svg.classList.add("cr-mini"); crPoseVignette(svg, "v" + id + "-"); }
  });
  const trait = () => { const c = CROUPIERS[crEffectif()]; $("crTrait").textContent = `${c.nom} — ${c.lieu}. ${c.trait}`; $("crNomSaisie").placeholder = c.nom; $("crNomSaisie").value = DB.croupier.noms[crEffectif()] || ""; };
  trait();
  sec.querySelectorAll("input[name=crChoix]").forEach(i => i.addEventListener("change", () => {
    DB.croupier.id = i.value; DB.croupier.nom = DB.croupier.noms[crEffectif()] || ""; garder();
    sec.querySelectorAll(".cr-carte").forEach(l => l.classList.toggle("on", l.querySelector("input").checked));
    trait(); CR.id = ""; monterCroupier(); CR.salue = true;
    if (CR.visible) crEmotion("content", { texte: crReplique("accueil"), tenue: 2000, ms: 2000 });
  }));
  const c3 = $("cr3d");
  if (c3) c3.addEventListener("change", () => {
    DB.croupier.tri3d = c3.checked ? 1 : 0; garder();
    // Le SVG n'est jamais démonté : on l'affiche ou on le cache, donc revenir en
    // arrière est instantané et rien du jeu (bulle, bras, gestes) ne s'interrompt.
    if (c3.checked) cr3dMonter(); else cr3dDemonter();
  });
  $("crNomSaisie").addEventListener("input", () => {
    const v = $("crNomSaisie").value.trim().slice(0, 18);
    if (v) DB.croupier.noms[crEffectif()] = v; else delete DB.croupier.noms[crEffectif()];
    DB.croupier.nom = v; garder();
  });
}
// Une vignette a des bras au repos, posés devant elle — pas des bras qui pendent hors cadre.
function crPoseVignette(svg, p) {
  const pose = (cote, rot1, rot2, d) => {
    const q = id => svg.querySelector("#" + p + id + cote);
    if (q("crBras")) q("crBras").style.transform = `rotate(${rot1}deg)`;
    if (q("crAvant")) q("crAvant").style.transform = `rotate(${rot2}deg)`;
    if (q("crGaine")) q("crGaine").style.transform = `scaleY(${(d / CR_GAINE).toFixed(3)})`;
    if (q("crMain")) q("crMain").style.transform = `translateY(${d}px)`;
  };
  pose("D", -58, 128, 60); pose("G", 58, -128, 60);
}
if ($("bReglagesTable")) $("bReglagesTable").addEventListener("click", () => setTimeout(rendreChoixCroupier, 0));

/* ── Mode Concentration : le chef de table a un visage. Une vignette à côté
   de la jauge, dont les sourcils suivent CO.susp (lu sur #coJaugeN, sans
   toucher à concentration.js), et qui te FIXE au-delà de 70. ─────────── */
(function crVignetteConcentration() {
  const oeil = $("coOeil"), n = $("coJaugeN"); if (!oeil || !n || !window.MutationObserver) return;
  const boite = document.createElement("span"); boite.className = "cr-chef"; boite.setAttribute("aria-hidden", "true");
  boite.innerHTML = crSvg("co-");
  const svg = boite.querySelector("svg"); svg.setAttribute("viewBox", "204 8 112 112"); svg.classList.add("cr-mini");
  oeil.parentNode.insertBefore(boite, oeil);
  crLook(svg, CROUPIERS.chef, "co-");
  const poser = () => {
    const s = Math.max(0, Math.min(100, parseFloat(n.textContent) || 0)) / 100, ep = CROUPIERS.chef.sourcils;
    const sg = svg.querySelector("#co-crSourcilG"), sd = svg.querySelector("#co-crSourcilD"), b = svg.querySelector("#co-crBouche");
    if (sg) sg.style.transform = `translate(0,${(s * 5).toFixed(1)}px) rotate(${(s * 16).toFixed(1)}deg) scaleY(${ep})`;
    if (sd) sd.style.transform = `translate(0,${(s * 4.3).toFixed(1)}px) rotate(${(-s * 17).toFixed(1)}deg) scaleY(${ep})`;
    ["co-crPaupG", "co-crPaupD"].forEach(k => { const e = svg.querySelector("#" + k); if (e) e.style.transform = `scaleY(${(s * .6).toFixed(2)})`; });
    if (b) b.setAttribute("d", s > .7 ? BOUCHES.ferme[0] : s > .35 ? BOUCHES.boude[0] : BOUCHES.calme[0]);
    boite.classList.toggle("fixe", s > .7);
  };
  new MutationObserver(poser).observe(n, { childList: true, characterData: true, subtree: true });
  poser();
})();
