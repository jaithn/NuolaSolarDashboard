# Betrieb auf Uberspace „Asteroid" (Alternative zu Docker)

Dieser Weg betreibt das Nuola Energy Dashboard **ohne Docker** direkt auf einem
Uberspace-Account der **„Asteroid"-Generation**. Der Next.js-Server und der
Shelly-Polling-Worker laufen als zwei **systemd-User-Services**; ein
Uberspace-Web-Backend leitet die Domain (inkl. automatischem HTTPS) auf den
Next.js-Port. Automatische Deployments erledigt der GitHub-Actions-Workflow
[`.github/workflows/deploy-uberspace.yml`](../../.github/workflows/deploy-uberspace.yml).

Der Docker-Weg (`Dockerfile`, `docker-compose.yml`) bleibt davon unberührt und
funktioniert weiter – beides existiert parallel.

> **Asteroid ≠ Uberspace 8.** Auf Asteroid gibt es **kein supervisord** und kein
> `uberspace tools version` mehr. Dienste laufen über `uberspace service`
> (systemd), Sprachen/Tools über `uberspace tool` (nur PHP versionierbar – die
> **System-Node ist fest**, aktuell v26 unter `/usr/bin/node`). Wer noch die alte
> supervisord-Anleitung sucht: die ist obsolet, dieser Text ist der aktuelle.

## Architektur-Abbildung (Docker → Uberspace Asteroid)

| Docker | Uberspace Asteroid |
| --- | --- |
| `node server.js` (Web) | systemd-User-Service `nuola-web` (`next start -H 0.0.0.0 -p PORT`) |
| `tsx src/worker/index.ts` (Worker) | systemd-User-Service `nuola-worker` |
| nginx/SWAG + TLS | `uberspace web backend add … PORT` + automatisches Let's-Encrypt |
| Volume `data/` | `~/nuola/data/` (bleibt über Deployments erhalten) |
| Entrypoint: `prisma db push`, Textsync | Deploy-Schritt per SSH nach dem rsync |
| root + gosu + PUID/PGID | entfällt – läuft als eigener Uberspace-User |

> **`PUID`/`PGID`** aus `.env.example` sind reine Docker-Größen und auf Uberspace
> **wirkungslos**. Einfach ignorieren.

---

## A. Einmaliges Setup auf dem Host

Alle Schritte per SSH auf dem Uberspace (`ssh USERNAME@HOST.uberspace.de`).
Ersetze `USERNAME`, `HOST` und `PORT` (freier Port 1024–65535) durchgängig.
Für die Nuola-Instanz gilt konkret: `USERNAME=nuola`, `HOST=neso.uberspace.de`,
`PORT=4000`, Zielpfad `~/nuola`.

### 1. Node-Version

Asteroid stellt eine feste System-Node bereit (`node -v` → aktuell v26) und lässt
sie **nicht** über `uberspace tool` umstellen. Deshalb baut der Deploy-Workflow
(`setup-node`) auf **derselben** Hauptversion (26), damit Build- = Laufzeit-Node
ist. Ändert Uberspace die System-Node, `node-version` im Workflow angleichen.

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
APP_BASE_URL="https://portal.nuola.de"

SHELLY_CLOUD_AUTH_KEY="…"
POLL_INTERVAL_MINUTES=10

SMTP_HOST="…"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="…"
SMTP_PASSWORD="…"
SMTP_FROM="Nuola Solar GbR <noreply@nuola.de>"
SMTP_REPLY_TO=""
```

Hinweise:
- **SMTP:** Ausgehender Port 25 ist auf Uberspace gesperrt; Versand über
  Port 587/465 funktioniert. Für gute Zustellbarkeit muss die Absenderdomain
  (`nuola.de`) per SPF/DKIM/DMARC signiert sein.
- **`PORT` gehört nicht in die `.env`** – der Port steht im systemd-Service und im
  Web-Backend (siehe unten) und muss dort identisch sein.

### 4. systemd-User-Services anlegen

Beide Dienste werden mit `uberspace service add` erzeugt (legt die Unit unter
`~/.config/systemd/user/` an, lädt systemd neu, startet + enabled den Dienst).
Sie laden ihre Umgebung aus `~/nuola/.env`, damit der Worker (reiner tsx-Prozess)
dieselben Variablen wie der Web-Server bekommt:

```console
uberspace service add nuola-web \
  "bash -lc 'set -a; source \$HOME/nuola/.env; set +a; exec \$HOME/nuola/node_modules/.bin/next start -H 0.0.0.0 -p 4000'" \
  --workdir "$HOME/nuola"

