import { useState } from "react"
import { Aviso } from "../componentes/Aviso"
import { Botao } from "../componentes/Botao"
import { LayoutAuth } from "../componentes/LayoutAuth"
import { useT, useTitulo } from "../i18n"
import { sair } from "../lib/sessao"
import { supabase } from "../lib/supabase"

// CON-07 para quem entrou pelo Google: a conta nasce sem a declaração (f4_10) e o banco não dá nível nem
// checkout até declarar. Quem não tem 18 anos tem a conta apagada na hora (GDPR art. 8), sem senha.
export function DeclararIdade({ aoDeclarar }: { aoDeclarar: () => void }) {
  const t = useT()
  useTitulo("idade.titulo", true)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState(false)

  async function declarar() {
    setOcupado(true)
    setErro(false)
    const { error } = await supabase.rpc("declarar_maior_18")
    setOcupado(false)
    if (error) return setErro(true)
    aoDeclarar()
  }

  async function apagar() {
    setOcupado(true)
    setErro(false)
    const { error } = await supabase.rpc("excluir_conta_sem_declaracao")
    if (error) {
      setOcupado(false)
      return setErro(true)
    }
    await sair()
  }

  return (
    <LayoutAuth titulo={t("idade.titulo")} subtitulo={t("idade.texto")}>
      <div className="space-y-5">
        {erro ? <Aviso tipo="erro">{t("idade.erro")}</Aviso> : null}
        <Botao type="button" ocupado={ocupado} onClick={declarar}>
          {t("idade.botao")}
        </Botao>
        <Botao type="button" variante="contorno" disabled={ocupado} onClick={apagar}>
          {t("idade.sair")}
        </Botao>
      </div>
    </LayoutAuth>
  )
}
