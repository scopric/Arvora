// Primeiro passo do build: falha à vista se faltar a configuração do Supabase (nada de chave reserva; regra 1 do CLAUDE.md).
// Lê o ambiente do mesmo jeito que o Vite (process.env e .env*), só as variáveis VITE_.
import { loadEnv } from "vite"

export const OBRIGATORIAS = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"]

export function faltando(env) {
  return OBRIGATORIAS.filter((nome) => !env[nome]?.trim())
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const faltam = faltando(loadEnv(process.env.NODE_ENV ?? "production", process.cwd(), "VITE_"))
  if (faltam.length) {
    console.error(`Build interrompido: faltam ${faltam.join(" e ")}. Veja .env.example.`)
    process.exit(1)
  }
}
