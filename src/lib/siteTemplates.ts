import type {
  SiteUpsert,
  ThemePreset,
  ThemeAccent,
  ThemeFont,
} from "../hooks/useWebsite";

/**
 * Templates de arranque para o site público do tenant. Cada um é um Site
 * parcial (o corpo aceite pelo PUT /website): template + theme + locales + nav +
 * uma página "home" com blocos que o renderer conhece + footer.
 *
 * Os blocos usam apenas tipos suportados pelo renderer
 * (hero · services · stats · gallery · testimonials · cta · faq) e trazem copy
 * de exemplo inline em PT (`settings.content.pt`) por vertical. Ao escolher um
 * template no Backoffice, este JSON é gravado via useSaveSite; o tenant afina
 * depois nos gestores de página/bloco (fora do âmbito deste ecrã).
 */

export interface SiteTemplate {
  /** Chave estável (= Site.template). */
  id: string;
  /** Nome apresentado no cartão. */
  name: string;
  /** Rótulo da vertical (barbearia, ginásio, …). */
  vertical: string;
  /** Descrição curta para o cartão. */
  description: string;
  /** Cores da miniatura/preview (derivadas do preset+accent). */
  thumb: { bg: string; fg: string; accent: string };
  /** O Site parcial a gravar quando o template é escolhido. */
  site: SiteUpsert;
}

// Miniaturas: aproximações de cor por preset (fundo/texto) + accent.
const PRESET_BG: Record<ThemePreset, string> = {
  slate: "#0f172a",
  sand: "#f5f0e6",
  ink: "#0a0a0a",
  mist: "#eef2f7",
};
const PRESET_FG: Record<ThemePreset, string> = {
  slate: "#e2e8f0",
  sand: "#3b352b",
  ink: "#fafafa",
  mist: "#1f2937",
};
export const ACCENT_HEX: Record<ThemeAccent, string> = {
  blue: "#2a6fdb",
  emerald: "#10b981",
  violet: "#7c3aed",
  amber: "#f59e0b",
  rose: "#e11d48",
  teal: "#0d9488",
  ink: "#111827",
};
export const FONT_STACK: Record<ThemeFont, string> = {
  grotesk: '"Space Grotesk", "Segoe UI", system-ui, sans-serif',
  editorial: 'Georgia, "Times New Roman", serif',
  modern: '"Inter", system-ui, -apple-system, sans-serif',
  warm: '"Nunito", "Segoe UI", system-ui, sans-serif',
  serifbody: '"Source Serif 4", Georgia, serif',
};
export const FONT_LABEL: Record<ThemeFont, string> = {
  grotesk: "Grotesk",
  editorial: "Editorial",
  modern: "Moderno",
  warm: "Acolhedor",
  serifbody: "Serifa",
};
export const PRESET_LABEL: Record<ThemePreset, string> = {
  slate: "Ardósia",
  sand: "Areia",
  ink: "Tinta",
  mist: "Névoa",
};
export const ACCENT_LABEL: Record<ThemeAccent, string> = {
  blue: "Azul",
  emerald: "Esmeralda",
  violet: "Violeta",
  amber: "Âmbar",
  rose: "Rosa",
  teal: "Turquesa",
  ink: "Tinta",
};

export const THEME_PRESETS: ThemePreset[] = ["slate", "sand", "ink", "mist"];
export const THEME_ACCENTS: ThemeAccent[] = [
  "blue",
  "emerald",
  "violet",
  "amber",
  "rose",
  "teal",
  "ink",
];
export const THEME_FONTS: ThemeFont[] = [
  "grotesk",
  "editorial",
  "modern",
  "warm",
  "serifbody",
];

function thumbFor(preset: ThemePreset, accent: ThemeAccent) {
  return { bg: PRESET_BG[preset], fg: PRESET_FG[preset], accent: ACCENT_HEX[accent] };
}

// ── Templates ────────────────────────────────────────────────────────────────

