import { useEffect, useId, useRef, type ReactNode } from "react"
import { useT } from "../i18n"
import { Botao } from "./Botao"
import { useApp } from "./escopo"

type Props = {
  aberto: boolean
  titulo: string
  texto?: string
  confirmar?: string
  perigo?: boolean
  desabilitado?: boolean
  children?: ReactNode
  aoConfirmar: () => void
  aoCancelar: () => void
}

// Diálogo de confirmação com <dialog> nativo: prende o foco, fecha com Esc e devolve o foco a quem abriu (comportamento do navegador).
// App (MasterClass): superfície placa, raio 12, hairline fumaça (sem sombra externa); o "perigo" é a variante do Botao.
export function DialogoConfirmar({ aberto, titulo, texto, confirmar, perigo, desabilitado, children, aoConfirmar, aoCancelar }: Props) {
  const t = useT()
  const app = useApp()
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
      className={
        app
          ? "m-auto w-[calc(100%-2rem)] max-w-md rounded-xl p-6 text-creme vidro-flutuante backdrop:bg-breu/70 backdrop:backdrop-blur-sm"
          : "m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-creme/20 bg-painel p-6 text-creme backdrop:bg-black/60"
      }
    >
      <h2 id={idTitulo} className={app ? "text-subtitulo font-semibold" : "font-titulo text-3xl font-normal"}>{titulo}</h2>
      {texto ? <p className={app ? "mt-2 text-corpo text-cinza" : "mt-3 opacity-80"}>{texto}</p> : null}
      {children ? <div className="mt-4">{children}</div> : null}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Botao variante="contorno" onClick={aoCancelar} className="sm:w-auto">{t("comum.cancelar")}</Botao>
        {app ? (
          <Botao variante={perigo ? "perigo" : "primario"} onClick={aoConfirmar} disabled={desabilitado}>{confirmar ?? t("comum.confirmar")}</Botao>
        ) : (
          <Botao variante={perigo ? "perigo" : "primario"} onClick={aoConfirmar} disabled={desabilitado} className="sm:w-auto">{confirmar ?? t("comum.confirmar")}</Botao>
        )}
      </div>
    </dialog>
  )
}
