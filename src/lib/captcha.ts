import { useState } from "react"

// Turnstile só liga se a chave pública do site existir no build (VITE_TURNSTILE_SITE_KEY). Sem ela, formulário igual ao de antes.
export const CHAVE_TURNSTILE = import.meta.env.VITE_TURNSTILE_SITE_KEY
export const CAPTCHA_ATIVO = Boolean(CHAVE_TURNSTILE)

// Estado do widget no formulário. `reinicio` vai como `key` do <Turnstile>: o token vale uma única vez, então
// depois de qualquer tentativa que o Supabase recusou (ou usou) chame renovar() para pedir outro.
export function useCaptcha() {
  const [token, setToken] = useState<string | null>(null)
  const [reinicio, setReinicio] = useState(0)
  return {
    token,
    setToken,
    reinicio,
    falta: CAPTCHA_ATIVO && !token,
    // Opções para o Supabase: vazio quando o CAPTCHA está desligado (nada muda na chamada).
    opcoes: token ? { captchaToken: token } : {},
    renovar() {
      setToken(null)
      setReinicio((n) => n + 1)
    },
  }
}