export const SITE_TEMPLATES: SiteTemplate[] = [
  {
    id: "barber",
    name: "Barbearia",
    vertical: "Barbearia · marcações",
    description: "Página focada em serviços e reservas, com estilo escuro e moderno.",
    thumb: thumbFor("ink", "amber"),
    site: {
      template: "barber",
      theme: { preset: "ink", accent: "amber", font: "grotesk", logo: null },
      defaultLocale: "pt",
      activeLocales: ["pt"],
      nav: {
        items: [
          { label: "Serviços", href: "#servicos" },
          { label: "Sobre", href: "#sobre" },
          { label: "Contactos", href: "#contactos" },
        ],
        cta: { label: "Marcar", href: "#marcar" },
      },
      pages: [
        {
          id: "home",
          slug: "",
          titleRef: "",
          inNav: true,
          order: 0,
          kind: "content",
          blocks: [
            {
              id: "hero",
              type: "hero",
              settings: {
                content: {
                  pt: {
                    eyebrow: "Barbearia",
                    title: "Corte afiado, atendimento à altura",
                    subtitle: "Marca a tua vez em segundos. Sem filas, sem esperas.",
                    cta: "Marcar agora",
                  },
                },
              },
            },
            {
              id: "services",
              type: "services",
              settings: {
                content: {
                  pt: {
                    title: "Serviços",
                    items: [
                      { name: "Corte de cabelo", price: "12€" },
                      { name: "Barba", price: "8€" },
                      { name: "Corte + Barba", price: "18€" },
                    ],
                  },
                },
              },
            },
            {
              id: "stats",
              type: "stats",
              settings: {
                content: {
                  pt: {
                    items: [
                      { value: "10+", label: "anos de ofício" },
                      { value: "2k", label: "clientes felizes" },
                      { value: "4.9", label: "avaliação média" },
                    ],
                  },
                },
              },
            },
            {
              id: "gallery",
              type: "gallery",
              settings: {
                content: { pt: { title: "Galeria", images: [] } },
              },
            },
            {
              id: "testimonials",
              type: "testimonials",
              settings: {
                content: {
                  pt: {
                    title: "O que dizem",
                    items: [
                      { quote: "Melhor corte da zona, sem dúvida.", author: "João P." },
                    ],
                  },
                },
              },
            },
            {
              id: "cta",
              type: "cta",
              settings: {
                content: {
                  pt: { title: "Pronto para o teu corte?", cta: "Marcar agora" },
                },
              },
            },
          ],
        },
      ],
      footer: {
        content: {
          pt: { note: "© Barbearia. Todos os direitos reservados." },
        },
      },
    },
  },
  {
    id: "gym",
    name: "Ginásio",
    vertical: "Ginásio · mensalidades",
    description: "Energia e prova social, com destaque para planos e resultados.",
    thumb: thumbFor("slate", "emerald"),
    site: {
      template: "gym",
      theme: { preset: "slate", accent: "emerald", font: "grotesk", logo: null },
      defaultLocale: "pt",
      activeLocales: ["pt"],
      nav: {
        items: [
          { label: "Planos", href: "#planos" },
          { label: "Aulas", href: "#aulas" },
          { label: "Contactos", href: "#contactos" },
        ],
        cta: { label: "Inscrever", href: "#inscrever" },
      },
      pages: [
        {
          id: "home",
          slug: "",
          titleRef: "",
          inNav: true,
          order: 0,
          kind: "content",
          blocks: [
            {
              id: "hero",
              type: "hero",
              settings: {
                content: {
                  pt: {
                    eyebrow: "Ginásio",
                    title: "Treina com propósito",
                    subtitle: "Planos à tua medida, acompanhamento real e resultados que ficam.",
                    cta: "Começar hoje",
                  },
                },
              },
            },
            {
              id: "stats",
              type: "stats",
              settings: {
                content: {
                  pt: {
                    items: [
                      { value: "500+", label: "membros ativos" },
                      { value: "30", label: "aulas por semana" },
                      { value: "24/7", label: "acesso ao espaço" },
                    ],
                  },
                },
              },
            },
            {
              id: "services",
              type: "services",
              settings: {
                content: {
                  pt: {
                    title: "Planos",
                    items: [
                      { name: "Livre trânsito", price: "35€/mês" },
                      { name: "Personalizado", price: "60€/mês" },
                      { name: "Estudante", price: "25€/mês" },
                    ],
                  },
                },
              },
            },
            {
              id: "gallery",
              type: "gallery",
              settings: {
                content: { pt: { title: "O espaço", images: [] } },
              },
            },
            {
              id: "faq",
              type: "faq",
              settings: {
                content: {
                  pt: {
                    title: "Perguntas frequentes",
                    items: [
                      {
                        q: "Preciso de fidelização?",
                        a: "Não. Podes cancelar quando quiseres.",
                      },
                    ],
                  },
                },
              },
            },
            {
              id: "cta",
              type: "cta",
              settings: {
                content: { pt: { title: "Dá o primeiro passo", cta: "Inscrever" } },
              },
            },
          ],
        },
      ],
      footer: {
        content: { pt: { note: "© Ginásio. Vive melhor, treina melhor." } },
      },
    },
  },
  {
    id: "loja",
    name: "Loja",
    vertical: "Loja · ecommerce",
    description: "Vitrine limpa e clara para produtos, com apelo à compra.",
    thumb: thumbFor("mist", "blue"),
    site: {
      template: "loja",
      theme: { preset: "mist", accent: "blue", font: "modern", logo: null },
      defaultLocale: "pt",
      activeLocales: ["pt"],
      nav: {
        items: [
          { label: "Produtos", href: "#produtos" },
          { label: "Sobre", href: "#sobre" },
          { label: "Contactos", href: "#contactos" },
        ],
        cta: { label: "Ver loja", href: "#produtos" },
      },
      pages: [
        {
          id: "home",
          slug: "",
          titleRef: "",
          inNav: true,
          order: 0,
          kind: "content",
          blocks: [
            {
              id: "hero",
              type: "hero",
              settings: {
                content: {
                  pt: {
                    eyebrow: "Loja",
                    title: "Produtos que fazem a diferença",
                    subtitle: "Seleção cuidada, entrega rápida e atendimento próximo.",
                    cta: "Comprar agora",
                  },
                },
              },
            },
            {
              id: "gallery",
              type: "gallery",
              settings: {
                content: { pt: { title: "Em destaque", images: [] } },
              },
            },
            {
              id: "services",
              type: "services",
              settings: {
                content: {
                  pt: {
                    title: "Porquê comprar aqui",
                    items: [
                      { name: "Envio grátis acima de 30€", price: "" },
                      { name: "Devoluções em 30 dias", price: "" },
                      { name: "Pagamento seguro", price: "" },
                    ],
                  },
                },
              },
            },
            {
              id: "testimonials",
              type: "testimonials",
              settings: {
                content: {
                  pt: {
                    title: "Clientes satisfeitos",
                    items: [
                      { quote: "Qualidade excelente e entrega rápida.", author: "Marta S." },
                    ],
                  },
                },
              },
            },
            {
              id: "cta",
              type: "cta",
              settings: {
                content: { pt: { title: "Descobre a nossa loja", cta: "Ver produtos" } },
              },
            },
          ],
        },
      ],
      footer: {
        content: { pt: { note: "© Loja. Compra com confiança." } },
      },
    },
  },
  {
    id: "generic",
    name: "Genérico",
    vertical: "Negócio · geral",
    description: "Ponto de partida neutro, adaptável a qualquer negócio.",
    thumb: thumbFor("sand", "teal"),
    site: {
      template: "generic",
      theme: { preset: "sand", accent: "teal", font: "editorial", logo: null },
      defaultLocale: "pt",
      activeLocales: ["pt"],
      nav: {
        items: [
          { label: "Sobre", href: "#sobre" },
          { label: "Serviços", href: "#servicos" },
          { label: "Contactos", href: "#contactos" },
        ],
        cta: { label: "Falar connosco", href: "#contactos" },
      },
      pages: [
        {
          id: "home",
          slug: "",
          titleRef: "",
          inNav: true,
          order: 0,
          kind: "content",
          blocks: [
            {
              id: "hero",
              type: "hero",
              settings: {
                content: {
                  pt: {
                    eyebrow: "Bem-vindo",
                    title: "O teu negócio, online",
                    subtitle: "Uma presença simples, elegante e pronta a crescer contigo.",
                    cta: "Saber mais",
                  },
                },
              },
            },
            {
              id: "services",
              type: "services",
              settings: {
                content: {
                  pt: {
                    title: "O que fazemos",
                    items: [
                      { name: "Serviço um", price: "" },
                      { name: "Serviço dois", price: "" },
                      { name: "Serviço três", price: "" },
                    ],
                  },
                },
              },
            },
            {
              id: "stats",
              type: "stats",
              settings: {
                content: {
                  pt: {
                    items: [
                      { value: "100%", label: "dedicação" },
                      { value: "24h", label: "resposta" },
                    ],
                  },
                },
              },
            },
            {
              id: "faq",
              type: "faq",
              settings: {
                content: {
                  pt: {
                    title: "Perguntas frequentes",
                    items: [
                      { q: "Como posso contactar-vos?", a: "Pela secção de contactos abaixo." },
                    ],
                  },
                },
              },
            },
            {
              id: "cta",
              type: "cta",
              settings: {
                content: { pt: { title: "Vamos falar?", cta: "Contactar" } },
              },
            },
          ],
        },
      ],
      footer: {
        content: { pt: { note: "© O teu negócio." } },
      },
    },
  },
];

/** Encontra um template pela chave (= Site.template). */
export function findTemplate(id: string | null | undefined): SiteTemplate | undefined {
  if (!id) return undefined;
  return SITE_TEMPLATES.find((t) => t.id === id);
}
