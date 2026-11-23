#!/usr/bin/env zsh
set -euo pipefail

export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

PROJECT_DIR="/Users/krzysztofjarzyna/.gemini/antigravity/scratch/bujok-medical-parallax-depth-studio"
DIST_DIR="$PROJECT_DIR/dist"
RELEASE_DIR="$PROJECT_DIR/release"
APP_NAME="Bujok Medical Parallax Studio.app"
APP_DIR="$RELEASE_DIR/$APP_NAME"
DMG_STAGE="$RELEASE_DIR/.dmg_stage"
DMG_PATH="$RELEASE_DIR/Bujok-Medical-Parallax-Studio-Offline-macOS.dmg"
ZIP_PATH="$RELEASE_DIR/Bujok-Medical-Parallax-Studio-Offline-macOS.zip"
ICONSET_DIR="$RELEASE_DIR/.AppIcon.iconset"
ICON_PNG="$RELEASE_DIR/.icon_1024.png"

if [[ ! -d "$DIST_DIR" || ! -f "$DIST_DIR/index.html" ]]; then
  echo "ERROR: Brak zbudowanego dist/ w $PROJECT_DIR"
  exit 1
fi

rm -rf "$APP_DIR" "$DMG_STAGE" "$ICONSET_DIR" "$ICON_PNG" "$DMG_PATH" "$ZIP_PATH"
mkdir -p "$APP_DIR/Contents/MacOS" "$APP_DIR/Contents/Resources/dist"

# 1. Copy compiled offline production bundle
cp -R "$DIST_DIR/." "$APP_DIR/Contents/Resources/dist/"

# 2. Generate crisp 1024x1024 Parallax Depth 3D + Gold/Obsidian AppIcon.icns
uv run --with pillow python3 - "$ICON_PNG" << 'PYICON'
import sys
from PIL import Image, ImageDraw

out_path = sys.argv[1]
S = 1024
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

pad = 64
d.rounded_rectangle([pad, pad, S - pad, S - pad], radius=210, fill=(17, 16, 14, 255), outline=(212, 175, 55, 235), width=16)
d.rounded_rectangle([pad + 26, pad + 26, S - pad - 26, S - pad - 26], radius=188, outline=(255, 255, 255, 36), width=5)

# 3 layered parallax depth planes (back -> mid -> front)
layers = [
    (210, 220, 690, 640, (30, 41, 59, 175), (148, 163, 184, 170), 8),
    (270, 290, 750, 710, (24, 34, 52, 215), (56, 189, 248, 220), 10),
    (330, 360, 810, 780, (28, 25, 20, 240), (212, 175, 55, 255), 12),
]
for x1, y1, x2, y2, fill, outline, w in layers:
    d.rounded_rectangle([x1, y1, x2, y2], radius=46, fill=fill, outline=outline, width=w)

# Optical depth focal aperture inside front plane
cx, cy = 570, 570
d.ellipse([cx - 115, cy - 115, cx + 115, cy + 115], fill=(212, 175, 55, 42), outline=(212, 175, 55, 245), width=10)
d.ellipse([cx - 64, cy - 64, cx + 64, cy + 64], fill=(56, 189, 248, 70), outline=(224, 242, 254, 240), width=7)
d.ellipse([cx - 18, cy - 18, cx + 18, cy + 18], fill=(255, 247, 214, 255))

img.save(out_path, "PNG")
PYICON

mkdir -p "$ICONSET_DIR"
sips -z 16 16     "$ICON_PNG" --out "$ICONSET_DIR/icon_16x16.png"      >/dev/null
sips -z 32 32     "$ICON_PNG" --out "$ICONSET_DIR/icon_16x16@2x.png"   >/dev/null
sips -z 32 32     "$ICON_PNG" --out "$ICONSET_DIR/icon_32x32.png"      >/dev/null
sips -z 64 64     "$ICON_PNG" --out "$ICONSET_DIR/icon_32x32@2x.png"   >/dev/null
sips -z 128 128   "$ICON_PNG" --out "$ICONSET_DIR/icon_128x128.png"    >/dev/null
sips -z 256 256   "$ICON_PNG" --out "$ICONSET_DIR/icon_128x128@2x.png" >/dev/null
sips -z 256 256   "$ICON_PNG" --out "$ICONSET_DIR/icon_256x256.png"    >/dev/null
sips -z 512 512   "$ICON_PNG" --out "$ICONSET_DIR/icon_256x256@2x.png" >/dev/null
sips -z 512 512   "$ICON_PNG" --out "$ICONSET_DIR/icon_512x512.png"    >/dev/null
cp "$ICON_PNG"                      "$ICONSET_DIR/icon_512x512@2x.png"
iconutil -c icns "$ICONSET_DIR" -o "$APP_DIR/Contents/Resources/AppIcon.icns"
rm -rf "$ICONSET_DIR" "$ICON_PNG"

# 3. Info.plist
cat > "$APP_DIR/Contents/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>pl</string>
  <key>CFBundleDisplayName</key>
  <string>Bujok Medical Parallax Studio</string>
  <key>CFBundleExecutable</key>
  <string>BujokParallaxStudio</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundleIdentifier</key>
  <string>local.bujok.parallax.studio.offline</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>Bujok Medical Parallax Studio</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

