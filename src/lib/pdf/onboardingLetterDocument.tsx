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
import { fmtEuro, fmtPreisKwh, fmtProzent } from "./format";
import { abschnitt, abschnittZeilen } from "@/lib/dokumenteVorlagen";

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
  bearbeiterName?: string | null;
  kundennummer?: number | null;
  anredeSatz: string;
  // Geplanter Liefertermin (Objekt), bereits als DD.MM.YYYY formatiert - "" wenn
  // nicht gesetzt.
  lieferterminText?: string;
  // Vermieter:in-Bezeichnung für den Solaranlagen-Passus (Name oder Fallback).
  vermieterText?: string;
  // Adresse des Wohngebäudes (Straße & Hausnr.) für den {objektadresse}-Platzhalter.
  objektadresseText?: string;
  // Angenommener Jahresverbrauch als Text (z.B. "3.500 kWh") oder Fallback.
  verbrauchText?: string;
  konditionen: {
    arbeitspreisBrutto: number; // €/kWh
    grundpreisBrutto: number | null; // €/Monat
    abschlagBrutto: number | null; // €/Monat
  };
  // Grundversorger-Vergleich (null, wenn keine Vergleichsdaten erfasst wurden).
  vergleich: OnboardingVergleich | null;
  kontaktTelefon: string | null;
  // Editierbare Textabschnitte aus der Brief-Vorlage (leer -> Standardtexte).
  abschnitte: Map<string, string>;
}

const s = StyleSheet.create({
  vergleichRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#d9c9a4", paddingVertical: 4 },
  vergleichHeadRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: GOLD, paddingBottom: 4 },
  colLabel: { flex: 1.6, color: "#334155" },
  colVal: { flex: 1, textAlign: "right" },
  colHead: { fontFamily: "Helvetica-Bold", fontSize: 9.5 },
  vorteil: { color: "#1a7f37", fontFamily: "Helvetica-Bold" },
  // Fliesstext der Abschnitte - bewusst in der Grundschriftgroesse des Briefs
  // (letterStyles.page), damit alle Absaetze einheitlich wirken.
  passus: { lineHeight: 1.5 },
});

