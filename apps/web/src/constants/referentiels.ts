import type { Dataset } from "../types";

export const emptyDataset: Dataset = {
  establishmentId: "demo-college",
  level: "6e",
  students: [],
  classrooms: [],
  dataClassification: "SYNTHETIC_DEMO_ONLY",
};

export const SUPPORT_FLAG_TITLES: Record<string, string> = {
  PAP: "Plan d'Accompagnement Personnalisé (Dys, TDAH, troubles des apprentissages)",
  PPS: "Projet Personnalisé de Scolarisation (Situation de handicap / AESH)",
  PPRE: "Programme Personnalisé de Réussite Éducative (Soutien pédagogique renforcé)",
  PAI: "Projet d'Accueil Individualisé (Troubles de la santé / Médicaments)",
  ULIS: "Unité Localisée pour l'Inclusion Scolaire (Dispositif d'inclusion)",
};

export const OFFICIAL_NATIONAL_SUBJECTS = [
  "Français",
  "Mathématiques",
  "Histoire-Géographie & EMC",
  "Physique-Chimie",
  "SVT (Sciences de la Vie et de la Terre)",
  "Technologie",
  "Anglais (LVA / LV1)",
  "Allemand (LVB / LV2)",
  "Espagnol (LVB / LV2)",
  "Italien (LVB / LV2)",
  "Arts Plastiques",
  "Éducation Musicale",
  "EPS (Éducation Physique et Sportive)",
  "Philosophie",
  "SES (Sciences Économiques et Sociales)",
  "Sciences Numériques et Technologie (SNT)",
  "Enseignement Scientifique",
];

export const OFFICIAL_LV1_LIST = [
  { code: "LVA_ANG", label: "Anglais (LVA / LV1)" },
  { code: "LVA_ALL", label: "Allemand (LVA / LV1 - Bilangue)" },
  { code: "LVA_ARA", label: "Arabe (LVA / LV1)" },
  { code: "LVA_ESP", label: "Espagnol (LVA / LV1)" },
  { code: "LVA_POR", label: "Portugais (LVA / LV1)" },
];

export const OFFICIAL_LV2_LIST = [
  { code: "LVB_ESP", label: "Espagnol (LVB / LV2)" },
  { code: "LVB_ALL", label: "Allemand (LVB / LV2)" },
  { code: "LVB_ITA", label: "Italien (LVB / LV2)" },
  { code: "LVB_ANG", label: "Anglais (LVB / LV2)" },
  { code: "LVB_ARA", label: "Arabe (LVB / LV2)" },
  { code: "LVB_CHI", label: "Chinois (LVB / LV2)" },
  { code: "LVB_POR", label: "Portugais (LVB / LV2)" },
  { code: "LVB_RUS", label: "Russe (LVB / LV2)" },
  { code: "LVB_JAP", label: "Japonais (LVB / LV2)" },
];

export const OFFICIAL_OPTIONS_ONLY = [
  { code: "LATIN", label: "Latin (LCA - Langues & Cultures Antiquité)" },
  { code: "GREC", label: "Grec Ancien (LCA - Langues & Cultures Antiquité)" },
  { code: "LCR", label: "Langues & Cultures Régionales (Occitan, Basque, Breton, etc.)" },
  { code: "LCE", label: "LCE (Langues et Cultures Européennes)" },
  { code: "CHAM", label: "CHAM / CHAD / CHAT (Musique / Danse / Théâtre)" },
  { code: "SEL", label: "Section Européenne & Langues Orientales" },
];

export const OPTION_TITLES: Record<string, string> = {
  LVA_ANG: "LVA / LV1 : Anglais",
  LVA_ALL: "LVA / LV1 : Allemand (Bilangue)",
  LVA_ARA: "LVA / LV1 : Arabe",
  LVA_ESP: "LVA / LV1 : Espagnol",
  LVA_POR: "LVA / LV1 : Portugais",
  LVB_ESP: "LVB / LV2 : Espagnol",
  LVB_ALL: "LVB / LV2 : Allemand",
  LVB_ITA: "LVB / LV2 : Italien",
  LVB_ANG: "LVB / LV2 : Anglais",
  LVB_ARA: "LVB / LV2 : Arabe",
  LVB_CHI: "LVB / LV2 : Chinois",
  LVB_POR: "LVB / LV2 : Portugais",
  LVB_RUS: "LVB / LV2 : Russe",
  LVB_JAP: "LVB / LV2 : Japonais",
  LATIN: "Option LCA : Latin",
  Latin: "Option LCA : Latin",
  GREC: "Option LCA : Grec Ancien",
  LCR: "Option : Langue et Culture Régionale",
  BILANGUE: "Section Bilangue",
  LCE: "LCE : Langues et Cultures Européennes",
  CHAM: "CHAM : Classes à Horaires Aménagés",
  SEL: "Section Européenne et de Langues Orientales",
};
