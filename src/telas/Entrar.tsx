import { useState, type SubmitEvent } from "react"
import { Link, Navigate, useLocation, useNavigate } from "react-router"
import { Aviso } from "../componentes/Aviso"
import { Botao } from "../componentes/Botao"
import { Campo } from "../componentes/Campo"
import { LayoutAuth } from "../componentes/LayoutAuth"
import { useAuth } from "../lib/sessao"
import { supabase } from "../lib/supabase"
import { errosPorCampo, loginSchema, mensagemDeErroAuth, type CamposDeErro } from "../lib/validacao"

export function Entrar() {
  const { sessao } = useAuth()
  const navegar = useNavigate()
  const origem = (useLocation().state as { de?: string } | null)?.de ?? "/perfil"
  const [erros, setErros] = useState<CamposDeErro>({})
  const [aviso, setAviso] = useState<string | null>(null)
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
    <LayoutAuth titulo="Entrar" subtitulo="Use o e-mail e a senha da sua conta.">
      <form onSubmit={enviar} noValidate className="space-y-5">
        {aviso ? <Aviso tipo="erro">{aviso}</Aviso> : null}
        <Campo rotulo="E-mail" name="email" type="email" autoComplete="email" erro={erros.email} />
        <Campo rotulo="Senha" name="senha" type="password" autoComplete="current-password" erro={erros.senha} />
        <Botao type="submit" ocupado={ocupado}>
          Entrar
        </Botao>
      </form>
      <p className="mt-6 text-sm text-creme/70">
        <Link to="/recuperar-senha" className="underline decoration-dourado underline-offset-4">
          Esqueci a senha
        </Link>
      </p>
      <p className="mt-3 text-sm text-creme/70">
        Ainda não tem conta?{" "}
        <Link to="/cadastro" className="underline decoration-dourado underline-offset-4">
          Criar conta
        </Link>
      </p>
    </LayoutAuth>
  )
}
