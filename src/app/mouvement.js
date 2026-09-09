/* ── L'ONDE AU CLIC ──────────────────────────────────────────────────────
   « Léo 08/09/2026 : plus d'animation lors des clics. »

   Un seul écouteur, délégué, en phase de capture, sur `pointerdown` — pas sur
   `click` : l'onde doit partir à l'ENFONCEMENT, pas au relâchement. C'est toute
   la différence entre un objet qui répond et un objet qui confirme. Sur un
   téléphone, `click` arrive après la levée du doigt : l'écart se sent.

   Ce que ce fichier NE fait pas, et pourquoi :
   · aucun écouteur de défilement — tout le mouvement au défilement est en CSS pur
     (voir « LE MOUVEMENT » dans style.css). Rien ne s'exécute pendant qu'on glisse ;
   · aucune boucle, aucun élément créé : la classe `.onde` porte un `::after` qui
     s'anime tout seul et qu'on retire à la fin. Rien ne peut s'accumuler ;
   · rien sur les cartes à jouer ni sur les jetons : la table a sa propre grammaire
     de mouvement, réglée au millième, et une onde par-dessus la brouillerait.

   ⚠️ Le porteur reçoit `position:relative; overflow:hidden` par la classe. Tous les
   objets de cette liste sont des boutons fermés : rien n'en dépasse. Ne pas y ajouter
   un conteneur dont un enfant sort du cadre (un menu, une infobulle) — il serait coupé. */
const ONDE_CIBLES = ".btn, .rang, .tuile-col, #filtreSalon button, .salle-carte, .grand-bouton";

addEventListener("pointerdown", e => {
  // Bouton principal seulement : un clic droit ouvre un menu, il ne « presse » rien.
  if (e.button) return;
  if (matchMedia("(prefers-reduced-motion:reduce)").matches) return;
  const c = e.target.closest && e.target.closest(ONDE_CIBLES);
  if (!c || c.disabled || c.classList.contains("onde")) return;
  const r = c.getBoundingClientRect();
  if (!r.width) return;
  // Le disque doit couvrir le coin le PLUS ÉLOIGNÉ du point d'impact, sinon l'onde
  // s'arrête au milieu d'un bouton large et ressemble à un défaut d'affichage.
  const x = e.clientX - r.left, y = e.clientY - r.top;
  const d = 2 * Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y));
  c.style.setProperty("--ox", x + "px");
  c.style.setProperty("--oy", y + "px");
  c.style.setProperty("--od", d + "px");
  c.classList.add("onde");
  // `animationend` peut ne jamais venir (onglet caché au mauvais moment, animation
  // coupée par un changement de thème) : le repli au temps garantit que la classe
  // — et avec elle `overflow:hidden` — ne reste jamais posée.
  let fini = false;
  const oter = () => { if (fini) return; fini = true; c.classList.remove("onde"); };
  c.addEventListener("animationend", oter, { once: true });
  setTimeout(oter, 700);
}, true);
