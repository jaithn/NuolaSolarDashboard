"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function VerbrauchsChart({ daten }: { daten: { label: string; verbrauchKwh: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={daten}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" fontSize={12} />
        <YAxis fontSize={12} unit=" kWh" />
        <Tooltip formatter={(value: number) => [`${value.toFixed(2)} kWh`, "Verbrauch"]} />
        <Bar dataKey="verbrauchKwh" fill="#0f766e" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
