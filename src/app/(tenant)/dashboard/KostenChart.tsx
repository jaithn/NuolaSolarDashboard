"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function KostenChart({ daten }: { daten: { label: string; kostenBrutto: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={daten}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" fontSize={12} />
        <YAxis fontSize={12} unit=" €" />
        <Tooltip formatter={(value: number) => [`${value.toFixed(2)} €`, "Kosten (brutto)"]} />
        {/* Nuola Schwarz zur Abgrenzung vom kWh-Chart (Solar Gold) */}
        <Bar dataKey="kostenBrutto" fill="#1c1c21" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
