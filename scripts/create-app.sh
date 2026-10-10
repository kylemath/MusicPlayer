#!/bin/bash
# Creates a macOS .app bundle for KyTunes.
# The role is chosen here, before the app ever starts a process.
# Usage: ./scripts/create-app.sh --client|--server [--install]

set -e

usage() {
  echo "Usage: ./scripts/create-app.sh --client|--server [--install]"
  echo ""
  echo "  --client   This computer plays music from a library hosted somewhere else."
  echo "             The app serves the built player only."
  echo "  --server   This computer hosts the music."
  echo "             The app serves the player and the library together."
  echo "  --install  Copy the app to /Applications"
}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROLE=""
INSTALL=0

for arg in "$@"; do
  case "$arg" in
    --client)
      if [ "$ROLE" = "server" ]; then echo "Choose only one of --client or --server."; exit 1; fi
      ROLE="client"
      ;;
    --server)
      if [ "$ROLE" = "client" ]; then echo "Choose only one of --client or --server."; exit 1; fi
      ROLE="server"
      ;;
    --install) INSTALL=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $arg"; usage; exit 1 ;;
  esac
done

if [ -z "$ROLE" ]; then
  echo "Choose --client or --server before installing."
  usage
  exit 1
fi

if [ "$ROLE" = "server" ]; then
  APP_NAME="KyTunes Server"
  BUNDLE_ID="com.localplayer.server"
else
  APP_NAME="KyTunes"
  BUNDLE_ID="com.localplayer.app"
fi
APP_DIR="$PROJECT_DIR/build/$APP_NAME.app"

echo "Building $APP_NAME.app..."

rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

# --- Info.plist ---
cat > "$APP_DIR/Contents/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>${APP_NAME}</string>
    <key>CFBundleDisplayName</key>
    <string>${APP_NAME}</string>
    <key>CFBundleIdentifier</key>
    <string>${BUNDLE_ID}</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleExecutable</key>
    <string>LocalPlayer</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.15</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSUIElement</key>
    <false/>
</dict>
</plist>
PLIST

# --- Executable launcher ---
cat > "$APP_DIR/Contents/MacOS/LocalPlayer" << LAUNCHER
#!/bin/bash
export KYTUNES_ROLE="$ROLE"
PROJECT_DIR="$PROJECT_DIR"
exec "\$PROJECT_DIR/scripts/launch.sh"
LAUNCHER
chmod +x "$APP_DIR/Contents/MacOS/LocalPlayer"

# --- Icon ---
ICON_SRC="$PROJECT_DIR/public/icon-512.png"
ICONSET="$PROJECT_DIR/build/AppIcon.iconset"
if [ -f "$ICON_SRC" ]; then
  mkdir -p "$ICONSET"
  sips -z 16 16 "$ICON_SRC" --out "$ICONSET/icon_16x16.png" >/dev/null
  sips -z 32 32 "$ICON_SRC" --out "$ICONSET/icon_16x16@2x.png" >/dev/null
  sips -z 32 32 "$ICON_SRC" --out "$ICONSET/icon_32x32.png" >/dev/null
  sips -z 64 64 "$ICON_SRC" --out "$ICONSET/icon_32x32@2x.png" >/dev/null
  sips -z 128 128 "$ICON_SRC" --out "$ICONSET/icon_128x128.png" >/dev/null
  sips -z 256 256 "$ICON_SRC" --out "$ICONSET/icon_128x128@2x.png" >/dev/null
  sips -z 256 256 "$ICON_SRC" --out "$ICONSET/icon_256x256.png" >/dev/null
  sips -z 512 512 "$ICON_SRC" --out "$ICONSET/icon_256x256@2x.png" >/dev/null
  sips -z 512 512 "$ICON_SRC" --out "$ICONSET/icon_512x512.png" >/dev/null
  cp "$ICON_SRC" "$ICONSET/icon_512x512@2x.png"
  iconutil -c icns "$ICONSET" -o "$PROJECT_DIR/build/AppIcon.icns"
  rm -rf "$ICONSET"
fi
if [ -f "$PROJECT_DIR/build/AppIcon.icns" ]; then
  cp "$PROJECT_DIR/build/AppIcon.icns" "$APP_DIR/Contents/Resources/AppIcon.icns"
  echo "  Icon: ✓"
else
  echo "  Icon: ✗ (public/icon-512.png is missing)"
fi

# Clear quarantine so Gatekeeper doesn't block on first launch
xattr -cr "$APP_DIR" 2>/dev/null || true

echo "Building the player..."
(cd "$PROJECT_DIR" && npm run build)

echo ""
echo "Created: $APP_DIR ($ROLE)"

# Optionally copy to /Applications
if [ "$INSTALL" = "1" ]; then
  echo "Installing to /Applications..."
  rm -rf "/Applications/$APP_NAME.app"
  cp -R "$APP_DIR" "/Applications/$APP_NAME.app"
  xattr -cr "/Applications/$APP_NAME.app" 2>/dev/null || true
echo "Installed: /Applications/$APP_NAME.app"
echo ""
if [ "$ROLE" = "client" ]; then
  echo "Open $APP_NAME from Applications. It serves the player, then you connect to a library."
else
  echo "Open $APP_NAME from Applications. The first launch asks for the music folder and password."
  echo "After that it serves the player and the music on port 8787."
fi
fi

echo ""
echo "Done."
echo "  App:     build/$APP_NAME.app"
echo "  Install: ./scripts/create-app.sh --install --$ROLE"
