# Claude Code Prompt: Shelly Pro 3EM Stromverbrauchs-Dashboard

Kopiere den folgenden Prompt (ab "## Projektauftrag") direkt in Claude Code.

---

## Projektauftrag

Baue eine Webanwendung für die Nuola Solar GbR, die den Stromverbrauch mehrerer Shelly Pro 3EM Messgeräte ausliest und Mietparteien in mehreren Gebäuden ihren monatlichen Verbrauch sowie eine jährliche Verbrauchsabrechnung in einem Dashboard anzeigt.

### Kontext

- Nuola Solar GbR betreibt PV-Anlagen und vermietet Einheiten in mehreren Objekten.
- Aktuell zwei Objekte: "Olfen" (ca. 4 Shelly Pro 3EM) und "Köln-Buchforst" (ca. 8 Shelly Pro 3EM). Diese Zahlen ändern sich künftig — Objekte, Einheiten und Geräte müssen im laufenden Betrieb hinzugefügt, bearbeitet und entfernt werden können.
- Der Server, auf dem die Anwendung läuft, befindet sich NICHT im selben Netzwerk wie die Shelly-Geräte. Die Geräte müssen daher über die **Shelly Cloud API** ausgelesen werden (nicht per lokalem REST/WebSocket-Zugriff).
- Abrechnungsmodell: **reine Verbrauchserfassung** — kein PV-Eigenverbrauchsanteil, keine Aufteilung zwischen Netzbezug und Eigenerzeugung. Es wird einfach der gemessene Verbrauch pro Einheit erfasst und mit einem konfigurierbaren Arbeitspreis (€/kWh) sowie optional einem Grundpreis abgerechnet.
- Deployment ausschließlich per **Docker Compose** — ein `docker compose up` soll die komplette Anwendung starten.
- Ein Reverse-Proxy (nginx) läuft bereits extern/außerhalb der Compose-Umgebung — die Anwendung muss dafür KEINEN eigenen Reverse-Proxy-Service mitbringen, sondern lediglich einen Port bereitstellen, der vom externen nginx angesprochen werden kann.
- Als Datenbank soll **SQLite** verwendet werden (Datei-basiert, im Compose-Volume persistiert) statt eines eigenen DB-Servers — passend zur aktuellen Größenordnung (2 Objekte, ca. 12 Geräte, kleine Mieterzahl): weniger Container, einfaches Backup (Datei kopieren), geringerer Ressourcenverbrauch. Nachteil: keine echte nebenläufige Schreiblast aus mehreren Prozessen und schwerer horizontal skalierbar — bei starkem Wachstum (viele weitere Objekte/Standorte, mehrere App-Instanzen) wäre ein Wechsel auf PostgreSQL sinnvoll. Das Datenbankzugriffs-Layer soll daher austauschbar/ORM-basiert implementiert werden, um einen späteren Wechsel zu erleichtern.

### Kernfunktionen

**1. Datenerfassung**
- Regelmäßiges Abfragen der Shelly Cloud API für alle registrierten Geräte (konfigurierbares Intervall, z. B. alle 5–15 Minuten).
- Persistierung der Messwerte als Zeitreihe (Zeitstempel, Gerät, Wirkleistung/Energie kWh).
- Robuste Fehlerbehandlung: Gerät offline, API-Timeout, ungültige Antwort — Fehler loggen, Erfassung fortsetzen, keine Datenlücken durch Abstürze.
- Nachträgliches Auffüllen von Datenlücken, falls die Shelly Cloud API historische Daten für den Ausfallzeitraum liefern kann.

