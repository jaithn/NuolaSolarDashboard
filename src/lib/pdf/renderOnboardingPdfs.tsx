import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { berechneBrutto } from "@/lib/steuer";
import { mietparteiAnzeigeName, anredeSatz, anredeKurz, mietparteiPostanschrift } from "@/lib/mietpartei";
import { versionFuerMietpartei } from "@/lib/vertrag";
import { ladeBriefAbschnitte } from "@/lib/briefVorlagen";
import { mandatsreferenz } from "@/lib/sepa";
import { fmtDate } from "./format";
import type { FirmaBriefData, EmpfaengerData } from "./letterLayout";
import { OnboardingLetterDocument, type OnboardingVergleich } from "./onboardingLetterDocument";
import { ContractDocument, type ContractParty, type VertragVariant } from "./contractDocument";
import { SepaMandateDocument } from "./sepaMandateDocument";

export type OnboardingDokumentTyp = "anschreiben" | "vertrag" | "sepa";

export const ONBOARDING_DOKUMENT_TITEL: Record<OnboardingDokumentTyp, string> = {
  anschreiben: "Anschreiben",
  vertrag: "Vertrag",
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
  const abschlagBrutto = aktuellerAbschlag
    ? berechneBrutto(aktuellerAbschlag.nettoBetrag, aktuellerAbschlag.steuersatz.prozentsatz).bruttoBetrag
    : null;

  const objekt = mietpartei.einheit.objekt;
  const displayName = mietparteiAnzeigeName(mietpartei);
  const post = mietparteiPostanschrift(mietpartei, objekt);
  const empfaenger: EmpfaengerData = {
    anredeKurz: anredeKurz(mietpartei.anrede),
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

  if (dok === "anschreiben") {
    const abschnitte = await ladeBriefAbschnitte("anschreiben");
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
        beginn={mietpartei.einzugsdatum}
        lieferterminText={objekt.geplanterLiefertermin ? fmtDate(objekt.geplanterLiefertermin) : ""}
        vermieterText={
          (objekt.vermieterModus === "PRO_EINHEIT"
            ? mietpartei.einheit.vermieterName
            : objekt.vermieterName) || undefined
        }
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

  if (dok === "vertrag") {
    const version = await versionFuerMietpartei(mietpartei);
    if (!version) {
      throw new Error(
        "Keine Vertragsversion vorhanden. Bitte im Admin unter Einstellungen die Vertragstexte einlesen (Sync).",
      );
    }
    const variant: VertragVariant = version.art === "ERGAENZUNG" ? "ergaenzung" : "eigenstaendig";

    const strombezieher: ContractParty = {
      rolle: variant === "ergaenzung" ? "Mieter" : "Strombezieher",
      name: displayName,
      zeilen: [objekt.adresse || "", `${objekt.plz} ${objekt.ort}`.trim()],
    };
    // Vermieter: bei PRO_EINHEIT aus der Wohneinheit, sonst objektweit.
    // Anschrift strukturiert: Strasse (vermieterAnschrift) + "PLZ Ort".
    const vermieter =
      objekt.vermieterModus === "PRO_EINHEIT"
        ? {
            name: mietpartei.einheit.vermieterName,
            strasse: mietpartei.einheit.vermieterAnschrift,
            plzOrt: `${mietpartei.einheit.vermieterPlz} ${mietpartei.einheit.vermieterOrt}`.trim(),
          }
        : {
            name: objekt.vermieterName,
            strasse: objekt.vermieterAnschrift,
            plzOrt: `${objekt.vermieterPlz} ${objekt.vermieterOrt}`.trim(),
          };
    const gegenpartei: ContractParty =
      variant === "ergaenzung"
        ? {
            rolle: "Vermieter",
            name: vermieter.name || "—",
            zeilen: [vermieter.strasse || "", vermieter.plzOrt].filter(Boolean),
          }
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
        }}
        beginn={mietpartei.einzugsdatum}
        konditionen={{
          grundpreisNetto: konditionen.grundpreisNetto,
          grundpreisBrutto: konditionen.grundpreisBrutto,
          arbeitspreisNetto: konditionen.arbeitspreisNetto,
          arbeitspreisBrutto: konditionen.arbeitspreisBrutto,
          abschlagBrutto: konditionen.abschlagBrutto,
        }}
        unterschriftsort={firma.ort || ""}
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
      glaeubigerId={glaeubigerId}
      mandatsreferenz={mandatsreferenz(kundennummer)}
      abschnitte={abschnitte}
    />,
  );
}
