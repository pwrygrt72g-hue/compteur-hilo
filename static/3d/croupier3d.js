/* ══════════════════════ CROUPIER 3D ══════════════════════
   Un module ES à part, chargé À LA DEMANDE — jamais dans le fichier unique.
   ⚠️ Il ne peut PAS vivre dans src/app/ : build.mjs y concatène tout dans une
   seule IIFE en script classique, où `import` est un mot-clé illégal. C'est
   aussi ce qui le rend gratuit quand il est éteint : rien de tout ça (655 Ko de
   three.js + 1,5 Mo de modèle) n'est téléchargé tant qu'on ne l'allume pas.

   Il n'expose QUE des ordres — poser une palette, regarder à tel angle, jouer
   telle émotion. Il ne lit ni le DOM du jeu ni la base : c'est croupier.js qui
   décide, exactement comme pour le SVG. Deux moteurs, une seule autorité.     */
import * as T from "./three.module.min.js";
import { GLTFLoader } from "./GLTFLoader.js";

// Les matériaux du modèle (CC0, sans texture) portent des noms parlants : c'est
// ce qui permet aux cinq croupiers de partager UNE géométrie et de rester cinq
// personnes. La clé de gauche est le nom du matériau, celle de droite la
// variable de croupier.js — même palette que le SVG, donc mêmes gens.
const TEINTES = { Suit: "veste", Tie: "orne", White: "chemise", Skin: "peau", Hair: "cheveux", Eyebrows: "sourcil", Eye: "encre", Black: "veste" };
// Les 24 animations du lot sont surtout du combat et de la course. Quatre
// seulement ont un sens derrière une table ; le reste n'est jamais joué.
const CLIPS = { repos: /Idle_Neutral/i, salut: /\|Wave/i, geste: /\|Interact/i };

