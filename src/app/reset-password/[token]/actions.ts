"use server";

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { findValidPasswordResetToken, markPasswordResetTokenUsed } from "@/lib/auth/resetToken";

export interface ResetPasswordState {
  error?: string;
  success?: boolean;
}

const MIN_PASSWORD_LENGTH = 8;

export async function resetPasswordAction(
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const token = String(formData.get("token") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const newPasswordRepeat = String(formData.get("newPasswordRepeat") ?? "");

  const record = await findValidPasswordResetToken(token);
  if (!record) {
    return { error: "Dieser Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen an." };
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { error: `Das neue Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.` };
  }
  if (newPassword !== newPasswordRepeat) {
    return { error: "Die neuen Passwörter stimmen nicht überein." };
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.nutzer.update({
    where: { id: record.nutzerId },
    data: { passwordHash, mustChangePassword: false },
  });
  await markPasswordResetTokenUsed(record.id);

  return { success: true };
}
