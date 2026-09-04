/* ══════════════════════ DÉMARRAGE ══════════════════════ */
appliquerTheme(); rendreSon(); rendreSysteme(); mesurerEntete(); rendreReponses(); rendreEventail(); ongletEx("defilement");
$("eVitesse").dispatchEvent(new Event("input")); $("coVitesse").dispatchEvent(new Event("input"));
$("plateau").style.setProperty("--intervalle", vitesse() + "ms");
nouveauSabot();
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
