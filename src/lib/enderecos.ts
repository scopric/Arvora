import { ADMIN_URL, APP_URL, SITE_URL } from "../site"

// 2º segmento do caminho (depois do idioma) que pertence à área do membro. O resto, fora "admin", é do site.
const DO_APP = new Set([
  "entrar", "cadastro", "confirmar", "recuperar-senha", "redefinir-senha", "perfil", "inicio", "bem-vindo",
  "aulas", "academy", "tarefas", "bem-estar", "comunidade", "network", "match", "conexoes", "meu-award",
  "notificacoes", "configuracoes", "planos", "checkout", "cadastrar-empresa",
])

// Para onde mandar quem está em `origem` + `caminho` (Decisão 66): site no SITE_URL, membro no APP_URL,
// painel no ADMIN_URL. null = fica. Só age nos três endereços oficiais (local e prévias ficam como estão).
// A sessão do Supabase é por endereço: por isso "entrar" também vale no painel.
export function enderecoCerto(origem: string, caminho: string, sites = { site: SITE_URL, app: APP_URL, admin: ADMIN_URL }): string | null {
  const { site, app, admin } = sites
  if (![site, app, admin].includes(origem)) return null
  const [, lang, area] = caminho.split("/")
  if (lang !== "pt" && lang !== "en") return null
  if (!area) {
    if (origem === admin && admin !== site) return `${admin}/${lang}/admin`
    if (origem === app && app !== site) return `${app}/${lang}/inicio`
    return null
  }
  const alvo = area === "admin" || (area === "entrar" && origem === admin) ? admin : DO_APP.has(area) ? app : site
  return alvo === origem ? null : alvo + caminho
}
