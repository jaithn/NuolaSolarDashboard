import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import {
  letterStyles,
  LetterHeader,
  LetterFooter,
  Falzmarken,
  GOLD,
  INK,
  type FirmaBriefData,
} from "./letterLayout";
import { fmtEuro, fmtPreisKwh, fmtDate } from "./format";
import { VERTRAGSKLAUSELN, VERTRAG_MUSTERHINWEIS } from "./contractClauses";

export interface ContractData {
  firma: FirmaBriefData;
  logoPfad: string | null;
  // Strombezieher (Mietende) – Anzeigename + Anschrift (Verbrauchsstelle).
  strombezieher: {
    name: string;
    zusatz: string | null; // Ansprechpartner bei Firma
  };
  verbrauchsstelle: {
    strasse: string | null;
    plzOrt: string | null;
    einheit: string; // Bezeichnung der Einheit
  };
  beginn: Date;
  konditionen: {
    grundpreisNetto: number | null;
    grundpreisBrutto: number | null;
    arbeitspreisNetto: number;
    arbeitspreisBrutto: number;
    abschlagBrutto: number | null;
  };
  // Ort für die Unterschriftszeile ("Ort, den ……").
  unterschriftsort: string;
}

const s = StyleSheet.create({
  docTitle: { fontSize: 15, marginTop: 8, marginBottom: 2, color: GOLD, fontFamily: "Helvetica-Bold" },
  docSubtitle: { fontSize: 10, marginBottom: 14, color: "#334155" },
  parteienBox: { borderWidth: 1, borderColor: "#d9c9a4", borderRadius: 4, padding: 10, marginBottom: 12 },
  parteiRolle: { fontSize: 8.5, color: "#64748b", marginBottom: 2, textTransform: "uppercase" },
  parteiName: { fontFamily: "Helvetica-Bold", fontSize: 10.5 },
  parteiZeile: { fontSize: 9.5, color: INK },
  klauselTitel: { fontFamily: "Helvetica-Bold", fontSize: 10.5, marginTop: 10, marginBottom: 4 },
  klauselAbsatz: { fontSize: 9, color: "#222", lineHeight: 1.5, marginBottom: 5, textAlign: "justify" },
  konditionRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  konditionLabel: { color: "#334155", flex: 1 },
  konditionValue: { fontFamily: "Helvetica-Bold", textAlign: "right" },
  hinweis: { fontSize: 8, color: "#94a3b8", marginTop: 12, lineHeight: 1.4 },
  sigBlock: { marginTop: 26 },
  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 30 },
  sigCol: { width: "45%" },
  sigLine: { borderTopWidth: 1, borderTopColor: INK, marginTop: 24, paddingTop: 4 },
  sigCaption: { fontSize: 9, color: "#334155" },
});

function Partei({ rolle, name, zeilen }: { rolle: string; name: string; zeilen: string[] }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={s.parteiRolle}>{rolle}</Text>
      <Text style={s.parteiName}>{name}</Text>
      {zeilen.filter(Boolean).map((z, i) => (
        <Text key={i} style={s.parteiZeile}>
          {z}
        </Text>
      ))}
    </View>
  );
}

