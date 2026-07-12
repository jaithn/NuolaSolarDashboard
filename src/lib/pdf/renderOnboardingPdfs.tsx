import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { berechneBrutto } from "@/lib/steuer";
import { mietparteiAnzeigeName, anredeSatz, anredeKurz } from "@/lib/mietpartei";
import type { FirmaBriefData, EmpfaengerData } from "./letterLayout";
import { OnboardingLetterDocument, type OnboardingVergleich } from "./onboardingLetterDocument";
import { ContractDocument } from "./contractDocument";
import { SepaMandateDocument } from "./sepaMandateDocument";

export type OnboardingDokumentTyp = "anschreiben" | "vertrag" | "sepa";

export const ONBOARDING_DOKUMENT_TITEL: Record<OnboardingDokumentTyp, string> = {
  anschreiben: "Anschreiben",
  vertrag: "Stromliefervertrag",
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
      einheit: { include: { objekt: true } },
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
  const empfaenger: EmpfaengerData = {
    anredeKurz: anredeKurz(mietpartei.anrede),
    name: displayName,
    strasse: objekt.adresse || null,
    plzOrt: `${objekt.plz} ${objekt.ort}`.trim() || null,
  };

  return {
    mietpartei,
    firma,
    logoAbsolutePath,
    displayName,
    empfaenger,
    objekt,
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
  const { firma, logoAbsolutePath, empfaenger, mietpartei, konditionen, objekt, displayName } = basis;

  if (dok === "anschreiben") {
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
        anredeSatz={anredeSatz(mietpartei)}
        beginn={mietpartei.einzugsdatum}
        konditionen={{
          arbeitspreisBrutto: konditionen.arbeitspreisBrutto,
          grundpreisBrutto: konditionen.grundpreisBrutto,
          abschlagBrutto: konditionen.abschlagBrutto,
        }}
        vergleich={vergleich}
        kontaktTelefon={firma.kontaktTelefon}
      />,
    );
  }

  if (dok === "vertrag") {
    return renderToBuffer(
      <ContractDocument
        firma={firma}
        logoPfad={logoAbsolutePath}
        strombezieher={{ name: displayName, zusatz: null }}
        verbrauchsstelle={{
          strasse: objekt.adresse || null,
          plzOrt: `${objekt.plz} ${objekt.ort}`.trim() || null,
          einheit: mietpartei.einheit.bezeichnung,
        }}
        beginn={mietpartei.einzugsdatum}
        konditionen={{
          grundpreisNetto: konditionen.grundpreisNetto,
          grundpreisBrutto: konditionen.grundpreisBrutto,
          arbeitspreisNetto: konditionen.arbeitspreisNetto,
          arbeitspreisBrutto: konditionen.arbeitspreisBrutto,
          abschlagBrutto: konditionen.abschlagBrutto,
        }}
        unterschriftsort={objekt.ort || ""}
      />,
    );
  }

  return renderToBuffer(
    <SepaMandateDocument
      firma={firma}
      logoPfad={logoAbsolutePath}
      empfaenger={empfaenger}
      zahlungspflichtiger={displayName}
    />,
  );
}
