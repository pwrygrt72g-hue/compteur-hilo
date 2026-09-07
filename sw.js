// Le service worker de WiseHand : ce qu'il faut pour que l'application s'ouvre dans l'avion.
//
// Le nom du cache PORTE LA VERSION. Le monter est ce qui purge l'ancien (voir « activate ») :
// une retouche de cette liste sans montée de version ne changerait rien chez ceux qui ont
// déjà installé l'application, et personne ne le verrait.
const C = "wisehand-v8";

// La coquille : le document, le manifeste, les icônes.
const COQUILLE = ["./", "./index.html", "./manifest.json", "./icon.svg", "./icon-192.png", "./icon-512.png", "./icon-180.png"];

// Les photos du hall, en version RÉDUITE (640 px, 642 Ko en tout). Le hall en affiche
// dix-huit — les dix tables, le héros, et les sept portes des salles (mesuré le 07/09 :
// toutes les dix-huit sont bien téléchargées, pas quatorze). Sans elles, qui installe
// l'application puis la rouvre hors ligne trouve un hall de rectangles noirs, alors que
// le README lui a promis qu'elle marchait sans réseau.
//
// Les PLEINS formats ne sont pas précachés : 2,5 Mo à l'installation pour des photos que
// le srcset ne demande que sur un écran Retina. Elles arrivent par le cache d'exécution
// (voir « fetch ») dès la première visite en ligne.
//
// ⚠️ Cette liste est VÉRIFIÉE À LA CONSTRUCTION contre static/photos/credits.json
// (build.mjs, section Photos) : ajouter une photo sans l'inscrire ici, ou renommer un
// fichier, fait échouer `node build.mjs`. Elle ne peut pas dériver en silence.
const PHOTOS = [
  "aquarium", "boulevard", "cartes", "cercle", "concentration", "cotai", "entrainement",
  "frontdemer", "hall", "jetons", "leo", "macao", "mainchaude", "marina", "neon",
  "prive", "reno",
  "salonprive", "strategie",
].map(n => `./static/photos/${n}-petit.webp`);

const A = COQUILLE.concat(PHOTOS);

// `addAll` échoue EN BLOC : une seule URL qui rate et RIEN n'est mis en cache. L'installation
// se déclarerait réussie sur un cache vide, et le premier vol le découvrirait. On ajoute donc
// chaque ressource séparément — un raté ne coûte que la sienne.
self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(C);
    await Promise.all(A.map(u => c.add(u).catch(err => console.warn("[sw] pas mis en cache :", u, err))));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
// Réseau d'abord : une mise à jour poussée en ligne arrive tout de suite.
// Hors ligne, on ressert le cache.
//
// Tout ce qui passe par ici est AUSSI gardé — les photos en plein format, et les polices
// Google (la feuille et ses .woff2, dont les URL sont inconnaissables à la construction).
// C'est ce cache d'exécution qui rend la deuxième visite complète hors ligne.
//
// ⚠️ `fetch` NE REJETTE PAS sur une erreur du serveur : un 503 est une réponse comme une
// autre, qui résout. Sans le test ci-dessous, une panne d'hébergeur de trente secondes
// suffisait à ÉCRASER la page en cache par sa page d'erreur — et l'application restait
// cassée hors ligne, longtemps après le retour du serveur. On ne garde donc que ce qui
// est `ok`, plus les réponses opaques (les polices Google : cross-origin, statut 0, elles
// ne sont pas lisibles mais elles sont servables telles quelles).
const gardable = r => r && (r.ok || r.type === "opaque");
// « static/photos/hall.webp » → « static/photos/hall-petit.webp ». Rien pour tout le reste.
const reduite = url => {
  const m = /^(.*\/static\/photos\/[^/]+?)\.webp$/.exec(url);
  return m && !m[1].endsWith("-petit") ? m[1] + "-petit.webp" : null;
};
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith((async () => {
    try {
      const r = await fetch(e.request);
      if (gardable(r)) {
        const cp = r.clone();
        caches.open(C).then(c => c.put(e.request, cp)).catch(() => {});
        return r;
      }
      // Le serveur a répondu, mal. Ce qu'on a en cache vaut mieux que sa page d'erreur.
      return (await caches.match(e.request)) || r;
    } catch (err) {
      // Vraiment hors ligne.
      const gardee = await caches.match(e.request);
      if (gardee) return gardee;
      // Une photo en PLEIN FORMAT n'est pas précachée (2,5 Mo à l'installation, pour des
      // fichiers que seul un écran Retina demande) : on sert sa version RÉDUITE plutôt que
      // rien. Sans ça, hors ligne, le héros du hall et la bannière « Jouer à plusieurs »
      // restaient deux rectangles noirs — les deux plus grandes surfaces de la page, et
      // les seules que le srcset envoie chercher en 1600 px. Un peu moins net vaut mieux
      // que vide : c'est ce que « ça marche dans l'avion » veut dire.
      const petite = reduite(e.request.url);
      if (petite) { const p = await caches.match(petite); if (p) return p; }
      // Dernier recours : le document, mais SEULEMENT pour une navigation. Le rendre en
      // réponse à une image ou à un script ferait décoder du HTML comme une photo.
      if (e.request.mode === "navigate") return caches.match("./index.html");
      return new Response("", { status: 504, statusText: "hors ligne" });
    }
  })());
});