export function ContractDocument({
  firma,
  logoPfad,
  strombezieher,
  verbrauchsstelle,
  beginn,
  konditionen,
  unterschriftsort,
}: ContractData) {
  const firmaZeilen = [
    firma.anschrift,
    `${firma.plz} ${firma.ort}`.trim(),
    firma.kontaktTelefon ? `Tel. ${firma.kontaktTelefon}` : "",
    firma.kontaktEmail ?? "",
  ];
  const bezieherZeilen = [
    strombezieher.zusatz ?? "",
    verbrauchsstelle.strasse ?? "",
    verbrauchsstelle.plzOrt ?? "",
  ];

  return (
    <Document>
      <Page size="A4" style={letterStyles.page}>
        <Falzmarken />
        <LetterHeader logoPfad={logoPfad} firma={firma} />

        <Text style={s.docTitle}>Stromliefervertrag</Text>
        <Text style={s.docSubtitle}>
          für die Vollversorgung im gebäudeeigenen Stromkonzept (PV-Strom im Hauskonzept)
        </Text>

        <View style={s.parteienBox}>
          <Partei rolle="Strombezieher" name={strombezieher.name} zeilen={bezieherZeilen} />
          <Partei rolle="Lieferant" name={firma.name} zeilen={firmaZeilen} />
          <View style={{ borderTopWidth: 0.5, borderTopColor: "#d9c9a4", paddingTop: 6, marginTop: 2 }}>
            <Text style={s.parteiZeile}>
              Verbrauchsstelle: {[verbrauchsstelle.strasse, verbrauchsstelle.plzOrt].filter(Boolean).join(", ")}
              {verbrauchsstelle.einheit ? ` – ${verbrauchsstelle.einheit}` : ""}
            </Text>
          </View>
        </View>

        <View style={letterStyles.goldFillBox}>
          <Text style={letterStyles.boxTitle}>Konditionen</Text>
          <View style={s.konditionRow}>
            <Text style={s.konditionLabel}>Grundpreis pro Monat</Text>
            <Text style={s.konditionValue}>
              {konditionen.grundpreisNetto != null && konditionen.grundpreisBrutto != null
                ? `${fmtEuro(konditionen.grundpreisNetto)} € zzgl. MwSt. (${fmtEuro(konditionen.grundpreisBrutto)} € inkl.)`
                : "—"}
            </Text>
          </View>
          <View style={s.konditionRow}>
            <Text style={s.konditionLabel}>Strompreis pro kWh</Text>
            <Text style={s.konditionValue}>
              {`${fmtPreisKwh(konditionen.arbeitspreisNetto)} € zzgl. MwSt. (${fmtPreisKwh(konditionen.arbeitspreisBrutto)} € inkl.)`}
            </Text>
          </View>
          <View style={s.konditionRow}>
            <Text style={s.konditionLabel}>Abrechnungszeitraum</Text>
            <Text style={s.konditionValue}>kalenderjährlich</Text>
          </View>
          <View style={s.konditionRow}>
            <Text style={s.konditionLabel}>Anfängliche monatliche Abschlagszahlung</Text>
            <Text style={s.konditionValue}>
              {konditionen.abschlagBrutto != null ? `${fmtEuro(konditionen.abschlagBrutto)} € (inkl. MwSt.)` : "—"}
            </Text>
          </View>
          <View style={s.konditionRow}>
            <Text style={s.konditionLabel}>Zahlungsweise</Text>
            <Text style={s.konditionValue}>SEPA-Lastschrift (siehe SEPA-Lastschriftmandat)</Text>
          </View>
          <View style={s.konditionRow}>
            <Text style={s.konditionLabel}>Lieferbeginn</Text>
            <Text style={s.konditionValue}>{fmtDate(beginn)}</Text>
          </View>
          <View style={s.konditionRow}>
            <Text style={s.konditionLabel}>Grundlaufzeit</Text>
            <Text style={s.konditionValue}>für die Dauer des Mietverhältnisses</Text>
          </View>
        </View>

        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11, marginTop: 6, marginBottom: 2 }}>
          Vertragsbedingungen
        </Text>

        {VERTRAGSKLAUSELN.map((abschnitt) => (
          <View key={abschnitt.titel} wrap={false}>
            <Text style={s.klauselTitel}>{abschnitt.titel}</Text>
            {abschnitt.absaetze.map((p, i) => (
              <Text key={i} style={s.klauselAbsatz}>
                {p}
              </Text>
            ))}
          </View>
        ))}

        <View style={s.sigBlock} wrap={false}>
          <Text style={s.sigCaption}>{unterschriftsort}, den ……………………………</Text>
          <View style={s.sigRow}>
            <View style={s.sigCol}>
              <View style={s.sigLine}>
                <Text style={s.sigCaption}>Unterschrift Strombezieher</Text>
                <Text style={{ fontSize: 8.5, color: "#64748b" }}>{strombezieher.name}</Text>
              </View>
            </View>
            <View style={s.sigCol}>
              <View style={s.sigLine}>
                <Text style={s.sigCaption}>Unterschrift Lieferant</Text>
                <Text style={{ fontSize: 8.5, color: "#64748b" }}>{firma.name}</Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={s.hinweis}>{VERTRAG_MUSTERHINWEIS}</Text>

        <LetterFooter firma={firma} />
      </Page>
    </Document>
  );
}
