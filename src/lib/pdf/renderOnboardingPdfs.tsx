import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { berechneBrutto } from "@/lib/steuer";
import {
  mietparteiAnzeigeName,
  anredeSatz,
  empfaengerAnredeKurz,
  mietparteiPostanschrift,
  kombiniereNamen,
  vermieterAnredePhrase,
} from "@/lib/mietpartei";
import { verbrauchsstelleBezeichnung, type EinheitTyp } from "@/app/(admin)/admin/objekte/einheitTyp";
import { aktiveVertragVersion } from "@/lib/vertrag";
import type { VertragArt } from "@prisma/client";
import { ladeBriefAbschnitte } from "@/lib/briefVorlagen";
import { mandatsreferenz } from "@/lib/sepa";
import { fmtDate } from "./format";
import type { FirmaBriefData, EmpfaengerData } from "./letterLayout";
import { OnboardingLetterDocument, type OnboardingVergleich } from "./onboardingLetterDocument";
import { ContractDocument, type ContractParty, type VertragVariant } from "./contractDocument";
import { SepaMandateDocument } from "./sepaMandateDocument";

export type OnboardingDokumentTyp =
  | "anschreiben"
  | "anschreiben-persoenlich"
  | "vertrag-eigenstaendig"
  | "vertrag-ergaenzung"
  | "sepa";

export const ONBOARDING_DOKUMENT_TITEL: Record<OnboardingDokumentTyp, string> = {
  anschreiben: "Anschreiben",
  "anschreiben-persoenlich": "Anschreiben (persoenlich)",
  "vertrag-eigenstaendig": "Stromliefervertrag",
  "vertrag-ergaenzung": "Ergaenzung zum Mietvertrag",
  sepa: "SEPA-Lastschriftmandat",
};

/** Prozentualer Vorteil (positiv = unser Preis liegt darunter). Null, wenn kein Vergleich möglich. */
function vorteilProzent(grundversorger: number | null, nuola: number | null): number | null {
  if (grundversorger == null || nuola == null || grundversorger <= 0) return null;
  return ((grundversorger - nuola) / grundversorger) * 100;
}

