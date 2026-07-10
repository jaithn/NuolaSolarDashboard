# Nuola Energy Dashboard

Webanwendung für die Nuola Solar GbR: erfasst den Stromverbrauch mehrerer Shelly Pro 3EM
Messgeräte über die **Shelly Cloud API**, zeigt Mietparteien ihren Verbrauch in einem
Dashboard und erstellt jährliche Verbrauchsabrechnungen (inkl. § 14 UStG-konformer
MwSt.-Ausweisung, Abschlagsverrechnung und Schlussrechnung bei Auszug) als PDF.

## Architektur (Kurzüberblick)

- **Ein Image, ein Container (Service `nuola-energy-dashboard`)**: Next.js Full-Stack-App
  (Admin-Bereich, Mieterbereich, Rechnungserstellung) und der Shelly-Polling-Worker
  laufen als zwei Prozesse gemeinsam in diesem einen Container (siehe
  `docker-entrypoint.sh`). Stirbt einer der beiden Prozesse, beendet sich der Container
  komplett, damit `restart: unless-stopped` beide gemeinsam neu startet.
- **SQLite** – dateibasierte DB in einem Docker-Volume, Zugriff über Prisma ORM (bei
  Bedarf später auf PostgreSQL wechselbar, da das Schema keine SQLite-Spezifika nutzt).
- Kein eigener Reverse-Proxy: ein bereits vorhandener externer nginx spricht den Container
  auf Port 3000 an.

Details zu Architektur, Datenmodell und Annahmen: siehe `.claude` Plan-Historie bzw. die
Kommentare in `prisma/schema.prisma`.

## Fertiges Image aus der GitHub Container Registry

Bei jedem Push nach `main` baut `.github/workflows/docker-publish.yml` das Image und
veröffentlicht es automatisch unter:

- `ghcr.io/jaithn/nuola-energy-dashboard:latest`

Damit der Workflow Pakete veröffentlichen darf, muss im Repo unter **Settings → Actions →
General → Workflow permissions** die Option **"Read and write permissions"** aktiviert sein
(sonst schlägt der Push zur Registry mit 403 fehl).

Um das fertige Image statt eines lokalen Builds zu nutzen, in `docker-compose.yml` den
`build:`-Block durch `image: ghcr.io/jaithn/nuola-energy-dashboard:latest` ersetzen (ggf.
vorher `docker login ghcr.io`, falls das Repo/die Packages privat sind).

## Setup

Voraussetzung: Docker + Docker Compose auf dem Zielsystem.

```bash
cp .env.example .env
# .env öffnen und ausfüllen:
#   - SESSION_SECRET (z.B. `openssl rand -base64 32`)
#   - SHELLY_CLOUD_AUTH_KEY (Shelly App > Benutzereinstellungen > Autorisierung
#     Cloud-Schlüssel). Der Cloud-Server wird je Gerät im Admin-Bereich gepflegt.
#   - SMTP_* (Zugangsdaten eures Mailanbieters)

docker compose up -d --build
```

Beim ersten Start legt der `nuola-energy-dashboard`-Container automatisch das Datenbankschema
an (`prisma db push`, siehe `docker-entrypoint.sh`). Danach einmalig den initialen
Admin-Zugang samt Einmal-Passwort erzeugen:

```bash
docker compose exec nuola-energy-dashboard npx prisma db seed
```

Die Ausgabe enthält Benutzername (`admin`) und ein zufälliges Einmal-Passwort — bitte
direkt beim ersten Login ändern. Die Anwendung ist danach unter `http://<server>:3000`
erreichbar (bzw. über den externen nginx-Reverse-Proxy).

### Schema-Änderungen nach dem Go-Live

`docker-entrypoint.sh` führt bei jedem Start `prisma db push` **ohne**
`--accept-data-loss` aus. Rein additive Änderungen (neue Tabellen/Spalten) werden
automatisch übernommen. Würde eine Änderung Daten löschen, bricht der Start ab —
dann bewusst und manuell bestätigen:

```bash
docker compose exec nuola-energy-dashboard npx prisma db push --accept-data-loss
```

## Reverse-Proxy (nginx)

Der Container lauscht nur auf `127.0.0.1:3000`; nach außen (TLS, Domain) geht es über einen
vorgelagerten nginx. Eine fertige, kommentierte Vorlage liegt unter
[`nginx.example.conf`](nginx.example.conf) — Domain und Zertifikatspfade anpassen, dann nach
`/etc/nginx/sites-available/` kopieren und aktivieren.

