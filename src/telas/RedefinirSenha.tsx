import { useState, type SubmitEvent } from "react"
import { Link, useNavigate } from "react-router"
import { Aviso } from "../componentes/Aviso"
import { Botao } from "../componentes/Botao"
import { Campo } from "../componentes/Campo"
import { LayoutAuth } from "../componentes/LayoutAuth"
import { useCaminho } from "../i18n"
import { useAuth } from "../lib/sessao"
import { supabase } from "../lib/supabase"
import { errosPorCampo, mensagemDeErroAuth, redefinirSchema, type CamposDeErro } from "../lib/validacao"

// Destino do link de recuperação: o Supabase troca o código por uma sessão e só então a senha pode mudar.
export function RedefinirSenha() {
  const { sessao, carregando } = useAuth()
  const caminho = useCaminho()
  const navegar = useNavigate()
  const [erros, setErros] = useState<CamposDeErro>({})
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function enviar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setAviso(null)
    const dados = redefinirSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)))
    if (!dados.success) return setErros(errosPorCampo(dados.error))
    setErros({})
    setOcupado(true)
    const { error } = await supabase.auth.updateUser({ password: dados.data.senha })
    setOcupado(false)
    if (error) return setAviso(mensagemDeErroAuth(error))
    navegar(caminho("/perfil"), { replace: true })
  }

  if (carregando) return <LayoutAuth titulo="Nova senha" subtitulo="Verificando o link…">{null}</LayoutAuth>

  if (!sessao) {
    return (
      <LayoutAuth titulo="Link inválido" subtitulo="Esse link expirou ou já foi usado.">
        <Link to={caminho("/recuperar-senha")} className="underline decoration-dourado underline-offset-4">
          Pedir um link novo
        </Link>
      </LayoutAuth>
    )
  }

  return (
    <LayoutAuth titulo="Nova senha" subtitulo="Escolha uma senha que você ainda não usou aqui.">
      <form onSubmit={enviar} noValidate className="space-y-5">
        {aviso ? <Aviso tipo="erro">{aviso}</Aviso> : null}
        <Campo
          rotulo="Nova senha"
          name="senha"
          type="password"
          autoComplete="new-password"
          erro={erros.senha}
          ajuda="8 ou mais caracteres, com maiúscula, minúscula e número."
        />
        <Botao type="submit" ocupado={ocupado}>
          Salvar senha
        </Botao>
      </form>
    </LayoutAuth>
  )
}
