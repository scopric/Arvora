import { useEffect, useState, type SubmitEvent } from "react"
import { useNavigate } from "react-router"
import { Aviso } from "../componentes/Aviso"
import { Botao } from "../componentes/Botao"
import { Campo, Selecao } from "../componentes/Campo"
import { Marca } from "../componentes/Marca"
import { useCaminho, useIdioma, useT, useTitulo, type Chave } from "../i18n"
import { baixarMeusDados } from "../lib/exportar"
import { abrirPortal } from "../lib/assinatura"
import { excluirMinhaConta } from "../lib/excluirConta"
import { sair, useAuth } from "../lib/sessao"
import { supabase } from "../lib/supabase"
import { errosPorCampo, perfilSchema } from "../lib/validacao"

const COLUNAS = "id, nome, empresa_nome, setor_id, cidade, pais, linkedin_url, instagram, bio, visibilidade, publico_aprovado_em"

type PerfilLinha = {
  nome: string
  empresa_nome: string | null
  setor_id: number | null
  cidade: string | null
  pais: string | null
  linkedin_url: string | null
  instagram: string | null
  bio: string | null
  visibilidade: "membros" | "publico"
  publico_aprovado_em: string | null
}
type Setor = { id: number; nome: string; nome_en: string | null }
type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: Chave }
  | { fase: "pronto"; perfil: PerfilLinha; setores: Setor[] }

