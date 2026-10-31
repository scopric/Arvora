import type { ReactNode } from "react"
import { useT } from "../i18n"
import { Botao } from "./Botao"

// Erro de carregamento: texto na tela (role=alert) e "tentar de novo". Nunca vira lista vazia (Erros 3.2).
export function Erro({ children, aoTentar }: { children?: ReactNode; aoTentar?: () => void }) {
  const t = useT()
  return (
    <div role="alert" className="rounded-2xl border border-red-300/60 px-6 py-8">
      <p className="max-w-prose">{children ?? t("comum.erroGenerico")}</p>
      {aoTentar ? (
        <Botao variante="contorno" onClick={aoTentar} className="mt-5 sm:w-auto">
          {t("comum.tentarDeNovo")}
        </Botao>
      ) : null}
    </div>
  )
}
