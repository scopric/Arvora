import { useId, type ComponentProps, type ReactNode } from "react"
import { useEstiloCampo } from "./campoEstilo"

type Props = ComponentProps<"input"> & { rotulo: string; erro?: string; ajuda?: ReactNode }

export function Campo({ rotulo, erro, ajuda, className = "", ...resto }: Props) {
  const id = useId()
  const e = useEstiloCampo()
  const descricao = erro ? `${id}-erro` : ajuda ? `${id}-ajuda` : undefined
  return (
    <div>
      <label htmlFor={id} className={e.rotulo}>
        {rotulo}
      </label>
      <input
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao}
        className={`${e.campo} ${erro ? "border-red-300" : e.bordaOk} ${className}`}
        {...resto}
      />
      {erro ? (
        <p id={`${id}-erro`} role="alert" className={e.erro}>
          {erro}
        </p>
      ) : ajuda ? (
        <p id={`${id}-ajuda`} className={e.ajuda}>
          {ajuda}
        </p>
      ) : null}
    </div>
  )
}

type PropsSelecao = ComponentProps<"select"> & { rotulo: string; erro?: string }

export function Selecao({ rotulo, erro, children, className = "", ...resto }: PropsSelecao) {
  const id = useId()
  const e = useEstiloCampo()
  return (
    <div>
      <label htmlFor={id} className={e.rotulo}>
        {rotulo}
      </label>
      <select
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${id}-erro` : undefined}
        className={`${e.campo} ${erro ? "border-red-300" : e.bordaOk} ${className}`}
        {...resto}
      >
        {children}
      </select>
      {erro ? (
        <p id={`${id}-erro`} role="alert" className={e.erro}>
          {erro}
        </p>
      ) : null}
    </div>
  )
}
