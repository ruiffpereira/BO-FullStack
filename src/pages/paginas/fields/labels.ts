/**
 * Rótulos em português dos campos. O catálogo da API não traz rótulos (só `type`, `max`…), por isso o
 * formulário usa `def.label` quando a API o der e, senão, este dicionário por NOME de campo; o que não
 * estiver aqui aparece com o nome capitalizado. É texto de interface — nenhuma regra de negócio.
 */

const FIELD_LABELS: Record<string, string> = {
  text: "Texto",
  body: "Texto",
  label: "Texto do botão",
  dest: "Leva para",
  align: "Alinhamento",
  level: "Nível (para o Google)",
  items: "Itens",
  value: "Valor",
  sub: "Subtexto",
  image: "Imagem",
  alt: "Descrição da imagem",
  caption: "Legenda",
  source: "Origem",
  youtube: "Endereço do YouTube",
  file: "Ficheiro",
  poster: "Imagem de capa",
  title: "Título",
  address: "Morada",
  zoom: "Zoom",
  icon: "Ícone",
  name: "Nome",
  price: "Preço",
  period: "Período",
  features: "Inclui",
  highlight: "Destacar",
  cta: "Texto do botão",
  pick: "Páginas",
  quote: "Citação",
  role: "Função",
  q: "Pergunta",
  a: "Resposta",
  phone: "Telefone",
  email: "Email",
  hours: "Horário",
  day: "Dia",
  time: "Horas",
  stars: "Estrelas",
  types: "Tipos de pedido",
  network: "Rede",
  url: "Endereço",
  description: "Descrição",
  keywords: "Palavras-chave",
  eyebrow: "Etiqueta",
};

const OPTION_LABELS: Record<string, string> = {
  left: "Esquerda",
  center: "Centro",
  right: "Direita",
  h1: "H1",
  h2: "H2",
  h3: "H3",
  h4: "H4",
  youtube: "YouTube",
  ficheiro: "Ficheiro",
  cidade: "Cidade",
  rua: "Rua",
  sim: "Sim",
  nao: "Não",
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  x: "X",
};

const ADD_LABELS: Record<string, string> = {
  items: "Adicionar item",
  types: "Adicionar tipo de pedido",
  hours: "Adicionar horário",
};

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export const fieldLabel = (name: string, def?: { label?: string }): string => def?.label || FIELD_LABELS[name] || capitalize(name);
export const optionLabel = (option: string): string => OPTION_LABELS[option] ?? option;
export const addLabel = (name: string): string => ADD_LABELS[name] ?? "Adicionar";
