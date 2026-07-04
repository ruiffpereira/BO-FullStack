import type { SiteBlock } from "../hooks/useWebsite";

/**
 * Catálogo dos tipos de bloco suportados pelo renderer do site-engine
 * (`site-engine/components/BlockRenderer.tsx`, fonte de verdade — ver
 * `.design`/CLAUDE.md do Backoffice). Fonte única para o gestor de blocos por
 * página (T24): labels/descrições em PT, tokens (type/variant/campo) em EN.
 *
 * `nav`/`footer` são chrome do site (fora do array `blocks` de uma página) —
 * não entram aqui. `contentRef` (ligação a uma entrada CMS) fica por construir
 * — o renderer trata-o como TODO; só se edita conteúdo inline
 * (`block.settings.content[locale]`).
 */

// ── DSL de campos ─────────────────────────────────────────────────────────────

export type PrimitiveFieldType = "text" | "url" | "image" | "boolean" | "textareaLines";

export interface PrimitiveField {
  key: string;
  label: string;
  type: PrimitiveFieldType;
  required?: boolean;
  hint?: string;
}

/** Lista de strings simples (ex.: parágrafos, horários). */
export interface StringListField {
  key: string;
  label: string;
  type: "stringList";
  itemLabel?: string;
}

/** Lista de objetos, cada um com o seu próprio conjunto de campos primitivos. */
export interface ItemsField {
  key: string;
  label: string;
  type: "items";
  itemFields: PrimitiveField[];
  itemLabel?: string;
}

export type FieldSchema = PrimitiveField | StringListField | ItemsField;

export interface BlockVariantOption {
  id: string;
  label: string;
}

export interface BlockTypeSchema {
  type: string;
  label: string;
  description: string;
  group: "content" | "functional";
  variants: BlockVariantOption[];
  defaultVariant: string;
  /** Ausente = editor genérico chave/valor (fallback só para tipos desconhecidos). */
  fields?: FieldSchema[];
  /**
   * Nota PT curta mostrada no topo do formulário — só os 4 tipos funcionais a
   * usam, para explicar que o bloco puxa/produz dados reais do negócio (Agenda/
   * Loja/Ginásio/Clientes) e não é conteúdo de marketing normal.
   */
  dataHint?: string;
}

// ── Helpers de construção ──────────────────────────────────────────────────────

function text(key: string, label: string, opts: { required?: boolean; hint?: string } = {}): PrimitiveField {
  return { key, label, type: "text", ...opts };
}
function url(key: string, label: string, opts: { required?: boolean; hint?: string } = {}): PrimitiveField {
  return { key, label, type: "url", ...opts };
}
/** Campo de imagem — uploader (com opção de colar URL) em vez de texto simples; o valor persistido continua a ser uma URL string. */
function image(key: string, label: string, opts: { required?: boolean; hint?: string } = {}): PrimitiveField {
  return { key, label, type: "image", ...opts };
}
function boolean(key: string, label: string): PrimitiveField {
  return { key, label, type: "boolean" };
}
function textareaLines(key: string, label: string): PrimitiveField {
  return { key, label, type: "textareaLines" };
}
function stringList(key: string, label: string, itemLabel?: string): StringListField {
  return { key, label, type: "stringList", itemLabel };
}
function items(
  key: string,
  label: string,
  itemFields: PrimitiveField[],
  itemLabel?: string,
): ItemsField {
  return { key, label, type: "items", itemFields, itemLabel };
}

// ── Catálogo ────────────────────────────────────────────────────────────────

/**
 * Ordem: 11 tipos de conteúdo/marketing (formulário rico) seguidos dos 4
 * funcionais (também formulário rico — ligam a dados reais do negócio, por
 * isso trazem `dataHint` a explicar a fonte dos dados).
 */
