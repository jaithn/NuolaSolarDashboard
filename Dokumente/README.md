# Dokumente – editierbare Vertrags- und Brieftexte

Dieser Ordner enthält die **bearbeitbaren Texte** aller Verträge und Briefe als
Markdown. Änderungen hier werden per Sync ins System übernommen; die PDFs
rendern anschließend den neuen Text (das Layout bleibt fest im Code).

## Dateien

| Datei | Bedeutung |
|-------|-----------|
| `vertrag-eigenstaendig-v1.0.md` | Eigenständiger Stromliefervertrag (Nuola-Layout), Version 1.0 |
| `vertrag-ergaenzung-v1.0.md` | Ergänzung zum Mietvertrag (schlichtes Layout, kein Nuola-Branding), Version 1.0 |
| `brief-anschreiben.md` | Onboarding-Anschreiben |
| `brief-sepa-mandat.md` | SEPA-Lastschriftmandat |
| `brief-willkommen.md` | Willkommensbrief |

## Verträge

Jede Vertragsdatei beginnt mit einem YAML-Kopf (Front-Matter):

```
---
art: EIGENSTAENDIG        # oder ERGAENZUNG
version: 1.0              # Versionsnummer (eindeutig je Art)
titel: Stromliefervertrag # Überschrift/Dokumenttitel
gueltigAb: 2026-01-01     # Beginn der Gültigkeit (JJJJ-MM-TT)
---
```

Danach folgt der Vertragstext als Markdown (`##`-Überschriften für Paragraphen,
Absätze durch Leerzeilen, `-` für Aufzählungen). Die **dynamischen Teile**
(Parteien, Preistabelle, Verbrauchsstelle, Unterschriften) erzeugt das System –
sie stehen NICHT im Markdown.

### Neue Vertragsversion anlegen

1. Datei kopieren, z. B. `vertrag-eigenstaendig-v1.1.md`.
2. Im Front-Matter `version` erhöhen und `gueltigAb` auf das neue Startdatum
   setzen.
3. Text anpassen.
4. Sync ausführen (siehe unten). Die bisherige Version wird automatisch am Tag
   vor dem neuen `gueltigAb` beendet (nicht mehr gültig) und bleibt als Historie
   erhalten. Bereits unterschriebene Versionen bleiben für die jeweilige
   Mietpartei gültig.

## Briefe

Brieftexte sind in benannte Abschnitte gegliedert (`## schluessel`). Die
Schlüssel dürfen **nicht** umbenannt werden – der Code liest die Abschnitte
darüber aus. Platzhalter in geschweiften Klammern werden ersetzt, z. B.
`{firma}`. Dynamische Tabellen erzeugt das System selbst.

## Sync ausführen („Texte ins System überführen")

```
npm run sync:dokumente
```

Der Sync ist idempotent (mehrfach ausführbar) und läuft zusätzlich automatisch
beim Start des Containers (Seed). Alternativ lässt er sich im Admin unter
**Einstellungen → Vertragstexte** per Knopfdruck auslösen.
