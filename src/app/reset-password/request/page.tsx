import { RequestResetForm } from "./RequestResetForm";

export default function RequestResetPage() {
  return (
    <div className="auth-shell">
      <div className="card">
        <h1>Passwort vergessen</h1>
        <RequestResetForm />
      </div>
    </div>
  );
}
