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
  /**
   * Legacy (U3 do port tifas, 2026-07-29): tipo sem equivalente tifas — sai da
   * palete (não é adicionável) mas continua editável em páginas antigas que já
   * o tenham. Quando ganhar versão tifas, remover a flag.
   */
  legacy?: boolean;
  variants: BlockVariantOption[];
  defaultVariant: string;
  /** Ausente = editor genérico chave/valor (fallback só para tipos desconhecidos). */
  fields?: FieldSchema[];
  /**
   * Campos específicos por variante — se definido, sobrepõe `fields` para uma variante específica.
   * Útil quando variantes (ex: "split" do tipo "hero") precisam de campos muito diferentes.
   */
  variantFields?: Record<string, FieldSchema[]>;
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
    // U3 (opção A): as variantes genéricas foram removidas do renderer — o
    // design padrão é O design da plataforma (qualquer variante desconhecida rende
    // o padrão no engine, por isso blocos antigos continuam a abrir).
    variants: [{ id: "split", label: "Split com widget" }],
    defaultVariant: "split",
    fields: [
      text("eyebrow", "Eyebrow", { hint: "Texto pequeno acima do título" }),
      text("title", "Título"),
      text("subtitle", "Subtítulo"),
      text("ctaLabel", "Texto do botão"),
      url("ctaHref", "Destino do botão", { hint: "Link ou #âncora" }),
      image("imageUrl", "Imagem"),
    ],
    variantFields: {
      "split": [
        image("logo", "Logótipo (80×80px)", { required: true }),
        text("badge", "Badge de status", { hint: "ex: Agora aberto" }),
        text("titulo", "Título do negócio", { required: true }),
        text("tagline", "Tagline"),
        // Estatísticas (3 campos planos: stat1.valor, stat1.label, etc.)
        text("stat1.valor", "Estatística 1 — Valor"),
        text("stat1.label", "Estatística 1 — Rótulo"),
        text("stat2.valor", "Estatística 2 — Valor"),
        text("stat2.label", "Estatística 2 — Rótulo"),
        text("stat3.valor", "Estatística 3 — Valor"),
        text("stat3.label", "Estatística 3 — Rótulo"),
        // Contacto — o cartão tem título e rótulos próprios, todos editáveis
        // (nenhum texto visível ao cliente final pode ficar preso no código).
        text("contacto.titulo", "Cartão de contacto — Título", { hint: "ex: Onde nos encontrar" }),
        text("contacto.morada.label", "Cartão de contacto — Rótulo da morada", { hint: "ex: Morada" }),
        text("contacto.horario.label", "Cartão de contacto — Rótulo do horário", { hint: "ex: Horário" }),
        text("contacto.morada1", "Morada (linha 1)"),
        text("contacto.morada2", "Morada (linha 2)"),
        url("contacto.mapa_url", "Link Google Maps"),
        text("contacto.horario.dias", "Dias abertos (ex: Seg-Sex)"),
        text("contacto.horario.manha", "Horário manhã (ex: 09h-13h)"),
        text("contacto.horario.tarde", "Horário tarde (ex: 14h-19h)"),
        text("contacto.telefone", "Telefone"),
        text("contacto.telefone.href", "Telefone (apenas dígitos)", { hint: "ex: 911234567" }),
        // Redes sociais
        url("redes.instagram", "Instagram URL"),
        url("redes.facebook", "Facebook URL"),
        url("redes.whatsapp", "WhatsApp URL"),
        // Cabeçalho do painel da direita. O cartão e o cabeçalho são desenhados
        // pelo HERO (o widget lá dentro entra sem moldura), por isso estes
        // campos vivem aqui e não no bloco de marcação.
        text("booking.eyebrow", "Painel — Eyebrow", { hint: "ex: Marcações online" }),
        text("booking.titulo", "Painel — Título (1.ª linha)"),
        text("booking.subtitulo", "Painel — Título (2.ª linha)"),
        // Etiquetas dos 3 passos do widget de marcação
        text("step1Label", "Passo 1 — Etiqueta", { hint: "ex: Escolhe o serviço" }),
        text("step2Label", "Passo 2 — Etiqueta", { hint: "ex: Escolhe a data e hora" }),
        text("step3Label", "Passo 3 — Etiqueta", { hint: "ex: Confirma a marcação" }),
      ],
    },
  },
  {
    type: "about",
    label: "Sobre",
    description: "Texto sobre o negócio, com imagem",
    group: "content",
    variants: [{ id: "portrait", label: "Retrato" }],
    defaultVariant: "portrait",
    fields: [
      text("eyebrow", "Eyebrow"),
      text("title", "Título"),
      stringList("body", "Parágrafos", "parágrafo"),
      image("imageUrl", "Imagem"),
    ],
    variantFields: {
      "portrait": [
        text("label", "Eyebrow/Badge", { hint: "ex: SOBRE" }),
        text("titulo", "Título", { required: true }),
        text("corpo1", "Primeiro parágrafo"),
        text("corpo2", "Segundo parágrafo"),
        image("foto", "Foto (aspect 4:5, retrato)"),
        stringList("especialidades", "Especialidades", "especialidade"),
      ],
    },
  },
  {
    type: "stats",
    legacy: true,
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
    legacy: true,
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
    variants: [{ id: "grid", label: "Grelha" }],
    defaultVariant: "grid",
    fields: [
      items(
        "images",
        "Imagens",
        [image("url", "Imagem", { required: true }), text("alt", "Texto alternativo")],
        "imagem",
      ),
    ],
    variantFields: {
      "grid": [
        text("label", "Eyebrow/Badge", { hint: "ex: GALERIA" }),
        text("titulo", "Título da página"),
        text("descricao", "Descrição"),
        text("altText", "Texto alternativo padrão", { hint: "Usado para todas as imagens" }),
        items(
          "photos",
          "Fotografias (9 fotos)",
          [image("url", "Foto", { required: true }), text("alt", "Descrição da foto")],
          "foto",
        ),
      ],
    },
  },
  {
    type: "testimonials",
    legacy: true,
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
    legacy: true,
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
    legacy: true,
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
    legacy: true,
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
    legacy: true,
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
    variants: [{ id: "default", label: "Padrão" }],
    defaultVariant: "default",
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
    variantFields: {
      "default": [
        text("eyebrow", "Eyebrow/Badge", { hint: "ex: MARCAÇÃO" }),
        text("title", "Título do widget"),
        text("subtitle", "Subtítulo do widget"),
        text("successTitle", "Título de confirmação"),
        text("authTitle", "Título de autenticação"),
        text("loggedInAs", "Texto de sessão iniciada"),
        text("logoutLabel", "Texto do botão de logout"),
        text("notesLabel", "Etiqueta do campo de notas"),
        text("step1Label", "Rótulo passo 1 (Serviço)"),
        text("step2Label", "Rótulo passo 2 (Data & Hora)"),
        text("step3Label", "Rótulo passo 3 (Confirmação)"),
        text("pickServiceLabel", "Texto: escolhe um serviço"),
        text("loadingServicesLabel", "Texto: a carregar serviços"),
        text("servicesUnavailableMsg", "Mensagem: serviços indisponíveis"),
        text("noSlotsMsg", "Mensagem: sem horários neste dia"),
        text("loadingSlotsMsg", "Texto: a carregar horários"),
        text("slotsErrorMsg", "Mensagem de erro ao carregar slots"),
        text("retryLabel", "Texto do botão tentar novamente"),
        text("bookingErrorMsg", "Mensagem de erro ao criar marcação"),
        text("slotTakenMsg", "Mensagem: slot já ocupado"),
        text("sessionExpiredMsg", "Mensagem: sessão expirada"),
        text("suspendedMsg", "Mensagem: conta suspensa"),
        text("successEmailNote", "Nota sobre email de confirmação"),
        text("newBookingLabel", "Texto: fazer nova marcação"),
        text("googleCalLabel", "Texto: adicionar ao Google Calendar"),
        text("webcalLabel", "Texto: subscrever no calendário"),
        text("demoDoneMsg", "Mensagem de demonstração (demo mode)"),
      ],
    },
  },
  {
    type: "products",
    label: "Produtos",
    description: "Montra de produtos da loja",
    group: "functional",
    variants: [{ id: "default", label: "Padrão" }],
    defaultVariant: "default",
    dataHint: "Os produtos vêm da tua Loja — este bloco mostra o catálogo real, não uma lista editável aqui.",
    fields: [
      text("eyebrow", "Eyebrow"),
      text("title", "Título"),
      text("ctaLabel", "Texto do botão de cada produto"),
      text("unavailableMsg", "Mensagem sem produtos disponíveis"),
    ],
    variantFields: {
      "default": [
        text("label", "Eyebrow/Badge", { hint: "ex: PRODUTOS" }),
        text("title", "Título"),
        text("subtitle", "Subtítulo"),
        text("ctaLabel", "Texto do botão"),
        text("unavailableMsg", "Mensagem sem produtos"),
      ],
    },
  },
  {
    type: "gym",
    label: "Ginásio",
    description: "Planos e chamada à ação do ginásio",
    group: "functional",
    variants: [{ id: "default", label: "Padrão" }],
    defaultVariant: "default",
    dataHint:
      "Este bloco é só marketing — os planos aqui são texto livre, não vêm das mensalidades reais (essas ficam em Financeiro → Ginásio). O botão NÃO cria uma conta de sócio: podes apontá-lo para /inscrever (formulário de interesse — o ginásio entra em contacto depois) ou para #contacto. A inscrição efetiva continua a ser sempre por CONVITE teu (Financeiro → Ginásio → Convidar sócio), nunca self-serve.",
    fields: [
      text("eyebrow", "Eyebrow"),
      text("title", "Título"),
      text("subtitle", "Subtítulo"),
      text("ctaLabel", "Texto do botão"),
      url("ctaHref", "Destino do botão", { hint: "Por omissão aponta para #contacto (o bloco de Captação de leads da página); podes apontar para /inscrever (formulário de interesse do ginásio)" }),
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
    variantFields: {
      "default": [
        text("label", "Eyebrow/Badge", { hint: "ex: GINÁSIO" }),
        text("title", "Título"),
        text("subtitle", "Subtítulo"),
        text("ctaLabel", "Texto do botão"),
        url("ctaHref", "Destino do botão"),
        stringList("benefits", "Benefícios", "benefício"),
      ],
    },
  },
  {
    type: "lead",
    label: "Captação de leads",
    description: "Formulário de contacto/captação de leads",
    group: "functional",
    variants: [{ id: "default", label: "Padrão" }],
    defaultVariant: "default",
    dataHint: "Os envios criam leads na tua inbox (Clientes → Leads, com notificação) — não é só texto de marketing.",
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
    variantFields: {
      "default": [
        text("label", "Eyebrow/Badge", { hint: "ex: CONTACTO" }),
        text("title", "Título"),
        text("subtitle", "Subtítulo"),
        boolean("withMessage", "Mostrar campo de mensagem"),
        text("labelName", "Etiqueta do campo Nome"),
        text("labelEmail", "Etiqueta do campo Email"),
        text("labelPhone", "Etiqueta do campo Telefone"),
        text("labelMessage", "Etiqueta do campo Mensagem"),
        text("submitLabel", "Texto do botão de enviar"),
        text("thanks", "Mensagem de agradecimento"),
        text("anchorId", "Identificador da âncora"),
      ],
    },
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

/**
 * Devolve os campos do schema para um bloco específico (type + variant).
 * Se a variante tiver campos específicos em `variantFields`, usa-os; senão, usa `fields`.
 */
/**
 * Nomes de variante ANTIGOS que continuam gravados em sites reais na BD.
 * Sem este mapa, abrir um bloco desses no editor caía nos `fields` genéricos —
 * o tenant perdia o formulário rico (logótipo, estatísticas, contacto, redes)
 * e via 6 campos que não são os do bloco que está publicado.
 * Manter até não haver sites com estes valores; o renderer também os aceita.
 */
const LEGACY_VARIANT_ALIAS: Record<string, string> = {
  "tifas-split": "split",
  tifas: "default",
};

/** Resolve o nome canónico de uma variante, aceitando os nomes legados. */
export function canonicalVariant(type: string, variant?: string): string | undefined {
  if (!variant) return variant;
  const schema = getBlockSchema(type);
  if (schema.variantFields?.[variant] || schema.variants.some((v) => v.id === variant)) {
    return variant;
  }
  const alias = LEGACY_VARIANT_ALIAS[variant];
  // `tifas` significava "a variante única deste tipo" — que hoje tem nomes
  // diferentes por tipo (grid/portrait/default). Cair na variante por omissão
  // do tipo é o que traduz isso corretamente.
  if (alias) return schema.variantFields?.[alias] ? alias : schema.defaultVariant;
  return variant;
}

export function getBlockFields(type: string, variant?: string): FieldSchema[] {
  const schema = getBlockSchema(type);
  const resolved = canonicalVariant(type, variant);
  if (resolved && schema.variantFields && schema.variantFields[resolved]) {
    return schema.variantFields[resolved];
  }
  return schema.fields ?? [];
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
