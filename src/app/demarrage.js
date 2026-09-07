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
