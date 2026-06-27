import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { NotificationTemplate } from "../../src/hooks/useNotificationTemplates";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Hook que carrega os templates da API — controlado por cada teste.
const useNotificationTemplatesMock = vi.fn();
vi.mock("../../src/hooks/useNotificationTemplates", () => ({
  useNotificationTemplates: () => useNotificationTemplatesMock(),
}));

// Permissões — controlado por cada teste.
const hasPermissionMock = vi.fn(() => true);
vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => ({ hasPermission: hasPermissionMock }),
}));

// Mutação de gravação no CMS.
const putCmsEntriesMock = vi.fn(() => Promise.resolve());
vi.mock("../../src/gen/backoffice/hooks/usePutCmsEntries.js", () => ({
  putCmsEntries: (...args: unknown[]) => putCmsEntriesMock(...args),
}));

// Toast — silenciar.
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { NotificationsPanel } from "../../src/components/NotificationsPanel";

function makeTemplate(
  overrides: Partial<NotificationTemplate> = {},
): NotificationTemplate {
  return {
    key: "novo_plano",
    label: "Novo plano (ginásio)",
    placeholders: ["plano"],
    permissions: ["VIEW_GYM"],
    defaultTitle: "Novo plano de treino",
    defaultBody: "O teu treinador atribuiu-te o plano {{plano}}.",
    titleKey: "notif.novo_plano.titulo",
    bodyKey: "notif.novo_plano.corpo",
    localeValues: { pt: { title: "", body: "" } },
    ...overrides,
  };
}

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NotificationsPanel />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  hasPermissionMock.mockReturnValue(true);
  putCmsEntriesMock.mockResolvedValue(undefined);
  useNotificationTemplatesMock.mockReturnValue({
    data: {
      locales: ["pt"],
      defaultLocale: "pt",
      templates: [makeTemplate()],
    },
    isLoading: false,
  });
});

describe("NotificationsPanel", () => {
  it("renderiza o label do template", () => {
    renderPanel();
    expect(screen.getByText("Novo plano (ginásio)")).toBeInTheDocument();
  });

  it("expande o card, edita título e mensagem e grava via putCmsEntries com as chaves notif.*", async () => {
    const user = userEvent.setup();
    renderPanel();

    // Expandir o card (o cabeçalho é um botão com o label).
    await user.click(screen.getByText("Novo plano (ginásio)"));

    const titleInput = screen.getByPlaceholderText("Novo plano de treino");
    const bodyInput = screen.getByPlaceholderText(
      "O teu treinador atribuiu-te o plano {{plano}}.",
    );

    await user.clear(titleInput);
    await user.type(titleInput, "Tens um plano novo");
    await user.clear(bodyInput);
    // Texto simples sem chavetas — userEvent trata "{" e "}" como sequências
    // especiais de teclado, e o que estamos a validar é o fluxo de gravação
    // (chaves notif.* + valores), não a sintaxe de placeholders.
    await user.type(bodyInput, "Bora treinar muito");

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(putCmsEntriesMock).toHaveBeenCalledTimes(2);
    });

    const calls = putCmsEntriesMock.mock.calls.map((c) => c[0]);
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "notif.novo_plano.titulo",
          locale: "pt",
          type: "text",
          value: "Tens um plano novo",
        }),
        expect.objectContaining({
          key: "notif.novo_plano.corpo",
          locale: "pt",
          type: "text",
          value: "Bora treinar muito",
        }),
      ]),
    );
  });

  it("não renderiza templates cujas permissões o utilizador não tem", () => {
    hasPermissionMock.mockReturnValue(false);
    renderPanel();
    expect(screen.queryByText("Novo plano (ginásio)")).not.toBeInTheDocument();
  });

  it("renderiza templates sem permissões exigidas mesmo sem permissão", () => {
    hasPermissionMock.mockReturnValue(false);
    useNotificationTemplatesMock.mockReturnValue({
      data: {
        locales: ["pt"],
        defaultLocale: "pt",
        templates: [
          makeTemplate({
            key: "sem_perm",
            label: "Sempre visível",
            permissions: [],
          }),
        ],
      },
      isLoading: false,
    });
    renderPanel();
    expect(screen.getByText("Sempre visível")).toBeInTheDocument();
  });
});
