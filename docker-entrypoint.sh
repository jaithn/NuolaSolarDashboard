#!/bin/sh
set -e

# Wendet das aktuelle Prisma-Schema auf die SQLite-Datenbank an. Da es sich um
# eine dateibasierte SQLite-DB in einem einzelnen Compose-Volume handelt,
# genuegt "db push" statt eines separaten Migrationsverzeichnisses - das
# Schema in prisma/schema.prisma ist die alleinige Quelle der Wahrheit.
#
# Bewusst OHNE --accept-data-loss: bei rein additiven Schemaaenderungen (neue
# Tabellen/Spalten) laeuft das automatisch durch. Wuerde eine Aenderung Daten
# loeschen (z.B. Spalte entfernt/Typ geaendert), bricht der Container-Start
# hier ab statt still Daten zu verlieren - dann manuell pruefen und per
# `docker compose exec app npx prisma db push --accept-data-loss` bestaetigen.
npx prisma db push --skip-generate

# Ein Image, ein Container: Web-Server und Shelly-Polling-Worker laufen
# gemeinsam in diesem Container statt in getrennten Services. Beide werden im
# Hintergrund gestartet; stirbt einer der beiden Prozesse, beendet sich der
# gesamte Container (statt einen Ausfall unbemerkt weiterlaufen zu lassen) -
# "restart: unless-stopped" in Docker Compose startet dann beide gemeinsam
# neu. POSIX-sh-kompatibel (kein bash-spezifisches "wait -n" noetig).
npx tsx src/worker/index.ts &
WORKER_PID=$!

node server.js &
WEB_PID=$!

(wait "$WORKER_PID"; kill -TERM $$) 2>/dev/null &
(wait "$WEB_PID"; kill -TERM $$) 2>/dev/null &

wait
