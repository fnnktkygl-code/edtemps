# Directive et Règles Projets — EdTemps Éducation Nationale

Chaque agent travaillant dans le dépôt **EdTemps** doit respecter en permanence les règles et garde-fous ci-dessous :

1. **Validation Humaine Obligatoire** : Les algorithmes de répartition et d'emplois du temps ne prennent aucune décision finale automatique. L'application propose des scénarios `DRAFT`, un humain habilité les valide (`APPROVED`).
2. **Conformité RGPD "Privacy by Design"** :
   - Pseudonymisation stricte des identifiants (INE -> SHA-256 HMAC `student-*`).
   - Aucune donnée de santé brute (PAI) ni donnée familiale hors minimisation.
   - Base légale : mission d'intérêt public (`Art. 6.1.e RGPD`), pas de bandeau de consentement révocable sur le cœur de métier.
3. **Données de Test Synthétiques** : Interdiction d'utiliser ou d'importer des données d'élèves réelles en environnement dev/test/demo.
4. **Accessibilité & Ergonomie** : Respect de la conformité **RGAA AA** et intégration des principes du **DSFR (Système de Design de l'État)**.
5. **Traçabilité** : Tout événement modifiant l'état d'un scénario ou publiant une donnée produit un événement d'audit append-only.
6. **Transparence IA, Souveraineté Européenne & Mises à Jour Continues des Skills** :
   - **Mises à jour des Skills & Docs** : Toute nouvelle fonctionnalité ou évolution de l'IA doit être répercutée dans l'espace de transparence UI et dans le skill `.agents/skills/edtemps-garde-fous/SKILL.md`.
   - **Pile IA & Infrastructure** : L'IA générative/multimodale s'appuie exclusivement sur **Mistral AI** (modèle souverain français/UE). L'hébergement de production est assuré sur la souveraineté **OVHcloud** (certifié SecNumCloud / HDS, à l'abri de l'US Cloud Act ; aucun recours aux GAFAM comme Google Cloud/AWS/Azure en production).
   - **Transparence & RGPD** : Un panneau clair et accessible ("pour le commun des mortels") doit expliquer l'utilisation de l'IA, le respect du RGPD (Art. 6.1.e et 22) et du futur Règlement Européen sur l'IA (EU AI Act).
7. **Commandes de Vérification** : Avant de déclarer toute tâche terminée, exécuter `npm test`, `npm run check` et `npm run build`.
