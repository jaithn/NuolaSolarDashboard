"use server";

import { getSession } from "@/lib/auth/getSession";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { starteEmailVerifizierung } from "@/lib/auth/emailVerification";

export interface ProfilFormState {
  error?: string;
  success?: string;
}

export async function updateProfilAction(
  _prevState: ProfilFormState,
  formData: FormData,
): Promise<ProfilFormState> {
  const session = await getSession();
  if (!session.userId || session.role !== "MIETER") redirect("/login");

  const nutzer = await prisma.nutzer.findUniqueOrThrow({
    where: { id: session.userId },
    include: { mietpartei: true },
  });
  const mietpartei = nutzer.mietpartei;
  if (!mietpartei) redirect("/access-revoked");

  const telefon = String(formData.get("telefon") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  // Telefonnummer wird sofort übernommen.
  await prisma.mietpartei.update({ where: { id: mietpartei.id }, data: { telefon: telefon || null } });

  // E-Mail-Änderung nur nach Bestätigung per Link: die neue Adresse wird in
  // emailPending vorgemerkt und erst beim Klick auf den Bestätigungslink aktiv.
  let emailHinweis = "";
  if (email && email !== mietpartei.email) {
    if (!z.string().email().max(254).safeParse(email).success) {
      return { error: "Die E-Mail-Adresse ist ungültig." };
    }
    const res = await starteEmailVerifizierung({ zweck: "MIETER_EMAIL", refId: mietpartei.id, neueEmail: email });
    if (!res.ok) {
      return { error: `Telefon gespeichert, aber die Bestätigungs-E-Mail konnte nicht versendet werden (${res.error}).` };
    }
    await prisma.mietpartei.update({ where: { id: mietpartei.id }, data: { emailPending: email } });
    emailHinweis = ` Eine Bestätigungs-E-Mail wurde an ${email} gesendet – die Adresse wird nach Bestätigung übernommen.`;
  }

  revalidatePath("/dashboard/profil");
  return { success: `Profil gespeichert.${emailHinweis}` };
}
