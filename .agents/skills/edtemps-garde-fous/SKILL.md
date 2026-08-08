---
name: edtemps-garde-fous
description: Exige le respect absolu des garde-fous, contraintes non négociables, conformité RGPD, RGAA AA, RGS et validation humaine pour le projet EdTemps (Éducation Nationale).
---

# Skill : Garde-Fous et Exigences Non Négociables EdTemps

Ce skill définit les **règles d'or et contraintes non négociables** à respecter impérativement lors de toute modification, évolution ou audit du projet **EdTemps** (plateforme SaaS Éducation Nationale).

---

## 1. Décision Algorithmique et Supervision Humaine (Article 22 RGPD)
- **Aucune décision de répartition ni d'emploi du temps ne doit être appliquée automatiquement en production.**
- Le moteur de résolution (CP-SAT / heuristiques) **propose**, un humain habilité (Chef d'établissement / Adjoint) **valide**.
- Toute proposition algorithmique doit être **explicable en langage naturel** (explicabilité des contraintes dures satisfaites et souples pondérées).
- Les états doivent suivre le circuit strict : `DRAFT` (Brouillon) → `APPROVED` (Validé humainement).

---

## 2. Protection des Données & Minimisation (RGPD / Loi Informatique et Libertés)
- **Base Légale** : Mission d'intérêt public / obligation légale (`Art. 6.1.e RGPD`), **jamais le consentement**. Ne jamais implémenter de bandeau de consentement révocable pour les fonctionnalités cœur.
- **Responsable de Traitement** : Le chef d'établissement (2nd degré) ou le DASEN (1er degré), **l'éditeur est sous-traitant (Art. 28 RGPD)**.
- **Minimisation Stricte** : Ne collecter que le strict nécessaire (identité pseudonymisée, sexe pour la parité, niveau scolaire anonymisé, options, flags PAP/PPS/PPRE/PAI, incompatibilités relationnelles).
- **Données Médicales (PAI)** : Ne jamais stocker le contenu médical d'un PAI. Seul le flag binaire "Vigilance organisationnelle requise" est accepté pour éviter de déclencher la certification HDS.
- **Pseudonymisation des INE** : Utiliser un hachage SHA-256 HMAC avec secret d'établissement (`student-*`) pour isoler l'identité technique de l'identité civile.

---

## 3. Écosystème Institutionnel & Interopérabilité Native
- **SIECLE / STS-Web** : Les données élèves et services enseignants s'importent via les formats XML académiques (`ElevesSansAdresses.xml`, `Structures.xml`, `sts_emp.xml`). Ne jamais exiger de resaisie manuelle de données institutionnelles.
- **PRONOTE / EDT** : Conserver un connecteur d'échange JSON/CSV bidirectionnel pour permettre une adoption progressive sans rupture de la vie scolaire.
- **EduConnect / ENT (SDET)** : Authentification SSO obligatoire (CAS, SAML2, OIDC). Aucun mot de passe applicatif propre pour les élèves et représentants légaux.

---

## 4. Données de Démonstration et Environnements Hors-Production
- **Jeux Synthétiques Exclusifs** : Les environnements de démo, dev et test utilisent **exclusivement** des données synthétiques déterministes générées artificiellement. Aucune donnée réelle d'élève hors de la production.

---

## 5. Ergonomie, Accessibilité & SecNumCloud
- **RGAA Niveau AA** : Navigation au clavier complète (y compris pour le Drag & Drop), contrastes suffisants, alternatives textuelles et respect du DSFR (Design System de l'État).
- **Hébergement Souverain** : Hébergement exclusivement en France / UE sous garanties SecNumCloud (AES-256 au repos, TLS 1.3 en transit).

---

## 6. Traçabilité et Audit Immuable
- **Journal d'Audit Append-Only** : Tout événement critique (`SIECLE_IMPORTED`, `SCENARIOS_GENERATED`, `ASSIGNMENT_MOVED`, `SCENARIO_VALIDATED`, `SCHEDULE_GENERATED`, `COURSE_MOVED`, `SCHEDULE_VALIDATED`) doit inscrire un événement immuable traçant l'acteur, l'horodatage et les détails.

---

## 7. Transparence IA, Souveraineté Numérique & Maintenance du Skill
- **Modèle d'IA Français Souverain (Mistral AI)** : Les traitements génératifs et d'analyse multimodale/OCR s'appuient exclusivement sur l'API souveraine **Mistral AI** (France / UE). Aucun prompt ni donnée n'est envoyé vers des modèles tiers soumis à des juridictions extraterritoriales (ex: US Cloud Act).
- **Hébergement de Production Souverain (OVHcloud SecNumCloud)** : L'infrastructure de production est déployée sur **OVHcloud** (Hébergement souverain français certifié SecNumCloud et HDS pour la santé/Éducation). Les environnements de staging/dev doivent respecter l'isolation stricte des données synthétiques. Pas de dépendance GAFAM (Google Cloud, AWS, Azure) en production.
- **Espace de Transparence Utilisateur (Grand Public / Éducation Nationale)** : L'application doit maintenir une modale/page d'information claire ("pour le commun des mortels") expliquant explicitement le rôle de l'IA (Recuit simulé, OCR, explications), les garanties RGPD (Art. 6.1.e et 22) et l'alignement avec le règlement européen sur l'IA (EU AI Act).
- **Mise à Jour Automatique du Skill** : Dès qu'une nouvelle fonctionnalité basée sur l'IA ou un nouveau modèle est ajouté à l'application, ce fichier `SKILL.md` et la modale de transparence UI doivent être immédiatement mis à jour pour maintenir la documentation à jour.