**2. Stammdatenverwaltung / Mieterverwaltung (Admin-Bereich)**
- CRUD für Objekte (Gebäude): Name, Adresse.
- CRUD für Einheiten (Wohnungen) innerhalb eines Objekts: Bezeichnung, zugeordnete Shelly-Geräte.
- CRUD für Mietparteien (Personen/Haushalte): Kontaktdaten (Name, E-Mail, Telefon, Anschrift), Zuordnung zu einer Wohnung/Einheit, Einzugs- und Auszugsdatum, Arbeitspreis (€/kWh), optional Grundpreis, **monatlicher Abschlag (€, editierbar, mit Gültigkeitszeitraum/Historie da sich der Abschlag im Zeitverlauf ändern kann)**, Status des Mietverhältnisses (**aktiv/inaktiv**, automatisch oder manuell steuerbar anhand Ein-/Auszugsdatum). Eine Wohnung kann im Zeitverlauf mehrere Mietparteien nacheinander haben (Mieterwechsel) — die Historie muss erhalten bleiben.
- Der monatliche Abschlag wird direkt im Mietparteien-Datensatz gepflegt (nicht durch den Mieter selbst editierbar) und dient als Grundlage für die spätere Verrechnung in der Jahresabrechnung.
- **MwSt.-transparente Preiseingabe:** Bei der Eingabe von Arbeitspreis, Grundpreis und Abschlag im Admin-Bereich muss ersichtlich sein, wie sich der Preis zusammensetzt. Konkret:
  - Eingabe erfolgt als **Netto-Betrag** plus Auswahl des anzuwendenden **Steuersatzes** (Dropdown, z. B. 19 % / 7 % / 0 %, Steuersätze als Stammdaten pflegbar statt hartcodiert).
  - Direkt neben dem Eingabefeld wird live die daraus resultierende **Brutto-Summe** (Netto + MwSt.-Betrag = Brutto) angezeigt, sodass beim Erfassen sofort erkennbar ist, wie sich der Preis zusammensetzt (Netto, MwSt.-Satz, MwSt.-Betrag, Brutto jeweils einzeln sichtbar).
  - Diese Aufschlüsselung gilt einheitlich für Arbeitspreis (€/kWh), Grundpreis und monatlichen Abschlag.
- **Zeitlich gültige MwSt.-Sätze (gesetzliche Änderungen):** Steuersätze werden nicht als einzelner fester Wert gepflegt, sondern als eigene Verwaltungsseite im Admin-Bereich mit **Gültig-ab-Datum** (z. B. "19 % gültig ab 01.01.2007", "16 % gültig 01.07.2020–31.12.2020"). Der Admin kann jederzeit einen neuen Satz mit zukünftigem Gültigkeitsdatum anlegen, ohne bestehende historische Sätze zu löschen oder zu überschreiben — für die korrekte rückwirkende Berechnung bereits erstellter Rechnungen müssen die zum jeweiligen Ausstellungs-/Leistungszeitpunkt gültigen Sätze erhalten bleiben.
  - Bei der Preiseingabe (Arbeitspreis, Grundpreis, Abschlag) wird automatisch der zum aktuellen Datum gültige Steuersatz vorgeschlagen, ist aber bei Bedarf überschreibbar.
  - Bei der **Rechnungserstellung** wird für jede Position automatisch der zum jeweiligen Leistungsdatum gültige Satz herangezogen. Falls sich der Steuersatz **während eines Abrechnungszeitraums ändert**, muss die betroffene Position technisch am Stichtag der Satzänderung gesplittet und mit dem jeweils korrekten Satz anteilig berechnet werden (z. B. Verbrauch Jan–Jun mit altem Satz, Jul–Dez mit neuem Satz).
- CRUD für Shelly-Geräte: Zuordnung zu Objekt und Einheit, Shelly Cloud Device-ID, Auth-Token/Server-URL, Bezeichnung, Kanal-Mapping (Pro 3EM hat 3 Phasen — festlegen, ob alle drei Phasen zusammen den Verbrauch einer Einheit ergeben oder einzeln zugeordnet werden).
- Möglichkeit, ein Gerät temporär zu deaktivieren (z. B. bei Wechsel/Defekt), ohne historische Daten zu verlieren.

**3. Mieter-Onboarding & Zugangsdaten**
- Admin kann für eine Mietpartei einen Zugang anlegen: System generiert einen Benutzernamen sowie ein zufälliges **Einmal-Passwort**.
- Zugangsdaten werden dem Mieter per E-Mail zugestellt (SMTP-Konfiguration über `.env`); Einmal-Passwort muss beim ersten Login zwingend geändert werden.
- Mieter können ihr Passwort selbst zurücksetzen ("Passwort vergessen"-Flow per E-Mail-Link mit zeitlich begrenztem Token).
- Deaktivierte/ausgezogene Mietparteien verlieren den Dashboard-Zugriff automatisch, Zugangsdaten bleiben aber für die Historie nachvollziehbar.

