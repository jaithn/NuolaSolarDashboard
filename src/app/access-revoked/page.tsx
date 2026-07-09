import { logoutAction } from "@/app/login/actions";

export default function AccessRevokedPage() {
  return (
    <div className="auth-shell">
      <div className="card">
        <h1>Zugang nicht mehr aktiv</h1>
        <p>
          Ihr Mietverhältnis ist beendet oder Ihr Zugang wurde deaktiviert. Bei Fragen wenden Sie sich
          bitte an die Verwaltung der Nuola Solar GbR.
        </p>
        <form action={logoutAction}>
          <button className="btn" type="submit">
            Abmelden
          </button>
        </form>
      </div>
    </div>
  );
}
