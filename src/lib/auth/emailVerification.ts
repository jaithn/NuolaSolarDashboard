import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mail/mailer";
import { getAppBaseUrl } from "@/lib/appBaseUrl";

// Zweck der Verifizierung: bestimmt, wohin die bestaetigte Adresse geschrieben
// wird. Bewusst als String-Literal (Schema-Feld ist String), damit weitere
// Zwecke ohne Migration ergaenzt werden koennen.
export type EmailVerifizierungZweck = "MIETER_EMAIL" | "FIRMA_KONTAKT_EMAIL";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 Stunden

// Nur der SHA-256-Hash wird gespeichert (analog PasswordResetToken): aus der DB
// allein laesst sich kein gueltiger Bestaetigungslink rekonstruieren.
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function bestaetigenMailHtml(link: string): string {
  return `<div style="font-family:'IBM Plex Sans',system-ui,sans-serif;color:#1c1c21;">
    <h2 style="color:#a2762b;">E-Mail-Adresse bestätigen</h2>
    <p>Bitte bestätigen Sie diese E-Mail-Adresse für das Nuola Energy Dashboard, indem Sie auf den
    folgenden Link klicken:</p>
    <p><a href="${link}" style="color:#a2762b;">${link}</a></p>
    <p style="color:#64748b;font-size:0.85rem;">Der Link ist 24 Stunden gültig. Falls Sie diese Änderung
    nicht veranlasst haben, können Sie diese E-Mail ignorieren.</p>
  </div>`;
}

/**
 * Erstellt einen Bestätigungs-Token und verschickt den Bestätigungslink an die
 * NEUE Adresse. Schlägt der Mailversand fehl, wird der Token wieder entfernt
 * und ein Fehler zurückgegeben (damit keine „ausstehende Bestätigung" ohne
 * zugestellte Mail zurückbleibt).
 */
export async function starteEmailVerifizierung(params: {
  zweck: EmailVerifizierungZweck;
  refId: string;
  neueEmail: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = crypto.randomBytes(32).toString("base64url");

  // Housekeeping: abgelaufene/alte offene Tokens desselben Zwecks fuer diese
  // refId entfernen, damit nur der neueste Link gilt.
  await prisma.emailVerifizierung.deleteMany({
    where: { zweck: params.zweck, refId: params.refId, bestaetigtAm: null },
  });

  const record = await prisma.emailVerifizierung.create({
    data: {
      tokenHash: hashToken(token),
      zweck: params.zweck,
      refId: params.refId,
      neueEmail: params.neueEmail,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const link = `${await getAppBaseUrl()}/e-mail-bestaetigen/${token}`;
  try {
    await sendMail({
      to: params.neueEmail,
      subject: "E-Mail-Adresse bestätigen – Nuola Energy Dashboard",
      html: bestaetigenMailHtml(link),
    });
    return { ok: true };
  } catch (err) {
    await prisma.emailVerifizierung.delete({ where: { id: record.id } }).catch(() => {});
    return { ok: false, error: err instanceof Error ? err.message : "E-Mail konnte nicht versendet werden." };
  }
}

/**
 * Bestätigt einen Token: übernimmt die neue Adresse an das jeweilige Ziel und
 * markiert den Token als bestätigt. Gibt bei Erfolg den Zweck zurück, sonst
 * null (unbekannt/abgelaufen/bereits verwendet).
 */
export async function bestaetigeEmail(
  rawToken: string,
): Promise<{ ok: true; zweck: EmailVerifizierungZweck; email: string } | { ok: false }> {
  const record = await prisma.emailVerifizierung.findUnique({ where: { tokenHash: hashToken(rawToken) } });
  if (!record || record.bestaetigtAm || record.expiresAt.getTime() < Date.now()) {
    return { ok: false };
  }

  await prisma.$transaction(async (tx) => {
    if (record.zweck === "MIETER_EMAIL") {
      await tx.mietpartei.update({
        where: { id: record.refId },
        data: { email: record.neueEmail, emailVerifiziert: true, emailPending: null },
      });
    } else if (record.zweck === "FIRMA_KONTAKT_EMAIL") {
      await tx.firmenStammdaten.update({
        where: { id: record.refId },
        data: { kontaktEmail: record.neueEmail, kontaktEmailVerifiziert: true, kontaktEmailPending: null },
      });
    }
    await tx.emailVerifizierung.update({ where: { id: record.id }, data: { bestaetigtAm: new Date() } });
  });

  return { ok: true, zweck: record.zweck as EmailVerifizierungZweck, email: record.neueEmail };
}
