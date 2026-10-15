#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
    echo "Utilisation : sudo bash install-release.sh /chemin/brain2jeu-vps.tar.gz" >&2
    exit 1
fi
archive="${1:?Indiquer le chemin du fichier brain2jeu-vps.tar.gz}"
[[ -f "$archive" ]] || { echo "Archive introuvable : $archive" >&2; exit 1; }

site=/var/www/brain2jeu
release="$site/releases/$(date -u +%Y%m%dT%H%M%SZ)-$$"
if [[ -e "$site/current" && ! -L "$site/current" ]]; then
    echo "$site/current existe et n'est pas un lien : vérifier son contenu avant de continuer." >&2
    exit 1
fi

# This archive must come from `npm run release:vps`; it contains only dist/.
install -d -m 755 "$release"
tar -xzf "$archive" --no-same-owner -C "$release"
for file in index.html sw.js manifest.webmanifest; do
    [[ -f "$release/$file" ]] || { echo "Archive incomplète : $file absent." >&2; exit 1; }
done
[[ -d "$release/assets" ]] || { echo "Archive incomplète : assets absent." >&2; exit 1; }
find "$release" -type d -exec chmod 755 {} +
find "$release" -type f -exec chmod 644 {} +

# Switch only after extraction succeeds. Keep earlier releases for rollback.
next="$site/.current-$(basename "$release")"
ln -s "$release" "$next"
mv -Tf "$next" "$site/current"
echo "Brain2jeu installé : $release"
