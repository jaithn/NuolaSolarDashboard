import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

export interface InvoicePositionData {
  bezeichnung: string;
  nettoBetrag: number;
  steuersatzProzent: number;
  steuerBetrag: number;
  bruttoBetrag: number;
}

export interface InvoiceDocumentData {
  firma: {
    name: string;
    anschrift: string;
    plz: string;
    ort: string;
    steuernummer: string | null;
    ustIdNr: string | null;
    bankname: string | null;
    bankverbindung: string | null;
  };
  designvorlage: {
    logoPfad: string | null;
    primaerfarbe: string;
    sekundaerfarbe: string;
    fusszeileText: string | null;
  };
  mietpartei: { name: string; anschrift: string | null; plzOrt: string | null };
  rechnung: {
    rechnungsnummer: string;
    typ: string;
    ausstellungsdatum: Date;
    zeitraumVon: Date;
    zeitraumBis: Date;
    anfangszaehlerstandKwh: number;
    endzaehlerstandKwh: number;
    gesamtVerbrauchKwh: number;
    arbeitspreisNetto: number;
    grundgebuehrMonatlichNetto: number | null;
    summeAbschlaegeBrutto: number;
    verbrauchskostenBrutto: number;
    verrechnungBetrag: number;
  };
  positionen: InvoicePositionData[];
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1c1c21" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  firma: { fontSize: 9, color: "#475569" },
  logo: { width: 120, height: "auto" },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  detailBox: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 16,
    rowGap: 4,
    marginBottom: 20,
    padding: 8,
    backgroundColor: "#f8fafc",
  },
  detailItem: { fontSize: 9 },
  table: { marginTop: 8, borderTopWidth: 1, borderTopColor: "#cbd5e1" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingVertical: 4 },
  tableHeader: { fontWeight: 700, backgroundColor: "#f1f5f9" },
  colBezeichnung: { flex: 3 },
  colZahl: { flex: 1, textAlign: "right" },
  summaryBox: { marginTop: 16, alignItems: "flex-end" },
  summaryLine: { flexDirection: "row", gap: 8, marginBottom: 2 },
  verrechnungBox: { marginTop: 10, padding: 8, backgroundColor: "#f6edda", alignItems: "flex-end" },
  abschlussBox: { marginTop: 12, fontSize: 9.5, lineHeight: 1.4, color: "#334155" },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 8, color: "#94a3b8", textAlign: "center" },
});

function fmt(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: Date): string {
  return d.toLocaleDateString("de-DE");
}

