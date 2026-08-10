# Architecture frontend (apps/web/src/)

Ce document décrit l'organisation du code de `apps/web/src/`, issue du découpage
d'un fichier `App.tsx` monolithique de 5835 lignes et d'un `styles.css` de
2474 lignes (août 2026). Il complète `docs/architecture.md`, qui couvre le
système dans son ensemble (API, sécurité, roadmap backend).

## Pourquoi ce document existe

Le refactor a été fait selon un principe strict : **déplacer sans changer le
comportement**. Chaque composant extrait garde exactement la même logique
qu'avant, avec des props explicites à la place de closures implicites. Ce
document explique où chaque chose vit maintenant, pour que les prochains
agents (humains ou IA) n'aient pas à redécouvrir la structure - et surtout
pour qu'ils n'aient pas le réflexe de tout remettre dans un seul fichier.

## Structure

```
src/
  App.tsx                 Orchestration : state (useState), handlers, layout.
                           Compose tous les composants ci-dessous via props
                           explicites. ~1600 lignes - c'est le "cerveau" de
                           l'appli, mais plus le corps entier.

  constants/
    referentiels.ts        Référentiels MENJ (matières, LV1/LV2, options).
    schedule.ts             Créneaux jours/périodes de l'EDT.

  utils/
    format.ts               Fonctions pures d'affichage (nameOf, couleurs
                             d'avatar, libellés de pondération...).
    rebalance.ts             Calcul des étapes de rééquilibrage (algo pur).

  components/
    Metric.tsx, Explanation.tsx, OfficialPdfModal.tsx
                             Composants déjà autonomes avant le refactor.

    modals/                  Les 5 modales de App.tsx, chacune avec ses props
                             explicites. StudentDetailModal.tsx est la plus
                             grosse (646 lignes, ~15 props) : fiche élève +
                             édition CNIL.

    tabs/                    3 des 4 onglets principaux (Emplois du temps,
                             Espace enseignant, Conformité).

    dispatch/                Les 3 sous-onglets de l'onglet Répartition.
                             KanbanTab.tsx est le composant le plus complexe
                             du projet (920 lignes, 29 props, drag & drop).

  styles.css                 Agrégateur : 20 lignes de @import, RIEN d'autre.
  styles/                    20 fichiers CSS, découpés en TRANCHES CONTIGUËS
                             du fichier original (jamais par regroupement
                             thématique à distance - voir plus bas).

  test/
    fixtures.ts               Factories de données de test (makeStudent,
                               makeDataset, makeScenario...).
    setup.ts                   Config Vitest (jest-dom matchers).
```

## Principe de découpage : props explicites, pas de state partagé implicite

Chaque composant extrait est une fonction pure de ses props. Aucun ne lit ou
n'écrit du state React qui ne lui a pas été passé explicitement. Le state
(les ~60 `useState`) reste dans `App.tsx`, qui les distribue aux composants.

**C'est un choix assumé, pas un oubli.** Regrouper ce state en hooks dédiés
(`useDispatchState`, `useHistory`...) était considéré et volontairement
écarté : ça n'apporte de valeur que si `App.tsx` recommence à grossir ou si
un vrai bug de dépendances `useEffect`/`useMemo` apparaît. Le faire à froid
aurait été le seul type de changement du refactor qui risquait réellement de
casser quelque chose (fermetures, tableaux de dépendances). Si ce jour
arrive, commencer par identifier les clusters de state qui changent toujours
ensemble (ex: `dataset`+`scenarios`+`selectedId` d'un côté, l'historique
undo/redo de l'autre) plutôt que de tout regrouper en un seul hook géant.

## Pourquoi les fichiers CSS suivent des tranches contiguës, pas des thèmes

Les commentaires de section du fichier original n'étaient pas fiables (une
section "Shimmer Loading" contenait en fait `.modal-backdrop` avant le
shimmer). Des règles `[data-theme="dark"]` et des media queries apparaissent
à plusieurs endroits distincts du fichier, pas toutes regroupées. Le
découpage suit donc l'ordre physique du fichier, jamais un regroupement par
thème à distance - déplacer une règle change potentiellement son rang dans
la cascade CSS. Vérifié par diff strict : la concaténation des 20 fichiers
dans l'ordre des `@import` reproduit l'original au caractère près.

**En pratique** : un fichier nommé `layout.css` peut contenir une règle de
mode sombre isolée qui semble "hors sujet" - c'est normal, elle vit là parce
que c'est sa position d'origine dans le fichier, pas parce qu'elle concerne
la mise en page.

## Dette technique connue, documentée, pas corrigée

- **Signalements ESLint/Stylelint (voir commit `dfce802`)** : 29 signalements
  ESLint et 9 Stylelint, tous pré-existants au refactor (invisibles faute
  d'outillage avant). Non corrigés car ça sortirait du cadre d'un refactor
  "sans changement de comportement" - notamment un `react-hooks/set-state-in-effect`
  sur la restauration localStorage au démarrage de `App.tsx` (~ligne 206),
  qui mérite un vrai design review plutôt qu'un fix réflexe.
- Le doublon `:focus-visible` a été corrigé (commit `92f729b`) - c'est le
  seul point de dette technique CSS/JS qui a été activement résolu plutôt
  que documenté, à la demande explicite du produit.

## Tests

`apps/web` a sa propre suite Vitest + React Testing Library (`npx vitest
run` depuis `apps/web/`, ou via le script racine si ajouté). Distincte de la
suite `node --test` de `packages/domain` et `apps/api` (`npm test` à la
racine). Priorité donnée aux deux composants les plus complexes/risqués :
`KanbanTab` (drag & drop, 13 tests) et `StudentDetailModal` (édition CNIL,
9 tests). Les autres composants extraits n'ont pas encore de tests dédiés.

## Ce qui n'a délibérément pas été fait

- **Lazy-loading** (`React.lazy`) sur les onglets peu utilisés (Compliance,
  la modale PDF) : gain marginal, le bundle de production fait déjà 383 kB
  et charge en ~3s en dev. À reconsidérer si le bundle grossit significativement.
- **Regroupement du state en hooks** : voir section dédiée plus haut.

Ces deux points ne sont pas oubliés - ils ont été évalués et écartés faute
de besoin concret identifié au moment du refactor (août 2026).
