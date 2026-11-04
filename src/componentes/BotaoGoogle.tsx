import { useState } from "react"
import { useCaminho, useT } from "../i18n"
import { supabase } from "../lib/supabase"
import { Botao } from "./Botao"

// Entrar com Google (CON-01). Volta para /entrar (com ?de=), que troca o ?code= pela sessão (PKCE) e segue para o destino.
// Conta nova pelo Google nasce sem a declaração de 18 anos: RotaProtegida pede antes de qualquer área (f4_10).
export function BotaoGoogle({ destino, aoFalhar }: { destino?: string; aoFalhar: () => void }) {
  const t = useT()
  const caminho = useCaminho()
  const [ocupado, setOcupado] = useState(false)

  async function entrar() {
    setOcupado(true)
    const volta = new URL(caminho("/entrar"), window.location.origin)
    if (destino) volta.searchParams.set("de", destino)
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: volta.href } })
    // Sem erro o navegador já está indo para o Google; o botão fica ocupado até sair da página.
    if (error) {
      setOcupado(false)
      aoFalhar()
    }
  }

  return (
    <Botao type="button" variante="contorno" ocupado={ocupado} onClick={entrar}>
      <span className="inline-flex items-center justify-center gap-3">
        <svg aria-hidden="true" viewBox="0 0 48 48" className="size-5 shrink-0">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        {t("auth.google")}
      </span>
    </Botao>
  )
}
