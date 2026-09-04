// Mélange prouvable : graine -> flux HMAC-SHA-256 en compteur -> entiers non biaisés -> Fisher-Yates.
// Tout via Web Crypto, donc identique dans le navigateur et dans Node.
const enc = new TextEncoder();
export const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
export const unhex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
export async function sha256(bytes) { return hex(await crypto.subtle.digest("SHA-256", bytes)); }

// Flux déterministe : HMAC(graine, compteur) -> 32 octets par bloc.
async function stream(seedBytes) {
  const key = await crypto.subtle.importKey("raw", seedBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  let ctr = 0, buf = new Uint8Array(0), pos = 0;
  return async function next4() {
    if (pos + 4 > buf.length) {
      const c = new Uint8Array(8);
      new DataView(c.buffer).setBigUint64(0, BigInt(ctr++));
      buf = new Uint8Array(await crypto.subtle.sign("HMAC", key, c));
      pos = 0;
    }
    const v = new DataView(buf.buffer, buf.byteOffset + pos, 4).getUint32(0);
    pos += 4;
    return v;
  };
}
// Entier uniforme dans [0,n) par rejet : aucun biais modulo.
async function below(next4, n) {
  const max = Math.floor(0x100000000 / n) * n;
  let v;
  do { v = await next4(); } while (v >= max);
  return v % n;
}
export async function shuffle(items, seedBytes) {
  const next4 = await stream(seedBytes);
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = await below(next4, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export const randomSeed = () => crypto.getRandomValues(new Uint8Array(32));
// Engagement : on publie l'empreinte AVANT, on révèle la graine APRÈS.
export const commit = seed => sha256(seed);
// Multijoueur : la graine finale est le SHA-256 de la concaténation des graines de tous les joueurs, triées.
export async function combine(seeds) {
  const sorted = seeds.map(hex).sort();
  return unhex(await sha256(enc.encode(sorted.join("|"))));
}
