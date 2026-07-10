"use server";

import { prisma } from "@/lib/db";
import { createPasswordResetToken } from "@/lib/auth/resetToken";
import { sendMail } from "@/lib/mail/mailer";
import { passwordResetEmailHtml } from "@/lib/mail/templates";
import { consumeRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/clientIp";

export interface RequestResetState {
  submitted?: boolean;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Umgebungsvariable ${name} ist nicht gesetzt.`);
  return value;
}

export async function requestPasswordResetAction(
  _prevState: RequestResetState,
  formData: FormData,
): Promise<RequestResetState> {
  const username = String(formData.get("username") ?? "").trim();

  // Schutz vor E-Mail-Bombing/Token-Flut: max. 5 Anfragen pro IP und
  // 3 pro Benutzername innerhalb einer Stunde. Antwort bleibt in jedem Fall
  // identisch (keine User-Enumeration).
  const ip = await getClientIp();
  const withinLimit =
    consumeRateLimit(`reset-req:${ip}`, 5, 60 * 60 * 1000) &&
    (!username || consumeRateLimit(`reset-req:user:${username.toLowerCase()}`, 3, 60 * 60 * 1000));

  if (username && withinLimit) {
    const nutzer = await prisma.nutzer.findUnique({ where: { username }, include: { mietpartei: true } });
    // Bewusst keine Unterscheidung nach aussen, ob der Benutzername existiert
    // (verhindert User-Enumeration) - E-Mail wird nur bei Treffer verschickt.
    if (nutzer) {
      const email = nutzer.mietpartei?.email;
      if (email) {
        const token = await createPasswordResetToken(nutzer.id);
        const resetUrl = `${requireEnv("APP_BASE_URL")}/reset-password/${token}`;
        await sendMail({
          to: email,
          subject: "Passwort zurücksetzen – Nuola Energy Dashboard",
          html: passwordResetEmailHtml({ resetUrl }),
        });
      }
    }
  }

  return { submitted: true };
}
