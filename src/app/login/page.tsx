import { LoginForm } from "./LoginForm";
import { BrandLogo } from "@/components/BrandLogo";
import { SiteFooter } from "@/components/SiteFooter";

export default function LoginPage() {
  return (
    <div className="auth-shell auth-shell--with-footer">
      <div className="card">
        <BrandLogo variant="login" />
        <LoginForm />
      </div>
      <SiteFooter variant="auth" />
    </div>
  );
}
