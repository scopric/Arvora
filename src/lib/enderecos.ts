import { ADMIN_URL, APP_URL, SITE_URL } from "../site"

// 2º segmento do caminho (depois do idioma) que só existe na área do membro.
const DO_APP = new Set([
  "entrar", "cadastro", "confirmar", "recuperar-senha", "redefinir-senha", "perfil", "inicio", "bem-vindo",
  "aulas", "academy", "tarefas", "bem-estar", "comunidade", "network", "match", "conexoes", "meu-award",
  "notificacoes", "configuracoes", "checkout", "cadastrar-empresa",
])
// Conteúdo que o visitante vê no site e o membro vê no app, com a sessão (COM_CASCA_DO_MEMBRO em LayoutPublico).
const NOS_DOIS = new Set(["awards", "biblioteca", "originals", "directory", "evento", "suporte", "planos"])

type Enderecos = { site: string; app: string; admin: string }
const OFICIAIS: Enderecos = { site: SITE_URL, app: APP_URL, admin: ADMIN_URL }

// Para onde mandar quem está em `origem` + `caminho` (Decisão 66): site no SITE_URL, membro no APP_URL,
// painel no ADMIN_URL. null = fica. Só age nos três endereços oficiais (local e prévias ficam como estão).
// A sessão do Supabase é por endereço: por isso "entrar" também vale no painel.
export function enderecoCerto(origem: string, caminho: string, { site, app, admin }: Enderecos = OFICIAIS): string | null {
  if (![site, app, admin].includes(origem)) return null
  const [, lang, area] = caminho.split("/")
  if (lang !== "pt" && lang !== "en") return null
  const painel = ehPainel(origem, { site, app, admin })
  if (!area) {
    if (painel) return `${admin}/${lang}/admin`
    if (origem === app && app !== site) return `${app}/${lang}/inicio`
    return null
  }
  if (NOS_DOIS.has(area) && origem !== admin) return null
  const alvo = area === "admin" || (area === "entrar" && painel) ? admin : DO_APP.has(area) || NOS_DOIS.has(area) ? app : site
  return alvo === origem ? null : alvo + caminho
}

// Home do site a partir de qualquer endereço: no app, o "/" levaria ao Início e, sem sessão, ao login.
export function linkSite(caminho: string, { site, app }: Enderecos = OFICIAIS): string {
  return site === app ? caminho : site + caminho
}

// Caminho de volta depois do login só se for deste endereço: "//x", "/\\x" e espaço/tab o navegador lê como outro domínio.
export function caminhoInterno(de: string | null | undefined): string | null {
  return de && /^\/(?!\/)[^\\\s]*$/.test(de) ? de : null
}

// Painel e app em endereços próprios (Decisão 67: contas separadas). Com tudo no mesmo endereço (local, prévias), ambos são falsos.
export function ehPainel(origem: string, { site, app, admin }: Enderecos = OFICIAIS): boolean {
  return origem === admin && admin !== app && admin !== site
}
export function ehAppSeparado(origem: string, { app, admin }: Enderecos = OFICIAIS): boolean {
  return origem === app && app !== admin
}

// Conta da equipe com sessão no app separado: vê só a tela "conta do painel", exceto confirmar e redefinir a senha
// (o e-mail de recuperação cai no app, Site URL do Supabase).
export function barraContaDoPainel(origem: string, caminho: string, equipe: boolean, sites: Enderecos = OFICIAIS): boolean {
  if (!equipe || !ehAppSeparado(origem, sites)) return false
  const [, lang, area] = caminho.split("/")
  // Sem idioma, o SemPrefixo completa o caminho e a regra volta a valer no próximo render.
  if (lang !== "pt" && lang !== "en") return false
  return area !== "confirmar" && area !== "redefinir-senha"
}

// Destino padrão depois do login: no painel, o próprio painel.
export function inicioDepoisDoLogin(origem: string, sites: Enderecos = OFICIAIS): "/admin" | "/inicio" {
  return ehPainel(origem, sites) ? "/admin" : "/inicio"
}
