import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { berechneBrutto } from "@/lib/steuer";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { mietparteiAnzeigeName, anredeSatz, anredeKurz } from "@/lib/mietpartei";
import { WelcomeLetterDocument } from "./welcomeLetterDocument";
import type { FirmaBriefData } from "./letterLayout";

/**
 * Rendert den Willkommensbrief (PDF) fuer eine Mietpartei mit den frisch
 * erzeugten Zugangsdaten. Das Passwort wird bewusst NICHT gespeichert, sondern
 * nur als Parameter durchgereicht (existiert im Klartext ausschliesslich
 * transient beim Anlegen des Zugangs).
 */
export async function renderWelcomeLetterPdf(params: {
  mietparteiId: string;
  benutzername: string;
  passwort: string;
}): Promise<Buffer> {
  const mietpartei = await prisma.mietpartei.findUniqueOrThrow({
    where: { id: params.mietparteiId },
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
    prisma.rechnungsDesignvorlage.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    }),
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
  const anrede = anredeSatz(mietpartei);

  const loginUrl = `${await getAppBaseUrl()}/login`;

  return renderToBuffer(
    <WelcomeLetterDocument
      firma={firma}
      logoPfad={logoAbsolutePath}
      empfaenger={{
        anredeKurz: anredeKurz(mietpartei.anrede),
        name: displayName,
        strasse: objekt.adresse || null,
        plzOrt: `${objekt.plz} ${objekt.ort}`.trim() || null,
      }}
      anredeSatz={anrede}
      mietpartei={{ einzugsdatum: mietpartei.einzugsdatum }}
      konditionen={{ arbeitspreisBrutto, grundpreisBrutto, abschlagBrutto }}
      zugang={{ loginUrl, benutzername: params.benutzername, passwort: params.passwort }}
    />,
  );
}
