import { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import { Aviso } from "../componentes/Aviso"
import { Botao } from "../componentes/Botao"
import { LayoutAuth } from "../componentes/LayoutAuth"
import { useCaminho, useT, useTitulo, type Chave } from "../i18n"
import { supabase } from "../lib/supabase"
import { confirmarSchema, mensagemDeErroAuth } from "../lib/validacao"

// Destino dos links dos e-mails. Só o clique no botão consome o código: um GET (leitor de e-mail, antivírus) não gasta o link.
export function Confirmar() {
  const [params] = useSearchParams()
  const navegar = useNavigate()
  const caminho = useCaminho()
  const t = useT()
  useTitulo("titulo.confirmar", true)
  const [aviso, setAviso] = useState<Chave | null>(null)
  const [registrado, setRegistrado] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const dados = confirmarSchema.safeParse(Object.fromEntries(params))

  async function confirmar() {
    if (!dados.success) return
    setAviso(null)
    setOcupado(true)
    try {
      const { data, error } = await supabase.auth.verifyOtp(dados.data)
      if (error) return setAviso(mensagemDeErroAuth(error))
      // Com confirmação dupla, o 1º link da troca de e-mail só registra o aceite (resposta sem sessão); o 2º conclui.
      if (dados.data.type === "email_change" && !data?.session) return setRegistrado(true)
      navegar(caminho(dados.data.type === "recovery" ? "/redefinir-senha" : "/perfil"), { replace: true })
    } catch {
      setAviso("confirmar.erro")
    } finally {
      setOcupado(false)
    }
  }

  if (!dados.success) {
    return (
      <LayoutAuth titulo={t("confirmar.invalido.titulo")} subtitulo={t("confirmar.invalido.subtitulo")}>
        <Link to={caminho("/entrar")} className="underline decoration-dourado underline-offset-4">
          {t("confirmar.irEntrar")}
        </Link>
      </LayoutAuth>
    )
  }

  if (registrado) {
    return (
      <LayoutAuth titulo={t("confirmar.registrado.titulo")} subtitulo={t("confirmar.registrado.subtitulo")}>
        <div className="space-y-5">
          <Aviso tipo="ok">
            {t("confirmar.registrado.aviso")}
          </Aviso>
          <Link to={caminho("/entrar")} className="underline decoration-dourado underline-offset-4">
            {t("confirmar.irEntrar")}
          </Link>
        </div>
      </LayoutAuth>
    )
  }

  return (
    <LayoutAuth titulo={t("confirmar.titulo")} subtitulo={t("confirmar.subtitulo")}>
      <div className="space-y-5">
        {aviso ? <Aviso tipo="erro">{t(aviso)}</Aviso> : null}
        <Botao type="button" ocupado={ocupado} onClick={confirmar}>
          {t("confirmar.botao")}
        </Botao>
      </div>
    </LayoutAuth>
  )
}
