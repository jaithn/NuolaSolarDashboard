import { prisma } from "@/lib/db";
import { hashPassword, generateOneTimePassword } from "./password";
import { sendMail } from "@/lib/mail/mailer";
import { onboardingEmailHtml } from "@/lib/mail/templates";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Umgebungsvariable ${name} ist nicht gesetzt.`);
  }
  return value;
}

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

function slugify(input: string): string {
  const cleaned = input
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 40);
  return cleaned || "mieter";
}

async function ensureUniqueUsername(base: string): Promise<string> {
  let candidate = base;
  let suffix = 1;
  // Anzahl Mietparteien ist klein (Mieterzahl der Nuola-Objekte) - eine simple
  // sequenzielle Suche nach einem freien Benutzernamen ist hier voellig ausreichend.
  while (await prisma.nutzer.findUnique({ where: { username: candidate } })) {
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
  return candidate;
}

/**
 * Legt für eine bestehende Mietpartei einen Dashboard-Zugang an: generiert
 * Benutzername + Einmal-Passwort, speichert den Nutzer und verschickt die
 * Zugangsdaten per E-Mail. Wird ausschließlich vom Admin-Bereich ausgelöst.
 */
export async function createZugangForMietpartei(
  mietparteiId: string,
): Promise<{ username: string; password: string }> {
  const mietpartei = await prisma.mietpartei.findUniqueOrThrow({ where: { id: mietparteiId } });

  const existing = await prisma.nutzer.findUnique({ where: { mietparteiId } });
  if (existing) {
    throw new Error("Für diese Mietpartei existiert bereits ein Zugang.");
  }

  const username = await ensureUniqueUsername(slugify(mietpartei.name));
  const oneTimePassword = generateOneTimePassword();
  const passwordHash = await hashPassword(oneTimePassword);

  await prisma.nutzer.create({
    data: {
      username,
      passwordHash,
      role: "MIETER",
      mustChangePassword: true,
      mietparteiId,
    },
  });

  const loginUrl = `${requireEnv("APP_BASE_URL")}/login`;
  await sendMail({
    to: mietpartei.email,
    subject: "Ihr Zugang zum Nuola Energy Dashboard",
    html: onboardingEmailHtml({ username, password: oneTimePassword, loginUrl }),
  });

  // Klartext-Passwort wird zurueckgegeben, damit der Admin es einmalig anzeigen
  // und in den Willkommensbrief uebernehmen kann. Es wird nirgends gespeichert.
  return { username, password: oneTimePassword };
}
