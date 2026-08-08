# Audit complet — EdTemps (fnnktkygl-code/edtemps)
**Date de l'audit :** 8 août 2026
**Méthode :** Clonage du dépôt, lecture intégrale du code (API, front-end, moteur métier, infra), exécution de la suite de tests, build de production, tests de charge réels sur le moteur de répartition.
**Périmètre déclaré par le dépôt :** socle initial, module Répartition + brique EDT expérimentale, données strictement synthétiques, non hébergé en production, non homologué.

---

## 0. Synthèse exécutive

L'app est un **squelette d'architecture sérieux et honnête** — le README et `docs/` reconnaissent eux-mêmes les limites (pas d'auth réelle, pas de CP-SAT, pas d'hébergement homologué). C'est une bonne posture. Mais trois problèmes structurels dépassent le cadre du "c'est encore en test" et méritent correction avant toute démo à un vrai établissement :

1. **Le moteur de répartition — la fonctionnalité centrale du produit — ne tient pas la charge annoncée.** Testé en conditions réelles (voir §4), il **plante** (exception non gérée) et met **jusqu'à 2 minutes** dès 600-1200 élèves, alors que le cahier des charges promet « < 1 minute pour 1000+ élèves ».
2. **Aucune fonctionnalité n'est destinée aux enseignants.** L'app actuelle est un outil 100 % direction/administration. Le persona "Enseignant" décrit dans le prompt directeur (consultation EDT, vœux, alertes) n'existe nulle part dans le code.
3. **Le mode « démo silencieux »** : si l'API distante est indisponible ou lente (>3,5 s), le front bascule automatiquement vers des données fictives générées côté client, **sans aucun signal visuel** distinguant "vraies données du serveur" de "données de secours". Pour un outil qui va manipuler la répartition réelle d'élèves, c'est un risque de confusion sérieux.

Le reste du rapport détaille point par point.

---

## 1. Efficience et efficacité — le moteur fait-il vraiment gagner du temps ?

### 1.1 Ce qui fonctionne
- Algorithme glouton (greedy) simple et lisible pour la répartition : regroupe d'abord les élèves à contraintes fortes (séparations, PAP/PAI/PPS...), puis les assigne à la classe la moins "pénalisée" selon les poids (parité, niveau, options, dispositifs).
- Explications par élève (`explanationFor`) : chaque affectation est justifiable, conforme à l'exigence d'explicabilité du cahier des charges.
- Contrôle des contraintes dures avant toute validation (`validateAssignment`), refus d'édition manuelle si violation.
- 12 tests unitaires passent (`npm test`), le build de production passe (`npm run build`) sans erreur.

### 1.2 Ce qui ne va pas — vérifié empiriquement
J'ai fait tourner le moteur (`generateScenarios`) directement, hors interface, avec des jeux de données de tailles croissantes :

| Jeu de données | Résultat | Temps |
|---|---|---|
| 80 élèves / 4 classes (démo intégrée) | OK | 27 ms |
| 300 élèves / 10 classes | OK | 735 ms |
| 600 élèves / 20 classes | **Échec — exception non rattrapée** ("violation de contrainte dure") | 15 s avant de planter |
| 1200 élèves / 40 classes | **Échec — exception non rattrapée** | ~119 s avant de planter |

Deux problèmes distincts et cumulés :
- **Pas de scalabilité** : le temps de calcul explose bien au-delà du linéaire attendu (735 ms → 15 s → 119 s pour une multiplication par 2 puis 4 des effectifs). L'algorithme glouton pur, sans retour arrière (backtracking) ni réparation, recalcule une pénalité coûteuse à chaque étape.
- **Pas de robustesse** : à partir d'une certaine taille, l'algorithme peut se retrouver "coincé" (une classe a atteint sa capacité avant qu'un groupe compatible n'ait pu y être placé) et **lève une exception JavaScript non interceptée**, plutôt que de proposer un scénario partiel, une réparation, ou un message clair à l'adjoint("impossible de respecter X contraintes, voici où ça bloque").
- Côté API, cette exception n'est catchée nulle part dans la route `/dispatch/generate` : elle remonte au gestionnaire d'erreur global, qui renvoie un **500 avec la stack trace complète en clair au client** (voir §5.3) — en plus d'être un plantage fonctionnel, c'est une fuite d'information.

