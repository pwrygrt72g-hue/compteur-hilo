/* ══════════════════════ DONS — la caisse ══════════════════════
   Une page qui explique pourquoi WiseHand est gratuit, ce qu'il coûte
   vraiment, et à quoi sert un don. Elle ne compte rien, ne mesure rien,
   n'envoie rien : tout le fichier tient dans les vingt lignes ci-dessous.

   ⚠️ LE LIEN DE DON EST UNE CONSTANTE, ET IL DOIT LE RESTER.
   Il serait tentant de le mettre dans le panneau ⚙, à côté du relais TURN.
   Ce serait un contresens : ⚙ écrit dans DB, c'est-à-dire dans le
   localStorage DE CHAQUE VISITEUR. Un lien saisi là ne quitterait jamais le
   navigateur de celui qui l'a tapé — personne ne verrait jamais celui de Léo,
   et l'écran donnerait l'illusion parfaite de fonctionner. Le relais TURN est
   dans ⚙ pour la raison exactement INVERSE : ce sont les identifiants du
   visiteur, ils n'ont rien à faire dans le fichier qu'on publie.
   Ouvrir une cagnotte = écrire son adresse ICI, et reconstruire. */
// Vérifié le 07/09/2026 : le profil répond bien « Leo Lejeau » sur ordinateur
// ET sur téléphone. ⚠️ Un QR code PayPal n'est PAS un lien : celui de Léo
// (paypal.com/qrcodes/p2pqrc/…) redirige vers l'App Store, le Play Store ou une
// page « téléchargez l'appli » selon la machine — jamais vers un paiement. Il
// n'est lisible que par l'appareil photo de l'appli PayPal. Ne pas le remettre ici.
const DONS_LIEN = "https://www.paypal.com/paypalme/leolejeau";

// Deux états écrits en clair dans corps.html, on en cache un.
// Sans cagnotte, la page ne montre PAS un bouton grisé (elle passerait pour
// cassée) ni un « bientôt » (elle passerait pour une campagne) : elle le dit
// en toutes lettres, et le reste de la page ne bouge pas d'une ligne.
{
  // https:// exigé — un lien de paiement en clair, ou une coquille du genre
  // « kofi.com/… » sans schéma, deviendrait une URL relative à l'application.
  const ouvert = /^https:\/\/\S+$/.test(DONS_LIEN);
  if (ouvert) $("donsLien").href = DONS_LIEN;
  $("donsAvec").hidden = !ouvert;
  $("donsSans").hidden = ouvert;
  // La seule façon d'aider qui ne coûte rien, et celle dont le mode à plusieurs
  // a le plus besoin : on y va d'un clic, pas en retournant chercher le hall.
  $("donsAmis").onclick = () => aller("ensemble");
}

/* ══════════════════════ LA QUÊTE — la fenêtre d'arrivée ══════════════════════
   Léo, 07/09/2026 : « dès qu'une personne arrive sur le site, ma photo avec ce que je
   t'ai dit doit apparaître ». C'est la seule chose de toute l'application qui réclame
   quelque chose sans qu'on l'ait cherché — elle est donc bornée par quatre règles, et
   chacune répare un travers connu des fenêtres de ce genre.

   1. UNE FOIS PAR VISITEUR (DB.quete). Une demande qu'on referme tous les jours cesse
      d'être une blague et devient une bannière : on la ferme sans lire, puis on ferme
      le site. Le numéro de version permet de la remontrer si le message change VRAIMENT
      — pas à chaque déploiement.
   2. JAMAIS SUR UNE INVITATION. Arriver par #table=CODE, c'est être attendu par un ami :
      commencer par une demande d'argent est le pire premier écran possible.
   3. JAMAIS PAR-DESSUS UNE PARTIE. On ne s'ouvre que sur l'accueil.
   4. TROIS SORTIES (croix, « une autre fois », Échap) pour UNE entrée. Le clignotement du
      bouton est demandé ; l'enfermement, non.

   ⚠️ Sans cagnotte ouverte, la fenêtre ne s'affiche PAS DU TOUT. Une demande de don qui
   ne mène nulle part est une publicité pour rien. */
