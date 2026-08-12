import { X, Bot, Zap, FileText, AlertOctagon, ShieldCheck, Scale, Lock } from "lucide-react";

export function AiTransparencyModal({ onClose }: { onClose: () => void }) {
  return (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 6000,
            padding: "20px",
          }}
          onClick={() => onClose()}
        >
          <div
            className="modal-card"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-light)",
              borderRadius: "var(--radius-md)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              maxWidth: "740px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "28px",
              display: "flex",
              flexDirection: "column",
              gap: "22px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border-light)", paddingBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "var(--card-highlight-bg)", border: "1px solid var(--card-highlight-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", flexShrink: 0 }}>
                  🇪🇺
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "var(--text-main)" }}>
                    Transparence IA, RGPD & Souveraineté Européenne
                  </h3>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>
                    Notice explicative claire sur les algorithmes, la protection des données et l'hébergement d'EdTemps
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="icon-btn-subtle"
                onClick={() => onClose()}
                style={{ padding: "6px 12px", fontSize: "1rem", borderRadius: "50%", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                title="Fermer la notice"
              >
                <X size={15} aria-hidden="true" />
              </button>
            </div>

            {/* Section 1 : Explications pour le grand public */}
            <div>
              <h4 style={{ margin: "0 0 10px", fontSize: "0.98rem", fontWeight: 800, color: "var(--primary-brand)", display: "flex", alignItems: "center", gap: "8px" }}>
                <Bot size={16} aria-hidden="true" /> 1. Comment et où l'IA est-elle utilisée dans EdTemps ?
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
                <div style={{ background: "var(--bg-subtle)", padding: "12px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)" }}>
                  <strong style={{ fontSize: "0.85rem", color: "var(--text-main)", display: "block", marginBottom: "4px" }}>
                    <Zap size={13} aria-hidden="true" style={{ marginRight: "4px", verticalAlign: "-2px" }} />Équilibrage des classes (Solveur Déterministe)
                  </strong>
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                    Un algorithme sous contraintes déterministe (recherche gloutonne + recuit simulé) évalue des milliers de combinaisons pour calculer 3 scénarios d'équilibrage parité/niveaux/options/AESH. Calcul 100% reproductible sans modèle génératif.
                  </p>
                </div>
                <div style={{ background: "var(--bg-subtle)", padding: "12px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)" }}>
                  <strong style={{ fontSize: "0.85rem", color: "var(--text-main)", display: "block", marginBottom: "4px" }}>
                    🇫🇷 IA Générative & Explication (Mistral AI)
                  </strong>
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                    Le modèle souverain français Mistral AI intervient exclusivement pour la génération textuelle : explications naturelles du rééquilibrage, dictée vocale de consignes et analyse OCR de documents SIECLE.
                  </p>
                </div>
                <div style={{ background: "var(--bg-subtle)", padding: "12px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)" }}>
                  <strong style={{ fontSize: "0.85rem", color: "var(--text-main)", display: "block", marginBottom: "4px" }}>
                    <FileText size={13} aria-hidden="true" style={{ marginRight: "4px", verticalAlign: "-2px" }} />OCR & Procès-Verbaux (Mistral Pixtral)
                  </strong>
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                    Mistral AI analyse les bilans de conseils de classe et extraits SIECLE scannés pour extraire automatiquement les aménagements (PAP/PPS) et avis pédagogiques.
                  </p>
                </div>
                <div style={{ background: "var(--bg-subtle)", padding: "12px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)" }}>
                  <strong style={{ fontSize: "0.85rem", color: "var(--text-main)", display: "block", marginBottom: "4px" }}>
                    <AlertOctagon size={13} aria-hidden="true" style={{ marginRight: "4px", verticalAlign: "-2px" }} />Remplacements d'enseignants
                  </strong>
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                    L'IA croise les compétences disciplinaires et les créneaux libres pour recommander immédiatement des enseignants remplaçants disponibles.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2 : Infrastructures Souveraines (Mistral AI & OVHcloud) */}
            <div>
              <h4 style={{ margin: "0 0 10px", fontSize: "0.98rem", fontWeight: 800, color: "var(--primary-brand)", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🇫🇷</span> 2. Modèles Souverains Mistral AI & Hébergement OVHcloud (100% France / UE)
              </h4>
              <div style={{ background: "var(--card-success-bg)", border: "1px solid var(--card-success-border)", padding: "14px 16px", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <ShieldCheck size={20} aria-hidden="true" style={{ color: "var(--card-success-text)" }} />
                  <div>
                    <strong style={{ fontSize: "0.88rem", color: "var(--card-success-text)", display: "block" }}>
                      Garantie de Souveraineté & Protection Anti US Cloud Act
                    </strong>
                    <span style={{ fontSize: "0.78rem", color: "var(--card-success-text)" }}>
                      EdTemps refuse tout recours aux géants américains (GAFAM : pas de Google Cloud, AWS ou Azure en production).
                    </span>
                  </div>
                </div>
                <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "0.8rem", color: "var(--card-success-text)", lineHeight: 1.5 }}>
                  <li><strong>IA Générative / OCR / Dictée</strong> : Développés et propulsés exclusivement sur l'API souveraine <strong>Mistral AI</strong> (France / UE). Aucun prompt n'est transmis hors de l'Union Européenne.</li>
                  <li><strong>Infrastructure de Production</strong> : En production, l'hébergement est assuré sur <strong>OVHcloud</strong> (Cloud souverain français certifié <em>SecNumCloud</em> par l'ANSSI et <em>HDS</em> pour les données sensibles d'Éducation).</li>
                  <li><strong>Environnement Actuel (Staging / Démo)</strong> : Cet environnement de pré-production utilise **exclusivement des données de test synthétiques et fictives**, strictement isolées de tout fichier élève réel.</li>
                </ul>
              </div>
            </div>

            {/* Section 3 : Garanties Éthiques & RGPD */}
            <div>
              <h4 style={{ margin: "0 0 10px", fontSize: "0.98rem", fontWeight: 800, color: "var(--primary-brand)", display: "flex", alignItems: "center", gap: "8px" }}>
                <Scale size={16} aria-hidden="true" /> 3. Conduite Éthique, RGPD & EU AI Act (Règlement Européen IA)
              </h4>
              <div style={{ background: "var(--card-purple-bg)", border: "1px solid var(--card-purple-border)", padding: "14px 16px", borderRadius: "var(--radius-md)", fontSize: "0.8rem", color: "var(--card-purple-text)", lineHeight: 1.5 }}>
                <div style={{ marginBottom: "6px" }}>
                  <strong>• Prise de décision humaine obligatoire (<a href="https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre3#Article22" target="_blank" rel="noopener noreferrer" style={{ color: "var(--card-purple-text)", fontWeight: 800, textDecoration: "underline" }}>Art. 22 RGPD ↗</a>) :</strong> Aucun élève n'est réaffecté automatiquement par la machine. Tous les scénarios sont délivrés à l'état de brouillon (<code>DRAFT</code>). Seule une action explicite de la direction officialise la répartition (<code>APPROVED</code>).
                </div>
                <div style={{ marginBottom: "6px" }}>
                  <strong>• Base Légale (<a href="https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre2#Article6" target="_blank" rel="noopener noreferrer" style={{ color: "var(--card-purple-text)", fontWeight: 800, textDecoration: "underline" }}>Art. 6.1.e RGPD ↗</a>) :</strong> Traitement effectué dans le cadre d'une mission d'intérêt public pour le Ministère de l'Éducation Nationale.
                </div>
                <div>
                  <strong>• Pseudonymisation par design :</strong> Les numéros INE des élèves sont instantanément hachés sous HMAC SHA-256 (<code>student-*</code>). Aucune donnée médicale brute n'est conservée.
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-light)", paddingTop: "14px", marginTop: "4px" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>
                <Lock size={12} aria-hidden="true" style={{ marginRight: "4px", verticalAlign: "-1px" }} />Traitement certifié RGPD & SecNumCloud — République Française
              </span>
              <button
                type="button"
                className="primary"
                onClick={() => onClose()}
                style={{ padding: "8px 20px", fontWeight: 800 }}
              >
                Fermer la notice
              </button>
            </div>
          </div>
        </div>
  );
}
