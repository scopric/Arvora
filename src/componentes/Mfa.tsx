import { useEffect, useState, type ReactNode, type SubmitEvent } from "react"
import { useCaminho, useT, useTitulo, type Chave } from "../i18n"
import { supabase } from "../lib/supabase"
import { Aviso } from "./Aviso"
import { Botao } from "./Botao"
import { Campo } from "./Campo"
import { Cartao } from "./Cartao"
import { BotaoSair } from "./ContasSeparadas"
import { Erro } from "./Erro"
import { Esqueleto } from "./Esqueleto"

// 2FA do admin (CON-05): aal2 por TOTP do Supabase. Três estados: sem fator → cadastrar (QR); com fator e aal1 → verificar o código;
// aal2 → renderiza `children`. Quem decide o acesso de verdade é o banco (papel_atual só vale em aal2); isto é só o caminho até lá.
type Estado =
  | { fase: "carregando" }
  | { fase: "erro" }
  | { fase: "ok" }
  | { fase: "cadastrar" }
  | { fase: "qr"; fator: string; qr: string; segredo: string }
  | { fase: "verificar"; fator: string }

async function descobrir(): Promise<Estado> {
  const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal.error) return { fase: "erro" }
  if (aal.data.currentLevel === "aal2") return { fase: "ok" }
  const fatores = await supabase.auth.mfa.listFactors()
  if (fatores.error) return { fase: "erro" }
  const verificado = fatores.data.totp[0]
  return verificado ? { fase: "verificar", fator: verificado.id } : { fase: "cadastrar" }
}

function Titulo() {
  useTitulo("mfa.titulo", true)
  return null
}

export function Mfa({ children }: { children: ReactNode }) {
  const t = useT()
  const caminho = useCaminho()
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" })
  const [aviso, setAviso] = useState<Chave | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const carregar = () => {
    setEstado({ fase: "carregando" })
    descobrir().then(setEstado, () => setEstado({ fase: "erro" }))
  }
  useEffect(() => {
    let ativo = true
    descobrir().then((e) => ativo && setEstado(e), () => ativo && setEstado({ fase: "erro" }))
    return () => {
      ativo = false
    }
  }, [])

  async function cadastrar() {
    setAviso(null)
    setOcupado(true)
    try {
      // Fator não verificado de tentativa anterior atrapalha um novo enroll: sai antes. Falha ao listar/limpar = erro na tela.
      const todos = await supabase.auth.mfa.listFactors()
      if (todos.error) return setAviso("mfa.erro")
      for (const f of todos.data.all) {
        if (f.factor_type === "totp" && f.status === "unverified") {
          const saiu = await supabase.auth.mfa.unenroll({ factorId: f.id })
          if (saiu.error) return setAviso("mfa.erro")
        }
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" })
      if (error || !data) return setAviso("mfa.erro")
      setEstado({ fase: "qr", fator: data.id, qr: data.totp.qr_code, segredo: data.totp.secret })
    } catch {
      setAviso("mfa.erro")
    } finally {
      setOcupado(false)
    }
  }

  async function verificar(e: SubmitEvent<HTMLFormElement>, fator: string) {
    e.preventDefault()
    setAviso(null)
    const codigo = String(new FormData(e.currentTarget).get("codigo") ?? "").replace(/\s/g, "")
    if (!/^\d{6}$/.test(codigo)) return setAviso("mfa.erroCodigo")
    setOcupado(true)
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fator, code: codigo })
      if (error) return setAviso(error.code === "mfa_verification_failed" ? "mfa.erroCodigo" : "mfa.erro")
      carregar() // a sessão virou aal2: confirma e libera
    } catch {
      setAviso("mfa.erro")
    } finally {
      setOcupado(false)
    }
  }

  if (estado.fase === "ok") return <>{children}</>

  const formulario = (fator: string) => (
    <form onSubmit={(e) => verificar(e, fator)} noValidate className="mt-6 space-y-5">
      {aviso ? <Aviso tipo="erro">{t(aviso)}</Aviso> : null}
      <Campo rotulo={t("mfa.codigo")} name="codigo" inputMode="numeric" autoComplete="one-time-code" maxLength={7} className="text-center text-titulo-p tracking-[0.3em] indent-[0.3em] tabular-nums" />
      <Botao type="submit" ocupado={ocupado}>{t("mfa.botao")}</Botao>
    </form>
  )

  // Molde: login do Linear — cartão centrado, texto curto, botões empilhados.
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16">
      <Cartao className="w-full max-w-md">
      <Titulo />
      <h1 className="text-titulo-p font-semibold">{t("mfa.titulo")}</h1>
      {estado.fase === "carregando" ? <Esqueleto className="mt-8" /> : null}
      {estado.fase === "erro" ? <div className="mt-8"><Erro aoTentar={carregar}>{t("mfa.erro")}</Erro></div> : null}
      {estado.fase === "cadastrar" ? (
        <>
          <p className="mt-3 text-corpo text-cinza">{t("mfa.cadastrar.texto")}</p>
          {aviso ? <div className="mt-6"><Aviso tipo="erro">{t(aviso)}</Aviso></div> : null}
          <Botao onClick={cadastrar} ocupado={ocupado} className="mt-6">{t("mfa.cadastrar.botao")}</Botao>
        </>
      ) : null}
      {estado.fase === "qr" ? (
        <>
          <p className="mt-3 text-corpo text-cinza">{t("mfa.cadastrar.texto")}</p>
          {/* data: URI de SVG gerado pelo Supabase; img-src do CSP já libera data: */}
          <img src={estado.qr} alt={t("mfa.qr.alt")} width="192" height="192" className="mt-6 size-48 rounded-lg bg-white p-2" />
          <p className="mt-4 text-corpo-p text-cinza">{t("mfa.qr.segredo")}</p>
          <p className="mt-1 font-mono text-corpo-p break-all select-all">{estado.segredo}</p>
          <p className="mt-6 text-corpo text-cinza">{t("mfa.verificar.texto")}</p>
          {formulario(estado.fator)}
        </>
      ) : null}
      {estado.fase === "verificar" ? (
        <>
          <p className="mt-3 text-corpo text-cinza">{t("mfa.verificar.texto")}</p>
          {formulario(estado.fator)}
        </>
      ) : null}
      {/* Sem o aplicativo à mão: trocar de conta ou sair (Decisão 67). */}
      <BotaoSair destino={caminho("/entrar")} className="mt-6" />
      </Cartao>
    </main>
  )
}
