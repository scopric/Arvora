import { useState, type SubmitEvent } from "react"
import { Link } from "react-router"
import { Aviso } from "../componentes/Aviso"
import { Botao } from "../componentes/Botao"
import { Campo } from "../componentes/Campo"
import { LayoutAuth } from "../componentes/LayoutAuth"
import { useCaminho, useT, type Chave } from "../i18n"
import { supabase } from "../lib/supabase"
import { errosPorCampo, mensagemDeErroAuth, recuperarSchema, type CamposDeErro } from "../lib/validacao"

export function RecuperarSenha() {
  const caminho = useCaminho()
  const t = useT()
  const [erros, setErros] = useState<CamposDeErro>({})
  const [aviso, setAviso] = useState<Chave | null>(null)
  const [enviado, setEnviado] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  async function enviar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setAviso(null)
    const dados = recuperarSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)))
    if (!dados.success) return setErros(errosPorCampo(dados.error))
    setErros({})
    setOcupado(true)
    const { error } = await supabase.auth.resetPasswordForEmail(dados.data.email)
    setOcupado(false)
    // Mesma resposta exista a conta ou não, para não revelar quem tem cadastro.
    if (error && error.code !== "validation_failed") return setAviso(mensagemDeErroAuth(error))
    setEnviado(true)
  }

  return (
    <LayoutAuth titulo={t("recuperar.titulo")} subtitulo={t("recuperar.subtitulo")}>
      {enviado ? (
        <Aviso tipo="ok">{t("recuperar.enviado")}</Aviso>
      ) : (
        <form onSubmit={enviar} noValidate className="space-y-5">
          {aviso ? <Aviso tipo="erro">{t(aviso)}</Aviso> : null}
          <Campo rotulo={t("auth.email.rotulo")} name="email" type="email" autoComplete="email" placeholder={t("auth.email.exemplo")} erro={t(erros.email)} />
          <Botao type="submit" ocupado={ocupado}>
            {t("recuperar.botao")}
          </Botao>
        </form>
      )}
      <p className="mt-6 text-sm text-creme/70">
        <Link to={caminho("/entrar")} className="underline decoration-dourado underline-offset-4">
          {t("recuperar.voltar")}
        </Link>
      </p>
    </LayoutAuth>
  )
}
