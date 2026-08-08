# Architecture de départ

```text
Navigateur (React / DSFR à intégrer)
        │ OIDC ENT / EduConnect (production)
        ▼
API métier ──► RBAC + contrôle tenant ──► PostgreSQL isolé par établissement
        │                 │
        │                 └──► journal d'audit immuable
        ▼
File de calcul (prochaine étape) ──► workers OR-Tools / CP-SAT
```

Le dépôt démarre en modulith : l'API et le moteur de contraintes sont séparés dès maintenant, sans déployer prématurément des microservices. Le moteur reste sans état et testable indépendamment ; une future file de tâches lui fournira les grands calculs asynchrones.

## Frontières de sécurité

1. Chaque requête métier porte un établissement (`x-tenant-id` en démonstration, claim OIDC en production) et l'API refuse toute discordance.
2. Les données identifiantes doivent être chiffrées et séparées du profil de calcul ; les scénarios utilisent un identifiant pseudonyme.
3. Les écritures sensibles produisent un événement d'audit ; une publication devra rester une action distincte de la validation.
4. Les environnements de dev, test et démo emploient uniquement des données synthétiques.

## Prochain incrément technique

- remplacer le dépôt mémoire par PostgreSQL, RLS et une migration contrôlée ;
- brancher un fournisseur OIDC de test, puis un adaptateur ENT ;
- isoler les calculs dans une file et remplacer/compléter l'heuristique par OR-Tools CP-SAT ;
- construire les adaptateurs SIECLE, STS-Web et PRONOTE à partir de leurs contrats effectivement obtenus ;
- ajouter les modules EDT, rétention, registre, export et opération de publication.