export const BLOCK_SCHEMAS: BlockTypeSchema[] = [
  {
    type: "hero",
    label: "Hero",
    description: "Destaque principal — título, subtítulo e botão",
    group: "content",
    variants: [
      { id: "centered", label: "Centrado" },
      { id: "split", label: "Dividido" },
      { id: "full", label: "Ecrã inteiro" },
    ],
    defaultVariant: "centered",
    fields: [
      text("eyebrow", "Eyebrow", { hint: "Texto pequeno acima do título" }),
      text("title", "Título"),
      text("subtitle", "Subtítulo"),
      text("ctaLabel", "Texto do botão"),
      url("ctaHref", "Destino do botão", { hint: "Link ou #âncora" }),
      image("imageUrl", "Imagem"),
    ],
  },
  {
    type: "about",
    label: "Sobre",
    description: "Texto sobre o negócio, com imagem",
    group: "content",
    variants: [
      { id: "text-image", label: "Texto + imagem" },
      { id: "text", label: "Só texto" },
    ],
    defaultVariant: "text-image",
    fields: [
      text("eyebrow", "Eyebrow"),
      text("title", "Título"),
      stringList("body", "Parágrafos", "parágrafo"),
      image("imageUrl", "Imagem"),
    ],
  },
  {
    type: "stats",
    label: "Estatísticas",
    description: "Números em destaque (ex.: anos de experiência, clientes)",
    group: "content",
    variants: [
      { id: "row", label: "Linha" },
      { id: "band", label: "Faixa" },
    ],
    defaultVariant: "row",
    fields: [
      items("items", "Estatísticas", [text("value", "Valor"), text("label", "Legenda")], "estatística"),
    ],
  },
  {
    type: "services",
    label: "Serviços",
    description: "Lista de serviços ou produtos com preço",
    group: "content",
    variants: [
      { id: "grid", label: "Grelha" },
      { id: "list", label: "Lista" },
    ],
    defaultVariant: "grid",
    fields: [
      text("eyebrow", "Eyebrow"),
      text("title", "Título"),
      items(
        "items",
        "Serviços",
        [
          text("title", "Título", { required: true }),
          text("description", "Descrição"),
          text("price", "Preço"),
        ],
        "serviço",
      ),
    ],
  },
  {
    type: "gallery",
    label: "Galeria",
    description: "Grelha de imagens",
    group: "content",
    variants: [
      { id: "grid", label: "Grelha" },
      { id: "masonry", label: "Mosaico" },
      { id: "carousel", label: "Carrossel" },
    ],
    defaultVariant: "grid",
    fields: [
      items(
        "images",
        "Imagens",
        [image("url", "Imagem", { required: true }), text("alt", "Texto alternativo")],
        "imagem",
      ),
    ],
  },
  {
    type: "testimonials",
    label: "Testemunhos",
    description: "Opiniões e avaliações de clientes",
    group: "content",
    variants: [
      { id: "grid", label: "Grelha" },
      { id: "carousel", label: "Carrossel" },
    ],
    defaultVariant: "grid",
    fields: [
      text("eyebrow", "Eyebrow"),
      text("title", "Título"),
      items(
        "items",
        "Testemunhos",
        [
          text("quote", "Testemunho", { required: true }),
          text("author", "Autor"),
          text("role", "Cargo/função"),
        ],
        "testemunho",
      ),
    ],
  },
  {
    type: "cta",
    label: "Chamada à ação",
    description: "Bloco de destaque com botão — normalmente no fim da página",
    group: "content",
    variants: [
      { id: "simple", label: "Simples" },
      { id: "with-image", label: "Com imagem" },
    ],
    defaultVariant: "simple",
    fields: [
      text("title", "Título"),
      text("subtitle", "Subtítulo"),
      text("ctaLabel", "Texto do botão"),
      url("ctaHref", "Destino do botão"),
      image("imageUrl", "Imagem"),
    ],
  },
  {
    type: "faq",
    label: "Perguntas frequentes",
    description: "Perguntas e respostas em acordeão",
    group: "content",
    // Único variante — sem seletor (a Row mostra um Badge fixo "Acordeão").
    variants: [{ id: "accordion", label: "Acordeão" }],
    defaultVariant: "accordion",
    fields: [
      text("eyebrow", "Eyebrow"),
      text("title", "Título"),
      items(
        "items",
        "Perguntas",
        [text("question", "Pergunta"), text("answer", "Resposta")],
        "pergunta",
      ),
    ],
  },
  {
    type: "pricing",
    label: "Preços",
    description: "Planos e tarifários, com destaque opcional",
    group: "content",
    variants: [
      { id: "cards", label: "Cartões" },
      { id: "table", label: "Tabela" },
    ],
    defaultVariant: "cards",
    fields: [
      text("eyebrow", "Eyebrow"),
      text("title", "Título"),
      items(
        "plans",
        "Planos",
        [
          text("name", "Nome"),
          text("price", "Preço"),
          text("period", "Período"),
          textareaLines("features", "Funcionalidades (uma por linha)"),
          boolean("highlighted", "Destacado"),
          text("ctaLabel", "Texto do botão"),
          url("ctaHref", "Destino do botão"),
        ],
        "plano",
      ),
    ],
  },
  {
    type: "contact",
    label: "Contactos",
    description: "Morada, telefone, email, horário e mapa",
    group: "content",
    variants: [
      { id: "split", label: "Dividido" },
      { id: "stack", label: "Empilhado" },
    ],
    defaultVariant: "split",
    fields: [
      text("eyebrow", "Eyebrow"),
      text("title", "Título"),
      text("address", "Morada"),
      text("phone", "Telefone"),
      text("email", "Email"),
      stringList("hours", "Horário", "horário"),
      url("mapEmbedUrl", "Mapa (embed)", { hint: "Tem de começar por http(s)://" }),
    ],
  },
  {
    type: "collection",
    label: "Coleção",
    description: "Listagem tipo portfólio/blog — cada item abre uma ficha própria",
    group: "content",
    variants: [
      { id: "grid", label: "Grelha" },
      { id: "list", label: "Lista" },
    ],
    defaultVariant: "grid",
    fields: [
      text("eyebrow", "Eyebrow"),
      text("title", "Título"),
      text("subtitle", "Subtítulo"),
      text("emptyMsg", "Mensagem sem itens", {
        hint: 'Mostrada enquanto não há itens (ou o filtro por tag não encontra nenhum). Por omissão: "Ainda não há itens para mostrar."',
      }),
      items(
        "items",
        "Itens",
        [
          text("slug", "Slug", {
            required: true,
            hint: "Identifica o item no URL da ficha (ex.: projeto-a) — só letras, números e hífens",
          }),
          text("title", "Título"),
          text("summary", "Resumo"),
          image("image", "Imagem"),
          textareaLines("tags", "Tags (uma por linha)"),
          textareaLines("body", "Texto da ficha (um parágrafo por linha)"),
        ],
        "item",
      ),
    ],
  },
  // ── Funcionais (formulário rico + `dataHint` — ligam a dados reais) ─────────
  {
    type: "booking",
    label: "Marcações",
    description: "Marcações — liga à agenda real do negócio",
    group: "functional",
    variants: [
      { id: "inline", label: "Inline" },
      { id: "card", label: "Cartão" },
    ],
    defaultVariant: "inline",
    dataHint:
      "Os serviços e os horários disponíveis vêm da tua Agenda — este bloco só edita os textos à volta do formulário de marcação.",
    fields: [
      text("eyebrow", "Eyebrow"),
      text("title", "Título"),
      text("subtitle", "Subtítulo"),
      text("successTitle", "Título de confirmação", {
        hint: "Mostrado depois de a marcação ficar confirmada",
      }),
      text("notesLabel", "Etiqueta do campo de notas"),
      text("authTitle", "Título do painel de identificação", {
        hint: "Mostrado ao cliente antes de entrar/criar conta para confirmar a marcação",
      }),
      text("loggedInAs", 'Texto "sessão iniciada como"'),
      text("logoutLabel", "Texto do link para sair da sessão"),
      text("servicesUnavailableMsg", "Mensagem quando não há serviços disponíveis"),
      text("bookingErrorMsg", "Mensagem de erro ao confirmar a marcação"),
      text("successEmailNote", "Nota sobre o email de confirmação"),
      text("newBookingLabel", 'Texto do botão "fazer nova marcação"'),
    ],
  },
  {
    type: "products",
    label: "Produtos",
    description: "Montra de produtos da loja",
    group: "functional",
    variants: [
      { id: "grid", label: "Grelha" },
      { id: "featured", label: "Destaque" },
    ],
    defaultVariant: "grid",
    dataHint: "Os produtos vêm da tua Loja — este bloco mostra o catálogo real, não uma lista editável aqui.",
    fields: [
      text("eyebrow", "Eyebrow"),
      text("title", "Título"),
      text("ctaLabel", "Texto do botão de cada produto"),
      text("unavailableMsg", "Mensagem sem produtos disponíveis"),
    ],
  },
  {
    type: "gym",
    label: "Ginásio",
    description: "Planos e chamada à ação do ginásio",
    group: "functional",
    variants: [
      { id: "cta", label: "Chamada à ação" },
      { id: "plans", label: "Planos" },
    ],
    defaultVariant: "cta",
    dataHint:
      "Este bloco é só marketing — os planos aqui são texto livre, não vêm das mensalidades reais (essas ficam em Financeiro → Ginásio). Aponta o botão para a tua página de inscrição/PWA.",
    fields: [
      text("eyebrow", "Eyebrow"),
      text("title", "Título"),
      text("subtitle", "Subtítulo"),
      text("ctaLabel", "Texto do botão"),
      url("ctaHref", "Destino do botão", { hint: "Por omissão aponta para #contacto (o bloco de Captação de leads da página)" }),
      image("imageUrl", "Imagem", { hint: 'Só aparece na variante "Chamada à ação"' }),
      stringList("benefits", "Benefícios", "benefício"),
      items(
        "plans",
        'Planos (variante "Planos")',
        [
          text("name", "Nome", { required: true }),
          text("price", "Preço", { required: true }),
          text("period", "Período", { hint: "ex.: /mês" }),
          textareaLines("features", "Vantagens (uma por linha)"),
          boolean("highlighted", "Destacado"),
          text("ctaLabel", "Texto do botão"),
          url("ctaHref", "Destino do botão"),
        ],
        "plano",
      ),
    ],
  },
  {
    type: "lead",
    label: "Captação de leads",
    description: "Formulário de contacto/captação de leads",
    group: "functional",
    variants: [
      { id: "split", label: "Dividido" },
      { id: "stack", label: "Empilhado" },
    ],
    defaultVariant: "split",
    dataHint: "Os envios criam clientes novos na tua base (visíveis em Clientes) — não é só texto de marketing.",
    fields: [
      text("eyebrow", "Eyebrow"),
      text("title", "Título"),
      text("subtitle", "Subtítulo"),
      stringList("benefits", "Benefícios", "benefício"),
      boolean("withMessage", "Mostrar campo de mensagem (ligado por omissão)"),
      text("labelName", "Etiqueta do campo Nome"),
      text("labelEmail", "Etiqueta do campo Email"),
      text("labelPhone", "Etiqueta do campo Telefone"),
      text("labelMessage", "Etiqueta do campo Mensagem"),
      text("submitLabel", "Texto do botão de enviar"),
      text("thanks", "Mensagem de agradecimento", { hint: "Mostrada depois de enviar o formulário" }),
      text("anchorId", "Identificador da âncora", {
        hint: "Só precisas de mudar se tiveres mais do que um formulário de contacto nesta página",
      }),
    ],
  },
];

