import { useState, type SubmitEvent } from "react"
import { Link, Navigate } from "react-router"
import { Aviso } from "../componentes/Aviso"
import { Botao } from "../componentes/Botao"
import { Campo } from "../componentes/Campo"
import { LayoutAuth } from "../componentes/LayoutAuth"
import { useAuth } from "../lib/sessao"
import { supabase } from "../lib/supabase"
import { cadastroSchema, errosPorCampo, mensagemDeErroAuth, type CamposDeErro } from "../lib/validacao"

export function Cadastro() {
  const { sessao } = useAuth()
  const [erros, setErros] = useState<CamposDeErro>({})
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  if (sessao) return <Navigate to="/perfil" replace />

  async function enviar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setAviso(null)
    const bruto = Object.fromEntries(new FormData(e.currentTarget))
    const dados = cadastroSchema.safeParse({ ...bruto, maior18: bruto.maior18 === "on" })
    if (!dados.success) return setErros(errosPorCampo(dados.error))
    setErros({})
    setOcupado(true)
    // nome e maior_18 viajam nos metadados só para o gatilho criar o perfil; papel e nível nunca vêm daqui.
    const { error } = await supabase.auth.signUp({
      email: dados.data.email,
      password: dados.data.senha,
      options: {
        data: { nome: dados.data.nome, maior_18: "true" },
        emailRedirectTo: `${window.location.origin}/entrar`,
      },
    })
    setOcupado(false)
    if (error) return setAviso(mensagemDeErroAuth(error))
    setEnviado(true)
  }

  if (enviado) {
    return (
      <LayoutAuth titulo="Confira seu e-mail" subtitulo="Falta só um passo.">
        <Aviso tipo="ok">
          Se esse e-mail puder ser cadastrado, enviamos um link de confirmação. Abra a mensagem e clique no link para
          ativar a conta.
        </Aviso>
        <p className="mt-6 text-sm text-creme/70">
          <Link to="/entrar" className="underline decoration-dourado underline-offset-4">
            Já confirmei, quero entrar
          </Link>
        </p>
      </LayoutAuth>
    )
  }

  return (
    <LayoutAuth titulo="Criar conta" subtitulo="Leva um minuto. Você confirma o e-mail em seguida.">
      <form onSubmit={enviar} noValidate className="space-y-5">
        {aviso ? <Aviso tipo="erro">{aviso}</Aviso> : null}
        <Campo rotulo="Nome" name="nome" autoComplete="name" erro={erros.nome} />
        <Campo rotulo="E-mail" name="email" type="email" autoComplete="email" erro={erros.email} />
        <Campo
          rotulo="Senha"
          name="senha"
          type="password"
          autoComplete="new-password"
          erro={erros.senha}
          ajuda="8 ou mais caracteres, com maiúscula, minúscula e número."
        />
        <div>
          <label className="flex items-start gap-3 text-sm text-creme">
            <input
              type="checkbox"
              name="maior18"
              aria-invalid={erros.maior18 ? true : undefined}
              aria-describedby={erros.maior18 ? "erro-maior18" : undefined}
              className="mt-0.5 size-5 shrink-0 accent-dourado"
            />
            <span>Tenho 18 anos ou mais.</span>
          </label>
          {erros.maior18 ? (
            <p id="erro-maior18" role="alert" className="mt-2 text-sm text-red-300">
              {erros.maior18}
            </p>
          ) : null}
        </div>
        <Botao type="submit" ocupado={ocupado}>
          Criar conta
        </Botao>
      </form>
      <p className="mt-6 text-sm text-creme/70">
        Já tem conta?{" "}
        <Link to="/entrar" className="underline decoration-dourado underline-offset-4">
          Entrar
        </Link>
      </p>
    </LayoutAuth>
  )
}
