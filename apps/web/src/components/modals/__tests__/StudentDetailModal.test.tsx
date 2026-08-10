import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StudentDetailModal } from "../StudentDetailModal";
import { makeDataset, makeScenario, makeStudent } from "../../../test/fixtures";

function renderModal(overrides: Partial<React.ComponentProps<typeof StudentDetailModal>> = {}) {
  const dataset = overrides.dataset ?? makeDataset();
  const selected = overrides.selected ?? makeScenario();
  const inspectStudent = overrides.inspectStudent ?? makeStudent({ id: "stu-1", displayName: "Camille Dubois", initials: "CD" });

  const props: React.ComponentProps<typeof StudentDetailModal> = {
    inspectStudent,
    setInspectStudent: vi.fn(),
    selected,
    dataset,
    anonymous: false,
    isEditingStudent: false,
    setIsEditingStudent: vi.fn(),
    editStudentForm: null,
    setEditStudentForm: vi.fn(),
    editReason: "",
    setEditReason: vi.fn(),
    userRole: "HEADMASTER_ADMIN",
    setUserRole: vi.fn(),
    handleSaveStudentEdit: vi.fn().mockResolvedValue(undefined),
    audit: [],
    ...overrides,
  };

  const utils = render(<StudentDetailModal {...props} />);
  return { ...utils, props };
}

describe("StudentDetailModal", () => {
  beforeEach(() => {
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("affiche le nom, la classe affectée et le sexe de l'élève", () => {
    const dataset = makeDataset();
    const selected = makeScenario(); // stu-1 -> cls-a ("6e A")
    renderModal({
      dataset,
      selected,
      inspectStudent: makeStudent({ id: "stu-1", displayName: "Camille Dubois", initials: "CD", gender: "F" }),
    });

    expect(screen.getByRole("heading", { name: "Camille Dubois" })).toBeInTheDocument();
    expect(screen.getByText(/6e A/)).toBeInTheDocument();
    expect(screen.getByText(/Fille/)).toBeInTheDocument();
  });

  it("affiche l'identifiant pseudonymisé (INE-SHA256...) en mode anonyme, l'id brut sinon", () => {
    const student = makeStudent({ id: "student-abc12345" });

    const { unmount } = renderModal({ inspectStudent: student, anonymous: false });
    expect(screen.getByText("student-abc12345")).toBeInTheDocument();
    unmount();

    renderModal({ inspectStudent: student, anonymous: true });
    expect(screen.getByText(/INE-SHA256-ABC12345/)).toBeInTheDocument();
    expect(screen.queryByText("student-abc12345")).not.toBeInTheDocument();
  });

  it("ferme la modale au clic sur le bouton de fermeture", async () => {
    const user = userEvent.setup();
    const { props } = renderModal();

    // Le premier bouton icon-btn-subtle est celui de la croix de fermeture
    const closeButton = document.querySelector(".icon-btn-subtle") as HTMLButtonElement;
    await user.click(closeButton);

    expect(props.setInspectStudent).toHaveBeenCalledWith(null);
  });

  it("passe en mode édition et pré-remplit le formulaire quand l'utilisateur est HEADMASTER_ADMIN", async () => {
    const user = userEvent.setup();
    const student = makeStudent({ id: "stu-1", displayName: "Camille Dubois" });
    const { props } = renderModal({ inspectStudent: student, userRole: "HEADMASTER_ADMIN" });

    await user.click(screen.getByRole("button", { name: /Modifier la fiche élève/ }));

    expect(props.setEditStudentForm).toHaveBeenCalledWith(student);
    expect(props.setIsEditingStudent).toHaveBeenCalledWith(true);
    expect(window.alert).not.toHaveBeenCalled();
  });

  it("refuse l'édition et affiche une alerte quand l'utilisateur est READONLY_TEACHER", async () => {
    const user = userEvent.setup();
    const { props } = renderModal({ userRole: "READONLY_TEACHER" });

    await user.click(screen.getByRole("button", { name: /Modifier la fiche élève/ }));

    expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/Droits insuffisants/));
    expect(props.setIsEditingStudent).not.toHaveBeenCalled();
  });

  it("bascule le rôle au clic sur le sélecteur de rôle, et referme l'édition en cours si on repasse en lecture seule", async () => {
    const user = userEvent.setup();
    const { props } = renderModal({ userRole: "HEADMASTER_ADMIN", isEditingStudent: true });

    await user.click(screen.getByRole("button", { name: /Tester mode Consultation/ }));

    expect(props.setUserRole).toHaveBeenCalledWith("READONLY_TEACHER");
    expect(props.setIsEditingStudent).toHaveBeenCalledWith(false);
  });

  it("en mode édition, appelle handleSaveStudentEdit au clic sur Enregistrer", async () => {
    const user = userEvent.setup();
    const student = makeStudent({ id: "stu-1" });
    const { props } = renderModal({
      isEditingStudent: true,
      editStudentForm: { ...student, teacherComments: "Bon trimestre" },
      editReason: "Décision du conseil de classe",
    });

    const saveButton = screen.getByRole("button", { name: /Enregistrer & Sceller/ });
    await user.click(saveButton);

    expect(props.handleSaveStudentEdit).toHaveBeenCalledTimes(1);
  });

  it("permet d'annuler l'édition en cours", async () => {
    const user = userEvent.setup();
    const student = makeStudent({ id: "stu-1" });
    const { props } = renderModal({
      isEditingStudent: true,
      editStudentForm: { ...student },
    });

    await user.click(screen.getByRole("button", { name: /Annuler l'édition/ }));

    expect(props.setIsEditingStudent).toHaveBeenCalledWith(false);
  });

  it("met à jour editReason à la saisie du motif de modification", async () => {
    const user = userEvent.setup();
    const student = makeStudent({ id: "stu-1" });
    const { props } = renderModal({
      isEditingStudent: true,
      editStudentForm: { ...student },
      editReason: "",
    });

    const reasonInput = screen.getByPlaceholderText(/Décision du conseil de classe/);
    await user.type(reasonInput, "X");

    expect(props.setEditReason).toHaveBeenCalled();
  });
});
