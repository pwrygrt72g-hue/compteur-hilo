/* ══════════════════════ CROUPIER ══════════════════════
   LE CROUPIER — le personnage, ses gestes, ses humeurs (lot Croupier).
   Concaténé après jetons.js. Il dessine dans #croupierScene et écoute le bus
   « sabot:* » documenté en tête de socle.js ; il ne touche pas aux lignes de table.js.

   Ce qu'il faut savoir avant de toucher à ce fichier :
   · Le rig est UN SVG (viewBox 520 × 200, la ligne y = 200 est le bord de la
     table). Chaque articulation est DEUX groupes : le parent pose le pivot par
     un translate, l'enfant porte la rotation. Jamais de transform-origin sur un
     <g> : la rotation autour de (0,0) est vraie par construction, partout.
   · Les bras sont à l'ÉCHELLE HUMAINE (1,2 × la carrure), pas à celle de la
     spec (0,58 ×) : mesuré le 04/09, à 1280 × 800 le sabot est à 82 px et 79 px
     de l'épaule, soit ~200 unités de rig. Un bras plus court n'y arrive pas.
     Rallongés de 8 unités par segment le 05/09 : à 135 px de portée pour 162 de
     bras, les deux bras faisaient un T tendu (« bras-tubes », les critiques).
     Avec 177, le coude se plie.
   · Une pose se CALCULE (cinématique inverse à deux os, coude toujours vers
     l'extérieur, portée bornée — un bras trop court se tend, il ne se casse
     pas). Aucune pose n'est écrite en dur : le sabot et la défausse sont lus
     à l'écran, la course des bras suit la table.
   · La carte n'est PAS accrochée à la main : la main est au sabot quand la
     carte en part et balaie vers le siège un peu avant elle. La causalité se
     lit dans la coïncidence, et tirer() n'a rien à savoir de nous.
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
   scène et les cinq vignettes du sélecteur sans qu'un url(#…) se trompe de
   croupier. Coordonnées de la spec (axe x = 210, table à y = 214), replacées
   dans la boîte par translate(50,-14). ─────────────────────────────────── */
