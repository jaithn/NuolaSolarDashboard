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
  GOLD,
  type FirmaBriefData,
  type EmpfaengerData,
} from "./letterLayout";
import { fmtDate } from "./format";
import type { AusblickPdf } from "@/lib/billing/ausblick";

export interface InvoicePositionData {
  bezeichnung: string;
  nettoBetrag: number;
  steuersatzProzent: number;
  steuerBetrag: number;
  bruttoBetrag: number;
}

export interface InvoiceDocumentData {
  firma: FirmaBriefData;
  logoPfad: string | null;
  empfaenger: EmpfaengerData;
  bearbeiterName?: string | null;
  kundennummer?: number | null;
  anredeSatz: string;
  rechnung: {
    rechnungsnummer: string;
    typ: string;
    ausstellungsdatum: Date;
    zeitraumVon: Date;
    zeitraumBis: Date;
    anfangszaehlerstandKwh: number;
    endzaehlerstandKwh: number;
    gesamtVerbrauchKwh: number;
    verbrauchGeschaetzt: boolean;
    arbeitspreisNetto: number;
    grundgebuehrMonatlichNetto: number | null;
    summeAbschlaegeBrutto: number;
    verbrauchskostenBrutto: number;
    verrechnungBetrag: number;
  };
  positionen: InvoicePositionData[];
  // Ausblick auf Änderungen ab der nächsten Periode (optional): neue Preise
  // (mit Grund) und/oder neuer monatlicher Abschlag.
  ausblick?: AusblickPdf | null;
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12, fontSize: 9.5 },
  infoLine: { fontSize: 9, color: "#334155", marginBottom: 2 },
  table: { marginTop: 10, borderTopWidth: 1, borderTopColor: "#cbd5e1" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingVertical: 4 },
  tableHeader: { fontFamily: "Helvetica-Bold", backgroundColor: "#f1f5f9" },
  colBezeichnung: { flex: 3 },
  colZahl: { flex: 1, textAlign: "right" },
  summaryBox: { marginTop: 16, alignItems: "flex-end" },
  verrechnungBox: { marginTop: 10, padding: 8, backgroundColor: "#f6edda", alignItems: "flex-end" },
  abschlussBox: { marginTop: 12, fontSize: 9.5, lineHeight: 1.4, color: "#334155" },
  ausblickBox: { marginTop: 14, borderWidth: 1, borderColor: "#d9c9a4", borderRadius: 4, padding: 10 },
  ausblickTitel: { fontFamily: "Helvetica-Bold", fontSize: 10.5, color: GOLD, marginBottom: 4 },
  ausblickZeile: { fontSize: 9.5, color: "#334155", marginBottom: 3, lineHeight: 1.4 },
});

