import { useEffect, useState, type SubmitEvent } from "react"
import { Aviso } from "../../../componentes/Aviso"
import { Botao } from "../../../componentes/Botao"
import { Campo } from "../../../componentes/Campo"
import { Cartao } from "../../../componentes/Cartao"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { useT, type Chave } from "../../../i18n"
import { useAcesso } from "../../../lib/acesso"
import { useAuth } from "../../../lib/sessao"
import { supabase } from "../../../lib/supabase"
import { email as emailSchema, senha as senhaSchema } from "../../../lib/validacao"
import { Pagina } from "../Pagina"

type Msg = { tipo: "erro" | "ok"; texto: Chave } | null

export function Configuracoes() {
  const { equipe } = useAcesso()
  return (
    <Pagina titulo="conta.configuracoes.titulo">
      <BlocoEmail />
      <BlocoSenha />
      {/* Só a equipe tem 2FA (CON-05); membro comum não vê. */}
      {equipe ? <DoisFatores /> : null}
    </Pagina>
  )
}

function BlocoEmail() {
  const t = useT()
  const { sessao } = useAuth()
  const [erro, setErro] = useState<string>()
  const [msg, setMsg] = useState<Msg>(null)
  const [ocupado, setOcupado] = useState(false)

  async function trocar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    setMsg(null)
    const dados = emailSchema.safeParse(String(new FormData(form).get("email") ?? ""))
    if (!dados.success) return setErro(t(dados.error.issues[0].message as Chave))
    if (dados.data === sessao?.user.email?.toLowerCase()) return setErro(t("conta.email.igual"))
    setErro(undefined)
    setOcupado(true)
    const { error } = await supabase.auth.updateUser({ email: dados.data })
    setOcupado(false)
    if (error) return setMsg({ tipo: "erro", texto: error.code === "over_email_send_rate_limit" ? "conta.email.limite" : "conta.email.erro" })
    form.reset()
    setMsg({ tipo: "ok", texto: "conta.email.enviado" })
  }

  return (
    <Cartao>
      <h2 className="text-corpo-g font-semibold">{t("conta.email.titulo")}</h2>
      <p className="mt-3 text-sm text-creme/70">{t("conta.email.atual")}: <span className="font-semibold text-creme">{sessao?.user.email}</span></p>
      <form onSubmit={trocar} noValidate className="mt-5 space-y-5">
        {msg ? <Aviso tipo={msg.tipo}>{t(msg.texto)}</Aviso> : null}
        <Campo rotulo={t("conta.email.novo")} name="email" type="email" autoComplete="email" erro={erro} />
        <Botao type="submit" ocupado={ocupado} className="sm:w-auto">{t("conta.email.botao")}</Botao>
      </form>
    </Cartao>
  )
}

