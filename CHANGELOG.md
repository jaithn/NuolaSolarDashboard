# Changelog

Nennenswerte Änderungen am **Nuola Energy Dashboard** – neueste zuerst.

Versionsschema `MAJOR.MINOR.PATCH`: je `main`-Push wird automatisch `1.0.<CI-Lauf-Nr>`
gebaut; gepinnte Releases über Git-Tags `vX.Y.Z` (siehe CLAUDE.md → „Versionierung").
Die jeweils oberste Sektion dieser Datei wird beim Image-Build als „Neu in dieser
Version" in die Image-Beschreibung (`org.opencontainers.image.description`) übernommen.

## Wärmepumpe nachträglich, manueller Zähler als +-Button & Hausverwaltungs-Kontakt

- **Manueller Zählerstand** auf der Startseite ist jetzt je Mietpartei hinter einem
  **+-Button** versteckt (gleiche Nuola-Optik wie „Neue Einheit") – die Tabelle zeigt
  nicht mehr für jede Partei dauerhaft die Eingabefelder. Ein Klick klappt Datum/kWh auf.
- **Wärmepumpe nachträglich hinzufügen**: An einer Allgemeinstrom-Einheit lässt sich ein
  bereits zugeordneter Zähler jederzeit über „Als Wärmepumpe markieren" als Wärmepumpe
  kennzeichnen (bzw. wieder zurücksetzen) – Allgemeinstrom und Wärmepumpe bleiben **eine**
  Partei, der Wärmepumpen-Verbrauch wird in der Rechnung nur getrennt ausgewiesen.
- **Gescannte Rückläufer**: Auswahl jetzt „Stromliefervertrag", „Ergänzung zum
  Mietvertrag", „SEPA-Mandat" und „Sonstiges" (kein „Anschreiben" mehr).
- **Hausverwaltung beim Objekt** um **Ansprechperson, Telefon und E-Mail** erweitert.
- **Dropdown-Auswahl beim Objekt** wird nach dem Speichern zuverlässig übernommen
  (kein Zurückspringen der Auswahlfelder mehr).

## Bankverbindung, Allgemeinstrom-Anlage, +-Menü & Dark-Mode-Logo

- **Bankverbindung im Mietprofil** (Kontoinhaber:in, IBAN, Bank): IBAN wird geprüft
  (Modulo-97) und die **Bank automatisch aus der IBAN** ermittelt; das SEPA-Mandat
  wird damit vorausgefüllt. Mieter:innen können ihre **IBAN im Portal selbst ändern** –
  dabei wird ein neues, vorausgefülltes SEPA-Mandat zum Herunterladen/Unterschreiben/
  Hochladen angeboten und die Firma per E-Mail benachrichtigt (bei Änderung und bei
  Upload des neuen Mandats).
- **Allgemeinstrom** wird jetzt direkt über die Mietparteien angelegt (neuer
  „Allgemeinstrom"-Eintrag): Einheit + Vermieter-Mietpartei in einem Schritt, Vermieter
  inkl. **Adresse vorausgefüllt**, ohne Anschreiben/Ergänzung. Gibt es eine **Wärmepumpe**,
  wird deren Zähler getrennt ausgewiesen – **eine** Rechnung mit Allgemeinstrom
  (Grund- + Arbeitspreis) und Wärmepumpe (nur Arbeitspreis).
- **Neuanlage über ein +-Menü** oben rechts am Seitentitel (Objekte, Mietparteien,
  Rechnungen) – im Nuola-Rahmen mit Plus-Symbol.
- **Sammel-PDF**: alle Onboarding-Briefe einer Mietpartei als **ein** PDF.
- **Interessent:innen ohne E-Mail** anlegbar; der **Abschlag** wird beim Anlegen
  automatisch aus Preisen und Jahresverbrauch vorgeschlagen (überschreibbar).
- **Zweite Vermieter:in mit eigener Anrede**; **einheitliche Dateinamen** für
  hochgeladene Scans (`<Kundennummer>_<Name>_<Art>_<Datum>`); Ablage nach
  **Kundennummer** im Ordner `data/kunden`.
- Im **dunklen Design** wird das invertierte Nuola-Solar-Logo verwendet.

## Persönliches Anschreiben & editierbare Texte im Server-Dateisystem

- **Zweites, persönlicheres Anschreiben** zusätzlich zum formalen – im Admin unter
  „Onboarding-Unterlagen" getrennt auswählbar. Familiär formuliert (Bezug zu
  Vermieter:innen und Haus über `{vermieter}`/`{objektadresse}`), mit eigener
  Grußformel und Unterschrift.
- **Editierbare Vorlagentexte im Data-Volume:** die `.md`-Dateien liegen im Docker
  jetzt unter `/app/data/Dokumente` und sind damit direkt vom Server-Dateisystem aus
  bearbeitbar. Beim Update werden nur neue Vorlagen ergänzt, eigene Änderungen bleiben
  erhalten. Ordner per `DOKUMENTE_DIR` konfigurierbar.

## Onboarding: Kundennummer, beide Verträge, Brutto-Abschlag, Folgeseiten

- **Kundennummer** wird jetzt schon beim Anlegen jeder Mietpartei vergeben (auch
  Interessent:innen) und in den Stammdaten angezeigt – dadurch erscheint die
  **SEPA-Mandatsreferenz** (`NUOLA-<Nr>`) zuverlässig auf dem Lastschriftmandat.
- **Immer beide Verträge:** für jede Mietpartei werden Stromliefervertrag UND
  Ergänzung zum Mietvertrag erzeugt; die Auswahl „Vertragsart" entfällt.
- **Monatlicher Abschlag** wird als Brutto-Betrag (inkl. MwSt.) erfasst und genau so
  im Vertrag/Anschreiben ausgewiesen – keine abweichende Rundung mehr. Ein neuer
  Abschlag setzt den vorherigen automatisch außer Kraft.
- **Mehrseitige Briefe:** kompletter Briefkopf auf jeder Seite, Seitenzahlen
  „Seite X von Y", Trennlinie im Sichtfenster entfernt.

## Verträge & Onboarding aufeinander abgestimmt

- **Ergänzung zum Mietvertrag** verschlankt: nur noch Stromversorgung, Strompreis und
  Beendigung; die Konditionsübersicht entfällt. Ein neuer Abschnitt verweist auf den
  Stromliefervertrag mit der Nuola Solar GbR – beide Dokumente widersprechen sich nicht
  mehr.
- **Stromliefervertrag** neu aufgebaut (klar und verständlich): eigene Abschnitte zu
  Preisanpassung sowie Laufzeit/Lieferantenwechsel/Kündigung; die Konditionsbox heißt
  jetzt „Anfängliche Konditionen". Enthält weiterhin die Pflichthinweise für
  Haushaltskund:innen: Messung/Ablesung nach MsbG, Unterbrechung nach StromGVV/NAV
  sowie Streitschlichtung (Schlichtungsstelle Energie) und Bundesnetzagentur.
- **Unterschriften:** beide Vertragsparteien tragen Ort und Datum ein; der Ort ist mit
  dem hinterlegten Ort der jeweiligen Partei vorbelegt.
- **Anschreiben:** Vergleich mit „dem örtlichen Grundversorger"; geplanter Liefertermin
  im Fließtext statt in der Box; Beginn der Stromlieferung als Hinweis („wird rechtzeitig
  mitgeteilt"); einheitliche Schriftgröße im Fließtext.
- **Briefe:** Trennlinie unter der Absenderzeile im Sichtfenster entfernt.

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
