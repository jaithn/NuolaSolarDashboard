"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendTestMail } from "@/lib/mail/mailer";
import { starteEmailVerifizierung } from "@/lib/auth/emailVerification";
import { syncDokumenteVorlagen } from "@/lib/dokumenteSync";

export interface SettingsFormState {
  error?: string;
  success?: string;
}

/** Liest die Vertrags-/Brieftexte aus dem "Dokumente"-Ordner neu in die DB ein. */
export async function syncVertragstexteAction(
  _prevState: SettingsFormState,
  _formData: FormData,
): Promise<SettingsFormState> {
  await requireAdmin();
  try {
    const r = await syncDokumenteVorlagen();
    revalidatePath("/admin/einstellungen");
    const hinweis = r.warnungen.length > 0 ? ` Hinweise: ${r.warnungen.join(" ")}` : "";
    return {
      success: `Übernommen: ${r.vertragsversionen} Vertragsversion(en), ${r.briefvorlagen} Briefvorlage(n).${hinweis}`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Sync fehlgeschlagen." };
  }
}

export interface TestMailState {
  error?: string;
  success?: string;
}

export async function sendTestMailAction(
  _prevState: TestMailState,
  formData: FormData,
): Promise<TestMailState> {
  await requireAdmin();

  const to = String(formData.get("to") ?? "").trim();
  if (!z.string().email().max(254).safeParse(to).success) {
    return { error: "Bitte eine gültige E-Mail-Adresse angeben." };
  }

  const result = await sendTestMail(to);
  if (!result.ok) {
    return { error: `SMTP-Fehler: ${result.error}` };
  }
  return { success: `Test-E-Mail wurde an ${to} verschickt. Bitte auch den Spam-Ordner prüfen.` };
}

export async function updateFirmenStammdatenAction(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const anschrift = String(formData.get("anschrift") ?? "").trim();
  const plz = String(formData.get("plz") ?? "").trim();
  const ort = String(formData.get("ort") ?? "").trim();
  const steuernummer = String(formData.get("steuernummer") ?? "").trim();
  const ustIdNr = String(formData.get("ustIdNr") ?? "").trim();
  const bankname = String(formData.get("bankname") ?? "").trim();
  const bankverbindung = String(formData.get("bankverbindung") ?? "").trim();
  const webseite = String(formData.get("webseite") ?? "").trim();
  const kontaktTelefon = String(formData.get("kontaktTelefon") ?? "").trim();
  const kontaktEmail = String(formData.get("kontaktEmail") ?? "").trim();
  const shellyFehlerEmail = String(formData.get("shellyFehlerEmail") ?? "").trim();

  if (!name || !anschrift) return { error: "Bitte Name und Anschrift angeben." };
  if (shellyFehlerEmail && !z.string().email().max(254).safeParse(shellyFehlerEmail).success) {
    return { error: "Die Fehler-Benachrichtigungs-E-Mail ist ungültig." };
  }
  if (kontaktEmail && !z.string().email().max(254).safeParse(kontaktEmail).success) {
    return { error: "Die Kontakt-E-Mail ist ungültig." };
  }

  const bisher = await prisma.firmenStammdaten.findUnique({ where: { id: "singleton" } });

  const data = {
    name,
    anschrift,
    plz,
    ort,
    steuernummer: steuernummer || null,
    ustIdNr: ustIdNr || null,
    bankname: bankname || null,
    bankverbindung: bankverbindung || null,
    webseite: webseite || null,
    kontaktTelefon: kontaktTelefon || null,
    shellyFehlerEmail: shellyFehlerEmail || null,
  };
  await prisma.firmenStammdaten.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });

  // Kontakt-E-Mail: Änderung muss per Link bestätigt werden (die bestätigte
  // Adresse wird erst beim Klick auf den Bestätigungslink übernommen).
  let hinweis = "Gespeichert.";
  if (kontaktEmail && kontaktEmail !== (bisher?.kontaktEmail ?? "")) {
    const res = await starteEmailVerifizierung({ zweck: "FIRMA_KONTAKT_EMAIL", refId: "singleton", neueEmail: kontaktEmail });
    if (!res.ok) {
      // Wichtig: Die uebrigen Stammdaten wurden gespeichert, die neue
      // Kontakt-E-Mail aber NICHT uebernommen (sie wird erst nach Bestaetigung
      // aktiv, und die Bestaetigungs-E-Mail konnte nicht versendet werden).
      return {
        error:
          `Die übrigen Stammdaten wurden gespeichert, aber die neue Kontakt-E-Mail „${kontaktEmail}" wurde NICHT übernommen: ` +
          `Die dafür nötige Bestätigungs-E-Mail konnte nicht versendet werden (${res.error}). ` +
          `Bitte die SMTP-Einstellungen prüfen und die E-Mail-Adresse anschließend erneut speichern.`,
      };
    }
    await prisma.firmenStammdaten.update({ where: { id: "singleton" }, data: { kontaktEmailPending: kontaktEmail } });
    hinweis = `Gespeichert. Eine Bestätigungs-E-Mail wurde an ${kontaktEmail} gesendet – die Kontakt-E-Mail wird nach Bestätigung übernommen.`;
  } else if (!kontaktEmail && bisher?.kontaktEmail) {
    // Kontakt-E-Mail geleert: Adresse und Verifizierung zuruecksetzen.
    await prisma.firmenStammdaten.update({
      where: { id: "singleton" },
      data: { kontaktEmail: null, kontaktEmailVerifiziert: false, kontaktEmailPending: null },
    });
  }

  revalidatePath("/admin/einstellungen");
  return { success: hinweis };
}

// Hinweis: Das Hochladen von Logo/Farben wurde entfernt - Marke (Logo/Farben)
// ist fest ins System eingebaut (Style Guide). Das Modell RechnungsDesignvorlage
// bleibt (nicht-destruktiv) bestehen; die PDFs fallen auf das mitgelieferte
// Nuola-Solar-Logo und die Style-Guide-Farben zurück.