// Com a reautenticação ligada (secure_password_change), o Supabase recusa a troca com reauthentication_needed:
// pedimos o código por e-mail (reauthenticate) e repetimos a troca com o código como nonce.
function BlocoSenha() {
  const t = useT()
  const [erros, setErros] = useState<{ senha?: string; codigo?: string }>({})
  const [msg, setMsg] = useState<Msg>(null)
  const [ocupado, setOcupado] = useState(false)
  const [pedeCodigo, setPedeCodigo] = useState(false)

  async function novoCodigo() {
    setOcupado(true)
    await pedirCodigo()
    setOcupado(false)
  }

  async function pedirCodigo() {
    const { error } = await supabase.auth.reauthenticate()
    if (error) return setMsg({ tipo: "erro", texto: error.code === "over_email_send_rate_limit" ? "conta.email.limite" : "conta.senha.erro" })
    setPedeCodigo(true)
    setMsg({ tipo: "ok", texto: "conta.senha.codigoEnviado" })
  }

  async function trocar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const dados = new FormData(form)
    setMsg(null)
    const nova = senhaSchema.safeParse(String(dados.get("senha") ?? ""))
    const codigo = String(dados.get("codigo") ?? "").trim()
    if (!nova.success || (pedeCodigo && !codigo)) {
      return setErros({
        senha: nova.success ? undefined : t(nova.error.issues[0].message as Chave),
        codigo: pedeCodigo && !codigo ? t("conta.senha.codigoInvalido") : undefined,
      })
    }
    setErros({})
    setOcupado(true)
    const { error } = await supabase.auth.updateUser(pedeCodigo ? { password: nova.data, nonce: codigo } : { password: nova.data })
    if (error?.code === "reauthentication_needed") await pedirCodigo()
    else if (error) {
      setMsg({
        tipo: "erro",
        texto:
          error.code === "reauthentication_not_valid" ? "conta.senha.codigoInvalido"
          : error.code === "same_password" ? "conta.senha.igual"
          : error.code === "weak_password" ? "conta.senha.fraca"
          : "conta.senha.erro",
      })
    } else {
      form.reset()
      setPedeCodigo(false)
      setMsg({ tipo: "ok", texto: "conta.senha.ok" })
    }
    setOcupado(false)
  }

  return (
    <Cartao>
      <h2 className="text-corpo-g font-semibold">{t("conta.senha.titulo")}</h2>
      <form onSubmit={trocar} noValidate className="mt-5 space-y-5">
        {msg ? <Aviso tipo={msg.tipo}>{t(msg.texto)}</Aviso> : null}
        <Campo rotulo={t("conta.senha.nova")} name="senha" type="password" autoComplete="new-password" erro={erros.senha} />
        {pedeCodigo ? (
          <>
            <p className="text-sm text-creme/70">{t("conta.senha.codigoTexto")}</p>
            <Campo rotulo={t("conta.senha.codigo")} name="codigo" inputMode="numeric" autoComplete="one-time-code" erro={erros.codigo} />
          </>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Botao type="submit" ocupado={ocupado} className="sm:w-auto">{t("conta.senha.botao")}</Botao>
          {pedeCodigo ? (
            <Botao type="button" variante="contorno" ocupado={ocupado} onClick={() => void novoCodigo()} className="sm:w-auto">{t("conta.senha.novoCodigo")}</Botao>
          ) : null}
        </div>
      </form>
    </Cartao>
  )
}

type Fator =
  | { fase: "carregando" }
  | { fase: "erro" }
  | { fase: "pronto"; fatores: string[] }
  | { fase: "qr"; fator: string; qr: string; segredo: string }

const soCodigo = (e: SubmitEvent<HTMLFormElement>) => String(new FormData(e.currentTarget).get("codigo") ?? "").replace(/\s/g, "")

// Cadastrar/remover o fator TOTP da equipe. Remover exige o código atual: o Supabase só aceita unenroll em sessão aal2,
// e o código também confirma que quem clicou é quem tem o aplicativo.
function DoisFatores() {
  const t = useT()
  const [estado, setEstado] = useState<Fator>({ fase: "carregando" })
  const [msg, setMsg] = useState<Msg>(null)
  const [ocupado, setOcupado] = useState(false)
  const [removendo, setRemovendo] = useState(false)

  async function descobrir(): Promise<Fator> {
    const { data, error } = await supabase.auth.mfa.listFactors()
    return error ? { fase: "erro" } : { fase: "pronto", fatores: data.totp.map((f) => f.id) }
  }
  useEffect(() => {
    let ativo = true
    descobrir().then((e) => ativo && setEstado(e), () => ativo && setEstado({ fase: "erro" }))
    return () => {
      ativo = false
    }
  }, [])

  async function cadastrar() {
    setMsg(null)
    setOcupado(true)
    try {
      // Fator não verificado de tentativa anterior atrapalha um novo enroll: sai antes (como no Mfa do admin).
      const todos = await supabase.auth.mfa.listFactors()
      if (todos.error) return setMsg({ tipo: "erro", texto: "mfa.erro" })
      for (const f of todos.data.all) {
        if (f.factor_type === "totp" && f.status === "unverified") {
          const saiu = await supabase.auth.mfa.unenroll({ factorId: f.id })
          if (saiu.error) return setMsg({ tipo: "erro", texto: "mfa.erro" })
        }
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" })
      if (error || !data) return setMsg({ tipo: "erro", texto: "mfa.erro" })
      setEstado({ fase: "qr", fator: data.id, qr: data.totp.qr_code, segredo: data.totp.secret })
    } catch {
      setMsg({ tipo: "erro", texto: "mfa.erro" })
    } finally {
      setOcupado(false)
    }
  }

  async function confirmar(e: SubmitEvent<HTMLFormElement>, fator: string, remover: string[] | null) {
    e.preventDefault()
    setMsg(null)
    const codigo = soCodigo(e)
    if (!/^\d{6}$/.test(codigo)) return setMsg({ tipo: "erro", texto: "mfa.erroCodigo" })
    setOcupado(true)
    try {
      const v = await supabase.auth.mfa.challengeAndVerify({ factorId: fator, code: codigo })
      if (v.error) return setMsg({ tipo: "erro", texto: v.error.code === "mfa_verification_failed" ? "mfa.erroCodigo" : "mfa.erro" })
      if (remover) {
        // Remove TODOS os fatores verificados: sobrar um deixaria a conta exigindo 2FA depois do "removido".
        for (const id of remover) {
          const r = await supabase.auth.mfa.unenroll({ factorId: id })
          if (r.error) {
            setEstado(await descobrir()) // mostra o estado real
            return setMsg({ tipo: "erro", texto: "mfa.erro" })
          }
        }
        setRemovendo(false)
      }
      setEstado(await descobrir())
      setMsg({ tipo: "ok", texto: remover ? "conta.dois.removido" : "conta.dois.cadastrado" })
    } catch {
      setMsg({ tipo: "erro", texto: "mfa.erro" })
    } finally {
      setOcupado(false)
    }
  }

  const formCodigo = (fator: string, remover: string[] | null) => (
    <form onSubmit={(e) => void confirmar(e, fator, remover)} noValidate className="mt-5 space-y-5">
      <Campo rotulo={t("mfa.codigo")} name="codigo" inputMode="numeric" autoComplete="one-time-code" maxLength={7} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Botao type="submit" ocupado={ocupado} className="sm:w-auto">{t(remover ? "conta.dois.removerBotao" : "mfa.botao")}</Botao>
        {remover ? <Botao type="button" variante="contorno" disabled={ocupado} onClick={() => setRemovendo(false)} className="sm:w-auto">{t("comum.cancelar")}</Botao> : null}
      </div>
    </form>
  )

  return (
    <Cartao>
      <h2 className="text-corpo-g font-semibold">{t("conta.dois.titulo")}</h2>
      <p className="mt-3 text-sm text-creme/70">{t("conta.dois.texto")}</p>
      <div className="mt-5 space-y-4">
        {msg ? <Aviso tipo={msg.tipo}>{t(msg.texto)}</Aviso> : null}
        {estado.fase === "carregando" ? <Esqueleto linhas={2} /> : null}
        {estado.fase === "erro" ? <Erro aoTentar={() => (setEstado({ fase: "carregando" }), descobrir().then(setEstado, () => setEstado({ fase: "erro" })))}>{t("mfa.erro")}</Erro> : null}
        {estado.fase === "pronto" && estado.fatores.length === 0 ? (
          <>
            <p className="font-semibold">{t("conta.dois.inativa")}</p>
            <Botao type="button" ocupado={ocupado} onClick={() => void cadastrar()} className="sm:w-auto">{t("conta.dois.cadastrar")}</Botao>
          </>
        ) : null}
        {estado.fase === "pronto" && estado.fatores.length > 0 ? (
          <>
            <p className="font-semibold">{t("conta.dois.ativa")}</p>
            {removendo ? (
              <>
                <Aviso tipo="erro">{t("conta.dois.removerTexto")}</Aviso>
                {formCodigo(estado.fatores[0], estado.fatores)}
              </>
            ) : (
              <Botao type="button" variante="contorno" onClick={() => (setMsg(null), setRemovendo(true))} className="sm:w-auto">{t("conta.dois.remover")}</Botao>
            )}
          </>
        ) : null}
        {estado.fase === "qr" ? (
          <>
            <p className="text-sm text-creme/70">{t("mfa.cadastrar.texto")}</p>
            {/* data: URI de SVG gerado pelo Supabase; img-src do CSP já libera data: */}
            <img src={estado.qr} alt={t("mfa.qr.alt")} width="192" height="192" className="size-48 rounded-lg bg-white p-2" />
            <p className="text-sm text-creme/70">{t("mfa.qr.segredo")}</p>
            <p className="font-mono text-sm break-all select-all">{estado.segredo}</p>
            <p className="text-sm text-creme/70">{t("mfa.verificar.texto")}</p>
            {formCodigo(estado.fator, null)}
          </>
        ) : null}
      </div>
    </Cartao>
  )
}
