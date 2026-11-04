import { useState, type SubmitEvent } from "react"
import { Link, Navigate } from "react-router"
import { Aviso } from "../componentes/Aviso"
import { Botao } from "../componentes/Botao"
import { BotaoGoogle } from "../componentes/BotaoGoogle"
import { Campo } from "../componentes/Campo"
import { Turnstile } from "../componentes/Turnstile"
import { LayoutAuth } from "../componentes/LayoutAuth"
import { useIdioma, useCaminho, useT, useTitulo, type Chave } from "../i18n"
import { useCaptcha } from "../lib/captcha"
import { linkSite } from "../lib/enderecos"
import { useAuth } from "../lib/sessao"
import { supabase } from "../lib/supabase"
import { cadastroSchema, errosPorCampo, mensagemDeErroAuth, type CamposDeErro } from "../lib/validacao"

const linkLegal = "underline decoration-dourado underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado"

export function Cadastro() {
  const { sessao } = useAuth()
  const lang = useIdioma()
  const caminho = useCaminho()
  const t = useT()
  useTitulo("titulo.cadastro", true)
  const [erros, setErros] = useState<CamposDeErro>({})
  const [aviso, setAviso] = useState<Chave | null>(null)
  const [enviado, setEnviado] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const captcha = useCaptcha()

  if (sessao) return <Navigate to={caminho("/inicio")} replace />

  async function enviar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setAviso(null)
    const bruto = Object.fromEntries(new FormData(e.currentTarget))
    const dados = cadastroSchema.safeParse({ ...bruto, maior18: bruto.maior18 === "on" })
    if (!dados.success) return setErros(errosPorCampo(dados.error))
    setErros({})
    if (captcha.falta) return setAviso("captcha.falta")
    setOcupado(true)
    // nome e maior_18 viajam nos metadados só para o gatilho criar o perfil; papel e nível nunca vêm daqui.
    // idioma só escolhe o idioma do e-mail (apresentação, nunca autorização): os modelos leem .Data.idioma.
    const { error } = await supabase.auth.signUp({
      email: dados.data.email,
      password: dados.data.senha,
      options: {
        data: { nome: dados.data.nome, maior_18: "true", idioma: lang },
        ...captcha.opcoes,
      },
    })
    setOcupado(false)
    if (error) {
      captcha.renovar()
      return setAviso(mensagemDeErroAuth(error))
    }
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
        <Turnstile key={captcha.reinicio} onToken={captcha.setToken} />
        {/* PROVISÓRIO: textos cadastro.legal.* a validar com o solicitor. Só informa e linka; o aceite registrado é no checkout. */}
        <p className="text-sm text-creme/70">
          {t("cadastro.legal.antes")}{" "}
          <a href={linkSite(caminho("/termos"))} className={linkLegal}>{t("publico.termos.titulo")}</a>{" "}
          {t("cadastro.legal.meio")}{" "}
          <a href={linkSite(caminho("/privacidade"))} className={linkLegal}>{t("publico.privacidade.titulo")}</a>.
        </p>
        <Botao type="submit" ocupado={ocupado}>
          {t("cadastro.botao")}
        </Botao>
      </form>
      {/* Pelo Google a declaração de 18 anos é pedida no primeiro acesso (RotaProtegida). */}
      <div className="mt-5 space-y-5">
        <p className="text-center text-sm text-creme/70">{t("auth.ou")}</p>
        <BotaoGoogle aoFalhar={() => setAviso("auth.googleFalhou")} />
      </div>
      <p className="mt-6 text-sm text-creme/70">
        {t("cadastro.jaTemConta")}{" "}
        <Link to={caminho("/entrar")} className="underline decoration-dourado underline-offset-4">
          {t("cadastro.entrar")}
        </Link>
      </p>
    </LayoutAuth>
  )
}
