import { ShieldCheck, RefreshCw, ScrollText, FileText } from "lucide-react";
import type { AuditEvent } from "../../types";
import { api } from "../../api";

export function ComplianceTab({
  audit,
  refreshAudit,
}: {
  audit: AuditEvent[];
  refreshAudit: () => Promise<void>;
}) {
  return (
        <section aria-labelledby="compliance-title">
          <div className="section-heading" style={{ marginBottom: "20px" }}>
            <div>
              <span className="eyebrow" style={{ color: "var(--indigo-accent)", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <ShieldCheck size={13} aria-hidden="true" /> CADRE RÉGLEMENTAIRE & HOMOLOGATION ÉDUCATION NATIONALE
              </span>
              <h2 id="compliance-title" style={{ margin: "4px 0 0", fontSize: "1.5rem", fontWeight: 800, color: "var(--text-main)" }}>
                Registre DPO, Homologation RGS (EBIOS RM) & Accessibilité RGAA
              </h2>
            </div>
            <button
              type="button"
              className="secondary"
              onClick={() => void refreshAudit()}
              style={{ padding: "8px 16px", fontWeight: 700 }}
            >
              <RefreshCw size={14} aria-hidden="true" style={{ marginRight: "5px" }} />Actualiser le registre d'audit
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", marginBottom: "28px" }}>
            {/* Carte 1 : Dossier RGPD & Protection des Mineurs */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", padding: "20px 22px", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-light)", paddingBottom: "12px" }}>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <ScrollText size={16} aria-hidden="true" /> Dossier RGPD & Traitement des Mineurs
                </h3>
                <span style={{ fontSize: "0.72rem", fontWeight: 800, background: "var(--card-highlight-bg)", color: "var(--card-highlight-text)", border: "1px solid var(--card-highlight-border)", padding: "2px 8px", borderRadius: "10px" }}>
                  Certifié RGPD
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-main)" }}>Responsable de Traitement</span>
                    <a
                      href="https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre4#Article28"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--card-info-text)", background: "var(--card-info-bg)", border: "1px solid var(--card-info-border)", padding: "2px 8px", borderRadius: "10px", textDecoration: "none" }}
                    >
                      Art. 28 RGPD ↗
                    </a>
                  </div>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                    Chef d'établissement / DASEN. L'éditeur agit exclusivement en tant que sous-traitant au sens du RGPD.
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-main)" }}>Base Légale & Non-Consentement</span>
                    <a
                      href="https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre2#Article6"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--card-info-text)", background: "var(--card-info-bg)", border: "1px solid var(--card-info-border)", padding: "2px 8px", borderRadius: "10px", textDecoration: "none" }}
                    >
                      Art. 6.1.e RGPD ↗
                    </a>
                  </div>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                    Mission d'intérêt public. Aucun consentement révocable requis pour les élèves et responsables légaux.
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-main)" }}>Minimisation Stricte des Données</span>
                    <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--card-success-text)", background: "var(--card-success-bg)", border: "1px solid var(--card-success-border)", padding: "2px 8px", borderRadius: "10px" }}>
                      HMAC SHA-256
                    </span>
                  </div>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                    Identifiants INE hachés (<code>student-*</code>). Seuls la parité, le niveau scolaire et les aménagement PAP/PPS sont traités.
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-main)" }}>Protection des Mineurs & Explicabilité</span>
                    <a
                      href="https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre3#Article22"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--card-info-text)", background: "var(--card-info-bg)", border: "1px solid var(--card-info-border)", padding: "2px 8px", borderRadius: "10px", textDecoration: "none" }}
                    >
                      Art. 22 RGPD ↗
                    </a>
                  </div>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                    Aucune décision 100% automatisée. Seule la validation humaine officialise un scénario (<code>APPROVED</code>).
                  </span>
                </div>
              </div>
            </div>

            {/* Carte 2 : Homologation RGS, EBIOS RM & RGAA */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", padding: "20px 22px", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-light)", paddingBottom: "12px" }}>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <ShieldCheck size={16} aria-hidden="true" /> Homologation RGS & Accessibilité RGAA
                </h3>
                <span style={{ fontSize: "0.72rem", fontWeight: 800, background: "var(--card-success-bg)", color: "var(--card-success-text)", border: "1px solid var(--card-success-border)", padding: "2px 8px", borderRadius: "10px" }}>
                  ANSSI & DINUM
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-main)" }}>Homologation de Sécurité RGS</span>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <a
                        href="https://www.ssi.gouv.fr/entreprise/reglementation/confiance-numerique/le-referentiel-general-de-securite-rgs/"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--card-info-text)", background: "var(--card-info-bg)", border: "1px solid var(--card-info-border)", padding: "2px 6px", borderRadius: "10px", textDecoration: "none" }}
                      >
                        RGS v2.0 ↗
                      </a>
                      <a
                        href="https://www.ssi.gouv.fr/guide/ebios-risk-manager-la-methode/"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--card-info-text)", background: "var(--card-info-bg)", border: "1px solid var(--card-info-border)", padding: "2px 6px", borderRadius: "10px", textDecoration: "none" }}
                      >
                        EBIOS RM ↗
                      </a>
                    </div>
                  </div>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                    Dossier d'analyse de risques certifié ANSSI. Chiffrement des données AES-256 au repos et TLS 1.3 en transit.
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-main)" }}>Déclaration d'Accessibilité RGAA</span>
                    <a
                      href="https://accessibilite.numerique.gouv.fr/"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--card-purple-text)", background: "var(--card-purple-bg)", border: "1px solid var(--card-purple-border)", padding: "2px 8px", borderRadius: "10px", textDecoration: "none" }}
                    >
                      RGAA AA (DINUM) ↗
                    </a>
                  </div>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                    Service numérique conforme au niveau AA (navigation clavier complète, contrastes renforcés, outlines DSFR).
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-main)" }}>Règlement Européen sur l'IA</span>
                    <a
                      href="https://digital-strategy.ec.europa.eu/fr/policies/regulatory-framework-ai"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--card-purple-text)", background: "var(--card-purple-bg)", border: "1px solid var(--card-purple-border)", padding: "2px 8px", borderRadius: "10px", textDecoration: "none" }}
                    >
                      EU AI Act ↗
                    </a>
                  </div>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                    Conformité anticipée aux exigences de transparence, d'explicabilité et d'audit pour l'IA dans l'éducation.
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "8px", paddingTop: "12px", borderTop: "1px solid var(--border-light)" }}>
                <a
                  href={api.cnilRegisterUrl()}
                  download="registre-cnil-demo-college.json"
                  style={{ flex: 1, padding: "8px 14px", fontSize: "0.8rem", fontWeight: 800, borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", background: "var(--bg-subtle)", color: "var(--text-main)", textAlign: "center", textDecoration: "none" }}
                >
                  <ScrollText size={13} aria-hidden="true" style={{ marginRight: "5px" }} />Exporter Registre CNIL (JSON)
                </a>
                <a
                  href={api.dpiaDocumentUrl()}
                  download="aipd-dpia-demo-college.md"
                  style={{ flex: 1, padding: "8px 14px", fontSize: "0.8rem", fontWeight: 800, borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", background: "var(--bg-subtle)", color: "var(--text-main)", textAlign: "center", textDecoration: "none" }}
                >
                  <FileText size={13} aria-hidden="true" style={{ marginRight: "5px" }} />Exporter Modèle AIPD (Markdown)
                </a>
              </div>
            </div>

            {/* Carte 3 : Pile Souveraine Mistral AI & OVHcloud */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", padding: "20px 22px", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-light)", paddingBottom: "12px" }}>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>🇫🇷</span> Souveraineté Numérique & Infrastructure
                </h3>
                <span style={{ fontSize: "0.72rem", fontWeight: 800, background: "var(--card-warning-bg)", color: "var(--card-warning-text)", border: "1px solid var(--card-warning-border)", padding: "2px 8px", borderRadius: "10px" }}>
                  Anti US Cloud Act
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-main)" }}>IA Multimodale & Vision</span>
                    <a
                      href="https://mistral.ai/fr/"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--amber-accent)", background: "var(--card-warning-bg)", border: "1px solid var(--card-warning-border)", padding: "2px 8px", borderRadius: "10px", textDecoration: "none" }}
                    >
                      Mistral AI (France) ↗
                    </a>
                  </div>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                    Modèles de langage et de vision (Pixtral/Voxtral) développés et hébergés exclusivement en France / Union Européenne.
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-main)" }}>Hébergement de Production</span>
                    <a
                      href="https://www.ovhcloud.com/fr/security/secnumcloud/"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--card-info-text)", background: "var(--card-info-bg)", border: "1px solid var(--card-info-border)", padding: "2px 8px", borderRadius: "10px", textDecoration: "none" }}
                    >
                      OVHcloud SecNumCloud ↗
                    </a>
                  </div>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                    Hébergeur souverain français certifié ANSSI SecNumCloud & HDS. Aucun recours aux GAFAM (pas de Google Cloud / AWS / Azure en prod).
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-main)" }}>Environnement Actuel (Staging)</span>
                    <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--text-muted)", background: "var(--bg-subtle)", padding: "2px 8px", borderRadius: "10px" }}>
                      Données Synthétiques
                    </span>
                  </div>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                    Pour cette démonstration de pré-production, les profils d'élèves sont déterministes et artificiels (100% RGPD).
                  </span>
                </div>
              </div>
            </div>
          </div>

          <section className="audit-section" aria-labelledby="audit-title" style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", padding: "20px 22px", marginTop: "24px" }}>
            <div className="section-heading" style={{ marginBottom: "14px" }}>
              <div>
                <span className="eyebrow" style={{ color: "var(--indigo-accent)", fontWeight: 800 }}>TRAÇABILITÉ LÉGALE & SÉCURITÉ</span>
                <h3 id="audit-title" style={{ margin: "4px 0 0", fontSize: "1.15rem", fontWeight: 800, color: "var(--text-main)" }}>
                  Journal d'Audit Immuable (Append-Only)
                </h3>
              </div>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>
                {audit.length} événement(s) consigné(s)
              </span>
            </div>
            {audit.length === 0 ? (
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontStyle: "italic", padding: "12px", background: "var(--bg-subtle)", borderRadius: "var(--radius-sm)", textAlign: "center" }}>
                Aucun événement enregistré dans la session en cours. Effectuez une action (génération, transfert d'élève, officialisation) pour inscrire une ligne immuable.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border-light)", textAlign: "left", color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                      <th style={{ padding: "8px 12px" }}>Horodatage</th>
                      <th style={{ padding: "8px 12px" }}>Type d'Événement</th>
                      <th style={{ padding: "8px 12px" }}>Acteur / Rôle</th>
                      <th style={{ padding: "8px 12px" }}>Détails / Scénario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map((event) => (
                      <tr key={event.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                        <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                          {new Date(event.occurredAt).toLocaleTimeString("fr-FR")}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ background: "var(--card-highlight-bg)", color: "var(--card-highlight-text)", border: "1px solid var(--card-highlight-border)", padding: "2px 8px", borderRadius: "10px", fontWeight: 800, fontSize: "0.76rem" }}>
                            {event.eventType}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-main)" }}>
                          {event.actorId}
                        </td>
                        <td style={{ padding: "10px 12px", color: "var(--text-muted)" }}>
                          {event.scenarioId ? `Scénario : ${event.scenarioId}` : "Action système"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </section>
  );
}
