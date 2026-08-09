import type { Student } from "../types";

export function nameOf(student: Student, anonymous: boolean): string {
  return anonymous ? student.initials : student.displayName;
}

export function getWeightLabel(value: number): { label: string; color: string; bg: string; border: string } {
  if (value === 0) return { label: "Ignoré (0/10)", color: "var(--text-muted)", bg: "var(--bg-subtle)", border: "1px solid var(--border-light)" };
  if (value <= 3) return { label: `Secondaire (${value}/10)`, color: "var(--card-highlight-text)", bg: "var(--card-highlight-bg)", border: "1px solid var(--card-highlight-border)" };
  if (value <= 7) return { label: `Équilibré (${value}/10)`, color: "var(--card-success-text)", bg: "var(--card-success-bg)", border: "1px solid var(--card-success-border)" };
  return { label: `Priorité Haute (${value}/10)`, color: "var(--card-purple-text)", bg: "var(--card-purple-bg)", border: "1px solid var(--card-purple-border)" };
}

export function subjectColorClass(subject: string): string {
  const norm = subject.toLowerCase();
  if (norm.includes("math")) return "math";
  if (norm.includes("français")) return "fra";
  if (norm.includes("histoire") || norm.includes("géo")) return "hg";
  if (norm.includes("physique") || norm.includes("chimie")) return "pc";
  if (norm.includes("svt")) return "svt";
  if (norm.includes("anglais")) return "ang";
  if (norm.includes("eps")) return "eps";
  return "";
}

export function getAvatarColor(id: string): string {
  // Palette corrigée : les valeurs Tailwind "500" d'origine échouaient au contraste
  // AA (4.5:1) avec des initiales blanches (ex. #f59e0b = 2.15:1, #10b981 = 2.54:1).
  // Ces teintes plus saturées passent toutes ≥ 5:1 en conservant des teintes proches.
  const colors = [
    "#7c3aed", // violet (était #8b5cf6, 4.23:1 → 5.70:1)
    "#0e7490", // cyan (était #06b6d4, 2.43:1 → 5.36:1)
    "#047857", // émeraude (était #10b981, 2.54:1 → 5.48:1)
    "#b45309", // ambre (était #f59e0b, 2.15:1 → 5.02:1)
    "#be185d", // rose (était #ec4899, 3.53:1 → 6.04:1)
    "#1d4ed8", // bleu (était #3b82f6, 3.68:1 → 6.70:1)
    "#b91c1c", // rouge (était #ef4444, 3.76:1 → 6.47:1)
    "#4f46e5", // indigo (était #6366f1, 4.47:1 → 6.29:1)
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
