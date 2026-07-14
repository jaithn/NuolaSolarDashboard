import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import {
  letterStyles,
  pageStyle,
  LetterHeader,
  LetterFooter,
  Seitenzahl,
  Falzmarken,
  GOLD,
  INK,
  type FirmaBriefData,
} from "./letterLayout";
import { fmtEuro, fmtPreisKwh, fmtDate } from "./format";
import { MarkdownBlocks, type MarkdownStyles } from "./markdown";

// Vertrags-PDF fuer beide Vertragsarten:
// - "eigenstaendig": Nuola-Layout (Briefkopf/Fusszeile/Gold); Gegenpartei ist
//   die Firma aus den Stammdaten.
// - "ergaenzung": schlichtes Layout OHNE Nuola-Bezug (kein Logo/keine Fusszeile,
//   neutrale Farben); Gegenpartei ist der Vermieter.
// Der Vertragstext (Klauseln) kommt versioniert als Markdown; die Parteien,
// die Preistabelle und die Unterschriften erzeugt diese Komponente dynamisch.

export type VertragVariant = "eigenstaendig" | "ergaenzung";

export interface ContractParty {
  rolle: string; // z.B. "Strombezieher", "Lieferant", "Vermieter"
  name: string;
  zeilen: string[];
}

export interface ContractData {
  variant: VertragVariant;
  firma: FirmaBriefData;
  logoPfad: string | null;
  // Briefkopf-Zusatz (nur eigenständiger Vertrag mit Nuola-Layout).
  bearbeiterName?: string | null;
  kundennummer?: number | null;
  titel: string;
  versionLabel: string; // z.B. "Version 1.0"
  inhaltMd: string; // Vertragstext (Markdown)
  strombezieher: ContractParty; // Mietende
  gegenpartei: ContractParty; // Firma (eigenstaendig) bzw. Vermieter (ergaenzung)
  verbrauchsstelle: {
    strasse: string | null;
    plzOrt: string | null;
    einheit: string;
    // Name(n) des zugeordneten Zählers (Shelly-Gerät). Null, wenn keiner zugeordnet.
    zaehler?: string | null;
  };
  beginn: Date;
  konditionen: {
    grundpreisNetto: number | null;
    grundpreisBrutto: number | null;
    arbeitspreisNetto: number;
    arbeitspreisBrutto: number;
    abschlagBrutto: number | null;
  };
  // Vorbelegter Ort je Unterschrift (Ort des Mieters bzw. der Gegenpartei).
  strombezieherOrt: string;
  gegenparteiOrt: string;
}

// Schlichtes Layout (Ergaenzung): eigene Seiten-Paddings, da ohne Briefkopf.
// Bewusst EINFACHES Objekt (nicht StyleSheet.create) - sonst wird die Seitenzahl
// (render-Callback) auf dieser Page nicht gemalt (react-pdf 4.5.1).
const plainPageStyle = {
  paddingTop: 48,
  paddingBottom: 56,
  paddingHorizontal: 55,
  fontSize: 10,
  fontFamily: "Helvetica",
  color: "#111",
  lineHeight: 1.5,
} as const;

const s = StyleSheet.create({
  docTitle: { fontSize: 15, marginTop: 8, marginBottom: 2, fontFamily: "Helvetica-Bold" },
  docTitleGold: { color: GOLD },
  docSubtitle: { fontSize: 9.5, marginBottom: 14, color: "#334155" },
  parteienBox: { borderWidth: 1, borderColor: "#d9c9a4", borderRadius: 4, padding: 10, marginBottom: 12 },
  parteienBoxPlain: { borderWidth: 1, borderColor: "#bbb", borderRadius: 2, padding: 10, marginBottom: 12 },
  parteiRolle: { fontSize: 8.5, color: "#64748b", marginBottom: 2, textTransform: "uppercase" },
  parteiName: { fontFamily: "Helvetica-Bold", fontSize: 10.5 },
  parteiZeile: { fontSize: 9.5 },
  konditionRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  konditionLabel: { color: "#334155", flex: 1 },
  konditionValue: { fontFamily: "Helvetica-Bold", textAlign: "right" },
  konditionBoxPlain: { borderWidth: 1, borderColor: "#bbb", borderRadius: 2, padding: 12, marginBottom: 14 },
  bedingungenTitel: { fontFamily: "Helvetica-Bold", fontSize: 11, marginTop: 6, marginBottom: 2 },
  sigBlock: { marginTop: 26 },
  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 30 },
  sigCol: { width: "45%" },
  sigLine: { borderTopWidth: 1, borderTopColor: INK, marginTop: 24, paddingTop: 4 },
  sigCaption: { fontSize: 9, color: "#334155" },
  plainFooter: { position: "absolute", bottom: 24, left: 55, right: 55, fontSize: 7.5, color: "#9aa0a6", textAlign: "center" },
});

// Markdown-Stile fuer den Vertragstext (fuer beide Varianten gleich lesbar).
const mdStyles: MarkdownStyles = {
  h2: { fontFamily: "Helvetica-Bold", fontSize: 10.5, marginTop: 10, marginBottom: 4 },
  h3: { fontFamily: "Helvetica-Bold", fontSize: 10, marginTop: 6, marginBottom: 3 },
  absatz: { fontSize: 9, color: "#222", lineHeight: 1.5, marginBottom: 5, textAlign: "justify" },
  listItem: { fontSize: 9, color: "#222", lineHeight: 1.5, flex: 1 },
  bullet: { width: 12, fontSize: 9, color: "#222" },
  fontFamilyBold: "Helvetica-Bold",
};

