// ----------------------------------------------------------------------------
// MOCK DATA — fictional backoffice data for a multi-tenant SaaS
// Two business types today: "barbearia" (uses Agenda) and "loja" (uses Loja)
// ----------------------------------------------------------------------------

// The installable components/modules of the platform
const COMPONENTES = [
  { id: 'dashboard', nome: 'Dashboard', icon: 'dashboard', desc: 'Visão geral e gráficos' },
  { id: 'clientes', nome: 'Clientes', icon: 'users', desc: 'Clientes finais do negócio' },
  { id: 'loja', nome: 'Loja', icon: 'store', desc: 'Produtos, stock e encomendas' },
  { id: 'agenda', nome: 'Agenda', icon: 'calendar', desc: 'Marcações e horários' },
  { id: 'admin', nome: 'Admin', icon: 'shield', desc: 'Gestão de contas e permissões' },
];

// Permissões = roles. Each grants access to a set of componentes.
const PERMISSOES_SEED = [
  { id: 'super', nome: 'Super Admin', cor: '#7C5CDB', componentes: ['dashboard', 'clientes', 'loja', 'agenda', 'admin'], descricao: 'Acesso total à plataforma' },
  { id: 'barbeiro', nome: 'Barbeiro', cor: '#2A6FDB', componentes: ['dashboard', 'agenda', 'clientes'], descricao: 'Gere a agenda e os seus clientes' },
  { id: 'gestor_loja', nome: 'Gestor de Loja', cor: '#1F8A5B', componentes: ['dashboard', 'loja', 'clientes'], descricao: 'Gere produtos, stock e encomendas' },
];

// Contas de cliente (tenants) que o admin cria
const CONTAS_SEED = [
  { id: 'c1', negocio: 'Barbearia Navalha', tipo: 'barbearia', permissao: 'barbeiro', responsavel: 'Rui Tavares', email: 'rui@navalha.pt', estado: 'ativo', desde: '2024-03-12' },
  { id: 'c2', negocio: 'Loja do Bairro', tipo: 'loja', permissao: 'gestor_loja', responsavel: 'AnaPires', email: 'ana@lojadobairro.pt', estado: 'ativo', desde: '2024-06-01' },
  { id: 'c3', negocio: 'Corte & Estilo', tipo: 'barbearia', permissao: 'barbeiro', responsavel: 'Miguel Sá', email: 'miguel@corteestilo.pt', estado: 'ativo', desde: '2024-09-22' },
  { id: 'c4', negocio: 'Mercearia Sol', tipo: 'loja', permissao: 'gestor_loja', responsavel: 'Carla Nunes', email: 'carla@merceariasol.pt', estado: 'suspenso', desde: '2025-01-15' },
  { id: 'c5', negocio: 'Plataforma (HQ)', tipo: 'admin', permissao: 'super', responsavel: 'Tu', email: 'admin@plataforma.pt', estado: 'ativo', desde: '2024-01-01' },
];

// Clientes finais (clients of our clients)
const CLIENTES_FINAIS = [
  { id: 'f1', nome: 'João Mendes', email: 'joao.m@gmail.com', telefone: '912 345 678', visitas: 14, gasto: 182, ultima: '2026-05-28', estado: 'ativo', avatar: '#2A6FDB' },
  { id: 'f2', nome: 'Sofia Ramos', email: 'sofia.ramos@gmail.com', telefone: '935 112 904', visitas: 8, gasto: 96, ultima: '2026-05-30', estado: 'ativo', avatar: '#1F8A5B' },
  { id: 'f3', nome: 'Pedro Antunes', email: 'p.antunes@hotmail.com', telefone: '961 220 118', visitas: 3, gasto: 240, ultima: '2026-04-11', estado: 'ativo', avatar: '#D97757' },
  { id: 'f4', nome: 'Marta Sousa', email: 'marta.sousa@gmail.com', telefone: '917 008 552', visitas: 21, gasto: 310, ultima: '2026-06-01', estado: 'vip', avatar: '#7C5CDB' },
  { id: 'f5', nome: 'Tiago Lopes', email: 'tiagolopes@sapo.pt', telefone: '926 774 301', visitas: 1, gasto: 18, ultima: '2026-03-02', estado: 'bloqueado', avatar: '#71717A' },
  { id: 'f6', nome: 'Inês Carvalho', email: 'ines.c@gmail.com', telefone: '913 556 720', visitas: 11, gasto: 134, ultima: '2026-05-19', estado: 'ativo', avatar: '#E6B450' },
  { id: 'f7', nome: 'Bruno Faria', email: 'bruno.faria@gmail.com', telefone: '968 410 233', visitas: 6, gasto: 72, ultima: '2026-05-25', estado: 'ativo', avatar: '#2A6FDB' },
  { id: 'f8', nome: 'Rita Gomes', email: 'rita.gomes@gmail.com', telefone: '910 332 887', visitas: 19, gasto: 276, ultima: '2026-05-31', estado: 'vip', avatar: '#1F8A5B' },
];

