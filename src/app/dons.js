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
