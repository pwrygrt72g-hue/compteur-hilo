/* ══════════════════════ LA CAMÉRA ══════════════════════
   Léo, 07/09 : « le fond aussi doit bouger comme une caméra FPV ». Ce module ne
   fait QUE ça : il fait respirer les deux fonds photographiques du jeu — la salle
   derrière le croupier et la photo du hall — comme si la tête du joueur bougeait.

   Deux mouvements qui s'additionnent, et un seul est ici :
   · la DÉRIVE, une ondulation lente et continue, écrite en CSS (@keyframes camera)
     — elle tourne toute seule, sans une ligne de JS, même quand la souris dort ;
   · le REGARD, qui suit le pointeur. C'est la partie qui a besoin de JS.

   🚨 UNE SEULE ÉCRITURE PAR IMAGE. `pointermove` tire jusqu'à 1000 fois par
   seconde sur un trackpad Apple : écrire une variable CSS à chaque événement
   ferait recalculer le style 16 fois par image pour un seul rendu. On ne fait que
   MÉMORISER la cible dans l'écouteur, et une boucle rAF écrit — au plus une fois
   par image, et seulement si ça a bougé.

   🚨 ET ELLE GLISSE, elle ne saute pas. La cible est rejointe par interpolation
   (12 % de l'écart par image) : c'est ce lissage qui donne l'inertie d'une caméra
   portée. Poser la valeur brute donnerait un fond qui colle au curseur — le
   contraire d'une caméra.

   ⚠️ Rien ici ne touche à la MISE EN PAGE : on n'écrit que `--camx`/`--camy`, que
   le CSS consomme dans un `translate`. Le compositeur fait tout, le fil principal
   ne repeint rien.
   ⚠️ `prefers-reduced-motion` coupe TOUT : la boucle ne démarre même pas, et la
   dérive CSS est éteinte de son côté. Un fond qui bouge sans arrêt donne mal au
   cœur à qui a désactivé les animations — ce n'est pas une préférence décorative. */
{
  const doux = matchMedia("(prefers-reduced-motion: reduce)");
  // Le tactile n'a pas de pointeur qui survole : la dérive CSS suffit, et une
  // boucle rAF permanente sur un téléphone, c'est de la batterie pour rien.
  const survol = matchMedia("(hover: hover) and (pointer: fine)");
  let boucle = 0, vx = 0, vy = 0, cx = 0, cy = 0;

  const image = () => {
    // On s'arrête dès que le mouvement est fini : pas de rAF qui tourne dans le vide.
    const dx = cx - vx, dy = cy - vy;
    if (Math.abs(dx) < .0006 && Math.abs(dy) < .0006) { vx = cx; vy = cy; boucle = 0; }
    else { vx += dx * .12; vy += dy * .12; boucle = requestAnimationFrame(image); }
    // 🚨 UN NOMBRE NU, jamais une unité. Le CSS fait `calc(var(--camx) * var(--cam-amp))`
    // où --cam-amp est un pourcentage : nombre × pourcentage est valide, pourcentage ×
    // pourcentage ne l'est PAS — et une image clé invalide fait tomber TOUTE l'animation,
    // en silence. Écrit en « % » d'abord, la caméra ne bougeait pas d'un pixel (vérifié
    // le 07/09 : translate restait à `none` pendant que --camx allait de -95 à +95).
    const r = document.documentElement.style;
    r.setProperty("--camx", vx.toFixed(4));
    r.setProperty("--camy", vy.toFixed(4));
  };
  const bouger = e => {
    // −1 … +1 depuis le centre de la fenêtre, puis l'amplitude est au CSS (--cam-amp).
    cx = (e.clientX / innerWidth - .5) * 2;
    cy = (e.clientY / innerHeight - .5) * 2;
    if (!boucle) boucle = requestAnimationFrame(image);
  };
  const partir = () => { cx = 0; cy = 0; if (!boucle) boucle = requestAnimationFrame(image); };

  const brancher = () => {
    if (doux.matches || !survol.matches) return;
    // `passive` : on ne fait que lire l'événement, jamais l'annuler — sans ce mot
    // le navigateur doit attendre notre retour avant de composer l'image suivante.
    addEventListener("pointermove", bouger, { passive: true });
    document.addEventListener("pointerleave", partir);
  };
  const debrancher = () => {
    removeEventListener("pointermove", bouger);
    document.removeEventListener("pointerleave", partir);
    if (boucle) cancelAnimationFrame(boucle);
    boucle = 0; cx = cy = vx = vy = 0;
    document.documentElement.style.setProperty("--camx", "0");
    document.documentElement.style.setProperty("--camy", "0");
  };
  brancher();
  // Quelqu'un peut activer « réduire les animations » sans recharger la page.
  doux.addEventListener("change", () => doux.matches ? debrancher() : brancher());
}
