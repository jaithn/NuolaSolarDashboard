import { getSession } from "@/lib/auth/getSession";
import { prisma } from "@/lib/db";
import { ProfilForm } from "./ProfilForm";

export default async function ProfilPage() {
  const session = await getSession();
  const nutzer = await prisma.nutzer.findUniqueOrThrow({
    where: { id: session.userId! },
    include: { mietpartei: true },
  });
  const mietpartei = nutzer.mietpartei!;

  return (
    <div>
      <h1>Profil</h1>
      <div className="section">
        <h2>Kontaktdaten</h2>
        <p style={{ color: "var(--color-muted)", marginTop: 0 }}>
          Hier können Sie Ihre Telefonnummer und E-Mail-Adresse selbst ändern. Eine neue E-Mail-Adresse
          wird erst nach Bestätigung über den zugesandten Link aktiv.
        </p>
        <ProfilForm
          email={mietpartei.email}
          emailVerifiziert={mietpartei.emailVerifiziert}
          emailPending={mietpartei.emailPending}
          telefon={mietpartei.telefon}
        />
      </div>
    </div>
  );
}
