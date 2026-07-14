"use client";

import { useState } from "react";
import { berechneBrutto, berechneNettoAusBrutto } from "@/lib/steuer";

export interface SteuersatzOption {
  id: string;
  bezeichnung: string;
  prozentsatz: number;
}

interface PriceInputProps {
  label: string;
  nettoName: string;
  steuersatzName: string;
  defaultNetto?: number | null;
  defaultSteuersatzId?: string | null;
  steuersaetze: SteuersatzOption[];
  required?: boolean;
}

/**
 * MwSt.-transparente Preiseingabe: Netto-Betrag + Steuersatz-Auswahl, daneben
 * live berechnet MwSt.-Betrag und Brutto-Summe (siehe Auftrag: Netto,
 * Steuersatz, MwSt.-Betrag und Brutto müssen einzeln sichtbar sein).
 */
export function PriceInput({
  label,
  nettoName,
  steuersatzName,
  defaultNetto,
  defaultSteuersatzId,
  steuersaetze,
  required,
}: PriceInputProps) {
  const [netto, setNetto] = useState(defaultNetto ?? 0);
  // Bewusst `||` statt `??`: Im Anlege-Modus kommt defaultSteuersatzId als leerer
  // String (nicht null/undefined) herein - der soll ebenfalls auf den ersten
  // (aktuellsten) Steuersatz zurueckfallen, sonst bliebe kein Satz gewaehlt und
  // die MwSt.-Berechnung ergaebe faelschlich 0.
  const [steuersatzId, setSteuersatzId] = useState(defaultSteuersatzId || steuersaetze[0]?.id || "");

  const prozentsatz = steuersaetze.find((s) => s.id === steuersatzId)?.prozentsatz ?? 0;
  const { steuerBetrag, bruttoBetrag } = berechneBrutto(Number.isFinite(netto) ? netto : 0, prozentsatz);

  return (
    <div className="field">
      <label>{label}</label>
      <div className="price-input-row">
        <input
          type="number"
          step="0.01"
          name={nettoName}
          required={required}
          value={netto}
          onChange={(e) => setNetto(Number(e.target.value))}
        />
        <select name={steuersatzName} value={steuersatzId} onChange={(e) => setSteuersatzId(e.target.value)}>
          {steuersaetze.map((s) => (
            <option key={s.id} value={s.id}>
              {s.bezeichnung} ({s.prozentsatz}%)
            </option>
          ))}
        </select>
      </div>
      <div className="price-breakdown">
        Netto {netto.toFixed(2)} € · MwSt. {prozentsatz}% = {steuerBetrag.toFixed(2)} € · Brutto{" "}
        <strong>{bruttoBetrag.toFixed(2)} €</strong>
      </div>
    </div>
  );
}

interface GrossPriceInputProps {
  label: string;
  bruttoName: string;
  steuersatzName: string;
  defaultBrutto?: number | null;
  defaultSteuersatzId?: string | null;
  steuersaetze: SteuersatzOption[];
  required?: boolean;
}

/**
 * Preiseingabe als BRUTTO-Betrag (inkl. MwSt.) + Steuersatz-Auswahl - fuer
 * Betraege, die brutto erfasst werden (z.B. der monatliche Abschlag, der genau
 * so per SEPA eingezogen und im Vertrag genannt wird). Netto/MwSt. werden live
 * abgeleitet und angezeigt.
 */
export function GrossPriceInput({
  label,
  bruttoName,
  steuersatzName,
  defaultBrutto,
  defaultSteuersatzId,
  steuersaetze,
  required,
}: GrossPriceInputProps) {
  const [brutto, setBrutto] = useState(defaultBrutto ?? 0);
  const [steuersatzId, setSteuersatzId] = useState(defaultSteuersatzId || steuersaetze[0]?.id || "");

  const prozentsatz = steuersaetze.find((s) => s.id === steuersatzId)?.prozentsatz ?? 0;
  const bruttoWert = Number.isFinite(brutto) ? brutto : 0;
  const netto = berechneNettoAusBrutto(bruttoWert, prozentsatz);
  const steuerBetrag = Math.round((bruttoWert - netto) * 100) / 100;

  return (
    <div className="field">
      <label>{label}</label>
      <div className="price-input-row">
        <input
          type="number"
          step="0.01"
          name={bruttoName}
          required={required}
          value={brutto}
          onChange={(e) => setBrutto(Number(e.target.value))}
        />
        <select name={steuersatzName} value={steuersatzId} onChange={(e) => setSteuersatzId(e.target.value)}>
          {steuersaetze.map((s) => (
            <option key={s.id} value={s.id}>
              {s.bezeichnung} ({s.prozentsatz}%)
            </option>
          ))}
        </select>
      </div>
      <div className="price-breakdown">
        Brutto <strong>{bruttoWert.toFixed(2)} €</strong> · davon MwSt. {prozentsatz}% = {steuerBetrag.toFixed(2)} € ·
        Netto {netto.toFixed(2)} €
      </div>
    </div>
  );
}
