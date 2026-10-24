import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { API } from "./login";
import { apiLogin } from "./support";

/**
 * Ajudantes do B57 F3 (dinheiro e dívida vêm da API): criam serviços/clientes/marcações pela API do próprio tenant
 * (sem tocar nos dados semeados) e limpam no fim. Regras: AG-06, AG-07, AG-18, AG-19, AG-20.
 */

export type Headers = Record<string, string>;

export const LARGURAS = [
  { label: "1440", width: 1440, height: 900 },
  { label: "834", width: 834, height: 1112 },
  { label: "390", width: 390, height: 844 },
] as const;

/**
 * Regex para um euro escrito pelo `fmtEur` (Intl pt-PT): recebe o número já em pt-PT, com vírgula decimal (`eur("12,50")`), e aceita
 * antes do € um espaço normal, NBSP (U+00A0) ou NBSP estreito (U+202F). Os pontos do texto são literais — pt-PT não usa ponto de milhares.
 */
export const eur = (txt: string) => new RegExp(txt.split(".").join("[.]") + "[ " + String.fromCharCode(160, 8239) + "]€");

export async function login(request: APIRequestContext, email: string): Promise<Headers> {
  return (await apiLogin(request, email)).headers;
}

export async function mkService(request: APIRequestContext, h: Headers, price: number, tag: string): Promise<string> {
  const res = await request.post(`${API}/schedule/services`, { headers: h, data: { contentKey: `svc.e2e.dinheiro.${tag}`, duration: 15, price, active: true } });
  expect(res.ok(), `criar serviço (${res.status()}) ${await res.text()}`).toBeTruthy();
  return ((await res.json()) as { serviceId: string }).serviceId;
}

export async function mkCustomer(request: APIRequestContext, h: Headers, name: string): Promise<string> {
  const res = await request.post(`${API}/customers`, { headers: h, data: { name, email: `${name.toLowerCase().replace(/\W+/g, ".")}@e2e.local`, contact: "910000299" } });
  expect(res.ok(), `criar cliente (${res.status()}) ${await res.text()}`).toBeTruthy();
  return ((await res.json()) as { customerId: string }).customerId;
}

export async function mkAppt(
  request: APIRequestContext,
  h: Headers,
  o: { date: string; time: string; serviceId: string; name: string; customerId?: string },
): Promise<string> {
  const res = await request.post(`${API}/schedule/appointments`, {
    headers: h,
    data: { date: o.date, time: o.time, serviceId: o.serviceId, clientName: o.name, clientEmail: "", clientPhone: "910000298", ...(o.customerId ? { customerId: o.customerId } : {}) },
  });
  expect(res.ok(), `criar marcação ${o.name} (${res.status()}) ${await res.text()}`).toBeTruthy();
  const body = await res.json();
  return (body.appointmentId ?? body.appointment?.appointmentId) as string;
}

/** Regista o pagamento (a API conclui a marcação — AG-06). */
export async function pay(request: APIRequestContext, h: Headers, id: string, data: { paymentCash?: number; paymentMbway?: number; paymentCard?: number }) {
  const res = await request.put(`${API}/schedule/appointments/${id}`, { headers: h, data });
  expect(res.ok(), `pagar ${id} (${res.status()}) ${await res.text()}`).toBeTruthy();
}

export async function getAppt(request: APIRequestContext, h: Headers, id: string) {
  const res = await request.get(`${API}/schedule/appointments/${id}`, { headers: h });
  expect(res.ok(), `ler marcação ${id}`).toBeTruthy();
  return (await res.json()) as Record<string, any>;
}

export async function delAppts(request: APIRequestContext, h: Headers, ids: string[]) {
  for (const id of ids) await request.delete(`${API}/schedule/appointments/${id}`, { headers: h }).catch(() => undefined);
}

export async function delService(request: APIRequestContext, h: Headers, id: string) {
  await request.delete(`${API}/schedule/services/${id}`, { headers: h }).catch(() => undefined);
}

/** Sem scroll horizontal na página (1440/834/390). */
export async function expectNoHScroll(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over, "a página tem scroll horizontal").toBeLessThanOrEqual(1);
}
