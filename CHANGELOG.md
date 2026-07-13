# Changelog

Nennenswerte Änderungen am **Nuola Energy Dashboard** – neueste zuerst.

Versionsschema `MAJOR.MINOR.PATCH`: je `main`-Push wird automatisch `1.0.<CI-Lauf-Nr>`
gebaut; gepinnte Releases über Git-Tags `vX.Y.Z` (siehe CLAUDE.md → „Versionierung").
Die jeweils oberste Sektion dieser Datei wird beim Image-Build als „Neu in dieser
Version" in die Image-Beschreibung (`org.opencontainers.image.description`) übernommen.

## Überarbeitete Briefe, Kundennummer, SEPA & Vertrags­texte

- **Einheitliche Briefvorlage (alle Briefe):** dreizeilige Fußzeile (Adresse · Kontakt ·
  Steuer/Bank), Absenderzeile im Sichtfenster, Empfänger-Anrede nur noch bei Familien,
  rechtsbündige Ort-/Datumszeile, Datum durchgängig TT.MM.JJJJ, Bearbeiter:in und
  Kundennummer im Briefkopf.
- **Kundennummer & SEPA:** je Mietpartei wird beim Aktivstellen eine fortlaufende
  Kundennummer vergeben; SEPA-Gläubiger-ID in den Firmenstammdaten, Mandatsreferenz
  automatisch je Mietpartei – beides wird auf dem SEPA-Mandat eingedruckt.
- **Anschreiben** erweitert: Solaranlage-/Vermieter-Passus, geplanter Liefertermin,
  Hinweis zu Abmeldung des Altzählers und Kündigung des Altvertrags, Abschlags-Erläuterung
  (angenommener Jahresverbrauch) und freundliche Rücksende-Bitte (5 Werktage).
- **Verträge v1.1:** Stromliefervertrag gegendert, Ergänzung zum Mietvertrag auf
  SEPA-Lastschrifteinzug umgestellt; v1.0 bleibt als Historie gültig.
- **DIN A4:** SEPA-Mandat und Willkommensbrief passen jetzt auf eine Seite.
- **Objekt:** Bearbeiter:in der Firma, geplanter Liefertermin, strukturierte
  Vermieteranschrift (Straße/PLZ/Ort).
- **Mietpartei:** editierbare Postanschrift (Standard = Objektadresse), angenommener
  Jahresverbrauch, Anlegen per aufklappbarem Formular mit direktem Sprung zur
  Vertragsunterlagen-Seite; Liste nach Objekt und Nachname sortiert; MwSt-Fehler beim
  Anlegen behoben; Abschläge-Historie mit Bruttopreis.
- **Einstellungen → Version:** Link zur Image-Version auf GitHub inkl. Image-Stand (Datum).

## Vermieter pro Objekt oder Wohneinheit

- Beim Anlegen/Bearbeiten eines Objekts wählbar, ob der Vermieter für das ganze Objekt
  gilt oder je Wohneinheit (Objekt aus mehreren Eigentumswohnungen); die „Ergänzung zum
  Mietvertrag" nutzt automatisch die passende Quelle.

## Zwei Vertragsarten, Versionierung & editierbare Texte

- Vertragsarten „Eigenständiger Vertrag" (Nuola-Layout) und „Ergänzung zum Mietvertrag"
  (schlicht, ohne Nuola-Bezug); Auswahl je Mietpartei.
- Versionierte Vertragsvorlagen mit Historie: eine neue Version beendet automatisch die
  vorherige; pro Mietpartei dokumentierbar, welche Version unterschrieben wurde.
- Alle Vertrags- und Brieftexte als Markdown im Ordner `Dokumente/` editierbar; Übernahme
  ins System per Sync (`npm run sync:dokumente`, beim Container-Start und im Admin).

## Interessenten-Onboarding

- Neuer Status „Interessent" (vor aktiv/inaktiv); Anschreiben, Vertrag und
  SEPA-Lastschriftmandat als PDF.
- Grundversorger-Vergleich (brutto) inkl. prozentualem Preisvorteil im Anschreiben.
- Statuswechsel Interessent → aktiv/inaktiv; Upload und dauerhafte, nicht öffentliche
  Ablage der gescannten, unterschriebenen Verträge.

## 1.0 – Grundfunktionen

- Stromverbrauchserfassung je Mietpartei über Shelly Pro 3EM (Shelly Cloud API,
  Gebäudestromanlage nach § 42b EnWG), Mieter-Dashboard mit Monats-/Jahresverlauf.
- § 14 UStG-konforme Jahres-/Schlussrechnungen als PDF (lückenlose Nummern, Storno),
  zeitlich gültige Steuersätze, monatliche Abschläge.
- Firmenstammdaten, Willkommensbrief, rollenbasierte Auth, Hell-/Dunkel-Design,
  Versionsanzeige aus GitHub/Image; durchgängig gegenderte, deutsche Oberfläche.
