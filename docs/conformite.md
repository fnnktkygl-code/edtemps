# Décisions de conformité intégrées au socle

| Sujet | Décision dans ce dépôt | Suite indispensable avant production |
|---|---|---|
| Décision algorithmique | Scénario à l'état `DRAFT`, validation humaine obligatoire | workflow de relecture, publication distincte et preuve d'habilitation OIDC |
| Données de démonstration | Générateur déterministe et fictif | contrôles CI empêchant les exports réels hors production |
| Minimisation | Pas d'adresse, de santé détaillée ni de données familiales | registre de traitement et AIPD adaptés avec le DPO responsable |
| Pseudonymisation | Identifiant fonctionnel `student-*` uniquement dans le moteur | chiffrement et mapping INE séparé en production |
| Audit | Événements append-only dans le dépôt mémoire et table SQL prévue | scellement, rétention, supervision et procédure incident |
| Authentification | En-têtes de démonstration clairement isolés | SSO ENT/EduConnect, MFA privilèges, RBAC avec claims signés |
| Accessibilité | HTML sémantique, commandes au clavier, messages live | intégration DSFR, audit RGAA complet et déclaration publiée |

Ce document est une trace de conception, pas une AIPD, une homologation RGS ou un avis juridique. Ces livrables doivent être co-construits avec le responsable de traitement, le DPO, la DSI et l'hébergeur retenu.
