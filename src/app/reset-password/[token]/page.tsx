import { ResetPasswordForm } from "./ResetPasswordForm";

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="auth-shell">
      <div className="card">
        <h1>Neues Passwort setzen</h1>
        <ResetPasswordForm token={token} />
      </div>
    </div>
  );
}
