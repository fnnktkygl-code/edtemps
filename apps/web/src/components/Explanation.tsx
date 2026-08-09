import type { Scenario, Student } from "../types";

export function Explanation({ student, scenario }: { student: Student; scenario: Scenario }) {
  const explanation = scenario.explanations[student.id];
  if (!explanation) return null;
  return (
    <div className="explanation-box">
      <h4 style={{ margin: "4px 0 2px", fontSize: "0.86rem", fontWeight: 800, color: "var(--text-main)" }}>
        💡 Explication de l'Affectation
      </h4>
      {explanation.hardConstraints.map((value) => (
        <div key={value} className="explanation-item hard-ok">
          <span style={{ fontWeight: 800 }}>✓</span>
          <span>{value}</span>
        </div>
      ))}
      {explanation.softConsiderations.map((value) => (
        <div key={value} className="explanation-item soft-info">
          <span style={{ fontWeight: 800 }}>↗</span>
          <span>{value}</span>
        </div>
      ))}
    </div>
  );
}
