#!/bin/sh
# Satoshi (Fontshare, ITF Free Font License) is bundled into the app but not committed:
# the licence allows use in an app, not redistributing the font files. Fetched before install/build.
set -e
dir="$(dirname "$0")/../assets/fonts"
mkdir -p "$dir"
[ -s "$dir/Satoshi-Bold.ttf" ] && exit 0
css=$(curl -fsSL "https://api.fontshare.com/v2/css?f%5B%5D=satoshi@400,500,700&display=swap")
set -- Regular Medium Bold
for url in $(printf '%s\n' "$css" | grep -o "//cdn[^']*\.ttf" | head -3); do
  curl -fsSL "https:$url" -o "$dir/Satoshi-$1.ttf"
  shift
done
