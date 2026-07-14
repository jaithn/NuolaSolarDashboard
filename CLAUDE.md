# Nuola Energy Dashboard

Projekt-spezifische Hinweise für Claude Code. (Die CLAUDE.md im übergeordneten
Ordner „Nuola Solar GbR" ist allgemein und bleibt davon unberührt.)

## Sprache / Kommunikation (verbindlich)

Dieser Chat wird **grundsätzlich auf Deutsch** geführt: alle Antworten, Erklärungen,
Zusammenfassungen, Commit-Messages und Doku auf Deutsch. (Code-Bezeichner, Prisma-Modelle
und Kommentare ebenfalls deutsch – siehe „## Architecture → Konventionen".)

### Gendern (verbindlich für alle nutzersichtbaren Texte)

Alle **nutzersichtbaren** Texte werden gegendert: UI/Admin/Mieter-Dashboard, E-Mails
und die eigene Prosa der Briefe (Anschreiben/Willkommen/SEPA) sowie deren `.md`-Vorlagen
in `Dokumente/`.

- **Bevorzugt ein geschlechtsneutrales Wort** statt der Doppelform – z. B. „Studierende"
  statt „Studenten", „Mietende"/„Mietpartei" statt „Mieter", „Nutzende" statt „Nutzer",
  „Interessierte" statt „Interessent", „Kundschaft" statt „Kunden".
- **Wo kein natürliches neutrales Wort passt, Doppelpunkt-Trennung** verwenden
  (`Mieter:innen`, `Nutzer:innen`, `Vermieter:innen`).
- Direkte Anrede mit „Sie" ist ohnehin neutral und bevorzugt.

**Ausnahme – wörtliche Rechts-/Vertragstexte:** Die aus dem DGS-Mustervertrag bzw. der
Mietvertragsergänzung übernommenen Klauseln (`Dokumente/vertrag-*.md`, Rollen wie
„Strombezieher", „Lieferant", „Mieter", „Vermieter") bleiben in ihrer juristischen
Original­fassung – dort NICHT umformulieren.

Diese Regel wird beim **Session-Abschluss** (`02 commands/session-handoff.md`) geprüft.

### Barrierefreiheit (WCAG 2.2 AA, verbindlich)

Nutzersichtbare UI muss **WCAG 2.2 Level AA** einhalten (u. a. Kontrast ≥ 4,5:1 für
normalen Text bzw. 3:1 für großen Text/UI-Komponenten, Formularfelder mit `label`,
Fokus-Sichtbarkeit, sinnvolle Überschriften-/Landmark-Struktur, `alt`-Texte, ausreichend
große Klickziele). Bei jeder UI-Änderung mitprüfen; die Einhaltung wird zusätzlich beim
**Session-Abschluss** kontrolliert (siehe `session-handoff.md`).

## Workflow-Regel (verbindlich)

Nach **jeder** Code-Änderung:

1. **Lokal testen** – mindestens `npm test` (vitest) sowie `npx tsc --noEmit`; bei UI-/PDF-Änderungen zusätzlich im laufenden Dev-Server bzw. per PDF-Rendering verifizieren. Bei nutzersichtbaren Texten/UI dabei **Gendern** und **WCAG 2.2 AA** mitprüfen (siehe Abschnitt „Sprache / Kommunikation").
2. **Sind alle Tests grün, automatisch committen und auf GitHub pushen** (`git push`) – **ohne vorher nachzufragen**. Beim Stagen selektiv vorgehen (siehe Push-Richtlinie unten). Nur wenn die Änderung fachlich unklar/riskant ist oder der Nutzer ausdrücklich um Rücksprache gebeten hat, vor dem Push kurz abstimmen.
3. Schlägt ein Test fehl, **nicht** pushen – erst die Ursache beheben (oder Rücksprache halten), dann erneut testen.

### Was gehört ins Repo (pushen) – und was nicht

**Ins Repo (versionieren & pushen):**
- Quellcode `src/`, Datenmodell `prisma/schema.prisma`, Seeds (`seed.ts`, `demo-seed.ts`), Tests `tests/`.
- Konfiguration: `package.json` **und `package-lock.json`** (feste Dependency-Versionen → reproduzierbare Docker-/CI-Builds), `tsconfig*.json`, `next.config.mjs`, ESLint-Config, `Dockerfile`, `docker-*.yml`, `nginx.example.conf`, `swag/`, `.github/`, **`.env.example`** (Vorlage ohne Secrets).
- Doku: `CLAUDE.md`, `README`.

**NICHT ins Repo (bleibt lokal, per `.gitignore` ausgeschlossen):**
- **Secrets/Umgebung:** `.env` (nur `.env.example` versionieren).
- **Laufzeit-/Kundendaten:** der Ordner `data/` – enthält die SQLite-DB **und die gerenderten Rechnungs-PDFs (personenbezogene Daten!)** –, außerdem `public/uploads/` und `prisma/data/`.
- **Generierte Artefakte:** `node_modules/`, `.next/`, `dist/`, `*.tsbuildinfo`, `coverage/`, `*.log`.
- **Editor/Tooling:** `.claude/`, `.fuse_hidden*`.
- **Marken-Assets & Session-Interna (bewusst lokal):** `01 Nuola Style Guide/` (Logos/Style Guide), `02 commands/`, `HANDOFF.md`.

**Grundsatz:** Beim Stagen **selektiv** vorgehen (`git add -u` für getrackte Änderungen + `git add src/ …` für neue Quellcode-Dateien), **nie blind `git add -A`** – sonst landen untrackte lokale Ordner (Style Guide, Handoff) oder Kundendaten versehentlich im Repo. Vor jedem Push mit `git status` prüfen, dass wirklich nur Code/Config gestaged ist.

## Befehle

Wiederverwendbare Session-Befehle liegen im (lokalen, nicht versionierten) Ordner `02 commands/`. Wird einer davon aufgerufen, führe die darin beschriebenen Schritte aus:

- **`session-start.md`** – Session-Einstieg: Kontext setzen (CLAUDE.md + HANDOFF.md lesen), **funktionierende lokale Testumgebung sicherstellen** (Node im PATH, Dependencies, Test-DB, `npm test`/`tsc` grün), offene Aufgaben aus `HANDOFF.md` prüfen und – nach Rücksprache – abarbeiten.
- **`session-handoff.md`** – vollständiger Session-Abschluss: **Schritt 0** prüft zuerst, ob alle Änderungen getestet **und** auf GitHub gepusht sind (sonst zuerst nachholen); danach Architektur-Abschnitt in CLAUDE.md aktualisieren, `HANDOFF.md` schreiben, prüfen ob `session-start.md` angepasst werden muss und optional `/clear` anbieten.
- **`handoff.md`** – schreibt nur den Übergabe-Snapshot `HANDOFF.md`.
- **`architecture-sync.md`** – aktualisiert ausschließlich den `## Architecture`-Abschnitt dieser CLAUDE.md.

## Versionierung

Die im Admin (Einstellungen → Version) angezeigte Version entspricht der
GitHub-/Docker-Image-Version. Quelle ist die beim Build gesetzte
`NEXT_PUBLIC_APP_VERSION` (CI: exakte Image-Version; lokal: `git describe --tags`;
Fallback `package.json`). Siehe `src/lib/version.ts`, `next.config.mjs`,
`Dockerfile`, `.github/workflows/docker-publish.yml`.

**Changelog & Image-Beschreibung:** Nennenswerte Änderungen werden in `CHANGELOG.md`
(neueste zuerst) gepflegt. Der Workflow baut daraus je Image die
`org.opencontainers.image.description` (Produkttext + oberste CHANGELOG-Sektion als
„Neu in dieser Version") – sichtbar auf der GHCR-Package-Seite. Neue Version →
oberste Sektion im CHANGELOG aktualisieren.

**Build-Kontrolle nach dem Push:** `npm run ci:build-status` (`scripts/ci-build-status.sh`)
prüft den GitHub-Actions-Image-Build für den aktuellen Commit, wartet auf den Abschluss
und liest bei Fehler die betroffenen Jobs/Schritte + Fehler-Annotationen aus (nutzt `gh`
falls vorhanden, sonst die öffentliche REST-API; Repo ist public).

**Schema `MAJOR.MINOR.PATCH`** (Semantic Versioning):
- **PATCH** – automatisch je `main`-Push: Patch = GitHub-Action-Lauf-Nummer
  (`VERSION_MAJOR_MINOR.<lauf-nr>`). Für Bugfixes/kleine, rückwärtskompatible Änderungen.
- **MINOR** – neue, rückwärtskompatible Funktionen. Bei Bedarf `VERSION_MAJOR_MINOR`
  im Workflow anheben (z. B. `1.0` → `1.1`) oder Release-Tag `vX.Y.0` pushen.
- **MAJOR (Sprung auf neue Hauptnummer)** – nur bei **nicht rückwärtskompatiblen**
  Änderungen. Auslöser (mindestens einer):
  - **Destruktive DB-Schemaänderung** – Datenverlust bzw. manuelle Migration nötig
    (`prisma db push` würde Spalten/Tabellen mit Daten entfernen; vgl. bewusster
    Abbruch ohne `--accept-data-loss`).
  - **Inkompatible Betriebs-/Deployment-Änderung** – neue Pflicht-Env-Variable ohne
    Default, geänderte Volume-/Ports-/Reverse-Proxy-Anforderungen, Bruch der
    Container-Startsequenz.
  - **Entfernte/umbenannte öffentliche Route, API oder Kernfunktion**, auf die Nutzer
    oder externe Integrationen angewiesen sind.

  Vorgehen für einen MAJOR-Sprung: `VERSION_MAJOR_MINOR` im Workflow auf die neue
  Hauptnummer setzen (z. B. `2.0`) **und** einen Release-Tag `v2.0.0` pushen; die
  Breaking Changes in `HANDOFF.md`/Release-Notes klar benennen.

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
- `src/app/api/**` — Route Handler für Downloads/Export (Rechnungs-PDF, Willkommensbrief-PDF, CSV-Export, **Onboarding-PDFs** `mietparteien/[id]/onboarding-pdf/[dok]` (anschreiben|vertrag-eigenstaendig|vertrag-ergaenzung|sepa - beide Verträge werden immer erzeugt), **gescannte Dokumente** `mietparteien/[id]/dokument/[dokId]`). Binärdaten/Streams, die nicht über Server Actions gehen.
- `src/middleware.ts` — Host-Check (gegen `APP_BASE_URL`) + rollenbasierter Seitenschutz.
- `src/lib/auth/**` — Session (`iron-session`), `guards.ts` (`requireAdmin`/`requireSession`), Passwort-Hashing, Reset-Token (SHA-256-gehasht gespeichert), Onboarding/Zugang, `emailVerification.ts` (E-Mail-Bestätigung via SHA-256-Token für Mieter-E-Mail und Firmen-Kontakt-E-Mail, Modell `EmailVerifizierung`).
- `src/lib/billing/**` — Abrechnungskern: `consumption.ts` (Verbrauch aus Zählerdifferenzen inkl. Interpolation/Schätzung), `taxSplit.ts` (MwSt.-Splitting bei Satzwechsel), `invoiceNumber.ts` (lückenlose Nummern, Format `NuolaSolar-Strom-{Jahr}-{Nummer:04d}`), `generateInvoice.ts` (Entwurf + `pruefeKeineUeberschneidung`-Duplikatsperre + `erstelleEntwuerfeFuerAktiveEinheiten`-Batch), `releaseInvoice.ts` (Freigabe: Nummernvergabe + Versand + Fehlerprotokoll), `storno.ts` (Stornorechnung), `deleteDraft.ts` (Entwurf löschen), `monatsverbrauch.ts`.
- `src/lib/pdf/**` — React-PDF: gemeinsames `letterLayout.tsx` (einheitlicher Briefkopf Logo-links/Absender-rechts, Empfänger-Adressfeld im Fensterumschlag-Bereich mit Anrede, Falzmarken in Nuola-Gold, einheitliche Fußzeile) – von ALLEN Brief-Arten genutzt; `format.ts` (gemeinsame Betrag-/Datums-/Prozent-Formatierung); `invoiceDocument.tsx`/`renderInvoicePdf.tsx` (Rechnung), `welcomeLetterDocument.tsx`/`renderWelcomeLetter.tsx` (Willkommensbrief). **Onboarding-Briefe** (`renderOnboardingPdfs.tsx` als gemeinsamer Loader/Dispatcher): `onboardingLetterDocument.tsx` (Anschreiben mit Konditionen, Grundversorger-Vergleich brutto inkl. % Vorteil, Gebäudestrom-Passus § 42b EnWG, telefonische Rückfrage-Einladung; **zwei auswählbare Varianten** `anschreiben`=formal / `anschreiben-persoenlich`=persönlich-familiär – gleiches Layout, unterschiedliche Texte (eigener BriefVorlage-Schlüssel), editierbare Grußformel/Unterschrift via `gruss`/`unterschrift`-Abschnitt, Platzhalter u. a. `{vermieter}`/`{objektadresse}`), `contractDocument.tsx` (**zwei Varianten**: `eigenstaendig` = Nuola-Layout, Gegenpartei Firma; `ergaenzung` = schlichtes Layout ohne Nuola-Bezug, Gegenpartei Vermieter), `sepaMandateDocument.tsx` (SEPA-Basislastschriftmandat). `markdown.tsx` = Mini-Markdown→React-PDF-Renderer für den versionierten Vertragstext. **Alle Brieftexte** (Anschreiben/SEPA/Willkommen) sind editierbar: die Prosa-Abschnitte kommen aus `BriefVorlage` (DB), die Layouts/dynamischen Tabellen bleiben im Code; fehlt ein Abschnitt, greift ein Standardtext.
- `src/lib/shelly/client.ts` — Shelly-Cloud-Client (`/device/status`, Rate-Limit 1 req/s, Timeout, Profil-Normalisierung Tri-/Monophase).
- `src/lib/mail/**` — `mailer.ts` (Nodemailer, Multipart + Text-Alternative, SMTP-Test), `templates.ts` (HTML-Mails).
- `src/lib/dokumente.ts` — Ablage/Download gescannter Onboarding-Rückläufer (Vertrag/SEPA) im `data`-Volume (`data/mietparteien/<mietparteiId>/…`, nicht public), Modell `MietparteiDokument`, Path-Traversal-Schutz + Typ-/Größenprüfung (PDF/JPG/PNG, max. 20 MB; muss zu `serverActions.bodySizeLimit` in `next.config.mjs` passen).
- **Editierbare Texte (`Dokumente/`-Ordner + Sync)** — `Dokumente/*.md` sind die bearbeitbaren Master-Texte (zwei Verträge je Version mit YAML-Front-Matter + drei Briefe mit `## schluessel`-Abschnitten). `dokumenteVorlagen.ts` (reine Parser: Front-Matter, Abschnitte, Platzhalter – testbar), `dokumenteSync.ts` (`syncDokumenteVorlagen()`: .md → DB, füllt `VertragVersion` inkl. automatischer Historie/Gültigkeit und `BriefVorlage`; idempotent), `briefVorlagen.ts` (lädt Brief-Abschnitte aus der DB), `vertrag.ts` (`aktiveVertragVersion`, `VERTRAGSART_LABEL`). Sync-Auslöser: `npm run sync:dokumente` (`scripts/sync-dokumente.ts`), automatisch beim Container-Start (`docker-entrypoint.sh`) und im Seed, sowie per Button unter Admin → Einstellungen → Vertragstexte. **Ordner konfigurierbar** über `DOKUMENTE_DIR` (Default `Dokumente/` im Projekt-Root); im **Docker-Betrieb** liegt der Ordner im **Data-Volume** (`/app/data/Dokumente`, vom Server-Dateisystem aus bearbeitbar): der Entrypoint spiegelt den ins Image gebackenen `/app/Dokumente` per `cp -n` dorthin (neue Dateien werden ergänzt, bereits vorhandene/bearbeitete NICHT überschrieben) und setzt `DOKUMENTE_DIR` – Sync und der Admin-Button lesen dann von dort.
- `src/lib/**` (Sonstige) — `db.ts` (Prisma-Singleton), `steuer.ts` (Brutto/Netto), `mietpartei.ts` (Aktiv-Status; `mietparteiAnzeigeName`/`anredeText`/`anredeSatz`; `mietparteiPostanschrift` = Brief-Empfaengeranschrift aus Mietpartei-Anschrift mit Fallback auf Objektadresse - Mietpartei ist natuerliche Person (`vorname`+`name`, Anrede Herr/Frau/Familie) ODER Firma (Anrede `FIRMA`, `firma` als Bezeichner, Name/Vorname leer); die Anrede ist Diskriminator, Konsistenz auf App-Ebene erzwungen), `kundennummer.ts` (`vergibKundennummerFallsNoetig` - fortlaufende Kundennummer max+1, wird schon beim Anlegen jeder Mietpartei vergeben - auch Interessent:innen), `sepa.ts` (`mandatsreferenz(kundennummer)` = `NUOLA-<Nr>`), `version.ts` (App-/Image-Version, GitHub-Links, `NEXT_PUBLIC_BUILD_DATE`), `appHost.ts` (Host-Vergleich, rein/testbar), `appBaseUrl.ts` (Basis-URL request-abgeleitet), `clientIp.ts`, `rateLimit.ts`.
- `src/worker/**` — `index.ts` (node-cron Scheduler), `poll.ts` (ein Poll-Zyklus + Fehler-Mail).
- `tests/` — vitest gegen echte SQLite-Test-DB (Kernlogik). `Dockerfile`, `docker-entrypoint.sh`, `docker-compose.yml`, `nginx.example.conf`, `swag/`, `.github/workflows/docker-publish.yml`.
- `scripts/` — Node-/Shell-Hilfsskripte: `sync-dokumente.ts` (Vorlagen-Sync, siehe unten), `ci-build-status.sh` (GitHub-Actions-Image-Build nach dem Push prüfen). `CHANGELOG.md` = Versions-Historie (speist die Image-Beschreibung, siehe „Versionierung").

### Zentrale Design-Entscheidungen
- **Ein Image, zwei Prozesse**: Webserver (`node server.js`, Next standalone) und Worker (`tsx src/worker/index.ts`) laufen gemeinsam im Container; stirbt einer, endet der Container (`restart: unless-stopped` startet beide neu). Grund: minimaler Betriebsaufwand bei kleiner Größenordnung.
- **SQLite + Prisma**: dateibasiert im Volume, ORM-Layer austauschbar gehalten. Grund: wenige Objekte/Geräte, einfaches Backup. Nachteil: keine echte nebenläufige Schreiblast.
- **Verbrauch = Differenz kumulativer Zählerstände** (`Messwert.energyWh` je Gerät/Phase/Zeitpunkt). Robust gegen verpasste Polls. Fehlt am Stichtag ein Wert bei Lücke > ~1 Tag, wird interpoliert und als *geschätzt* markiert (§ 7 Mietvertrag).
- **Geräte ↔ Einheiten als n:m** (`GeraetZuordnung`) mit `modus ADDIEREN|SUBTRAHIEREN`: bildet mehrere Shellys pro Einheit und Allgemeinstrom-Zwischenzähler (Differenzbildung) ab.
- **Zeitlich gültige Steuersätze** (`Steuersatz.gueltigAb/Bis`, nie überschrieben) + Positions-Splitting am Stichtag → korrekte rückwirkende MwSt.
- **Rechnungsnummer erst bei Freigabe** (§ 14 UStG/GoBD): Entwürfe haben `rechnungsnummer = null`, die lückenlose Nummer wird erst in `releaseInvoice.ts` vergeben – so hinterlässt das Löschen eines Entwurfs (`deleteDraft.ts`) keine Lücke. Duplikatsperre pro Einheit+Zeitraum (`pruefeKeineUeberschneidung`). Freigegebene Rechnungen sind unveränderlich; Korrektur ausschließlich über **Storno** (`storno.ts`: eigene Nummer, negierte Beträge, Original → `STORNIERT`) + neue Rechnung. Rechnungsnummern haben das Format `NuolaSolar-Strom-{Jahr}-{Nummer:04d}` (ein einziger, lückenloser Nummernkreis pro Jahr).
- **Einheiten-Typen (Allgemeinstrom/Waermepumpe)**: `Einheit.typ` (`EinheitTyp`: `WOHNEINHEIT` | `ALLGEMEINSTROM` | `WAERMEPUMPE`). Sonder-Einheiten (Allgemeinstrom = Gemeinschaftsstrom, Partei i.d.R. Vermieter:in; Waermepumpe) sind bewusst als eigene Einheiten modelliert (statt einer neuen Entitaet), damit die bestehende Zaehler-/Abrechnungsmechanik (`GeraetZuordnung`, `consumption.ts`, Rechnung je Einheit) unveraendert weiterlaeuft. Sie tragen keine Vermieter-per-Einheit-Angabe und keine Mietvertrags-Ergaenzung; die Partei bekommt einen eigenstaendigen Stromliefervertrag. `Objekt.hatWaermepumpe` dokumentiert die Abfrage beim Anlegen. Typ + Beschriftung in `objekte/einheitTyp.ts` (reines Modul, damit Server-Komponenten es ohne Client-Grenze importieren; UI-Feld in `objekte/EinheitTypFeld.tsx`). Der getrennte Rechnungsausweis Allgemeinstrom vs. Waermepumpe ist noch offen (siehe HANDOFF.md).
- **Kundennummer & SEPA**: `Mietpartei.kundennummer` (kein DB-Unique, da nachtraeglicher Constraint den Container-Start `prisma db push` ohne `--accept-data-loss` braeche - Eindeutigkeit per fortlaufender Vergabe) wird bereits beim **Anlegen** jeder Mietpartei vergeben (auch Interessent:innen) und ist Basis der SEPA-Mandatsreferenz - so ist die Referenz auf dem Onboarding-SEPA-Mandat sofort vorhanden. Die SEPA-Glaeubiger-ID liegt zentral in `FirmenStammdaten.glaeubigerId` (fuer alle Mandate gleich); beide werden auf dem SEPA-Mandat eingedruckt, wenn hinterlegt.
- **Abschlag als Brutto-Betrag**: Der monatliche Abschlag wird brutto (inkl. MwSt.) erfasst - das ist der per SEPA eingezogene und in Vertrag/Anschreiben genannte Betrag. `Abschlag.bruttoBetrag` (nullable, für Alt-Datensätze) ist die massgebliche Quelle; `nettoBetrag` wird daraus abgeleitet (`steuer.ts:berechneNettoAusBrutto`, fürs MwSt.-Splitting in der Abrechnung). Anzeige/Abrechnung nutzen `bruttoBetrag ?? berechneBrutto(nettoBetrag)`. Eingabe über `GrossPriceInput` (Brutto + Steuersatz, zeigt Netto/MwSt.). Ein neuer Abschlag beendet den vorherigen automatisch am Tag vor seinem Gültigkeitsbeginn (`createAbschlagAction`).
- **Briefkopf/-fuss (alle Briefe)**: `pdf/letterLayout.tsx` liefert `LetterHeader` (Firma + optional Bearbeiter:in/Kundennummer via `BriefkopfZusatz`), `EmpfaengerAdresse` (kleine Absenderzeile im Sichtfenster, Anrede nur bei Familie), `OrtDatumZeile` (Firmenort + Datum, rechtsbuendig unter dem Betreff), eine dreizeilige `LetterFooter` und `Seitenzahl` ("Seite X von Y", nur bei mehrseitigen Briefen). Der `LetterHeader` ist `fixed` und **wiederholt sich auf jeder Seite** (kompletter Briefkopf); so beginnt der Text auf Folgeseiten tief wie bei einem normalen Brief. Datum ueberall via `pdf/format.ts:fmtDate` als `DD.MM.YYYY`.
  - **react-pdf-4.5.1-Fallstricke (wichtig):** Der `render`-Callback der `Seitenzahl` (fuer `pageNumber`/`totalPages`) wird nur ausgewertet, wenn (a) `Seitenzahl` ein **direktes Kind der `<Page>`** ist, (b) einen **Inline-Style** hat (keine `StyleSheet.create`-Referenz) und (c) die **`<Page>` KEIN `lineHeight`** traegt. Deshalb ist der Seiten-Style ein einfaches Objekt `pageStyle` (nicht in `letterStyles`), und der Zeilenabstand 1,5 wird ueber `letterStyles.section`/`s.passus`/Markdown gesetzt statt auf der Page. Jedes Dokument bindet `<Seitenzahl/>` als letztes Page-Kind neben `<LetterFooter/>` ein.
- **Onboarding / Interessent**: `MietverhaeltnisStatus.INTERESSENT` ist ein eigener Status VOR `AKTIV`/`INAKTIV`. Ein Interessent ist bewusst nie „effektiv aktiv" (`isMietparteiEffectivelyAktiv` liefert für alles ≠ AKTIV `false`) → kein Login, keine Abrechnung, kein Polling; er nutzt aber schon die vollen Stammdaten (Preise, Abschlag) für die Onboarding-PDFs. Der Grundversorger-Vergleich liegt als optionale Felder direkt an der `Mietpartei` (brutto). Statuswechsel (`setMietparteiStatusAction`) + Scan-Upload (`uploadDokumentAction`) laufen über das `OnboardingPanel` der Detailseite; Scans sind für die Aktivierung **nicht** verpflichtend (nur Hinweis bei fehlendem Vertrag/SEPA). Direktes Anlegen als `AKTIV` bleibt möglich.
- **Vertragsarten & Versionierung**: Zwei Vertragsarten (`VertragArt`): `EIGENSTAENDIG` (Nuola-Layout, Gegenpartei = Firma) und `ERGAENZUNG` (schlichtes Layout ohne Nuola-Bezug, Gegenpartei = Vermieter). Die beiden Dokumente sind bewusst widerspruchsfrei aufeinander abgestimmt: der **Stromliefervertrag** (`eigenstaendig`) regelt Preise/Preisanpassung/Abschläge/Abrechnung/Laufzeit vollständig und trägt als einziger die vom Code erzeugte Konditionen-Box (Überschrift „Anfängliche Konditionen"); die **Mietvertrags-Ergänzung** (`ergaenzung`) enthält nur noch Stromversorgung, Strompreis und Beendigung und verweist für die Details auf den Stromliefervertrag (keine Konditionen-Box). Die Unterschriftenzeile bietet **beiden Parteien je eine Ort-/Datum-Zeile**, der Ort ist mit dem hinterlegten Ort der jeweiligen Partei vorbelegt (`strombezieherOrt`/`gegenparteiOrt` aus `renderOnboardingPdfs.tsx`). Der Vermieter ist je Objekt organisiert (`Objekt.vermieterModus`): `PRO_OBJEKT` → ein Vermieter fürs ganze Objekt (`Objekt.vermieterName/-Anschrift`); `PRO_EINHEIT` (Objekt aus mehreren Eigentumswohnungen) → je Wohneinheit ein eigener Vermieter (`Einheit.vermieterName/-Anschrift`). Abgefragt beim Anlegen/Bearbeiten von Objekt bzw. Einheit; die PDF-Auflösung (`renderOnboardingPdfs.tsx`) wählt anhand des Modus die Quelle. **Für jede Mietpartei werden IMMER beide Verträge erzeugt** (eigenständiger Stromliefervertrag UND Ergänzung zum Mietvertrag); die frühere Auswahl „Vertragsart" an der Mietpartei ist damit obsolet und wurde aus dem Formular entfernt (das DB-Feld `Mietpartei.vertragsart` bleibt ungenutzt bestehen, `setSignierteVersionAction`/`versionFuerMietpartei` sind entfallen). Beide Verträge werden vom Mieter unterschrieben. Vertragstexte sind **versioniert** (`VertragVersion`, Text als Markdown): je Art genau eine aktuell gültige Version (`gueltigBis = null`), ältere bleiben als Historie (analog `Steuersatz`); eine neue Version (neue `…-vX.Y.md` + Sync) beendet die vorherige automatisch am Tag vor deren `gueltigAb`. Das PDF nutzt je Art die aktive Version (`aktiveVertragVersion(art)`); unterschriebene Scans über das `OnboardingPanel`. Bei aktiven Mietparteien heißt der Panel-Abschnitt „Vertragsunterlagen" (statt „Onboarding") und der Status-Block entfällt.
- **Theme (Hell/Dunkel)** über CSS-Variablen: Auswahl im Cookie `theme`, vom Root-Layout serverseitig als `data-theme` gesetzt (flackerfrei); ohne Cookie entscheidet `prefers-color-scheme`. Marke/Logo bleiben, dunkles Logo bekommt im Dark-Mode einen hellen Chip.
- **Defense in Depth Auth**: Middleware schützt nur Navigation; jede Admin-Server-Action ruft zuerst `requireAdmin()` (Server Actions sind eigene HTTP-Endpunkte; vgl. CVE-2025-29927).
- **Sicherheit**: Security-Header/CSP in `next.config.mjs`, In-Memory-Rate-Limiter für Login/Reset, Reset-Token nur als Hash gespeichert, Non-Root-Container (gosu + PUID/PGID) mit Laufzeit-chown der Volumes.

### Wichtige Datenflüsse
- **Erfassung**: `worker/index.ts` (cron) → `poll.ts` → `shelly/client.ts` (Cloud-Abruf) → `Messwert`-Upsert. Der Worker fragt ein Gerät nur ab, wenn seit dessen letztem Messwert das individuelle `ShellyGeraet.abrufIntervallMinuten` (Default 15) vergangen ist (Cron kann häufiger laufen). `shelly/client.ts` normalisiert die Cloud-Server-Eingabe auf den reinen Host (`normalizeShellyHost`, mit/ohne `https://`) und bietet einen Erreichbarkeitstest (`pruefeGeraetErreichbar`, direkt nach dem Anlegen). Fehler je Gerät isoliert; pro Zyklus optional gedrosselte Fehler-Mail (`FirmenStammdaten.shellyFehlerEmail`).
- **Abrechnung**: `generateInvoice.ts` → `consumption.ts` (kWh + Zählerstände + Schätz-Flag) + `taxSplit.ts` → `Rechnung`+`Rechnungsposition` (Status ENTWURF, ohne Nummer). Freigabe: `releaseInvoice.ts` vergibt die Nummer (`invoiceNumber.ts`), rendert das finale PDF (`renderInvoicePdf.tsx`, PDF ins Volume, nicht public), setzt Status FREIGEGEBEN und versucht den Mailversand; nur bei Erfolg → VERSENDET, sonst bleibt FREIGEGEBEN mit `emailFehler` (in der UI „erneut senden"). Alle Briefe teilen sich `pdf/letterLayout.tsx`.
- **E-Mail-Verifizierung**: Mieter-Profil bzw. Firmen-Kontakt-E-Mail → `auth/emailVerification.ts` (SHA-256-Token, Modell `EmailVerifizierung`) → Bestätigungslink `/e-mail-bestaetigen/[token]` (Button-POST) übernimmt die neue Adresse.
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
- **Storno/Korrektur** ist umgesetzt (Stornorechnung + neue Rechnung).
- **E-Mail-Zustellbarkeit** hängt an DNS (SPF/DKIM/DMARC) außerhalb der App.

**WICHTIG:** Wenn im Rahmen dieser oder künftiger Sessions strukturelle Änderungen vorgenommen werden (neue Module, geänderte Datenflüsse, neue Design-Entscheidungen, entfernte/umbenannte Komponenten, geänderte Konventionen), aktualisiere diesen Architecture-Abschnitt in CLAUDE.md unmittelbar danach – nicht erst am Ende der Session. Halte Änderungen minimal-invasiv: nur den betroffenen Teil anpassen, nicht den gesamten Abschnitt neu schreiben. Kleinere Implementierungsdetails gehören NICHT hierhin, nur Architektur-relevante Änderungen.
