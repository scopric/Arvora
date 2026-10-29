import { useState, type SubmitEvent } from "react"
import { Link, Navigate } from "react-router"
import { Aviso } from "../componentes/Aviso"
import { Botao } from "../componentes/Botao"
import { Campo } from "../componentes/Campo"
import { LayoutAuth } from "../componentes/LayoutAuth"
import { useIdioma, useCaminho, useT, type Chave } from "../i18n"
import { useAuth } from "../lib/sessao"
import { supabase } from "../lib/supabase"
import { cadastroSchema, errosPorCampo, mensagemDeErroAuth, type CamposDeErro } from "../lib/validacao"

export function Cadastro() {
  const { sessao } = useAuth()
  const lang = useIdioma()
  const caminho = useCaminho()
  const t = useT()
  const [erros, setErros] = useState<CamposDeErro>({})
  const [aviso, setAviso] = useState<Chave | null>(null)
  const [enviado, setEnviado] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  if (sessao) return <Navigate to={caminho("/perfil")} replace />

  async function enviar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setAviso(null)
    const bruto = Object.fromEntries(new FormData(e.currentTarget))
    const dados = cadastroSchema.safeParse({ ...bruto, maior18: bruto.maior18 === "on" })
    if (!dados.success) return setErros(errosPorCampo(dados.error))
    setErros({})
    setOcupado(true)
    // nome e maior_18 viajam nos metadados só para o gatilho criar o perfil; papel e nível nunca vêm daqui.
    // idioma só escolhe o idioma do e-mail (apresentação, nunca autorização): os modelos leem .Data.idioma.
    const { error } = await supabase.auth.signUp({
      email: dados.data.email,
      password: dados.data.senha,
      options: {
        data: { nome: dados.data.nome, maior_18: "true", idioma: lang },
      },
    })
    setOcupado(false)
    if (error) return setAviso(mensagemDeErroAuth(error))
    setEnviado(true)
  }

  if (enviado) {
    return (
      <LayoutAuth titulo={t("cadastro.enviado.titulo")} subtitulo={t("cadastro.enviado.subtitulo")}>
        <Aviso tipo="ok">
          {t("cadastro.enviado.aviso")}
        </Aviso>
        <p className="mt-6 text-sm text-creme/70">
          <Link to={caminho("/entrar")} className="underline decoration-dourado underline-offset-4">
            {t("cadastro.enviado.entrar")}
          </Link>
        </p>
      </LayoutAuth>
    )
  }

  return (
    <LayoutAuth titulo={t("cadastro.titulo")} subtitulo={t("cadastro.subtitulo")}>
      <form onSubmit={enviar} noValidate className="space-y-5">
        {aviso ? <Aviso tipo="erro">{t(aviso)}</Aviso> : null}
        <Campo rotulo={t("cadastro.nome")} name="nome" autoComplete="name" erro={t(erros.nome)} />
        <Campo rotulo={t("auth.email.rotulo")} name="email" type="email" autoComplete="email" placeholder={t("auth.email.exemplo")} erro={t(erros.email)} />
        <Campo
          rotulo={t("auth.senha.rotulo")}
          name="senha"
          type="password"
          autoComplete="new-password"
          erro={t(erros.senha)}
          ajuda={t("auth.senha.regra")}
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
            <span>{t("cadastro.maior18")}</span>
          </label>
          {erros.maior18 ? (
            <p id="erro-maior18" role="alert" className="mt-2 text-sm text-red-300">
              {t(erros.maior18)}
            </p>
          ) : null}
        </div>
        <Botao type="submit" ocupado={ocupado}>
          {t("cadastro.botao")}
        </Botao>
      </form>
      <p className="mt-6 text-sm text-creme/70">
        {t("cadastro.jaTemConta")}{" "}
        <Link to={caminho("/entrar")} className="underline decoration-dourado underline-offset-4">
          {t("cadastro.entrar")}
        </Link>
      </p>
    </LayoutAuth>
  )
}
