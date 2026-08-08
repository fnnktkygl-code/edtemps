# EdTemps

Socle initial de la plateforme de répartition des classes et de construction d'emplois du temps pour les établissements français.

Cette première itération met en œuvre le **module Répartition** : données de démonstration strictement synthétiques, moteur de scénarios sous contraintes, explications d'affectation, modifications contrôlées, piste d'audit et validation humaine explicite. L'application ne publie jamais une affectation automatiquement.

## Démarrage local

```bash
npm install
npm run dev
```

- Interface : `http://localhost:5173`
- API : `http://localhost:3001/api/health`

Les données de démonstration sont générées en mémoire ; rien ne doit être interprété comme une intégration SIECLE, ENT, EduConnect ou PRONOTE active.

## Commandes de vérification

```bash
npm test
npm run check
npm run build
```

## Périmètre livré

- modèle multi-établissement et contrôle de contexte de tenant dans l'API ;
- moteur de dispatching : capacités, séparations, regroupements et pondérations pédagogiques ;
- plusieurs scénarios, explications par élève et contrôles de faisabilité ;
- édition manuelle refusée lorsque les contraintes dures seraient violées ;
- circuit `brouillon → validé humainement`, journal d'audit append-only ;
- interface clavier utilisable, affichage anonymisé et jeu de données synthétique ;
- migration PostgreSQL de référence avec isolation par ligne (RLS).

## Limites assumées de cette itération

L'authentification ENT/EduConnect, les imports SIECLE/STS-Web, les connecteurs PRONOTE/EDT, la persistance PostgreSQL, les calculs d'emploi du temps et l'homologation de sécurité exigent des accès institutionnels, un hébergeur et une phase de réalisation dédiée. Les décisions d'architecture et les interfaces à construire sont documentées dans [`docs/`](docs/).

## Garde-fous

- Aucun jeu réel d'élèves n'est fourni ni attendu dans cet environnement.
- Le moteur fournit des propositions : seul un rôle habilité peut les valider.
- Les contrôles de tenant et de rôle sont démonstratifs en mode local. Ils devront être remplacés par les revendications OIDC signées de l'ENT en production.
