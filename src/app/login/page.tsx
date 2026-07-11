import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="auth-shell">
      <div className="card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="brand-logo brand-logo--login" src="/nuola-solar-logo.png" alt="Nuola Solar" />
        <LoginForm />
      </div>
    </div>
  );
}
