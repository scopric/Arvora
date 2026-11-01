import { useId, type ComponentProps } from "react"
import { useEstiloCampo } from "../../../componentes/campoEstilo"

export function AreaTexto({ rotulo, erro, ajuda, className = "", ...resto }: ComponentProps<"textarea"> & { rotulo: string; erro?: string; ajuda?: string }) {
  const id = useId()
  const e = useEstiloCampo()
  return (
    <div>
      <label htmlFor={id} className={e.rotulo}>{rotulo}</label>
      <textarea
        id={id}
        rows={4}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${id}-erro` : ajuda ? `${id}-ajuda` : undefined}
        className={`${e.campo} ${erro ? "border-red-300" : e.bordaOk} ${className}`}
        {...resto}
      />
      {erro ? <p id={`${id}-erro`} role="alert" className={e.erro}>{erro}</p> : ajuda ? <p id={`${id}-ajuda`} className={e.ajuda}>{ajuda}</p> : null}
    </div>
  )
}

export function Caixa({ rotulo, className = "", ...resto }: Omit<ComponentProps<"input">, "type"> & { rotulo: string }) {
  const id = useId()
  const e = useEstiloCampo()
  return (
    <div className="flex min-h-11 items-center gap-3">
      <input id={id} type="checkbox" className={`size-4 accent-dourado ${className}`} {...resto} />
      <label htmlFor={id} className={`${e.rotulo} mb-0`}>{rotulo}</label>
    </div>
  )
}

// Botão pequeno de ação em linha de tabela (ghost do Linear; 44px no toque).
export const classeAcao =
  "inline-flex min-h-8 items-center justify-center rounded-md border border-grafite px-2.5 text-xs font-medium text-bruma transition-colors pointer-coarse:min-h-11 hover:bg-creme/5 hover:text-creme focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado disabled:cursor-not-allowed disabled:opacity-60"