export const BLOCK_GROUPS: { id: "content" | "functional"; label: string }[] = [
  { id: "content", label: "Conteúdo / marketing" },
  { id: "functional", label: "Funcionais" },
];

const BLOCK_SCHEMA_MAP: Record<string, BlockTypeSchema> = Object.fromEntries(
  BLOCK_SCHEMAS.map((s) => [s.type, s]),
);

/**
 * Schema para um tipo desconhecido (fora dos 15 suportados pelo renderer):
 * sem campos ricos → cai no editor genérico chave/valor, e sem variantes.
 */
function fallbackSchema(type: string): BlockTypeSchema {
  return {
    type,
    label: type,
    description: "Tipo de bloco personalizado.",
    group: "functional",
    variants: [],
    defaultVariant: "",
  };
}

/** Devolve o schema do tipo, ou um fallback genérico se o tipo for desconhecido. */
export function getBlockSchema(type: string): BlockTypeSchema {
  return BLOCK_SCHEMA_MAP[type] ?? fallbackSchema(type);
}

/** Resolve o conteúdo localizado de um bloco (mesma regra do renderer: locale → defaultLocale → {}). */
function resolveContent(
  block: SiteBlock,
  locale: string,
  defaultLocale: string,
): Record<string, unknown> {
  const map = block.settings?.content ?? {};
  return (map[locale] ?? map[defaultLocale] ?? {}) as Record<string, unknown>;
}

/**
 * Texto curto para a linha do bloco na lista: o título resolvido se existir,
 * senão a contagem de itens de um campo tipo lista, senão o label do tipo.
 */
export function summarizeBlock(block: SiteBlock, locale: string, defaultLocale: string): string {
  const content = resolveContent(block, locale, defaultLocale);
  const schema = getBlockSchema(block.type);

  const title = content["title"];
  if (typeof title === "string" && title.trim()) return title.trim();

  const listField = schema.fields?.find((f) => f.type === "items" || f.type === "stringList");
  const primaryList = listField ? content[listField.key] : undefined;
  if (Array.isArray(primaryList)) {
    return primaryList.length === 1 ? "1 item" : `${primaryList.length} itens`;
  }

  for (const value of Object.values(content)) {
    if (Array.isArray(value)) {
      return value.length === 1 ? "1 item" : `${value.length} itens`;
    }
  }

  return schema.label;
}
