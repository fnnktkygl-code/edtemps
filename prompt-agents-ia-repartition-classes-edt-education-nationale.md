# PROMPT DIRECTEUR POUR AGENTS IA
## Conception & développement d'une plateforme EdTech de répartition des classes et de génération d'emplois du temps — destinée à l'Éducation nationale française

**Version :** 1.0
**Usage :** À copier-coller (en totalité ou section par section) comme prompt système / cahier des charges pour piloter une équipe d'agents IA de développement (ex. Claude Code, agents multi-rôles) sur l'ensemble du cycle de vie du projet : cadrage, architecture, développement, sécurité, conformité, tests, documentation.

---

## COMMENT UTILISER CE DOCUMENT

Ce document est conçu pour être injecté tel quel comme **prompt système** à une équipe d'agents IA. Il peut aussi être découpé et injecté **section par section** au fil des sprints (ex. Section 5 pour l'agent en charge du module Répartition, Section 6 pour l'agent en charge du module Emploi du temps, Section 3 pour l'agent conformité/RGPD).

Trois règles doivent gouverner **tout** le travail des agents, à rappeler dans chaque sous-tâche :

1. **La conformité n'est jamais une option ni une étape finale.** Elle est conçue *dans* l'architecture dès le premier commit (« privacy by design », « security by design »). Un agent qui doit choisir entre rapidité de livraison et conformité RGPD/sécurité choisit la conformité.
2. **Aucune décision algorithmique ne doit être totalement automatisée sans supervision humaine** lorsqu'elle affecte un mineur (répartition de classe, emploi du temps). Le produit *propose*, un humain habilité *valide*.
3. **Le produit s'insère dans un écosystème existant** (ENT, GAR, EduConnect, SIECLE, PRONOTE/EDT) — il ne le remplace pas et ne doit jamais imposer une resaisie de données déjà détenues par l'institution.

---

## 1. CONTEXTE PRODUIT ET VISION

### 1.1 Pitch
Concevoir une plateforme SaaS moderne, cloud-native, destinée aux établissements scolaires publics et privés sous contrat (collèges, lycées, et par extension écoles primaires) qui couvre deux irritants majeurs et chronophages de la gestion d'établissement :

1. **La constitution et le rééquilibrage des classes** (plusieurs centaines à plus d'un millier d'élèves), aujourd'hui réalisées majoritairement à la main ou sur tableurs Excel bricolés, avec un travail combinatoire manuel qui prend des dizaines d'heures chaque été et à chaque conseil de classe de rééquilibrage.
2. **La génération des emplois du temps** de l'établissement, un problème d'optimisation sous contraintes combinatoire classique en recherche opérationnelle (NP-difficile), aujourd'hui dominé par un logiciel installé historique (**EDT d'Index Education**, cf. § 1.3) dont l'UX date des années 2000 malgré des mises à jour fonctionnelles régulières.