**4. Mieter-Dashboard**
- Login pro Mietpartei (nur Zugriff auf eigene Daten).
- Monatsansicht: Verbrauch (kWh) pro Monat, Vergleich zum Vormonat/Vorjahresmonat, grafische Darstellung (Balken- oder Liniendiagramm).
- Übersicht bereits freigegebener/versendeter Jahresabrechnungen und Schlussrechnungen mit PDF-Download.
- Optional: Tagesansicht/Lastgang für aktuellen Monat.

**5. Rechnungserstellung (Jahresabrechnung & Schlussrechnung)**
- Generierung einer Verbrauchsabrechnung für einen frei definierbaren Zeitraum, Standardvorgabe **1.1.–31.12.** des jeweiligen Jahres.
- Bei Auszug: automatische Möglichkeit, eine **Schlussrechnung** für den Zeitraum vom Jahresbeginn (oder letzter Abrechnung) bis zum Auszugsdatum zu erstellen (anteilige/taggenaue Berechnung).
- Rechnung enthält: Mieter- und Objektdaten, Abrechnungszeitraum, Gesamtverbrauch (kWh), Arbeitspreis, optional Grundpreis, Gesamtbetrag der Verbrauchskosten.
- **MwSt.-Ausweis auf der Rechnung:** Für jede Position (Arbeitspreis × Verbrauch, Grundpreis, Abschläge) sowie in der Gesamtsumme werden **Netto-Betrag, angewandter Steuersatz, MwSt.-Betrag und Brutto-Betrag getrennt ausgewiesen** — nicht nur als Endsumme, sondern nachvollziehbar pro Position und als Sammelsumme je Steuersatz (falls unterschiedliche Sätze vorkommen), wie gesetzlich für Rechnungen gefordert.
- **Abschlagsverrechnung:** Rechnung weist zusätzlich aus: Summe der im Abrechnungszeitraum fälligen monatlichen Abschläge (auf Basis des im Mietparteien-Datensatz hinterlegten Abschlags, ggf. mit mehreren Beträgen bei Änderung während des Zeitraums, jeweils brutto), die tatsächlichen Verbrauchskosten (brutto) sowie die sich daraus ergebende **Verrechnung** (Nachzahlung, falls Verbrauchskosten > geleistete Abschläge, oder Guthaben/Erstattung, falls Verbrauchskosten < geleistete Abschläge). Diese Differenz muss klar als Endbetrag hervorgehoben werden.
- **Pflichtangaben (Rechnung nach § 14 UStG, bundesweit gültig, nicht landesspezifisch):**
  - vollständiger Name und Anschrift der Nuola Solar GbR als leistender Unternehmer sowie des Rechnungsempfängers,
  - **Steuernummer (oder USt-IdNr.)** der Nuola Solar GbR — als Stammdatum in den Firmen-/Systemeinstellungen hinterlegbar,
  - **fortlaufende, einmalige und lückenlose Rechnungsnummer** (System muss Eindeutigkeit und Lückenlosigkeit technisch sicherstellen, z. B. durch einen DB-seitigen Zähler; keine parallele Vergabe möglich),
  - Ausstellungsdatum, Leistungszeitraum (Abrechnungszeitraum), Entgelt (Netto), **angewandter Steuersatz und ausgewiesener MwSt.-Betrag pro Position und in Summe**, Bruttogesamtbetrag.
  - *Hinweis: Die konkrete umsatzsteuerliche Behandlung (z. B. Kleinunternehmerregelung, Steuerpflicht bei Stromlieferung/Verbrauchsabrechnung) ist keine technische, sondern eine steuerrechtliche Frage — bitte mit einem Steuerberater klären und das Ergebnis als Konfiguration (Steuersatz, Textbausteine) im System hinterlegen.*
