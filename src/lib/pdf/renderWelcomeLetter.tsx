import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { berechneBrutto } from "@/lib/steuer";
import { WelcomeLetterDocument } from "./welcomeLetterDocument";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Umgebungsvariable ${name} ist nicht gesetzt.`);
  return value;
}

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

  const [firma, designvorlage] = await Promise.all([
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
  const primaerfarbe = designvorlage.primaerfarbe === "#0f766e" ? "#d9a441" : designvorlage.primaerfarbe;

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
  const anschrift =
    [objekt.adresse, `${objekt.plz} ${objekt.ort}`.trim()].filter((s) => s && s.length > 0).join(", ") || null;

  return renderToBuffer(
    <WelcomeLetterDocument
      firma={{ name: firma.name, anschrift: firma.anschrift, bankverbindung: firma.bankverbindung }}
      design={{ logoPfad: logoAbsolutePath, primaerfarbe }}
      mietpartei={{ name: mietpartei.name, anschrift, einzugsdatum: mietpartei.einzugsdatum }}
      konditionen={{ arbeitspreisBrutto, grundpreisBrutto, abschlagBrutto }}
      zugang={{
        loginUrl: `${requireEnv("APP_BASE_URL")}/login`,
        benutzername: params.benutzername,
        passwort: params.passwort,
      }}
    />,
  );
}
