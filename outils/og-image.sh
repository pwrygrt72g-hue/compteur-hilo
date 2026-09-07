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

magick static/photos/cartes.webp \
  -resize 1200x630^ -gravity center -extent 1200x630 -modulate 100,78,100 \
  "$TMP/voile.png" -compose over -composite \
  -font "$SERIF" -pointsize 88 -fill '#F6F2E8' -gravity northwest \
    -annotate +80+132 'Compter les cartes,' \
    -annotate +80+230 'pour de vrai.' \
  -font "$SANS" -pointsize 28 -fill '#C6CAC4' \
    -annotate +84+376 'Dix tables de casino. Avantage maison mesuré, pas recopié.' \
    -annotate +84+418 'Gratuit, sans compte, sans argent réel.' \
  -font "$BOLD" -pointsize 25 -fill '#E0BC63' \
    -annotate +84+498 'WISEHAND21.COM' \
  -quality 88 -sampling-factor 4:2:0 -strip \
  static/og.jpg

magick identify -format 'static/og.jpg : %wx%h · %[size] octets · %m\n' static/og.jpg
