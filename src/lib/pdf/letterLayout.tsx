import { Text, View, StyleSheet, Image } from "@react-pdf/renderer";

// Gemeinsames Layout aller Nuola-Briefe (Willkommensbrief, Rechnung, künftige
// Brief-Arten): Logo oben links, Absender oben rechts, Empfänger-Adressfeld im
// DIN-5008-Bereich (im Sichtfenster eines Fensterumschlags), Falzmarken in
// Nuola-Gold am linken Rand, einheitliche mehrzeilige Fußzeile.

export const GOLD = "#d9a441";
export const INK = "#1c1c21";

export interface FirmaBriefData {
  name: string;
  anschrift: string;
  plz: string;
  ort: string;
  steuernummer: string | null;
  ustIdNr?: string | null;
  bankname: string | null;
  bankverbindung: string | null;
  kontaktTelefon: string | null;
  kontaktEmail: string | null;
  webseite?: string | null;
}

export interface EmpfaengerData {
  anredeKurz?: string; // "Herr" | "Frau" | "Familie" | ""
  name: string; // Name bzw. Firma
  zusatz?: string | null; // z.B. Ansprechpartner bei Firma
  strasse: string | null;
  plzOrt: string | null;
}

export const letterStyles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 70, paddingHorizontal: 45, fontSize: 10.5, fontFamily: "Helvetica", color: INK, lineHeight: 1.5 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", minHeight: 70 },
  logo: { width: 150, height: "auto" },
  absender: { fontSize: 8.5, color: "#64748b", textAlign: "right" },
  // Empfänger-Adressfeld: so positioniert, dass es beim Falten (DIN A4, gedrittelt)
  // im Sichtfenster eines Fensterumschlags erscheint (~45 mm von oben).
  empfaengerZone: { marginTop: 18, marginBottom: 28, minHeight: 70 },
  title: { fontSize: 15, marginBottom: 10, color: GOLD, fontFamily: "Helvetica-Bold" },
  section: { marginBottom: 14 },
  goldBox: { padding: 12, borderWidth: 1, borderColor: GOLD, borderRadius: 4, marginBottom: 14 },
  goldFillBox: { padding: 12, backgroundColor: "#f6edda", borderRadius: 4, marginBottom: 14 },
  boxTitle: { fontSize: 11, marginBottom: 6, fontFamily: "Helvetica-Bold" },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  label: { color: "#334155" },
  value: { fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 26, left: 45, right: 45, fontSize: 7.5, color: "#94a3b8", textAlign: "center", lineHeight: 1.4 },
  // Falzmarken am linken Rand (Nuola-Gold), an den Dritteln der A4-Höhe.
  falzmarke: { position: "absolute", left: 0, width: 18, height: 1, backgroundColor: GOLD },
});

/** Falzmarken (Knickfalten) links am Rand – deuten die Faltung für den Fensterumschlag an. */
export function Falzmarken() {
  return (
    <>
      {/* 1. Falz bei 105 mm, 2. Falz bei 210 mm von oben (DIN 5008 / Fensterumschlag). */}
      <View style={[letterStyles.falzmarke, { top: 297 }]} fixed />
      <View style={[letterStyles.falzmarke, { top: 594 }]} fixed />
    </>
  );
}

export function LetterHeader({ logoPfad, firma }: { logoPfad: string | null; firma: FirmaBriefData }) {
  return (
    <View style={letterStyles.headerRow}>
      {logoPfad ? <Image src={logoPfad} style={letterStyles.logo} /> : <Text>{firma.name}</Text>}
      <View>
        <Text style={letterStyles.absender}>{firma.name}</Text>
        <Text style={letterStyles.absender}>{firma.anschrift}</Text>
        {(firma.plz || firma.ort) && <Text style={letterStyles.absender}>{`${firma.plz} ${firma.ort}`.trim()}</Text>}
      </View>
    </View>
  );
}

export function EmpfaengerAdresse({ empfaenger }: { empfaenger: EmpfaengerData }) {
  const anredeName = [empfaenger.anredeKurz, empfaenger.name].filter(Boolean).join(" ");
  return (
    <View style={letterStyles.empfaengerZone}>
      <Text>{anredeName}</Text>
      {empfaenger.zusatz ? <Text>{empfaenger.zusatz}</Text> : null}
      {empfaenger.strasse ? <Text>{empfaenger.strasse}</Text> : null}
      {empfaenger.plzOrt ? <Text>{empfaenger.plzOrt}</Text> : null}
    </View>
  );
}

/** Einheitliche Fußzeile aller Briefe: Firma, Anschrift, Steuernummer, Bank, Telefon, E-Mail. */
export function LetterFooter({ firma }: { firma: FirmaBriefData }) {
  const zeile1 = [firma.name, [firma.anschrift, `${firma.plz} ${firma.ort}`.trim()].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(" · ");
  const zeile2 = [
    firma.steuernummer ? `Steuernummer ${firma.steuernummer}` : null,
    firma.ustIdNr ? `USt-IdNr. ${firma.ustIdNr}` : null,
    firma.bankname ? firma.bankname : null,
    firma.bankverbindung ? `IBAN ${firma.bankverbindung}` : null,
    firma.kontaktTelefon ? `Tel. ${firma.kontaktTelefon}` : null,
    firma.kontaktEmail ? firma.kontaktEmail : null,
    firma.webseite ? firma.webseite : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={letterStyles.footer} fixed>
      <Text>{zeile1}</Text>
      {zeile2 ? <Text>{zeile2}</Text> : null}
    </View>
  );
}
