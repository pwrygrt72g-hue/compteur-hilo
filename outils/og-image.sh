#!/bin/bash
# Fabrique static/og.jpg — l'image d'aperçu des partages (Open Graph / Twitter card).
#
# POURQUOI UN SCRIPT ET PAS UN FICHIER POSÉ À LA MAIN : l'image porte l'adresse du site
# et deux phrases de promesse. Le jour où l'une des deux change, une image figée ment
# sans que personne ne la relise — on ne regarde jamais sa propre carte de partage.
#
# POURQUOI DU JPEG ET PAS DU WEBP : le dépôt est en WebP partout, mais le scraper de
# LinkedIn ne le lit pas de façon fiable (vérifié le 07/09/2026) — l'aperçu sort alors
# SANS image, et rien ne le signale. Facebook, X et WhatsApp acceptent le WebP ; LinkedIn
# est justement le réseau où un lien de ce genre se partage. Le JPEG passe partout.
# Mesuré : 1200x630, ~112 Ko (plafond Facebook : 8 Mo).
#
# POURQUOI CETTE PHOTO-LÀ : static/photos/cartes.webp est sous licence Unsplash — ni
# attribution obligatoire, ni partage à l'identique. Une photo CC BY-SA ferait de cette
# image une œuvre dérivée à repartager sous CC BY-SA : une carte de partage n'est pas
# l'endroit où porter cette obligation. NE PAS remplacer la source sans revérifier
# static/photos/credits.json.
set -euo pipefail
cd "$(dirname "$0")/.."

SERIF="/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
SANS="/System/Library/Fonts/Supplemental/Arial.ttf"
BOLD="/System/Library/Fonts/Supplemental/Arial Bold.ttf"

# ⚠️ ImageMagick sort en CODE 0 quand une police est introuvable : il se contente d'un
# avertissement et rend le texte dans une fonte par défaut. Une image muette et fausse
# serait donc produite « avec succès ». On vérifie donc les fichiers nous-mêmes.
# (Georgia.ttf « régulier » N'EXISTE PAS sur macOS : seuls Bold, Italic et Bold Italic.)
for f in "$SERIF" "$SANS" "$BOLD"; do
  [ -f "$f" ] || { echo "police introuvable : $f" >&2; exit 1; }
done
[ -f static/photos/cartes.webp ] || { echo "static/photos/cartes.webp manquant" >&2; exit 1; }

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# Le voile : un aplat encre dont l'ALPHA suit un dégradé lisse. Un `gradient:` avec
# transparence directe se poserait en bandes visibles (constaté) — d'où le masque en
# niveaux de gris passé en CopyOpacity.
magick -size 630x1200 gradient:'gray94-gray28' -rotate -90 "$TMP/masque.png"
magick -size 1200x630 xc:'#070D0C' "$TMP/masque.png" -alpha off -compose CopyOpacity -composite "$TMP/voile.png"

# 🚨 DEUX IMAGES, UNE PAR LANGUE (07/09/2026). La page anglaise n'en déclarait AUCUNE :
# tout partage de /en/blackjack/ sortait sans aperçu, et rien ne le signalait. Lui donner
# l'image française aurait mis « Compter les cartes, pour de vrai » sur un lien anglais —
# une carte de partage qui parle une autre langue que la page se lit comme une erreur.
# Le gabarit est le même ; seules les trois lignes de texte changent.
carte() {   # carte <sortie> <titre1> <titre2> <ligne1> <ligne2>
  magick static/photos/cartes.webp \
    -resize 1200x630^ -gravity center -extent 1200x630 -modulate 100,78,100 \
    "$TMP/voile.png" -compose over -composite \
    -font "$SERIF" -pointsize 88 -fill '#F6F2E8' -gravity northwest \
      -annotate +80+132 "$2" \
      -annotate +80+230 "$3" \
    -font "$SANS" -pointsize 28 -fill '#C6CAC4' \
      -annotate +84+376 "$4" \
      -annotate +84+418 "$5" \
    -font "$BOLD" -pointsize 25 -fill '#E0BC63' \
      -annotate +84+498 'WISEHAND21.COM' \
    -quality 88 -sampling-factor 4:2:0 -strip \
    "$1"
  magick identify -format "$1 : %wx%h · %[size] octets · %m\n" "$1"
}

carte static/og.jpg \
  'Compter les cartes,' 'pour de vrai.' \
  'Dix tables de casino. Avantage maison mesuré, pas recopié.' \
  'Gratuit, sans compte, sans argent réel.'

# ⚠️ Le titre anglais tient en deux lignes de la MÊME longueur visuelle que le français,
# sinon il déborde du voile : 'Count cards, for real.' mesuré à 88 pt tient largement.
carte static/og-en.jpg \
  'Count cards,' 'for real.' \
  'Ten casino tables. House edge measured, not copied.' \
  'Free, no account, no real money.'