**Conséquence directe sur le KPI affiché dans le cahier des charges** ("génération d'une répartition pour 1000+ élèves en moins d'1 minute") : **non tenu en l'état**, à l'inverse — le moteur échoue purement et simplement avant ce seuil, sur des données synthétiques pourtant simples (2 options, distribution homogène). Sur un vrai collège de 600-1000 élèves avec des contraintes réelles (bien plus de séparations, plus d'options/spécialités, effectifs déséquilibrés), la situation serait probablement pire.

**Recommandation** : ne pas présenter ce moteur comme "prêt à l'échelle" avant (a) profilage et optimisation de `candidatePenalty` (actuellement recalculée en O(n) sur toute la classe à chaque candidat), (b) ajout d'un mécanisme de réparation/backtracking limité ou passage à un vrai solveur sous contraintes (CP-SAT/OR-Tools, déjà identifié comme "prochaine étape" dans `docs/architecture.md` — c'est donc su, mais pas encore fait), (c) gestion propre de l'échec côté API (422 avec message actionnable, jamais un 500 avec stack trace).

### 1.3 Module Emploi du Temps (EDT)
Le moteur de génération d'EDT (`generateSchedule`) est, lui aussi, un algorithme glouton simple (barrettes d'abord, puis cours un par un par ordre de charge horaire). Deux points à noter :
- Il n'y a **aucune tentative réelle d'optimisation des trous** (« gap ») dans l'emploi du temps des élèves/profs : les indicateurs `teacherGapScore: 85` et `studentGapScore: 90` retournés par `calculateScheduleMetrics` sont des **constantes codées en dur**, pas des calculs à partir des données. Autrement dit, l'app affiche un "score de trous" identique quel que soit l'EDT réellement généré — c'est un indicateur factice qui donnerait une fausse impression de qualité à l'utilisateur si on le mettait en avant tel quel.
- La spec produit annonçait de battre EDT (Index Education) sur ce terrain précis (§1.3 du prompt directeur : « niveau fonctionnel plancher déjà élevé »). En l'état, cette brique est une preuve de concept, pas un concurrent fonctionnel.

---

## 2. Fonctionnalités réellement utiles à un enseignant — et ce qui manque

C'est le point le plus important pour votre question, et il est net : **il n'existe aujourd'hui aucune fonctionnalité pensée pour l'enseignant "consommateur final"**, alors que le prompt directeur que vous aviez rédigé identifiait explicitement ce persona (« Enseignant : consultation de son propre EDT, demande de vœux/contraintes horaires », usage le plus fréquent de tous les personas).

Ce qui existe dans l'app aujourd'hui (3 onglets uniquement) :
1. **Répartition des classes** — usage direction/adjoint exclusivement.
2. **Emplois du temps & Remplacements** — construction de l'EDT, remplacements, OCR de fiches de vœux scannées par l'administration, commande vocale — tout est piloté par l'administratif, pas par le prof lui-même.
3. **Conformité, DPO & Homologation RGS** — usage DPO/direction.

Aucune vue "Mon emploi du temps", aucun espace de connexion enseignant, aucun formulaire d'auto-saisie de vœux/contraintes horaires par l'enseignant, aucune notification de changement de salle/créneau, aucune consultation mobile de son propre planning. Le rôle `role: text ... check (role in ('SCHOOL_ADMIN','DISPATCH_EDITOR','CPE','DPO','VIEWER'))` dans le schéma Postgres n'inclut même pas de rôle "TEACHER" à ce stade.