const QUETE_VERSION = 1;
{
  const boite = $("quete");
  // Sortir la fenêtre de l'écran, sans rien DÉCIDER. Rend `true` si elle était ouverte.
  const ranger = () => {
    if (!boite || boite.hidden) return false;
    boite.hidden = true;
    document.removeEventListener("keydown", auClavier);
    return true;
  };
  // La ✕ et Échap sont des REFUS explicites : on retient la décision, on ne redemande plus.
  const fermer = () => { if (ranger()) { DB.quete = QUETE_VERSION; garder(); } };
  /* 🚨 QUITTER L'ACCUEIL N'EST PAS UN REFUS. Posé le 07/09 : `ouvrirQuete` ne teste
     `vue !== "accueil"` qu'à l'OUVERTURE, et rien ne refermait ensuite. Un visiteur qui
     entrait en salle dans les 900 ms suivant le chargement (demarrage.js) jouait donc
     derrière un voile plein écran en `backdrop-filter:blur(3px)` — mesuré : #queteDon
     repeint une fois par image pendant toute la donne. C'était l'exact contraire de
     l'intention écrite deux lignes plus haut (« jamais par-dessus une partie »), et c'est
     très probablement une part du « ça lag » de Léo.
     On RANGE sans marquer la quête vue : quelqu'un qui n'a pas eu le temps de lire n'a rien
     refusé, la fenêtre se représentera à sa prochaine visite. Idempotent — `aller()` appelle
     à chaque changement d'écran, y compris quand la fenêtre n'a jamais été ouverte. */
  window.fermerQuete = ranger;
  const auClavier = e => { if (e.key === "Escape") fermer(); };

  // ⚠️ La photo n'est PAS posée par rendreHall() : celle-ci ne parcourt les [data-photo]
  // qu'une fois, au démarrage, et une image de 108 Ko chargée pour une fenêtre que la
  // plupart des visiteurs ont déjà refusée est du poids pour rien. On la pose donc au
  // moment de montrer, et seulement à ce moment-là.
  const poserPhoto = () => {
    const img = boite && boite.querySelector(".quete-photo .photo");
    if (!img || img.getAttribute("src")) return;
    const grande = photoDe("leo"), petite = photoPetiteDe("leo");
    if (!grande) { const c = boite.querySelector(".quete-photo"); if (c) c.remove(); return; }
    if (petite) img.setAttribute("srcset", `${petite} 360w, ${grande} 720w`);
    img.src = grande;
  };

  window.ouvrirQuete = function (force) {
    if (!boite) return false;
    // Sans lien de don, rien à demander. `donsAvec` porte déjà le verdict : il n'est
    // visible que si DONS_LIEN est une vraie URL — on ne réévalue pas la règle ici,
    // deux copies finiraient par diverger.
    if ($("donsAvec") && $("donsAvec").hidden) return false;
    if (!force) {
      if (DB.quete >= QUETE_VERSION) return false;           // déjà vue
      if (location.hash && location.hash.length > 1) return false;  // invitation, course…
      if (vue !== "accueil") return false;                    // jamais par-dessus une partie
    }
    poserPhoto();
    $("queteDon").href = $("donsLien").href;
    boite.hidden = false;
    document.addEventListener("keydown", auClavier);
    // Le focus va sur la SORTIE, pas sur le don : on ne piège pas la touche Entrée
    // de quelqu'un qui tapait autre chose au moment où la fenêtre s'est ouverte.
    try { $("queteFermer").focus({ preventScroll: true }); } catch (e) { /* vieux navigateur */ }
    return true;
  };

  if (boite) {
    $("queteFermer").onclick = fermer;
    $("queteNon").onclick = fermer;
    // Donner referme AUSSI : au retour de PayPal, retrouver la demande encore ouverte
    // donnerait l'impression que le don n'a pas compté.
    $("queteDon").onclick = () => { DB.quete = QUETE_VERSION; garder(); setTimeout(fermer, 60); };
    $("queteEnSavoir").onclick = () => { fermer(); aller("dons"); };
    // Le fond referme, la boîte non — sinon un clic dans le texte ferme la fenêtre.
    boite.onclick = e => { if (e.target === boite) fermer(); };
  }
}
