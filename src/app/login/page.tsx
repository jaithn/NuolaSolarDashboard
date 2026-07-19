import { LoginForm } from "./LoginForm";
import { BrandLogo } from "@/components/BrandLogo";

export default function LoginPage() {
  return (
    <div className="auth-shell">
      <div className="card">
        <BrandLogo variant="login" />
        <LoginForm />
      </div>
    </div>
  );
}
