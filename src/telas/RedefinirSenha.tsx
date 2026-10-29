import { useState, type SubmitEvent } from "react"
import { Link, useNavigate } from "react-router"
import { Aviso } from "../componentes/Aviso"
import { Botao } from "../componentes/Botao"
import { Campo } from "../componentes/Campo"
import { LayoutAuth } from "../componentes/LayoutAuth"
import { useCaminho, useT, type Chave } from "../i18n"
import { useAuth } from "../lib/sessao"
import { supabase } from "../lib/supabase"
import { errosPorCampo, mensagemDeErroAuth, redefinirSchema, type CamposDeErro } from "../lib/validacao"

// Destino do link de recuperação: o Supabase troca o código por uma sessão e só então a senha pode mudar.
export function RedefinirSenha() {
  const { sessao, carregando } = useAuth()
  const caminho = useCaminho()
  const t = useT()
  const navegar = useNavigate()
  const [erros, setErros] = useState<CamposDeErro>({})
  const [aviso, setAviso] = useState<Chave | null>(null)
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

  if (carregando) return <LayoutAuth titulo={t("redefinir.titulo")} subtitulo={t("redefinir.verificando")}>{null}</LayoutAuth>

  if (!sessao) {
    return (
      <LayoutAuth titulo={t("redefinir.invalido.titulo")} subtitulo={t("redefinir.invalido.subtitulo")}>
        <Link to={caminho("/recuperar-senha")} className="underline decoration-dourado underline-offset-4">
          {t("redefinir.invalido.pedir")}
        </Link>
      </LayoutAuth>
    )
  }

  return (
    <LayoutAuth titulo={t("redefinir.titulo")} subtitulo={t("redefinir.subtitulo")}>
      <form onSubmit={enviar} noValidate className="space-y-5">
        {aviso ? <Aviso tipo="erro">{t(aviso)}</Aviso> : null}
        <Campo
          rotulo={t("redefinir.rotulo")}
          name="senha"
          type="password"
          autoComplete="new-password"
          erro={t(erros.senha)}
          ajuda={t("auth.senha.regra")}
        />
        <Botao type="submit" ocupado={ocupado}>
          {t("redefinir.botao")}
        </Botao>
      </form>
    </LayoutAuth>
  )
}
