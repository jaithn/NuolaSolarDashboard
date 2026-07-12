import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import {
  letterStyles,
  LetterHeader,
  EmpfaengerAdresse,
  LetterFooter,
  Falzmarken,
  GOLD,
  type FirmaBriefData,
  type EmpfaengerData,
} from "./letterLayout";
import { fmtEuro, fmtPreisKwh, fmtDate, fmtProzent } from "./format";

export interface OnboardingVergleich {
  name: string;
  tarif: string | null;
  grundpreisBrutto: number | null; // €/Monat brutto (Grundversorger)
  arbeitspreisBrutto: number | null; // €/kWh brutto (Grundversorger)
  vorteilGrundpreisProzent: number | null;
  vorteilArbeitspreisProzent: number | null;
}

export interface OnboardingLetterData {
  firma: FirmaBriefData;
  logoPfad: string | null;
  empfaenger: EmpfaengerData;
  anredeSatz: string;
  beginn: Date;
  konditionen: {
    arbeitspreisBrutto: number; // €/kWh
    grundpreisBrutto: number | null; // €/Monat
    abschlagBrutto: number | null; // €/Monat
  };
  // Grundversorger-Vergleich (null, wenn keine Vergleichsdaten erfasst wurden).
  vergleich: OnboardingVergleich | null;
  kontaktTelefon: string | null;
}

const s = StyleSheet.create({
  vergleichRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#d9c9a4", paddingVertical: 4 },
  vergleichHeadRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: GOLD, paddingBottom: 4 },
  colLabel: { flex: 1.6, color: "#334155" },
  colVal: { flex: 1, textAlign: "right" },
  colHead: { fontFamily: "Helvetica-Bold", fontSize: 9.5 },
  vorteil: { color: "#1a7f37", fontFamily: "Helvetica-Bold" },
  passus: { fontSize: 9, color: "#334155", lineHeight: 1.5 },
});

