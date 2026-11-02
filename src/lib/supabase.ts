import { createClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"

const url = import.meta.env.VITE_SUPABASE_URL
const chave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Sem variável, o app falha à vista: não existe URL nem chave reserva no código.
if (!url || !chave) {
  throw new Error(
    "Faltam VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY. Veja .env.example.",
  )
}

// PKCE: o cliente ignora tokens no #hash da URL, então um link com a sessão de outra pessoa não troca a sua.
// Os e-mails usam token_hash + verifyOtp (Confirmar.tsx), que independe do fluxo.
export const supabase = createClient<Database>(url, chave, { auth: { flowType: "pkce" } })