function fmtPreis4(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function fmt(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function InvoiceDocument({
  firma,
  logoPfad,
  empfaenger,
  bearbeiterName,
  kundennummer,
  anredeSatz,
  rechnung,
  positionen,
  ausblick,
}: InvoiceDocumentData) {
  const steuerGruppen = new Map<number, { netto: number; steuer: number }>();
  for (const p of positionen) {
    const bucket = steuerGruppen.get(p.steuersatzProzent) ?? { netto: 0, steuer: 0 };
    bucket.netto += p.nettoBetrag;
    bucket.steuer += p.steuerBetrag;
    steuerGruppen.set(p.steuersatzProzent, bucket);
  }

  const typLabel = rechnung.typ === "SCHLUSSRECHNUNG" ? "Schlussrechnung" : "Jahresabrechnung";

  return (
    <Document>
      <Page size="A4" style={pageStyle}>
        <Falzmarken />
        <LetterHeader logoPfad={logoPfad} firma={firma} zusatz={{ bearbeiterName, kundennummer }} />
        <EmpfaengerAdresse empfaenger={empfaenger} firma={firma} />

        <Text style={letterStyles.title}>
          {typLabel} {rechnung.rechnungsnummer}
        </Text>
        <OrtDatumZeile ort={firma.ort} datum={rechnung.ausstellungsdatum} />

        <View style={styles.metaRow}>
          <Text>Leistungszeitraum: {fmtDate(rechnung.zeitraumVon)} – {fmtDate(rechnung.zeitraumBis)}</Text>
        </View>

        <View style={letterStyles.section}>
          <Text>{anredeSatz},</Text>
          <Text>
            anbei erhalten Sie Ihre {typLabel} für den Zeitraum {fmtDate(rechnung.zeitraumVon)} bis{" "}
            {fmtDate(rechnung.zeitraumBis)}.
          </Text>
        </View>

        {/* Zählerstände im Nuola-Gold-Kasten (wie die Zugangsdaten im Willkommensbrief). */}
        <View style={letterStyles.goldBox}>
          <Text style={letterStyles.boxTitle}>Zählerstände</Text>
          <View style={letterStyles.row}>
            <Text style={letterStyles.label}>Anfangszählerstand ({fmtDate(rechnung.zeitraumVon)})</Text>
            <Text style={letterStyles.value}>{fmt(rechnung.anfangszaehlerstandKwh)} kWh</Text>
          </View>
          <View style={letterStyles.row}>
            <Text style={letterStyles.label}>Endzählerstand ({fmtDate(rechnung.zeitraumBis)})</Text>
            <Text style={letterStyles.value}>{fmt(rechnung.endzaehlerstandKwh)} kWh</Text>
          </View>
          <View style={letterStyles.row}>
            <Text style={letterStyles.label}>
              Ermittelter Verbrauch{rechnung.verbrauchGeschaetzt ? " (teilw. geschätzt)" : ""}
            </Text>
            <Text style={[letterStyles.value, { color: GOLD }]}>{fmt(rechnung.gesamtVerbrauchKwh)} kWh</Text>
          </View>
        </View>

        <View style={{ marginBottom: 8 }}>
          <Text style={styles.infoLine}>
            Arbeitspreis: {rechnung.arbeitspreisNetto.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} €/kWh (netto)
          </Text>
          {rechnung.grundgebuehrMonatlichNetto !== null && (
            <Text style={styles.infoLine}>
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
            <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 4 }}>Sammelsumme je Steuersatz</Text>
            {[...steuerGruppen.entries()].map(([satz, w]) => (
              <Text key={satz}>
                {satz}%: Netto {fmt(w.netto)} € · MwSt. {fmt(w.steuer)} €
              </Text>
            ))}
          </View>
        )}

        <View style={styles.summaryBox}>
          <Text style={{ fontFamily: "Helvetica-Bold", marginTop: 10 }}>
            Verbrauchskosten gesamt (brutto): {fmt(rechnung.verbrauchskostenBrutto)} €
          </Text>
          <Text>Geleistete Abschläge (brutto): {fmt(rechnung.summeAbschlaegeBrutto)} €</Text>
        </View>

        <View style={styles.verrechnungBox}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 12 }}>
            {rechnung.verrechnungBetrag >= 0 ? "Nachzahlung" : "Guthaben"}: {fmt(Math.abs(rechnung.verrechnungBetrag))} €
          </Text>
        </View>

        {rechnung.verbrauchGeschaetzt && (
          <View style={[styles.abschlussBox, { marginTop: 8 }]}>
            <Text>
              Hinweis: Für Zeiträume ohne Ablesewert wurde der Zählerstand gemäß § 7 des Mietvertrags
              (Verbrauchsschätzung) auf Basis der vorhandenen Messwerte geschätzt. Nach Vorliegen der
              tatsächlichen Verbrauchsdaten erfolgt erforderlichenfalls eine Korrektur.
            </Text>
          </View>
        )}

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

        {/* Ausblick: angekündigte Änderungen ab der nächsten Periode. */}
        {ausblick && (ausblick.preis || ausblick.abschlagBrutto != null) && (
          <View style={styles.ausblickBox} wrap={false}>
            <Text style={styles.ausblickTitel}>Ausblick: Änderungen ab {fmtDate(ausblick.gueltigAb)}</Text>
            {ausblick.preis && (
              <>
                <Text style={styles.ausblickZeile}>
                  Ab dem {fmtDate(ausblick.gueltigAb)} gelten neue Strompreise: Arbeitspreis{" "}
                  {fmtPreis4(ausblick.preis.arbeitspreisBrutto)} €/kWh (inkl. MwSt.)
                  {ausblick.preis.grundpreisBrutto != null
                    ? `, Grundpreis ${fmt(ausblick.preis.grundpreisBrutto)} €/Monat (inkl. MwSt.)`
                    : ""}
                  .
                </Text>
                {ausblick.preis.grund ? (
                  <Text style={styles.ausblickZeile}>Grund der Anpassung: {ausblick.preis.grund}</Text>
                ) : null}
              </>
            )}
            {ausblick.abschlagBrutto != null && (
              <Text style={styles.ausblickZeile}>
                Ihr neuer monatlicher Abschlag beträgt ab dem {fmtDate(ausblick.gueltigAb)}{" "}
                {fmt(ausblick.abschlagBrutto)} € (inkl. MwSt.).
              </Text>
            )}
          </View>
        )}

        <View style={[letterStyles.section, { marginTop: 14 }]}>
          <Text>Bei Fragen wenden Sie sich gerne an uns.</Text>
          <Text style={{ marginTop: 10 }}>Mit freundlichen Grüßen</Text>
          <Text>{firma.name}</Text>
        </View>

        <LetterFooter firma={firma} />
        <Seitenzahl />
      </Page>
    </Document>
  );
}