export function Perfil() {
  const { sessao } = useAuth()
  const t = useT()
  useTitulo("titulo.perfil", true)
  const idioma = useIdioma()
  const uid = sessao?.user.id
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" })
  const [erros, setErros] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState<{ tipo: "erro" | "ok"; texto: Chave } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [baixando, setBaixando] = useState(false)
  const [erroDados, setErroDados] = useState<Chave | null>(null)

  useEffect(() => {
    if (!uid) return
    let ativo = true
    Promise.all([
      supabase.from("perfis").select(COLUNAS).eq("id", uid).maybeSingle(),
      supabase.from("setores").select("id, nome, nome_en").eq("ativo", true).order("ordem").order("nome"),
    ]).then(([p, s]) => {
      if (!ativo) return
      // Falha vira mensagem na tela, nunca formulário vazio (Erros 3.2).
      if (p.error || s.error || !p.data) {
        return setEstado({ fase: "erro", mensagem: "perfil.erroCarregar" })
      }
      setEstado({ fase: "pronto", perfil: p.data as PerfilLinha, setores: s.data })
    })
    return () => {
      ativo = false
    }
  }, [uid])

  async function salvar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!uid || estado.fase !== "pronto") return
    setAviso(null)
    const dados = perfilSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)))
    if (!dados.success) {
      setAviso({ tipo: "erro", texto: "perfil.corrija" })
      return setErros(Object.fromEntries(Object.entries(errosPorCampo(dados.error)).map(([c, k]) => [c, t(k)])))
    }
    setErros({})
    setOcupado(true)
    // .select('id'): sob RLS um UPDATE que não casa linha nenhuma volta "ok" e vazio (Erros 2.5).
    const { data, error } = await supabase.from("perfis").update(dados.data).eq("id", uid).select("id")
    setOcupado(false)
    if (error?.code === "23505") {
      return setAviso({ tipo: "erro", texto: "perfil.erroUrl" })
    }
    if (error || !data || data.length === 0) {
      return setAviso({ tipo: "erro", texto: "perfil.erroSalvar" })
    }
    setAviso({ tipo: "ok", texto: "perfil.salvo" })
    setEstado({ ...estado, perfil: { ...estado.perfil, ...dados.data, publico_aprovado_em: null } })
  }

  async function baixar() {
    setErroDados(null)
    setBaixando(true)
    try {
      setErroDados(await baixarMeusDados())
    } catch {
      setErroDados("perfil.dados.erro")
    } finally {
      setBaixando(false)
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
      <header className="mb-10 flex items-start justify-between gap-6">
        <div>
          <Marca />
          <h1 className="mt-4 font-titulo text-4xl font-medium">{t("perfil.titulo")}</h1>
        </div>
        <button
          type="button"
          onClick={() => void sair()}
          className="rounded-lg border border-creme/30 px-4 py-2 text-sm font-semibold hover:border-creme/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado"
        >
          {t("perfil.sair")}
        </button>
      </header>

      {estado.fase === "carregando" ? <p role="status" className="text-creme/70">{t("comum.carregando")}</p> : null}
      {estado.fase === "erro" ? <Aviso tipo="erro">{t(estado.mensagem)}</Aviso> : null}
      {estado.fase === "pronto" ? (
        <form key={JSON.stringify(estado.perfil)} onSubmit={salvar} noValidate className="space-y-5">
          {aviso ? <Aviso tipo={aviso.tipo}>{t(aviso.texto)}</Aviso> : null}
          <p className="text-sm text-creme/70">{t("perfil.emailConta")} {sessao?.user.email}</p>
          <Campo rotulo={t("perfil.nome")} name="nome" defaultValue={estado.perfil.nome} erro={erros.nome} autoComplete="name" />
          <Campo rotulo={t("perfil.empresa")} name="empresa_nome" defaultValue={estado.perfil.empresa_nome ?? ""} erro={erros.empresa_nome} autoComplete="organization" />
          <Selecao rotulo={t("perfil.setor")} name="setor_id" defaultValue={estado.perfil.setor_id?.toString() ?? ""} erro={erros.setor_id}>
            <option value="">{t("perfil.setor.selecione")}</option>
            {estado.setores.map((s) => (
              <option key={s.id} value={s.id}>
                {idioma === "en" ? (s.nome_en ?? s.nome) : s.nome}
              </option>
            ))}
          </Selecao>
          <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
            <Campo rotulo={t("perfil.cidade")} name="cidade" defaultValue={estado.perfil.cidade ?? ""} erro={erros.cidade} autoComplete="address-level2" />
            <Campo rotulo={t("perfil.pais")} name="pais" defaultValue={estado.perfil.pais ?? ""} erro={erros.pais} maxLength={2} placeholder="IE" ajuda={t("perfil.pais.ajuda")} />
          </div>
          <Campo rotulo="LinkedIn" name="linkedin_url" type="url" defaultValue={estado.perfil.linkedin_url ?? ""} erro={erros.linkedin_url} placeholder={t("perfil.linkedin.exemplo")} />
          <Campo rotulo="Instagram" name="instagram" defaultValue={estado.perfil.instagram ?? ""} erro={erros.instagram} placeholder={t("perfil.instagram.exemplo")} />
          <div>
            <label htmlFor="bio" className="mb-2 block text-sm font-semibold">{t("perfil.bio")}</label>
            <textarea
              id="bio"
              name="bio"
              rows={4}
              maxLength={600}
              defaultValue={estado.perfil.bio ?? ""}
              aria-invalid={erros.bio ? true : undefined}
              className="w-full rounded-lg border border-creme/25 bg-transparent px-4 py-3 text-base outline-none focus-visible:border-dourado focus-visible:ring-2 focus-visible:ring-dourado/40"
            />
            {erros.bio ? <p role="alert" className="mt-2 text-sm text-red-300">{erros.bio}</p> : null}
          </div>

          <fieldset className="space-y-3 rounded-lg border border-creme/25 p-4">
            <legend className="px-2 text-sm font-semibold">{t("perfil.visibilidade.legenda")}</legend>
            <label className="flex items-start gap-3 text-sm">
              <input type="radio" name="visibilidade" value="membros" defaultChecked={estado.perfil.visibilidade === "membros"} className="mt-0.5 size-5 accent-dourado" />
              <span>{t("perfil.visibilidade.membros")}</span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input type="radio" name="visibilidade" value="publico" defaultChecked={estado.perfil.visibilidade === "publico"} className="mt-0.5 size-5 accent-dourado" />
              <span>{t("perfil.visibilidade.publico")}</span>
            </label>
            {estado.perfil.visibilidade === "publico" ? (
              <p className="text-sm text-creme/70">
                {t(estado.perfil.publico_aprovado_em ? "perfil.visibilidade.aprovado" : "perfil.visibilidade.aguarda")}
              </p>
            ) : null}
          </fieldset>

          <Botao type="submit" ocupado={ocupado}>{t("perfil.salvar")}</Botao>
        </form>
      ) : null}
      {uid ? <BlocoAssinatura uid={uid} /> : null}

      <section className="mt-12 border-t border-creme/15 pt-8">
        <h2 className="text-sm font-semibold">{t("perfil.dados.titulo")}</h2>
        <p className="mt-2 text-sm text-creme/70">
          {t("perfil.dados.texto")}
        </p>
        {erroDados ? <div className="mt-4"><Aviso tipo="erro">{t(erroDados)}</Aviso></div> : null}
        <div className="mt-4 sm:max-w-xs">
          <Botao type="button" variante="contorno" ocupado={baixando} onClick={() => void baixar()}>
            {t("perfil.dados.baixar")}
          </Botao>
        </div>
      </section>
      {uid ? <BlocoExcluirConta /> : null}
    </main>
  )
}