const CR_RIG = `<svg class="cr-svg" viewBox="0 0 520 200" preserveAspectRatio="xMidYMax meet" overflow="visible" aria-hidden="true" focusable="false">
<defs>
<pattern id="@crT" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(40)"><line x1="0" y1="0" x2="0" y2="4" stroke="#000" stroke-width="1.3"/></pattern>
<clipPath id="@crB"><path d="M210 118c-18 0-30 5-46 12-27 12-43 29-48 53-3 13-4 21-4 31h196c0-10-1-18-4-31-5-24-21-41-48-53-16-7-28-12-46-12z"/></clipPath>
<clipPath id="@crC"><path d="M210 26c-21 0-35 16-36 37 0 9 1 16 3 23 2 8 6 16 11 22 6 8 13 12 22 12s16-4 22-12c5-6 9-14 11-22 2-7 3-14 3-23 0-21-15-37-36-37z"/></clipPath>
<g id="@o-noeud"><path d="M210 136l-20-9c-3-1-5 1-5 4v12c0 3 2 5 5 4zM210 136l20-9c3-1 5 1 5 4v12c0 3-2 5-5 4z"/><rect x="204" y="129" width="12" height="14" rx="4"/></g>
<g id="@o-mao"><path d="M186 124l24 22 24-22 6 4-30 28-30-28z"/><path d="M204 148h12v22h-12z" opacity=".55"/></g>
<g id="@o-lavalliere"><path d="M210 132c-9-6-19-4-21 3-2 6 3 11 10 11 5 0 9-2 11-5 2 3 6 5 11 5 7 0 12-5 10-11-2-7-12-9-21-3z"/><path d="M204 145l-5 26 11-8 11 8-5-26z" opacity=".8"/></g>
<g id="@o-cravate"><path d="M210 130l-9 8 4 8-4 30 9 10 9-10-4-30 4-8z"/></g>
<path id="@c-courts" d="M210 22c-23 0-37 15-37 38 0 5 0 9 1 12 3-11 7-18 12-22 9 6 20 9 32 9 8 0 15-1 21-4 4 4 7 10 9 17 1-3 1-7 1-12 0-23-16-38-39-38z"/>
<path id="@c-chignon" d="M210 20c-24 0-38 16-38 39 0 6 1 10 2 13 2-12 5-19 9-23 10 5 20 7 29 7 9 0 17-2 24-6 4 4 7 11 9 22 1-3 2-7 2-13 0-23-13-39-37-39zm34 6c8-2 14 3 15 10 1 8-5 13-12 12z"/>
<path id="@c-degarni" d="M210 24c-20 0-33 12-36 30 6-6 13-9 22-9 12 0 22 5 30 14 3 3 6 8 8 13 1-4 2-9 2-14 0-20-14-34-26-34zm-38 36c-2 8-2 15-1 20 2-9 5-15 9-19zm76 0c2 8 2 15 1 20-2-9-5-15-9-19z"/>
<path id="@c-plaque" d="M210 21c-22 0-36 14-37 35 0 6 0 11 2 15 2-13 6-21 12-25 8 7 16 10 24 10 9 0 17-3 24-10 6 4 10 12 12 25 2-4 2-9 2-15-1-21-17-35-39-35z"/>
<path id="@c-carre" d="M210 20c-23 0-38 16-38 39v42c0 5 2 9 5 11l4-50c10 5 19 7 29 7 10 0 19-2 25-6l4 49c3-2 5-6 5-11V59c0-23-11-39-34-39z"/>
<g id="@l-rien"/>
<g id="@l-rondes" fill="none" stroke="var(--cr-monture,#3A2A1C)" stroke-width="2.6"><circle cx="195" cy="71" r="12.5"/><circle cx="226" cy="71" r="12.5"/><path d="M207.5 70h6M182.5 68l-8-3M238.5 68l8-3"/></g>
<g id="@l-carrees" fill="none" stroke="var(--cr-monture,#3A2A1C)" stroke-width="2.6"><rect x="182" y="62" width="26" height="18" rx="4"/><rect x="213" y="62" width="26" height="18" rx="4"/><path d="M208 70h5M182 66l-8-2M239 66l8-2"/></g>
<g id="@m-rien"/>
<path id="@m-brosse" d="M195 88c5-4 10-5 15-3 5-2 10-1 15 3-2 7-8 9-15 8-7 1-13-1-15-8z"/>
<path id="@m-fine" d="M199 89c4-2 8-2 11 0 3-2 7-2 11 0-1 3-6 4-11 3-5 1-10 0-11-3z"/>
</defs>
<g id="@crCorps" transform="translate(50,-14)">
<g fill="none" stroke="var(--cr-encre,#0A0D0C)" stroke-opacity=".46" stroke-width="2" stroke-linejoin="round">
<!-- ── TORSE : veste, plastron, deux pans de gilet hachurés, cou, col ─── -->
<g id="@crTorse">
 <path d="M210 118c-18 0-30 5-46 12-27 12-43 29-48 53-3 13-4 21-4 31h196c0-10-1-18-4-31-5-24-21-41-48-53-16-7-28-12-46-12z" fill="var(--cr-veste,#171C21)"/>
 <g clip-path="url(#@crB)" stroke="none">
  <path d="M186 124h48l16 90h-80z" fill="var(--cr-chemise,#F1ECE0)"/>
  <path d="M186 124l24 26-10 64h-14z" fill="#000" opacity=".07"/>
  <path d="M186 124c-8 3-14 6-22 10-27 12-43 29-48 53-3 13-4 21-4 31h68l-4-64z" fill="var(--cr-gilet,#28313A)"/>
  <path d="M234 124c8 3 14 6 22 10 27 12 43 29 48 53 3 13 4 21 4 31h-68l4-64z" fill="var(--cr-gilet,#28313A)"/>
  <path d="M186 124c-8 3-14 6-22 10-27 12-43 29-48 53-3 13-4 21-4 31h68l-4-64z" fill="url(#@crT)" opacity=".2"/>
  <path d="M234 124c8 3 14 6 22 10 27 12 43 29 48 53 3 13 4 21 4 31h-68l4-64z" fill="url(#@crT)" opacity=".09"/>
  <path d="M186 124l24 26 24-26 7 3-31 33-31-33z" fill="#000" opacity=".3"/>
 </g>
 <path d="M186 124c-8 3-14 6-22 10-27 12-43 29-48 53-3 13-4 21-4 31h68l-4-64z"/>
 <path d="M234 124c8 3 14 6 22 10 27 12 43 29 48 53 3 13 4 21 4 31h-68l4-64z"/>
 <path d="M195 100h30v20c0 7-7 12-15 12s-15-5-15-12z" fill="var(--cr-peau,#D6A579)"/>
 <path d="M195 106c4 8 9 12 15 12s11-4 15-12v14c0 7-7 12-15 12s-15-5-15-12z" fill="#000" opacity=".3" stroke="none"/>
 <path d="M186 124l10-6 14 20-8 8zM234 124l-10-6-14 20 8 8z" fill="var(--cr-chemise,#F1ECE0)"/>
 <use id="@crOrne" href="#@o-noeud" fill="var(--cr-orne,#8E2018)"/>
</g>
<!-- ── TÊTE : g(pivot au cou) > g(animé) > g(retour au repère) ────────── -->
<g transform="translate(210,112)"><g id="@crTete"><g transform="translate(-210,-112)">
 <path d="M210 26c-21 0-35 16-36 37 0 9 1 16 3 23 2 8 6 16 11 22 6 8 13 12 22 12s16-4 22-12c5-6 9-14 11-22 2-7 3-14 3-23 0-21-15-37-36-37z" fill="var(--cr-peau,#D6A579)"/>
 <g clip-path="url(#@crC)" stroke="none"><path d="M174 66c1 30 14 54 36 54s35-24 36-54v56h-72z" fill="#000" opacity=".1"/></g>
 <path d="M175 68c-5-1-8-5-7-10 1-4 5-6 8-4zM245 68c5-1 8-5 7-10-1-4-5-6-8-4z" fill="var(--cr-peau,#D6A579)"/>
 <use id="@crCoiffe" href="#@c-courts" fill="var(--cr-cheveux,#191411)"/>
 <ellipse class="cr-joue" id="@crJoueG" cx="187" cy="86" rx="7.5" ry="4.2" fill="#D9584F" stroke="none" opacity="0"/>
 <ellipse class="cr-joue" id="@crJoueD" cx="233" cy="86" rx="7.5" ry="4.2" fill="#D9584F" stroke="none" opacity="0"/>
 <!-- les yeux : pivot au centre, l'iris glisse, la paupière descend depuis le haut -->
 <g transform="translate(195,71)" stroke="none"><g id="@crOeilG" class="cr-oeil"><ellipse rx="9" ry="6.4" fill="#F8F4EB"/><g id="@crIrisG"><circle cx="1" r="4.4" fill="var(--cr-iris,#3A2A1C)"/><circle cx="1" r="2" fill="#0B0906"/><circle cx="-.6" cy="-1.7" r="1.2" fill="#fff" opacity=".9"/></g><g transform="translate(0,-6.6)"><path id="@crPaupG" d="M-9.4 6.6a9.4 6.6 0 0 1 18.8 0z" fill="var(--cr-peau,#D6A579)" style="transform:scaleY(0)"/></g></g></g>
 <g transform="translate(226,71)" stroke="none"><g id="@crOeilD" class="cr-oeil"><ellipse rx="9" ry="6.4" fill="#F8F4EB"/><g id="@crIrisD"><circle cx="1" r="4.4" fill="var(--cr-iris,#3A2A1C)"/><circle cx="1" r="2" fill="#0B0906"/><circle cx="-.6" cy="-1.7" r="1.2" fill="#fff" opacity=".9"/></g><g transform="translate(0,-6.6)"><path id="@crPaupD" d="M-9.4 6.6a9.4 6.6 0 0 1 18.8 0z" fill="var(--cr-peau,#D6A579)" style="transform:scaleY(0)"/></g></g></g>
 <use id="@crLunettes" href="#@l-rien" fill="none"/>
 <!-- sourcils DISSYMÉTRIQUES : deux miroirs exacts font « vecteur généré » -->
 <g transform="translate(195,58)"><path id="@crSourcilG" d="M-9 2c6-5 14-5 19-1l-1 5c-5-3-11-3-17 0z" fill="var(--cr-cheveux,#191411)" stroke="none"/></g>
 <g transform="translate(226,58)"><path id="@crSourcilD" d="M9 3c-6-5-13-5-18-2l1 5c5-3 11-3 16 0z" fill="var(--cr-cheveux,#191411)" stroke="none"/></g>
 <path d="M212 72c3 8 5 12 3 15-1 2-4 2-7 1" stroke-opacity=".34" stroke-width="2.4" stroke-linecap="round"/>
 <g transform="translate(210,96)"><path id="@crBouche" d="M-11 0c7 5 15 5 22 0" stroke-opacity=".62" stroke-width="2.8" stroke-linecap="round"/><path id="@crDents" d="M-8-1h16l-1.5 3h-13z" fill="#F6F1E4" stroke="none" opacity="0"/></g>
 <use id="@crMoustache" href="#@m-rien" fill="var(--cr-cheveux,#191411)" stroke="none"/>
</g></g></g>
<!-- ── BRAS GAUCHE-ÉCRAN (côté défausse) : épaule > coude > poignet ────── -->
<g transform="translate(150,148)"><g id="@crBrasG">
 <path d="M0-18c-11 0-18 6-18 14l4 116c0 7 6 11 14 11s14-4 14-11l4-116c0-8-7-14-18-14z" fill="var(--cr-manche,#1E242A)"/>
 <path d="M-9-12c-3 3 -5 7 -5 12l3 106" fill="none" stroke="#fff" stroke-opacity=".10" stroke-width="5" stroke-linecap="round"/>
 <path d="M-14 104c5 6 23 6 28 0" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="2.4"/>
 <g transform="translate(0,120)"><g id="@crAvantG">
  <path d="M0-14c-10 0-16 6-15 13l3 98c0 6 5 9 12 9s12-3 12-9l3-98c1-7-5-13-15-13z" fill="var(--cr-manche,#1E242A)"/>
  <path d="M-14-4c4 5 24 5 28 0l-1 14c-5 3-21 3-26 0z" fill="#000" opacity=".30" stroke="none"/>
  <path d="M-14 6c4 4 24 4 28 0l-1 5c-5 2-21 2-26 0z" fill="#fff" opacity=".07" stroke="none"/>
  <path d="M-7-4c-3 3 -4 6 -4 10l3 82" fill="none" stroke="#fff" stroke-opacity=".10" stroke-width="4" stroke-linecap="round"/>
  <path d="M-6 12h4l-1 76h-4z" fill="#000" opacity=".14" stroke="none"/>
  <path d="M-13 92h26l-1 8h-24z" fill="var(--cr-poignet,#F1ECE0)"/>
  <g transform="translate(0,104)"><g id="@crMainG">
   <path d="M0-3c-9 0-13 5-13 12 0 9 5 16 13 18 8-2 13-9 13-18 0-7-4-12-13-12z" fill="var(--cr-peau,#D6A579)"/>
   <path d="M12 5c4 2 5 6 3 9-2 3-5 3-8 1" fill="var(--cr-peau,#D6A579)"/>
  </g></g>
 </g></g>
</g></g>
<!-- ── BRAS DROITE-ÉCRAN (côté sabot) : celui qui distribue ───────────── -->
<g transform="translate(270,148)"><g id="@crBrasD">
 <path d="M0-18c-11 0-18 6-18 14l4 116c0 7 6 11 14 11s14-4 14-11l4-116c0-8-7-14-18-14z" fill="var(--cr-manche,#1E242A)"/>
 <path d="M9-12c3 3 5 7 5 12l3 106" fill="none" stroke="#fff" stroke-opacity=".10" stroke-width="5" stroke-linecap="round"/>
 <path d="M-14 104c5 6 23 6 28 0" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="2.4"/>
 <g transform="translate(0,120)"><g id="@crAvantD">
  <path d="M0-14c-10 0-16 6-15 13l3 98c0 6 5 9 12 9s12-3 12-9l3-98c1-7-5-13-15-13z" fill="var(--cr-manche,#1E242A)"/>
  <path d="M-14-4c4 5 24 5 28 0l-1 14c-5 3-21 3-26 0z" fill="#000" opacity=".30" stroke="none"/>
  <path d="M-14 6c4 4 24 4 28 0l-1 5c-5 2-21 2-26 0z" fill="#fff" opacity=".07" stroke="none"/>
  <path d="M7-4c3 3 4 6 4 10l3 82" fill="none" stroke="#fff" stroke-opacity=".10" stroke-width="4" stroke-linecap="round"/>
  <path d="M-6 12h4l-1 76h-4z" fill="#000" opacity=".14" stroke="none"/>
  <path d="M-13 92h26l-1 8h-24z" fill="var(--cr-poignet,#F1ECE0)"/>
  <g transform="translate(0,104)"><g id="@crMainD">
   <path d="M0-3c-9 0-13 5-13 12 0 9 5 16 13 18 8-2 13-9 13-18 0-7-4-12-13-12z" fill="var(--cr-peau,#D6A579)"/>
   <path d="M-12 5c-4 2-5 6-3 9 2 3 5 3 8 1" fill="var(--cr-peau,#D6A579)"/>
  </g></g>
 </g></g>
</g></g>
</g></g></svg>`;
const crSvg = prefixe => CR_RIG.replaceAll("@", prefixe);

