# Nuola Energy Dashboard

Projekt-spezifische Hinweise für Claude Code. (Die CLAUDE.md im übergeordneten
Ordner „Nuola Solar GbR" ist allgemein und bleibt davon unberührt.)

## Workflow-Regel (verbindlich)

Nach **jeder** Code-Änderung:

1. **Lokal testen** – mindestens `npm test` (vitest) sowie `npx tsc --noEmit`; bei UI-/PDF-Änderungen zusätzlich im laufenden Dev-Server bzw. per PDF-Rendering verifizieren.
2. **Nur wenn die Tests durchlaufen** (alle grün): die Änderungen committen und auf **GitHub pushen** (`git push`).
3. Schlägt ein Test fehl, **nicht** pushen – erst die Ursache beheben (oder Rücksprache halten), dann erneut testen.

## Architecture

### High-Level-Überblick
- Zweck: Web-App der Nuola Solar GbR, die den Stromverbrauch von Mietparteien über **Shelly Pro 3EM** Geräte (via **Shelly Cloud API**) erfasst, Mietern ein Dashboard bietet und § 14 UStG-konforme Jahres-/Schlussrechnungen als PDF erzeugt.
- Systemgrenzen: Ein Docker-Image mit zwei Prozessen (Next.js-Webserver + Polling-Worker), **SQLite** als DB, hinter einem externen Reverse-Proxy (nginx/SWAG, TLS). Externe Schnittstellen: Shelly Cloud API (ausgehend), SMTP (ausgehend). Kein weiterer Backend-Service.
- Stack: Next.js 15 (App Router, RSC + Server Actions), TypeScript (strict), Prisma ORM, `@react-pdf/renderer`, `iron-session`, `nodemailer`, `recharts`, `node-cron`, `bcryptjs`, `zod`, `vitest`.

### Modul-/Ordnerstruktur
- `prisma/schema.prisma` — Datenmodell (SQLite, bewusst ohne SQLite-Spezifika für späteren Postgres-Wechsel). `seed.ts` (Admin+Grunddaten), `demo-seed.ts` (Testdaten).
- `src/app/(admin)/admin/**` — Admin-Bereich (Objekte, Einheiten, Geräte, Mietparteien, Abschläge, Steuersätze, Rechnungen, Einstellungen, Übersicht). Je Ressource: `page.tsx` (RSC), `actions.ts` (Server Actions), `*Form.tsx` (Client-Komponenten). Die Objekt-Seite (`objekte/page.tsx`) ist der gemeinsame Stammdaten-Hub: Übersicht aller Objekte inkl. ihrer Einheiten UND Geräte plus Anlegen aller drei über `StammdatenAnlegenPanel` (Buttons klappen das jeweilige Formular auf). Es gibt daher keinen eigenen Geräte-Nav-Punkt mehr; `/admin/geraete` leitet auf `/admin/objekte` um, die Detailseiten (`geraete/[id]`, `einheiten/[id]` inkl. Umbenennen) bleiben.
- `src/app/(tenant)/dashboard/**` — Mieter-Bereich (Monatsverbrauch + Chart inkl. „Stand"/letztem Messwert, Kosten-im-Jahresverlauf-Chart, Rechnungsübersicht, Reiter `profil/` zur Selbstpflege von Telefon/E-Mail).
- `src/app/e-mail-bestaetigen/[token]/**` — öffentliche Bestätigungsseite für E-Mail-Änderungen (Button-POST, nicht Auto-GET).
- `src/app/login|change-password|reset-password|access-revoked` — Auth-Flows.
- `src/app/api/**` — Route Handler für Downloads/Export (Rechnungs-PDF, Willkommensbrief-PDF, CSV-Export). Binärdaten/Streams, die nicht über Server Actions gehen.
- `src/middleware.ts` — Host-Check (gegen `APP_BASE_URL`) + rollenbasierter Seitenschutz.
- `src/lib/auth/**` — Session (`iron-session`), `guards.ts` (`requireAdmin`/`requireSession`), Passwort-Hashing, Reset-Token (SHA-256-gehasht gespeichert), Onboarding/Zugang, `emailVerification.ts` (E-Mail-Bestätigung via SHA-256-Token für Mieter-E-Mail und Firmen-Kontakt-E-Mail, Modell `EmailVerifizierung`).
- `src/lib/billing/**` — Abrechnungskern: `consumption.ts` (Verbrauch aus Zählerdifferenzen inkl. Interpolation/Schätzung), `taxSplit.ts` (MwSt.-Splitting bei Satzwechsel), `invoiceNumber.ts` (lückenlose Nummern), `generateInvoice.ts` (Entwurf), `releaseInvoice.ts` (Freigabe+Versand), `monatsverbrauch.ts`.
- `src/lib/pdf/**` — React-PDF: gemeinsames `letterLayout.tsx` (einheitlicher Briefkopf Logo-links/Absender-rechts, Empfänger-Adressfeld im Fensterumschlag-Bereich mit Anrede, Falzmarken in Nuola-Gold, einheitliche Fußzeile) – von ALLEN Brief-Arten genutzt; `invoiceDocument.tsx`/`renderInvoicePdf.tsx` (Rechnung), `welcomeLetterDocument.tsx`/`renderWelcomeLetter.tsx` (Willkommensbrief).
- `src/lib/shelly/client.ts` — Shelly-Cloud-Client (`/device/status`, Rate-Limit 1 req/s, Timeout, Profil-Normalisierung Tri-/Monophase).
- `src/lib/mail/**` — `mailer.ts` (Nodemailer, Multipart + Text-Alternative, SMTP-Test), `templates.ts` (HTML-Mails).
- `src/lib/**` (Sonstige) — `db.ts` (Prisma-Singleton), `steuer.ts` (Brutto/Netto), `mietpartei.ts` (Aktiv-Status; `mietparteiAnzeigeName`/`anredeText` - Mietpartei kann Privatperson (Pflichtfeld `name`) ODER Firma (`firma`, dann `name` optional/leer) sein, plus `anrede` Herr/Frau/Familie; Regel „Name ODER Firma" auf App-Ebene), `appHost.ts` (Host-Vergleich, rein/testbar), `appBaseUrl.ts` (Basis-URL request-abgeleitet), `clientIp.ts`, `rateLimit.ts`.
- `src/worker/**` — `index.ts` (node-cron Scheduler), `poll.ts` (ein Poll-Zyklus + Fehler-Mail).
- `tests/` — vitest gegen echte SQLite-Test-DB (Kernlogik). `Dockerfile`, `docker-entrypoint.sh`, `docker-compose.yml`, `nginx.example.conf`, `swag/`, `.github/workflows/docker-publish.yml`.

### Zentrale Design-Entscheidungen
- **Ein Image, zwei Prozesse**: Webserver (`node server.js`, Next standalone) und Worker (`tsx src/worker/index.ts`) laufen gemeinsam im Container; stirbt einer, endet der Container (`restart: unless-stopped` startet beide neu). Grund: minimaler Betriebsaufwand bei kleiner Größenordnung.
- **SQLite + Prisma**: dateibasiert im Volume, ORM-Layer austauschbar gehalten. Grund: wenige Objekte/Geräte, einfaches Backup. Nachteil: keine echte nebenläufige Schreiblast.
- **Verbrauch = Differenz kumulativer Zählerstände** (`Messwert.energyWh` je Gerät/Phase/Zeitpunkt). Robust gegen verpasste Polls. Fehlt am Stichtag ein Wert bei Lücke > ~1 Tag, wird interpoliert und als *geschätzt* markiert (§ 7 Mietvertrag).
- **Geräte ↔ Einheiten als n:m** (`GeraetZuordnung`) mit `modus ADDIEREN|SUBTRAHIEREN`: bildet mehrere Shellys pro Einheit und Allgemeinstrom-Zwischenzähler (Differenzbildung) ab.
- **Zeitlich gültige Steuersätze** (`Steuersatz.gueltigAb/Bis`, nie überschrieben) + Positions-Splitting am Stichtag → korrekte rückwirkende MwSt.
- **Defense in Depth Auth**: Middleware schützt nur Navigation; jede Admin-Server-Action ruft zuerst `requireAdmin()` (Server Actions sind eigene HTTP-Endpunkte; vgl. CVE-2025-29927).
- **Sicherheit**: Security-Header/CSP in `next.config.mjs`, In-Memory-Rate-Limiter für Login/Reset, Reset-Token nur als Hash gespeichert, Non-Root-Container (gosu + PUID/PGID) mit Laufzeit-chown der Volumes.

### Wichtige Datenflüsse
- **Erfassung**: `worker/index.ts` (cron) → `poll.ts` → `shelly/client.ts` (Cloud-Abruf) → `Messwert`-Upsert. Der Worker fragt ein Gerät nur ab, wenn seit dessen letztem Messwert das individuelle `ShellyGeraet.abrufIntervallMinuten` (Default 15) vergangen ist (Cron kann häufiger laufen). `shelly/client.ts` normalisiert die Cloud-Server-Eingabe auf den reinen Host (`normalizeShellyHost`, mit/ohne `https://`) und bietet einen Erreichbarkeitstest (`pruefeGeraetErreichbar`, direkt nach dem Anlegen). Fehler je Gerät isoliert; pro Zyklus optional gedrosselte Fehler-Mail (`FirmenStammdaten.shellyFehlerEmail`).
- **Abrechnung**: `generateInvoice.ts` → `consumption.ts` (kWh + Zählerstände + Schätz-Flag) + `taxSplit.ts` + `invoiceNumber.ts` → `Rechnung`+`Rechnungsposition` (Status ENTWURF). Freigabe: `releaseInvoice.ts` → `renderInvoicePdf.tsx` (PDF ins Volume, nicht public) → Status VERSENDET + `mail/`.
- **UI**: RSC-`page.tsx` lesen via `lib/db` (Prisma); Mutationen ausschließlich über Server Actions (`actions.ts`), die `revalidatePath` aufrufen; Client-Formulare nutzen `useActionState`.
- **Auth**: `login/actions.ts` → `iron-session`-Cookie `{userId, role, mustChangePassword}` → `middleware.ts` + `guards.ts` werten es aus.

### Konventionen
- **Sprache**: Bezeichner und Kommentare deutsch; Prisma-Modelle deutsch.
- **Server Actions**: Signatur `(prevState, formData) => Promise<State>`, `State` enthält `error?`/`success?`/Daten; erste Zeile bei Admin-Actions `await requireAdmin()`. Redirect-Nebenwirkungen nicht in try/catch um `redirect()`.
- **Fehlerbehandlung**: Nutzerfehler als `{ error }`-State (kein throw); erwartete technische Fehler (SMTP) werden abgefangen und als Hinweis zurückgegeben, nicht fatal.
- **Env**: Pflicht-Variablen über lokale `requireEnv`-Helfer erst zur Laufzeit lesen (nicht auf Modulebene → Build). Basis-URL über `getAppBaseUrl()` (bevorzugt `APP_BASE_URL`, sonst Request-Host).
- **Geld**: `Float`, in jedem Rechenschritt auf Cent gerundet.
- **Formulare**: unkontrolliert mit `defaultValue`; bei Validierungsfehler Rohwerte zurückgeben und als `defaultValue` wieder einsetzen (React-19-Formular-Reset).
- **PDF/E-Mail**: Style-Guide-Farben (`#d9a441`/`#1c1c21`), IBM Plex; PDFs serverseitig via React-PDF, Auslieferung nur über authentifizierte Route Handler.

### Bekannte Einschränkungen / technische Schulden
- **SQLite**: nur ein Schreibprozess sinnvoll; bei Wachstum Postgres nötig.
- **Kein Migrationsverzeichnis**: `docker-entrypoint.sh` nutzt `prisma db push` (ohne `--accept-data-loss`); destruktive Schemaänderungen brechen den Start bewusst ab.
- **Geld als `Float`** statt Integer-Cents/Decimal (für aktuelle Größenordnung ausreichend).
- **In-Memory-Zustand** (Rate-Limiter, Fehler-Mail-Drosselung) wird bei Container-Neustart zurückgesetzt; kein Redis.
- **Shelly Cloud** liefert keine dokumentierte Historie → Ausfälle werden nicht rückwirkend gefüllt (nur robuste Retries/kurze Intervalle); Monatsend-Lücken werden geschätzt.
- **Storno-Workflow** (`RechnungStatus.STORNIERT`) im Modell vorgesehen, aber noch keine eigene Admin-Funktion.
- **E-Mail-Zustellbarkeit** hängt an DNS (SPF/DKIM/DMARC) außerhalb der App.

**WICHTIG:** Wenn im Rahmen dieser oder künftiger Sessions strukturelle Änderungen vorgenommen werden (neue Module, geänderte Datenflüsse, neue Design-Entscheidungen, entfernte/umbenannte Komponenten, geänderte Konventionen), aktualisiere diesen Architecture-Abschnitt in CLAUDE.md unmittelbar danach – nicht erst am Ende der Session. Halte Änderungen minimal-invasiv: nur den betroffenen Teil anpassen, nicht den gesamten Abschnitt neu schreiben. Kleinere Implementierungsdetails gehören NICHT hierhin, nur Architektur-relevante Änderungen.
