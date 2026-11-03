import type { Chave } from "../i18n"
import type { Nivel } from "../lib/acesso"
import type { NomeIcone } from "./Icone"

// Evento da edição atual. PROVISÓRIO: a edição vem do banco (admin/edicoes); até lá, um slug fixo.
export const EDICAO_ATUAL = "2026"

export type Item = {
  rotulo: Chave
  rota: string
  // Ícone ao lado do rótulo (16px nas listas, 20px na tab bar); sempre decorativo.
  icone: NomeIcone
  // Nível mínimo para abrir de fato; abaixo disso o item aparece com cadeado e leva à página com a prévia (PRD §17.1).
  minimo?: Exclude<Nivel, "visitante">
  // Só para premiado (Meu Award): some para os demais.
  soPremiado?: boolean
}
// Área do membro (Decisão 70, casca com barra superior como o app do MasterClass): um link no topo e, dentro dela,
// as seções em abas. `secoes` nomeia a navegação das abas (um rótulo por área, para os landmarks não se confundirem).
export type Area = Item & { secoes?: Chave; itens: Item[] }

// Áreas e seções, na ordem do PRD §17.3.1 com a alteração da Decisão 70. Cadeados por nível: PRD §17.3.5.
export const AREAS: Area[] = [
  { rotulo: "menu.inicio", rota: "/inicio", icone: "casa", itens: [] },
  {
    rotulo: "menu.aprender",
    rota: "/aulas",
    icone: "aprender",
    secoes: "menu.secoesAprender",
    itens: [
      { rotulo: "menu.aulas", rota: "/aulas", icone: "video", minimo: "grupo" },
      { rotulo: "menu.academy", rota: "/academy", icone: "aprender" },
      { rotulo: "menu.bemEstar", rota: "/bem-estar", icone: "folha", minimo: "grupo" },
      { rotulo: "menu.tarefas", rota: "/tarefas", icone: "check", minimo: "grupo" },
    ],
  },
  {
    rotulo: "menu.rede",
    rota: "/network",
    icone: "rede",
    secoes: "menu.secoesRede",
    itens: [
      { rotulo: "menu.network", rota: "/network", icone: "rede", minimo: "clube" },
      { rotulo: "menu.comunidade", rota: "/comunidade", icone: "balao", minimo: "clube" },
      { rotulo: "menu.match", rota: "/match", icone: "faisca", minimo: "grupo" },
      { rotulo: "menu.conexoes", rota: "/conexoes", icone: "elo" },
    ],
  },
  {
    rotulo: "menu.awardsAba",
    rota: "/awards",
    icone: "award",
    secoes: "menu.secoesAwards",
    itens: [
      { rotulo: "menu.hallOfFame", rota: "/hall-of-fame", icone: "award" },
      { rotulo: "menu.biblioteca", rota: "/biblioteca", icone: "livro" },
      { rotulo: "menu.originals", rota: "/originals", icone: "filme" },
      { rotulo: "menu.directory", rota: "/directory", icone: "predio" },
      { rotulo: "menu.evento", rota: `/evento/${EDICAO_ATUAL}`, icone: "calendario" },
      { rotulo: "menu.meuAward", rota: "/meu-award", icone: "award", soPremiado: true },
    ],
  },
]

const dentro = (caminho: string, rota: string) => caminho === rota || caminho.startsWith(`${rota}/`)
// Área ativa para um caminho sem o prefixo de idioma ("/academy/vendas" → Aprender); `/evento/*` conta como Awards.
export function areaDe(caminho: string): Area | undefined {
  return AREAS.find((a) => dentro(caminho, a.rota) || a.itens.some((i) => dentro(caminho, i.rota)) || (a.rota === "/awards" && dentro(caminho, "/evento")))
}

export type Aba = { rotulo: Chave; rota: string; icone: NomeIcone }
// Bottom tab bar (PRD §17.3.2). "Mais" abre a folha e não está aqui.
export const ABAS: Aba[] = [
  { rotulo: "menu.inicio", rota: "/inicio", icone: "casa" },
  { rotulo: "menu.aprender", rota: "/aulas", icone: "aprender" },
  { rotulo: "menu.awardsAba", rota: "/awards", icone: "award" },
  { rotulo: "menu.rede", rota: "/network", icone: "rede" },
]

