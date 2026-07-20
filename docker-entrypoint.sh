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
  chown -R "$PUID:$PGID" /app/data 2>/dev/null || \
    echo "[entrypoint] WARN: konnte /app/data nicht chownen"
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

# Editierbare Vertrags-/Brieftexte (.md) im Data-Volume ablegen, damit sie vom
# Server-Dateisystem aus bearbeitet werden koennen. Der ins Image gebackene
# Ordner /app/Dokumente dient als Vorlage: beim ersten Start werden alle Dateien
# uebernommen; bei spaeteren Updates ergaenzt "cp -n" nur NEUE Dateien und laesst
# bereits vorhandene (evtl. bearbeitete) unberuehrt. Danach liest der Sync und
# die App (Button "Vertragstexte einlesen") aus diesem Ordner.
export DOKUMENTE_DIR=/app/data/Dokumente
mkdir -p "$DOKUMENTE_DIR"
cp -rn /app/Dokumente/. "$DOKUMENTE_DIR/" 2>/dev/null || true

# Vertrags-/Brieftexte aus dem Dokumente-Ordner (DOKUMENTE_DIR) in die DB
# einlesen (idempotent). Schlaegt der Sync fehl, soll der Container trotzdem
# starten (|| true).
./node_modules/.bin/tsx scripts/sync-dokumente.ts || true

# Einmalige, idempotente Migration der Dokumentablage von data/mietparteien/<id>
# auf data/kunden/<kundennummer> (best-effort; Fehler brechen den Start nicht).
./node_modules/.bin/tsx scripts/migrate-kundenordner.ts || true

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
