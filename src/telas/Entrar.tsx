import { useState, type SubmitEvent } from "react"
import { Link, Navigate, useLocation, useNavigate } from "react-router"
import { Aviso } from "../componentes/Aviso"
import { Botao } from "../componentes/Botao"
import { Campo } from "../componentes/Campo"
import { LayoutAuth } from "../componentes/LayoutAuth"
import { useCaminho, useT, type Chave } from "../i18n"
import { useAuth } from "../lib/sessao"
import { supabase } from "../lib/supabase"
import { errosPorCampo, loginSchema, mensagemDeErroAuth, type CamposDeErro } from "../lib/validacao"

export function Entrar() {
  const { sessao } = useAuth()
  const caminho = useCaminho()
  const t = useT()
  const navegar = useNavigate()
  const de = (useLocation().state as { de?: string } | null)?.de
  // Só caminho interno: nada de redirecionar para fora do site.
  const origem = de?.startsWith("/") && !de.startsWith("//") ? de : caminho("/perfil")
  const [erros, setErros] = useState<CamposDeErro>({})
  const [aviso, setAviso] = useState<Chave | null>(null)
  const [ocupado, setOcupado] = useState(false)

  if (sessao) return <Navigate to={origem} replace />

  async function enviar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setAviso(null)
    const dados = loginSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)))
    if (!dados.success) return setErros(errosPorCampo(dados.error))
    setErros({})
    setOcupado(true)
    const { error } = await supabase.auth.signInWithPassword({ email: dados.data.email, password: dados.data.senha })
    setOcupado(false)
    if (error) return setAviso(mensagemDeErroAuth(error))
    navegar(origem, { replace: true })
  }

  return (
    <LayoutAuth titulo={t("entrar.titulo")} subtitulo={t("entrar.subtitulo")}>
      <form onSubmit={enviar} noValidate className="space-y-5">
        {aviso ? <Aviso tipo="erro">{t(aviso)}</Aviso> : null}
        <Campo rotulo={t("auth.email.rotulo")} name="email" type="email" autoComplete="email" placeholder={t("auth.email.exemplo")} erro={t(erros.email)} />
        <Campo rotulo={t("auth.senha.rotulo")} name="senha" type="password" autoComplete="current-password" erro={t(erros.senha)} />
        <Botao type="submit" ocupado={ocupado}>
          {t("entrar.botao")}
        </Botao>
      </form>
      <p className="mt-6 text-sm text-creme/70">
        <Link to={caminho("/recuperar-senha")} className="underline decoration-dourado underline-offset-4">
          {t("entrar.esqueci")}
        </Link>
      </p>
      <p className="mt-3 text-sm text-creme/70">
        {t("entrar.semConta")}{" "}
        <Link to={caminho("/cadastro")} className="underline decoration-dourado underline-offset-4">
          {t("entrar.criarConta")}
        </Link>
      </p>
    </LayoutAuth>
  )
}