function Partei({ partei }: { partei: ContractParty }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={s.parteiRolle}>{partei.rolle}</Text>
      <Text style={s.parteiName}>{partei.name}</Text>
      {partei.zeilen.filter(Boolean).map((z, i) => (
        <Text key={i} style={s.parteiZeile}>
          {z}
        </Text>
      ))}
    </View>
  );
}

function Konditionen({ konditionen }: { konditionen: ContractData["konditionen"] }) {
  return (
    <View style={letterStyles.goldFillBox}>
      <Text style={letterStyles.boxTitle}>Anfängliche Konditionen</Text>
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
    </View>
  );
}

/** Ort-/Datum-Zeile je Partei - beide Parteien tragen Ort und Datum selbst ein
 *  (Ort ist mit dem hinterlegten Ort der jeweiligen Partei vorbelegt). */
function OrtDatum({ ort }: { ort: string }) {
  const ortText = ort?.trim() || "Ort";
  return <Text style={s.sigCaption}>{`${ortText}, den ……………………………`}</Text>;
}

function Unterschriften({
  links,
  rechts,
  linksOrt,
  rechtsOrt,
}: {
  links: ContractParty;
  rechts: ContractParty;
  linksOrt: string;
  rechtsOrt: string;
}) {
  return (
    <View style={s.sigBlock} wrap={false}>
      <View style={s.sigRow}>
        <View style={s.sigCol}>
          <OrtDatum ort={linksOrt} />
          <View style={s.sigLine}>
            <Text style={s.sigCaption}>Unterschrift {links.rolle}</Text>
            <Text style={{ fontSize: 8.5, color: "#64748b" }}>{links.name}</Text>
          </View>
        </View>
        <View style={s.sigCol}>
          <OrtDatum ort={rechtsOrt} />
          <View style={s.sigLine}>
            <Text style={s.sigCaption}>Unterschrift {rechts.rolle}</Text>
            <Text style={{ fontSize: 8.5, color: "#64748b" }}>{rechts.name}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export function ContractDocument(data: ContractData) {
  const {
    variant,
    firma,
    logoPfad,
    titel,
    versionLabel,
    inhaltMd,
    strombezieher,
    gegenpartei,
    verbrauchsstelle,
    beginn,
    konditionen,
    strombezieherOrt,
    gegenparteiOrt,
    bearbeiterName,
    kundennummer,
  } = data;
  const plain = variant === "ergaenzung";

  const parteienBlock = (
    <>
      <View style={plain ? s.parteienBoxPlain : s.parteienBox}>
        <Partei partei={strombezieher} />
        <Partei partei={gegenpartei} />
        <View style={{ borderTopWidth: 0.5, borderTopColor: plain ? "#ccc" : "#d9c9a4", paddingTop: 6, marginTop: 2 }}>
          <Text style={s.parteiZeile}>
            Verbrauchsstelle: {[verbrauchsstelle.strasse, verbrauchsstelle.plzOrt].filter(Boolean).join(", ")}
            {verbrauchsstelle.einheit ? ` – ${verbrauchsstelle.einheit}` : ""}
            {verbrauchsstelle.zaehler ? ` – Zähler: ${verbrauchsstelle.zaehler}` : ""}
          </Text>
          <Text style={s.parteiZeile}>Lieferbeginn: {fmtDate(beginn)}</Text>
        </View>
      </View>
    </>
  );

  const koerper = (
    <>
      {parteienBlock}
      {/* Konditionen-Box nur im eigenständigen Stromliefervertrag; die
          Mietvertrags-Ergänzung verweist stattdessen auf den Stromliefervertrag. */}
      {plain ? null : <Konditionen konditionen={konditionen} />}
      <Text style={s.bedingungenTitel}>Vertragsbedingungen</Text>
      <MarkdownBlocks md={inhaltMd} styles={mdStyles} />
      <Unterschriften
        links={strombezieher}
        rechts={gegenpartei}
        linksOrt={strombezieherOrt}
        rechtsOrt={gegenparteiOrt}
      />
    </>
  );

  // Ergaenzung: schlichtes Layout ohne Nuola-Branding.
  if (plain) {
    return (
      <Document>
        <Page size="A4" style={plainPageStyle}>
          <Text style={s.docTitle}>{titel}</Text>
          <Text style={s.docSubtitle}>{versionLabel}</Text>
          {koerper}
          {/* Seitenzahl als direktes Page-Kind mit INLINE-Style (StyleSheet-Ref
              + render wird in react-pdf 4.5.1 nicht gemalt). */}
          <Text
            style={{ position: "absolute", bottom: 40, left: 55, right: 55, fontSize: 7.5, color: "#9aa0a6", textAlign: "right" }}
            fixed
            render={({ pageNumber, totalPages }) => (totalPages > 1 ? `Seite ${pageNumber} von ${totalPages}` : "")}
          />
          <Text style={s.plainFooter} fixed>
            {titel} · {versionLabel}
          </Text>
        </Page>
      </Document>
    );
  }

  // Eigenstaendiger Vertrag: Nuola-Layout.
  return (
    <Document>
      <Page size="A4" style={pageStyle}>
        <Falzmarken />
        <LetterHeader logoPfad={logoPfad} firma={firma} zusatz={{ bearbeiterName, kundennummer }} />
        <Text style={[s.docTitle, s.docTitleGold]}>{titel}</Text>
        <Text style={s.docSubtitle}>
          {versionLabel} · für die Vollversorgung im gebäudeeigenen Stromkonzept (PV-Strom im Hauskonzept)
        </Text>
        {koerper}
        <LetterFooter firma={firma} />
        <Seitenzahl />
      </Page>
    </Document>
  );
}
