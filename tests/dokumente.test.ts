import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveDokumentPfad, istErlaubteDatei } from "@/lib/dokumente";

describe("resolveDokumentPfad", () => {
  const basis = path.join(process.cwd(), "data", "mietparteien");

  it("baut den Pfad im vorgesehenen Verzeichnis auf", () => {
    const p = resolveDokumentPfad("abc123", "vertrag-1700000000000.pdf");
    expect(p).toBe(path.join(basis, "abc123", "vertrag-1700000000000.pdf"));
  });

  it("wehrt Path-Traversal im Dateinamen ab", () => {
    expect(() => resolveDokumentPfad("abc123", "../../etc/passwd")).toThrow();
    expect(() => resolveDokumentPfad("abc123", "sub/dir.pdf")).toThrow();
    expect(() => resolveDokumentPfad("abc123", "..%2f.pdf")).toThrow();
  });

  it("wehrt manipulierte Mietpartei-IDs ab", () => {
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
