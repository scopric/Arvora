import { useId, useState, type KeyboardEvent, type ReactNode } from "react"
import { useApp } from "./escopo"
import { abaApp } from "./menuApp"

export type Aba = { chave: string; rotulo: string; conteudo: ReactNode }

const publico = {
  lista: "flex gap-1 overflow-x-auto border-b border-current/15",
  aba: "min-h-11 shrink-0 border-b-2 border-transparent px-4 font-semibold opacity-70 transition-colors hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado aria-selected:border-destaque aria-selected:opacity-100",
}

// App (MasterClass "All Lessons / My Notes"): abas em texto com sublinhado dourado de 2px na ativa (menuApp).
const app = { lista: "flex gap-6 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-placa)]", aba: abaApp }

// Abas no padrão WAI-ARIA: setas esquerda/direita, Home e End movem e ativam; só a aba ativa entra na ordem de tab.
export function Abas({ abas, rotulo, inicial }: { abas: Aba[]; rotulo: string; inicial?: string }) {
  const base = useId()
  const e = useApp() ? app : publico
  const [ativa, setAtiva] = useState(inicial ?? abas[0]?.chave)
  const indice = Math.max(0, abas.findIndex((a) => a.chave === ativa))

  function teclar(ev: KeyboardEvent<HTMLButtonElement>) {
    const n = abas.length
    const alvo = { ArrowRight: (indice + 1) % n, ArrowLeft: (indice - 1 + n) % n, Home: 0, End: n - 1 }[ev.key]
    if (alvo === undefined) return
    ev.preventDefault()
    setAtiva(abas[alvo].chave)
    document.getElementById(`${base}-aba-${abas[alvo].chave}`)?.focus()
  }

  return (
    <div>
      <div role="tablist" aria-label={rotulo} className={e.lista}>
        {abas.map((a, i) => (
          <button
            key={a.chave}
            id={`${base}-aba-${a.chave}`}
            type="button"
            role="tab"
            aria-selected={i === indice}
            aria-controls={`${base}-painel-${a.chave}`}
            tabIndex={i === indice ? 0 : -1}
            onClick={() => setAtiva(a.chave)}
            onKeyDown={teclar}
            className={e.aba}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      {abas.map((a, i) => (
        <div key={a.chave} id={`${base}-painel-${a.chave}`} role="tabpanel" aria-labelledby={`${base}-aba-${a.chave}`} hidden={i !== indice} className="pt-6">
          {i === indice ? a.conteudo : null}
        </div>
      ))}
    </div>
  )
}
