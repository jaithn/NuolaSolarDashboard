import { ChangePasswordForm } from "./ChangePasswordForm";

export default function ChangePasswordPage() {
  return (
    <div className="auth-shell">
      <div className="card">
        <h1>Passwort ändern</h1>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
