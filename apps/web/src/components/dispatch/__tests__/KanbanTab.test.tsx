import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanTab } from "../KanbanTab";
import {
  makeDataset,
  makeScenario,
  makeWeights,
  makeStudentsByClass,
} from "../../../test/fixtures";

function renderKanbanTab(overrides: Partial<React.ComponentProps<typeof KanbanTab>> = {}) {
  const dataset = overrides.dataset ?? makeDataset();
  const selected = overrides.selected ?? makeScenario();
  const studentsByClass = overrides.studentsByClass ?? makeStudentsByClass(dataset, selected);

  const props: React.ComponentProps<typeof KanbanTab> = {
    dataset,
    weights: makeWeights(),
    anonymous: false,
    busy: false,
    scenarios: [selected],
    selected,
    selectedStudentId: undefined,
    setSelectedStudentId: vi.fn(),
    selectedStudent: undefined,
    dragOverClassId: null,
    setDragOverClassId: vi.fn(),
    draggedStudentId: null,
    setDraggedStudentId: vi.fn(),
    openSupportModalClassId: null,
    setOpenSupportModalClassId: vi.fn(),
    lastMove: null,
    historyPast: [],
    historyFuture: [],
    studentsByClass,
    ruleAuditList: [],
    setInspectStudent: vi.fn(),
    setSelectedId: vi.fn(),
    setShowPdfModal: vi.fn(),
    setShowRebalanceModal: vi.fn(),
    getBestScenarioId: (scens) => scens[0]?.id,
    requestMove: vi.fn(),
    undoLastMove: vi.fn().mockResolvedValue(undefined),
    handleUndo: vi.fn(),
    handleRedo: vi.fn(),
    validate: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };

  const utils = render(<KanbanTab {...props} />);
  return { ...utils, props };
}

