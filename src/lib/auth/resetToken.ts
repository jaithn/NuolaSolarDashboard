import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import type { PasswordResetToken } from "@prisma/client";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 Stunde

export async function createPasswordResetToken(nutzerId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.create({
    data: {
      nutzerId,
      token,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });
  return token;
}

/** Gibt den Token-Datensatz zurück, wenn er existiert, noch nicht verwendet und nicht abgelaufen ist. */
export async function findValidPasswordResetToken(token: string): Promise<PasswordResetToken | null> {
  const record = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!record) return null;
  if (record.usedAt) return null;
  if (record.expiresAt.getTime() < Date.now()) return null;
  return record;
}

export async function markPasswordResetTokenUsed(id: string): Promise<void> {
  await prisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } });
}
