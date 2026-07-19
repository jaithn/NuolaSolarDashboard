import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveDokumentPfad, istErlaubteDatei } from "@/lib/dokumente";

describe("resolveDokumentPfad", () => {
  const basis = path.join(process.cwd(), "data", "kunden");

  it("baut den Pfad im vorgesehenen Verzeichnis auf (Ordner = Kundennummer)", () => {
    const p = resolveDokumentPfad("10001", "10001_Mueller_SEPA_2026-07-19.pdf");
    expect(p).toBe(path.join(basis, "10001", "10001_Mueller_SEPA_2026-07-19.pdf"));
  });

  it("wehrt Path-Traversal im Dateinamen ab", () => {
    expect(() => resolveDokumentPfad("10001", "../../etc/passwd")).toThrow();
    expect(() => resolveDokumentPfad("10001", "sub/dir.pdf")).toThrow();
    expect(() => resolveDokumentPfad("10001", "..%2f.pdf")).toThrow();
  });

  it("wehrt manipulierte Ordnerschlüssel ab", () => {
    expect(() => resolveDokumentPfad("../x", "a.pdf")).toThrow();
    expect(() => resolveDokumentPfad("a/b", "a.pdf")).toThrow();
    expect(() => resolveDokumentPfad("", "a.pdf")).toThrow();
  });
});

describe("istErlaubteDatei", () => {
  it("erlaubt PDF- und Bilddateien (case-insensitiv)", () => {
    expect(istErlaubteDatei("Vertrag.pdf")).toBe(true);
    expect(istErlaubteDatei("scan.JPG")).toBe(true);
    expect(istErlaubteDatei("foto.jpeg")).toBe(true);
    expect(istErlaubteDatei("bild.PNG")).toBe(true);
  });

  it("lehnt andere Dateitypen ab", () => {
    expect(istErlaubteDatei("schad.exe")).toBe(false);
    expect(istErlaubteDatei("makro.docx")).toBe(false);
    expect(istErlaubteDatei("ohneEndung")).toBe(false);
  });
});
