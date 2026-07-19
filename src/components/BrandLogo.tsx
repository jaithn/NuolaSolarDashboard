// Offizielles Nuola-Solar-Logo. Rendert beide Fassungen (normal + invertiert);
// im dunklen Design wird per CSS auf das invertierte Logo umgeschaltet, statt das
// dunkle Logo mit einem hellen Chip zu hinterlegen (siehe globals.css, .brand-logo).
// Reines Markup (kein Client-State), daher als Server-Komponente nutzbar.

export function BrandLogo({ variant = "header" }: { variant?: "header" | "login" }) {
  const extra = variant === "login" ? " brand-logo--login" : "";
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={`brand-logo brand-logo--light${extra}`} src="/nuola-solar-logo.png" alt="Nuola Solar" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={`brand-logo brand-logo--dark${extra}`}
        src="/nuola-solar-logo-invertiert.svg"
        alt="Nuola Solar"
        aria-hidden="true"
      />
    </>
  );
}
