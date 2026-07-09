"use client";

import { useState } from "react";
import { berechneBrutto } from "@/lib/steuer";

export interface SteuersatzOption {
  id: string;
  bezeichnung: string;
  prozentsatz: number;
}

interface PriceInputProps {
  label: string;
  nettoName: string;
  steuersatzName: string;
  defaultNetto?: number;
  defaultSteuersatzId?: string;
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
  const [steuersatzId, setSteuersatzId] = useState(defaultSteuersatzId ?? steuersaetze[0]?.id ?? "");

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