/* ── Les cinq. Un croupier = un nom, un look (variables + créneaux <use>), un
   tempérament : quelles répliques, à quelle intensité, et ce qu'il surveille.
   `piquant` = probabilité de se moquer d'une perte, `colere` = de râler d'un
   gain, `vigilance` 0-3 = réaction à une mise qui bouge avec le compte. ──── */
const CROUPIERS = {
  vince: { nom: "Vince", lieu: "Las Vegas Strip", trait: "Gominé, gouailleur. Parle beaucoup, pardonne peu.",
    coiffe: "c-plaque", orne: "o-noeud", lunettes: "l-rien", moustache: "m-rien", sourcils: 1,
    p: { "--cr-peau": "#D8A57C", "--cr-cheveux": "#14100E", "--cr-veste": "#171C21", "--cr-manche": "#171C21", "--cr-gilet": "#3B1F22",
      "--cr-chemise": "#F2EDE1", "--cr-poignet": "#F2EDE1", "--cr-orne": "#C8252B", "--cr-iris": "#3A2A1C" },
    piquant: .95, colere: .8, vigilance: 1, repos: "content",
    dit: {
      accueil: ["Bienvenue au Boulevard. Asseyez-vous, on va bien s'entendre.", "Salut. Vegas, baby."],
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
  marcel: { nom: "Marcel", lieu: "Vieux Reno", trait: "Vieux briscard, moustache en brosse. Lent, exact, et il a tout vu.",
    coiffe: "c-degarni", orne: "o-noeud", lunettes: "l-rien", moustache: "m-brosse", sourcils: 1.35,
    p: { "--cr-peau": "#E2B896", "--cr-cheveux": "#A9A196", "--cr-veste": "#3A2E26", "--cr-manche": "#3A2E26", "--cr-gilet": "#5A4A3C",
      "--cr-chemise": "#F3EEE2", "--cr-poignet": "#F3EEE2", "--cr-orne": "#6E4A22", "--cr-iris": "#4A6070" },
    piquant: .85, colere: .9, vigilance: 2,
    dit: {
      accueil: ["Assieds-toi, fiston. Ici c'est Reno.", "Prenez votre temps. Moi j'en ai."],
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
    coiffe: "c-chignon", orne: "o-mao", lunettes: "l-rien", moustache: "m-rien", sourcils: .85,
    p: { "--cr-peau": "#E6C29B", "--cr-cheveux": "#0F0C0B", "--cr-veste": "#1B0E0C", "--cr-manche": "#1B0E0C", "--cr-gilet": "#7A1410",
      "--cr-chemise": "#EFE7D6", "--cr-poignet": "#EFE7D6", "--cr-orne": "#F2C15A", "--cr-iris": "#241A12" },
    piquant: .45, colere: .6, vigilance: 1,
    dit: {
      accueil: ["Bonsoir.", "Prenez place. La machine ne dort jamais."],
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
    coiffe: "c-carre", orne: "o-lavalliere", lunettes: "l-carrees", moustache: "m-rien", sourcils: .9,
    p: { "--cr-peau": "#EBD2BA", "--cr-cheveux": "#3A2418", "--cr-veste": "#1B2A4E", "--cr-manche": "#1B2A4E", "--cr-gilet": "#24365F",
      "--cr-chemise": "#FBF8F0", "--cr-poignet": "#FBF8F0", "--cr-orne": "#D4B46A", "--cr-iris": "#38506B", "--cr-monture": "#20201E" },
    piquant: .6, colere: .7, vigilance: 2,
    dit: {
      accueil: ["Les jeux sont faits.", "Bonsoir. Le règlement est affiché."],
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
  chef: { nom: "Le Chef", lieu: "Salon privé", trait: "Chef de table, détecteur de triche. Il ne regarde pas vos cartes : il regarde vos mises.",
    coiffe: "c-courts", orne: "o-cravate", lunettes: "l-rien", moustache: "m-fine", sourcils: 1.6,
    p: { "--cr-peau": "#CFA07A", "--cr-cheveux": "#26221F", "--cr-veste": "#0F1418", "--cr-manche": "#0F1418", "--cr-gilet": "#181E24",
      "--cr-chemise": "#FBF8F0", "--cr-poignet": "#FBF8F0", "--cr-orne": "#141A20", "--cr-iris": "#2A3A46" },
    piquant: .8, colere: .9, vigilance: 3, repos: "concentre",
    dit: {
      accueil: ["Chef de table. Je surveille, vous jouez.", "Bonsoir. Vos mises m'intéressent plus que vos cartes."],
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

/* ── L'état ──────────────────────────────────────────────────────────── */
const CR = { id: "", el: null, scene: null, bulle: null, mains: null, mainsEl: null, hm: {}, visible: false, salue: false, fixe: false,
  j: {}, seg: {}, an: {}, arme: false, base: "neutre", emotion: "neutre", jeton: 0, gestes: 0,
  dernier: {}, gains: 0, pertes: 0, mises: [], derniereAlerte: -9, minuteurs: [] };
const CR_SEG = { L1: 120, L2: 116 };      // épaule→coude, coude→centre de la paume
const CR_EPAULE = { G: [150, 148], D: [270, 148] };

const crQ = s => CR.el ? CR.el.querySelector(s) : null;
const crMinuteur = (f, ms) => setTimeout(f, ms);

/* ── Monter le croupier dans #croupierScene ─────────────────────────── */
function crLook(svg, c, prefixe) {
  for (const k of ["--cr-peau", "--cr-cheveux", "--cr-veste", "--cr-manche", "--cr-gilet", "--cr-chemise", "--cr-poignet", "--cr-orne", "--cr-iris", "--cr-monture"])
    svg.style.setProperty(k, c.p[k] || (k === "--cr-monture" ? "#3A2A1C" : ""));
  const u = (id, href) => { const e = svg.querySelector("#" + prefixe + id); if (e) e.setAttribute("href", "#" + prefixe + href); };
  u("crCoiffe", c.coiffe); u("crOrne", c.orne); u("crLunettes", c.lunettes); u("crMoustache", c.moustache);
  // L'épaisseur des sourcils fait la moitié d'un caractère : posée avec la pose
  // neutre, par le même chemin que les émotions (crVisage la conserve).
  ["crSourcilG", "crSourcilD"].forEach(k => { const e = svg.querySelector("#" + prefixe + k); if (e) e.style.transform = `scaleY(${c.sourcils || 1})`; });
}
/* ── Les mains SUR LE FEUTRE ─────────────────────────────────────────────
   Mesuré le 05/09 : les avant-bras du rig, posés sur le feutre, croisaient les
   cartes du croupier (le coude gauche sur sa carte visible, l'avant-bras droit sur
   sa carte cachée) et faisaient des tubes raides — « épouvantail », « bras-tuyaux »
   (les critiques). Un croupier vu de sa place a les coudes DERRIÈRE le rail : on
   voit ses épaules au-dessus, et ses mains sur le feutre. Le rig est donc COUPÉ au
   rail (clip-path, style.css) et chaque main est un élément HTML DANS le feutre :
   une manche qui sort de sous le rail, un poignet, une main vue de dessus. Elle va
   exactement où la cinématique l'envoie — plus de portée bornée. Le bras du rig
   continue de s'orienter vers la cible (l'épaule suit), on n'en voit que la
   naissance. Le pouce est du côté du corps : la main de droite à l'écran est la
   main GAUCHE du croupier (le sabot est à sa gauche, comme dans un vrai casino). */
const CR_MAIN_SVG = cote => `<svg viewBox="0 0 50 32" class="cr-hd" aria-hidden="true" focusable="false">
  <g${cote === "D" ? ' transform="translate(0 32) scale(1 -1)"' : ""} stroke="rgba(35,18,8,.38)" stroke-width=".9" stroke-linejoin="round">
    <rect x="0" y="3.5" width="10" height="25" rx="2.5" fill="var(--cr-poignet,#F1ECE0)" stroke="rgba(0,0,0,.3)"/>
    <rect x="14" y="1.4" width="16" height="7" rx="3.5" fill="var(--cr-peau,#D6A579)" transform="rotate(-36 14 4.9)"/>
    <path d="M9 5.6h16c7 0 11 4.2 11 10.4S32 26.4 25 26.4H9z" fill="var(--cr-peau,#D6A579)"/>
    <rect x="31" y="3.6" width="18" height="6.3" rx="3.15" fill="var(--cr-peau,#D6A579)"/>
    <rect x="32" y="10.3" width="18" height="6.3" rx="3.15" fill="var(--cr-peau,#D6A579)"/>
    <rect x="31.5" y="17" width="16.5" height="6" rx="3" fill="var(--cr-peau,#D6A579)"/>
    <rect x="29.5" y="23.3" width="12.5" height="5.4" rx="2.7" fill="var(--cr-peau,#D6A579)"/>
    <path d="M14 9c3 4.5 3 10.5 0 15" fill="none" stroke="rgba(0,0,0,.10)" stroke-width="1"/>
  </g></svg>`;
function monterMains() {
  const feutre = $("feutre"); if (!feutre) return;
  let c = $("crMains");
  if (!c) { c = document.createElement("div"); c.className = "cr-mains"; c.id = "crMains"; c.setAttribute("aria-hidden", "true"); feutre.appendChild(c); }
  c.innerHTML = `<div class="cr-avant cr-avant-G"><i class="cr-manche"></i>${CR_MAIN_SVG("G")}</div><div class="cr-avant cr-avant-D"><i class="cr-manche"></i>${CR_MAIN_SVG("D")}</div>`;
  CR.mainsEl = c; CR.mains = { G: c.children[0], D: c.children[1] }; CR.hm = {};
  if (CR.el) for (const k of ["--cr-peau", "--cr-manche", "--cr-poignet"]) c.style.setProperty(k, CR.el.style.getPropertyValue(k));
}
// Là où la manche sort de sous le rail : sous l'épaule, décalée vers la main (un tiers
// du chemin, le coude est derrière le rail), juste au-dessus du feutre — coupée par lui.
function crAncre(cote, hx, rep) {
  const F = $("feutre").getBoundingClientRect(), S = CR_EPAULE[cote];
  const sx = rep.x0 + (S[0] + 50) * rep.s;
  return { x: sx + (cote === "D" ? 1 : -1) * 26 * rep.s + (hx - sx) * .35, y: F.top - 10, F };
}
function crAvantCourant(cote) {
  const el = CR.mains[cote], cs = getComputedStyle(el);
  let a = 0; try { const m = new DOMMatrixReadOnly(cs.transform); a = Math.atan2(m.b, m.a) * 180 / Math.PI; } catch (e) {}
  return { a, d: parseFloat(cs.width) || 0 };
}
function crAvantHtml(cote, x, y, ms, poignet, rep) {
  const el = CR.mains && CR.mains[cote]; if (!el) return;
  const an = crAncre(cote, x, rep), ax = an.x - an.F.left, ay = an.y - an.F.top, hx = x - an.F.left, hy = y - an.F.top;
  let a = Math.atan2(hy - ay, hx - ax) * 180 / Math.PI; const d = Math.max(12, Math.hypot(hx - ax, hy - ay));
  el.style.left = ax.toFixed(1) + "px"; el.style.top = ay.toFixed(1) + "px";
  const hd = el.querySelector(".cr-hd"), rot = `rotate(${((poignet || 0) * (cote === "D" ? 1 : -1) * .8).toFixed(1)}deg)`;
  const de = CR.hm[cote] ? crAvantCourant(cote) : null;
  if (CR.hm[cote] && CR.hm[cote].an) { CR.hm[cote].an.cancel(); }
  CR.hm[cote] = { a, d };
  if (!de || MOUVEMENT_REDUIT.on || !ms || ms < 24) { el.style.transform = `rotate(${a.toFixed(2)}deg)`; el.style.width = d.toFixed(1) + "px"; hd.style.transition = "none"; hd.style.transform = rot; return; }
  a += 360 * Math.round((de.a - a) / 360);   // le chemin le plus court
  const anim = el.animate([{ transform: `rotate(${de.a.toFixed(2)}deg)`, width: de.d.toFixed(1) + "px" }, { transform: `rotate(${a.toFixed(2)}deg)`, width: d.toFixed(1) + "px" }],
    { duration: ms, easing: "cubic-bezier(.22,.72,.24,1)", fill: "forwards" });
  CR.hm[cote].an = anim;
  anim.finished.then(() => { if (CR.hm[cote] && CR.hm[cote].an === anim) { el.style.transform = `rotate(${a.toFixed(2)}deg)`; el.style.width = d.toFixed(1) + "px"; anim.cancel(); CR.hm[cote].an = null; } }, () => {});
  hd.style.transition = `transform ${Math.round(ms)}ms cubic-bezier(.22,.72,.24,1)`; hd.style.transform = rot;
}
function monterCroupier() {
  const scene = $("croupierScene"); if (!scene) return;
  const id = crEffectif(); if (id === CR.id && CR.el) return;
  CR.id = id; const c = crPerso();
  scene.innerHTML = crSvg("cr-");
  CR.el = scene.querySelector("svg"); CR.scene = scene;
  crLook(CR.el, c, "cr-");
  monterMains();
  CR.j = {}; CR.seg = {}; CR.an = {}; CR.arme = false;
  CR.base = crRepos(); CR.emotion = CR.base; crVisage(EMOTIONS[CR.base]);
  crReposer(1);
  crLancerAmbiance();
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
// Un point d'écran, exprimé dans le repère de la spec (celui des pivots).
function crVersRig(x, y, rep) {
  rep = rep || crRepere(); if (!rep) return null;
  return { x: (x - rep.x0) / rep.s - 50, y: (y - rep.y0) / rep.s + 14 };
}
/* Cinématique inverse à deux os. Le coude va vers le bas et l'extérieur du
   corps, et la portée est bornée : hors d'atteinte, le bras se tend vers la
   cible — il ne se casse jamais. Les segments sont dessinés le long de +y,
   d'où θ = atan2(−cos φ, sin φ) pour pointer dans la direction φ. */
function crIK(cote, px, py) {
  const S = CR_EPAULE[cote], { L1, L2 } = CR_SEG;
  let dx = px - S[0], dy = py - S[1], d = Math.hypot(dx, dy) || 1;
  const dd = Math.max(Math.abs(L1 - L2) + 6, Math.min((L1 + L2) * .985, d));
  dx *= dd / d; dy *= dd / d; d = dd;
  const a = Math.atan2(dy, dx);
  const alpha = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
  // Le coude va vers le BAS (et l'extérieur) : avec le coude au-dessus de l'épaule,
  // un bras replié sur le sabot faisait une aile de poulet (vu le 04/09).
  const dir1 = a + (cote === "D" ? 1 : -1) * alpha;
  const ex = S[0] + L1 * Math.cos(dir1), ey = S[1] + L1 * Math.sin(dir1);
  const dir2 = Math.atan2(S[1] + dy - ey, S[0] + dx - ex);
  const th = f => Math.atan2(-Math.cos(f), Math.sin(f)) * 180 / Math.PI;
  const t1 = th(dir1); let t2 = th(dir2) - t1; t2 = ((t2 + 540) % 360) - 180;
  return { bras: t1, avant: t2 };
}
// La main d'un côté va à un point d'ÉCRAN, en ms. Poignet en option.
function crMainVers(cote, x, y, ms, poignet) {
  const rep = crRepere(), p = crVersRig(x, y, rep); if (!p) return false;
  const a = crIK(cote, p.x, p.y);
  crBouger("crBras" + cote, a.bras, ms); crBouger("crAvant" + cote, a.avant, ms);
  crBouger("crMain" + cote, poignet || 0, ms);
  crAvantHtml(cote, x, y, ms, poignet, rep);
  return true;
}
const crRect = id => { const e = $(id); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? r : null; };

/* ── Les articulations : WAAPI, interruptible, sans fuite ─────────────
   Une animation fill:"forwards" reste vivante à jamais : on CUIT la pose
   finale en style en ligne puis on libère. La branche de rejet est vide et
   OBLIGATOIRE — cancel() rejette `finished`, et verifier.sh compte les
   unhandledrejection. Interrompre un geste repart de l'angle RÉEL (lu sur la
   progression), sinon le bras saute à la cible du geste précédent. ─────── */
const FORME = (cle, a) => cle === "crTete" ? `translate(${(a * .55).toFixed(2)}px,0) rotate(${a.toFixed(2)}deg)` : `rotate(${a.toFixed(2)}deg)`;
function crCourant(cle) {
  const an = CR.an[cle];
  if (!an || an.playState !== "running") return CR.j[cle] || 0;
  const p = an.effect.getComputedTiming().progress || 0;
  const [d0, d1] = CR.seg[cle] || [0, 0];
  return d0 + (d1 - d0) * (p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
}
function crBouger(cle, a, ms) {
  const e = crQ("#cr-" + cle); if (!e) return;
  const de = crCourant(cle); CR.j[cle] = a;
  if (CR.an[cle]) { CR.an[cle].cancel(); CR.an[cle] = null; }
  if (MOUVEMENT_REDUIT.on || !ms || ms < 24 || Math.abs(a - de) < .05) { e.style.transform = FORME(cle, a); return; }
  CR.seg[cle] = [de, a];
  const an = e.animate([{ transform: FORME(cle, de) }, { transform: FORME(cle, a) }],
    { duration: ms, easing: "cubic-bezier(.22,.72,.24,1)", fill: "forwards" });
  an.finished.then(() => { if (CR.an[cle] === an) { e.style.transform = FORME(cle, CR.j[cle]); an.cancel(); CR.an[cle] = null; } }, () => {});
  CR.an[cle] = an;
}

/* ── Les poses. Toutes lues à l'écran : le sabot et la défausse sont là où
   la scène les a mis, la course des bras suit. ─────────────────────────── */
function crCibleSabot() { const r = crRect("sabot"); return r ? { x: r.left + r.width * .5, y: r.top + r.height * .3 } : null; }
function crReposer(ms) {
  ms = ms === undefined ? 340 : ms; CR.arme = false;
  const rs = crRect("sabot"), rd = crRect("defausse");
  if (!crRepere()) return;
  // Une main posée sur le sabot, l'autre sur la défausse : jamais sur sa carte
  // visible ni sur son nom (mesuré le 04/09 : à côté de la défausse, la main
  // gauche couvrait le coin de sa carte).
  const okD = rs && crMainVers("D", rs.left + rs.width * .38, rs.top + rs.height * .5, ms, 8);
  if (!okD) { crBouger("crBrasD", -34, ms); crBouger("crAvantD", -48, ms); crBouger("crMainD", 8, ms); }
  if (!crPoserGauche(ms)) { crBouger("crBrasG", 34, ms); crBouger("crAvantG", 48, ms); crBouger("crMainG", -8, ms); }
}
// La main gauche repose À PLAT sur le feutre, sous le rack, à gauche de ses cartes :
// un coude plié, une main posée — pas un bras tendu vers le coin de la défausse
// (mesuré le 05/09 : pose identique au pixel sur toutes les captures). Repli sur
// la défausse si le rack n'est pas rendu (téléphone).
function crPoserGauche(ms) {
  // Sur le coin bas-droit de la défausse, en diagonale depuis le rail : mesuré le
  // 05/09, posée sous le rack elle pendait à la verticale et couvrait « Croupier ».
  const rd = crRect("defausse"); if (!rd) return false;
  return crMainVers("G", rd.right - rd.width * .18, rd.top + rd.height * .66, ms, -6);
}
function crArmer(ms) {
  const c = crCibleSabot(); if (!c) return false;
  CR.arme = true;
  return crMainVers("D", c.x, c.y, ms || 320, 14);
}
/* LE geste. La main part du sabot et POUSSE la carte vers le siège : elle balaie
   jusqu'à la moitié du trajet (la portée bornée tend le bras vers le joueur), en
   55 % du vol de la carte, puis revient au sabot. Mesuré le 05/09 avec l'ancien
   coup de poignet de 68 px : sur toutes les captures la main était sur le sabot
   et les cartes s'envolaient toutes seules. Sous ~145 ms de cadence il ne revient
   pas au sabot, il enchaîne — ce que fait un vrai croupier lancé. */
function crFlick(vers, v) {
  if (!CR.el || !CR.visible) return;
  const c = crCibleSabot(); if (!c) return;
  if (!CR.arme) crArmer(Math.min(200, v));
  const amp = Math.max(.55, Math.min(1, v / 450));
  const don = parseFloat(getComputedStyle($("plateau")).getPropertyValue("--don")) || 300;
  const ms = Math.max(90, Math.min(don * .55, v * .6));
  const dx = vers.x - c.x, dy = vers.y - c.y, d = Math.hypot(dx, dy) || 1;
  const pas = Math.min(150, d * .5) * amp;
  crMainVers("D", c.x + dx / d * pas, c.y + dy / d * pas, ms, -22 * amp);
  crPoserGauche(Math.max(ms, 260));
  crRegarde(vers.x, vers.y, ms * 1.3);
  CR.gestes++; const n = CR.gestes;
  if (v > ms * 1.6) crMinuteur(() => { if (CR.arme && CR.gestes === n) crArmer(Math.max(90, v * .3)); }, ms + 20);
}
// Sa propre carte cachée : la main vient dessus, un coup de poignet, et repart.
function crRetourne(el) {
  if (!CR.el || !CR.visible || !el) return;
  const r = el.getBoundingClientRect(); if (!r.width) return;
  crMainVers("D", r.left + r.width * .62, r.top + r.height * .35, 240, -30);
  crMinuteur(() => crBouger("crMainD", 30, 180), 250);
  crMinuteur(() => { if (CR.arme) crArmer(300); else crReposer(360); }, 520);
  crRegarde(r.left + r.width / 2, r.top, 260);
}
// Le mélange : les deux mains ramassent au centre et se croisent, 1,2 s.
function crMelange() {
  if (!CR.el || !CR.visible || MOUVEMENT_REDUIT.on) return;
  const rd = crRect("defausse"), rs = crRect("sabot"); if (!rd || !rs) return;
  const cx = (rd.right + rs.left) / 2, cy = rd.top + 30;
  const pas = [[cx - 40, cy + 26, cx + 40, cy + 26], [cx + 30, cy + 8, cx - 30, cy + 8], [cx - 44, cy + 30, cx + 44, cy + 30], [cx + 24, cy + 4, cx - 24, cy + 4]];
  pas.forEach((p, i) => crMinuteur(() => { crMainVers("G", p[0], p[1], 230, -14); crMainVers("D", p[2], p[3], 230, 14); }, i * 240));
  crMinuteur(() => { if (!CR.arme) crReposer(360); }, 1000);
  crVisage(EMOTIONS.concentre); crMinuteur(() => { if (CR.emotion === CR.base) crVisage(EMOTIONS[CR.base]); }, 1300);
}
/* Le regard : tête ET iris vers un point d'écran, −1…+1 sur la largeur des sièges. */
function crRegarde(x, y, ms) {
  const rep = crRepere(); if (!rep) return;
  const cx = rep.x0 + 260 * rep.s;
  let demi = 320; document.querySelectorAll("#sieges .siege").forEach(s => { const r = s.getBoundingClientRect(); demi = Math.max(demi, Math.abs(r.left + r.width / 2 - cx)); });
  const u = Math.max(-1, Math.min(1, (x - cx) / demi));
  const v = y === undefined ? .4 : Math.max(-1, Math.min(1, (y - rep.y0) / 400));
  crBouger("crTete", u * 7, ms || 260);
  const iris = `translate(${(u * 2.6).toFixed(2)}px,${(v * 1.3).toFixed(2)}px)`;
  ["crIrisG", "crIrisD"].forEach(k => { const e = crQ("#cr-" + k); if (e) e.style.transform = iris; });
}

/* ── Le visage. Sourcils = [descente px, rotation deg], jamais symétriques ;
   la bouche est ÉCHANGÉE, jamais interpolée — une bouche qui se déforme
   continûment est du morphing, une qui claque est du dessin animé. ────── */
const BOUCHES = {
  calme: ["M-11 0c7 5 15 5 22 0"], sourire: ["M-13-3c8 9 18 9 26 0"], encoin: ["M-10 1c5 3 11 2 19-4"],
  ferme: ["M-11 0h22"], boude: ["M-11 2c7-5 15-5 22 0"],
  furieux: ["M-12-2c8-3 16-3 24 0-2 9-22 9-24 0z", "#4A1A16", 1], parle: ["M-8-3c5-3 11-3 16 0-2 7-14 7-16 0z", "#4A1A16"],
};
const EMOTIONS = {
  neutre: { sg: [0, 0], sd: [0, 0], bouche: "calme", joues: 0, plisse: [0, 0] },
  concentre: { sg: [1.6, 3], sd: [1.6, -3], bouche: "ferme", joues: 0, plisse: [.22, .22] },
  content: { sg: [-1, -3], sd: [-1, 3], bouche: "sourire", joues: .2, plisse: [0, 0] },
  moqueur: { sg: [-3.6, -9], sd: [2, 5], bouche: "encoin", joues: .15, plisse: [.06, .42] },
  agace: { sg: [4, 13], sd: [4, -13], bouche: "boude", joues: .55, plisse: [.35, .35] },
  furieux: { sg: [6.5, 22], sd: [6.5, -22], bouche: "furieux", joues: .95, plisse: [.45, .45], secoue: true },
  soupcon: { sg: [3, 7], sd: [3.6, -5], bouche: "ferme", joues: 0, plisse: [.55, .55], fixe: true },
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
  CR.fixe = !!o.fixe;
}
// La bouche s'ouvre et se ferme deux fois : il parle, même sans son.
function crArticule(retour) {
  if (!CR.el || MOUVEMENT_REDUIT.on) return;
  const b = crQ("#cr-crBouche"); if (!b) return;
  const p = BOUCHES.parle, f = BOUCHES[retour] || BOUCHES.calme;
  const ouvre = () => { b.setAttribute("d", p[0]); b.setAttribute("fill", p[1]); };
  const ferme = () => { b.setAttribute("d", f[0]); b.setAttribute("fill", f[1] || "none"); };
  ouvre(); crMinuteur(ferme, 130); crMinuteur(ouvre, 260); crMinuteur(ferme, 400);
}
function crSecoue() {
  if (!CR.el || MOUVEMENT_REDUIT.on) return;
  const t = crQ("#cr-crTete"); if (!t) return;
  const a = CR.j.crTete || 0;
  const an = t.animate([-4, 4, -3, 3, -1, 0].map(dx => ({ transform: `translate(${dx + a * .55}px,0) rotate(${a}deg)` })), { duration: 420, easing: "ease-out" });
  an.finished.then(() => an.cancel(), () => {});
}

/* ── La bulle : hors de #croupierScene (qui est aria-hidden), dans un
   aria-live poli, 1,8 s, Instrument Serif. ───────────────────────────── */
function crBulleEl() {
  if (CR.bulle) return CR.bulle;
  const salle = $("salle"); if (!salle) return null;
  const b = document.createElement("div"); b.className = "cr-bulle"; b.setAttribute("role", "status"); b.setAttribute("aria-live", "polite");
  b.innerHTML = `<b class="cr-nom"></b><span class="cr-texte"></span>`;
  salle.appendChild(b); CR.bulle = b; return b;
}
function crDire(texte, ms) {
  const b = crBulleEl(); if (!b || !texte) return;
  const rep = crRepere();
  if (rep) {
    const salle = $("salle").getBoundingClientRect();
    b.style.left = Math.round(rep.x0 + 300 * rep.s - salle.left) + "px";
    b.style.top = Math.max(4, Math.round(rep.y0 + 8 * rep.s - salle.top)) + "px";
  }
  b.querySelector(".cr-nom").textContent = crNom();
  b.querySelector(".cr-texte").textContent = texte;
  b.classList.add("on");
  clearTimeout(CR.bulleT); CR.bulleT = setTimeout(() => b.classList.remove("on"), ms || 1800);
}
// Fermer la bulle tout de suite : le croupier ne parle pas pendant qu'il distribue.
function crTaire() { clearTimeout(CR.bulleT); if (CR.bulle) CR.bulle.classList.remove("on"); }
function crReplique(genre) {
  const banque = crPerso().dit[genre] || []; if (!banque.length) return "";
  let i, g = 0; do { i = alea(banque.length); } while (banque.length > 1 && i === CR.dernier[genre] && g++ < 8);
  CR.dernier[genre] = i; return banque[i];
}

/* ── Une émotion : un visage, une réplique, un retour à la base ─────────── */
function crEmotion(nom, o) {
  o = o || {}; const e = EMOTIONS[nom] || EMOTIONS.neutre;
  CR.emotion = nom; const jeton = ++CR.jeton;
  crVisage(e);
  if (e.secoue) crSecoue();
  if (e.fixe) { const toi = document.querySelector("#sieges .siege.toi"); if (toi) { const r = toi.getBoundingClientRect(); crRegarde(r.left + r.width / 2, r.top, 220); } }
  if (o.texte) { crDire(o.texte, Math.min(o.ms || 1800, o.tenue || 2400)); crArticule(e.bouche); }
  else crTaire();
  crMinuteur(() => { if (CR.jeton === jeton) { CR.emotion = CR.base; crVisage(EMOTIONS[CR.base] || EMOTIONS.neutre); } }, o.tenue || 2400);
}
// Pour les captures et la console : window.__croupierEmotion("moqueur")
window.__croupierEmotion = nom => { monterCroupier(); crEmotion(nom, { texte: crReplique(nom === "content" ? "accueil" : nom) || crReplique("moqueur"), tenue: 60000, ms: 60000 }); };

/* ── L'ambiance : clignements, un clin d'œil de temps en temps, un regard
   qui bouge. Rien de tout ça en mouvement réduit, et jamais quand il te FIXE. */
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
  // La respiration : le buste se soulève d'un pixel et demi toutes les 3,4 s. Une
  // figurine posée ne respire pas ; c'est ce qui la distingue d'un personnage.
  const torse = crQ("#cr-crTorse");
  if (torse && !MOUVEMENT_REDUIT.on) {
    if (CR.souffle) CR.souffle.cancel();
    CR.souffle = torse.animate([{ transform: "translateY(0)" }, { transform: "translateY(1.6px)" }, { transform: "translateY(0)" }],
      { duration: 3400, iterations: Infinity, easing: "ease-in-out" });
  }
  const tic = () => {
    if (!CR.el) return;
    const clin = crAuRepos() && !CR.arme && Math.random() < .18;
    if (clin) { crCligne(320, true); crVisage(EMOTIONS.content); crMinuteur(() => { if (crAuRepos()) crVisage(EMOTIONS[CR.base] || EMOTIONS.neutre); }, 700); }
    else crCligne(150);
    if (crAuRepos() && !CR.arme && Math.random() < .35) crBouger("crTete", (Math.random() - .5) * 5, 600);
    CR.ambiance = setTimeout(tic, 2600 + Math.random() * 3800);
  };
  CR.ambiance = setTimeout(tic, 1800);
}
function crStopperAmbiance() { clearTimeout(CR.ambiance); CR.ambiance = null; if (CR.souffle) { CR.souffle.cancel(); CR.souffle = null; } }

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
  crArmer(320);
  const d = e.detail || {};
  const mise = d.mise !== undefined ? d.mise : crLireNombre("tMise");
  const tc = d.tc !== undefined ? d.tc : (d.compte !== undefined ? d.compte : crLireNombre("tTC"));
  crSurveille(mise, tc);
});
document.addEventListener("sabot:carte", e => { const d = e.detail || {}; if (d.vers) crFlick(d.vers, rythme()); });
document.addEventListener("sabot:tour", e => {
  const d = e.detail || {}; if (!CR.el || !CR.visible) return;
  if (d.siege === "croupier") { const r = crRect("dMain"); if (r) crRegarde(r.left + r.width / 2, r.top + r.height, 260); return; }
  const s = document.querySelectorAll("#sieges .siege")[d.siege]; if (!s) return;
  const r = s.getBoundingClientRect(); crRegarde(r.left + r.width / 2, r.top, 260);
});
document.addEventListener("sabot:croupier-revele", e => crRetourne((e.detail || {}).el));
document.addEventListener("sabot:main-fin", e => {
  const d = e.detail || {}; if (!CR.el) return;
  const c = crPerso();
  if (!d.toi) { // un voisin qui saute : un sourire en coin, sans un mot
    if (d.issue === "bust" && CR.emotion === CR.base) { crVisage(EMOTIONS.moqueur); crMinuteur(() => { if (CR.emotion === CR.base) crVisage(EMOTIONS[CR.base]); }, 900); }
    return;
  }
  if (d.issue === "bust" || d.issue === "perd") {
    CR.pertes++; CR.gains = 0;
    const piquant = CR.id === "lin" ? Math.min(.95, .3 + .3 * CR.pertes) : c.piquant;
    crEmotion("moqueur", { texte: Math.random() < piquant ? crReplique("moqueur") : "" });
  } else if (d.issue === "gagne") {
    CR.gains++; CR.pertes = 0;
    if (CR.gains >= 3) crEmotion("furieux", { texte: crReplique("serie"), tenue: 2800 });
    else crEmotion("agace", { texte: Math.random() < c.colere ? crReplique("agace") : "" });
  } else if (d.issue === "blackjack") {
    CR.gains++; CR.pertes = 0; crEmotion("furieux", { texte: crReplique("furieux"), tenue: 2800 });
  } else if (d.issue === "abandon") {
    crEmotion("moqueur", { texte: Math.random() < c.piquant * .7 ? crReplique("abandon") : "" });
  } else if (d.issue === "egalite") {
    if (Math.random() < .4) crEmotion("neutre", { texte: crReplique("egalite"), tenue: 1200 });
  }
});
document.addEventListener("sabot:manche-fin", () => {
  CR.base = crRepos(); if (CR.emotion === "concentre") { CR.emotion = CR.base; crVisage(EMOTIONS[CR.base]); }
  crMinuteur(() => { const b = $("bDonne"); if (!b || !b.disabled) crReposer(380); }, 600);
});

// La scène n'a de taille que quand la vue Table est visible : on ne pose une
// pose qu'à ce moment-là, et le croupier salue à la première apparition.
if (window.ResizeObserver && $("croupierScene")) new ResizeObserver(entries => {
  const r = entries[0].contentRect, avant = CR.visible; CR.visible = r.width > 20 && r.height > 20;
  if (CR.mainsEl) CR.mainsEl.hidden = !CR.visible;
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
    <label class="ch"><span class="grave">Son nom à cette table</span><input type="text" id="crNomSaisie" maxlength="18" placeholder="${echap(crPerso().nom)}" value="${echap(DB.croupier.noms[crEffectif()] || "")}"></label>`;
  const fermer = $("modaleFermer"); const rang = fermer && fermer.parentNode;
  if (rang) boite.insertBefore(sec, rang); else boite.appendChild(sec);
  sec.querySelectorAll(".cr-carte").forEach(l => {
    const id = l.querySelector("input").value, svg = l.querySelector("svg");
    if (svg && CROUPIERS[id]) { crLook(svg, CROUPIERS[id], "v" + id + "-"); svg.setAttribute("viewBox", "156 4 208 196"); svg.classList.add("cr-mini"); }
  });
  const trait = () => { const c = CROUPIERS[crEffectif()]; $("crTrait").textContent = `${c.nom} — ${c.lieu}. ${c.trait}`; $("crNomSaisie").placeholder = c.nom; $("crNomSaisie").value = DB.croupier.noms[crEffectif()] || ""; };
  trait();
  sec.querySelectorAll("input[name=crChoix]").forEach(i => i.addEventListener("change", () => {
    DB.croupier.id = i.value; DB.croupier.nom = DB.croupier.noms[crEffectif()] || ""; garder();
    sec.querySelectorAll(".cr-carte").forEach(l => l.classList.toggle("on", l.querySelector("input").checked));
    trait(); CR.id = ""; monterCroupier(); CR.salue = true;
    if (CR.visible) crEmotion("content", { texte: crReplique("accueil"), tenue: 2000, ms: 2000 });
  }));
  $("crNomSaisie").addEventListener("input", () => {
    const v = $("crNomSaisie").value.trim().slice(0, 18);
    if (v) DB.croupier.noms[crEffectif()] = v; else delete DB.croupier.noms[crEffectif()];
    DB.croupier.nom = v; garder();
  });
}
if ($("bReglagesTable")) $("bReglagesTable").addEventListener("click", () => setTimeout(rendreChoixCroupier, 0));

/* ── Mode Concentration : le chef de table a un visage. Une vignette à côté
   de la jauge, dont les sourcils suivent CO.susp (lu sur #coJaugeN, sans
   toucher à concentration.js), et qui te FIXE au-delà de 70. ─────────── */
(function crVignetteConcentration() {
  const oeil = $("coOeil"), n = $("coJaugeN"); if (!oeil || !n || !window.MutationObserver) return;
  const boite = document.createElement("span"); boite.className = "cr-chef"; boite.setAttribute("aria-hidden", "true");
  boite.innerHTML = crSvg("co-");
  const svg = boite.querySelector("svg"); svg.setAttribute("viewBox", "196 6 128 128"); svg.classList.add("cr-mini");
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
