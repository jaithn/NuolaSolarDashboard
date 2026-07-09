function layout(title: string, bodyHtml: string): string {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 32rem; margin: 0 auto; color: #0f172a;">
      <h2 style="color: #0f766e;">${title}</h2>
      ${bodyHtml}
      <p style="color: #64748b; font-size: 0.8rem; margin-top: 2rem;">Nuola Solar GbR</p>
    </div>
  `;
}

export function onboardingEmailHtml(params: { username: string; password: string; loginUrl: string }): string {
  return layout(
    "Ihr Zugang zum Nuola Mieter-Dashboard",
    `
      <p>für Sie wurde ein Zugang zum Mieter-Dashboard der Nuola Solar GbR eingerichtet.
      Dort sehen Sie Ihren monatlichen Stromverbrauch sowie Ihre Jahresabrechnungen.</p>
      <p><strong>Benutzername:</strong> ${params.username}<br/>
      <strong>Einmal-Passwort:</strong> ${params.password}</p>
      <p>Beim ersten Login müssen Sie dieses Passwort ändern.</p>
      <p><a href="${params.loginUrl}">Jetzt anmelden</a></p>
    `,
  );
}

export function invoiceSentEmailHtml(params: { rechnungsnummer: string; typ: string; loginUrl: string }): string {
  return layout(
    "Ihre Abrechnung ist verfügbar",
    `
      <p>für Sie wurde eine neue ${params.typ === "SCHLUSSRECHNUNG" ? "Schlussrechnung" : "Jahresabrechnung"}
      (Rechnungsnummer ${params.rechnungsnummer}) erstellt. Sie finden diese als PDF im Anhang dieser
      E-Mail sowie jederzeit in Ihrem Mieter-Dashboard.</p>
      <p><a href="${params.loginUrl}">Zum Mieter-Dashboard</a></p>
    `,
  );
}

export function passwordResetEmailHtml(params: { resetUrl: string }): string {
  return layout(
    "Passwort zurücksetzen",
    `
      <p>Sie haben ein neues Passwort für Ihren Zugang zum Nuola Mieter-Dashboard angefordert.
      Der folgende Link ist eine Stunde gültig:</p>
      <p><a href="${params.resetUrl}">Passwort jetzt zurücksetzen</a></p>
      <p>Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.</p>
    `,
  );
}
