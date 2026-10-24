import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { API, E2E_PASSWORD, loginAs, nextClientIp } from "./fixtures/login";
import { withSessionRetry } from "./fixtures/session";

/**
 * R1.8 (B5) — Agenda: reagendar uma marcação ARRASTANDO-A no calendário.
 *
 * Fluxo (Agenda.tsx, handlers globais de `pointermove/up`): arrastar uma marcação para outra hora NÃO grava logo — abre a
 * modal da marcação com o banner "Reagendado" (hora velha riscada → nova); o "Guardar" é que faz o PUT com `date`/`time`.
 *
 * Regra AG-02 (DEC-048): no Backoffice o negócio PODE marcar/arrastar por cima de outra marcação (encaixes —
 * o filho que vem com o pai). Não há aviso nem recusa: o teste prova que a sobreposição é ACEITE e fica gravada.
 * (O site é que recusa, com `409 SLOT_TAKEN` — AG-01, `tests/websites/booking.test.ts` na API.)
 *
 * Teclado: a Agenda NÃO suporta reagendar por teclado (só ponteiro: rato e long-press em touch) — não há o que testar.
 *
 * Dados: criados pela API no tenantA, numa semana fixa do futuro (qua 2030-03-06) para não depender de "hoje" nem tocar
 * nas marcações semeadas; apagados no fim. Largura 1440/834/390 (o gesto é vertical, na mesma coluna).
 */

test.use({ storageState: { cookies: [], origins: [] } });

const DIA = "2030-03-06"; // quarta-feira
const ROW_H = 80; // px por hora (AG_ROW_H em Agenda.tsx)

const LARGURAS = [
  { label: "1440", width: 1440, height: 900 },
  { label: "834", width: 834, height: 1112 },
  { label: "390", width: 390, height: 844 },
];

type Marcacao = { id: string; nome: string };

async function tokenDoTenantA(request: APIRequestContext): Promise<Record<string, string>> {
  const res = await request.post(`${API}/users/login`, {
    data: { username: "tenantA@e2e", password: E2E_PASSWORD },
    headers: { "CF-Connecting-IP": nextClientIp() },
  });
  expect(res.ok(), "login do tenantA falhou").toBeTruthy();
  return { Authorization: `Bearer ${(await res.json()).accessToken as string}` };
}

async function criar(request: APIRequestContext, h: Record<string, string>, serviceId: string, nome: string, time: string): Promise<Marcacao> {
  const res = await request.post(`${API}/schedule/appointments`, {
    headers: h,
    data: { date: DIA, time, serviceId, clientName: nome, clientEmail: "", clientPhone: "" },
  });
  expect(res.ok(), `criar marcação ${nome} (${res.status()})`).toBeTruthy();
  const body = await res.json();
  const id = (body.appointmentId ?? body.appointment?.appointmentId) as string;
  expect(id, "a API devia devolver o appointmentId").toBeTruthy();
  return { id, nome };
}

async function doDia(request: APIRequestContext, h: Record<string, string>): Promise<{ appointmentId: string; time: string; date: string }[]> {
  const res = await request.get(`${API}/schedule/appointments?from=${DIA}&to=${DIA}`, { headers: h });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (Array.isArray(body) ? body : body.rows ?? []) as { appointmentId: string; time: string; date: string }[];
}

/** Arrasta a marcação `nome` na vertical, `deltaMin` minutos (ponteiro de rato, em passos como um gesto real). */
async function arrastar(page: Page, nome: string, deltaMin: number): Promise<void> {
  // O cartão da grelha começa pelo intervalo («10:00–10:30 Nome»); o da lista do dia, pelo nome — só o da grelha se arrasta.
  const btn = page.getByRole("button", { name: new RegExp(String.raw`^\d{2}:\d{2}[–-]\d{2}:\d{2} ` + nome) });
  await expect(btn).toBeVisible({ timeout: 15_000 });
  await btn.evaluate((el) => el.scrollIntoView({ block: "center", inline: "center" }));
  const box = (await btn.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(box.height / 2, 12);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 12, { steps: 4 }); // passa o limiar de 8 px que arma o arrasto
  await page.mouse.move(x, y + (deltaMin / 60) * ROW_H, { steps: 12 });
  await page.mouse.up();
}

async function abrirSemana(page: Page, context: import("@playwright/test").BrowserContext): Promise<void> {
  await withSessionRetry(
    page,
    context,
    "tenantA@e2e",
    () => page.goto(`/agenda?data=${DIA}`),
    () => expect(page.getByRole("button", { name: "Nova marcação" })).toBeVisible({ timeout: 15_000 }),
  );
}

