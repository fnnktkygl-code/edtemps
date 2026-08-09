const METRIC_DETAILS: Record<string, { desc: string; target: string }> = {
  Parité: {
    desc: "Mesure l'équilibre entre filles et garçons dans chaque classe.",
    target: "Écart recommandé ≤ 2 élèves F/G."
  },
  Niveaux: {
    desc: "Évalue la juste mixité des moyennes scolaires.",
    target: "Écart de moyenne inter-classes ≤ 0.5 pt."
  },
  Accompagnements: {
    desc: "Contrôle la dispersion des élèves bénéficiant de PAP, PPS ou PAI.",
    target: "Max 6 accompagnements par classe."
  },
  Options: {
    desc: "Optimise le regroupement des options (LCE, Bilangue, Latin, etc.).",
    target: "Maximise les blocs de cours communs."
  }
};

export function Metric({ name, value, weight }: { name: string; value: number; weight?: number }) {
  const meta = METRIC_DETAILS[name] || { desc: "Indicateur de conformité", target: "Valeur optimale ≥ 75%" };
  const isDisabled = weight === 0;

  if (isDisabled) {
    return (
      <div>
        <dt
          className="ui-tooltip"
          data-tooltip={`${name} : Critère volontairement ignoré dans vos réglages (poids 0/10)`}
          style={{ cursor: "help", display: "inline-flex", alignItems: "center", gap: "4px" }}
        >
          <span>{name}</span>
          <span style={{ fontSize: "0.75rem", opacity: 0.6 }}>⚪</span>
        </dt>
        <dd style={{ margin: "4px 0 0", display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="metric-bar" style={{ flex: 1, minWidth: "60px", background: "var(--bg-subtle)" }} title="Critère désactivé">
            <i style={{ width: `0%`, background: "var(--text-light)" }} />
          </span>
          <strong style={{ fontSize: "0.82rem", color: "var(--text-light)", whiteSpace: "nowrap" }}>Ignoré</strong>
          <span style={{ color: "var(--text-light)", fontWeight: 700, fontSize: "0.74rem", whiteSpace: "nowrap" }}>
            (Désactivé)
          </span>
        </dd>
      </div>
    );
  }

  return (
    <div>
      <dt
        className="ui-tooltip"
        data-tooltip={`${name} (${value}%) : ${meta.desc} ${meta.target}`}
        style={{ cursor: "help", display: "inline-flex", alignItems: "center", gap: "4px" }}
      >
        <span>{name}</span>
        <span style={{ fontSize: "0.75rem", opacity: 0.6 }}>ℹ️</span>
      </dt>
      <dd style={{ margin: "4px 0 0", display: "flex", alignItems: "center", gap: "8px" }}>
        <span className="metric-bar" style={{ flex: 1, minWidth: "60px" }} title={`${value}% de conformité`}>
          <i style={{ width: `${value}%`, background: value < 60 ? "var(--rose-accent)" : value < 75 ? "var(--amber-accent)" : "var(--button-success-bg)" }} />
        </span>
        <strong style={{ fontSize: "0.85rem", whiteSpace: "nowrap", minWidth: "36px", textAlign: "right" }}>{value}%</strong>
        <span style={{ color: value < 60 ? "var(--card-error-text)" : value < 75 ? "var(--card-warning-text)" : "var(--card-success-text)", fontWeight: 800, fontSize: "0.74rem", whiteSpace: "nowrap" }}>
          {value < 60 ? "à surveiller" : value < 75 ? "moyen" : "OK"}
        </span>
      </dd>
    </div>
  );
}
