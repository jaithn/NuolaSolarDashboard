import { Document, Page, Text, View } from "@react-pdf/renderer";
import {
  letterStyles,
  LetterHeader,
  EmpfaengerAdresse,
  LetterFooter,
  Falzmarken,
  type FirmaBriefData,
  type EmpfaengerData,
} from "./letterLayout";

export interface WelcomeLetterData {
  firma: FirmaBriefData;
  logoPfad: string | null;
  empfaenger: EmpfaengerData;
  // Vollständige Briefanrede, z.B. "Sehr geehrte Familie Yilmaz" (mit Fallback).
  anredeSatz: string;
  mietpartei: {
    einzugsdatum: Date;
  };
  konditionen: {
    arbeitspreisBrutto: number; // €/kWh
    grundpreisBrutto: number | null; // €/Monat
    abschlagBrutto: number | null; // €/Monat
  };
  zugang: {
    loginUrl: string;
    benutzername: string;
    passwort: string;
  };
}

function fmtEuro(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: Date): string {
  return d.toLocaleDateString("de-DE");
}

export function WelcomeLetterDocument({
  firma,
  logoPfad,
  empfaenger,
  anredeSatz,
  mietpartei,
  konditionen,
  zugang,
}: WelcomeLetterData) {
  return (
    <Document>
      <Page size="A4" style={letterStyles.page}>
        <Falzmarken />
        <LetterHeader logoPfad={logoPfad} firma={firma} />
        <EmpfaengerAdresse empfaenger={empfaenger} />

        <Text style={letterStyles.title}>Willkommen im Nuola Energy Dashboard</Text>

        <View style={letterStyles.section}>
          <Text>{anredeSatz},</Text>
          <Text>
            für Ihre Wohnung wurde ein persönlicher Zugang zu unserem Strom-Portal eingerichtet. Dort
            sehen Sie jederzeit Ihren monatlichen Stromverbrauch und Ihre Jahresabrechnungen. Nachfolgend
            finden Sie Ihre Konditionen und Zugangsdaten.
          </Text>
        </View>

        <View style={letterStyles.goldFillBox}>
          <Text style={letterStyles.boxTitle}>Ihre Konditionen</Text>
          <View style={letterStyles.row}>
            <Text style={letterStyles.label}>Beginn der Stromlieferung</Text>
            <Text style={letterStyles.value}>{fmtDate(mietpartei.einzugsdatum)}</Text>
          </View>
          <View style={letterStyles.row}>
            <Text style={letterStyles.label}>Arbeitspreis (brutto)</Text>
            <Text style={letterStyles.value}>{fmtEuro(konditionen.arbeitspreisBrutto)} €/kWh</Text>
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

        <View style={letterStyles.goldBox}>
          <Text style={letterStyles.boxTitle}>Ihre Zugangsdaten</Text>
          <View style={letterStyles.row}>
            <Text style={letterStyles.label}>Internetadresse</Text>
            <Text style={letterStyles.value}>{zugang.loginUrl}</Text>
          </View>
          <View style={letterStyles.row}>
            <Text style={letterStyles.label}>Benutzername</Text>
            <Text style={letterStyles.value}>{zugang.benutzername}</Text>
          </View>
          <View style={letterStyles.row}>
            <Text style={letterStyles.label}>Einmal-Passwort</Text>
            <Text style={letterStyles.value}>{zugang.passwort}</Text>
          </View>
          <Text style={{ fontSize: 9, color: "#334155", marginTop: 6 }}>
            Bitte ändern Sie das Passwort bei der ersten Anmeldung.
          </Text>
        </View>

        <View style={letterStyles.section}>
          <Text style={letterStyles.boxTitle}>Was Sie im Portal tun können</Text>
          {[
            "Ihren monatlichen Stromverbrauch (kWh) einsehen und mit Vormonaten und Vorjahresmonaten vergleichen",
            "den Verlauf der letzten 12 Monate einsehen",
            "Ihre freigegebenen Jahresabrechnungen als PDF herunterladen",
            "Ihr Passwort selbst ändern und bei Bedarf zurücksetzen",
          ].map((t, i) => (
            <View style={{ flexDirection: "row", marginBottom: 3 }} key={i}>
              <Text style={{ width: 12 }}>•</Text>
              <Text style={{ flex: 1 }}>{t}</Text>
            </View>
          ))}
        </View>

        <View style={letterStyles.section}>
          <Text>
            Bei Fragen wenden Sie sich gerne an uns. Wir wünschen Ihnen einen guten Überblick über Ihren
            Stromverbrauch.
          </Text>
          <Text style={{ marginTop: 10 }}>Mit freundlichen Grüßen</Text>
          <Text>{firma.name}</Text>
        </View>

        <LetterFooter firma={firma} />
      </Page>
    </Document>
  );
}
