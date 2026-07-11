import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

export interface WelcomeLetterData {
  firma: {
    name: string;
    anschrift: string;
    bankverbindung: string | null;
  };
  design: {
    logoPfad: string | null;
    primaerfarbe: string;
  };
  mietpartei: {
    name: string;
    anschrift: string | null;
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

const styles = StyleSheet.create({
  page: { padding: 44, fontSize: 10.5, fontFamily: "Helvetica", color: "#1c1c21", lineHeight: 1.5 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 },
  logo: { width: 150, height: "auto" },
  firma: { fontSize: 8.5, color: "#64748b", textAlign: "right" },
  empfaenger: { marginBottom: 24 },
  title: { fontSize: 15, marginBottom: 10 },
  section: { marginBottom: 14 },
  box: { padding: 12, backgroundColor: "#f6edda", borderRadius: 4, marginBottom: 14 },
  boxTitle: { fontSize: 11, marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  label: { color: "#334155" },
  value: { fontFamily: "Helvetica-Bold" },
  zugangBox: { padding: 12, borderWidth: 1, borderColor: "#d9a441", borderRadius: 4, marginBottom: 14 },
  bullet: { flexDirection: "row", marginBottom: 3 },
  bulletDot: { width: 12 },
  footer: { position: "absolute", bottom: 30, left: 44, right: 44, fontSize: 8, color: "#94a3b8", textAlign: "center" },
});

function fmtEuro(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: Date): string {
  return d.toLocaleDateString("de-DE");
}

export function WelcomeLetterDocument({ firma, design, mietpartei, konditionen, zugang }: WelcomeLetterData) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          {design.logoPfad ? <Image src={design.logoPfad} style={styles.logo} /> : <Text>{firma.name}</Text>}
          <View>
            <Text style={styles.firma}>{firma.name}</Text>
            <Text style={styles.firma}>{firma.anschrift}</Text>
          </View>
        </View>

        <View style={styles.empfaenger}>
          <Text>{mietpartei.name}</Text>
          {mietpartei.anschrift ? <Text>{mietpartei.anschrift}</Text> : null}
        </View>

        <Text style={[styles.title, { color: design.primaerfarbe }]}>Willkommen im Nuola Energy Dashboard</Text>

        <View style={styles.section}>
          <Text>Guten Tag {mietpartei.name},</Text>
          <Text>
            für Ihre Wohnung wurde ein persönlicher Zugang zu unserem Strom-Portal eingerichtet. Dort
            sehen Sie jederzeit Ihren monatlichen Stromverbrauch und Ihre Jahresabrechnungen. Nachfolgend
            finden Sie Ihre Konditionen und Zugangsdaten.
          </Text>
        </View>

        <View style={styles.box}>
          <Text style={styles.boxTitle}>Ihre Konditionen</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Einzugsdatum</Text>
            <Text style={styles.value}>{fmtDate(mietpartei.einzugsdatum)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Arbeitspreis (brutto)</Text>
            <Text style={styles.value}>{fmtEuro(konditionen.arbeitspreisBrutto)} €/kWh</Text>
          </View>
          {konditionen.grundpreisBrutto !== null && (
            <View style={styles.row}>
              <Text style={styles.label}>Grundpreis (brutto)</Text>
              <Text style={styles.value}>{fmtEuro(konditionen.grundpreisBrutto)} €/Monat</Text>
            </View>
          )}
          {konditionen.abschlagBrutto !== null && (
            <View style={styles.row}>
              <Text style={styles.label}>Monatlicher Abschlag (brutto)</Text>
              <Text style={styles.value}>{fmtEuro(konditionen.abschlagBrutto)} €/Monat</Text>
            </View>
          )}
        </View>

        <View style={styles.zugangBox}>
          <Text style={styles.boxTitle}>Ihre Zugangsdaten</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Internetadresse</Text>
            <Text style={styles.value}>{zugang.loginUrl}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Benutzername</Text>
            <Text style={styles.value}>{zugang.benutzername}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Einmal-Passwort</Text>
            <Text style={styles.value}>{zugang.passwort}</Text>
          </View>
          <Text style={{ fontSize: 9, color: "#334155", marginTop: 6 }}>
            Bitte ändern Sie das Passwort bei der ersten Anmeldung. Sie können sich mit Ihrem
            Benutzernamen oder Ihrer E-Mail-Adresse anmelden.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.boxTitle}>Was Sie im Portal tun können</Text>
          {[
            "Ihren monatlichen Stromverbrauch (kWh) einsehen und mit Vor- und Vorjahresmonaten vergleichen",
            "den Verlauf der letzten 12 Monate als Grafik betrachten",
            "Ihre freigegebenen Jahresabrechnungen als PDF herunterladen",
            "Ihr Passwort selbst ändern und bei Bedarf zurücksetzen",
          ].map((t, i) => (
            <View style={styles.bullet} key={i}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={{ flex: 1 }}>{t}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text>
            Bei Fragen wenden Sie sich gerne an uns. Wir wünschen Ihnen einen guten Überblick über Ihren
            Stromverbrauch.
          </Text>
          <Text style={{ marginTop: 10 }}>Mit freundlichen Grüßen</Text>
          <Text>{firma.name}</Text>
        </View>

        {firma.bankverbindung ? <Text style={styles.footer}>{firma.name} · {firma.bankverbindung}</Text> : null}
      </Page>
    </Document>
  );
}
