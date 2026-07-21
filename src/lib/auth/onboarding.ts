import { prisma } from "@/lib/db";
import { hashPassword, generateOneTimePassword } from "./password";
import { sendMail } from "@/lib/mail/mailer";
import { onboardingEmailHtml } from "@/lib/mail/templates";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { benutzernameBasis } from "@/lib/mietpartei";
import { renderWelcomeLetterPdf } from "@/lib/pdf/renderWelcomeLetter";
import { invalidateAllPasswordResetTokens } from "./resetToken";

export interface ZugangsErgebnis {
  username: string;
  password: string;
  emailOk: boolean;
  emailFehler?: string;
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
 * Legt einen Dashboard-Zugang an ("erstellen") oder setzt einen bestehenden
 * zurueck ("zuruecksetzen"): erzeugt ein neues Einmal-Passwort, speichert nur
 * den Hash und versucht, die Zugangsdaten per E-Mail zu verschicken.
 *
 * WICHTIG (Robustheit): Der E-Mail-Versand ist bewusst NICHT fatal. Faellt er
 * aus (z.B. SMTP-Problem), wird das Passwort trotzdem zurueckgegeben - der
 * Admin kann es auf der Seite ablesen und ueber den Willkommensbrief zustellen.
 * So entsteht nie ein "halber" Zustand (Zugang angelegt, aber Passwort nie
 * gesehen), wie er zuvor bei einem Fehler auftreten konnte.
 */
export async function erstelleOderResetZugang(
  mietparteiId: string,
  modus: "erstellen" | "zuruecksetzen",
): Promise<ZugangsErgebnis> {
  const mietpartei = await prisma.mietpartei.findUniqueOrThrow({ where: { id: mietparteiId } });
  const existing = await prisma.nutzer.findUnique({ where: { mietparteiId } });

  if (modus === "erstellen" && existing) {
    throw new Error("Für diese Mietpartei existiert bereits ein Zugang.");
  }
  if (modus === "zuruecksetzen" && !existing) {
    throw new Error("Für diese Mietpartei existiert noch kein Zugang.");
  }

  const oneTimePassword = generateOneTimePassword();
  const passwordHash = await hashPassword(oneTimePassword);

  let username: string;
  if (existing) {
    username = existing.username;
    await prisma.nutzer.update({
      where: { id: existing.id },
      data: { passwordHash, mustChangePassword: true },
    });
    // Offene Passwort-Reset-Links entwerten - sie gehoeren zum alten Passwort.
    await invalidateAllPasswordResetTokens(existing.id);
  } else {
    username = await ensureUniqueUsername(benutzernameBasis(mietpartei));
    await prisma.nutzer.create({
      data: { username, passwordHash, role: "MIETER", mustChangePassword: true, mietparteiId },
    });
  }

  let emailOk = true;
  let emailFehler: string | undefined;
  try {
    const loginUrl = `${await getAppBaseUrl()}/login`;
    // Willkommensbrief als PDF beilegen: enthaelt Zugangsdaten, Konditionen und
    // Anleitung. Das Klartext-Passwort existiert nur hier transient.
    const willkommenPdf = await renderWelcomeLetterPdf({
      mietparteiId,
      benutzername: username,
      passwort: oneTimePassword,
    });
    await sendMail({
      to: mietpartei.email,
      subject: "Ihr Zugang zum Nuola Energy Dashboard",
      html: onboardingEmailHtml({ username, password: oneTimePassword, loginUrl }),
      attachments: [
        { filename: "Willkommensbrief.pdf", content: willkommenPdf, contentType: "application/pdf" },
      ],
    });
  } catch (err) {
    emailOk = false;
    emailFehler = err instanceof Error ? err.message : "Unbekannter Fehler beim E-Mail-Versand.";
  }

  // Klartext-Passwort wird zurueckgegeben (Anzeige + Willkommensbrief), aber
  // nirgends gespeichert.
  return { username, password: oneTimePassword, emailOk, emailFehler };
}