/** Lädt alle gemeinsamen Daten (Firma, Empfänger, Konditionen brutto) einer Mietpartei. */
async function ladeBasis(mietparteiId: string) {
  const mietpartei = await prisma.mietpartei.findUniqueOrThrow({
    where: { id: mietparteiId },
    include: {
      arbeitspreisSteuersatz: true,
      grundpreisSteuersatz: true,
      einheit: {
        include: {
          objekt: true,
          // Zugeordnete Geräte (Zähler) für die Verbrauchsstellen-Zeile im Vertrag.
          geraetZuordnungen: { include: { shellyGeraet: true } },
        },
      },
      abschlaege: { orderBy: { gueltigAb: "desc" }, take: 1, include: { steuersatz: true } },
    },
  });

  const [firmaRaw, designvorlage] = await Promise.all([
    prisma.firmenStammdaten.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton", name: "Nuola Solar GbR", anschrift: "" },
    }),
    prisma.rechnungsDesignvorlage.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } }),
  ]);

  const logoAbsolutePath = designvorlage.logoPfad
    ? path.join(process.cwd(), "public", designvorlage.logoPfad)
    : path.join(process.cwd(), "public", "nuola-solar-logo.png");

  const firma: FirmaBriefData = {
    name: firmaRaw.name,
    anschrift: firmaRaw.anschrift,
    plz: firmaRaw.plz,
    ort: firmaRaw.ort,
    steuernummer: firmaRaw.steuernummer,
    ustIdNr: firmaRaw.ustIdNr,
    bankname: firmaRaw.bankname,
    bankverbindung: firmaRaw.bankverbindung,
    kontaktTelefon: firmaRaw.kontaktTelefon,
    kontaktEmail: firmaRaw.kontaktEmail,
    webseite: firmaRaw.webseite,
  };

  const arbeitspreisBrutto = berechneBrutto(
    mietpartei.arbeitspreisNetto,
    mietpartei.arbeitspreisSteuersatz.prozentsatz,
  ).bruttoBetrag;

  const grundpreisBrutto =
    mietpartei.grundpreisNetto != null && mietpartei.grundpreisSteuersatz
      ? berechneBrutto(mietpartei.grundpreisNetto, mietpartei.grundpreisSteuersatz.prozentsatz).bruttoBetrag
      : null;

  const aktuellerAbschlag = mietpartei.abschlaege[0];
  // Abschlag ist brutto (inkl. MwSt.) erfasst - genau dieser Wert wird gezeigt.
  // Fallback fuer Alt-Datensaetze ohne bruttoBetrag: aus dem Netto berechnen.
  const abschlagBrutto = aktuellerAbschlag
    ? aktuellerAbschlag.bruttoBetrag ??
      berechneBrutto(aktuellerAbschlag.nettoBetrag, aktuellerAbschlag.steuersatz.prozentsatz).bruttoBetrag
    : null;

  const objekt = mietpartei.einheit.objekt;
  const displayName = mietparteiAnzeigeName(mietpartei);
  const post = mietparteiPostanschrift(mietpartei, objekt);
  const empfaenger: EmpfaengerData = {
    anredeKurz: empfaengerAnredeKurz(mietpartei),
    name: displayName,
    strasse: post.strasse,
    plzOrt: post.plzOrt,
  };

  return {
    mietpartei,
    firma,
    logoAbsolutePath,
    displayName,
    empfaenger,
    objekt,
    // Briefkopf-Zusatz + SEPA-Angaben (für alle Onboarding-Dokumente).
    bearbeiterName: objekt.bearbeiterName,
    kundennummer: mietpartei.kundennummer,
    glaeubigerId: firmaRaw.glaeubigerId,
    konditionen: {
      arbeitspreisNetto: mietpartei.arbeitspreisNetto,
      arbeitspreisBrutto,
      grundpreisNetto: mietpartei.grundpreisNetto,
      grundpreisBrutto,
      abschlagBrutto,
    },
  };
}