export async function monter({ hote, modele, palette, etat }) {
  const cv = document.createElement("canvas");
  cv.className = "cr3d"; cv.setAttribute("aria-hidden", "true");
  hote.appendChild(cv);

  const r = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
  r.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  r.outputColorSpace = T.SRGBColorSpace;
  const sc = new T.Scene();
  const cam = new T.PerspectiveCamera(26, 1, .05, 60);
  // Trois sources, comme une table de casino : une clé chaude en hauteur côté
  // joueur, un remplissage froid derrière, et l'ambiance du feutre par en bas.
  sc.add(new T.HemisphereLight(0xffe9c8, 0x16241d, 1.0));
  const cle = new T.DirectionalLight(0xfff2dc, 2.4); cle.position.set(1.6, 3, 2.6); sc.add(cle);
  const bord = new T.DirectionalLight(0x8fc9ff, .55); bord.position.set(-2.4, .8, -1.6); sc.add(bord);

  const g = await new GLTFLoader().loadAsync(modele);
  const o = g.scene; sc.add(o);
  const mixer = new T.AnimationMixer(o);
  const clip = n => g.animations.find(a => (CLIPS[n] || CLIPS.repos).test(a.name)) || g.animations[0];
  let action = mixer.clipAction(clip("repos")); action.play(); mixer.update(1.2);

  o.updateMatrixWorld(true);
  const os = {}; o.traverse(n => { if (n.isBone) os[n.name.replace(/^mixamorig:?/i, "")] = n; });
  const tete = os.Head || null, cou = os.Neck || null, buste = os.Chest || os.Torso || null;
  const pt = n => { const v = new T.Vector3(); (os[n] || o).getWorldPosition(v); return v; };

  // 🚨 L'ÉCHELLE SE PREND SUR LES OS, jamais sur la boîte englobante : celle d'un
  // maillage skinné est celle de la pose de LIAISON, pas de la pose jouée. Mesuré
  // le 07/09 : Box3 annonçait 0,69 de haut pour un personnage debout, la caméra
  // s'est retrouvée à cadrer les pieds. Hanches → tête, c'est 78 cm chez un adulte.
  const h = Math.max(.05, pt("Head").y - pt("Hips").y);
  o.scale.setScalar(.78 / h); o.updateMatrixWorld(true);
  o.position.sub(new T.Vector3(pt("Head").x, 0, pt("Head").z));
  o.updateMatrixWorld(true);
  const yT = pt("Head").y, yH = pt("Hips").y;
  // Cadrage BUSTE, caméra sans plongée : le bord bas coupe aux hanches, que le
  // rail de la table recouvre de toute façon. Une caméra inclinée pousse la tête
  // hors du cadre — c'est ce qui coupait le crâne aux premiers essais.
  // 🚨 CADRAGE TÊTE-ÉPAULES, pas buste entier. La fente ne fait que 104 px de haut
  // (mesuré le 07/09, 760 × 104 à 1100 px de large) et un corps humain réaliste a
  // une petite tête : cadré au buste, le visage tombait à 20 px et devenait une
  // tache. Le croupier DESSINÉ, lui, est une caricature dont la tête occupe la
  // moitié du cadre — c'est cette proportion-là qu'on retrouve, sinon les deux
  // moteurs ne montrent pas la même chose au même endroit.
  const HAUTEUR_VUE = .62;                       // hauteur du monde visible, en mètres
  const cy = yT - .07;                           // la tête en haut, les épaules dessous
  cam.position.set(0, cy, HAUTEUR_VUE / (2 * Math.tan(26 * Math.PI / 360)));
  cam.lookAt(0, cy, 0);

  const mats = [];
  o.traverse(n => { if (n.isMesh) (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => mats.push(m)); });
  const poser = pal => mats.forEach(m => {
    const c = pal[TEINTES[m.name]]; if (c) m.color = new T.Color(c);
    m.metalness = 0; m.roughness = /suit|tie/i.test(m.name) ? .62 : .9;
  });
  poser(palette || {});

  const dim = () => {
    const w = Math.max(1, hote.clientWidth), ht = Math.max(1, hote.clientHeight);
    r.setSize(w, ht, false); cam.aspect = w / ht; cam.updateProjectionMatrix();
  };
  dim();
  const ro = new ResizeObserver(dim); ro.observe(hote);

  // La boucle. `etat` est LU à chaque image, jamais recopié : croupier.js écrit
  // dedans quand il veut, on n'a aucun message à faire circuler.
  const qT = new T.Quaternion(), eT = new T.Euler();
  // 🚨 On garde le quaternion de REPOS de chaque os pilotable, et on repart de LUI
  // à chaque image. Multiplier « après le mixer » ne marche que pour les os que le
  // clip anime : ceux qu'il ne touche pas gardent la rotation de l'image d'avant et
  // l'accumulent. Mesuré le 07/09 — au bout de huit secondes le croupier était plié
  // en deux sur la table, tête en bas. Repos × écart ne peut pas dériver.
  const repos = new Map();
  [tete, cou, buste].forEach(b => { if (b) repos.set(b, b.quaternion.clone()); });
  const poserOs = (b, x, y, z) => { if (!b) return; eT.set(x, y, z); qT.setFromEuler(eT);
    b.quaternion.copy(repos.get(b)).multiply(qT); };
  let vivant = true, precedent = performance.now(), joue = "repos";
  const rad = d => d * Math.PI / 180;
  (function boucle(t) {
    if (!vivant) return;
    requestAnimationFrame(boucle);
    if (document.hidden) { precedent = t; return; }   // onglet caché : on ne brûle rien
    const dt = Math.min(.1, ((t || 0) - precedent) / 1000); precedent = t || precedent;
    // `etat.clip` vaut « repos », « salut » ou « geste » — c'est croupier.js qui
    // TRADUIT ses huit émotions en l'un des trois, pas ce module qui les devine.
    const veut = etat.clip || "repos";
    if (veut !== joue) {
      joue = veut;
      const suivante = mixer.clipAction(clip(veut));
      if (suivante !== action) { suivante.reset().play(); action.crossFadeTo(suivante, .35, false); action = suivante; }
    }
    mixer.update(dt);
    // 🚨 APRÈS le mixer, et par MULTIPLICATION. Le mixer réécrit le quaternion de
    // chaque os à chaque image : poser la valeur l'écraserait à la suivante, et
    // l'ajouter en rotateY l'accumulerait à l'infini. Multiplier une fois par
    // image compose le regard AVEC la respiration, sans dériver.
    const reg = etat.regard || 0, pen = etat.penche || 0;
    poserOs(tete, rad(pen * .5), rad(-reg * 2.2), rad(reg * .35));
    poserOs(cou, rad(pen * .25), rad(-reg * 1.1), 0);
    poserOs(buste, 0, rad(-reg * .5), 0);
    r.render(sc, cam);
  })(performance.now());

  return {
    poser,
    demonter() {
      vivant = false; ro.disconnect();
      sc.traverse(n => { if (n.isMesh) { n.geometry.dispose(); (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => m.dispose()); } });
      r.dispose(); cv.remove();
    },
  };
}
