import { Document, Page, Text, View } from "@react-pdf/renderer";
import {
  letterStyles,
  pageStyle,
  LetterHeader,
  EmpfaengerAdresse,
  LetterFooter,
  Seitenzahl,
  OrtDatumZeile,
  Falzmarken,
  type FirmaBriefData,
  type EmpfaengerData,
} from "./letterLayout";
import { fmtEuro, fmtDate } from "./format";
import { abschnitt, abschnittZeilen } from "@/lib/dokumenteVorlagen";

export interface WelcomeLetterData {
  firma: FirmaBriefData;
  logoPfad: string | null;
  empfaenger: EmpfaengerData;
  // Briefkopf-Zusatz (rechts oben bei der Firmenanschrift).
  bearbeiterName?: string | null;
  kundennummer?: number | null;
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
  // Editierbare Textabschnitte aus der Brief-Vorlage (leer -> Standardtexte).
  abschnitte: Map<string, string>;
}

export function WelcomeLetterDocument({
  firma,
  logoPfad,
  empfaenger,
  bearbeiterName,
  kundennummer,
  anredeSatz,
  mietpartei,
  konditionen,
  zugang,
  abschnitte,
}: WelcomeLetterData) {
  const t = (key: string, standard: string) => abschnitt(abschnitte, key, standard, { firma: firma.name });
  return (
    <Document>
      <Page size="A4" style={{ ...pageStyle, paddingTop: 34, lineHeight: 1.4 }}>
        <Falzmarken />
        <LetterHeader logoPfad={logoPfad} firma={firma} zusatz={{ bearbeiterName, kundennummer }} />
        <EmpfaengerAdresse empfaenger={empfaenger} firma={firma} />

        <Text style={[letterStyles.title, { marginBottom: 6 }]}>
          {t("titel", "Willkommen im Nuola Energy Dashboard")}
        </Text>
        <OrtDatumZeile ort={firma.ort} datum={new Date()} />

        <View style={[letterStyles.section, { marginBottom: 8 }]}>
          <Text>{anredeSatz},</Text>
          <Text>
            {t(
              "einleitung",
              "für Ihre Wohnung wurde ein persönlicher Zugang zu unserem Strom-Portal eingerichtet. Dort sehen Sie jederzeit Ihren monatlichen Stromverbrauch und Ihre Jahresabrechnungen. Nachfolgend finden Sie Ihre Konditionen und Zugangsdaten.",
            )}
          </Text>
        </View>

        <View style={[letterStyles.goldFillBox, { padding: 9, marginBottom: 9 }]}>
          <Text style={letterStyles.boxTitle}>{t("konditionen-titel", "Ihre Konditionen")}</Text>
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

        <View style={[letterStyles.goldBox, { padding: 9, marginBottom: 9 }]}>
          <Text style={letterStyles.boxTitle}>{t("zugang-titel", "Ihre Zugangsdaten")}</Text>
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
            {t("zugang-hinweis", "Bitte ändern Sie das Passwort bei der ersten Anmeldung.")}
          </Text>
        </View>

        <View style={[letterStyles.section, { marginBottom: 8 }]}>
          <Text style={letterStyles.boxTitle}>{t("portal-titel", "Was Sie im Portal tun können")}</Text>
          {abschnittZeilen(abschnitte, "portal-punkte", [
            "Ihren monatlichen Stromverbrauch (kWh) einsehen und mit Vormonaten und Vorjahresmonaten vergleichen",
            "den Verlauf der letzten 12 Monate einsehen",
            "Ihre freigegebenen Jahresabrechnungen als PDF herunterladen",
            "Ihr Passwort selbst ändern und bei Bedarf zurücksetzen",
          ]).map((punkt, i) => (
            <View style={{ flexDirection: "row", marginBottom: 2 }} key={i}>
              <Text style={{ width: 12 }}>•</Text>
              <Text style={{ flex: 1 }}>{punkt}</Text>
            </View>
          ))}
        </View>

        <View style={[letterStyles.section, { marginBottom: 6 }]}>
          <Text>
            {t(
              "schluss",
              "Bei Fragen wenden Sie sich gerne an uns. Wir wünschen Ihnen einen guten Überblick über Ihren Stromverbrauch.",
            )}
          </Text>
          <Text style={{ marginTop: 6 }}>Mit freundlichen Grüßen</Text>
          <Text>{firma.name}</Text>
        </View>

        <LetterFooter firma={firma} />
        <Seitenzahl />
      </Page>
    </Document>
  );
}