/** Rendert eines der drei Onboarding-Dokumente als PDF-Buffer. */
export async function renderOnboardingPdf(
  mietparteiId: string,
  dok: OnboardingDokumentTyp,
): Promise<Buffer> {
  const basis = await ladeBasis(mietparteiId);
  const { firma, logoAbsolutePath, empfaenger, mietpartei, konditionen, objekt, displayName, bearbeiterName, kundennummer, glaeubigerId } =
    basis;

  // Vermieter:in aufloesen: Quelle ist bei PRO_EINHEIT die Wohn-/Gewerbeeinheit,
  // sonst das Objekt. Name = kombinierter Personenname; bei Anrede FIRMA gilt der
  // Firmenname. Die Hausverwaltung + der Unterzeichner der Ergaenzung liegen stets
  // am Objekt.
  const vq = objekt.vermieterModus === "PRO_EINHEIT" ? mietpartei.einheit : objekt;
  const vermieterName = kombiniereNamen(vq.vermieterName, vq.vermieterName2);
  const vermieter = {
    anrede: vq.vermieterAnrede,
    name: vermieterName,
    firma: vq.vermieterFirma,
    strasse: vq.vermieterAnschrift,
    ort: vq.vermieterOrt,
    plzOrt: `${vq.vermieterPlz} ${vq.vermieterOrt}`.trim(),
  };
  // Anzeigename der Vermieter:in (Vertrag): bei Firma der Firmenname, sonst der
  // Personenname (mit Fallback aufeinander).
  const vermieterAnzeige =
    vermieter.anrede === "FIRMA" ? vermieter.firma || vermieter.name : vermieter.name || vermieter.firma;

  if (dok === "anschreiben" || dok === "anschreiben-persoenlich") {
    // Zwei auswaehlbare Anschreiben-Varianten (formal / persoenlich) - beide
    // teilen sich Layout und Datenbasis, unterscheiden sich nur in den Texten
    // (BriefVorlage-Schluessel = dok).
    const abschnitte = await ladeBriefAbschnitte(dok);
    const gvArbeit = mietpartei.grundversorgerArbeitspreisBrutto;
    const gvGrund = mietpartei.grundversorgerGrundpreisBrutto;
    const vergleich: OnboardingVergleich | null = mietpartei.grundversorgerName
      ? {
          name: mietpartei.grundversorgerName,
          tarif: mietpartei.grundversorgerTarif,
          grundpreisBrutto: gvGrund,
          arbeitspreisBrutto: gvArbeit,
          vorteilArbeitspreisProzent: vorteilProzent(gvArbeit, konditionen.arbeitspreisBrutto),
          vorteilGrundpreisProzent: vorteilProzent(gvGrund, konditionen.grundpreisBrutto),
        }
      : null;

    return renderToBuffer(
      <OnboardingLetterDocument
        firma={firma}
        logoPfad={logoAbsolutePath}
        empfaenger={empfaenger}
        bearbeiterName={bearbeiterName}
        kundennummer={kundennummer}
        anredeSatz={anredeSatz(mietpartei)}
        lieferterminText={objekt.geplanterLiefertermin ? fmtDate(objekt.geplanterLiefertermin) : ""}
        vermieterText={(vermieter.anrede === "FIRMA" ? vermieter.firma : vermieter.name) || undefined}
        vermieterMitAnredeText={vermieterAnredePhrase({
          anrede: vq.vermieterAnrede ?? undefined,
          name: vq.vermieterName,
          firma: vq.vermieterFirma,
          anrede2: vq.vermieterAnrede2 ?? undefined,
          name2: vq.vermieterName2,
        })}
        verbrauchsstelleTyp={verbrauchsstelleBezeichnung(mietpartei.einheit.typ as EinheitTyp)}
        objektadresseText={objekt.adresse || undefined}
        verbrauchText={
          mietpartei.angenommenerJahresverbrauchKwh
            ? `${mietpartei.angenommenerJahresverbrauchKwh.toLocaleString("de-DE")} kWh`
            : undefined
        }
        konditionen={{
          arbeitspreisBrutto: konditionen.arbeitspreisBrutto,
          grundpreisBrutto: konditionen.grundpreisBrutto,
          abschlagBrutto: konditionen.abschlagBrutto,
        }}
        vergleich={vergleich}
        kontaktTelefon={firma.kontaktTelefon}
        abschnitte={abschnitte}
      />,
    );
  }

  if (dok === "vertrag-eigenstaendig" || dok === "vertrag-ergaenzung") {
    // Beide Vertraege werden immer aus der jeweils aktuell gueltigen Version der
    // Vertragsart erzeugt (keine Vertragsart-Auswahl mehr an der Mietpartei).
    const art: VertragArt = dok === "vertrag-ergaenzung" ? "ERGAENZUNG" : "EIGENSTAENDIG";
    const version = await aktiveVertragVersion(art);
    if (!version) {
      throw new Error(
        "Keine aktive Vertragsversion vorhanden. Bitte im Admin unter Einstellungen die Vertragstexte einlesen (Sync).",
      );
    }
    const variant: VertragVariant = art === "ERGAENZUNG" ? "ergaenzung" : "eigenstaendig";

    // Anschrift der Mietpartei (Postanschrift, faellt auf die Objektadresse
    // zurueck, wenn an der Mietpartei nichts hinterlegt ist) - NICHT die reine
    // Objektadresse: die im Kasten genannte Strombezieher-/Mieter-Anschrift ist
    // die der Vertragspartei.
    const strombezieher: ContractParty = {
      rolle: variant === "ergaenzung" ? "Mieter" : "Strombezieher",
      name: displayName,
      zeilen: [empfaenger.strasse || "", empfaenger.plzOrt || ""].filter(Boolean),
    };
    // Gegenpartei der Ergaenzung: standardmaessig die Vermieter:in; unterschreibt
    // laut Objekt-Einstellung die Hausverwaltung, tritt diese als Gegenpartei auf.
    const unterzeichnerHausverwaltung =
      objekt.ergaenzungUnterzeichner === "HAUSVERWALTUNG" && Boolean(objekt.hausverwaltungName?.trim());
    const ergaenzungGegenpartei: ContractParty = unterzeichnerHausverwaltung
      ? {
          rolle: "Hausverwaltung",
          name: objekt.hausverwaltungName || "—",
          zeilen: [
            objekt.hausverwaltungAnschrift || "",
            `${objekt.hausverwaltungPlz} ${objekt.hausverwaltungOrt}`.trim(),
          ].filter(Boolean),
        }
      : {
          rolle: "Vermieter",
          name: vermieterAnzeige || "—",
          zeilen: [vermieter.strasse || "", vermieter.plzOrt].filter(Boolean),
        };
    const gegenpartei: ContractParty =
      variant === "ergaenzung"
        ? ergaenzungGegenpartei
        : {
            rolle: "Lieferant",
            name: firma.name,
            zeilen: [
              firma.anschrift,
              `${firma.plz} ${firma.ort}`.trim(),
              firma.kontaktTelefon ? `Tel. ${firma.kontaktTelefon}` : "",
              firma.kontaktEmail ?? "",
            ],
          };
    const gegenparteiOrt = unterzeichnerHausverwaltung ? objekt.hausverwaltungOrt : vermieter.ort;

    return renderToBuffer(
      <ContractDocument
        variant={variant}
        firma={firma}
        logoPfad={logoAbsolutePath}
        bearbeiterName={bearbeiterName}
        kundennummer={kundennummer}
        titel={version.titel}
        versionLabel={`Version ${version.version}`}
        inhaltMd={version.inhaltMd}
        strombezieher={strombezieher}
        gegenpartei={gegenpartei}
        verbrauchsstelle={{
          strasse: objekt.adresse || null,
          plzOrt: `${objekt.plz} ${objekt.ort}`.trim() || null,
          einheit: mietpartei.einheit.bezeichnung,
          // Namen der zugeordneten Geräte (Zähler) - nur ADDIEREN-Zuordnungen
          // sind der eigentliche Bezugszähler der Einheit.
          zaehler:
            mietpartei.einheit.geraetZuordnungen
              .filter((z) => z.modus === "ADDIEREN")
              .map((z) => z.shellyGeraet.bezeichnung)
              .join(", ") || null,
          // Zaehlernummer des oeffentlichen Zaehlers (Uebergabe zum Netz), optional.
          oeffentlicherZaehler: objekt.oeffentlicherZaehler || null,
        }}
        beginn={mietpartei.einzugsdatum}
        konditionen={{
          grundpreisNetto: konditionen.grundpreisNetto,
          grundpreisBrutto: konditionen.grundpreisBrutto,
          arbeitspreisNetto: konditionen.arbeitspreisNetto,
          arbeitspreisBrutto: konditionen.arbeitspreisBrutto,
          abschlagBrutto: konditionen.abschlagBrutto,
        }}
        strombezieherOrt={mietpartei.anschriftOrt?.trim() || objekt.ort || ""}
        gegenparteiOrt={(variant === "ergaenzung" ? gegenparteiOrt : firma.ort) || ""}
      />,
    );
  }

  const abschnitte = await ladeBriefAbschnitte("sepa");
  return renderToBuffer(
    <SepaMandateDocument
      firma={firma}
      logoPfad={logoAbsolutePath}
      empfaenger={empfaenger}
      bearbeiterName={bearbeiterName}
      kundennummer={kundennummer}
      zahlungspflichtiger={displayName}
      kontoinhaber={mietpartei.kontoinhaber}
      iban={mietpartei.iban}
      bankName={mietpartei.bankName}
      bic={mietpartei.bicOderBlz}
      glaeubigerId={glaeubigerId}
      mandatsreferenz={mandatsreferenz(kundennummer)}
      abschnitte={abschnitte}
    />,
  );
}
