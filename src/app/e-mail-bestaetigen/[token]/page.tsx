import { bestaetigeEmailAction } from "./actions";

export default async function EmailBestaetigenPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { token } = await params;
  const { status } = await searchParams;

  return (
    <div className="auth-shell">
      <div className="card">
        <h1>E-Mail bestätigen</h1>
        {status === "ok" ? (
          <div className="form-notice" role="status">
            Ihre E-Mail-Adresse wurde erfolgreich bestätigt. Sie können dieses Fenster schließen.
          </div>
        ) : status === "fehler" ? (
          <div className="form-error" role="alert">
            Der Bestätigungslink ist ungültig oder abgelaufen. Bitte fordern Sie die Änderung erneut an.
          </div>
        ) : (
          <form action={bestaetigeEmailAction}>
            <p>Bitte bestätigen Sie die Änderung Ihrer E-Mail-Adresse.</p>
            <input type="hidden" name="token" value={token} />
            <button className="btn" type="submit">
              E-Mail-Adresse bestätigen
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