export function InvoiceDocument({ firma, designvorlage, mietpartei, rechnung, positionen }: InvoiceDocumentData) {
  const steuerGruppen = new Map<number, { netto: number; steuer: number }>();
  for (const p of positionen) {
    const bucket = steuerGruppen.get(p.steuersatzProzent) ?? { netto: 0, steuer: 0 };
    bucket.netto += p.nettoBetrag;
    bucket.steuer += p.steuerBetrag;
    steuerGruppen.set(p.steuersatzProzent, bucket);
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={{ fontSize: 12, fontWeight: 700, color: designvorlage.primaerfarbe }}>{firma.name}</Text>
            <Text style={styles.firma}>{firma.anschrift}</Text>
            {(firma.plz || firma.ort) && <Text style={styles.firma}>{`${firma.plz} ${firma.ort}`.trim()}</Text>}
            {firma.steuernummer && <Text style={styles.firma}>Steuernummer: {firma.steuernummer}</Text>}
            {firma.ustIdNr && <Text style={styles.firma}>USt-IdNr.: {firma.ustIdNr}</Text>}
          </View>
          {designvorlage.logoPfad && <Image src={designvorlage.logoPfad} style={styles.logo} />}
        </View>

        <View style={{ marginBottom: 16 }}>
          <Text style={styles.firma}>{mietpartei.name}</Text>
          {mietpartei.anschrift && <Text style={styles.firma}>{mietpartei.anschrift}</Text>}
          {mietpartei.plzOrt && <Text style={styles.firma}>{mietpartei.plzOrt}</Text>}
        </View>

        <Text style={styles.title}>
          {rechnung.typ === "SCHLUSSRECHNUNG" ? "Schlussrechnung" : "Jahresabrechnung"} {rechnung.rechnungsnummer}
        </Text>
        <View style={styles.metaRow}>
          <Text>Ausstellungsdatum: {fmtDate(rechnung.ausstellungsdatum)}</Text>
          <Text>
            Leistungszeitraum: {fmtDate(rechnung.zeitraumVon)} – {fmtDate(rechnung.zeitraumBis)}
          </Text>
        </View>

        <View style={styles.detailBox}>
          <Text style={styles.detailItem}>Anfangszählerstand: {fmt(rechnung.anfangszaehlerstandKwh)} kWh</Text>
          <Text style={styles.detailItem}>Endzählerstand: {fmt(rechnung.endzaehlerstandKwh)} kWh</Text>
          <Text style={styles.detailItem}>Ermittelter Verbrauch: {fmt(rechnung.gesamtVerbrauchKwh)} kWh</Text>
          <Text style={styles.detailItem}>
            Arbeitspreis: {rechnung.arbeitspreisNetto.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} €/kWh (netto)
          </Text>
          {rechnung.grundgebuehrMonatlichNetto !== null && (
            <Text style={styles.detailItem}>
              Monatliche Grundgebühr: {fmt(rechnung.grundgebuehrMonatlichNetto)} € (netto)
            </Text>
          )}
        </View>

        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.colBezeichnung}>Position</Text>
            <Text style={styles.colZahl}>Netto</Text>
            <Text style={styles.colZahl}>MwSt.-Satz</Text>
            <Text style={styles.colZahl}>MwSt.-Betrag</Text>
            <Text style={styles.colZahl}>Brutto</Text>
          </View>
          {positionen.map((p, i) => (
            <View style={styles.tableRow} key={i}>
              <Text style={styles.colBezeichnung}>{p.bezeichnung}</Text>
              <Text style={styles.colZahl}>{fmt(p.nettoBetrag)} €</Text>
              <Text style={styles.colZahl}>{p.steuersatzProzent}%</Text>
              <Text style={styles.colZahl}>{fmt(p.steuerBetrag)} €</Text>
              <Text style={styles.colZahl}>{fmt(p.bruttoBetrag)} €</Text>
            </View>
          ))}
        </View>

        {steuerGruppen.size > 1 && (
          <View style={{ marginTop: 12 }}>
            <Text style={{ fontWeight: 700, marginBottom: 4 }}>Sammelsumme je Steuersatz</Text>
            {[...steuerGruppen.entries()].map(([satz, w]) => (
              <View style={styles.summaryLine} key={satz}>
                <Text>
                  {satz}%: Netto {fmt(w.netto)} € · MwSt. {fmt(w.steuer)} €
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.summaryBox}>
          <Text style={{ fontWeight: 700, marginTop: 10 }}>
            Verbrauchskosten gesamt (brutto): {fmt(rechnung.verbrauchskostenBrutto)} €
          </Text>
          <Text>Geleistete Abschläge (brutto): {fmt(rechnung.summeAbschlaegeBrutto)} €</Text>
        </View>

        <View style={styles.verrechnungBox}>
          <Text style={{ fontWeight: 700, fontSize: 12 }}>
            {rechnung.verrechnungBetrag >= 0 ? "Nachzahlung" : "Guthaben"}: {fmt(Math.abs(rechnung.verrechnungBetrag))} €
          </Text>
        </View>

        <View style={styles.abschlussBox}>
          {rechnung.verrechnungBetrag >= 0 ? (
            <Text>
              Der Nachzahlungsbetrag in Höhe von {fmt(rechnung.verrechnungBetrag)} € ist gemäß Mietvertrag
              innerhalb von zwei Wochen nach Zugang dieser Abrechnung fällig.
            </Text>
          ) : (
            <Text>
              Das Guthaben in Höhe von {fmt(Math.abs(rechnung.verrechnungBetrag))} € wird gemäß Mietvertrag mit der
              nächsten Mietforderung verrechnet oder auf Ihren Wunsch innerhalb von zwei Wochen ausgezahlt.
            </Text>
          )}
        </View>

        <Text style={styles.footer}>
          {[
            firma.name,
            firma.bankname ? `${firma.bankname}` : null,
            firma.bankverbindung ? `IBAN ${firma.bankverbindung}` : null,
            designvorlage.fusszeileText,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </Page>
    </Document>
  );
}