- **Design/Layout:** Das Rechnungslayout soll über eine **einbindbare Designvorlage** konfigurierbar sein (z. B. Logo/Briefkopf-Upload, Farben, Fußzeile mit Bankverbindung, editierbar über den Admin-Bereich oder eine austauschbare HTML/CSS-Vorlage), statt fest im Code verankert zu sein — damit das Layout ohne neuen Programmieraufwand angepasst werden kann.
- **Freigabe-Workflow:** Rechnungen werden zunächst als Entwurf generiert und sind NICHT automatisch sichtbar/versendet. Erst nach manueller Prüfung und Freigabe durch den Admin wird die Rechnung (a) im Mieter-Dashboard sichtbar und (b) per E-Mail als PDF an den Mieter verschickt.
- Rechnungen werden als PDF erzeugt und dauerhaft archiviert (auch nach Freigabe unveränderlich; bei Korrekturbedarf Stornorechnung + neue Rechnung statt nachträglicher Bearbeitung, um die Lückenlosigkeit der Nummerierung nicht zu verletzen).

**6. Admin-Dashboard**
- Übersicht aller Objekte/Einheiten/Mietparteien/Geräte mit Live-Status (online/offline, letzter Datenpunkt).
- Verbrauchsübersicht über alle Einheiten hinweg, Filter nach Objekt/Zeitraum.
- Rechnungsverwaltung: Entwürfe generieren, prüfen, freigeben/versenden, Historie einsehen, CSV-Export der Rohdaten.

### Technische Vorgaben

- **Deployment:** Docker Compose mit folgenden Services (kein eigener Reverse-Proxy nötig, der externe nginx übernimmt das):
  - `web` — Frontend + Backend (z. B. Next.js Full-Stack-App), exponiert einen Port für den externen nginx
  - `worker` — separater Dienst für das periodische Polling der Shelly Cloud API (z. B. per Cron/Scheduler, damit Polling unabhängig vom Webprozess läuft)
  - SQLite-Datenbankdatei liegt in einem gemounteten Docker-Volume (kein eigener DB-Container nötig)
  - `mailer`-Anbindung nicht als eigener Service, sondern per SMTP-Client aus dem `web`-Service (SMTP-Zugangsdaten über `.env`)
- **.env-Datei** für alle Secrets (Shelly Cloud Auth-Token, SMTP-Zugangsdaten, Session-Secret) — niemals hartcodieren.
- **Datenbank-Schema** sauber normalisiert, u. a.: `objekte`, `einheiten`, `mietparteien` (mit Status aktiv/inaktiv, Ein-/Auszugsdatum, Preise jeweils als Netto-Betrag + Steuersatz-Referenz), `abschlaege` (Mietpartei, Netto-Betrag, Steuersatz, gültig ab/bis — Historie), `steuersaetze` (Bezeichnung, Prozentsatz, **gültig ab Datum**, optional gültig bis Datum — historisierte Sätze bleiben erhalten und werden nie überschrieben), `shelly_geraete`, `messwerte` (Zeitreihe), `nutzer`/`auth` (inkl. Einmal-Passwort-Flag, Passwort-Reset-Tokens), `rechnungen` (Status: Entwurf/freigegeben/versendet, Zeitraum, fortlaufende Rechnungsnummer, PDF-Referenz), `rechnungspositionen` (Rechnung, Bezeichnung, Netto-Betrag, Steuersatz, MwSt.-Betrag, Brutto-Betrag), `firmen_stammdaten` (Nuola-Anschrift, Steuernummer, Bankverbindung), `rechnungs_designvorlage` (Logo, Farben, Layout-Referenz).
- **Authentifizierung:** getrennte Rollen für Admin und Mieter, sichere Passwort-Hashes (z. B. bcrypt/argon2), Session- oder JWT-basiert, Pflicht-Passwortänderung nach Einmal-Passwort-Login, Passwort-Reset per E-Mail-Token mit Ablaufzeit.
- **E-Mail-Versand:** SMTP-Anbindung für (a) Zugangsdaten-Versand beim Onboarding, (b) Passwort-Reset-Links, (c) Versand freigegebener Rechnungen als PDF-Anhang.
- **PDF-Erzeugung:** serverseitige PDF-Generierung für Rechnungen (z. B. mit einer gängigen Node-Bibliothek), inkl. sauberem Layout mit Nuola-Absenderdaten.
- **Skalierbarkeit:** Architektur muss problemlos weitere Objekte/Einheiten/Geräte/Mietparteien aufnehmen können, ohne Codeänderung — alles über die Admin-UI konfigurierbar. Datenzugriffs-Layer austauschbar halten (ORM), um bei Bedarf später von SQLite auf PostgreSQL wechseln zu können.
- **Tests:** zumindest für die Kernlogik (Verbrauchsberechnung, Abrechnungslogik inkl. anteiliger Schlussrechnung, Shelly-API-Client, Passwort-Reset-Flow) automatisierte Tests.
- **Dokumentation:** README mit Setup-Anleitung (`docker compose up`), Beschreibung der Environment-Variablen (inkl. SMTP), kurze Architekturübersicht.

