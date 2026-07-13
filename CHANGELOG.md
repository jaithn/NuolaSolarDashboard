# Changelog

Nennenswerte Änderungen am **Nuola Energy Dashboard** – neueste zuerst.

Versionsschema `MAJOR.MINOR.PATCH`: je `main`-Push wird automatisch `1.0.<CI-Lauf-Nr>`
gebaut; gepinnte Releases über Git-Tags `vX.Y.Z` (siehe CLAUDE.md → „Versionierung").
Die jeweils oberste Sektion dieser Datei wird beim Image-Build als „Neu in dieser
Version" in die Image-Beschreibung (`org.opencontainers.image.description`) übernommen.

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