export function OnboardingLetterDocument({
  firma,
  logoPfad,
  empfaenger,
  bearbeiterName,
  kundennummer,
  anredeSatz,
  lieferterminText,
  vermieterText,
  objektadresseText,
  verbrauchText,
  konditionen,
  vergleich,
  kontaktTelefon,
  abschnitte,
}: OnboardingLetterData) {
  const hatVergleich =
    vergleich && (vergleich.arbeitspreisBrutto != null || vergleich.grundpreisBrutto != null);
  const telefonZusatz = kontaktTelefon ? ` unter ${kontaktTelefon}` : "";
  const vermieter = vermieterText || "Ihrer Vermieterin bzw. Ihrem Vermieter";
  const verbrauch = verbrauchText || "einem üblichen Haushaltsverbrauch";
  const platzhalter = {
    firma: firma.name,
    telefon: telefonZusatz,
    vermieter,
    objektadresse: objektadresseText || "Ihrem Wohngebäude",
    liefertermin: lieferterminText || "",
    verbrauch,
  };
  const t = (key: string, standard: string) => abschnitt(abschnitte, key, standard, platzhalter);

  return (
    <Document>
      <Page size="A4" style={pageStyle}>
        <Falzmarken />
        <LetterHeader logoPfad={logoPfad} firma={firma} zusatz={{ bearbeiterName, kundennummer }} />
        <EmpfaengerAdresse empfaenger={empfaenger} firma={firma} />

        <Text style={letterStyles.title}>{t("titel", "Ihr Strom aus der Gebäudestromanlage")}</Text>
        <OrtDatumZeile ort={firma.ort} datum={new Date()} />

        <View style={letterStyles.section}>
          <Text>{anredeSatz},</Text>
          <Text>
            {t(
              "einleitung",
              "in Absprache mit {vermieter} haben wir auf Ihrem Wohngebäude eine Solaranlage installiert und freuen uns, Sie nun mit umweltfreundlichem Strom aus der Gebäudestromanlage versorgen zu können. Nachfolgend finden Sie Ihre persönlichen Konditionen sowie einen Vergleich mit dem örtlichen Grundversorger.",
            )}
          </Text>
          {lieferterminText ? (
            <Text style={{ marginTop: 8 }}>
              {t(
                "liefertermin-hinweis",
                "Die Umstellung auf die Versorgung über die Gebäudestromanlage ist zum {liefertermin} geplant.",
              )}
            </Text>
          ) : null}
        </View>

        <View style={letterStyles.goldFillBox}>
          <Text style={letterStyles.boxTitle}>{t("konditionen-titel", "Ihre Konditionen bei Nuola Solar")}</Text>
          <View style={letterStyles.row}>
            <Text style={letterStyles.label}>Beginn der Stromlieferung</Text>
            <Text style={letterStyles.value}>wird Ihnen rechtzeitig mitgeteilt</Text>
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
              {t("vergleich-titel", "Ihr Preisvorteil gegenüber dem Grundversorger")}
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
                <Text style={s.colVal}>{fmtPreisKwh(vergleich.arbeitspreisBrutto)} €</Text>
                <Text style={s.colVal}>{fmtPreisKwh(konditionen.arbeitspreisBrutto)} €</Text>
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
                <Text style={s.colVal}>{fmtEuro(vergleich.grundpreisBrutto)} €</Text>
                <Text style={s.colVal}>
                  {konditionen.grundpreisBrutto != null ? `${fmtEuro(konditionen.grundpreisBrutto)} €` : "—"}
                </Text>
                <Text style={[s.colVal, s.vorteil]}>
                  {vergleich.vorteilGrundpreisProzent != null
                    ? `${fmtProzent(vergleich.vorteilGrundpreisProzent)} %`
                    : "—"}
                </Text>
              </View>
            )}
            <Text style={{ fontSize: 8.5, color: "#64748b", marginTop: 6 }}>
              {t(
                "vergleich-hinweis",
                "Positive Werte in der Spalte „Ihr Vorteil\" bedeuten, dass unser Preis unter dem des Grundversorgers liegt.",
              )}
            </Text>
          </View>
        )}

        <View style={letterStyles.section}>
          <Text style={letterStyles.boxTitle}>{t("gebaeude-titel", "Versorgung über die Gebäudestromanlage")}</Text>
          <Text style={s.passus}>
            {t(
              "gebaeude-text",
              `Das Mietobjekt wird über eine Gebäudestromanlage im Sinne des § 42b Energiewirtschaftsgesetz (EnWG) mit elektrischer Energie versorgt. Betreiberin der Gebäudestromanlage und Stromlieferantin ist die ${firma.name}. Der Strom wird ohne Durchleitung durch ein öffentliches Netz an Ihre Verbrauchsstelle geliefert. Die Belieferung erfolgt für die Dauer des Mietverhältnisses; der Stromverbrauch wird über einen geeichten, Ihrem Mietobjekt eindeutig zugeordneten Stromzähler erfasst.`,
            )}
          </Text>
        </View>

        <View style={letterStyles.section}>
          <Text style={letterStyles.boxTitle}>{t("abschlag-titel", "Ihr monatlicher Abschlag")}</Text>
          <Text style={s.passus}>
            {t(
              "abschlag-text",
              "Ihr monatlicher Abschlag basiert auf einem angenommenen Jahresverbrauch von {verbrauch}. Weicht Ihr tatsächlicher Verbrauch hiervon ab, teilen Sie uns Ihren letzten Jahresverbrauch gerne schriftlich mit – wir passen Ihren Abschlag dann entsprechend an.",
            )}
          </Text>
        </View>

        <View style={letterStyles.section}>
          <Text style={letterStyles.boxTitle}>{t("wechsel-titel", "Der Wechsel – ganz ohne Aufwand für Sie")}</Text>
          <Text style={s.passus}>
            {t(
              "wechsel-text",
              "Um Ihnen den Wechsel so einfach wie möglich zu machen, übernehmen wir die Abmeldung Ihres bisherigen Stromzählers und die Kündigung Ihres bestehenden Stromliefervertrags. Für Sie entstehen dadurch keine finanziellen Nachteile. Etwaige Gasverträge bleiben hiervon unberührt.",
            )}
          </Text>
        </View>

        <View style={letterStyles.section}>
          <Text style={s.passus}>
            {t(
              "rueckgabe-text",
              "Bitte senden Sie uns die beigefügten, von Ihnen unterschriebenen Unterlagen möglichst innerhalb von fünf Werktagen per Post oder E-Mail zurück, damit wir Ihre Belieferung rechtzeitig einrichten können. Herzlichen Dank für Ihr Vertrauen!",
            )}
          </Text>
        </View>

        <View style={letterStyles.section}>
          <Text>
            {t(
              "schluss",
              `Haben Sie Fragen oder Unklarheiten zu Ihrem Angebot? Rufen Sie uns gerne an${telefonZusatz}. Wir beraten Sie persönlich und beantworten Ihre Fragen rund um Ihre Stromversorgung.`,
            )}
          </Text>
          <Text style={{ marginTop: 10 }}>{t("gruss", "Mit freundlichen Grüßen")}</Text>
          {abschnittZeilen(abschnitte, "unterschrift", [firma.name], platzhalter).map((zeile, i) => (
            <Text key={i}>{zeile}</Text>
          ))}
        </View>

        <LetterFooter firma={firma} />
        <Seitenzahl />
      </Page>
    </Document>
  );
}
