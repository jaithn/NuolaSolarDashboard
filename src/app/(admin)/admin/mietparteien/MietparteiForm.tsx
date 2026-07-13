"use client";

import { useActionState, useState } from "react";
import { PriceInput, type SteuersatzOption } from "@/components/PriceInput";
import { createMietparteiAction, updateMietparteiAction, type MietparteiFormState } from "./actions";

const initialState: MietparteiFormState = {};

function toDateInputValue(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

interface EinheitOption {
  id: string;
  label: string;
}

interface MietparteiFormProps {
  mode: "create" | "edit";
  einheiten: EinheitOption[];
  steuersaetze: SteuersatzOption[];
  mietpartei?: {
    id: string;
    einheitId: string;
    vorname: string;
    name: string;
    firma: string | null;
    anrede: "HERR" | "FRAU" | "FAMILIE" | "FIRMA" | null;
    email: string;
    telefon: string | null;
    einzugsdatum: Date;
    auszugsdatum: Date | null;
    status: "INTERESSENT" | "AKTIV" | "INAKTIV";
    arbeitspreisNetto: number;
    arbeitspreisSteuersatzId: string;
    grundpreisNetto: number | null;
    grundpreisSteuersatzId: string | null;
    grundversorgerName: string | null;
    grundversorgerTarif: string | null;
    grundversorgerGrundpreisBrutto: number | null;
    grundversorgerArbeitspreisBrutto: number | null;
    vertragsart: "EIGENSTAENDIG" | "ERGAENZUNG" | null;
  };
}

export function MietparteiForm({ mode, einheiten, steuersaetze, mietpartei }: MietparteiFormProps) {
  const action = mode === "create" ? createMietparteiAction : updateMietparteiAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  // Fallback-Kette fuer unkontrollierte Felder: nach einem Validierungsfehler
  // die zuletzt eingegebenen Werte (state.values), sonst der bestehende
  // Datensatz (edit), sonst leer. So bleiben Eingaben bei ungueltiger E-Mail
  // erhalten (React 19 wuerde das Formular sonst zuruecksetzen).
  const val = (key: string, fallback = ""): string => state.values?.[key] ?? fallback;
  // Numerische Variante fuer PriceInput-Defaults: uebernimmt zuletzt eingegebene
  // Rohwerte (z.B. nach der Umzug-Rueckfrage), damit Arbeits-/Grundpreis/Abschlag
  // nicht auf 0 zurueckfallen.
  const valNum = (key: string, fallback: number | null | undefined): number | null | undefined =>
    state.values?.[key] !== undefined && state.values[key] !== "" ? Number(state.values[key]) : fallback;

  // Anrede steuert, ob es sich um eine Firma (Firmenname statt Vor-/Nachname)
  // oder eine natuerliche Person handelt.
  const [anrede, setAnrede] = useState(val("anrede", mietpartei?.anrede ?? ""));
  const istFirma = anrede === "FIRMA";

  // Grundpreis standardmaessig aktiviert (neue Mietparteien haben i.d.R. einen).
  const grundpreisInitial =
    state.values?.hatGrundpreis !== undefined
      ? state.values.hatGrundpreis === "on"
      : mode === "create" || Boolean(mietpartei?.grundpreisNetto);
  const [hatGrundpreis, setHatGrundpreis] = useState(grundpreisInitial);

  const [einzugsdatum, setEinzugsdatum] = useState(val("einzugsdatum", toDateInputValue(mietpartei?.einzugsdatum)));
  // Abschlag gilt standardmaessig ab dem Einzugsdatum und folgt diesem, solange
  // nicht manuell abweichend gesetzt.
  const [abschlagGueltigAb, setAbschlagGueltigAb] = useState(val("abschlagGueltigAb") || einzugsdatum);

  return (
    <form action={formAction} key={`${mietpartei?.id ?? "create"}-${state.confirmUmzug ? "confirm" : "form"}`}>
      {state.error && <div className="form-error">{state.error}</div>}
      {state.success && <div className="form-notice" role="status">{state.success}</div>}
      {mietpartei && <input type="hidden" name="id" value={mietpartei.id} />}

      {state.confirmUmzug && (
        <div className="form-error" role="alert" style={{ background: "var(--color-primary-tint)", color: "var(--color-ink)", borderColor: "var(--color-primary)" }}>
          <strong>Diese Einheit ist bereits belegt:</strong> „{state.confirmUmzug.vorhandenBezeichner}&quot; wohnt dort noch
          {state.confirmUmzug.auszugBereitsGesetzt ? " (Auszugsdatum bereits gesetzt)" : " (kein Auszugsdatum gesetzt)"}.
          Ist der Wechsel der Mietpartei korrekt? Dann bitte das Auszugsdatum der bisherigen Mietpartei bestätigen – es
          wird automatisch ein Schlussrechnungs-Entwurf für die bisherige Mietpartei erstellt.
          <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.6rem", alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="field" style={{ maxWidth: "16rem", margin: 0 }}>
              <label htmlFor="vormieterAuszugsdatum">Auszugsdatum bisherige Mietpartei</label>
              <input
                id="vormieterAuszugsdatum"
                name="vormieterAuszugsdatum"
                type="date"
                defaultValue={val("vormieterAuszugsdatum") || state.confirmUmzug.vorschlagAuszug}
                required
              />
            </div>
            <button className="btn" type="submit" disabled={pending}>
              {pending ? "Wird gespeichert…" : "Bestätigen & anlegen"}
            </button>
          </div>
          <input type="hidden" name="bestaetigeUmzug" value="on" />
        </div>
      )}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="einheitId">Einheit</label>
          <select
            id="einheitId"
            name="einheitId"
            className="select-inline"
            defaultValue={val("einheitId", mietpartei?.einheitId ?? einheiten[0]?.id ?? "")}
            required
          >
            {einheiten.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="anrede">Anrede</label>
          <select
            id="anrede"
            name="anrede"
            className="select-inline"
            value={anrede}
            onChange={(e) => setAnrede(e.target.value)}
          >
            <option value="">— keine —</option>
            <option value="HERR">Herr</option>
            <option value="FRAU">Frau</option>
            <option value="FAMILIE">Familie</option>
            <option value="FIRMA">Firma</option>
          </select>
        </div>
        {/* Firma-Feld nur bei Anrede „Firma" (bei Personen ausgeblendet). */}
        {istFirma && (
          <div className="field">
            <label htmlFor="firma">Firma</label>
            <input id="firma" name="firma" type="text" defaultValue={val("firma", mietpartei?.firma ?? "")} required />
          </div>
        )}
        {/* Vor-/Nachname bei Anrede „Firma" ausgegraut (deaktiviert). */}
        <div className="field" style={istFirma ? { opacity: 0.5 } : undefined}>
          <label htmlFor="vorname">Vorname</label>
          <input
            id="vorname"
            name="vorname"
            type="text"
            defaultValue={val("vorname", mietpartei?.vorname ?? "")}
            disabled={istFirma}
          />
        </div>
        <div className="field" style={istFirma ? { opacity: 0.5 } : undefined}>
          <label htmlFor="name">Name</label>
          <input
            id="name"
            name="name"
            type="text"
            defaultValue={val("name", mietpartei?.name ?? "")}
            disabled={istFirma}
            required={!istFirma}
          />
        </div>
        <div className="field">
          <label htmlFor="email">E-Mail</label>
          <input id="email" name="email" type="email" required defaultValue={val("email", mietpartei?.email ?? "")} />
        </div>
        <div className="field">
          <label htmlFor="telefon">Telefon</label>
          <input id="telefon" name="telefon" type="text" defaultValue={val("telefon", mietpartei?.telefon ?? "")} />
        </div>
        <div className="field">
          <label htmlFor="einzugsdatum">Beginn der Stromlieferung</label>
          <input
            id="einzugsdatum"
            name="einzugsdatum"
            type="date"
            required
            value={einzugsdatum}
            onChange={(e) => {
              // Abschlag-Startdatum folgt dem Einzugsdatum, solange es damit
              // uebereinstimmte (noch nicht manuell abweichend gesetzt).
              if (abschlagGueltigAb === einzugsdatum) setAbschlagGueltigAb(e.target.value);
              setEinzugsdatum(e.target.value);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="auszugsdatum">Auszugsdatum (optional)</label>
          <input
            id="auszugsdatum"
            name="auszugsdatum"
            type="date"
            defaultValue={val("auszugsdatum", toDateInputValue(mietpartei?.auszugsdatum))}
          />
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select
            id="status"
            name="status"
            className="select-inline"
            defaultValue={val("status", mietpartei?.status ?? (mode === "create" ? "INTERESSENT" : "AKTIV"))}
          >
            <option value="INTERESSENT">Interessent</option>
            <option value="AKTIV">Aktiv</option>
            <option value="INAKTIV">Inaktiv</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="vertragsart">Vertragsart</label>
          <select
            id="vertragsart"
            name="vertragsart"
            className="select-inline"
            defaultValue={val("vertragsart", mietpartei?.vertragsart ?? "")}
          >
            <option value="">— noch offen —</option>
            <option value="EIGENSTAENDIG">Eigenständiger Vertrag</option>
            <option value="ERGAENZUNG">Ergänzung zum Mietvertrag</option>
          </select>
        </div>
      </div>

      <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", marginTop: 0 }}>
        Die Anschrift entspricht der Adresse des Objekts und muss nicht separat erfasst werden.
      </p>

      <PriceInput
        label="Arbeitspreis (€/kWh)"
        nettoName="arbeitspreisNetto"
        steuersatzName="arbeitspreisSteuersatzId"
        defaultNetto={valNum("arbeitspreisNetto", mietpartei?.arbeitspreisNetto)}
        defaultSteuersatzId={val("arbeitspreisSteuersatzId", mietpartei?.arbeitspreisSteuersatzId ?? "")}
        steuersaetze={steuersaetze}
        required
      />

      <div className="field">
        <label>
          <input
            type="checkbox"
            name="hatGrundpreis"
            checked={hatGrundpreis}
            onChange={(e) => setHatGrundpreis(e.target.checked)}
          />{" "}
          Monatlicher Grundpreis
        </label>
      </div>

      {hatGrundpreis && (
        <PriceInput
          label="Grundpreis (€/Monat)"
          nettoName="grundpreisNetto"
          steuersatzName="grundpreisSteuersatzId"
          defaultNetto={valNum("grundpreisNetto", mietpartei?.grundpreisNetto ?? 0)}
          defaultSteuersatzId={val("grundpreisSteuersatzId", mietpartei?.grundpreisSteuersatzId ?? "")}
          steuersaetze={steuersaetze}
        />
      )}

      <div className="section" style={{ marginTop: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Grundversorger-Vergleich (für das Anschreiben)</h3>
        <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", marginTop: 0 }}>
          Optional. Preise <strong>brutto</strong> (inkl. MwSt.), so wie sie auf der Grundversorger-Rechnung
          stehen. Der prozentuale Vorteil wird im Anschreiben automatisch berechnet.
        </p>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="grundversorgerName">Grundversorger</label>
            <input
              id="grundversorgerName"
              name="grundversorgerName"
              type="text"
              defaultValue={val("grundversorgerName", mietpartei?.grundversorgerName ?? "")}
            />
          </div>
          <div className="field">
            <label htmlFor="grundversorgerTarif">Tarifname</label>
            <input
              id="grundversorgerTarif"
              name="grundversorgerTarif"
              type="text"
              defaultValue={val("grundversorgerTarif", mietpartei?.grundversorgerTarif ?? "")}
            />
          </div>
          <div className="field">
            <label htmlFor="grundversorgerGrundpreisBrutto">Grundpreis Grundversorger (€/Monat, brutto)</label>
            <input
              id="grundversorgerGrundpreisBrutto"
              name="grundversorgerGrundpreisBrutto"
              type="number"
              step="0.01"
              min="0"
              defaultValue={val(
                "grundversorgerGrundpreisBrutto",
                mietpartei?.grundversorgerGrundpreisBrutto != null
                  ? String(mietpartei.grundversorgerGrundpreisBrutto)
                  : "",
              )}
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
              defaultValue={val(
                "grundversorgerArbeitspreisBrutto",
                mietpartei?.grundversorgerArbeitspreisBrutto != null
                  ? String(mietpartei.grundversorgerArbeitspreisBrutto)
                  : "",
              )}
            />
          </div>
        </div>
      </div>

      {mode === "create" && (
        <div className="section" style={{ marginTop: "1rem", background: "var(--color-primary-tint)" }}>
          <h3 style={{ marginTop: 0 }}>Monatlicher Abschlag</h3>
          <PriceInput
            label="Abschlag (€/Monat)"
            nettoName="abschlagNetto"
            steuersatzName="abschlagSteuersatzId"
            defaultNetto={valNum("abschlagNetto", 0)}
            defaultSteuersatzId={val("abschlagSteuersatzId", "")}
            steuersaetze={steuersaetze}
          />
          <div className="field">
            <label htmlFor="abschlagGueltigAb">Abschlag gültig ab</label>
            <input
              id="abschlagGueltigAb"
              name="abschlagGueltigAb"
              type="date"
              value={abschlagGueltigAb}
              onChange={(e) => setAbschlagGueltigAb(e.target.value)}
            />
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", margin: 0 }}>
            Wird bei Betrag 0 nicht angelegt. Standard-Beginn ist der Beginn der Stromlieferung.
          </p>
        </div>
      )}

      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem", marginTop: "1rem" }}>
        {pending ? "Wird gespeichert…" : mode === "create" ? "Mietpartei anlegen" : "Speichern"}
      </button>
    </form>
  );
}
