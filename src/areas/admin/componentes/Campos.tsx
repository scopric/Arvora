import { useId, type ComponentProps } from "react"

const base =
  "w-full rounded-lg border bg-transparent px-4 py-3 text-base text-creme placeholder:text-creme/40 outline-none transition-colors focus-visible:border-dourado focus-visible:ring-2 focus-visible:ring-dourado/40"

export function AreaTexto({ rotulo, erro, ajuda, className = "", ...resto }: ComponentProps<"textarea"> & { rotulo: string; erro?: string; ajuda?: string }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-creme">{rotulo}</label>
      <textarea
        id={id}
        rows={4}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${id}-erro` : ajuda ? `${id}-ajuda` : undefined}
        className={`${base} ${erro ? "border-red-300" : "border-creme/25"} ${className}`}
        {...resto}
      />
      {erro ? <p id={`${id}-erro`} role="alert" className="mt-2 text-sm text-red-300">{erro}</p> : ajuda ? <p id={`${id}-ajuda`} className="mt-2 text-sm text-creme/60">{ajuda}</p> : null}
    </div>
  )
}

export function Caixa({ rotulo, className = "", ...resto }: Omit<ComponentProps<"input">, "type"> & { rotulo: string }) {
  const id = useId()
  return (
    <div className="flex min-h-11 items-center gap-3">
      <input id={id} type="checkbox" className={`size-5 accent-destaque ${className}`} {...resto} />
      <label htmlFor={id} className="text-sm font-semibold text-creme">{rotulo}</label>
    </div>
  )
}

// Botão pequeno de ação em linha de tabela (alvo de 44px de altura).
export const classeAcao =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-creme/30 px-3 text-sm font-semibold text-creme hover:border-creme/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado disabled:cursor-not-allowed disabled:opacity-60"
