import { useState, type SubmitEvent } from "react"
import { Link, Navigate, useLocation, useNavigate } from "react-router"
import { Aviso } from "../componentes/Aviso"
import { Botao } from "../componentes/Botao"
import { BotaoGoogle } from "../componentes/BotaoGoogle"
import { Campo } from "../componentes/Campo"
import { Turnstile } from "../componentes/Turnstile"
import { LayoutAuth } from "../componentes/LayoutAuth"
import { useCaminho, useT, useTitulo, type Chave } from "../i18n"
import { useCaptcha } from "../lib/captcha"
import { caminhoInterno, ehPainel, inicioDepoisDoLogin } from "../lib/enderecos"
import { useAuth } from "../lib/sessao"
import { supabase } from "../lib/supabase"
import { errosPorCampo, loginSchema, mensagemDeErroAuth, type CamposDeErro } from "../lib/validacao"

export function Entrar() {
  const { sessao, carregando } = useAuth()
  const caminho = useCaminho()
  const t = useT()
  useTitulo("titulo.entrar", true)
  const navegar = useNavigate()
  const local = useLocation()
  // ?de= vem de outro endereço (Decisão 66, root.tsx); a validação abaixo vale para os dois.
  const de = (local.state as { de?: string } | null)?.de ?? new URLSearchParams(local.search).get("de") ?? undefined
  // Só caminho interno: nada de redirecionar para fora do site.
  const origem = caminhoInterno(de) ?? caminho(inicioDepoisDoLogin(window.location.origin))
  const [erros, setErros] = useState<CamposDeErro>({})
  // Conta de membro que tentou o painel volta aqui com ?motivo=membro (Decisão 67).
  // ?error= é a volta do Google com falha (recusou o acesso, ou o Auth não criou a conta).
  const [aviso, setAviso] = useState<Chave | null>(() => {
    const busca = new URLSearchParams(local.search)
    if (busca.has("error")) return "auth.googleFalhou"
    return ehPainel(window.location.origin) && busca.get("motivo") === "membro" ? "entrar.contaDeMembro" : null
  })
  const [ocupado, setOcupado] = useState(false)
  // E-mail da última tentativa recusada por falta de confirmação: habilita o reenvio do link.
  const [semConfirmar, setSemConfirmar] = useState<string | null>(null)
  const [reenvio, setReenvio] = useState<Chave | null>(null)
  const captcha = useCaptcha()

  if (sessao) return <Navigate to={origem} replace />
  // Voltou do Google com ?code= e a troca pela sessão falhou (código vencido, aberto em outro navegador): avisa.
  const trocaFalhou = !carregando && new URLSearchParams(local.search).has("code")

  async function enviar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setAviso(null)
    const dados = loginSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)))
    if (!dados.success) return setErros(errosPorCampo(dados.error))
    setErros({})
    if (captcha.falta) return setAviso("captcha.falta")
    setOcupado(true)
    const { error } = await supabase.auth.signInWithPassword({ email: dados.data.email, password: dados.data.senha, ...(captcha.token && { options: captcha.opcoes }) })
    setOcupado(false)
    if (error) {
      captcha.renovar() // o token vale uma vez só
      setSemConfirmar(error.code === "email_not_confirmed" ? dados.data.email : null)
      setReenvio(null)
      return setAviso(mensagemDeErroAuth(error))
    }
    navegar(origem, { replace: true })
  }

  async function reenviar() {
    if (!semConfirmar) return
    if (captcha.falta) return setReenvio("captcha.falta")
    setOcupado(true)
    const { error } = await supabase.auth.resend({ type: "signup", email: semConfirmar, options: captcha.opcoes })
    setOcupado(false)
    captcha.renovar()
    setReenvio(error ? mensagemDeErroAuth(error) : "entrar.reenviado")
  }

  return (
    <LayoutAuth titulo={t("entrar.titulo")} subtitulo={t("entrar.subtitulo")}>
      <form onSubmit={enviar} noValidate className="space-y-5">
        {aviso || trocaFalhou ? <Aviso tipo="erro">{t(aviso ?? "auth.googleFalhou")}</Aviso> : null}
        {semConfirmar ? (
          <div className="space-y-3">
            {reenvio ? <Aviso tipo={reenvio === "entrar.reenviado" ? "ok" : "erro"}>{t(reenvio)}</Aviso> : null}
            <Botao type="button" variante="contorno" ocupado={ocupado} onClick={reenviar}>
              {t("entrar.reenviar")}
            </Botao>
          </div>
        ) : null}
        <Campo rotulo={t("auth.email.rotulo")} name="email" type="email" autoComplete="email" placeholder={t("auth.email.exemplo")} erro={t(erros.email)} />
        <Campo rotulo={t("auth.senha.rotulo")} name="senha" type="password" autoComplete="current-password" erro={t(erros.senha)} />
        <Turnstile key={captcha.reinicio} onToken={captcha.setToken} />
        <Botao type="submit" ocupado={ocupado}>
          {t("entrar.botao")}
        </Botao>
      </form>
      {/* No painel só a equipe entra, com e-mail, senha e 2FA (Decisão 67). */}
      {ehPainel(window.location.origin) ? null : (
        <div className="mt-5 space-y-5">
          <p className="text-center text-sm text-creme/70">{t("auth.ou")}</p>
          <BotaoGoogle destino={de ? origem : undefined} aoFalhar={() => setAviso("auth.googleFalhou")} />
        </div>
      )}
      <p className="mt-6 text-sm text-creme/70">
        <Link to={caminho("/recuperar-senha")} className="underline decoration-dourado underline-offset-4">
          {t("entrar.esqueci")}
        </Link>
      </p>
      {/* No painel ninguém cria conta: contas da equipe são criadas à parte (Decisão 67). */}
      {ehPainel(window.location.origin) ? null : (
        <p className="mt-3 text-sm text-creme/70">
          {t("entrar.semConta")}{" "}
          <Link to={caminho("/cadastro")} className="underline decoration-dourado underline-offset-4">
            {t("entrar.criarConta")}
          </Link>
        </p>
      )}
    </LayoutAuth>
  )
}
