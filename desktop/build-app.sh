#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/dist/HASHCORE X.app"
CONTENTS="$APP/Contents"
ICONSET="$(mktemp -d)/AppIcon.iconset"
trap 'rm -rf "${ICONSET%/AppIcon.iconset}"' EXIT

cd "$ROOT"
pnpm run build

rm -rf "$APP"
mkdir -p "$CONTENTS/MacOS" "$CONTENTS/Resources" "$ICONSET"
swiftc -O -framework Cocoa -framework WebKit desktop/HashCoreX.swift -o "$CONTENTS/MacOS/HashCoreX"
cp desktop/Info.plist "$CONTENTS/Info.plist"
/usr/libexec/PlistBuddy -c "Set :HashCoreProjectPath $ROOT" "$CONTENTS/Info.plist"

for spec in "16 icon_16x16" "32 icon_16x16@2x" "32 icon_32x32" "64 icon_32x32@2x" "128 icon_128x128" "256 icon_128x128@2x" "256 icon_256x256" "512 icon_256x256@2x" "512 icon_512x512" "1024 icon_512x512@2x"; do
  set -- $spec
  sips -z "$1" "$1" desktop/AppIcon.png --out "$ICONSET/$2.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$CONTENTS/Resources/AppIcon.icns"

plutil -lint "$CONTENTS/Info.plist" >/dev/null
codesign --force --deep --sign - "$APP" >/dev/null
codesign --verify --deep --strict "$APP"
test -x "$CONTENTS/MacOS/HashCoreX"
printf 'Built: %s\n' "$APP"