Wichtig für den Brute-Force-Schutz: nginx **muss** `X-Forwarded-For`/`X-Real-IP` korrekt
setzen (in der Vorlage enthalten), da der App-seitige Rate-Limiter die Client-IP daraus
ableitet. Der App-Code vertraut bewusst nur dem von nginx gesetzten `X-Real-IP` bzw. dem
äußersten `X-Forwarded-For`-Eintrag, sodass ein vom Client mitgeschickter Wert ihn nicht
austricksen kann — Voraussetzung ist, dass der App-Port nicht direkt aus dem Netz erreichbar
ist (siehe `127.0.0.1`-Bind in `docker-compose.yml`). HSTS gehört ebenfalls in den nginx
(nicht in die App), da dort TLS terminiert.

## Environment-Variablen

| Variable | Zweck |
|---|---|
| `DATABASE_URL` | Pfad zur SQLite-Datei im Volume (Default passt bereits zum Compose-Setup) |
| `SESSION_SECRET` | Secret für verschlüsselte Session-Cookies (min. 32 Zeichen) |
| `APP_BASE_URL` | Basis-URL für Links in E-Mails (Passwort-Reset etc.) |
| `SHELLY_CLOUD_AUTH_KEY` | Shelly Cloud Auth-Key (account-weit). Der Cloud-Server ist je Gerät im Admin-Bereich hinterlegt, nicht global. |
| `POLL_INTERVAL_MINUTES` | Abfrageintervall des Worker-Service |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | SMTP-Zugangsdaten für Onboarding-, Reset- und Rechnungs-E-Mails |

## Entwicklung ohne Docker

