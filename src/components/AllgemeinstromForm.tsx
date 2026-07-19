"use client";

import { useActionState, useState } from "react";
import { PriceInput, GrossPriceInput, type SteuersatzOption } from "@/components/PriceInput";
import { createAllgemeinstromAction, type MietparteiFormState } from "@/app/(admin)/admin/mietparteien/actions";
import { kombiniereNamen } from "@/lib/mietpartei";

export interface AllgemeinstromObjektOption {
  id: string;
  name: string;
  vermieterName: string | null;
  vermieterName2: string | null;
  vermieterAnrede: string | null;
  vermieterFirma: string | null;
  vermieterAnschrift: string | null;
  vermieterPlz: string;
  vermieterOrt: string;
}

const initialState: MietparteiFormState = {};

/**
 * Anlege-Maske „Allgemeinstrom": erzeugt Einheit (Typ ALLGEMEINSTROM) + Mietpartei
 * = Vermieter:in in einem Schritt. Vermieter-Name/-Anschrift werden aus dem
 * gewählten Objekt vorbelegt (überschreibbar). Kein Anschreiben, keine Ergänzung.
 */
export function AllgemeinstromForm({
  objekte,
  steuersaetze,
}: {
  objekte: AllgemeinstromObjektOption[];
  steuersaetze: SteuersatzOption[];
}) {
  const [state, formAction, pending] = useActionState(createAllgemeinstromAction, initialState);

  const [objektId, setObjektId] = useState(objekte[0]?.id ?? "");
  const gewaehlt = objekte.find((o) => o.id === objektId);

  // Vermieter-Felder aus dem Objekt vorbelegen (kontrolliert, damit sie beim
  // Objektwechsel nachziehen und dennoch editierbar bleiben).
  const vorbelegung = (o?: AllgemeinstromObjektOption) => ({
    anrede: o?.vermieterAnrede ?? "",
    firma: o?.vermieterFirma ?? "",
    name: kombiniereNamen(o?.vermieterName, o?.vermieterName2) ?? "",
    anschrift: o?.vermieterAnschrift ?? "",
    plz: o?.vermieterPlz ?? "",
    ort: o?.vermieterOrt ?? "",
  });
  const [v, setV] = useState(vorbelegung(gewaehlt));
  const beiObjektWechsel = (id: string) => {
    setObjektId(id);
    setV(vorbelegung(objekte.find((o) => o.id === id)));
  };
  const istFirma = v.anrede === "FIRMA";

  const [hatGrundpreis, setHatGrundpreis] = useState(true);
  const heute = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction}>
      {state.error && <div className="form-error" role="alert">{state.error}</div>}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="as-objektId">Objekt</label>
          <select
            id="as-objektId"
            name="objektId"
            className="select-inline"
            value={objektId}
            onChange={(e) => beiObjektWechsel(e.target.value)}
            required
          >
            {objekte.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="as-einzugsdatum">Beginn der Stromlieferung</label>
          <input id="as-einzugsdatum" name="einzugsdatum" type="date" required defaultValue={heute} />
        </div>
      </div>

      <h3 style={{ marginBottom: "0.4rem" }}>Vermieter:in (Vertragspartei)</h3>
      <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", marginTop: 0 }}>
        Vorbelegt aus dem Objekt – bei Bedarf anpassen. Die Rechnungsanschrift ist die der Vermieter:in
        (nicht die Objektadresse).
      </p>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="as-anrede">Anrede</label>
          <select
            id="as-anrede"
            name="anrede"
            className="select-inline"
            value={v.anrede}
            onChange={(e) => setV({ ...v, anrede: e.target.value })}
          >
            <option value="">— keine —</option>
            <option value="HERR">Herr</option>
            <option value="FRAU">Frau</option>
            <option value="FAMILIE">Familie</option>
            <option value="FIRMA">Firma</option>
          </select>
        </div>
        {istFirma ? (
          <div className="field">
            <label htmlFor="as-firma">Firma</label>
            <input id="as-firma" name="firma" type="text" value={v.firma} onChange={(e) => setV({ ...v, firma: e.target.value })} required />
          </div>
        ) : (
          <div className="field">
            <label htmlFor="as-name">Name</label>
            <input id="as-name" name="name" type="text" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required />
          </div>
        )}
        <div className="field">
          <label htmlFor="as-anschrift">Straße &amp; Hausnr.</label>
          <input id="as-anschrift" name="anschrift" type="text" value={v.anschrift} onChange={(e) => setV({ ...v, anschrift: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="as-plz">PLZ</label>
          <input id="as-plz" name="anschriftPlz" type="text" inputMode="numeric" value={v.plz} onChange={(e) => setV({ ...v, plz: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="as-ort">Ort</label>
          <input id="as-ort" name="anschriftOrt" type="text" value={v.ort} onChange={(e) => setV({ ...v, ort: e.target.value })} />
        </div>
      </div>

      <PriceInput
        label="Arbeitspreis (€/kWh)"
        nettoName="arbeitspreisNetto"
        steuersatzName="arbeitspreisSteuersatzId"
        steuersaetze={steuersaetze}
        required
      />

      <div className="field">
        <label>
          <input type="checkbox" name="hatGrundpreis" checked={hatGrundpreis} onChange={(e) => setHatGrundpreis(e.target.checked)} />{" "}
          Monatlicher Grundpreis
        </label>
      </div>
      {hatGrundpreis && (
        <PriceInput
          label="Grundpreis (€/Monat)"
          nettoName="grundpreisNetto"
          steuersatzName="grundpreisSteuersatzId"
          steuersaetze={steuersaetze}
        />
      )}

      <div className="section" style={{ marginTop: "1rem", background: "var(--color-primary-tint)" }}>
        <h3 style={{ marginTop: 0 }}>Monatlicher Abschlag (optional)</h3>
        <GrossPriceInput
          label="Abschlag (€/Monat, inkl. MwSt.)"
          bruttoName="abschlagBrutto"
          steuersatzName="abschlagSteuersatzId"
          steuersaetze={steuersaetze}
        />
        <div className="field">
          <label htmlFor="as-abschlagGueltigAb">Abschlag gültig ab</label>
          <input id="as-abschlagGueltigAb" name="abschlagGueltigAb" type="date" defaultValue={heute} />
        </div>
        <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", margin: 0 }}>Wird bei Betrag 0 nicht angelegt.</p>
      </div>

      <div className="field" style={{ marginTop: "1rem" }}>
        <label>
          <input type="checkbox" name="hatWaermepumpe" /> Es gibt eine Wärmepumpe
        </label>
        <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", margin: "0.2rem 0 0" }}>
          Anschließend auf der Einheit-Detailseite den Wärmepumpen-Zähler zuordnen und als „Wärmepumpe“
          markieren – er wird dann in der Rechnung getrennt (nur Arbeitspreis) ausgewiesen.
        </p>
      </div>

      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "18rem", marginTop: "1rem" }}>
        {pending ? "Wird angelegt…" : "Allgemeinstrom anlegen"}
      </button>
    </form>
  );
}
