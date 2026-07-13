import { Fragment } from "react";
import { Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

// Minimaler Markdown-Renderer fuer React-PDF (Vertragstexte). Unterstuetzt
// bewusst nur die im Vertrag genutzte Teilmenge: Ueberschriften (##/###),
// Absaetze (durch Leerzeile getrennt), Aufzaehlungen (- ) und **fett** inline.

export type MarkdownBlock =
  | { typ: "h2" | "h3"; text: string }
  | { typ: "absatz"; text: string }
  | { typ: "liste"; items: string[] };

/** Zerlegt Markdown in Bloecke (Ueberschrift/Absatz/Liste). */
export function parseMarkdownBloecke(md: string): MarkdownBlock[] {
  const bloecke: MarkdownBlock[] = [];
  const zeilen = md.replace(/\r\n/g, "\n").split("\n");

  let absatz: string[] = [];
  let liste: string[] = [];

  const absatzAbschliessen = () => {
    if (absatz.length > 0) {
      bloecke.push({ typ: "absatz", text: absatz.join(" ").trim() });
      absatz = [];
    }
  };
  const listeAbschliessen = () => {
    if (liste.length > 0) {
      bloecke.push({ typ: "liste", items: liste });
      liste = [];
    }
  };

  for (const roh of zeilen) {
    const zeile = roh.trim();
    if (zeile === "") {
      absatzAbschliessen();
      listeAbschliessen();
      continue;
    }
    if (zeile.startsWith("### ")) {
      absatzAbschliessen();
      listeAbschliessen();
      bloecke.push({ typ: "h3", text: zeile.slice(4).trim() });
    } else if (zeile.startsWith("## ")) {
      absatzAbschliessen();
      listeAbschliessen();
      bloecke.push({ typ: "h2", text: zeile.slice(3).trim() });
    } else if (zeile.startsWith("# ")) {
      absatzAbschliessen();
      listeAbschliessen();
      bloecke.push({ typ: "h2", text: zeile.slice(2).trim() });
    } else if (zeile.startsWith("- ")) {
      absatzAbschliessen();
      liste.push(zeile.slice(2).trim());
    } else {
      listeAbschliessen();
      absatz.push(zeile);
    }
  }
  absatzAbschliessen();
  listeAbschliessen();
  return bloecke;
}

/** Rendert **fett**-Markierungen als Bold-Spans. */
function InlineText({ text, bold }: { text: string; bold: string }) {
  const teile = text.split(/(\*\*[^*]+\*\*)/g).filter((t) => t !== "");
  return (
    <>
      {teile.map((t, i) =>
        t.startsWith("**") && t.endsWith("**") ? (
          <Text key={i} style={{ fontFamily: bold }}>
            {t.slice(2, -2)}
          </Text>
        ) : (
          <Fragment key={i}>{t}</Fragment>
        ),
      )}
    </>
  );
}

export interface MarkdownStyles {
  h2: Style;
  h3: Style;
  absatz: Style;
  listItem: Style;
  bullet: Style;
  fontFamilyBold: string;
}

const basis = StyleSheet.create({
  listRow: { flexDirection: "row", marginBottom: 3 },
});

/** Rendert die geparsten Bloecke als React-PDF-Elemente mit den uebergebenen Styles. */
export function MarkdownBlocks({ md, styles }: { md: string; styles: MarkdownStyles }) {
  const bloecke = parseMarkdownBloecke(md);
  return (
    <>
      {bloecke.map((b, i) => {
        if (b.typ === "h2") {
          return (
            <Text key={i} style={styles.h2} wrap={false}>
              {b.text}
            </Text>
          );
        }
        if (b.typ === "h3") {
          return (
            <Text key={i} style={styles.h3} wrap={false}>
              {b.text}
            </Text>
          );
        }
        if (b.typ === "liste") {
          return (
            <View key={i}>
              {b.items.map((it, j) => (
                <View key={j} style={basis.listRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.listItem}>
                    <InlineText text={it} bold={styles.fontFamilyBold} />
                  </Text>
                </View>
              ))}
            </View>
          );
        }
        return (
          <Text key={i} style={styles.absatz}>
            <InlineText text={b.text} bold={styles.fontFamilyBold} />
          </Text>
        );
      })}
    </>
  );
}
