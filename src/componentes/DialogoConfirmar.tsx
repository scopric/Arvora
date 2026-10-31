import { useEffect, useId, useRef } from "react"
import { useT } from "../i18n"
import { Botao } from "./Botao"

type Props = {
  aberto: boolean
  titulo: string
  texto?: string
  confirmar?: string
  perigo?: boolean
  aoConfirmar: () => void
  aoCancelar: () => void
}

// Diálogo de confirmação com <dialog> nativo: prende o foco, fecha com Esc e devolve o foco a quem abriu (comportamento do navegador).
export function DialogoConfirmar({ aberto, titulo, texto, confirmar, perigo, aoConfirmar, aoCancelar }: Props) {
  const t = useT()
  const ref = useRef<HTMLDialogElement>(null)
  const idTitulo = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (aberto && !d.open) d.showModal()
    if (!aberto && d.open) d.close()
  }, [aberto])

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      onCancel={(e) => {
        e.preventDefault() // o estado `aberto` manda; quem usa decide fechar
        aoCancelar()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-creme/20 bg-painel p-6 text-creme backdrop:bg-black/60"
    >
      <h2 id={idTitulo} className="font-titulo text-3xl font-bold uppercase">{titulo}</h2>
      {texto ? <p className="mt-3 opacity-80">{texto}</p> : null}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Botao variante="contorno" onClick={aoCancelar} className="sm:w-auto">{t("comum.cancelar")}</Botao>
        <Botao onClick={aoConfirmar} className={`sm:w-auto ${perigo ? "bg-red-200 text-red-950 hover:bg-red-100" : ""}`}>{confirmar ?? t("comum.confirmar")}</Botao>
      </div>
    </dialog>
  )
}
