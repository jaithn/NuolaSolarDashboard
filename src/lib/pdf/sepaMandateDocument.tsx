import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import {
  letterStyles,
  LetterHeader,
  EmpfaengerAdresse,
  LetterFooter,
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
  // SEPA-Gläubiger-ID (Firma) und Mandatsreferenz (aus Kundennummer). Wenn
  // beide vorhanden, werden sie direkt eingedruckt und der Ergänzungshinweis
  // entfällt; sonst bleibt eine Ausfülllinie stehen.
  glaeubigerId?: string | null;
  mandatsreferenz?: string | null;
  // Editierbare Textabschnitte aus der Brief-Vorlage (leer -> Standardtexte).
  abschnitte: Map<string, string>;
}

const s = StyleSheet.create({
  intro: { fontSize: 9.5, color: "#334155", marginBottom: 12, lineHeight: 1.5 },
  glaeubigerBox: { borderWidth: 1, borderColor: "#d9c9a4", borderRadius: 4, padding: 10, marginBottom: 14 },
  feldLabel: { fontSize: 8.5, color: "#64748b", marginBottom: 2 },
  feldLine: { borderBottomWidth: 1, borderBottomColor: INK, minHeight: 16, marginBottom: 12 },
  feldWert: { fontSize: 10, paddingBottom: 2 },
  mandatText: { fontSize: 9, color: "#222", lineHeight: 1.5, marginBottom: 6, textAlign: "justify" },
  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 34 },
  sigCol: { width: "45%" },
  sigLine: { borderTopWidth: 1, borderTopColor: INK, marginTop: 24, paddingTop: 4 },
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
      <Page size="A4" style={letterStyles.page}>
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
        <Feld label="Kontoinhaber (Vor- und Nachname)" wert={zahlungspflichtiger} />
        <Feld label="Name des Kreditinstituts" />
        <Feld label="IBAN" />
        <Feld label="BIC" />

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
      </Page>
    </Document>
  );
}