Voraussetzung: **Node.js 22+** (inkl. npm) - die Docker-Images nutzen Node 24, lokal
reicht jede unterstützte LTS-Version ab 22. Auf einem frischen Mac z.B. per
[nodejs.org-Installer](https://nodejs.org/) oder über Homebrew (`brew install node`)
installieren, falls noch nicht vorhanden.

```bash
npm install --legacy-peer-deps
cp .env.example .env   # DATABASE_URL z.B. auf "file:./data/nuola.db" anpassen
npx prisma db push
npx prisma db seed
npm run dev             # Web-App unter http://localhost:3000
npm run worker           # Worker separat in zweitem Terminal (optional, s.u.)
```

Der Worker versucht bei jedem Poll-Zyklus, echte Geräte über die Shelly Cloud API
abzufragen - ohne echte `SHELLY_CLOUD_AUTH_KEY` und echte Geräte schlägt das fehl bzw.
liefert nichts. Für lokales Ausprobieren der Web-Oberfläche reicht `npm run dev` allein,
der Worker muss dafür nicht laufen.

### Zum Ausprobieren: Demo-Daten laden

Für einen schnellen Eindruck der Anwendung mit realistischen Beispieldaten (zwei Objekte,
mehrere Einheiten/Mietparteien, ein Allgemeinstrom-Zwischenzähler mit Subtraktion, ca. 14
Monate simulierte Verbrauchshistorie, ein Rechnungsentwurf):

```bash
npm install --legacy-peer-deps
cp .env.example .env   # DATABASE_URL z.B. auf "file:./data/nuola.db" anpassen; SESSION_SECRET setzen
npx prisma db push
npm run db:demo-seed
npm run dev
```

Danach unter `http://localhost:3000/login` einloggen (Passwort für alle Accounts:
**`demo1234`**, keine Passwortänderung erforderlich):

| Rolle | Benutzername | Zeigt |
|---|---|---|
| Admin | `admin` | Alle Objekte/Einheiten/Geräte/Rechnungen, Geräte-Zuordnungen inkl. Allgemeinstrom-Subtraktion |
| Mieterin | `anna.schmidt` | Dashboard mit Verbrauch, Vergleich, einem Rechnungsentwurf (Jahresabrechnung 2025) |
| Mieter | `peter.klein` | Dashboard ohne Rechnung (zeigt den "noch nichts freigegeben"-Fall) |
| Mieterin | `familie.yilmaz` | Zweites Objekt (Köln-Buchforst), kürzere Historie |

Die Demo-Objekte heißen `Olfen (Demo)` / `Köln-Buchforst (Demo)` und lassen sich jederzeit
über den Admin-Bereich löschen. `npm run db:demo-seed` ist wiederholt ausführbar (räumt
vorherige Demo-Daten automatisch auf). **Nicht für echten Betrieb verwenden** - die
Demo-Zugänge nutzen ein bekanntes, schwaches Passwort ohne Änderungszwang.

## Tests

```bash
npm test
```

Deckt die Kernlogik ab: Verbrauchsberechnung (inkl. Gerätewechsel), Steuersatz-Splitting
über einen Satzwechsel hinweg, lückenlose Rechnungsnummern-Vergabe, Normalisierung der
Shelly-Cloud-Antworten und den Passwort-Reset-Flow.

## Bekannte Einschränkungen / Annahmen

- Die Shelly Cloud API bietet keine dokumentierte Möglichkeit, historische Messwerte für
  Ausfallzeiträume nachträglich abzurufen. Ausfälle werden geloggt, aber nicht rückwirkend
  aufgefüllt; kurze Poll-Intervalle und robuste Fehlerbehandlung minimieren das Risiko.
- Steuersatz-Splitting bei einem Satzwechsel innerhalb eines Abrechnungszeitraums erfolgt
  taggenau proportional zur Tageszahl je Teilzeitraum.
- Die konkrete umsatzsteuerliche Behandlung (Kleinunternehmerregelung etc.) ist mit einem
  Steuerberater zu klären; Steuernummer/USt-IdNr. und Sätze sind als Stammdaten
  konfigurierbar, nicht hartcodiert.
- Grundpreis und Abschläge (beide "pro Monat" vereinbart) werden bei unterjährigen
  Zeiträumen taggenau anteilig umgerechnet (Basis: 365,25/12 Tage pro Monat).
- Einmal versendete Rechnungen sind unveränderlich. Ein Storno-Workflow
  (Stornorechnung + neue Rechnung bei Korrekturbedarf) ist im Datenmodell als Status
  `STORNIERT` vorgesehen, aber noch nicht als eigene Admin-Funktion umgesetzt.
- Geldbeträge werden als `Float` (nicht `Decimal`) geführt und bei jedem Rechenschritt auf
  Cent gerundet - für die Größenordnung dieser GbR ausreichend, bei Bedarf später auf ein
  Decimal-basiertes Modell umstellbar.
- Rechnungs-PDFs liegen NICHT unter `public/`, sondern in einem privaten Verzeichnis im
  Datenbank-Volume und werden ausschließlich über die authentifizierte Route
  `/api/rechnungen/[id]/pdf` ausgeliefert (Admin: alle: Mieter: nur eigene, erst ab Status
  "freigegeben").

## Admin-Funktionen im Überblick

- **Übersicht** (`/admin`): Live-Status aller Geräte (letzter Messwert, online/offline),
  Verbrauchsübersicht je Einheit mit Filter nach Objekt/Zeitraum, CSV-Export der
  Rohmesswerte.
- **Objekte/Einheiten/Geräte/Mietparteien/Steuersätze**: CRUD wie im Auftrag beschrieben,
  inkl. Mieterwechsel-Historie, Abschlags-Historie und Geräte-Deaktivierung ohne
  Datenverlust.
- **Geräte-Zuordnungen** (`/admin/einheiten/[id]`): ein Gerät kann mehreren Einheiten
  zugeordnet werden und umgekehrt (z.B. mehrere Shellys für eine Einheit). Jede Zuordnung
  hat einen Modus **Addieren** (Normalfall) oder **Subtrahieren** - damit lässt sich z.B.
  ein Allgemeinstrom-Zwischenzähler abbilden, der im Stromkreis eines Mieters hängt: der
  Mieter zahlt dann automatisch nur die Differenz aus seinem Zähler abzüglich des
  Allgemeinstrom-Zählers. Derselbe Allgemeinstrom-Zähler kann dabei mehreren Einheiten
  zugeordnet werden, falls er mehrere Mieterkreise gemeinsam betrifft.
- **Rechnungen**: Entwurf erstellen (Verbrauch, Steuersplitting, Abschlagsverrechnung,
  PDF werden automatisch berechnet/generiert) → prüfen → "Freigeben & versenden" (macht
  die Rechnung im Mieterbereich sichtbar und verschickt sie per E-Mail mit PDF-Anhang).
- **Einstellungen**: Firmenstammdaten (Anschrift, Steuernummer/USt-IdNr., Bankverbindung)
  und Rechnungs-Designvorlage (Logo-Upload, Farben, Fußzeile).