// Folha "Mais" (mobile) e menu do avatar (desktop).
export const MAIS: Item[] = [
  { rotulo: "menu.perfil", rota: "/perfil", icone: "pessoa" },
  { rotulo: "menu.notificacoes", rota: "/notificacoes", icone: "sino" },
  { rotulo: "menu.comunidade", rota: "/comunidade", icone: "balao", minimo: "clube" },
  { rotulo: "menu.tarefas", rota: "/tarefas", icone: "check", minimo: "grupo" },
  { rotulo: "menu.configuracoes", rota: "/configuracoes", icone: "engrenagem" },
  { rotulo: "menu.suporte", rota: "/suporte", icone: "ajuda" },
  { rotulo: "menu.meuPlano", rota: "/configuracoes/assinatura", icone: "cartao" },
]
export const AVATAR: Item[] = [
  { rotulo: "menu.perfil", rota: "/perfil", icone: "pessoa" },
  { rotulo: "menu.conexoes", rota: "/conexoes", icone: "elo" },
  { rotulo: "menu.meuAward", rota: "/meu-award", icone: "award", soPremiado: true },
  { rotulo: "menu.notificacoes", rota: "/notificacoes", icone: "sino" },
  { rotulo: "menu.configuracoes", rota: "/configuracoes", icone: "engrenagem" },
  { rotulo: "menu.assinatura", rota: "/configuracoes/assinatura", icone: "cartao" },
  { rotulo: "menu.suporte", rota: "/suporte", icone: "ajuda" },
]

export type ItemAdmin = { rotulo: Chave; rota: string; icone: NomeIcone }
export type GrupoAdmin = { rotulo?: Chave; itens: ItemAdmin[] }
// Menu do admin (PRD §17.3.4). Correção de tarefas não consta no desenho do menu do PRD: entrou em PESSOAS para a rota ter entrada.
export const MENU_ADMIN: GrupoAdmin[] = [
  { itens: [{ rotulo: "admin.visaoGeral", rota: "/admin", icone: "painel" }] },
  {
    rotulo: "admin.grupo.conteudo",
    itens: [
      { rotulo: "admin.item.aulas", rota: "/admin/aulas", icone: "video" },
      { rotulo: "admin.item.cursos", rota: "/admin/cursos", icone: "aprender" },
      { rotulo: "admin.item.videos", rota: "/admin/videos", icone: "filme" },
      { rotulo: "admin.item.temas", rota: "/admin/temas", icone: "etiqueta" },
    ],
  },
  {
    rotulo: "admin.grupo.awards",
    itens: [
      { rotulo: "admin.item.edicoes", rota: "/admin/edicoes", icone: "calendario" },
      { rotulo: "admin.item.premiados", rota: "/admin/premiados", icone: "award" },
      { rotulo: "admin.item.empresas", rota: "/admin/empresas", icone: "predio" },
    ],
  },
  {
    rotulo: "admin.grupo.pessoas",
    itens: [
      { rotulo: "admin.item.membros", rota: "/admin/membros", icone: "rede" },
      { rotulo: "admin.item.correcao", rota: "/admin/correcao", icone: "check" },
      { rotulo: "admin.item.moderacao", rota: "/admin/moderacao", icone: "escudo" },
      { rotulo: "admin.item.pedidosDeDados", rota: "/admin/pedidos-de-dados", icone: "arquivo" },
    ],
  },
  { rotulo: "admin.grupo.financeiro", itens: [{ rotulo: "admin.item.relatorioCiclo", rota: "/admin/relatorio-ciclo", icone: "grafico" }] },
  {
    rotulo: "admin.grupo.sistema",
    itens: [
      { rotulo: "admin.item.equipe", rota: "/admin/equipe", icone: "pessoa" },
      { rotulo: "admin.item.log", rota: "/admin/log", icone: "lista" },
      { rotulo: "admin.item.ia", rota: "/admin/ia", icone: "faisca" },
      { rotulo: "admin.item.verticais", rota: "/admin/verticais", icone: "camadas" },
    ],
  },
]
