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
# `docker compose exec web npx prisma db push --accept-data-loss` bestaetigen.
npx prisma db push --skip-generate

exec "$@"
