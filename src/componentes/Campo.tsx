import { useId, type ComponentProps, type ReactNode } from "react"

const base =
  "w-full rounded-lg border bg-transparent px-4 py-3 text-base text-creme placeholder:text-creme/40 outline-none transition-colors focus-visible:border-dourado focus-visible:ring-2 focus-visible:ring-dourado/40"

type Props = ComponentProps<"input"> & { rotulo: string; erro?: string; ajuda?: ReactNode }

export function Campo({ rotulo, erro, ajuda, className = "", ...resto }: Props) {
  const id = useId()
  const descricao = erro ? `${id}-erro` : ajuda ? `${id}-ajuda` : undefined
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-creme">
        {rotulo}
      </label>
      <input
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao}
        className={`${base} ${erro ? "border-red-300" : "border-creme/25"} ${className}`}
        {...resto}
      />
      {erro ? (
        <p id={`${id}-erro`} role="alert" className="mt-2 text-sm text-red-300">
          {erro}
        </p>
      ) : ajuda ? (
        <p id={`${id}-ajuda`} className="mt-2 text-sm text-creme/60">
          {ajuda}
        </p>
      ) : null}
    </div>
  )
}

type PropsSelecao = ComponentProps<"select"> & { rotulo: string; erro?: string }

export function Selecao({ rotulo, erro, children, className = "", ...resto }: PropsSelecao) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-creme">
        {rotulo}
      </label>
      <select
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${id}-erro` : undefined}
        className={`${base} ${erro ? "border-red-300" : "border-creme/25"} ${className}`}
        {...resto}
      >
        {children}
      </select>
      {erro ? (
        <p id={`${id}-erro`} role="alert" className="mt-2 text-sm text-red-300">
          {erro}
        </p>
      ) : null}
    </div>
  )
}
