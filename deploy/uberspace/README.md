# Betrieb auf Uberspace 8 (Alternative zu Docker)

Dieser Weg betreibt das Nuola Energy Dashboard **ohne Docker** direkt auf einem
Uberspace-8-Account. Der Next.js-Server und der Shelly-Polling-Worker laufen als
zwei `supervisord`-Dienste; ein Uberspace-Web-Backend leitet die Domain (inkl.
automatischem HTTPS) auf den Next.js-Port. Automatische Deployments erledigt der
GitHub-Actions-Workflow [`.github/workflows/deploy-uberspace.yml`](../../.github/workflows/deploy-uberspace.yml).

Der Docker-Weg (`Dockerfile`, `docker-compose.yml`) bleibt davon unberührt und
funktioniert weiter – beides existiert parallel.

## Architektur-Abbildung (Docker → Uberspace)

| Docker | Uberspace 8 |
| --- | --- |
| `node server.js` (Web) | supervisord-Dienst `nuola-web` (`next start`), lauscht auf `0.0.0.0:PORT` |
| `tsx src/worker/index.ts` (Worker) | supervisord-Dienst `nuola-worker` |
| nginx/SWAG + TLS | `uberspace web backend` + automatisches Let's-Encrypt |
| Volume `data/` | `~/nuola/data/` (bleibt über Deployments erhalten) |
| Entrypoint: `prisma db push`, Textsync | Deploy-Schritt per SSH nach dem rsync |
| root + gosu + PUID/PGID | entfällt – läuft als eigener Uberspace-User |

> **Wichtig:** `PUID`/`PGID` aus `.env.example` sind reine Docker-Größen und auf
> Uberspace **wirkungslos** (dort gibt es keinen root/gosu-Schritt). Einfach
> ignorieren.

---

## A. Einmaliges Setup auf dem Host

Alle Schritte per SSH auf dem Uberspace (`ssh USERNAME@HOST.uberspace.de`).
Ersetze `USERNAME`, `HOST` und `PORT` (freier Port 1024–65535) durchgängig.

### 1. Node-Version wählen

```console
uberspace tools version list node      # verfügbare Versionen ansehen
uberspace tools version use node 22     # auf 22 stellen (zur CI-Version passend)
node -v
```

Die im Deploy-Workflow (`setup-node`) genutzte Hauptversion sollte hiermit
übereinstimmen. Weicht sie ab, beide angleichen.

### 2. Projektordner + Laufzeitordner anlegen

```console
mkdir -p ~/nuola/data ~/logs
```

`~/nuola` ist das Ziel des Deployments (`UBERSPACE_PATH`), `~/nuola/data` hält
SQLite-DB und die generierten Rechnungs-/Onboarding-PDFs. Beide werden vom rsync
**nicht** angetastet (`--exclude=/data`).

### 3. `.env` anlegen

Die `.env` liegt **nur auf dem Host** (nie im Repo, vom rsync ausgenommen) unter
`~/nuola/.env`. Als Vorlage dient [`.env.example`](../../.env.example); die für
Uberspace relevanten Werte:

```dotenv
# Absoluter Pfad ins data-Verzeichnis dieses Users
DATABASE_URL="file:/home/USERNAME/nuola/data/nuola.db"

SESSION_SECRET="<openssl rand -base64 32>"
COOKIE_INSECURE=false
APP_BASE_URL="https://mieterportal.deine-domain.de"

SHELLY_CLOUD_AUTH_KEY="…"
POLL_INTERVAL_MINUTES=10

SMTP_HOST="…"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="…"
SMTP_PASSWORD="…"
SMTP_FROM="Nuola Solar GbR <noreply@deine-domain.de>"
SMTP_REPLY_TO=""
```

Hinweise:
- **SMTP:** Ausgehender Port 25 ist auf Uberspace gesperrt; Versand über
  Port 587/465 (eigener Mailserver oder Uberspaces Mailsystem) funktioniert.
- **`PORT` gehört nicht in die `.env`** – der Port steht im supervisord-Dienst
  und im Web-Backend (siehe unten) und muss dort identisch sein.

### 4. Web-Backend + Domain + HTTPS

```console
uberspace web domain add mieterportal.deine-domain.de   # DNS vorher auf Uberspace zeigen
uberspace web backend set mieterportal.deine-domain.de --http --port PORT
uberspace web backend list                              # Status prüfen
```

HTTPS-Zertifikate stellt Uberspace nach dem Domain-Add automatisch aus. Der
Next.js-Server muss auf `0.0.0.0:PORT` lauschen – das erledigt der `nuola-web`-
Dienst (`-H 0.0.0.0 -p PORT`).

