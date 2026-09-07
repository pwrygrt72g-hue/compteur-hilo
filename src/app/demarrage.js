/* ══════════════════════ DÉMARRAGE ══════════════════════ */
appliquerTheme(); rendreSon(); rendreSysteme(); mesurerEntete(); rendreReponses(); rendreEventail(); ongletEx("defilement");
$("eVitesse").dispatchEvent(new Event("input")); $("coVitesse").dispatchEvent(new Event("input"));
$("plateau").style.setProperty("--intervalle", vitesse() + "ms");
nouveauSabot();
// Le hall : photos sur les portes, crédits, salut — puis on y entre, sauf si un lien
// (#table=CODE, #course=CODE, traités plus haut) a déjà emmené ailleurs.
rendreHall(); if (vue === "accueil") aller("accueil");
// La fenêtre de dons, en DERNIER et après un souffle : elle ne doit jamais recouvrir un
// hall encore en train de se peindre — on verrait la demande avant l'application, ce qui
// est exactement l'inverse de ce qu'on veut faire lire. Elle décide seule si elle
// s'affiche (déjà vue, invitation en cours, pas de cagnotte : elle se tait).
setTimeout(() => { try { window.ouvrirQuete && window.ouvrirQuete(); } catch (e) { /* jamais au prix du démarrage */ } }, 900);
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));

/* ══════════════════════ COMPTER LES VISITES ══════════════════════
   Léo, 07/09/2026 : « je voudrais savoir si je peux savoir si des gens sont dessus ».
   GitHub Pages ne donne AUCUNE statistique : il faut un tiers, ou rien.

   GoatCounter est le moins invasif qui existe : libre, hébergé en Europe, SANS COOKIE,
   sans identifiant persistant, sans profil publicitaire. Il compte une visite par
   chargement de page — c'est tout ce qu'on lui demande, et c'est tout ce qu'on prend.

   🚨 CE QU'IL FAUT DIRE, ET QUI EST ÉCRIT SUR LA PAGE « SOUTENIR » : ce n'est plus
   « rien ne sort ». Le navigateur envoie l'adresse de la page, la page d'où l'on vient,
   la taille de l'écran et le navigateur ; GoatCounter en dérive un pays et une empreinte
   du jour, et NE CONSERVE PAS l'adresse IP. La progression, les sessions, les réglages,
   eux, ne bougent toujours pas d'ici. Un compteur qui se cache est un mouchard ; un
   compteur qui s'annonce est un compteur.

   ⚠️ TROIS PORTES, et chacune ferme pour une raison différente :
   1. `SUIVI_CODE` vide → rien n'est chargé du tout. C'est l'état livré : Léo colle son
      code quand son compte existe, et personne n'a été compté d'ici là.
   2. `window.PHOTOS_PETIT` n'existe que dans la version « pages ». Dans un Artifact, la
      politique de sécurité coupe la requête SANS erreur visible — on n'essaie donc même
      pas, plutôt que de laisser une balise morte dans la page.
   3. « Ne pas me pister » du navigateur (doNotTrack, ou Global Privacy Control) : on
      n'insiste pas. Quelqu'un qui a pris la peine de cocher cette case a répondu.
   ⚠️ Chargé APRÈS le premier rendu et en `async` : un compteur ne doit jamais retarder
   l'affichage de ce qu'il compte. */
const SUIVI_CODE = "wisehand21";   // tableau de bord : https://wisehand21.goatcounter.com
// ⚠️ Les sondes du dépôt servent la page depuis 127.0.0.1 : GoatCounter IGNORE lui-même
// localhost et 127.0.0.1 (comportement documenté), donc ni le banc ni la sonde ne
// gonflent les chiffres de Léo — c'est vérifié en lisant leur script, pas supposé.
{
  const refuse = navigator.doNotTrack === "1" || window.doNotTrack === "1"
    || navigator.msDoNotTrack === "1" || navigator.globalPrivacyControl === true;
  // La phrase de la page « Soutenir » n'apparaît QUE si le compteur tourne vraiment :
  // affichée avec un compteur éteint, elle annoncerait une collecte qui n'a pas lieu.
  // ⚠️ Elle s'affiche même si le visiteur a refusé le pistage : ce qui est décrit reste
  // ce que fait le site, et « il n'est même pas chargé » est justement ce qu'elle promet.
  if (SUIVI_CODE && window.PHOTOS_PETIT && $("donsCompteur")) $("donsCompteur").hidden = false;
  if (SUIVI_CODE && window.PHOTOS_PETIT && !refuse) {
    window.addEventListener("load", () => setTimeout(() => {
      try {
        const s = document.createElement("script");
        s.async = true; s.src = "https://gc.zgo.at/count.js";
        s.setAttribute("data-goatcounter", `https://${SUIVI_CODE}.goatcounter.com/count`);
        document.head.appendChild(s);
      } catch (e) { /* un compteur ne fait jamais tomber l'application */ }
    }, 1200));
  }
}