### Ce qui ferait vraiment gagner du temps à un enseignant (et n'existe pas encore)
- **Consultation de son EDT personnel**, à jour en temps réel, sur mobile — c'est l'usage quotidien n°1, or l'app n'a aucune mise en page adaptée mobile (voir §3.3) ni aucune vue filtrée par enseignant.
- **Auto-saisie de ses vœux/contraintes** (jours d'indisponibilité, salles préférées) directement par le prof, plutôt que par scan papier traité par l'administration — la fonctionnalité OCR existe mais elle est côté admin, pas self-service.
- **Alerte automatique** en cas de changement de créneau/salle le concernant.
- **Déclaration d'absence en 2 clics** avec proposition immédiate de remplaçant (l'algorithme de suggestion de remplacement existe déjà côté moteur — `suggestTeacherSubstitutions` — mais rien n'indique qu'un enseignant puisse le déclencher lui-même ; seul l'admin semble avoir la main).
- Pour le professeur principal : une vue de synthèse de "sa" classe pendant la phase de répartition (statistiques, alertes), alignée sur le persona documenté mais absente du code.

**En résumé : le produit actuel est un outil de "back-office direction", pas encore une plateforme au service du quotidien enseignant.** Ce n'est pas anormal pour un premier socle qui a choisi de prioriser le moteur de répartition — mais si l'angle "gain de temps pour les profs" est votre priorité produit, c'est la brique la plus vide aujourd'hui, alors que le prompt directeur la place comme l'usage le plus fréquent de tous.

---

## 3. Thème, couleurs, police, ergonomie, UX/UI

### 3.1 Direction artistique
- Palette indigo/slate classique de SaaS moderne (`--primary-brand: #4f46e5`), mode clair et sombre tous deux définis proprement via variables CSS, avec des tokens cohérents (ombres, rayons, transitions). C'est propre et professionnel visuellement — loin de l'esthétique "années 2000" reprochée à EDT/Index Education dans votre cahier des charges.
- Police : **Inter** (texte) + **Plus Jakarta Sans** (titres), chargées depuis **Google Fonts** (`fonts.googleapis.com`/`fonts.gstatic.com`).

### 3.2 Incohérence à signaler : "IA souveraine" vs dépendances externes
La meta-description de la page affirme : *« EdTemps — Plateforme d'IA souveraine pour la répartition des classes... »*. Or :
- Les polices sont chargées en direct depuis les serveurs Google (CDN Google Fonts) — chaque visiteur envoie son adresse IP à Google à chaque chargement de page. C'est le point précis que la CNIL et plusieurs juridictions européennes ont épinglé ces dernières années (transfert de données hors UE sans base légale claire). Pour un produit qui revendique la souveraineté, c'est le premier détail à corriger : héberger les fichiers de police en local (`self-hosting`) est trivial et gratuit.
- L'hébergement prévu (`docs/DEPLOYMENT.md`) est **Render.com** et **Vercel**, deux sociétés américaines, sans mention de région EU ni a fortiori France. C'est cohérent avec votre remarque ("pas encore sur OVHcloud") mais à corriger avant toute donnée réelle, pas seulement avant la commercialisation — le cahier des charges lui-même l'exige (§3, hébergement France/UE).
- Mistral AI (utilisé pour l'OCR/vocal/explication de conflits) est en revanche un choix cohérent avec la souveraineté (société française) — bon point, mais isolé.

### 3.3 Ergonomie et responsive
- **Aucune media query dans toute la feuille de style** (`grep "@media"` → 0 résultat sur 909 lignes de CSS). Le conteneur principal est fixé à `max-width: 1700px`, pensé pour un grand écran de bureau. Sur mobile, l'app ne s'adapte pas du tout, ce qui contredit directement l'exigence "mobile-friendly en consultation" du cahier des charges — un point d'autant plus important vu le constat du §2 (l'usage enseignant, le plus fréquent, sera très majoritairement mobile).
- Interface clavier : le README revendique une "interface clavier utilisable" — c'est globalement vrai (pas de suppression des focus natifs du navigateur, `role="group"`/`aria-label` présents par endroits, 17 attributs `aria-*` sur 1265 lignes), mais aucun style de focus personnalisé n'est défini, donc la visibilité du focus dépend entièrement du rendu par défaut du navigateur — à vérifier en conditions réelles sur fond sombre, où le contour bleu par défaut peut manquer de contraste.
- Le glisser-déposer (drag and drop) pour réaffecter un élève entre classes est une bonne idée UX pour un usage souris, mais un drag-and-drop pur est historiquement un point faible RGAA pour les utilisateurs clavier/lecteur d'écran — il faudra vérifier qu'une alternative non-drag (menu déroulant "déplacer vers...") est bien disponible partout où le glisser-déposer existe.

### 3.4 Confusion "données réelles / données de secours"
Déjà signalé en synthèse (§0.3) : le client (`api.ts`) bascule silencieusement sur des données générées localement dès qu'une requête échoue ou dépasse 3,5 secondes (commentaire dans le code : *"Timeout de 3.5 secondes pour éviter tout blocage UI sur Render cold-start"* — un aveu que l'hébergement gratuit Render met l'API en veille et redémarre lentement). Sur le principe, avoir un mode dégradé est une bonne pratique de résilience. Le problème est **l'absence totale d'indication visuelle** de ce basculement — l'utilisateur ne peut pas distinguer "je regarde les vraies données de mon établissement" de "je regarde un jeu de démonstration généré dans mon navigateur". Pour un outil scolaire, ce flou doit être corrigé avant tout usage avec des personnes réelles (même en test) : un simple bandeau "mode démo hors-ligne" suffirait.

---

## 4. Performance (au-delà du moteur de répartition)

- Le `npm run build` produit un bundle front-end de **197 Ko JS** (62 Ko gzippé) — c'est léger et sain pour une SPA React, bon point.
- Aucun test de charge sur l'API elle-même (nombre de requêtes/s, comportement sous charge concurrente) n'existe dans le dépôt — logique à ce stade, mais à prévoir avant tout pilote.
- Le pool de connexions PostgreSQL est limité à 10 (`max: 10`) — raisonnable pour un test pilote (2-3 établissements), à revoir avant un déploiement plus large.
- Le point noir principal reste le moteur de répartition, détaillé au §1 — c'est la partie qui déterminera la crédibilité du produit sur le critère de performance.

---

## 5. Sécurité

### 5.1 Points positifs, à souligner
- **Isolation multi-tenant par Row-Level Security PostgreSQL**, correctement implémentée : chaque connexion positionne `app.tenant_id` dans une transaction, les politiques RLS filtrent avec `using` **et** `with check` sur toutes les tables sensibles. C'est fait dans les règles de l'art.
- **Pseudonymisation HMAC-SHA256** des identifiants SIECLE avant tout traitement (`pseudonymize()` dans `siecle-import.ts`), avec contrôle de longueur minimale du secret (16 caractères) et **échec explicite** si le secret n'est pas configuré en environnement de production (`DEMO_MODE === "false"` sans secret → chaîne vide → rejet de tout import). C'est un bon réflexe "fail closed".
- Validation stricte des entrées avec Zod sur tous les endpoints qui acceptent un corps de requête.
- Aucune injection SQL détectée : toutes les requêtes Postgres utilisent des paramètres liés (`$1, $2...`), jamais de concaténation de chaîne.
- Aucun `eval`, `dangerouslySetInnerHTML` ni `innerHTML` dans le code — la surface XSS classique est nulle.
- Types de fichiers vérifiés à l'upload (extension `.zip` pour SIECLE, etc.), taille limitée à 10 Mo côté multipart.

### 5.2 Failles et lacunes à corriger avant tout pilote réel

| Problème | Gravité | Détail |
|---|---|---|
| **Rôle utilisateur figé côté client** | Élevée | `apps/web/src/api.ts` envoie systématiquement `"x-actor-role": "SCHOOL_ADMIN"` en dur, quel que soit l'utilisateur réel. Le contrôle d'accès par rôle (RBAC) présent côté API est donc **totalement inopérant** depuis l'interface actuelle : n'importe qui utilisant le front web agit avec les pleins pouvoirs "chef d'établissement". C'est acceptable en interne pour une démo technique, mais dangereux si quiconque hors de l'équipe de dev y accède avant qu'un vrai SSO/claims OIDC ne remplace ce header. |
| **Fuite de la stack trace en erreur 500** | Élevée | `app.setErrorHandler` renvoie `message` **et** `stack` bruts au client sur toute erreur non gérée (voir §1.2 pour un cas réel qui déclenche ce chemin). C'est une divulgation d'information interne (chemins de fichiers, structure du code) qui facilite la reconnaissance en cas d'attaque, et n'a rien à faire dans une réponse HTTP, même en environnement de test exposé sur Internet. |
| **Incohérence de variable d'environnement CORS** | Moyenne (fonctionnelle) | `render.yaml` définit `CORS_ORIGIN`, mais le code lit `process.env.ALLOWED_ORIGIN` (nom différent). Résultat : en déploiement réel sur Render, la variable prévue pour ouvrir le CORS au frontend Vercel **n'est jamais lue**, et l'API retombe sur son défaut `localhost` uniquement — ce qui bloquerait purement et simplement les appels du frontend déployé. À corriger avant tout déploiement, sous peine d'une démo publique qui ne fonctionne pas. |
| **Écoute réseau restreinte à `127.0.0.1`** | Moyenne à élevée (fonctionnelle) | `apps/api/src/server.ts` : `await app.listen({ port, host: "127.0.0.1" })`. Dans un conteneur Docker/déploiement cloud (Render), le service doit écouter sur `0.0.0.0` pour être joignable depuis l'extérieur du conteneur ; en le laissant sur `127.0.0.1`, le service risque de ne répondre à aucune requête externe une fois déployé (santé du service en échec côté Render). |
| **Journal d'audit non protégé contre la perte silencieuse** | Faible à moyenne | `listAuditEvents` limite la lecture à `limit 100` côté Postgres, sans pagination ni politique de rétention explicite dans le code (seulement documentée en intention dans `docs/conformite.md`). Pour un usage RGPD réel (traçabilité de décisions concernant des mineurs), il faudra une vraie politique de purge/archivage et un accès paginé complet, pas une troncature silencieuse à 100 événements. |
| **Pas de limitation de débit (rate limiting)** | Faible pour l'instant | Aucun plugin de rate-limiting sur l'API (pas de `@fastify/rate-limit`). Sans conséquence tant qu'il n'y a pas d'authentification réelle à protéger contre le bruteforce, mais à ajouter dès que l'auth OIDC/EduConnect sera branchée. |
| **En-têtes de sécurité HTTP absents** | Faible | Pas de `@fastify/helmet` ni d'en-têtes CSP/HSTS/X-Content-Type-Options configurés explicitement. À ajouter avant toute exposition publique, même en test. |

### 5.3 Tests
Seulement 185 lignes de tests au total pour ~1 700 lignes de logique métier/API et 1 265 lignes de front-end (aucun test front-end du tout). Les tests existants passent tous (12/12) et couvrent des cas utiles (import SIECLE, PRONOTE, collisions EDT), mais la couverture est clairement insuffisante pour un produit qui touchera des données d'élèves mineurs — en particulier, **aucun test ne couvre les cas de charge ou d'échec du moteur de répartition**, alors que c'est précisément là que j'ai trouvé le problème le plus grave de cet audit (§1.2). C'est révélateur : le bug de scalabilité n'aurait probablement pas pu être détecté par la suite de tests actuelle, faite uniquement sur de petits jeux de données.

---

## 6. Vie privée / RGPD

### 6.1 Ce qui est bien fait, conformément à votre cahier des charges
- Minimisation respectée dans le modèle de données : pas d'adresse, pas de détail médical, uniquement le fait qu'un dispositif (PAP/PPRE/PPS/PAI/ULIS) existe.
- Pseudonymisation systématique dès l'import SIECLE (`student-<hash>`), aucune identité en clair ne transite dans le moteur de calcul.
- Génération automatique d'un registre de traitement (JSON) et d'un template d'AIPD/DPIA en Markdown, exactement comme demandé dans le prompt directeur — bon point d'exécution fidèle au cahier des charges.
- Aucune donnée réelle n'est fournie ni attendue dans cet environnement de test (garde-fou explicite et respecté dans le code : `createSyntheticDemoInput`).
- Validation humaine obligatoire avant toute publication de scénario/EDT (`state: "DRAFT" → "APPROVED"`), avec `confirmation: true` requis explicitement dans le corps de la requête — conforme à l'exigence "pas de décision totalement automatisée sur un mineur".

### 6.2 Ce qui reste à corriger avant tout usage avec des personnes réelles
- **Google Fonts en chargement direct** (§3.2) — c'est le point le plus simple et le plus rapide à corriger : héberger les 2 polices en local supprime instantanément ce point de fuite de données vers un tiers américain.
- **Hébergement hors UE/France** pour la démo actuelle (Render + Vercel, deux entités américaines) — cohérent avec votre remarque initiale que ce n'est pas encore sur OVHcloud, donc pas une surprise, mais à traiter comme un vrai blocage avant toute donnée réelle, y compris de test avancé (pas seulement avant commercialisation).
- **Pas de bandeau/mention de cookies ou traceurs** — a priori peu de traceurs sont présents (pas d'analytics détecté dans le code), mais le chargement Google Fonts constitue en soi un contact avec un tiers qu'il faudrait documenter dans la politique de confidentialité, même a minima.
- **Le rôle "front toujours SCHOOL_ADMIN"** (§5.2) a aussi une dimension vie privée : sans distinction réelle des rôles, n'importe quel utilisateur du front voit et peut manipuler l'ensemble des données de répartition, y compris les statuts PAP/PPS/PAI qui sont les données les plus sensibles du modèle.

---

## 7. Synthèse priorisée — que corriger en premier

| Priorité | Sujet | Effort estimé |
|---|---|---|
| 1 | Le moteur de répartition plante et devient très lent au-delà de ~500 élèves — corriger avant toute démo avec un effectif réaliste | Élevé (nécessite algorithmique : réparation/backtracking ou vrai solveur CP-SAT) |
| 2 | Ne jamais renvoyer de stack trace au client (`setErrorHandler`) | Faible (quelques lignes) |
| 3 | Corriger l'incohérence `CORS_ORIGIN`/`ALLOWED_ORIGIN` et le bind `127.0.0.1` — sinon le déploiement Render/Vercel ne fonctionnera probablement pas tel quel | Faible |
| 4 | Auto-héberger les polices (retirer Google Fonts) | Très faible, à faire immédiatement |
| 5 | Afficher un indicateur visible quand l'app bascule en mode démo/hors-ligne | Faible |
| 6 | Faire correspondre le rôle envoyé par le front à un utilisateur réel (même simulé par un sélecteur en attendant l'OIDC) plutôt que de figer `SCHOOL_ADMIN` | Moyen |
| 7 | Construire une première brique orientée enseignant (consultation EDT personnel, self-service vœux) — actuellement la plus grosse absence fonctionnelle par rapport au persona le plus fréquent | Élevé (nouveau module) |
| 8 | Rendre l'interface responsive (au moins la consultation) | Moyen |
| 9 | Retirer/recalculer les métriques factices (`teacherGapScore`, `studentGapScore` codés en dur) avant de les présenter comme un indicateur de qualité | Faible à moyen |
| 10 | Étoffer les tests, en particulier des tests de charge sur le moteur de répartition | Moyen |

---

*Audit réalisé par lecture complète du code source, exécution de la suite de tests fournie (12/12 passent), build de production (réussi), et tests de charge exécutés directement sur le moteur (`generateScenarios`) avec des jeux de données synthétiques de 300 à 1200 élèves.*
