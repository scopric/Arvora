import { useEffect, useRef, useState } from "react"
import { useT } from "../i18n"
import { CHAVE_TURNSTILE } from "../lib/captcha"
import { Erro } from "./Erro"

type Api = {
  render: (el: HTMLElement, opcoes: Record<string, unknown>) => string
  remove: (id: string) => void
}
declare global {
  interface Window {
    turnstile?: Api
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

function carregarScript() {
  return new Promise<Api>((ok, falha) => {
    if (window.turnstile) return ok(window.turnstile)
    let el = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`)
    if (!el) {
      el = document.head.appendChild(document.createElement("script"))
      el.src = SCRIPT
      el.async = true
    }
    el.addEventListener("load", () => (window.turnstile ? ok(window.turnstile) : falha(new Error("turnstile"))))
    el.addEventListener("error", () => {
      el?.remove() // script que falhou não pode ficar: a próxima tentativa precisa baixar de novo
      falha(new Error("turnstile"))
    })
  })
}

// Só aparece com VITE_TURNSTILE_SITE_KEY. `onToken(null)` quando o token vence ou o widget falha (o formulário bloqueia o envio).
// Para pedir outro token depois de usar um, remonte com `key` (useCaptcha().reinicio).
export function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)
  const aoToken = useRef(onToken)
  const [falhou, setFalhou] = useState(false)
  const [tentativa, setTentativa] = useState(0)
  useEffect(() => {
    aoToken.current = onToken
  })

  useEffect(() => {
    if (!CHAVE_TURNSTILE || !ref.current || falhou) return
    const el = ref.current
    let id: string | undefined
    let ativo = true
    carregarScript().then(
      (api) => {
        if (!ativo) return
        id = api.render(el, {
          sitekey: CHAVE_TURNSTILE,
          theme: "dark",
          callback: (token: string) => aoToken.current(token),
          "expired-callback": () => aoToken.current(null),
          "error-callback": () => aoToken.current(null),
        })
      },
      () => {
        if (!ativo) return
        setFalhou(true)
        aoToken.current(null)
      },
    )
    return () => {
      ativo = false
      if (id) window.turnstile?.remove(id)
    }
  }, [tentativa, falhou])

  if (!CHAVE_TURNSTILE) return null
  if (falhou) {
    return (
      <Erro
        aoTentar={() => {
          setFalhou(false)
          setTentativa((n) => n + 1)
        }}
      >
        {t("captcha.erroCarregar")}
      </Erro>
    )
  }
  return <div ref={ref} role="group" aria-label={t("captcha.rotulo")} className="min-h-16" />
}