### 1.2 Proposition de valeur différenciante
- **Cloud, collaboratif, temps réel** (vs logiciels installés mono-poste ou serveur local Windows).
- **UX moderne** pensée pour un utilisateur non technicien (chef d'établissement, adjoint, CPE, professeur principal), avec des temps de prise en main courts.
- **Explicabilité** : chaque proposition algorithmique (classe, créneau) est justifiable et modifiable, jamais une boîte noire.
- **Conformité native** à l'écosystème institutionnel français (GAR, EduConnect, ENT/SDET, SIECLE) — pas un silo de plus.
- **Mobile-friendly en consultation**, desktop-first pour les tâches de construction complexes.

### 1.3 Référence du marché à connaître et à dépasser
- **EDT (Index Education)** est aujourd'hui le logiciel de référence historique pour la génération d'emplois du temps en collège/lycée en France, utilisé depuis 1985 et couplé à **PRONOTE** (vie scolaire, notes, absences) du même éditeur. Les versions récentes intègrent déjà : répartition assistée des élèves dans les classes, prise en compte du harcèlement dans la composition des classes (séparation d'élèves), gestion des groupes de spécialité/besoin, gestion ULIS, salles préférentielles, remplacements, connexion directe à la base PRONOTE.
- Cela signifie que **le niveau fonctionnel plancher est déjà élevé** : l'agent ne doit pas concevoir un produit « MVP simpliste » mais un produit qui égale ce périmètre fonctionnel dès le départ sur les deux modules ciblés, avec une **UX et une architecture cloud/collaborative largement supérieures** (le point faible historique d'EDT est son ergonomie datée, son mode mono-poste/serveur local, l'absence de collaboration temps réel et de mobilité).
- Autres acteurs de l'écosystème à connaître pour le positionnement concurrentiel et l'interopérabilité : **PRONOTE** (vie scolaire dominante en France), les **ENT régionaux** (ENT mBN, NEO, ENT HDF, L'Educ de Normandie, ENT One, Beneylu, etc. — hétérogènes par académie/collectivité), et pour le supérieur/CFA **PRONOTE Campus** (ex-Hyperplanning).
- Un agent chargé du benchmark doit produire un tableau comparatif fonctionnel détaillé (import/export, algorithmes, UX, tarifs, intégrations) avant la phase de conception détaillée.

### 1.4 Marché cible et mode de vente
- Cible primaire : collèges et lycées publics et privés sous contrat (EPLE — Établissements Publics Locaux d'Enseignement), écoles primaires en cible secondaire.
- Le produit devra à terme pouvoir être référencé pour être éligible aux marchés publics (achats académiques, mutualisation via **UGAP** ou centrales d'achat régionales) : cela impose une **homologation de sécurité** et une conformité documentaire complète *avant* toute commercialisation réelle (voir Section 3 et Section 13).
- **Note de prudence commerciale** : les seuils de dispense de publicité/mise en concurrence pour les marchés publics de fournitures et services (dont les marchés innovants) évoluent régulièrement par décret. Ne pas figer de seuil chiffré précis dans la documentation produit sans vérification à la date de commercialisation effective — se référer systématiquement à la version en vigueur sur Légifrance/le Code de la commande publique au moment du go-to-market plutôt qu'à une valeur potentiellement déjà obsolète.

---

## 2. UTILISATEURS CIBLES ET PERSONAS

Les agents doivent concevoir chaque écran en gardant ces personas à l'esprit, classés par fréquence d'usage et niveau de privilège :

| Persona | Rôle | Usage principal | Niveau d'habilitation |
|---|---|---|---|
| **Chef d'établissement / Principal / Proviseur** | Responsable de traitement RGPD, décideur final | Validation finale des répartitions et EDT, arbitrages | Admin établissement |
| **Adjoint(e) de direction / Directeur des études** | Opérationnel principal | Construction quotidienne des répartitions et EDT | Éditeur complet |
| **CPE (Conseiller Principal d'Éducation)** | Vie scolaire, gestion des conflits élèves | Signalement d'incompatibilités, suivi disciplinaire lié à la répartition | Éditeur restreint (module élèves) |
| **Professeur principal** | Référent pédagogique de classe | Consultation, remontée de vœux/alertes sur profils d'élèves | Lecture + contribution encadrée |
| **Enseignant** | Utilisateur final consommateur | Consultation de son propre EDT, demande de vœux/contraintes horaires | Lecture seule + formulaire de vœux |
| **Secrétariat / Gestionnaire scolarité** | Import/export de données | Import SIECLE, export vers PRONOTE/ENT | Éditeur données (pas de décision pédagogique) |
| **DPO de l'académie / de l'établissement** | Conformité | Audit, registre de traitement, gestion des demandes de droits | Accès conformité (pas les données pédagogiques elles-mêmes sauf nécessité) |
| **DSI académique / rectorat / DANE** | Déploiement technique, homologation | Validation technique, SSO, hébergement | Accès technique/administration |
| **Parent / Élève (V2, lecture seule)** | Consultation | Consultation de l'EDT et de l'affectation de classe via l'ENT | Lecture seule via SSO EduConnect |

**Exigence UX transverse** : l'outil doit être utilisable en autonomie par un chef d'établissement ou un adjoint **sans formation technique préalable**, avec un objectif de prise en main en moins de 30 minutes (à valider par tests d'utilisabilité, cf. Section 12).

---

## 3. CADRE RÉGLEMENTAIRE ET EXIGENCES DE CONFORMITÉ — NON NÉGOCIABLES

> Instruction aux agents : traiter chaque point ci-dessous comme une **exigence fonctionnelle de premier rang**, au même titre qu'une fonctionnalité métier. Toute fonctionnalité qui entre en conflit avec un point de cette section doit être reconçue, pas contournée.

### 3.1 RGPD et Loi Informatique et Libertés
- **Responsable de traitement** : dans l'Éducation nationale, c'est le **chef d'établissement** (second degré) ou le **DASEN** (premier degré) qui porte la responsabilité juridique du traitement — jamais l'éditeur du logiciel, qui est **sous-traitant** au sens RGPD (Article 28). L'architecture contractuelle (CGU, DPA/clause de sous-traitance) doit refléter cela explicitement.
- **Base légale** : la mission d'intérêt public / obligation légale de l'établissement scolaire, **jamais le consentement** (un parent ne peut pas « refuser » l'inscription scolaire, donc le consentement ne serait pas libre). Ne jamais implémenter de bandeau de consentement RGPD classique pour les fonctionnalités cœur du produit.
- **Minimisation des données** : ne collecter strictement que ce qui est nécessaire au calcul de répartition/EDT. Concrètement, l'outil **n'a pas besoin** de la profession des parents, du quotient familial, des revenus, de la situation matrimoniale, etc. Il doit se limiter à : identité pseudonymisable, sexe (pour la parité), niveau scolaire (moyennes anonymisées si possible), LV/options/spécialités, statut PAP/PPRE/PPS/PAI/ULIS/AESH (uniquement le fait qu'un accompagnement existe et son impact organisationnel — jamais le détail médical), signalements d'incompatibilité entre élèves.
- **DPO** : prévoir une interface dédiée pour le DPO de l'établissement/académie (registre des traitements pré-rempli, export de la documentation de conformité, statistiques d'accès).
- **AIPD/DPIA obligatoire** : la CNIL considère qu'un traitement algorithmique de données concernant des mineurs présente en principe un risque justifiant une **Analyse d'Impact relative à la Protection des Données** (Article 35 RGPD), en particulier lorsqu'il repose sur un système d'aide à la décision automatisée. **Les agents doivent livrer un template d'AIPD pré-rempli avec le produit** (description du traitement, finalités, base légale, mesures de minimisation, analyse des risques), utilisable tel quel par chaque établissement client.
- **Violation de données** : implémenter un processus technique et procédural de détection et notification sous 72h à la CNIL en cas de risque (Article 33/34), avec journal d'incident intégré à l'outil d'administration.
- **Durées de conservation** : configurables par l'établissement mais avec des valeurs par défaut raisonnables proposées (ex. brouillons de répartition purgés en fin d'année scolaire + 1 an sauf archivage légal explicite ; historique de conflits élèves purgé selon la durée de scolarité de l'établissement). S'appuyer sur les guides pratiques CNIL dédiés à l'Éducation nationale (guides « violations de données » et guide DPO Réseau Canopé) plutôt que d'inventer un référentiel propre.
- **Droits des personnes** : portail de demande d'accès/rectification/opposition, avec procédure documentée (le titulaire des droits pour un mineur est en général le représentant légal).
- **Argument produit lié à la conformité** : aujourd'hui, en l'absence d'outil adapté, de nombreux établissements gèrent les informations comportementales (conflits, harcèlement) via des tableurs Excel officieux non déclarés, échangés entre CPE/direction/professeurs principaux — une pratique qui constitue en elle-même un risque juridique vis-à-vis de la CNIL (traitement de données sensibles hors registre). Le produit doit explicitement se positionner comme la solution qui **supprime ce risque** en offrant un module déclaré, sécurisé et traçable pour ces informations, avec accès restreint aux seules personnes habilitées (direction, CPE).

### 3.2 Décision algorithmique et protection des mineurs (Article 22 RGPD)
- Le RGPD encadre strictement les décisions **entièrement automatisées** produisant des effets significatifs sur une personne, a fortiori un mineur. Le produit doit donc respecter un principe absolu : **aucune répartition de classe ni aucun emploi du temps n'est appliqué sans validation humaine explicite** par une personne habilitée. L'algorithme **propose**, il ne **décide** jamais seul en production.
- Chaque proposition algorithmique doit être **explicable** : afficher pour chaque affectation les contraintes satisfaites/violées et leur pondération, jamais un score opaque sans justification.
- Prévoir un **historique d'audit** : qui a validé, quand, quelles modifications manuelles ont été apportées par rapport à la proposition initiale de l'algorithme.
- Étant donné le déséquilibre de pouvoir structurel entre l'élève/la famille et l'institution scolaire, ne jamais mettre en place de mécanisme qui laisserait croire à un consentement libre de l'élève à un traitement automatisé.

### 3.3 GAR — Gestionnaire d'Accès aux Ressources
- Le GAR est le traitement national porté par le ministère qui sécurise l'accès aux ressources numériques pédagogiques via l'ENT, en filtrant les données personnelles transmises aux éditeurs selon des principes de proportionnalité et de minimisation, sous cadre juridique validé par la CNIL.
- Le produit n'a pas vocation à se substituer au GAR, mais doit s'inscrire dans ce cadre de confiance : si le produit doit un jour distribuer une ressource pédagogique via l'ENT, il doit passer par le référencement GAR plutôt que réinventer un circuit de distribution de données.
- Pour les deux modules ciblés (répartition, EDT), le GAR n'est pas le connecteur principal (c'est plutôt SIECLE/ENT/EduConnect, voir ci-dessous) mais les agents doivent connaître son existence et ne jamais créer un mécanisme de partage de données concurrent qui contournerait ce filtre lorsque des ressources tierces sont en jeu.

### 3.4 EduConnect / FranceConnect — authentification obligatoire
- **Aucun mot de passe propre à l'application** pour les élèves et les représentants légaux : l'authentification doit se faire via **EduConnect** (guichet national d'authentification, articulé avec **FranceConnect** pour les parents) ou via le SSO de l'**ENT** de l'établissement.
- Pour les personnels (enseignants, direction), l'authentification doit s'appuyer sur l'**identifiant académique** transmis par l'ENT (ex-ATEN), et non sur un compte applicatif isolé.
- Concrètement : implémenter le produit comme une **application intégrée à l'ENT** (widget/lien SSO) plutôt que comme une application autonome avec son propre système de comptes. Cela conditionne l'adoption et la conformité SDET (voir 3.5).

### 3.5 ENT et SDET (Schéma Directeur des Espaces numériques de Travail)
- Le SDET (version en vigueur : millésime 2024/2025) définit l'architecture de référence, les principes fonctionnels, de sécurité et d'interopérabilité que doit respecter toute solution s'intégrant à un ENT. Il est désormais articulé avec la **doctrine technique du numérique pour l'éducation** et un **cadre général de sécurité** propre au secteur.
- Exigences techniques concrètes à implémenter :
  - **SSO standard** : CAS, SAML 2.0 et/ou OpenID Connect (les ENT historiques utilisent majoritairement CAS ; prévoir la compatibilité des deux protocoles pour couvrir le parc hétérogène d'ENT régionaux).
  - **Annuaire ENT** : consommer les schémas d'annuaire normalisés (LDAP ENT1D/ENT2D définis en annexe du SDET) plutôt que de définir un schéma d'utilisateurs propriétaire.
  - **Respect du référentiel d'interopérabilité des services numériques pour l'éducation** et du **référentiel du numérique responsable pour l'éducation** (éco-conception, sobriété numérique — pertinent aussi pour l'argumentaire commercial).
  - Le produit doit pouvoir être packagé comme un **connecteur/widget ENT** référencé auprès des éditeurs d'ENT régionaux, pas comme un portail parallèle.

### 3.6 Sécurité — Référentiel Général de Sécurité (RGS) et doctrine technique
- Toute solution numérique utilisée par une administration publique française (dont les EPLE) doit viser une **homologation de sécurité** conforme au RGS, avec analyse de risques (méthode EBIOS RM recommandée), avant toute mise en production réelle.
- Un dossier d'homologation doit être livré par les agents en parallèle du produit (voir Section 13), incluant : cartographie des risques, mesures de sécurité mises en œuvre, résultats d'audit/pentest, plan de traitement des vulnérabilités résiduelles.
- Pour la trajectoire d'hébergement et la qualification **SecNumCloud**, voir le détail en Section 3.8 — c'est un chantier structurant à anticiper dès l'architecture initiale, même s'il n'est pas juridiquement obligatoire pour un premier déploiement en EPLE isolé.

### 3.7 Accessibilité numérique — RGAA
- Obligation légale pour tout service numérique à destination du service public : conformité au **RGAA** (Référentiel Général d'Amélioration de l'Accessibilité), niveau **AA minimum**, incluant navigation clavier complète, compatibilité lecteurs d'écran, contrastes suffisants, alternatives textuelles, formulaires accessibles. Une déclaration d'accessibilité doit être publiée et tenue à jour.
- Recommandation forte : s'appuyer sur le **DSFR (Système de Design de l'État français)** — le design system officiel des services publics numériques français — pour la base de composants d'interface (boutons, formulaires, tableaux, navigation), qui embarque nativement la conformité RGAA et une identité visuelle institutionnelle reconnaissable et rassurante pour des utilisateurs du service public. Cela accélère aussi l'acceptabilité côté rectorat/collectivités.

### 3.8 Hébergement des données

**Niveau socle (exigible dès le premier déploiement) :**
- Hébergement exclusivement en **France ou Union européenne**, chez un hébergeur soumis exclusivement au droit européen (attention au risque Cloud Act américain / Section 702 FISA pour tout hébergeur américain, même avec un datacenter physiquement situé en Europe).
- Chiffrement systématique **au repos (AES-256)** et **en transit (TLS 1.3)**.
- Sauvegardes chiffrées, redondantes géographiquement en Europe, avec plan de reprise et de continuité d'activité (PRA/PCA) testé.
- Cloisonnement locataire strict (tenant isolation) et authentification multifacteur systématique pour tout accès à privilèges (administration technique, direction).

**Trajectoire cible — qualification SecNumCloud (ANSSI) :**
- La qualification **SecNumCloud**, dans sa version **3.2** (ANSSI), n'est pas une obligation légale automatique pour un SaaS vendu directement à des EPLE isolés — elle vise en priorité les administrations centrales et, par capillarité, les Opérateurs d'Importance Vitale. **Mais elle devient de fait un standard attendu par de nombreux rectorats et collectivités** pour les nouveaux marchés numériques sensibles, et constitue un avantage concurrentiel décisif pour un positionnement B2G à moyen terme. Elle doit être anticipée dans les choix d'architecture dès le départ (hébergeur éligible, cloisonnement, IAM) même si elle n'est pas visée dès la V1.
- Exigences clés du référentiel 3.2, vérifiées : siège social, centre décisionnel et infrastructure technique **exclusivement dans l'UE** ; capital et droits de vote détenus par des entités hors UE plafonnés à **24 % individuellement et 39 % collectivement**, sans droit de veto ni majorité au conseil de direction pour ces entités ; authentification multifacteur obligatoire ; chiffrement conforme aux référentiels ANSSI ; gestion des risques structurée (virtualisation, sous-traitance, cloisonnement).
- Hébergeurs qualifiés ou en cours de qualification à surveiller : OVHcloud (zones SecNumCloud), Outscale, Numspot, Wimi (SecNumCloud + HDS), et les offres de type Bleu (Capgemini/Orange/Microsoft) ou S3NS (Thales/Google) qui visent la qualification en restant sous le seuil des 24 %.
- **Veille recommandée** : le futur schéma européen **EUCS** (European Union Cybersecurity Certification Scheme) doit à terme s'articuler avec SecNumCloud, voire s'y substituer partiellement — à surveiller sur l'horizon du projet plutôt qu'à figer dans l'architecture actuelle.

**Cas particulier — données de santé (PAI) et certification HDS :**
- Si le produit venait à stocker des **données médicales détaillées** issues des PAI (nature de l'allergie, traitement, posologie, etc.), l'hébergement devrait alors répondre à la certification **HDS (Hébergeur de Données de Santé)**, un régime plus lourd que le RGS/SecNumCloud seul.
- **Recommandation d'architecture forte** : concevoir le produit pour **ne jamais avoir besoin de stocker ce niveau de détail**. Le module de répartition/EDT n'a besoin de savoir que « cet élève bénéficie d'un PAI actif nécessitant une vigilance organisationnelle » (impact sur la taille de classe, l'AESH mutualisé, etc.), jamais du contenu médical lui-même — qui reste dans les systèmes métier existants (infirmerie scolaire, dossier santé). Ce choix de conception évite délibérément de déclencher l'obligation HDS, et doit être documenté comme tel dans l'AIPD.

### 3.9 Interconnexion avec les systèmes d'information existants
- **SIECLE / STS-Web** : base élèves de référence académique (identité, classe, LV, options) — le produit doit pouvoir **importer** depuis SIECLE plutôt que faire ressaisir les données par l'établissement.
- **LSU/LSL** (Livret Scolaire Unique) : hors périmètre direct du produit mais à respecter comme source de vérité pour les données de niveau/évaluation si elles sont utilisées comme critère de répartition.
- **PRONOTE / EDT (Index Education)** : prévoir un **connecteur d'import/export bidirectionnel** (formats propriétaires + format d'échange standard) pour permettre une adoption progressive dans des établissements déjà équipés, sans rupture de service pour la vie scolaire quotidienne.
- Le produit doit être pensé comme une **brique complémentaire et interopérable**, jamais comme un silo fermé qui obligerait l'établissement à tout migrer d'un coup.

### 3.10 Anonymisation et pseudonymisation — exigence transverse
- **Environnements de développement, test, démo, formation** : utilisation exclusive de **jeux de données synthétiques** générés artificiellement (aucune donnée réelle d'élève, jamais). Les agents doivent construire un générateur de données de test réaliste mais entièrement fictif (identités, noms, moyennes, profils PAP/PPRE simulés).
- **En production**, pseudonymiser les identifiants techniques (utiliser l'**INE** — Identifiant National Élève — comme clé technique plutôt que le nom, avec un mapping chiffré séparé), avec des vues d'affichage anonymisées disponibles (initiales) pour les contextes de présentation collective (ex. affichage en salle des professeurs, écran de réunion).

---

## 4. ARCHITECTURE TECHNIQUE CIBLE

### 4.1 Principes directeurs
- **API-first** : toute fonctionnalité front doit consommer une API interne documentée (OpenAPI 3), pour permettre l'intégration future en widget ENT et l'interopérabilité avec des tiers (PRONOTE/EDT, ENT régionaux).
- **Architecture modulaire** (modulith ou microservices raisonnés — éviter la sur-ingénierie microservices pour un produit qui démarre) avec au minimum une séparation claire entre : service d'authentification/habilitations, service de gestion des données de référence (élèves, classes, enseignants, salles), moteur de résolution combinatoire (dispatching), moteur de résolution combinatoire (emploi du temps), service de reporting/export, service d'audit/conformité.
- **Multi-établissement (multi-tenant)** avec **cloisonnement strict des données** par établissement (isolation logique forte a minima, isolation physique par base de données recommandée pour les plus gros clients académiques).
- **Événementiel pour la collaboration temps réel** (ex. WebSocket ou solution équivalente) : plusieurs membres de direction doivent pouvoir travailler simultanément sur une répartition ou un EDT sans écraser les modifications des autres (verrouillage optimiste par section/classe, ou CRDT si la complexité le justifie).

### 4.2 Stack technique recommandée (à adapter selon les compétences de l'équipe, mais ces choix sont éprouvés pour ce type de produit)
- **Frontend** : application web (React/TypeScript ou équivalent) + composants DSFR, PWA pour la consultation mobile, rendu desktop riche pour les vues de construction (drag & drop, grilles).
- **Backend** : API REST/GraphQL (Node.js/TypeScript, Python, ou Java/Kotlin selon l'équipe), avec une **couche de résolution combinatoire dédiée**, idéalement en Python ou C++ pour s'appuyer sur des solveurs de recherche opérationnelle matures (voir Section 11).
- **Base de données** : PostgreSQL (transactionnel, robuste, excellent support des contraintes et des extensions type PostGIS/JSONB si besoin de flexibilité sur les profils élèves).
- **Moteur de résolution** : **Google OR-Tools** (solveur CP-SAT, open source, gratuit, très largement utilisé pour les problèmes de type bin-packing, graph coloring et timetabling) comme socle, complété par des heuristiques/métaheuristiques maison pour la scalabilité (Section 11).
- **Infrastructure** : conteneurisation (Docker/Kubernetes), CI/CD avec pipelines de tests automatisés incluant tests de sécurité (SAST/DAST) et tests d'accessibilité automatisés, Infrastructure as Code.
- **Architecture de calcul lourd — modèle événementiel dédié** : la résolution combinatoire ne doit jamais bloquer l'interface. Prévoir : (1) une API légère qui valide et met en forme la requête puis la place dans une **file de tâches distribuée** (ex. Celery/Redis, RabbitMQ ou équivalent) ; (2) des **workers de calcul autoscalés** qui dépilent ces tâches, avec le cœur du solveur idéalement en C++ (bindings Python pour la logique métier) pour maximiser les performances brutes en multi-threading ; (3) un canal de **retour asynchrone en temps réel** (WebSocket ou Server-Sent Events) qui renvoie au front la progression (% de cours/élèves placés, qualité courante de la solution) plutôt qu'un statut binaire « en cours / terminé » — ce feedback continu est déterminant pour l'acceptabilité UX d'un calcul qui peut prendre plusieurs minutes.
- **Observabilité** : journalisation centralisée avec traçabilité RGPD-compatible (pas de données personnelles en clair dans les logs applicatifs), monitoring de performance.

### 4.3 Modèle de rôles (RBAC) — trame minimale à implémenter
Reprendre les personas de la Section 2 et les décliner en permissions granulaires par module (lecture répartition / édition répartition / validation répartition / lecture EDT / édition EDT / validation EDT / administration établissement / administration DPO), avec délégation possible et journalisation systématique de chaque action de modification ou de validation.

---

## 5. MODULE 1 — CONSTITUTION ET RÉÉQUILIBRAGE DES CLASSES (DISPATCHING)

### 5.1 Cas d'usage à couvrir
- Répartition initiale à la rentrée (ex. entrée en 6ᵉ, entrée en 2de) à partir des classes de l'année précédente ou des écoles d'origine.
- Rééquilibrage en cours d'année (déménagement, changement de spécialité, conflit apparu en cours d'année, demande de la famille validée par l'établissement).
- Recomposition inter-niveaux avec conservation de l'historique des séparations sur plusieurs années (ne pas re-mélanger deux élèves qui avaient été séparés l'année précédente pour un motif encore valide, sauf décision explicite contraire).

### 5.2 Données d'entrée à modéliser
| Catégorie | Détail | Source |
|---|---|---|
| Identité technique | INE (clé), nom/prénom (affichage restreint) | Import SIECLE |
| Caractéristiques de répartition | Sexe (parité), date de naissance | Import SIECLE |
| Niveau scolaire | Moyenne générale ou moyennes par matière (selon paramétrage) | Import SIECLE/LSU ou saisie manuelle |
| Parcours pédagogique | LV1/LV2, options, spécialités choisies, redoublement | Import SIECLE |
| Besoins particuliers | Statut PAP / PPRE / PPS / PAI / ULIS + accompagnement AESH (sans détail médical) | Saisie établissement, accès restreint |
| Contraintes relationnelles | Incompatibilités déclarées (conflit, harcèlement signalé), fratries, affinités à préserver (optionnel) | Saisie CPE/direction |
| Historique | Classe(s) précédente(s), séparations déjà appliquées | Historique interne |
| Vœux motivés | Demande argumentée d'une famille ou d'un enseignant, à valider par la direction | Saisie manuelle |

### 5.3 Modélisation des contraintes
**Contraintes dures (jamais violées, sauf dérogation explicite tracée) :**
- Effectif minimal/maximal par classe (paramétrable par établissement/niveau).
- Séparation stricte des élèves identifiés en situation de conflit avéré ou de signalement de harcèlement.
- Cohérence avec les groupes déterminés par choix irréversibles (LV rares, spécialités à effectif limité, dispositif ULIS).
- Élèves avec PPS nécessitant un regroupement pour mutualisation d'un AESH.

**Contraintes souples (optimisées, pondérables par l'établissement) :**
- Parité filles/garçons homogène entre classes.
- Mixité des niveaux scolaires (éviter les classes « de niveau » non assumées institutionnellement).
- Répartition équilibrée des profils PAP/PPRE/PPS entre classes (éviter la concentration excessive dans une seule classe).
- Répartition équilibrée par option/spécialité lorsque plusieurs classes proposent la même option.
- Continuité pédagogique souhaitée (maintien d'un noyau d'élèves ensemble d'une année sur l'autre si politique d'établissement).
- Prise en compte des vœux motivés validés, avec limite de pourcentage global pour ne pas dénaturer l'équilibre.
- **Mixité sociale (fonctionnalité optionnelle, désactivée par défaut)** : certains établissements souhaitent objectiver la mixité sociale entre classes, un enjeu de politique publique croissant. Si l'établissement active cette option, le produit doit se limiter à importer depuis SIECLE le **statut binaire boursier/non-boursier** (déjà présent dans la base académique) comme facteur d'équilibrage — **jamais** de quotient familial, de revenu ou de catégorie socioprofessionnelle détaillée, conformément au principe de minimisation de la Section 3.1. Ce point doit être documenté explicitement dans l'AIPD comme traitement de donnée à sensibilité renforcée, avec information claire des familles.

### 5.4 UX/UI attendue
- **Assistant d'import** guidé (SIECLE/CSV/Excel) avec détection et correction assistée des anomalies (doublons, champs manquants).
- **Configurateur de contraintes sans code** : interface à curseurs de pondération et cases à cocher, pas de fichier de configuration technique à éditer.
- **Génération automatique en un clic** produisant **plusieurs scénarios comparables** (A/B/C) avec un score de qualité détaillé par scénario et par classe (radar de qualité : parité, niveau, mixité besoins particuliers, respect des vœux).
- **Vue de construction manuelle en glisser-déposer**, avec alerte en temps réel dès qu'une contrainte dure est violée (ex. élève déposé dans une classe où se trouve son incompatibilité déclarée : blocage visuel immédiat avec justification).
- **Mode simulation « et si »** : déplacer un élève virtuellement et visualiser instantanément l'impact sur tous les scores de qualité, sans validation.
- **Historique complet avec undo/redo illimité** et comparaison de versions.
- **Circuit de validation** : proposition → relecture CPE/professeur principal → validation chef d'établissement → publication (avec verrouillage empêchant la modification après publication, sauf procédure de rééquilibrage explicite).
- **Mode présentation anonymisé** (initiales uniquement) pour les réunions où la confidentialité doit être renforcée (conseil pédagogique élargi).
- **Export** vers PRONOTE/SIECLE/EDT et vers un format standard (CSV/Excel) pour diffusion aux professeurs principaux.

### 5.5 Fonctionnalités avancées
- Explicabilité systématique : pour chaque élève affecté, afficher la liste des contraintes ayant motivé son affectation dans cette classe précise.
- Journal d'audit complet (qui a modifié quoi, quand, par rapport à quelle proposition algorithmique initiale).
- Statistiques comparatives inter-classes et historisation d'une année sur l'autre pour objectiver les choix devant le conseil d'administration ou les représentants de parents d'élèves.

---

## 6. MODULE 2 — GÉNÉRATION DES EMPLOIS DU TEMPS

### 6.1 Positionnement vis-à-vis du logiciel de référence
Comme indiqué en Section 1.3, **EDT (Index Education)** couplé à **PRONOTE** est la solution de référence dans le secondaire français. Le produit doit :
- Couvrir un périmètre fonctionnel au moins équivalent sur le cœur de métier (génération automatique, gestion des salles, gestion des remplacements, export vers la vie scolaire).
- Se différencier par une **architecture cloud collaborative** (plusieurs personnes travaillent en même temps, contrairement à un logiciel installé mono-poste/serveur local), une **UX résolument moderne** (grilles interactives fluides, recherche instantanée, mobile pour la consultation), et une **intégration nativement pensée pour l'ENT/SSO** plutôt qu'ajoutée après coup.
- Proposer un **connecteur d'import/export avec EDT/PRONOTE** pour permettre une adoption progressive sans rupture, plutôt que d'exiger une migration complète immédiate.

### 6.2 Données d'entrée à modéliser
| Catégorie | Détail |
|---|---|
| Structure pédagogique | Grille horaire officielle par niveau/spécialité, volumes horaires réglementaires par matière |
| Enseignants | Discipline(s), quotité de service, temps partiel, postes partagés multi-établissements, vœux et contraintes horaires déclarés, jours de décharge/formation |
| Salles | Capacité, équipement spécifique (labo, EPS, informatique, arts plastiques), salles préférentielles par discipline |
| Classes et groupes | Groupes de compétence, groupes de spécialité, groupes à effectif réduit (issus du Module 1) |
| Contraintes réglementaires | Amplitude horaire journalière maximale des élèves, pause méridienne minimale, temps de travail des enseignants (droit du travail applicable), nombre maximal d'heures consécutives |

### 6.3 Cas particulier — alignements simultanés multi-classes (« barrettes »)

> **Note de mise à jour réglementaire (à vérifier par les agents avant implémentation, la situation évolue vite) :** les « groupes de besoins » en français/mathématiques imposés en 6ᵉ/5ᵉ par la réforme « Choc des savoirs » (2024) ont été rendus **facultatifs** par un décret publié le 12 mars 2026, applicable dès la rentrée 2026 — leur extension en 4ᵉ/3ᵉ, un temps annoncée, n'a jamais été généralisée. Ce n'est donc plus une contrainte réglementaire imposée à tous les collèges, mais un **choix d'établissement** parmi d'autres formes d'organisation pédagogique possibles. Les agents doivent construire cette fonctionnalité comme une **capacité générique et paramétrable**, pas comme une conformité obligatoire figée dans le code — elle reste utile car mobilisable pour d'autres alignements (groupes de compétence choisis localement, groupes de spécialités au lycée, regroupements de LV rares).

- Le besoin technique sous-jacent reste réel et récurrent dans le secondaire français : imposer que plusieurs classes d'un même niveau (ex. trois classes de 6ᵉ) soient alignées **simultanément** sur un même créneau horaire pour permettre une **dispersion des élèves en sous-groupes transversaux** (groupes de compétence/besoin, groupes de spécialité), mobilisant plusieurs enseignants et salles en parallèle.
- Modélisation : contrainte d'égalité stricte entre les variables temporelles de plusieurs classes sur un créneau donné (« barrette »), le solveur devant identifier une plage où **tous** les enseignants et salles concernés sont simultanément disponibles — une contrainte particulièrement consommatrice de marge de manœuvre pour le reste de la grille, à signaler comme telle dans les indicateurs de qualité de l'EDT (une barrette « verrouille » potentiellement jusqu'à un tiers du temps scolaire d'un niveau si elle est utilisée intensivement).
- L'interface doit permettre de définir une barrette **visuellement** (sélection des classes concernées, du nombre de groupes cibles, des effectifs min/max par groupe), sans configuration technique en cascade — c'est précisément le point de friction le plus critiqué dans les outils existants sur ce type de fonctionnalité.

### 6.4 Modélisation combinatoire
- Il s'agit d'un problème classique de **timetabling scolaire**, largement documenté dans la littérature académique de recherche opérationnelle (compétitions internationales de type « International Timetabling Competition »), formulable comme un **problème de satisfaction de contraintes (CSP)** ou un **programme linéaire en nombres entiers (MILP)**.
- Variables de décision : triplet **(cours, créneau, salle)** avec affectation d'un enseignant et d'un ou plusieurs groupes d'élèves.
- **Contraintes dures** : un enseignant ne peut être sur deux cours simultanés ; une salle n'est occupée que par un cours à la fois ; le volume horaire réglementaire par matière est respecté exactement ; les disponibilités déclarées (temps partiel, décharges) sont respectées.
- **Contraintes souples pondérées** : minimiser les trous dans l'emploi du temps des élèves et des enseignants, éviter les matières « lourdes » en fin de journée, respecter les préférences horaires des enseignants dans la limite du possible, régularité de la semaine (éviter les emplois du temps trop dissymétriques d'un jour à l'autre).
- Recommandation d'outillage identique au Module 1 : **Google OR-Tools (solveur CP-SAT)** pour la résolution exacte sur les sous-problèmes de taille raisonnable, complété par des **métaheuristiques** (recherche locale à grand voisinage, recuit simulé) pour la résolution à l'échelle d'un établissement complet (voir Section 11).

### 6.5 UX/UI attendue
- **Vue calendrier multi-axes** interchangeable en un clic : vue par classe, par enseignant, par salle.
- **Génération automatique en tâche de fond** avec barre de progression, et à l'issue un **rapport de conflits résiduels** clair (jamais un échec silencieux) avec suggestions de résolution assistée.
- **Diagnostic explicable en langage naturel** en cas d'impossibilité de placement (situation d'« infaisabilité » au sens du solveur) : ne jamais se limiter à un statut technique du type « Infeasible ». L'interface doit isoler la cause racine et la formuler de façon actionnable, par exemple : *« Impossible de placer le cours de Physique-Chimie de la 3ᵉA : le professeur n'est disponible que le vendredi matin, mais les deux seules salles de laboratoire sont déjà occupées sur ce créneau par les spécialités de Terminale. »* — puis proposer proactivement des assouplissements concrets (déverrouiller telle contrainte optionnelle, réaffecter telle salle).
- **Glisser-déposer manuel** avec détection de conflit en temps réel (surbrillance immédiate si un déplacement crée une collision enseignant/salle/élève).
- **Gestion des remplacements ponctuels** : en cas d'absence déclarée d'un enseignant, suggestion automatique de créneaux de rattrapage ou de salle disponible pour une substitution.
- **Édition collaborative en temps réel** avec gestion des conflits d'édition simultanée (verrouillage par créneau/classe en cours d'édition, visible par les autres utilisateurs connectés).
- **Export** iCal (pour les agendas personnels), PDF (affichage/impression), et connecteur natif vers PRONOTE/EDT et l'ENT.
- **Vue de consultation lecture seule** pour élèves/parents/enseignants via SSO ENT/EduConnect, avec notification automatique en cas de changement d'emploi du temps.

### 6.6 Fonctionnalités avancées
- Gestion des semaines alternées (semaines A/B).
- Gestion des enseignants intervenant sur plusieurs établissements (postes partagés), avec prise en compte des temps de trajet.
- Tableau de bord d'occupation des salles pour objectiver les besoins immobiliers de l'établissement.
- Simulation de scénarios alternatifs (ex. impact d'un changement de grille horaire ou d'un recrutement) avant application définitive.

---

## 7. DESIGN SYSTEM ET ERGONOMIE

### 7.1 Principes directeurs
- **Densité d'information maîtrisée** : ce sont des outils professionnels manipulant beaucoup de données (grilles de centaines de lignes) — privilégier la clarté et la hiérarchisation visuelle plutôt que le minimalisme décoratif qui pénaliserait l'efficacité opérationnelle.
- **Zéro dark pattern**, retour visuel immédiat sur chaque action, annulation (undo) disponible partout où une action est destructive ou structurante.
- **Inspirations d'interaction** (pour les paradigmes d'usage, en complément du DSFR qui reste la base des composants d'interface et de l'accessibilité) : s'inspirer des meilleurs standards du SaaS B2B contemporain — **Notion/Airtable** pour la manipulation de données structurées sans friction technique, **Linear** pour la rapidité de navigation et le clavier-first, **Figma** pour la collaboration temps réel multi-utilisateurs visible à l'écran (curseurs, verrouillage de zone en cours d'édition).
- **Approche déclarative plutôt qu'impérative sur la configuration des contraintes** : au lieu d'obliger l'utilisateur à paramétrer des règles techniques cours par cours ou matière par matière dans des menus en cascade (le principal point de friction reproché aux outils historiques), l'interface doit permettre d'exprimer des intentions pédagogiques lisibles (« favoriser les matières fondamentales le matin en 6ᵉ », « espacer les cours d'anglais d'au moins 48h ») via des composants visuels simples, à charge pour le moteur de traduire ces intentions en contraintes du solveur.
- **Kanban et jauges dynamiques pour le dispatching** : vue en colonnes (une colonne par future classe) avec cartes-élèves déplaçables, et jauges de qualité (vert/orange/rouge) qui se recalculent instantanément à chaque déplacement pour visualiser l'impact sur la parité, la moyenne, la mixité des besoins particuliers, etc.
- **Simulation de scénarios façon « branches »** : permettre de cloner l'état courant d'une répartition ou d'un EDT, d'en faire évoluer une copie indépendante (par ex. tester un changement de temps partiel d'un enseignant), puis de comparer les scénarios côte à côte sur un tableau de bord décisionnel avant de fusionner ou d'abandonner une branche — une métaphore proche du contrôle de version, sans qu'il soit nécessaire d'exposer ce vocabulaire technique à l'utilisateur final.
- **Base de composants** : s'appuyer sur le **DSFR (Système de Design de l'État)** pour la cohérence visuelle, l'accessibilité native et l'acceptabilité institutionnelle, en le personnalisant pour les besoins spécifiques de grilles interactives complexes (planning, glisser-déposer) non couvertes nativement par le DSFR.
- **Desktop-first pour la construction** (répartition, EDT — tâches complexes nécessitant un grand espace d'écran), **mobile-first pour la consultation** (élève/parent/enseignant consultant son propre EDT).
- **Onboarding progressif** : mode démo avec données fictives, tutoriels contextuels intégrés, pas de documentation externe indispensable pour démarrer.
- **Performance perçue** : temps de chargement cible < 2 secondes, retours optimistes (optimistic UI) sur les actions d'édition, calculs longs systématiquement asynchrones avec indicateur de progression.

### 7.2 Accessibilité
- Conformité **RGAA niveau AA** vérifiée par audit automatisé (intégré en CI) et audit manuel avant chaque mise en production majeure.
- Navigation clavier complète y compris sur les interactions de glisser-déposer (alternative clavier obligatoire).
- Compatibilité lecteurs d'écran, contrastes suffisants, tailles de police ajustables, respect des temps de lecture pour les messages temporaires (pas de disparition automatique trop rapide des notifications).

---

## 8. SÉCURITÉ APPLICATIVE

- Respect des référentiels **OWASP ASVS/Top 10** sur l'ensemble du cycle de développement (revue de code systématique, SAST/DAST intégrés en CI/CD).
- **Authentification à privilèges élevés** (direction, DPO, administration technique) : authentification multi-facteurs obligatoire en complément du SSO ENT.
- **Gestion des secrets** via un coffre-fort dédié (jamais de secret en clair dans le code ou la configuration versionnée).
- **Chiffrement** systématique au repos et en transit (voir 3.8).
- **Tests d'intrusion (pentest)** obligatoires avant toute mise en production, puis à fréquence annuelle minimum, avec plan de remédiation documenté et suivi.
- **Plan de reprise et de continuité d'activité** (PRA/PCA) testé au moins une fois par an.
- **Séparation stricte des environnements** dev/staging/prod, avec interdiction absolue de données réelles hors production (voir 3.10).

---

## 9. GESTION DES DONNÉES ET CYCLE DE VIE

- **Registre des traitements** pré-rempli livré avec le produit (modèle à adapter par chaque DPO d'établissement).
- **Cartographie précise des données collectées**, avec justification de nécessité pour chaque champ (aucun champ « au cas où »).
- **Durées de conservation par défaut** proposées par type de donnée, configurables mais jamais indéfinies, avec purge automatique programmée et traçée.
- **Portail des droits** (accès, rectification, opposition, effacement) accessible aux représentants légaux via le canal institutionnel existant (ENT/EduConnect), avec procédure de traitement documentée et délais légaux respectés.
- **Procédure de notification de violation** intégrée à l'outil d'administration (détection, qualification du risque, notification CNIL sous 72h si nécessaire, information des familles si risque élevé).

---

## 10. INTÉGRATIONS OBLIGATOIRES / INTEROPÉRABILITÉ

| Système | Rôle | Exigence technique |
|---|---|---|
| **EduConnect / FranceConnect** | Authentification élèves/représentants légaux | SSO obligatoire, aucun mot de passe applicatif propre |
| **ENT (SDET)** | Portail d'accès institutionnel, authentification personnels | Compatibilité CAS + SAML2/OpenID Connect, respect de l'architecture SDET, packaging en widget/connecteur ENT |
| **GAR** | Cadre de confiance de diffusion des ressources | Ne pas contourner ce filtre si diffusion de ressources tierces à l'avenir |
| **SIECLE / STS-Web** | Base élèves académique de référence | Import (pas de resaisie), respect du format d'échange académique |
| **LSU/LSL** | Livret scolaire | Source de vérité si les moyennes/niveaux sont utilisés comme critère |
| **PRONOTE / EDT (Index Education)** | Vie scolaire et emploi du temps historiques | Connecteur d'import/export bidirectionnel pour adoption progressive |

**Précisions techniques sur les formats d'échange (à implémenter en V1) :**
- **Import SIECLE** : à ce jour, l'export se fait manuellement par l'établissement sous forme d'archive ZIP contenant des fichiers XML normalisés — notamment `Nomenclature.xml` (référentiel des formations/options), `Structures.xml` (classes, groupes, divisions) et `ElevesSansAdresses.xml` (identité et rattachement des élèves, volontairement sans coordonnées pour limiter la sensibilité). Le parseur d'import doit être robuste à ces trois fichiers dès la V1, avec un connecteur API à prévoir si le ministère ouvre des API SIECLE plus directes à l'avenir.
- **Import STS-Web** : le fichier `sts_emp.xml` recense les services réglementaires des enseignants (heures dues, pondérations statutaires) — nécessaire pour initialiser correctement le moteur de résolution du Module 2 (emplois du temps) sans resaisie manuelle des obligations de service.
- **GAR — cycle de vie des accès** : le GAR gère notamment la réattribution dynamique des licences en cas de changement d'affectation d'un utilisateur, avec une période tampon de l'ordre de 15 jours avant libération définitive d'un accès. Si le produit est un jour distribué via le GAR, ce cycle de vie doit être respecté plutôt que réinventé (voir aussi 3.3).
- **API publique documentée** (OpenAPI 3) pour tous les connecteurs, avec environnement de test (sandbox) pour les intégrateurs académiques.
- **Webhooks** pour les événements critiques (publication d'une répartition, modification d'un EDT) afin de permettre la synchronisation en quasi temps réel avec l'ENT et PRONOTE.

---

## 11. RECHERCHE OPÉRATIONNELLE — APPROFONDISSEMENT TECHNIQUE POUR LES AGENTS DÉVELOPPEURS

### 11.1 Nature du problème
- Le **dispatching de classes** combine un problème de **bin-packing multi-contraintes** (répartir des élèves dans des « bacs » de capacité bornée en respectant des ratios) et un problème de **coloration de graphe** (les incompatibilités déclarées forment des arêtes de conflit qui ne doivent jamais se retrouver dans le même « bac »).
- La **génération d'emploi du temps** est un problème de **timetabling** classique, formulable en CSP/MILP, notoirement NP-difficile dès qu'on dépasse quelques dizaines de variables croisées (enseignants × classes × salles × créneaux).

### 11.2 Outils recommandés
- **Google OR-Tools**, en particulier le solveur **CP-SAT**, open source et gratuit, est l'outil de référence recommandé pour ce type de problème (très large usage industriel et académique pour le bin-packing, la coloration de graphe contrainte et le timetabling). Il doit constituer le socle du moteur de résolution pour les deux modules.
- Pour la scalabilité au-delà de quelques centaines d'entités (établissements de plus de 1000 élèves, EDT complet d'un lycée avec des dizaines d'enseignants), compléter la résolution exacte par des **métaheuristiques** : recuit simulé, algorithmes génétiques, recherche à grand voisinage (Large Neighborhood Search), recherche tabou — appliquées en post-traitement d'une solution admissible initiale produite par le solveur exact sur un sous-problème réduit.
- Prévoir un **score de qualité pondéré et configurable** par établissement (les curseurs de pondération de la Section 5.3/6.3 alimentent directement la fonction objectif du solveur).
- **Technique de « hot start » / démarrage à chaud (recommandée pour la scalabilité)** : sur les établissements de grande taille (100+ classes, 150+ enseignants), une résolution exacte « from scratch » peut être trop longue pour une expérience interactive. La stratégie recommandée consiste à faire tourner d'abord une métaheuristique légère (recuit simulé, recherche locale) pour produire très rapidement une solution admissible de bonne qualité, même sous-optimale, puis à **injecter cette solution comme point de départ** dans le solveur CP-SAT (technique de *solution hinting* / *phase saving*), qui explore alors en priorité le voisinage de cette solution plutôt que de repartir de zéro. Ce couplage réduit drastiquement le temps de calcul perçu tout en conservant les garanties d'optimalité progressive propres à un solveur exact.

### 11.3 Exigences de performance cibles
- Génération d'une première proposition de répartition pour **1 000+ élèves en quelques dizaines de secondes**, avec affinement itératif possible en arrière-plan.
- Génération d'un emploi du temps complet d'établissement en **moins de 30 minutes**, avec rapport de conflits résiduels exploitable même en cas de non-convergence totale (dégradation progressive, jamais d'échec silencieux).
- Toute résolution longue doit être **asynchrone**, avec possibilité d'interrompre et de reprendre à partir de la meilleure solution trouvée à l'instant T.

### 11.4 Explicabilité
- Le moteur doit être capable de restituer, pour chaque décision, la **liste des contraintes évaluées** (satisfaites, violées avec justification, ignorées car de priorité inférieure). Aucune « boîte noire » n'est acceptable dans un contexte scolaire où chaque affectation peut être contestée par une famille ou faire l'objet d'un recours administratif.

---

## 12. QUALITÉ, TESTS ET RECETTE

- **Jeux de données synthétiques réalistes** générés automatiquement pour couvrir tous les cas limites (établissement de 200 élèves, établissement de 1500+ élèves, forte proportion de PAP/PPRE, nombreux postes partagés, options rares).
- **Tests unitaires et d'intégration** sur le moteur de résolution avec assertions sur le respect systématique des contraintes dures.
- **Tests de charge** simulant un établissement de grande taille (1500 élèves, 120 enseignants, 60 salles) avec mesure des temps de résolution.
- **Tests d'accessibilité automatisés** intégrés en CI (RGAA) + audit manuel avant chaque release majeure.
- **Tests de sécurité** (SAST/DAST) intégrés en CI, pentest externe avant mise en production.
- **Tests d'utilisabilité** avec un panel réel de chefs d'établissement, CPE et enseignants (mesure du temps de prise en main, score SUS — System Usability Scale — cible > 80).
- **Bêta-test encadré** avec 2 à 3 établissements pilotes volontaires avant généralisation, avec collecte structurée des retours et itération.

---

## 13. GOUVERNANCE DE PROJET POUR LES AGENTS IA

### 13.1 Découpage recommandé du travail
1. **Sprint 0 — Cadrage & conformité** : registre de traitement, AIPD, choix d'architecture, choix d'hébergeur, définition du modèle de données pseudonymisé.
2. **Sprint 1 — Socle technique** : authentification SSO (ENT/EduConnect simulé en environnement de dev), RBAC, structure multi-tenant, pipeline CI/CD avec SAST/DAST/tests accessibilité.
3. **Sprint 2 — Module 1 (MVP)** : import de données synthétiques, moteur de résolution dispatching (contraintes dures d'abord), UI de génération et de validation.
4. **Sprint 3 — Module 1 (avancé)** : glisser-déposer manuel, simulation « et si », explicabilité, export.
5. **Sprint 4 — Module 2 (MVP)** : moteur de résolution EDT (contraintes dures), vue calendrier, génération automatique.
6. **Sprint 5 — Module 2 (avancé)** : édition collaborative temps réel, gestion des remplacements, connecteurs PRONOTE/EDT.
7. **Sprint 6 — Durcissement** : pentest, audit RGAA complet, dossier d'homologation RGS, tests de charge, bêta-test pilote.
8. **Sprint 7 — Industrialisation** : documentation utilisateur, documentation DPO/administrateur, packaging connecteur ENT, plan de déploiement académique.

### 13.2 Definition of Done (à appliquer à chaque module)
- Contraintes dures jamais violées, validées par tests automatisés.
- Aucune donnée réelle utilisée en dehors de l'environnement de production.
- Accessibilité RGAA AA vérifiée.
- Explicabilité des décisions algorithmiques implémentée et testée.
- Documentation API à jour (OpenAPI).
- Revue de sécurité effectuée (a minima SAST + revue manuelle des flux de données personnelles).

---

## 14. LIVRABLES ATTENDUS DES AGENTS

1. Code source versionné, documenté, avec pipeline CI/CD fonctionnel.
2. Documentation technique (architecture, API OpenAPI, schéma de données).
3. Documentation de conformité : registre de traitement type, template d'AIPD, politique de confidentialité, dossier d'homologation RGS (structure a minima).
4. Déclaration d'accessibilité RGAA.
5. Guide utilisateur (chef d'établissement/adjoint/CPE) et guide administrateur/DPO.
6. Jeux de données synthétiques de démonstration et de test.
7. Rapport de tests de charge et de sécurité.
8. Plan de déploiement pilote (2-3 établissements) avec grille de collecte de retours.

---

## 15. CRITÈRES DE SUCCÈS / KPIs

| Indicateur | Cible |
|---|---|
| Temps de génération d'une première proposition de répartition (1000+ élèves) | < 1 minute |
| Taux d'ajustement manuel résiduel après génération automatique | < 10 % des élèves |
| Temps de génération d'un EDT complet d'établissement | < 30 minutes |
| Taux de conflits résiduels après génération automatique EDT | < 2 % |
| Score d'utilisabilité (SUS) | > 80 |
| Temps de prise en main autonome (chef d'établissement/adjoint) | < 30 minutes |
| Conformité RGAA | Niveau AA validé par audit externe |
| Résultat pentest avant mise en production | Aucune vulnérabilité critique/haute non corrigée |

---

## ANNEXE A — GLOSSAIRE DES SIGLES DE L'ÉDUCATION NATIONALE

| Sigle | Signification |
|---|---|
| **AESH** | Accompagnant des Élèves en Situation de Handicap |
| **AIPD / DPIA** | Analyse d'Impact relative à la Protection des Données |
| **DASEN** | Directeur Académique des Services de l'Éducation Nationale |
| **DPO** | Délégué à la Protection des Données |
| **DSFR** | Système de Design de l'État français |
| **EPLE** | Établissement Public Local d'Enseignement |
| **ENT** | Espace Numérique de Travail |
| **GAR** | Gestionnaire d'Accès aux Ressources |
| **GEVA-Sco** | Grille d'Évaluation des besoins de compensation en matière de Scolarisation |
| **INE** | Identifiant National Élève |
| **LSU / LSL** | Livret Scolaire Unique / Livret Scolaire du Lycée |
| **MDPH** | Maison Départementale des Personnes Handicapées |
| **PAI** | Projet d'Accueil Individualisé (troubles de santé chroniques, allergies) |
| **PAP** | Plan d'Accompagnement Personnalisé (troubles des apprentissages durables, sans reconnaissance handicap) |
| **PIAL** | Pôle Inclusif d'Accompagnement Localisé |
| **PPRE** | Programme Personnalisé de Réussite Éducative (difficulté passagère, courte durée) |
| **PPS** | Projet Personnalisé de Scolarisation (handicap reconnu par la MDPH) |
| **RGAA** | Référentiel Général d'Amélioration de l'Accessibilité |
| **RGS** | Référentiel Général de Sécurité |
| **SDET** | Schéma Directeur des Espaces numériques de Travail |
| **SIECLE / STS-Web** | Système d'Information pour Élèves du second degré |
| **ULIS** | Unité Localisée pour l'Inclusion Scolaire |

**Repère utile** : PPRE < PAP < PPS en gravité/durabilité — le PPRE est un dispositif interne court terme, le PAP répond à un trouble des apprentissages durable sans reconnaissance de handicap, le PPS est le seul dispositif conditionné à une reconnaissance de handicap par la MDPH et peut mener à une orientation ULIS avec accompagnement AESH. Le PAI est un dispositif à part, dédié aux troubles de santé chroniques (allergies, pathologies), indépendant de la gravité des apprentissages.

---

## ANNEXE B — CHECKLIST DE CONFORMITÉ FINALE AVANT MISE EN PRODUCTION

- [ ] Responsable de traitement clairement identifié dans les CGU/DPA (chef d'établissement, pas l'éditeur)
- [ ] Base légale documentée (mission d'intérêt public, pas de faux bandeau de consentement)
- [ ] Registre de traitement type livré et adaptable
- [ ] AIPD réalisée et documentée
- [ ] Aucune décision algorithmique appliquée sans validation humaine explicite
- [ ] Explicabilité des propositions algorithmiques implémentée
- [ ] SSO EduConnect/FranceConnect et/ou ENT opérationnel, aucun mot de passe applicatif propre pour élèves/parents
- [ ] Compatibilité SDET vérifiée (CAS et/ou SAML2/OIDC, schéma d'annuaire ENT)
- [ ] Hébergement France/UE, chiffrement au repos et en transit vérifié
- [ ] Dossier d'homologation RGS constitué (analyse de risques EBIOS RM a minima)
- [ ] Pentest réalisé, vulnérabilités critiques/hautes corrigées
- [ ] Conformité RGAA AA vérifiée, déclaration d'accessibilité publiée
- [ ] Données de test/démo strictement synthétiques (aucune donnée réelle hors production)
- [ ] Durées de conservation configurées et purge automatique testée
- [ ] Procédure de notification de violation de données opérationnelle
- [ ] Portail des droits (accès/rectification/opposition) fonctionnel
- [ ] Documentation DPO et guide utilisateur livrés
- [ ] Plan de reprise/continuité d'activité testé

---

*Fin du prompt directeur. Les agents peuvent désormais commencer par la Section 13.1 (Sprint 0) en s'appuyant sur l'ensemble des sections précédentes comme référentiel permanent tout au long du projet.*
