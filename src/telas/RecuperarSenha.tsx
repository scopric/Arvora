import { useState, type SubmitEvent } from "react"
import { Link } from "react-router"
import { Aviso } from "../componentes/Aviso"
import { Botao } from "../componentes/Botao"
import { Campo } from "../componentes/Campo"
import { LayoutAuth } from "../componentes/LayoutAuth"
import { supabase } from "../lib/supabase"
import { errosPorCampo, mensagemDeErroAuth, recuperarSchema, type CamposDeErro } from "../lib/validacao"

export function RecuperarSenha() {
  const [erros, setErros] = useState<CamposDeErro>({})
  const [aviso, setAviso] = useState<string | null>(null)
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
    <LayoutAuth titulo="Recuperar senha" subtitulo="Enviamos um link para você criar uma senha nova.">
      {enviado ? (
        <Aviso tipo="ok">Se houver uma conta com esse e-mail, o link já está a caminho. Confira também o spam.</Aviso>
      ) : (
        <form onSubmit={enviar} noValidate className="space-y-5">
          {aviso ? <Aviso tipo="erro">{aviso}</Aviso> : null}
          <Campo rotulo="E-mail" name="email" type="email" autoComplete="email" erro={erros.email} />
          <Botao type="submit" ocupado={ocupado}>
            Enviar link
          </Botao>
        </form>
      )}
      <p className="mt-6 text-sm text-creme/70">
        <Link to="/entrar" className="underline decoration-dourado underline-offset-4">
          Voltar para entrar
        </Link>
      </p>
    </LayoutAuth>
  )
}
