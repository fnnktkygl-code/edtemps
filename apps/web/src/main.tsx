import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
// Auto-hébergé via @fontsource (pas de CDN Google Fonts) : évite l'envoi de
// l'IP des utilisateurs à un tiers à chaque chargement de page, cohérent
// avec la posture RGPD/CNIL déjà affichée dans l'app (voir StudentDetailModal,
// AiTransparencyModal). Poids 800 absent du fichier de police -> repli
// automatique et correct du navigateur sur 700 (Bold), pas de perte visuelle notable.
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
