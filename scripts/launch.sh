#!/bin/bash
# Opens KyTunes.
# KYTUNES_ROLE=client serves the built player and does not host music.
# KYTUNES_ROLE=server hosts the library, or opens setup until that library exists.
# With no role (npm run launch), this starts the Vite dev server.

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_FILE="$PROJECT_DIR/.localplayer.log"
APP_NAME="KyTunes"
if [ "$KYTUNES_ROLE" = "server" ]; then
  APP_NAME="KyTunes Server"
fi

exec > "$LOG_FILE" 2>&1

echo "=== KyTunes launch at $(date) ==="
echo "PROJECT_DIR: $PROJECT_DIR"

# ---------- Ensure a modern Node is on PATH ----------
# When launched from .app, the shell has almost no PATH. We must explicitly
# find and activate a Node >= 18 that can run Vite 7.

export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  echo "Loading nvm..."
  source "$NVM_DIR/nvm.sh"
  nvm use 20 >/dev/null 2>&1 || nvm use 18 >/dev/null 2>&1 || true
fi

# fnm fallback
if ! command -v node &>/dev/null || [ "$(node -e 'process.stdout.write(String(+process.versions.node.split(".")[0]>=18))')" != "1" ]; then
  if command -v fnm &>/dev/null; then
    eval "$(fnm env)" && fnm use 20 2>/dev/null || fnm use 18 2>/dev/null || true
  fi
fi

# Homebrew Node fallback (common on macOS)
if ! command -v node &>/dev/null || [ "$(node -e 'process.stdout.write(String(+process.versions.node.split(".")[0]>=18))')" != "1" ]; then
  for candidate in /opt/homebrew/bin/node /usr/local/bin/node; do
    if [ -x "$candidate" ]; then
      major=$("$candidate" -e 'process.stdout.write(process.versions.node.split(".")[0])')
      if [ "$major" -ge 18 ] 2>/dev/null; then
        export PATH="$(dirname "$candidate"):$PATH"
        break
      fi
    fi
  done
fi

# Direct nvm binary fallback if nvm.sh didn't set PATH correctly
if ! command -v node &>/dev/null || [ "$(node -e 'process.stdout.write(String(+process.versions.node.split(".")[0]>=18))')" != "1" ]; then
  for dir in "$NVM_DIR/versions/node"/v20.* "$NVM_DIR/versions/node"/v22.* "$NVM_DIR/versions/node"/v18.*; do
    if [ -x "$dir/bin/node" ]; then
      export PATH="$dir/bin:$PATH"
      echo "Using Node from $dir"
      break
    fi
  done
fi

echo "Node: $(which node 2>/dev/null) $(node --version 2>/dev/null)"
echo "npm:  $(which npm 2>/dev/null) $(npm --version 2>/dev/null)"

NODE_MAJOR=$(node -e 'process.stdout.write(process.versions.node.split(".")[0])' 2>/dev/null)
if [ -z "$NODE_MAJOR" ] || [ "$NODE_MAJOR" -lt 18 ] 2>/dev/null; then
  osascript -e "display dialog \"KyTunes requires Node.js >= 18 but found $(node --version 2>/dev/null || echo 'none').

Install a modern Node:
  brew install node
or:
  nvm install 20\" with title \"$APP_NAME\" buttons {\"OK\"} default button \"OK\" with icon stop" &
  exit 1
fi

SERVER_PID=""
STARTED=0

# ---------- Clean up on exit ----------
# Only the process this launch started is stopped.
cleanup() {
  if [ "$STARTED" = "1" ] && [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null
  fi
}
trap cleanup EXIT INT TERM

cd "$PROJECT_DIR" || exit 1

library_port() {
  node --input-type=module -e "
    import fs from 'node:fs';
    try {
      const config = JSON.parse(fs.readFileSync('library.config.json', 'utf8'));
      process.stdout.write(String(config.port || 8787));
    } catch {
      process.stdout.write('8787');
    }
  "
}

ensure_player_build() {
  if [ ! -f "$PROJECT_DIR/dist/index.html" ]; then
    echo "Building the player"
    npm run build || exit 1
  fi
}

start_url() {
  local label="$1"
  shift
  if curl -sf "$URL" >/dev/null 2>&1; then
    echo "$label already running at $URL — leaving it up"
    return
  fi
  echo "Starting $label at $URL"
  "$@" &
  SERVER_PID=$!
  STARTED=1
}

# ---------- What this install is allowed to start ----------
# client: built player, then connect to someone else's library.
# server: player and music on one port, after the folder and password exist.
# unset:   Vite, for working on the app.
if [ "$KYTUNES_ROLE" = "client" ]; then
  PORT=4173
  URL="http://localhost:$PORT"
  ensure_player_build
  start_url "player" npm run preview -- --port "$PORT" --strictPort --host
elif [ "$KYTUNES_ROLE" = "server" ] && [ -f "$PROJECT_DIR/library.config.json" ]; then
  PORT="$(library_port)"
  URL="http://localhost:$PORT"
  ensure_player_build
  start_url "library" node server/library-server.mjs
elif [ "$KYTUNES_ROLE" = "server" ]; then
  PORT=5173
  URL="http://localhost:$PORT"
  echo "No saved library yet — opening setup"
  export VITE_KYTUNES_ROLE=server
  start_url "setup" npm run dev -- --port "$PORT" --strictPort
else
  PORT=5173
  URL="http://localhost:$PORT"
  start_url "dev server" npm run dev -- --port "$PORT" --strictPort
fi

echo "Waiting for $URL..."
for i in $(seq 1 60); do
  if curl -sf "$URL" >/dev/null 2>&1; then
    echo "Ready after ~$((i / 2))s"
    break
  fi
  if [ "$STARTED" = "1" ] && ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Process exited"
    break
  fi
  sleep 0.5
done

if ! curl -s "$URL" >/dev/null 2>&1; then
  osascript -e "display dialog \"$APP_NAME failed to start. Check .localplayer.log in the project folder.\" with title \"$APP_NAME\" buttons {\"OK\"} default button \"OK\" with icon stop" &
  exit 1
fi

# ---------- Open the window ----------
# A client or server install opens the address this launch just started.
# npm run launch still prefers a KyTunes PWA that points at the dev server.
PWA_APP=""
if [ -z "$KYTUNES_ROLE" ]; then
  for dir in "$HOME/Applications/Chrome Apps.localized" "$HOME/Applications/Chrome Apps" "$HOME/Applications"; do
    if [ -d "$dir/KyTunes.app" ]; then
      PWA_APP="$dir/KyTunes.app"
      break
    fi
  done
fi

if [ -n "$PWA_APP" ]; then
  echo "Launching installed PWA: $PWA_APP"
  open -a "$PWA_APP"
else
  echo "Opening $URL"
  if [ -d "/Applications/Google Chrome.app" ]; then
    open -na "Google Chrome" --args "--app=$URL"
  elif [ -d "/Applications/Chromium.app" ]; then
    open -na "Chromium" --args "--app=$URL"
  elif [ -d "/Applications/Microsoft Edge.app" ]; then
    open -na "Microsoft Edge" --args "--app=$URL"
  elif [ -d "/Applications/Brave Browser.app" ]; then
    open -na "Brave Browser" --args "--app=$URL"
  else
    open "$URL"
  fi
fi

# Stay alive while a process this launch started is running, so quitting the
# app stops only that process. An already-running server is left alone.
if [ "$STARTED" = "1" ]; then
  wait "$SERVER_PID"
fi