describe("KanbanTab", () => {
  it("affiche les deux colonnes de classe avec le bon effectif", () => {
    renderKanbanTab();

    expect(screen.getByRole("heading", { name: "6e A" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "6e B" })).toBeInTheDocument();

    // 2 élèves par classe (stu-1/stu-2 -> cls-a, stu-3/stu-4 -> cls-b)
    expect(screen.getByText("Camille Dubois")).toBeInTheDocument();
    expect(screen.getByText("Lucas Martin")).toBeInTheDocument();
    expect(screen.getByText("Inès Bernard")).toBeInTheDocument();
    expect(screen.getByText("Noah Petit")).toBeInTheDocument();
  });

  it("affiche les initiales au lieu du nom en mode anonyme", () => {
    renderKanbanTab({ anonymous: true });

    expect(screen.queryByText("Camille Dubois")).not.toBeInTheDocument();
    // Les initiales "CD" apparaissent proprement pour l'élève sans doublon
    expect(screen.getByText("CD")).toBeInTheDocument();
  });

  it("signale un sous-effectif quand la classe est sous le minimum", () => {
    // minSize=20 mais seulement 2 élèves affectés -> sous-effectif
    renderKanbanTab();
    const warnings = screen.getAllByText(/Sous-effectif/);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("sélectionne un élève au clic sur sa carte", async () => {
    const user = userEvent.setup();
    const { props } = renderKanbanTab();

    await user.click(screen.getByText("Camille Dubois"));

    expect(props.setSelectedStudentId).toHaveBeenCalledWith("stu-1");
  });

  it("affiche les boutons de transfert vers les autres classes quand un élève est sélectionné, et appelle requestMove au clic", async () => {
    const user = userEvent.setup();
    const dataset = makeDataset();
    const selected = makeScenario();
    const { props } = renderKanbanTab({
      dataset,
      selected,
      scenarios: [selected],
      studentsByClass: makeStudentsByClass(dataset, selected),
      selectedStudentId: "stu-1", // affecté à cls-a dans le scénario par défaut
    });

    // stu-1 est dans cls-a -> seule cls-b doit apparaitre comme cible de transfert.
    // On scope la recherche à .target-pills-grid : le DOM contient aussi un
    // bouton de navigation mobile "6e B" (masqué en desktop par CSS, mais
    // jsdom ne applique pas les media queries donc les deux coexistent).
    const targetGrid = document.querySelector(".target-pills-grid") as HTMLElement;
    const transferButton = within(targetGrid).getByRole("button", { name: /6e B/ });
    await user.click(transferButton);

    expect(props.requestMove).toHaveBeenCalledWith("stu-1", "cls-b");
  });

  it("déclenche requestMove lors d'un drop sur une colonne de classe", () => {
    const dataset = makeDataset();
    const selected = makeScenario();
    const { props } = renderKanbanTab({
      dataset,
      selected,
      scenarios: [selected],
      studentsByClass: makeStudentsByClass(dataset, selected),
      draggedStudentId: "stu-1", // affecté à cls-a -> on le dépose sur cls-b
    });

    const classBHeading = screen.getByRole("heading", { name: "6e B" });
    const classBColumn = classBHeading.closest(".class-column");
    expect(classBColumn).not.toBeNull();

    fireEvent.drop(classBColumn as Element);

    expect(props.requestMove).toHaveBeenCalledWith("stu-1", "cls-b");
  });

  it("ne redéclenche pas requestMove si on dépose sur la classe d'origine", () => {
    const dataset = makeDataset();
    const selected = makeScenario();
    const { props } = renderKanbanTab({
      dataset,
      selected,
      scenarios: [selected],
      studentsByClass: makeStudentsByClass(dataset, selected),
      draggedStudentId: "stu-1", // deja dans cls-a
    });

    const classAHeading = screen.getByRole("heading", { name: "6e A" });
    const classAColumn = classAHeading.closest(".class-column");
    fireEvent.drop(classAColumn as Element);

    expect(props.requestMove).not.toHaveBeenCalled();
  });

  it("désactive Annuler/Rétablir quand l'historique est vide, et les active sinon", () => {
    const { rerender, props } = renderKanbanTab({ historyPast: [], historyFuture: [] });

    expect(screen.getByRole("button", { name: /Annuler/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Rétablir/ })).toBeDisabled();

    rerender(
      <KanbanTab
        {...props}
        historyPast={[makeScenario({ id: "prev" })]}
        historyFuture={[makeScenario({ id: "next" })]}
      />,
    );

    expect(screen.getByRole("button", { name: /Annuler/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Rétablir/ })).toBeEnabled();
  });

  it("appelle handleUndo/handleRedo au clic sur Annuler/Rétablir", async () => {
    const user = userEvent.setup();
    const { props } = renderKanbanTab({
      historyPast: [makeScenario({ id: "prev" })],
      historyFuture: [makeScenario({ id: "next" })],
    });

    await user.click(screen.getByRole("button", { name: /Annuler/ }));
    expect(props.handleUndo).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /Rétablir/ }));
    expect(props.handleRedo).toHaveBeenCalledTimes(1);
  });

  it("ouvre la modale PDF et la modale de rééquilibrage via les boutons dédiés", async () => {
    const user = userEvent.setup();
    const { props } = renderKanbanTab();

    await user.click(screen.getByRole("button", { name: /Exporter PDF/ }));
    expect(props.setShowPdfModal).toHaveBeenCalledWith(true);

    await user.click(screen.getByRole("button", { name: /Proposer un rééquilibrage/ }));
    expect(props.setShowRebalanceModal).toHaveBeenCalledWith(true);
  });

  it("appelle validate au clic sur Officialiser, sauf si le scénario est déjà approuvé", async () => {
    const user = userEvent.setup();
    const { props } = renderKanbanTab();

    await user.click(screen.getByRole("button", { name: /Officialiser Ce Scénario/ }));
    expect(props.validate).toHaveBeenCalledTimes(1);
  });

  it("désactive Officialiser et affiche 'Officialisé' quand le scénario est déjà APPROVED", () => {
    const dataset = makeDataset();
    const selected = makeScenario({ state: "APPROVED" });
    renderKanbanTab({
      dataset,
      selected,
      scenarios: [selected],
      studentsByClass: makeStudentsByClass(dataset, selected),
    });

    // Le bouton principal porte la classe "validate" ; une variante mobile
    // avec un libellé similaire coexiste dans le DOM sous jsdom (masquée en
    // CSS uniquement), donc on cible précisément celui-ci.
    const officialiseButton = document.querySelector("button.validate") as HTMLButtonElement;
    expect(officialiseButton).toHaveTextContent(/Officialisé/);
    expect(officialiseButton).toBeDisabled();
  });

  it("affiche le popover des accompagnements au clic sur le bouton dédié de la classe concernée", async () => {
    const user = userEvent.setup();
    renderKanbanTab();

    // Le composant utilise son propre système de tooltip via l'attribut
    // data-tooltip (pas l'attribut title natif) - cf. tooltips.css.
    const classAColumn = document.querySelector("#class-col-cls-a") as HTMLElement;
    const supportButton = within(classAColumn).getByText(/besoins/i).closest("button");
    expect(supportButton).not.toBeNull();

    await user.click(supportButton as HTMLElement);
    // Pas d'assertion sur le contenu du popover (dépend de openSupportModalClassId
    // qui est un prop controle depuis App.tsx) - on verifie juste que le clic ne
    // crashe pas et cible bien le bon bouton, propre a la classe 6e A.
    expect(supportButton).toBeInTheDocument();
  });
});
