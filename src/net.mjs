// Transport multijoueur : MQTT 3.1.1 sur WebSocket, écrit à la main, SANS AUCUNE DÉPENDANCE.
// Pourquoi pas une bibliothèque : la seule voie sérieuse sans serveur pesait 420 Ko répartis
// sur trois modules de CDN, pour un jeu au tour par tour où cent millisecondes ne changent rien.
// Ici, tout tient en une page, et il n'y a rien qui puisse être déprécié sous nos pieds.
// Vérifié le 4 septembre 2026 : trois courtiers publics acceptent la poignée de main
// depuis une page GitHub Pages, et trois pairs se voient et reçoivent les cartes dans l'ordre.

const enc = new TextEncoder(), dec = new TextDecoder();
const s2 = s => { const b = enc.encode(s); return [b.length >> 8, b.length & 255, ...b]; };
function pkt(type, flags, p) {
  const h = [type << 4 | flags];
  let n = p.length;
  do { let d = n % 128; n = Math.floor(n / 128); h.push(d | (n > 0 ? 128 : 0)); } while (n > 0);
  return new Uint8Array([...h, ...p]);
}

export const COURTIERS = [
  "wss://broker.emqx.io:8084/mqtt",
  "wss://broker.hivemq.com:8884/mqtt",
  "wss://test.mosquitto.org:8081/mqtt",
];

export function connecter(url, { clientId, onMessage, onOpen, onClose, onError } = {}) {
  let ws;
  try { ws = new WebSocket(url, "mqtt"); } catch (e) { onError && onError(e); return null; }
  ws.binaryType = "arraybuffer";
  let pid = 1, vivant = false, ping = null, buf = new Uint8Array(0), fini = false;
  const api = {
    souscrire(t) { if (vivant) ws.send(pkt(8, 2, [pid >> 8, pid++ & 255, ...s2(t), 0])); },
    publier(t, m) { if (vivant) ws.send(pkt(3, 0, [...s2(t), ...enc.encode(m)])); },
    fermer() { fini = true; clearInterval(ping); try { ws.close(); } catch (e) {} },
    get vivant() { return vivant; },
  };
  const minuteur = setTimeout(() => { if (!vivant) { api.fermer(); onError && onError(new Error("délai dépassé")); } }, 9000);
  ws.onopen = () => ws.send(pkt(1, 0, [...s2("MQTT"), 4, 2, 0, 60, ...s2(clientId)]));
  ws.onmessage = e => {
    const inc = new Uint8Array(e.data), all = new Uint8Array(buf.length + inc.length);
    all.set(buf); all.set(inc, buf.length); buf = all;
    let i = 0;
    while (i < buf.length) {
      let m = 1, len = 0, j = i + 1, d, garde = 0;
      do { if (j >= buf.length) { buf = buf.slice(i); return; } d = buf[j++]; len += (d & 127) * m; m *= 128; } while ((d & 128) && ++garde < 4);
      if (j + len > buf.length) break;
      const type = buf[i] >> 4, body = buf.slice(j, j + len); i = j + len;
      if (type === 2) {
        clearTimeout(minuteur);
        if (body[1] !== 0) { onError && onError(new Error("refus du courtier " + body[1])); api.fermer(); return; }
        vivant = true;
        ping = setInterval(() => { try { ws.send(pkt(12, 0, [])); } catch (e) {} }, 25000);
        onOpen && onOpen(api);
      } else if (type === 3) {
        const tl = (body[0] << 8) | body[1];
        onMessage && onMessage(dec.decode(body.slice(2, 2 + tl)), dec.decode(body.slice(2 + tl)));
      }
    }
    buf = buf.slice(i);
  };
  ws.onclose = () => { vivant = false; clearInterval(ping); clearTimeout(minuteur); if (!fini) onClose && onClose(); };
  ws.onerror = () => {};
  return api;
}

// Essaie les courtiers l'un après l'autre. Aucun ne répond : on le DIT, on ne tourne pas dans le vide.
export function connecterAvecRepli(opts, i = 0) {
  return new Promise((res, rej) => {
    if (i >= COURTIERS.length) return rej(new Error("aucun courtier joignable"));
    const c = connecter(COURTIERS[i], Object.assign({}, opts, {
      onOpen: api => res({ api, url: COURTIERS[i] }),
      onError: () => connecterAvecRepli(opts, i + 1).then(res, rej),
    }));
    if (!c) connecterAvecRepli(opts, i + 1).then(res, rej);
  });
}

// Un code de salon lisible au téléphone : pas de 0/O, pas de 1/I.
const ALPHA = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function codeSalon() {
  const a = new Uint8Array(5); crypto.getRandomValues(a);
  return [...a].map(x => ALPHA[x % ALPHA.length]).join("");
}
export const sujet = code => `compteur-hilo/v1/${code}`;
