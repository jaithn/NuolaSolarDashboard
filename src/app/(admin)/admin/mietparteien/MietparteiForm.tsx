"use client";

import { useActionState, useState } from "react";
import { PriceInput, GrossPriceInput, type SteuersatzOption } from "@/components/PriceInput";
import { berechneBrutto } from "@/lib/steuer";
import { createMietparteiAction, updateMietparteiAction, bankAusIbanAction, type MietparteiFormState } from "./actions";
import { weiterePersonenDerMietpartei } from "@/lib/mietpartei";

// Formularmodell einer weiteren Person (Anrede als String, "" = keine).
interface WeiterePerson {
  anrede: string;
  vorname: string;
  name: string;
}

const initialState: MietparteiFormState = {};

function toDateInputValue(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

interface EinheitOption {
  id: string;
  label: string;
  // Adresse des zugehörigen Objekts - Default der Mietpartei-Anschrift.
  adresse: string;
  plz: string;
  ort: string;
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
    // Legacy-Einzelfelder der zweiten Person (nur noch Fallback beim Vorbelegen).
    vorname2: string;
    name2: string;
    anrede2: "HERR" | "FRAU" | "FAMILIE" | "FIRMA" | null;
    // Weitere Personen (ab Person 2) als JSON-Array.
    weiterePersonen: unknown;
    firma: string | null;
    anrede: "HERR" | "FRAU" | "FAMILIE" | "FIRMA" | null;
    email: string;
    telefon: string | null;
    kontoinhaber: string;
    iban: string | null;
    bankName: string | null;
    anschrift: string | null;
    anschriftPlz: string;
    anschriftOrt: string;
    einzugsdatum: Date;
    auszugsdatum: Date | null;
    status: "INTERESSENT" | "AKTIV" | "INAKTIV";
    arbeitspreisNetto: number;
    arbeitspreisSteuersatzId: string;
    grundpreisNetto: number | null;
    grundpreisSteuersatzId: string | null;
    angenommenerJahresverbrauchKwh: number | null;
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

  // Weitere Personen (ab Person 2, z.B. Ehepaar/WG): beliebig viele, je Anrede +
  // Vor-/Nachname. Vorbelegen: nach Fehler aus state.values (JSON), sonst aus dem
  // Datensatz (weiterePersonen bzw. Legacy-Fallback), sonst leer.
  const [weiterePersonen, setWeiterePersonen] = useState<WeiterePerson[]>(() => {
    const rohNachFehler = state.values?.weiterePersonen;
    if (rohNachFehler) {
      try {
        const arr = JSON.parse(rohNachFehler);
        if (Array.isArray(arr)) {
          return arr.map((p) => ({
            anrede: String(p?.anrede ?? ""),
            vorname: String(p?.vorname ?? ""),
            name: String(p?.name ?? ""),
          }));
        }
      } catch {
        /* ignorieren, Fallback unten */
      }
    }
    if (mietpartei) {
      return weiterePersonenDerMietpartei(mietpartei).map((p) => ({
        anrede: p.anrede ?? "",
        vorname: p.vorname,
        name: p.name,
      }));
    }
    return [];
  });

  const setzePerson = (index: number, feld: keyof WeiterePerson, wert: string) =>
    setWeiterePersonen((liste) => liste.map((p, i) => (i === index ? { ...p, [feld]: wert } : p)));
  const entfernePerson = (index: number) =>
    setWeiterePersonen((liste) => liste.filter((_, i) => i !== index));
  const fuegePersonHinzu = () => setWeiterePersonen((liste) => [...liste, { anrede: "", vorname: "", name: "" }]);

  // Einheit (kontrolliert), damit die Mietpartei-Anschrift der Objektadresse der
  // gewählten Einheit folgen kann (Default, im Formular überschreibbar).
  const initialEinheitId = val("einheitId", mietpartei?.einheitId ?? einheiten[0]?.id ?? "");
  const adrDefault = (id: string) => {
    const e = einheiten.find((x) => x.id === id);
    return { strasse: e?.adresse ?? "", plz: e?.plz ?? "", ort: e?.ort ?? "" };
  };
  const [einheitId, setEinheitId] = useState(initialEinheitId);
  const [anschrift, setAnschrift] = useState(
    val("anschrift", mietpartei?.anschrift || adrDefault(initialEinheitId).strasse),
  );
  const [anschriftPlz, setAnschriftPlz] = useState(
    val("anschriftPlz", mietpartei?.anschriftPlz || adrDefault(initialEinheitId).plz),
  );
  const [anschriftOrt, setAnschriftOrt] = useState(
    val("anschriftOrt", mietpartei?.anschriftOrt || adrDefault(initialEinheitId).ort),
  );
  const beiEinheitWechsel = (id: string) => {
    setEinheitId(id);
    const a = adrDefault(id);
    setAnschrift(a.strasse);
    setAnschriftPlz(a.plz);
    setAnschriftOrt(a.ort);
  };

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

  // Monatlicher Abschlag (nur Anlege-Modus): wird automatisch aus Arbeits-/
  // Grundpreis und angenommenem Jahresverbrauch vorgeschlagen, bleibt aber manuell
  // ueberschreibbar. Sobald der Nutzer den Betrag selbst aendert (abschlagManuell),
  // wird der Vorschlag nicht mehr ueberschrieben.
  const [abschlagBrutto, setAbschlagBrutto] = useState<number>(Number(val("abschlagBrutto")) || 0);
  const [abschlagManuell, setAbschlagManuell] = useState<boolean>(Boolean(state.values?.abschlagBrutto));

  // Bankname wird beim IBAN-Verlassen automatisch aus der IBAN ermittelt
  // (bankAusIbanAction), bleibt aber manuell ueberschreibbar.
  const [bankName, setBankName] = useState(val("bankName", mietpartei?.bankName ?? ""));
  const onIbanBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const iban = e.target.value.trim();
    if (!iban) return;
    const info = await bankAusIbanAction(iban);
    if (info?.bankName) setBankName(info.bankName);
  };

  const satzProzent = (id: string | undefined | null) =>
    steuersaetze.find((s) => s.id === id)?.prozentsatz ?? 0;

  // Abschlagsvorschlag aus den aktuellen Formularwerten (brutto/Monat):
  //   Grundpreis(brutto) + Arbeitspreis(brutto) * Jahresverbrauch / 12.
  const berechneAbschlagVorschlag = (form: HTMLFormElement) => {
    const num = (n: string) => {
      const el = form.elements.namedItem(n) as HTMLInputElement | null;
      const v = Number(el?.value);
      return Number.isFinite(v) ? v : 0;
    };
    const sel = (n: string) => (form.elements.namedItem(n) as HTMLSelectElement | null)?.value ?? "";
    const apBrutto = berechneBrutto(num("arbeitspreisNetto"), satzProzent(sel("arbeitspreisSteuersatzId"))).bruttoBetrag;
    const gpBrutto = hatGrundpreis
      ? berechneBrutto(num("grundpreisNetto"), satzProzent(sel("grundpreisSteuersatzId"))).bruttoBetrag
      : 0;
    const verbrauch = num("angenommenerJahresverbrauchKwh");
    return Math.round((gpBrutto + (apBrutto * verbrauch) / 12) * 100) / 100;
  };

  // Bei jeder Eingabe: den Abschlag neu vorschlagen – ausser der Nutzer hat den
  // Abschlag selbst angefasst (dann bleibt sein Wert stehen).
  const onFormInput = (e: React.FormEvent<HTMLFormElement>) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    if (target.name === "abschlagBrutto") {
      setAbschlagManuell(true);
      return;
    }
    if (!abschlagManuell) setAbschlagBrutto(berechneAbschlagVorschlag(e.currentTarget));
  };

  return (
    <form
      action={formAction}
      onInput={onFormInput}
      key={`${mietpartei?.id ?? "create"}-${state.confirmUmzug ? "confirm" : state.savedNonce ?? "form"}`}
    >
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
            value={einheitId}
            onChange={(e) => beiEinheitWechsel(e.target.value)}
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
        {/* Bei Firma sind Vor-/Nachname als optionaler Ansprechpartner nutzbar
           (Briefe adressieren weiterhin die Firma). */}
        <div className="field">
          <label htmlFor="vorname">{istFirma ? "Vorname (Ansprechpartner:in, optional)" : "Vorname"}</label>
          <input
            id="vorname"
            name="vorname"
            type="text"
            defaultValue={val("vorname", mietpartei?.vorname ?? "")}
          />
        </div>
        <div className="field">
          <label htmlFor="name">{istFirma ? "Name (Ansprechpartner:in, optional)" : "Name"}</label>
          <input
            id="name"
            name="name"
            type="text"
            defaultValue={val("name", mietpartei?.name ?? "")}
            required={!istFirma}
          />
        </div>
        {/* Weitere Personen (ab Person 2): beliebig viele, je Anrede + Vor-/Nachname
           untereinander in einer eigenen Karte. Bei Firma ausgeblendet. Der Zustand
           wird als JSON in einem versteckten Feld an den Server uebergeben. */}
        {!istFirma && (
          <div style={{ gridColumn: "1 / -1" }}>
            <input type="hidden" name="weiterePersonen" value={JSON.stringify(weiterePersonen)} />
            {weiterePersonen.map((p, i) => (
              <fieldset
                key={i}
                style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: "0.5rem",
                  padding: "0.5rem 1rem 0.75rem",
                  marginBottom: "0.75rem",
                  maxWidth: "26rem",
                }}
              >
                <legend style={{ fontSize: "0.85rem", fontWeight: 600, padding: "0 0.4rem" }}>
                  {i + 2}. Person
                </legend>
                {/* Anrede, Vorname und Name untereinander (gestapelt), je Person klar gruppiert. */}
                <div className="field">
                  <label htmlFor={`wp-anrede-${i}`}>Anrede</label>
                  <select
                    id={`wp-anrede-${i}`}
                    className="select-inline"
                    style={{ width: "100%" }}
                    value={p.anrede}
                    onChange={(e) => setzePerson(i, "anrede", e.target.value)}
                  >
                    <option value="">— keine —</option>
                    <option value="HERR">Herr</option>
                    <option value="FRAU">Frau</option>
                    <option value="FAMILIE">Familie</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={`wp-vorname-${i}`}>Vorname</label>
                  <input
                    id={`wp-vorname-${i}`}
                    type="text"
                    value={p.vorname}
                    onChange={(e) => setzePerson(i, "vorname", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`wp-name-${i}`}>Name</label>
                  <input
                    id={`wp-name-${i}`}
                    type="text"
                    value={p.name}
                    onChange={(e) => setzePerson(i, "name", e.target.value)}
                  />
                </div>
                <button type="button" className="btn-small btn-danger" onClick={() => entfernePerson(i)}>
                  {i + 2}. Person entfernen
                </button>
              </fieldset>
            ))}
            <button type="button" className="btn-small" onClick={fuegePersonHinzu}>
              + Weitere Person
            </button>
          </div>
        )}
        <div className="field">
          <label htmlFor="email">E-Mail (optional)</label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={val("email", mietpartei?.email ?? "")}
            aria-describedby="email-hinweis"
          />
          <p id="email-hinweis" style={{ fontSize: "0.8rem", color: "var(--color-muted)", margin: "0.2rem 0 0" }}>
            Kann bei Interessent:innen zunächst leer bleiben. Für Login-Zugang und Rechnungsversand später nötig.
          </p>
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
            {/* „Interessent:in" nur solange die Partei noch Interessent:in ist –
               einmal aktiviert gibt es kein Zurück in den Interessenten-Status. */}
            {(mode === "create" || mietpartei?.status === "INTERESSENT") && (
              <option value="INTERESSENT">Interessent:in</option>
            )}
            <option value="AKTIV">Aktiv</option>
            <option value="INAKTIV">Inaktiv</option>
          </select>
        </div>
      </div>
      {/* Anschreiben-Variante & Ergänzungs-Bedarf werden bewusst NICHT hier,
         sondern unten bei „Vertragsunterlagen" (OnboardingPanel) gepflegt –
         und dort nur solange die Partei Interessent:in ist. */}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="anschrift">Anschrift (Straße &amp; Hausnr.)</label>
          <input
            id="anschrift"
            name="anschrift"
            type="text"
            value={anschrift}
            onChange={(e) => setAnschrift(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="anschriftPlz">PLZ</label>
          <input
            id="anschriftPlz"
            name="anschriftPlz"
            type="text"
            inputMode="numeric"
            value={anschriftPlz}
            onChange={(e) => setAnschriftPlz(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="anschriftOrt">Ort</label>
          <input
            id="anschriftOrt"
            name="anschriftOrt"
            type="text"
            value={anschriftOrt}
            onChange={(e) => setAnschriftOrt(e.target.value)}
          />
        </div>
      </div>
      <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", marginTop: 0 }}>
        Vorbelegt mit der Objektadresse – bei Bedarf anpassen (z. B. abweichende Rechnungsanschrift).
      </p>

      <div className="section" style={{ marginTop: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Bankverbindung (SEPA)</h3>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="kontoinhaber">Kontoinhaber:in (Vor- und Nachname)</label>
            <input
              id="kontoinhaber"
              name="kontoinhaber"
              type="text"
              defaultValue={val("kontoinhaber", mietpartei?.kontoinhaber ?? "")}
            />
          </div>
          <div className="field">
            <label htmlFor="iban">IBAN</label>
            <input
              id="iban"
              name="iban"
              type="text"
              autoComplete="off"
              defaultValue={val("iban", mietpartei?.iban ?? "")}
              onBlur={onIbanBlur}
              aria-describedby="iban-hinweis"
            />
            <p id="iban-hinweis" style={{ fontSize: "0.8rem", color: "var(--color-muted)", margin: "0.2rem 0 0" }}>
              Bank wird beim Verlassen des Feldes automatisch ermittelt.
            </p>
          </div>
          <div className="field">
            <label htmlFor="bankName">Bank</label>
            <input id="bankName" name="bankName" type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} />
          </div>
        </div>
      </div>

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
        <h3 style={{ marginTop: 0 }}>Angenommener Jahresverbrauch</h3>
        <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", marginTop: 0 }}>
          Der Grundversorger-Vergleich für das Anschreiben wird jetzt am <strong>Objekt</strong> gepflegt
          (gilt für alle Mietparteien) – siehe Objekt-Stammdaten.
        </p>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="angenommenerJahresverbrauchKwh">Angenommener Jahresverbrauch (kWh)</label>
            <input
              id="angenommenerJahresverbrauchKwh"
              name="angenommenerJahresverbrauchKwh"
              type="number"
              step="1"
              min="0"
              defaultValue={val(
                "angenommenerJahresverbrauchKwh",
                mietpartei?.angenommenerJahresverbrauchKwh != null
                  ? String(mietpartei.angenommenerJahresverbrauchKwh)
                  : "",
              )}
              aria-describedby="angenommenerVerbrauch-hinweis"
            />
          </div>
        </div>
        <p id="angenommenerVerbrauch-hinweis" style={{ fontSize: "0.8rem", color: "var(--color-muted)", margin: 0 }}>
          Grundlage der Abschlagskalkulation. Wird im Anschreiben genannt; die Mietpartei kann ihren tatsächlichen
          Vorjahresverbrauch nachreichen.
        </p>
      </div>

      {mode === "create" && (
        <div className="section" style={{ marginTop: "1rem", background: "var(--color-primary-tint)" }}>
          <h3 style={{ marginTop: 0 }}>Monatlicher Abschlag</h3>
          <GrossPriceInput
            label="Abschlag (€/Monat, inkl. MwSt.)"
            bruttoName="abschlagBrutto"
            steuersatzName="abschlagSteuersatzId"
            defaultSteuersatzId={val("abschlagSteuersatzId", "")}
            steuersaetze={steuersaetze}
            value={abschlagBrutto}
            onValueChange={(n) => {
              setAbschlagBrutto(n);
              setAbschlagManuell(true);
            }}
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
            {abschlagManuell ? "Manuell gesetzt. " : "Automatisch vorgeschlagen aus Preisen und Jahresverbrauch – überschreibbar. "}
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
