"use server";

import { redirect } from "next/navigation";
import { bestaetigeEmail } from "@/lib/auth/emailVerification";

// Bestätigung bewusst über einen Button (POST), nicht automatisch beim Öffnen
// des Links (GET): so lösen E-Mail-Scanner/Link-Vorschauen die Bestätigung
// nicht versehentlich aus.
export async function bestaetigeEmailAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const res = await bestaetigeEmail(token);
  redirect(`/e-mail-bestaetigen/${encodeURIComponent(token)}?status=${res.ok ? "ok" : "fehler"}`);
}
