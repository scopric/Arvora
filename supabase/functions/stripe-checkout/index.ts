import { clienteDoUsuario } from "../_shared/supabase-usuario.ts"
import { consultas } from "./consultas.ts"
import { handle } from "./handler.ts"

Deno.serve((req) => handle(req, { env: (n) => Deno.env.get(n), db: (a) => consultas(clienteDoUsuario(a)) }))
