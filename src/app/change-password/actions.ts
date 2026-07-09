"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/getSession";

export interface ChangePasswordState {
  error?: string;
}

const MIN_PASSWORD_LENGTH = 8;

export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const newPasswordRepeat = String(formData.get("newPasswordRepeat") ?? "");

  const session = await getSession();
  if (!session.userId) {
    redirect("/login");
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { error: `Das neue Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.` };
  }
  if (newPassword !== newPasswordRepeat) {
    return { error: "Die neuen Passwörter stimmen nicht überein." };
  }

  const nutzer = await prisma.nutzer.findUniqueOrThrow({ where: { id: session.userId } });
  const currentOk = await verifyPassword(currentPassword, nutzer.passwordHash);
  if (!currentOk) {
    return { error: "Das aktuelle Passwort ist falsch." };
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.nutzer.update({
    where: { id: nutzer.id },
    data: { passwordHash, mustChangePassword: false },
  });

  session.mustChangePassword = false;
  await session.save();

  redirect(nutzer.role === "ADMIN" ? "/admin" : "/dashboard");
}
