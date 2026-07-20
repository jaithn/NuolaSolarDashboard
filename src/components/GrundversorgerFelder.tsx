/**
 * Grundversorger-Vergleich je OBJEKT (für das Onboarding-Anschreiben „Ihr
 * Preisvorteil"). Gilt für alle Mietparteien des Objekts – daher am Objekt und
 * nicht mehr je Mietpartei gepflegt. Preise brutto (inkl. MwSt.); zusätzlich der
 * Stand/Stichtag des Tarifs, der im Anschreiben mit ausgewiesen wird.
 *
 * Reines Server-Rendering (nur `defaultValue`), daher keine "use client"-Direktive
 * nötig – wird in die (Client-)Objekt-Formulare eingebettet.
 */
export function GrundversorgerFelder({
  name = "",
  tarif = "",
  grundpreisBrutto = "",
  arbeitspreisBrutto = "",
  stand = "",
}: {
  name?: string;
  tarif?: string;
  grundpreisBrutto?: string;
  arbeitspreisBrutto?: string;
  stand?: string; // YYYY-MM-DD
}) {
  return (
    <>
      <h3 style={{ marginBottom: "0.4rem" }}>Grundversorger-Vergleich (für das Anschreiben)</h3>
      <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", marginTop: 0 }}>
        Optional, gilt für das ganze Objekt. Preise <strong>brutto</strong> (inkl. MwSt.), so wie sie auf der
        Grundversorger-Rechnung stehen. Der prozentuale Vorteil wird im Anschreiben automatisch berechnet.
      </p>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="grundversorgerName">Grundversorger</label>
          <input id="grundversorgerName" name="grundversorgerName" type="text" defaultValue={name} />
        </div>
        <div className="field">
          <label htmlFor="grundversorgerTarif">Tarifname</label>
          <input id="grundversorgerTarif" name="grundversorgerTarif" type="text" defaultValue={tarif} />
        </div>
        <div className="field">
          <label htmlFor="grundversorgerGrundpreisBrutto">Grundpreis Grundversorger (€/Monat, brutto)</label>
          <input
            id="grundversorgerGrundpreisBrutto"
            name="grundversorgerGrundpreisBrutto"
            type="number"
            step="0.01"
            min="0"
            defaultValue={grundpreisBrutto}
          />
        </div>
        <div className="field">
          <label htmlFor="grundversorgerArbeitspreisBrutto">Arbeitspreis Grundversorger (€/kWh, brutto)</label>
          <input
            id="grundversorgerArbeitspreisBrutto"
            name="grundversorgerArbeitspreisBrutto"
            type="number"
            step="0.0001"
            min="0"
            defaultValue={arbeitspreisBrutto}
          />
        </div>
        <div className="field">
          <label htmlFor="grundversorgerStand">Stand des Tarifs</label>
          <input id="grundversorgerStand" name="grundversorgerStand" type="date" defaultValue={stand} />
        </div>
      </div>
    </>
  );
}
