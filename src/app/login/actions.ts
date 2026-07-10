"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/getSession";
import { isMietparteiEffectivelyAktiv } from "@/lib/mietpartei";
import { consumeRateLimit, resetRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/clientIp";

// Brute-Force-Schutz: 5 Versuche pro Benutzername+IP bzw. 30 pro IP in 15 Minuten.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS_PER_USER_IP = 5;
const MAX_ATTEMPTS_PER_IP = 30;

// Dummy-Hash (bcrypt, Kostenfaktor 12, zufaelliges Passwort): sorgt dafuer,
// dass ein Login-Versuch mit unbekanntem Benutzernamen etwa gleich lange
// dauert wie mit bekanntem - erschwert User-Enumeration ueber Timing.
const DUMMY_HASH = "$2a$12$K7uPYVJk9y6oQmYQ0lC1uOSqSJm2bqMBXYbMPHNblYqOG3mZ0y1hK";

export interface LoginState {
  error?: string;
}

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Bitte Benutzername und Passwort eingeben." };
  }

  const ip = await getClientIp();
  const userIpKey = `login:${ip}:${username.toLowerCase()}`;
  if (
    !consumeRateLimit(`login:${ip}`, MAX_ATTEMPTS_PER_IP, LOGIN_WINDOW_MS) ||
    !consumeRateLimit(userIpKey, MAX_ATTEMPTS_PER_USER_IP, LOGIN_WINDOW_MS)
  ) {
    return { error: "Zu viele Anmeldeversuche. Bitte warten Sie 15 Minuten und versuchen Sie es erneut." };
  }

  const nutzer = await prisma.nutzer.findUnique({
    where: { username },
    include: { mietpartei: true },
  });

  if (!nutzer) {
    await verifyPassword(password, DUMMY_HASH);
    return { error: "Benutzername oder Passwort ist falsch." };
  }

  const passwordOk = await verifyPassword(password, nutzer.passwordHash);
  if (!passwordOk) {
    return { error: "Benutzername oder Passwort ist falsch." };
  }

  resetRateLimit(userIpKey);

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