// Só aparece para quem já tem cliente no Stripe (RLS limita a leitura ao dono). Planos e preços não moram aqui.
function BlocoAssinatura({ uid }: { uid: string }) {
  const idioma = useIdioma()
  const t = useT()
  const [estado, setEstado] = useState<"carregando" | "sem" | "com" | "erro">("carregando")
  const [erro, setErro] = useState<Chave | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let ativo = true
    supabase.from("clientes_stripe").select("id").eq("perfil_id", uid).limit(1).then(({ data, error }) => {
      if (ativo) setEstado(error || !data ? "erro" : data.length > 0 ? "com" : "sem")
    })
    return () => {
      ativo = false
    }
  }, [uid])

  if (estado === "carregando" || estado === "sem") return null
  return (
    <section className="mt-12 space-y-3 border-t border-creme/15 pt-8">
      <h2 className="font-titulo text-2xl font-medium">{t("perfil.assinatura.titulo")}</h2>
      {estado === "erro" ? <Aviso tipo="erro">{t("perfil.assinatura.erro")}</Aviso> : null}
      {erro ? <Aviso tipo="erro">{t(erro)}</Aviso> : null}
      {estado === "com" ? (
        <Botao
          type="button"
          variante="contorno"
          ocupado={ocupado}
          onClick={async () => {
            setErro(null)
            setOcupado(true)
            const falha = await abrirPortal(idioma)
            setOcupado(false)
            setErro(falha)
          }}
        >
          {t("perfil.assinatura.gerenciar")}
        </Botao>
      ) : null}
    </section>
  )
}

// Zona de perigo, recolhida por padrão. O servidor reconfere e-mail e senha: aqui só se evita o clique sem querer.
function BlocoExcluirConta() {
  const t = useT()
  const navegar = useNavigate()
  const caminho = useCaminho()
  const [aberto, setAberto] = useState(false)
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [erro, setErro] = useState<Chave | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function excluir(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (ocupado || !email.trim() || !senha) return
    setErro(null)
    setOcupado(true)
    const falha = await excluirMinhaConta(email, senha)
    if (falha) {
      setOcupado(false)
      return setErro(falha)
    }
    navegar(caminho("/"), { replace: true })
  }

  return (
    <section className="mt-12 space-y-4 border-t border-creme/15 pt-8">
      <h2 className="font-titulo text-2xl font-medium">{t("perfil.excluir.titulo")}</h2>
      {!aberto ? (
        <button
          type="button"
          aria-expanded={false}
          onClick={() => setAberto(true)}
          className="text-sm text-creme/70 underline underline-offset-4 hover:text-creme focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado"
        >
          {t("perfil.excluir.abrir")}
        </button>
      ) : (
        <form onSubmit={excluir} noValidate className="space-y-5">
          <div className="space-y-2 text-sm text-creme/80">
            <p>{t("perfil.excluir.aviso")}</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>{t("perfil.excluir.perde")}</li>
              <li>{t("perfil.excluir.assinatura")}</li>
              <li>{t("perfil.excluir.retidos")}</li>
              <li>{t("perfil.excluir.backup")}</li>
            </ul>
          </div>
          {erro ? <Aviso tipo="erro">{t(erro)}</Aviso> : null}
          <Campo rotulo={t("perfil.excluir.email")} name="confirmar_email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Campo rotulo={t("perfil.excluir.senha")} name="confirmar_senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          <div className="flex gap-3">
            <Botao type="submit" variante="contorno" ocupado={ocupado} disabled={!email.trim() || !senha}>
              {t("perfil.excluir.confirmar")}
            </Botao>
            <Botao type="button" variante="contorno" disabled={ocupado} onClick={() => setAberto(false)}>
              {t("perfil.excluir.cancelar")}
            </Botao>
          </div>
        </form>
      )}
    </section>
  )
}
