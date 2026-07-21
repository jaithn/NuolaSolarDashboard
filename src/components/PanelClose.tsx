"use client";

import { createContext, useContext, useEffect } from "react";

/**
 * Kontext, über den ein Bearbeitungs-Panel (+-Menü) seinen Schließen-Callback an
 * die darin gerenderten Formulare weitergibt – ohne dass die Formulare alle
 * Props einzeln durchgereicht bekommen müssen (die RSC-Seite konstruiert das
 * Formular und übergibt es als Element; der Close-Callback kommt per Kontext).
 */
export const PanelCloseContext = createContext<(() => void) | null>(null);

/**
 * Schließt das umgebende Panel, sobald ein neues `savedNonce` eintrifft
 * (erfolgreiches Speichern). Außerhalb eines Panels (kein Provider) ein No-Op.
 */
export function useCloseOnSaved(savedNonce: string | undefined) {
  const close = useContext(PanelCloseContext);
  useEffect(() => {
    if (savedNonce) close?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedNonce]);
}