// Produtos da Loja
const PRODUTOS_SEED = [
  { id: 'p1', nome: 'Pomada Modeladora Matte', categoria: 'Cabelo', preco: 14.9, stock: 42, sku: 'PM-001', estado: 'ativo', cor: '#2A6FDB' },
  { id: 'p2', nome: 'Óleo para Barba 30ml', categoria: 'Barba', preco: 19.5, stock: 8, sku: 'OB-030', estado: 'ativo', cor: '#D97757' },
  { id: 'p3', nome: 'Champô Fortificante', categoria: 'Cabelo', preco: 11.0, stock: 0, sku: 'CH-220', estado: 'esgotado', cor: '#1F8A5B' },
  { id: 'p4', nome: 'Pente de Madeira', categoria: 'Acessórios', preco: 7.5, stock: 65, sku: 'AC-PNT', estado: 'ativo', cor: '#E6B450' },
  { id: 'p5', nome: 'Kit Barbear Clássico', categoria: 'Kits', preco: 49.0, stock: 5, sku: 'KT-CLA', estado: 'ativo', cor: '#7C5CDB' },
  { id: 'p6', nome: 'Cera Fixação Forte', categoria: 'Cabelo', preco: 13.5, stock: 28, sku: 'CR-FF', estado: 'ativo', cor: '#2A6FDB' },
  { id: 'p7', nome: 'Loção Pós-Barba', categoria: 'Barba', preco: 16.0, stock: 3, sku: 'LP-016', estado: 'ativo', cor: '#1F8A5B' },
  { id: 'p8', nome: 'Toalha Premium', categoria: 'Acessórios', preco: 9.9, stock: 50, sku: 'AC-TWL', estado: 'ativo', cor: '#D97757' },
];

// Encomendas (Loja)
const ENCOMENDAS_SEED = [
  { id: '#1042', cliente: 'Marta Sousa', itens: 3, total: 48.4, estado: 'enviada', data: '2026-06-01' },
  { id: '#1041', cliente: 'João Mendes', itens: 1, total: 14.9, estado: 'a_preparar', data: '2026-06-01' },
  { id: '#1040', cliente: 'Rita Gomes', itens: 5, total: 92.0, estado: 'entregue', data: '2026-05-31' },
  { id: '#1039', cliente: 'Bruno Faria', itens: 2, total: 33.5, estado: 'entregue', data: '2026-05-30' },
  { id: '#1038', cliente: 'Inês Carvalho', itens: 1, total: 19.5, estado: 'cancelada', data: '2026-05-29' },
  { id: '#1037', cliente: 'Sofia Ramos', itens: 4, total: 61.0, estado: 'entregue', data: '2026-05-28' },
];

// Serviços de barbearia
const SERVICOS = [
  { id: 's1', nome: 'Corte', dur: 30, preco: 12, cor: '#2A6FDB' },
  { id: 's2', nome: 'Corte + Barba', dur: 45, preco: 18, cor: '#1F8A5B' },
  { id: 's3', nome: 'Barba', dur: 20, preco: 8, cor: '#D97757' },
  { id: 's4', nome: 'Corte Criança', dur: 25, preco: 9, cor: '#E6B450' },
  { id: 's5', nome: 'Pacote Completo', dur: 60, preco: 25, cor: '#7C5CDB' },
];

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_NUM = ['1', '2', '3', '4', '5', '6'];

