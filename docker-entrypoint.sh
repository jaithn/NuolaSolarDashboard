#!/bin/sh
set -e

# Ziel-User/-Gruppe fuer den unprivilegierten App-Betrieb. Default 1000:1000;
# auf Unraid, wo der Appdata-Ordner meist "nobody:users" gehoert, kann man im
# Container-Template PUID=99 und PGID=100 setzen.
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

# Erster Durchlauf als root: die (bei Bind-Mounts oft fremd-owned) Volume-
# Ordner dem Ziel-User uebereignen, damit SQLite und Logo-Uploads schreibbar
# sind, dann per gosu unprivilegiert dasselbe Skript erneut ausfuehren.
if [ "$(id -u)" = "0" ]; then
  chown -R "$PUID:$PGID" /app/data /app/public/uploads 2>/dev/null || \
    echo "[entrypoint] WARN: konnte /app/data bzw. /app/public/uploads nicht chownen"
  exec gosu "$PUID:$PGID" "$0" "$@"
fi

# --- ab hier unprivilegiert (PUID:PGID) --------------------------------------

# HOME auf ein sicher beschreibbares Verzeichnis setzen: bei frei gewaehltem
# PUID existiert evtl. kein Home-Verzeichnis, sonst wuerden prisma/tsx beim
# Cache-Schreiben scheitern. Direkte Binary-Aufrufe statt "npx" vermeiden
# zusaetzlich jeglichen npm-Cache-Zugriff.
export HOME=/tmp

# Schema auf die SQLite-DB anwenden (siehe README: bewusst ohne
# --accept-data-loss; bricht bei potenziell destruktiven Aenderungen ab).
./node_modules/.bin/prisma db push --skip-generate

# Vertrags-/Brieftexte aus dem "Dokumente"-Ordner in die DB einlesen (idempotent).
# Schlaegt der Sync fehl, soll der Container trotzdem starten (|| true).
./node_modules/.bin/tsx scripts/sync-dokumente.ts || true

# Ein Image, ein Container: Web-Server und Shelly-Polling-Worker laufen
# gemeinsam. Stirbt einer der beiden Prozesse, beendet sich der Container
# (restart: unless-stopped startet dann beide neu). POSIX-sh-kompatibel.
./node_modules/.bin/tsx src/worker/index.ts &
WORKER_PID=$!

node server.js &
WEB_PID=$!

(wait "$WORKER_PID"; kill -TERM $$) 2>/dev/null &
(wait "$WEB_PID"; kill -TERM $$) 2>/dev/null &

wait
