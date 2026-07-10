import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import type { PasswordResetToken } from "@prisma/client";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 Stunde

// In der DB wird nur der SHA-256-Hash des Tokens gespeichert: selbst bei
// Lesezugriff auf die Datenbank (Backup, SQL-Injection, gestohlene DB-Datei)
// lassen sich daraus keine gueltigen Reset-Links rekonstruieren. Der
// Klartext-Token existiert ausschliesslich im E-Mail-Link.
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createPasswordResetToken(nutzerId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");

  // Housekeeping: abgelaufene Tokens des Nutzers entfernen.
  await prisma.passwordResetToken.deleteMany({
    where: { nutzerId, expiresAt: { lt: new Date() } },
  });

  await prisma.passwordResetToken.create({
    data: {
      nutzerId,
      token: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });
  return token;
}

/** Gibt den Token-Datensatz zurück, wenn er existiert, noch nicht verwendet und nicht abgelaufen ist. */
export async function findValidPasswordResetToken(token: string): Promise<PasswordResetToken | null> {
  const record = await prisma.passwordResetToken.findUnique({ where: { token: hashToken(token) } });
  if (!record) return null;
  if (record.usedAt) return null;
  if (record.expiresAt.getTime() < Date.now()) return null;
  return record;
}

export async function markPasswordResetTokenUsed(id: string): Promise<void> {
  await prisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } });
}

/**
 * Invalidiert alle noch offenen Reset-Tokens eines Nutzers - wird nach einem
 * erfolgreichen Passwort-Reset aufgerufen, damit aeltere, parallel
 * angeforderte Links nicht mehr verwendbar sind.
 */
export async function invalidateAllPasswordResetTokens(nutzerId: string): Promise<void> {
  await prisma.passwordResetToken.updateMany({
    where: { nutzerId, usedAt: null },
    data: { usedAt: new Date() },
  });
}