// Marcações da semana — { dia: 0-5, inicio: hora decimal, servico, cliente, estado }
const MARCACOES_SEED = [
  { id: 'm1', dia: 0, inicio: 9.5, servico: 's1', cliente: 'João Mendes', estado: 'confirmada' },
  { id: 'm2', dia: 0, inicio: 11, servico: 's2', cliente: 'Pedro Antunes', estado: 'confirmada' },
  { id: 'm3', dia: 0, inicio: 15, servico: 's3', cliente: 'Bruno Faria', estado: 'pendente' },
  { id: 'm4', dia: 1, inicio: 10, servico: 's5', cliente: 'Marta Sousa', estado: 'confirmada' },
  { id: 'm5', dia: 1, inicio: 14.5, servico: 's1', cliente: 'Tiago Lopes', estado: 'confirmada' },
  { id: 'm6', dia: 2, inicio: 9, servico: 's2', cliente: 'Rita Gomes', estado: 'confirmada' },
  { id: 'm7', dia: 2, inicio: 11.5, servico: 's4', cliente: 'Inês Carvalho', estado: 'pendente' },
  { id: 'm8', dia: 2, inicio: 16, servico: 's1', cliente: 'Sofia Ramos', estado: 'confirmada' },
  { id: 'm9', dia: 3, inicio: 10.5, servico: 's3', cliente: 'João Mendes', estado: 'confirmada' },
  { id: 'm10', dia: 3, inicio: 15, servico: 's5', cliente: 'Marta Sousa', estado: 'confirmada' },
  { id: 'm11', dia: 4, inicio: 9.5, servico: 's2', cliente: 'Bruno Faria', estado: 'confirmada' },
  { id: 'm12', dia: 4, inicio: 12, servico: 's1', cliente: 'Pedro Antunes', estado: 'pendente' },
  { id: 'm13', dia: 4, inicio: 17, servico: 's2', cliente: 'Rita Gomes', estado: 'confirmada' },
  { id: 'm14', dia: 5, inicio: 10, servico: 's5', cliente: 'Sofia Ramos', estado: 'confirmada' },
  { id: 'm15', dia: 5, inicio: 11.5, servico: 's1', cliente: 'Inês Carvalho', estado: 'confirmada' },
];

// ---- Chart series ----------------------------------------------------------
const VENDAS_MENSAIS = [
  { m: 'Jan', v: 4200 }, { m: 'Fev', v: 3800 }, { m: 'Mar', v: 5100 },
  { m: 'Abr', v: 4700 }, { m: 'Mai', v: 6200 }, { m: 'Jun', v: 5900 },
];
const CORTES_SEMANA = [
  { d: 'Seg', v: 18 }, { d: 'Ter', v: 14 }, { d: 'Qua', v: 22 },
  { d: 'Qui', v: 19 }, { d: 'Sex', v: 28 }, { d: 'Sáb', v: 34 },
];
const CATEGORIAS_VENDA = [
  { nome: 'Cabelo', v: 44, cor: '#2A6FDB' },
  { nome: 'Barba', v: 26, cor: '#1F8A5B' },
  { nome: 'Acessórios', v: 18, cor: '#E6B450' },
  { nome: 'Kits', v: 12, cor: '#D97757' },
];
const RECEITA_DIARIA = [320, 280, 410, 390, 460, 520, 480, 540, 610, 580, 660, 700];

const fmtEur = (n) => '€' + n.toLocaleString('pt-PT', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

export { COMPONENTES, PERMISSOES_SEED, CONTAS_SEED, CLIENTES_FINAIS, PRODUTOS_SEED, ENCOMENDAS_SEED, SERVICOS, DIAS, DIAS_NUM, MARCACOES_SEED, VENDAS_MENSAIS, CORTES_SEMANA, CATEGORIAS_VENDA, RECEITA_DIARIA, fmtEur };
