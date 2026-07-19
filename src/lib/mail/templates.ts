function layout(title: string, bodyHtml: string): string {
  return `
    <div style="font-family: 'IBM Plex Sans', system-ui, sans-serif; max-width: 32rem; margin: 0 auto; color: #1c1c21;">
      <h2 style="color: #a2762b;">${title}</h2>
      ${bodyHtml}
      <p style="color: #64748b; font-size: 0.8rem; margin-top: 2rem;">Nuola Solar GbR</p>
    </div>
  `;
}

export function onboardingEmailHtml(params: { username: string; password: string; loginUrl: string }): string {
  return layout(
    "Ihr Zugang zum Nuola Energy Dashboard",
    `
      <p>für Sie wurde ein Zugang zum Nuola Energy Dashboard der Nuola Solar GbR eingerichtet.
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
      E-Mail sowie jederzeit im Nuola Energy Dashboard.</p>
      <p><a href="${params.loginUrl}">Zum Nuola Energy Dashboard</a></p>
    `,
  );
}

export function passwordResetEmailHtml(params: { resetUrl: string }): string {
  return layout(
    "Passwort zurücksetzen",
    `
      <p>Sie haben ein neues Passwort für Ihren Zugang zum Nuola Energy Dashboard angefordert.
      Der folgende Link ist eine Stunde gültig:</p>
      <p><a href="${params.resetUrl}">Passwort jetzt zurücksetzen</a></p>
      <p>Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.</p>
    `,
  );
}

/** An die Firmen-Adresse: eine Mietpartei hat im Portal eine neue Bankverbindung hinterlegt. */
export function bankverbindungGeaendertEmailHtml(params: {
  kunde: string;
  kundennummer: number | null;
  iban: string;
  bankName: string;
}): string {
  return layout(
    "Neue Bankverbindung hinterlegt",
    `
      <p>Die folgende Mietpartei hat im Mieter-Dashboard eine <strong>neue Bankverbindung</strong> hinterlegt:</p>
      <p><strong>Kundin/Kunde:</strong> ${params.kunde}${
        params.kundennummer != null ? ` (Kundennummer ${params.kundennummer})` : ""
      }<br/>
      <strong>IBAN:</strong> ${params.iban}<br/>
      <strong>Bank:</strong> ${params.bankName || "—"}</p>
      <p>Ein neues SEPA-Lastschriftmandat wird benötigt. Die Mietpartei wurde gebeten, das vorausgefüllte
      Mandat herunterzuladen, zu unterschreiben und wieder hochzuladen.</p>
    `,
  );
}

/** An die Firmen-Adresse: die Mietpartei hat das neue, unterschriebene SEPA-Mandat hochgeladen. */
export function neuesSepaMandatHochgeladenEmailHtml(params: { kunde: string; kundennummer: number | null }): string {
  return layout(
    "Neues SEPA-Mandat hochgeladen",
    `
      <p>Die folgende Mietpartei hat ihr <strong>unterschriebenes SEPA-Lastschriftmandat</strong> (neue Bankverbindung)
      im Mieter-Dashboard hochgeladen:</p>
      <p><strong>Kundin/Kunde:</strong> ${params.kunde}${
        params.kundennummer != null ? ` (Kundennummer ${params.kundennummer})` : ""
      }</p>
      <p>Das Dokument liegt in den Vertragsunterlagen der Mietpartei bereit.</p>
    `,
  );
}

export interface ShellyFehlerZeile {
  geraet: string;
  deviceId: string;
  objekt: string;
  einheiten: string;
  grund: string;
}

export function shellyFehlerEmailHtml(zeilen: ShellyFehlerZeile[]): string {
  const rows = zeilen
    .map(
      (z) => `
      <tr>
        <td style="padding:4px 8px;border:1px solid #e2e8f0;">${z.objekt}</td>
        <td style="padding:4px 8px;border:1px solid #e2e8f0;">${z.einheiten || "–"}</td>
        <td style="padding:4px 8px;border:1px solid #e2e8f0;">${z.geraet}</td>
        <td style="padding:4px 8px;border:1px solid #e2e8f0;font-family:monospace;">${z.deviceId}</td>
        <td style="padding:4px 8px;border:1px solid #e2e8f0;">${z.grund}</td>
      </tr>`,
    )
    .join("");
  return layout(
    "Shelly-Abruf fehlgeschlagen",
    `
      <p>Beim automatischen Abruf der folgenden Shelly-Geräte sind Probleme aufgetreten:</p>
      <table style="border-collapse:collapse;font-size:0.85rem;width:100%;">
        <thead>
          <tr>
            <th style="padding:4px 8px;border:1px solid #e2e8f0;text-align:left;">Objekt</th>
            <th style="padding:4px 8px;border:1px solid #e2e8f0;text-align:left;">Einheit(en)</th>
            <th style="padding:4px 8px;border:1px solid #e2e8f0;text-align:left;">Gerät</th>
            <th style="padding:4px 8px;border:1px solid #e2e8f0;text-align:left;">Device-ID</th>
            <th style="padding:4px 8px;border:1px solid #e2e8f0;text-align:left;">Grund</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#64748b;font-size:0.8rem;">Diese Benachrichtigung wird höchstens einmal alle 6 Stunden verschickt,
      solange Fehler bestehen. Die Erfassung läuft für die übrigen Geräte normal weiter.</p>
    `,
  );
}