uberspace service add nuola-worker \
  "bash -lc 'set -a; source \$HOME/nuola/.env; set +a; exec \$HOME/nuola/node_modules/.bin/tsx src/worker/index.ts'" \
  --workdir "$HOME/nuola"
```

Vor dem ersten Deploy schlagen die Dienste fehl (noch kein `node_modules`/`.next`)
– das ist normal; nach dem ersten Deploy (Abschnitt B) starten sie. Steuerung:

```console
systemctl --user status  nuola-web nuola-worker
systemctl --user restart nuola-web nuola-worker
journalctl --user -u nuola-web -f
```

### 5. Web-Backend + Domain + HTTPS

Die Domain muss per DNS auf den Uberspace zeigen (bei Nuola bereits der Fall).
Das Backend als **letzten** Go-Live-Schritt setzen – vorher liefert die Domain
noch die bisherige Statik, danach die App (bis der Dienst lauscht, sonst 502):

```console
uberspace web backend add portal.nuola.de PORT 4000
uberspace web backend list
```

HTTPS-Zertifikate stellt Uberspace automatisch aus. Der Next.js-Server lauscht
über den `nuola-web`-Dienst auf `0.0.0.0:4000`.

### 6. SSH-Key für GitHub Actions

Auf einem lokalen Rechner ein **dediziertes** Schlüsselpaar erzeugen (ohne
Passphrase, damit CI es nutzen kann) und den öffentlichen Teil auf dem Uberspace
hinterlegen (`~/.ssh/authorized_keys`).

### 7. GitHub-Secrets setzen

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Wert (Nuola) |
| --- | --- |
| `UBERSPACE_SSH_KEY` | privater Deploy-Key (komplett, inkl. Header/Footer) |
| `UBERSPACE_HOST` | `neso.uberspace.de` |
| `UBERSPACE_USER` | `nuola` |
| `UBERSPACE_PATH` | `/home/nuola/nuola` |

---

## B. Deployment auslösen

Der Workflow ist bewusst **manuell** ausgelöst (`workflow_dispatch`):

- GitHub → **Actions → „Deploy auf Uberspace" → Run workflow**.

Ablauf: `npm ci` → `prisma generate` → `next build` (in CI) → `rsync` nach
`~/nuola` → per SSH `prisma generate` (plattformrichtige Engine!) + `prisma db
push` + Textsync + `systemctl --user restart nuola-web nuola-worker`.

---

## C. Betrieb & Diagnose

```console
systemctl --user status nuola-web nuola-worker   # Dienste
systemctl --user restart nuola-web               # Web neu starten
journalctl --user -u nuola-worker -f             # Worker-Logs live
uberspace web backend list                       # Routing/HTTPS prüfen
```

---

## Bewusste Design-Entscheidungen / Fallstricke

1. **Build in CI, Prisma-Engine auf dem Host.** Der teure `next build` läuft in
   GitHub Actions. Prismas Query-Engine ist plattformspezifisch – deshalb läuft
   `prisma generate` **nach** dem rsync noch einmal auf dem Uberspace.

2. **`rsync --delete` schützt Laufzeitdaten.** `data/` (SQLite + PDFs), `.env`
   und `public/uploads` (Logos) sind mit verankerten `--exclude`-Regeln vom
   Löschen ausgenommen. **Diese Ausschlüsse niemals entfernen** – sonst löscht
   das nächste Deployment die Kundendatenbank.

3. **`next start` statt Standalone.** Der Uberspace-Weg nutzt `next start` mit
   vollständigem `node_modules`, weil sich der Worker (`tsx`) dieselben Module
   teilt. Der Docker-Weg nutzt weiterhin den Standalone-Output.

4. **RAM-Budget.** Der Build läuft in CI, nicht auf dem Host. Dort laufen nur die
   beiden Node-Prozesse.

5. **systemd statt supervisord, feste System-Node.** Auf Asteroid werden Dienste
   über `uberspace service` (systemd-User-Units) verwaltet; `systemctl --user`
   steuert sie. Die Node-Version ist systemseitig fest (kein `uberspace tool`
   für Node) – der CI-Build muss darauf abgestimmt bleiben.