# 4. Zero-dependency Python 3 offline server
cat > "$APP_DIR/Contents/Resources/offline_server.py" << 'PYEOF'
#!/usr/bin/env python3
"""Bujok Medical Parallax & Depth Studio — 100% Offline Local Server."""

import http.server
import json
import mimetypes
import os
import socketserver
import sys
from urllib.parse import urlparse

PORT = int(os.environ.get("PARALLAX_PORT", "3024"))
HOST = "127.0.0.1"
DIST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")

mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("application/javascript", ".mjs")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("font/woff2", ".woff2")


class ParallaxOfflineHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIST_DIR, **kwargs)

    def log_message(self, format, *args):
        pass

    def _send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        req_path = urlparse(self.path).path
        if req_path == "/__health":
            self._send_json({"status": "ok", "app": "Bujok Medical Parallax Studio Offline", "port": PORT})
            return
        if req_path.startswith("/api/"):
            self._send_json({"offline": True, "ok": True, "message": "Tryb 100% offline."})
            return
        rel = req_path.lstrip("/")
        full_path = os.path.normpath(os.path.join(DIST_DIR, rel))
        if rel == "" or not full_path.startswith(DIST_DIR) or not os.path.isfile(full_path):
            self.path = "/index.html"
        return super().do_GET()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length > 0:
            _ = self.rfile.read(min(length, 1024 * 1024))
        self._send_json({
            "offline": True,
            "ok": True,
            "message": "Tryb 100% offline: silnik głębi 3D, paralaksa i eksport WebP/klatek działają lokalnie bez sieci.",
        })


class ReusableTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    try:
        with ReusableTCPServer((HOST, PORT), ParallaxOfflineHandler) as httpd:
            httpd.serve_forever()
    except OSError as exc:
        sys.stderr.write(f"Bujok Medical Parallax Studio server could not bind {HOST}:{PORT}: {exc}\n")
        sys.exit(1)
PYEOF
chmod +x "$APP_DIR/Contents/Resources/offline_server.py"

# 5. Native macOS executable launcher
cat > "$APP_DIR/Contents/MacOS/BujokParallaxStudio" << 'LAUNCHER'
#!/usr/bin/env zsh
set -euo pipefail

APP_CONTENTS="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_SCRIPT="$APP_CONTENTS/Resources/offline_server.py"
DATA_DIR="$HOME/Library/Application Support/BujokParallaxStudio"
LOG_FILE="$HOME/Library/Logs/BujokParallaxStudio.log"
PID_FILE="$DATA_DIR/server.pid"
PORT="3024"
URL="http://127.0.0.1:${PORT}/"

mkdir -p "$DATA_DIR" "$HOME/Library/Logs"

if ! /usr/bin/curl -sf "http://127.0.0.1:${PORT}/__health" >/dev/null 2>&1; then
  nohup /usr/bin/python3 "$SERVER_SCRIPT" >>"$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  for _ in {1..25}; do
    if /usr/bin/curl -sf "http://127.0.0.1:${PORT}/__health" >/dev/null 2>&1; then
      break
    fi
    sleep 0.2
  done
fi

CHROME_PROFILE="$DATA_DIR/app-profile"
for BROWSER_BIN in \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" \
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
  "/Applications/Chromium.app/Contents/MacOS/Chromium"; do
  if [[ -x "$BROWSER_BIN" ]]; then
    nohup "$BROWSER_BIN" --app="$URL" --user-data-dir="$CHROME_PROFILE" --no-first-run >/dev/null 2>&1 &
    exit 0
  fi
done

/usr/bin/open "$URL"
LAUNCHER
chmod +x "$APP_DIR/Contents/MacOS/BujokParallaxStudio"

# 6. Ad-hoc sign + ZIP + DMG
codesign --force --deep --sign - "$APP_DIR" >/dev/null 2>&1 || true
(cd "$RELEASE_DIR" && /usr/bin/zip -qry "$ZIP_PATH" "$APP_NAME")

mkdir -p "$DMG_STAGE"
cp -R "$APP_DIR" "$DMG_STAGE/"
ln -s /Applications "$DMG_STAGE/Applications"
cat > "$DMG_STAGE/INSTRUKCJA_INSTALACJI.txt" << 'TXT'
BUJOK MEDICAL PARALLAX & DEPTH STUDIO — OFFLINE (macOS)
=======================================================

1. Przeciągnij "Bujok Medical Parallax Studio.app" na folder "Applications" (Aplikacje).
2. Uruchom z folderu Aplikacje lub przez Spotlight (Cmd + Spacja).

Działa w 100% lokalnie (offline) na porcie http://127.0.0.1:3024
bez internetu, bez Node.js i bez Antigravity.
TXT

hdiutil create -volname "Bujok Parallax Studio" -srcfolder "$DMG_STAGE" -ov -format UDZO "$DMG_PATH" >/dev/null
rm -rf "$DMG_STAGE"

echo "PARALLAX_BUILD_COMPLETE"
ls -lh "$RELEASE_DIR"
