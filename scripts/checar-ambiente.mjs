// Primeiro passo do build: falha à vista se faltar a configuração do Supabase (nada de chave reserva; regra 1 do CLAUDE.md).
// Lê o ambiente do mesmo jeito que o Vite (process.env e .env*), só as variáveis VITE_.
// Também confere se o host do Supabase está na CSP do vercel.json (connect-src/img-src/media-src): fora dela o navegador bloqueia tudo.
// Onde entra o host do provedor de vídeo (embed) quando for escolhido: `frame-src` do vercel.json (e `media-src` se for arquivo).
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { loadEnv } from "vite"

export const OBRIGATORIAS = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"]
const LOCAIS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"])

export function faltando(env) {
  return OBRIGATORIAS.filter((nome) => !env[nome]?.trim())
}

// true se a URL (remota) não aparece na CSP. Host local (supabase start) não entra na CSP de produção e é ignorado.
export function hostForaDaCsp(url, csp) {
  if (!URL.canParse(url)) return false
  const { hostname } = new URL(url)
  return !LOCAIS.has(hostname) && !csp.includes(hostname)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = loadEnv(process.env.NODE_ENV ?? "production", process.cwd(), "VITE_")
  const faltam = faltando(env)
  if (faltam.length) {
    console.error(`Build interrompido: faltam ${faltam.join(" e ")}. Veja .env.example.`)
    process.exit(1)
  }
  const csp = readFileSync("vercel.json", "utf8")
  if (hostForaDaCsp(env.VITE_SUPABASE_URL, csp)) {
    const msg = `O host de VITE_SUPABASE_URL (${new URL(env.VITE_SUPABASE_URL).hostname}) não está na CSP do vercel.json.`
    if (process.env.VERCEL_ENV === "production") {
      console.error(`Build interrompido: ${msg}`)
      process.exit(1)
    }
    console.warn(`Aviso: ${msg} (vira erro no build de produção da Vercel)`)
  }
}