export function OnboardingLetterDocument({
  firma,
  logoPfad,
  empfaenger,
  anredeSatz,
  beginn,
  konditionen,
  vergleich,
  kontaktTelefon,
}: OnboardingLetterData) {
  const hatVergleich =
    vergleich && (vergleich.arbeitspreisBrutto != null || vergleich.grundpreisBrutto != null);

  return (
    <Document>
      <Page size="A4" style={letterStyles.page}>
        <Falzmarken />
        <LetterHeader logoPfad={logoPfad} firma={firma} />
        <EmpfaengerAdresse empfaenger={empfaenger} />

        <Text style={letterStyles.title}>Ihr Strom aus der Gebäudestromanlage</Text>

        <View style={letterStyles.section}>
          <Text>{anredeSatz},</Text>
          <Text>
            wir freuen uns, Sie künftig mit Strom aus der Gebäudestromanlage Ihres Wohnhauses versorgen zu
            dürfen. Nachfolgend finden Sie Ihre persönlichen Konditionen sowie einen Vergleich mit Ihrem
            bisherigen Grundversorger.
          </Text>
        </View>

        <View style={letterStyles.goldFillBox}>
          <Text style={letterStyles.boxTitle}>Ihre Konditionen bei der {firma.name}</Text>
          <View style={letterStyles.row}>
            <Text style={letterStyles.label}>Beginn der Stromlieferung</Text>
            <Text style={letterStyles.value}>{fmtDate(beginn)}</Text>
          </View>
          <View style={letterStyles.row}>
            <Text style={letterStyles.label}>Arbeitspreis (brutto)</Text>
            <Text style={letterStyles.value}>{fmtPreisKwh(konditionen.arbeitspreisBrutto)} €/kWh</Text>
          </View>
          {konditionen.grundpreisBrutto !== null && (
            <View style={letterStyles.row}>
              <Text style={letterStyles.label}>Grundpreis (brutto)</Text>
              <Text style={letterStyles.value}>{fmtEuro(konditionen.grundpreisBrutto)} €/Monat</Text>
            </View>
          )}
          {konditionen.abschlagBrutto !== null && (
            <View style={letterStyles.row}>
              <Text style={letterStyles.label}>Monatlicher Abschlag (brutto)</Text>
              <Text style={letterStyles.value}>{fmtEuro(konditionen.abschlagBrutto)} €/Monat</Text>
            </View>
          )}
        </View>

        {hatVergleich && vergleich && (
          <View style={letterStyles.goldBox}>
            <Text style={letterStyles.boxTitle}>
              Ihr Preisvorteil gegenüber dem Grundversorger
            </Text>
            <Text style={{ fontSize: 9, color: "#334155", marginBottom: 8 }}>
              Grundversorger: {vergleich.name}
              {vergleich.tarif ? ` – Tarif ${vergleich.tarif}` : ""} (Preise inkl. MwSt.)
            </Text>
            <View style={s.vergleichHeadRow}>
              <Text style={[s.colLabel, s.colHead]}></Text>
              <Text style={[s.colVal, s.colHead]}>Grundversorger</Text>
              <Text style={[s.colVal, s.colHead]}>{firma.name}</Text>
              <Text style={[s.colVal, s.colHead]}>Ihr Vorteil</Text>
            </View>
            {vergleich.arbeitspreisBrutto != null && (
              <View style={s.vergleichRow}>
                <Text style={s.colLabel}>Arbeitspreis (€/kWh)</Text>
                <Text style={s.colVal}>{fmtPreisKwh(vergleich.arbeitspreisBrutto)}</Text>
                <Text style={s.colVal}>{fmtPreisKwh(konditionen.arbeitspreisBrutto)}</Text>
                <Text style={[s.colVal, s.vorteil]}>
                  {vergleich.vorteilArbeitspreisProzent != null
                    ? `${fmtProzent(vergleich.vorteilArbeitspreisProzent)} %`
                    : "—"}
                </Text>
              </View>
            )}
            {vergleich.grundpreisBrutto != null && (
              <View style={s.vergleichRow}>
                <Text style={s.colLabel}>Grundpreis (€/Monat)</Text>
                <Text style={s.colVal}>{fmtEuro(vergleich.grundpreisBrutto)}</Text>
                <Text style={s.colVal}>
                  {konditionen.grundpreisBrutto != null ? fmtEuro(konditionen.grundpreisBrutto) : "—"}
                </Text>
                <Text style={[s.colVal, s.vorteil]}>
                  {vergleich.vorteilGrundpreisProzent != null
                    ? `${fmtProzent(vergleich.vorteilGrundpreisProzent)} %`
                    : "—"}
                </Text>
              </View>
            )}
            <Text style={{ fontSize: 8.5, color: "#64748b", marginTop: 6 }}>
              Positive Werte in der Spalte „Ihr Vorteil" bedeuten, dass unser Preis unter dem des
              Grundversorgers liegt.
            </Text>
          </View>
        )}

        <View style={letterStyles.section}>
          <Text style={letterStyles.boxTitle}>Versorgung über die Gebäudestromanlage</Text>
          <Text style={s.passus}>
            Das Mietobjekt wird über eine Gebäudestromanlage im Sinne des § 42b Energiewirtschaftsgesetz
            (EnWG) mit elektrischer Energie versorgt. Betreiberin der Gebäudestromanlage und Stromlieferantin
            ist die {firma.name}. Der Strom wird ohne Durchleitung durch ein öffentliches Netz an Ihre
            Verbrauchsstelle geliefert. Die Belieferung erfolgt für die Dauer des Mietverhältnisses; der
            Stromverbrauch wird über einen geeichten, Ihrem Mietobjekt eindeutig zugeordneten Stromzähler
            erfasst.
          </Text>
        </View>

        <View style={letterStyles.section}>
          <Text>
            Haben Sie Fragen oder Unklarheiten zu Ihrem Angebot? Rufen Sie uns gerne an
            {kontaktTelefon ? (
              <Text>
                {" "}
                unter <Text style={letterStyles.value}>{kontaktTelefon}</Text>
              </Text>
            ) : (
              ""
            )}
            . Wir beraten Sie persönlich und beantworten Ihre Fragen rund um Ihre Stromversorgung.
          </Text>
          <Text style={{ marginTop: 10 }}>Mit freundlichen Grüßen</Text>
          <Text>{firma.name}</Text>
        </View>

        <LetterFooter firma={firma} />
      </Page>
    </Document>
  );
}
