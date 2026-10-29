import { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import { Aviso } from "../componentes/Aviso"
import { Botao } from "../componentes/Botao"
import { LayoutAuth } from "../componentes/LayoutAuth"
import { useCaminho } from "../i18n"
import { supabase } from "../lib/supabase"
import { confirmarSchema, mensagemDeErroAuth } from "../lib/validacao"

// Destino dos links dos e-mails. Só o clique no botão consome o código: um GET (leitor de e-mail, antivírus) não gasta o link.
export function Confirmar() {
  const [params] = useSearchParams()
  const navegar = useNavigate()
  const caminho = useCaminho()
  const [aviso, setAviso] = useState<string | null>(null)
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
      setAviso("Algo deu errado do nosso lado. Tente de novo em instantes.")
    } finally {
      setOcupado(false)
    }
  }

  if (!dados.success) {
    return (
      <LayoutAuth titulo="Link inválido" subtitulo="Esse link está incompleto ou não é reconhecido.">
        <Link to={caminho("/entrar")} className="underline decoration-dourado underline-offset-4">
          Ir para a entrada
        </Link>
      </LayoutAuth>
    )
  }

  if (registrado) {
    return (
      <LayoutAuth titulo="Confirmação registrada" subtitulo="Falta só o outro endereço.">
        <div className="space-y-5">
          <Aviso tipo="ok">
            Para concluir a troca de e-mail, abra também o link que enviamos para o outro endereço (o antigo ou o novo).
          </Aviso>
          <Link to={caminho("/entrar")} className="underline decoration-dourado underline-offset-4">
            Ir para a entrada
          </Link>
        </div>
      </LayoutAuth>
    )
  }

  return (
    <LayoutAuth titulo="Confirmar" subtitulo="Clique no botão para concluir.">
      <div className="space-y-5">
        {aviso ? <Aviso tipo="erro">{aviso}</Aviso> : null}
        <Botao type="button" ocupado={ocupado} onClick={confirmar}>
          Confirmar
        </Botao>
      </div>
    </LayoutAuth>
  )
}
