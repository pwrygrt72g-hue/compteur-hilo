/* ══════════════════════ DÉMARRAGE ══════════════════════ */
appliquerTheme(); rendreSon(); rendreSysteme(); mesurerEntete(); rendreReponses(); rendreEventail(); ongletEx("defilement");
$("eVitesse").dispatchEvent(new Event("input")); $("coVitesse").dispatchEvent(new Event("input"));
$("plateau").style.setProperty("--intervalle", vitesse() + "ms");
nouveauSabot();
// Le hall : photos sur les portes, crédits, salut — puis on y entre, sauf si un lien
// (#table=CODE, #course=CODE, traités plus haut) a déjà emmené ailleurs.
rendreHall(); if (vue === "accueil") aller("accueil");
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
