"use server";

import { getSession } from "@/lib/auth/getSession";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { starteEmailVerifizierung } from "@/lib/auth/emailVerification";
import { normalisiereIban, istGueltigeIban, bankAusIban, formatiereIban } from "@/lib/bank/iban";
import { speichereDokument } from "@/lib/dokumente";
import { sendMail } from "@/lib/mail/mailer";
import { bankverbindungGeaendertEmailHtml, neuesSepaMandatHochgeladenEmailHtml } from "@/lib/mail/templates";
import { mietparteiAnzeigeName } from "@/lib/mietpartei";

export interface ProfilFormState {
  error?: string;
  success?: string;
  // Gesetzt, wenn durch eine IBAN-Aenderung ein neues SEPA-Mandat noetig wurde:
  // die UI zeigt dann prominent den Download-/Upload-Bereich.
  sepaNeu?: boolean;
}

/** Firmen-Adresse fuer interne Benachrichtigungen (Kontakt-E-Mail, Fallback Fehler-E-Mail). */
async function firmenBenachrichtigungsEmail(): Promise<string | null> {
  const f = await prisma.firmenStammdaten.findUnique({
    where: { id: "singleton" },
    select: { kontaktEmail: true, shellyFehlerEmail: true },
  });
  return f?.kontaktEmail?.trim() || f?.shellyFehlerEmail?.trim() || null;
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
  const kontoinhaber = String(formData.get("kontoinhaber") ?? "").trim();
  const ibanRaw = String(formData.get("iban") ?? "").trim();

  // IBAN validieren + Bank ableiten (falls angegeben).
  const iban = ibanRaw ? normalisiereIban(ibanRaw) : "";
  if (iban && !istGueltigeIban(iban)) {
    return { error: "Die IBAN ist ungültig. Bitte prüfen Sie Ihre Eingabe." };
  }
  const bankInfo = iban ? bankAusIban(iban) : null;
  const ibanGeaendert = iban !== "" && iban !== (mietpartei.iban ?? "");

  // Telefon + Bankverbindung werden sofort uebernommen.
  await prisma.mietpartei.update({
    where: { id: mietpartei.id },
    data: {
      telefon: telefon || null,
      kontoinhaber,
      iban: iban || null,
      bankName: bankInfo?.bankName ?? (iban ? mietpartei.bankName : null),
      bicOderBlz: bankInfo?.bic ?? (iban ? mietpartei.bicOderBlz : null),
    },
  });

  // Bei geaenderter IBAN: Firma benachrichtigen; ein neues SEPA-Mandat ist noetig.
  if (ibanGeaendert) {
    const ziel = await firmenBenachrichtigungsEmail();
    if (ziel) {
      await sendMail({
        to: ziel,
        subject: "Neue Bankverbindung hinterlegt",
        html: bankverbindungGeaendertEmailHtml({
          kunde: mietparteiAnzeigeName(mietpartei),
          kundennummer: mietpartei.kundennummer,
          iban: formatiereIban(iban),
          bankName: bankInfo?.bankName ?? "",
        }),
      }).catch(() => {});
    }
  }

  // E-Mail-Aenderung nur nach Bestaetigung per Link (wie bisher).
  let emailHinweis = "";
  if (email && email !== mietpartei.email) {
    if (!z.string().email().max(254).safeParse(email).success) {
      return { error: "Die E-Mail-Adresse ist ungültig." };
    }
    const res = await starteEmailVerifizierung({ zweck: "MIETER_EMAIL", refId: mietpartei.id, neueEmail: email });
    if (!res.ok) {
      return { error: `Übrige Daten gespeichert, aber die Bestätigungs-E-Mail konnte nicht versendet werden (${res.error}).` };
    }
    await prisma.mietpartei.update({ where: { id: mietpartei.id }, data: { emailPending: email } });
    emailHinweis = ` Eine Bestätigungs-E-Mail wurde an ${email} gesendet – die Adresse wird nach Bestätigung übernommen.`;
  }

  revalidatePath("/dashboard/profil");
  const sepaHinweis = ibanGeaendert
    ? " Ihre Bankverbindung wurde geändert – bitte laden Sie das neue SEPA-Mandat herunter, unterschreiben es und laden es wieder hoch."
    : "";
  return { success: `Profil gespeichert.${sepaHinweis}${emailHinweis}`, sepaNeu: ibanGeaendert };
}

export interface SepaUploadState {
  error?: string;
  success?: string;
}

/** Nimmt das vom Mieter unterschriebene neue SEPA-Mandat entgegen und benachrichtigt die Firma. */
export async function uploadSepaMandatAction(
  _prevState: SepaUploadState,
  formData: FormData,
): Promise<SepaUploadState> {
  const session = await getSession();
  if (!session.userId || session.role !== "MIETER") redirect("/login");

  const nutzer = await prisma.nutzer.findUniqueOrThrow({
    where: { id: session.userId },
    include: { mietpartei: true },
  });
  const mietpartei = nutzer.mietpartei;
  if (!mietpartei) redirect("/access-revoked");

  const datei = formData.get("datei");
  if (!(datei instanceof File) || datei.size === 0) return { error: "Bitte eine Datei auswählen." };

  try {
    const bytes = Buffer.from(await datei.arrayBuffer());
    await speichereDokument({ mietparteiId: mietpartei.id, typ: "SEPA", originalName: datei.name, bytes });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Datei konnte nicht gespeichert werden." };
  }

  const ziel = await firmenBenachrichtigungsEmail();
  if (ziel) {
    await sendMail({
      to: ziel,
      subject: "Neues SEPA-Mandat hochgeladen",
      html: neuesSepaMandatHochgeladenEmailHtml({
        kunde: mietparteiAnzeigeName(mietpartei),
        kundennummer: mietpartei.kundennummer,
      }),
    }).catch(() => {});
  }

  revalidatePath("/dashboard/profil");
  return { success: "Vielen Dank – Ihr unterschriebenes SEPA-Mandat wurde hochgeladen." };
}
