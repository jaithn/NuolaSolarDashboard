import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import {
  letterStyles,
  pageStyle,
  LetterHeader,
  EmpfaengerAdresse,
  LetterFooter,
  Seitenzahl,
  OrtDatumZeile,
  Falzmarken,
  INK,
  type FirmaBriefData,
  type EmpfaengerData,
} from "./letterLayout";
import { abschnitt } from "@/lib/dokumenteVorlagen";

export interface SepaMandateData {
  firma: FirmaBriefData;
  logoPfad: string | null;
  empfaenger: EmpfaengerData;
  bearbeiterName?: string | null;
  kundennummer?: number | null;
  // Name des Zahlungspflichtigen (Mietende) für den Mandatstext.
  zahlungspflichtiger: string;
  // Optionale, bereits bekannte Kontoverbindung - wird ins Mandat eingedruckt
  // (z.B. beim automatisch erzeugten Neu-Mandat nach einer IBAN-Änderung).
  // Fehlt ein Wert, bleibt die jeweilige Ausfülllinie leer.
  kontoinhaber?: string | null;
  iban?: string | null;
  bankName?: string | null;
  bic?: string | null;
  // SEPA-Gläubiger-ID (Firma) und Mandatsreferenz (aus Kundennummer). Wenn
  // beide vorhanden, werden sie direkt eingedruckt und der Ergänzungshinweis
  // entfällt; sonst bleibt eine Ausfülllinie stehen.
  glaeubigerId?: string | null;
  mandatsreferenz?: string | null;
  // Editierbare Textabschnitte aus der Brief-Vorlage (leer -> Standardtexte).
  abschnitte: Map<string, string>;
}

// Kompaktes Spacing, damit das Mandat sicher auf eine DIN-A4-Seite passt.
const s = StyleSheet.create({
  intro: { fontSize: 9, color: "#334155", marginBottom: 8, lineHeight: 1.45 },
  glaeubigerBox: { borderWidth: 1, borderColor: "#d9c9a4", borderRadius: 4, padding: 8, marginBottom: 10 },
  feldLabel: { fontSize: 8.5, color: "#64748b", marginBottom: 1 },
  feldLine: { borderBottomWidth: 1, borderBottomColor: INK, minHeight: 13, marginBottom: 8 },
  feldWert: { fontSize: 10, paddingBottom: 1 },
  mandatText: { fontSize: 8.5, color: "#222", lineHeight: 1.4, marginBottom: 5, textAlign: "justify" },
  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 18 },
  sigCol: { width: "45%" },
  sigLine: { borderTopWidth: 1, borderTopColor: INK, marginTop: 18, paddingTop: 4 },
  sigCaption: { fontSize: 9, color: "#334155" },
});

/** Auszufüllendes Feld mit Beschriftung und Unterstreichungslinie. */
function Feld({ label, wert }: { label: string; wert?: string }) {
  return (
    <View>
      <Text style={s.feldLabel}>{label}</Text>
      <View style={s.feldLine}>{wert ? <Text style={s.feldWert}>{wert}</Text> : null}</View>
    </View>
  );
}

export function SepaMandateDocument({
  firma,
  logoPfad,
  empfaenger,
  bearbeiterName,
  kundennummer,
  zahlungspflichtiger,
  kontoinhaber,
  iban,
  bankName,
  bic,
  glaeubigerId,
  mandatsreferenz,
  abschnitte,
}: SepaMandateData) {
  const glaeubiger = [firma.name, firma.anschrift, `${firma.plz} ${firma.ort}`.trim()].filter(Boolean).join(", ");
  const t = (key: string, standard: string) => abschnitt(abschnitte, key, standard, { firma: firma.name });
  const platzhalter = "…………………………………………";
  const beideVorhanden = Boolean(glaeubigerId && mandatsreferenz);

  return (
    <Document>
      <Page size="A4" style={pageStyle}>
        <Falzmarken />
        <LetterHeader logoPfad={logoPfad} firma={firma} zusatz={{ bearbeiterName, kundennummer }} />
        <EmpfaengerAdresse empfaenger={empfaenger} firma={firma} />

        <Text style={letterStyles.title}>{t("titel", "SEPA-Lastschriftmandat")}</Text>
        <OrtDatumZeile ort={firma.ort} datum={new Date()} />
        <Text style={s.intro}>
          {t(
            "einleitung",
            `Mit diesem Mandat ermächtigen Sie die ${firma.name}, die fälligen Beträge (monatliche Abschlagszahlungen sowie Nachzahlungen aus der Jahresabrechnung) bequem per SEPA-Basislastschrift von Ihrem Konto einzuziehen. Bitte tragen Sie Ihre Kontoverbindung ein und senden Sie das unterschriebene Formular an uns zurück.`,
          )}
        </Text>

        <View style={s.glaeubigerBox}>
          <View style={letterStyles.row}>
            <Text style={letterStyles.label}>Zahlungsempfänger (Gläubiger)</Text>
            <Text style={letterStyles.value}>{firma.name}</Text>
          </View>
          <Text style={{ fontSize: 9, color: "#334155", marginBottom: 6 }}>{glaeubiger}</Text>
          <View style={letterStyles.row}>
            <Text style={letterStyles.label}>Gläubiger-Identifikationsnummer</Text>
            <Text style={letterStyles.value}>{glaeubigerId || platzhalter}</Text>
          </View>
          <View style={letterStyles.row}>
            <Text style={letterStyles.label}>Mandatsreferenz</Text>
            <Text style={letterStyles.value}>{mandatsreferenz || platzhalter}</Text>
          </View>
          {!beideVorhanden && (
            <Text style={{ fontSize: 8, color: "#94a3b8", marginTop: 4 }}>
              (Gläubiger-ID und Mandatsreferenz werden von der {firma.name} ergänzt.)
            </Text>
          )}
        </View>

        <Text style={{ ...letterStyles.boxTitle, marginBottom: 8 }}>
          {t("kontoverbindung-titel", "Ihre Kontoverbindung")}
        </Text>
        <Feld label="Kontoinhaber (Vor- und Nachname)" wert={kontoinhaber?.trim() || zahlungspflichtiger} />
        <Feld label="Name des Kreditinstituts" wert={bankName?.trim() || undefined} />
        <Feld label="IBAN" wert={iban?.trim() || undefined} />
        <Feld label="BIC" wert={bic?.trim() || undefined} />

        <Text style={s.mandatText}>
          {t(
            "mandat-absatz-1",
            `Ich ermächtige die ${firma.name}, Zahlungen von meinem Konto mittels Lastschrift einzuziehen. Zugleich weise ich mein Kreditinstitut an, die von der ${firma.name} auf mein Konto gezogenen Lastschriften einzulösen.`,
          )}
        </Text>
        <Text style={s.mandatText}>
          {t(
            "mandat-absatz-2",
            "Hinweis: Ich kann innerhalb von acht Wochen, beginnend mit dem Belastungsdatum, die Erstattung des belasteten Betrages verlangen. Es gelten dabei die mit meinem Kreditinstitut vereinbarten Bedingungen.",
          )}
        </Text>

        <View style={s.sigRow} wrap={false}>
          <View style={s.sigCol}>
            <View style={s.sigLine}>
              <Text style={s.sigCaption}>Ort, Datum</Text>
            </View>
          </View>
          <View style={s.sigCol}>
            <View style={s.sigLine}>
              <Text style={s.sigCaption}>Unterschrift Kontoinhaber</Text>
            </View>
          </View>
        </View>

        <LetterFooter firma={firma} />
        <Seitenzahl />
      </Page>
    </Document>
  );
}
