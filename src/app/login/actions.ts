"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/getSession";
import { isMietparteiEffectivelyAktiv } from "@/lib/mietpartei";

export interface LoginState {
  error?: string;
}

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Bitte Benutzername und Passwort eingeben." };
  }

  const nutzer = await prisma.nutzer.findUnique({
    where: { username },
    include: { mietpartei: true },
  });

  if (!nutzer) {
    return { error: "Benutzername oder Passwort ist falsch." };
  }

  const passwordOk = await verifyPassword(password, nutzer.passwordHash);
  if (!passwordOk) {
    return { error: "Benutzername oder Passwort ist falsch." };
  }

  if (nutzer.role === "MIETER" && (!nutzer.mietpartei || !isMietparteiEffectivelyAktiv(nutzer.mietpartei))) {
    return { error: "Dieser Zugang ist nicht mehr aktiv. Bitte wenden Sie sich an die Verwaltung." };
  }

  const session = await getSession();
  session.userId = nutzer.id;
  session.role = nutzer.role;
  session.mustChangePassword = nutzer.mustChangePassword;
  await session.save();

  redirect(nutzer.mustChangePassword ? "/change-password" : nutzer.role === "ADMIN" ? "/admin" : "/dashboard");
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}