### Vorgehen

1. Recherchiere zunächst die Shelly Cloud API (Authentifizierung, Endpunkte für Energie-/Verbrauchsdaten des Pro 3EM, Rate Limits) und dokumentiere die Erkenntnisse kurz, bevor du mit der Implementierung beginnst.
2. Entwirf das Datenbankschema (SQLite) und lege es als Migration an.
3. Implementiere den Worker-Service für das Shelly-Polling zuerst und teste ihn isoliert.
4. Baue danach Mieterverwaltung, Admin- und Mieter-Bereich der Webanwendung inkl. Onboarding-/Passwort-Reset-Flow.
5. Implementiere die Rechnungserstellung (Entwurf → Freigabe → Versand) inkl. PDF-Generierung und E-Mail-Versand.
6. Richte Docker Compose so ein, dass die gesamte Anwendung mit einem Befehl lokal startbar ist, inklusive Beispiel-`.env` (inkl. SMTP-Platzhaltern). Kein eigener Reverse-Proxy-Service, nur ein exponierter Port für den externen nginx.
7. Schreibe zum Schluss Tests für die kritischen Pfade (Datenerfassung, Verbrauchsberechnung, Abrechnung inkl. Schlussrechnung, Auth-/Passwort-Reset-Flow).

### Offene Punkte, die Claude Code klären oder sinnvoll annehmen soll

- Genaues Format/Endpunkte der Shelly Cloud API (abhängig von Firmware-Version und Cloud-Account-Region) — bei Unsicherheit nach dem Shelly Cloud API Token und Server-Endpoint fragen bzw. Platzhalter-Konfiguration vorsehen.
- Ob eine Einheit von mehreren Shellys gespeist wird (z. B. bei Pro 3EM mit mehreren Phasen/Stromkreisen) und wie diese Werte summiert werden.
- Rundungs-/Abrechnungsregeln bei unterjährigem Ein-/Auszug (taggenaue anteilige Berechnung als Standardannahme).
- Konkreter SMTP-Anbieter/Zugangsdaten für den E-Mail-Versand — als Platzhalter in `.env.example` vorsehen.
- Genaues PDF-Layout/Corporate Design der Rechnung — sinnvolle Standardvorlage mit austauschbarer Designvorlage (Logo/Farben/Briefkopf) vorschlagen.
- Steuernummer, USt-Behandlung und ggf. anzuwendender Steuersatz der Nuola Solar GbR sind mit einem Steuerberater zu klären und als konfigurierbares Stammdatum zu hinterlegen — nicht im Code hartcodieren.
- Format des Rechnungsnummernkreises (z. B. Präfix pro Objekt/Jahr, z. B. `NUOLA-2026-0001`) — sinnvollen lückenlosen Standard vorschlagen, falls keine Vorgabe existiert.

---

**Hinweis:** Diesen Prompt kannst du 1:1 als ersten Auftrag an Claude Code geben. Ergänze vor dem Start idealerweise deine Shelly Cloud Zugangsdaten (Auth-Token, Server-Region) in einer `.env.example`, damit Claude Code sie direkt einbinden kann.