for (const vp of LARGURAS) {
  test.describe(`Agenda — reagendar por arrastar (${vp.label})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    test.describe.configure({ retries: 0 });

    let criadas: Marcacao[] = [];
    let h: Record<string, string> = {};

    test.afterEach(async ({ request }) => {
      for (const m of criadas) await request.delete(`${API}/schedule/appointments/${m.id}`, { headers: h }).catch(() => undefined);
      criadas = [];
    });

    async function preparar(request: APIRequestContext, horas: string[]): Promise<Marcacao[]> {
      h = await tokenDoTenantA(request);
      const sv = await request.get(`${API}/schedule/services`, { headers: h });
      expect(sv.ok()).toBeTruthy();
      const lista = await sv.json();
      const servicos = (Array.isArray(lista) ? lista : lista.rows ?? []) as { serviceId: string; active?: boolean }[];
      const serviceId = (servicos.find((s) => s.active !== false) ?? servicos[0])?.serviceId;
      expect(serviceId, "o tenantA devia ter um serviço semeado").toBeTruthy();
      const tag = `${vp.label}-${Date.now()}`;
      const out: Marcacao[] = [];
      for (const [i, hora] of horas.entries()) {
        const m = await criar(request, h, serviceId, `DragE2E${i}-${tag}`, hora);
        criadas.push(m);
        out.push(m);
      }
      return out;
    }

    test("mover para outra hora abre o 'Reagendado' e só o Guardar grava a hora nova (PUT certo)", async ({ page, context, request }) => {
      const [m] = await preparar(request, ["10:00"]);
      await loginAs(context, "tenantA@e2e");
      await abrirSemana(page, context);

      await arrastar(page, m.nome, 120); // 10:00 → 12:00

      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText("Reagendado")).toBeVisible({ timeout: 10_000 });
      // Ainda NÃO gravou: a marcação continua às 10:00 na API.
      expect((await doDia(request, h)).find((a) => a.appointmentId === m.id)?.time).toMatch(/^10:00/);

      const put = page.waitForRequest((r) => r.method() === "PUT" && r.url().includes(`/schedule/appointments/${m.id}`));
      await dialog.getByRole("button", { name: "Guardar" }).click();
      const corpo = (await put).postDataJSON();
      expect(corpo).toMatchObject({ time: "12:00" });
      // O PUT leva só o que mudou: o dia não vai (ou, se for, é o mesmo).
      expect(corpo.date ?? DIA).toBe(DIA);
      await expect(page.getByText("Marcação actualizada")).toBeVisible({ timeout: 10_000 });

      await expect.poll(async () => (await doDia(request, h)).find((a) => a.appointmentId === m.id)?.time).toMatch(/^12:00/);
    });

    test("cancelar o 'Reagendado' (fechar a modal) não grava nada", async ({ page, context, request }) => {
      const [m] = await preparar(request, ["10:00"]);
      await loginAs(context, "tenantA@e2e");
      await abrirSemana(page, context);

      await arrastar(page, m.nome, 60);
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText("Reagendado")).toBeVisible({ timeout: 10_000 });
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();

      expect((await doDia(request, h)).find((a) => a.appointmentId === m.id)?.time).toMatch(/^10:00/);
    });

    test("AG-02: arrastar POR CIMA de outra marcação (pai e filho à mesma hora) é aceite, sem erro", async ({ page, context, request }) => {
      const [pai, filho] = await preparar(request, ["10:00", "11:00"]);
      await loginAs(context, "tenantA@e2e");
      await abrirSemana(page, context);

      await arrastar(page, filho.nome, -60); // 11:00 → 10:00, exactamente onde está o "pai"

      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText("Reagendado")).toBeVisible({ timeout: 10_000 });
      // O BO não avisa nem recusa a sobreposição.
      await expect(page.getByText(/ocupad|sobrepos|conflito|SLOT_TAKEN/i)).toHaveCount(0);

      const put = page.waitForResponse((r) => r.request().method() === "PUT" && r.url().includes(`/schedule/appointments/${filho.id}`));
      await dialog.getByRole("button", { name: "Guardar" }).click();
      const resposta = await put;
      expect(resposta.status(), "o PUT por cima de outra marcação devia ser aceite").toBeLessThan(300);
      await expect(page.getByText("Marcação actualizada")).toBeVisible({ timeout: 10_000 });

      await expect
        .poll(async () => {
          const dia = await doDia(request, h);
          return [pai.id, filho.id].map((id) => dia.find((a) => a.appointmentId === id)?.time?.slice(0, 5));
        })
        .toEqual(["10:00", "10:00"]);
    });
  });
}