### 5. supervisord-Dienste einrichten

Kopiere [`nuola.ini`](nuola.ini) nach `~/etc/services.d/nuola.ini` und ersetze
darin `USERNAME` und `PORT`. Dann:

```console
supervisorctl reread
supervisorctl update
supervisorctl status nuola-web nuola-worker
```

Die Dienste starten erst erfolgreich, wenn der Code einmal deployt und die DB
initialisiert wurde (nächster Abschnitt) – vorher schlagen sie fehl, das ist
normal.

### 6. SSH-Key für GitHub Actions

Auf einem lokalen Rechner ein **dediziertes** Schlüsselpaar erzeugen (ohne
Passphrase, damit CI es nutzen kann) und den öffentlichen Teil auf dem Uberspace
hinterlegen:

```console
ssh-keygen -t ed25519 -f ~/.ssh/nuola-deploy -N "" -C "github-actions-deploy"
ssh-copy-id -i ~/.ssh/nuola-deploy.pub USERNAME@HOST.uberspace.de
```

Optional den Key auf reines Deployment einschränken (Uberspace-Doku
„automatic deployment", `command="…rrsync…"` in `~/.ssh/authorized_keys`).

### 7. GitHub-Secrets setzen

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Wert |
| --- | --- |
| `UBERSPACE_SSH_KEY` | Inhalt von `~/.ssh/nuola-deploy` (privater Key, komplett) |
| `UBERSPACE_HOST` | z. B. `andromeda.uberspace.de` |
| `UBERSPACE_USER` | der Uberspace-Benutzername |
| `UBERSPACE_PATH` | `/home/USERNAME/nuola` |

---

## B. Deployment auslösen

Der Workflow ist bewusst **manuell** ausgelöst (`workflow_dispatch`), damit nicht
jeder `main`-Push gleichzeitig Docker **und** Uberspace deployt:

- GitHub → **Actions → „Deploy auf Uberspace" → Run workflow**.

Ablauf des Workflows: `npm ci` → `prisma generate` → `next build` (in CI) →
`rsync` nach `~/nuola` → per SSH auf dem Host `prisma generate`
(plattformrichtige Engine!) + `prisma db push` + Textsync + Neustart der Dienste.

Soll bei **jedem** `main`-Push deployt werden, in
[`deploy-uberspace.yml`](../../.github/workflows/deploy-uberspace.yml) den
`push`-Trigger einkommentieren.

---

## C. Betrieb & Diagnose

```console
supervisorctl status                       # alle Dienste
supervisorctl restart nuola-web            # Web neu starten
supervisorctl tail -f nuola-worker         # Worker-Logs live
tail -f ~/logs/nuola-web.log               # Web-Logs
uberspace web backend list                 # Routing/HTTPS prüfen
```

---

## Bewusste Design-Entscheidungen / Fallstricke

1. **Build in CI, Prisma-Engine auf dem Host.** Der teure `next build` läuft in
   GitHub Actions. Prismas Query-Engine ist aber plattformspezifisch – deshalb
   läuft `prisma generate` **nach** dem rsync noch einmal auf dem Uberspace, um
   die zur Host-Plattform passende Engine zu erzeugen. Dadurch muss in
   `schema.prisma` **kein** `binaryTargets` geraten werden.
   *Optional*: Setzt man später `binaryTargets` passend zum Host, kann der
   Host-`prisma generate`-Schritt entfallen (erst die Host-Plattform verifizieren:
   `cat /etc/os-release && openssl version`).

2. **`rsync --delete` schützt Laufzeitdaten.** `data/` (SQLite + PDFs), `.env`
   und `public/uploads` (Logos) sind mit verankerten `--exclude`-Regeln vom
   Löschen ausgenommen. **Diese Ausschlüsse niemals entfernen** – sonst löscht
   das nächste Deployment die Kundendatenbank.

3. **`next start` statt Standalone.** Der Uberspace-Weg nutzt das vorhandene
   `npm run start` (`next start`) mit vollständigem `node_modules`, weil sich der
   Worker (`tsx`) dieselben Module teilt. Der Docker-Weg nutzt weiterhin den
   Standalone-Output. Beide Build-Wege koexistieren.

4. **RAM-Budget.** Der Build läuft in CI, nicht auf dem (speicherbegrenzten)
   Uberspace – bewusst so gewählt. Auf dem Host laufen nur die beiden
   Node-Prozesse.

5. **Kein root/gosu.** Alles läuft als eigener User; `PUID/PGID` sind
   wirkungslos, der chown-Schritt aus dem Docker-Entrypoint entfällt.
