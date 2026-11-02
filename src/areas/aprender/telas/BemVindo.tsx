import { useEffect, useRef, useState, type SubmitEvent } from "react"
import { Link, useNavigate } from "react-router"
import { Aviso } from "../../../componentes/Aviso"
import { Botao } from "../../../componentes/Botao"
import { Campo, Selecao } from "../../../componentes/Campo"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Bloqueado } from "../../../componentes/Bloqueado"
import { useCaminho, useIdioma, useT, type Chave } from "../../../i18n"
import { temNivel, useAcesso } from "../../../lib/acesso"
import { useAuth } from "../../../lib/sessao"
import { supabase } from "../../../lib/supabase"
import { errosPorCampo, perfilSchema } from "../../../lib/validacao"
import { Agenda } from "../componentes/Agenda"
import { Pagina } from "../componentes/Pagina"
import { QuandoAula } from "../componentes/QuandoAula"
import { COLUNAS_AULA, type AulaLinha } from "../tipos"
import { useCarga } from "../useCarga"
import { botaoContorno, cartao, dados, linhas, linkTexto } from "../util"

// No onboarding só os campos de perfil que importam já; o resto o membro completa em Meu perfil (mesmo schema).
const passo1 = perfilSchema.pick({ nome: true, empresa_nome: true, setor_id: true, cidade: true, pais: true, visibilidade: true })
type Perfil = { nome: string; empresa_nome: string | null; setor_id: number | null; cidade: string | null; pais: string | null; visibilidade: "membros" | "publico" }
type Cat = { id: number; nome: string; nome_en: string | null }
type Item = { id: number; tipo: "procura" | "oferece"; categoria_id: number }

export function BemVindo() {
  const t = useT()
  const lang = useIdioma()
  const caminho = useCaminho()
  const ir = useNavigate()
  const acesso = useAcesso()
  const { sessao } = useAuth()
  const uid = sessao?.user.id ?? ""
  const grupo = temNivel(acesso.nivel, "grupo")
  const [etapa, setEtapa] = useState(1)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState<Chave | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [marcados, setMarcados] = useState<Set<string> | null>(null) // "procura:3"; null = ainda os do banco
  const titulo = useRef<HTMLHeadingElement>(null)

  const [estado, recarregar] = useCarga(async () => {
    const [p, s, c, i, a] = await Promise.all([
      supabase.from("perfis").select("nome, empresa_nome, setor_id, cidade, pais, visibilidade").eq("id", uid).maybeSingle(),
      supabase.from("setores").select("id, nome, nome_en").eq("ativo", true).order("ordem").order("nome"),
      supabase.from("categorias_rede").select("id, nome, nome_en").eq("ativa", true).order("ordem"),
      supabase.from("network_itens").select("id, tipo, categoria_id").eq("perfil_id", uid),
      supabase.from("aulas").select(COLUNAS_AULA).eq("tipo", "ao_vivo").is("materiais_publicados_em", null).gte("inicio_em", new Date(Date.now() - 3 * 3600000).toISOString()).order("inicio_em").limit(1).maybeSingle(),
    ])
    const perfil = dados(p) as Perfil | null
    if (!perfil) throw new Error("perfil")
    return { perfil, setores: linhas(s), categorias: dados(c) as Cat[], itens: dados(i) as Item[], aula: dados(a) as AulaLinha | null }
  }, uid)

  useEffect(() => titulo.current?.focus(), [etapa])

  const chave = "aprender.bemVindo.titulo"
  if (acesso.carregando || estado.fase === "carregando") return <Pagina chave={chave}><Esqueleto linhas={5} /></Pagina>
  if (acesso.erro) return <Pagina chave={chave}><Erro aoTentar={acesso.recarregar}>{t("acesso.erro")}</Erro></Pagina>
  if (estado.fase === "erro") return <Pagina chave={chave}><Erro aoTentar={recarregar} /></Pagina>
  const { perfil, setores, categorias, itens, aula } = estado.dados
  const sel = marcados ?? new Set(itens.map((x) => `${x.tipo}:${x.categoria_id}`))

  async function salvarPerfil(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setAviso(null)
    const r = passo1.safeParse(Object.fromEntries(new FormData(e.currentTarget)))
    if (!r.success) {
      setAviso("perfil.corrija")
      return setErros(Object.fromEntries(Object.entries(errosPorCampo(r.error)).map(([c, k]) => [c, t(k)])))
    }
    setErros({})
    setOcupado(true)
    const { data, error } = await supabase.from("perfis").update(r.data).eq("id", uid).select("id") // .select: Erros 2.5
    setOcupado(false)
    if (error || !data || data.length === 0) return setAviso("perfil.erroSalvar")
    recarregar() // o formulário volta ao passo 1 com o que está gravado
    setEtapa(2)
  }

  // Idempotente: o diff é contra o que está no banco agora (relido ao fim de cada gravação), o INSERT ignora o que já existe
  // (ON CONFLICT DO NOTHING) e, no fim, o estado do banco é conferido contra a escolha. Voltar ao passo 2 e salvar de novo não duplica.
  async function salvarRede() {
    setAviso(null)
    setOcupado(true)
    const antes = new Set(itens.map((x) => `${x.tipo}:${x.categoria_id}`))
    const novos = [...sel].filter((k) => !antes.has(k)).map((k) => ({ tipo: k.split(":")[0] as Item["tipo"], categoria_id: Number(k.split(":")[1]) }))
    const fora = itens.filter((x) => !sel.has(`${x.tipo}:${x.categoria_id}`))
    const ins = novos.length ? await supabase.from("network_itens").upsert(novos, { onConflict: "perfil_id,tipo,categoria_id", ignoreDuplicates: true }) : null
    const del = fora.length ? await supabase.from("network_itens").delete().in("id", fora.map((x) => x.id)) : null
    const depois = ins?.error || del?.error ? null : await supabase.from("network_itens").select("id, tipo, categoria_id").eq("perfil_id", uid)
    setOcupado(false)
    const chaves = new Set((depois?.data ?? []).map((x) => `${x.tipo}:${x.categoria_id}`))
    if (!depois || depois.error || chaves.size !== sel.size || [...sel].some((k) => !chaves.has(k))) {
      recarregar()
      return setAviso("aprender.bemVindo.erroRede")
    }
    setMarcados(null) // a partir daqui a escolha é a do banco
    recarregar()
    setEtapa(3)
  }

  async function concluir() {
    setAviso(null)
    setOcupado(true)
    const { data, error } = await supabase.from("perfis").update({ onboarding_em: new Date().toISOString() }).eq("id", uid).select("id")
    setOcupado(false)
    if (error || !data || data.length === 0) return setAviso("perfil.erroSalvar")
    ir(caminho("/inicio"))
  }

  const alternar = (k: string) => {
    const n = new Set(sel)
    if (!n.delete(k)) n.add(k)
    setMarcados(n)
  }
  const nomeDe = (c: Cat) => (lang === "en" ? (c.nome_en ?? c.nome) : c.nome)
  const grupoChips = (tipo: Item["tipo"], legenda: Chave) => (
    <fieldset>
      <legend className="mb-2 text-legenda font-medium text-bruma">{t(legenda)}</legend>
      <div className="flex flex-wrap gap-2">
        {categorias.map((c) => (
          <label key={c.id} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-grafite px-3 text-legenda font-medium text-bruma transition-colors pointer-coarse:min-h-11 hover:text-creme has-[:checked]:border-bruma has-[:checked]:bg-creme/5 has-[:checked]:text-creme has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-dourado">
            <input type="checkbox" checked={sel.has(`${tipo}:${c.id}`)} onChange={() => alternar(`${tipo}:${c.id}`)} className="size-4 accent-dourado" />
            {nomeDe(c)}
          </label>
        ))}
      </div>
    </fieldset>
  )

  return (
    <Pagina chave={chave}>
      {/* Molde Linear (welcome): coluna estreita, passos com ponto dourado no atual, formulário em cartão. */}
      <div className="max-w-2xl">
      <ol className="mb-6 flex flex-wrap gap-x-5 gap-y-1 text-legenda" aria-label={t("aprender.bemVindo.passos")}>
        {(["aprender.bemVindo.passo1", grupo ? "aprender.bemVindo.passo2" : "aprender.bemVindo.passo2Clube", "aprender.bemVindo.passo3"] as Chave[]).map((k, i) => (
          <li key={k} aria-current={etapa === i + 1 ? "step" : undefined} className={`flex items-center gap-2 ${etapa === i + 1 ? "font-medium text-creme" : "text-nevoa"}`}><span aria-hidden="true" className={`size-1.5 rounded-full ${etapa === i + 1 ? "bg-dourado" : "bg-fumaca"}`} />{i + 1}. {t(k)}</li>
        ))}
      </ol>
      <h2 ref={titulo} tabIndex={-1} className="mb-5 text-subtitulo font-semibold outline-none">
        {t(etapa === 1 ? "aprender.bemVindo.passo1" : etapa === 2 ? (grupo ? "aprender.bemVindo.passo2" : "aprender.bemVindo.passo2Clube") : "aprender.bemVindo.passo3")}
        <span className="ml-3 text-legenda font-normal text-nevoa">{t("aprender.bemVindo.passoDe").replace("{n}", String(etapa))}</span>
      </h2>
      {aviso ? <div className="mb-4"><Aviso tipo="erro">{t(aviso)}</Aviso></div> : null}

      {etapa === 1 ? (
        <form onSubmit={salvarPerfil} noValidate className={`${cartao} space-y-5`}>
          <p className="text-base text-bruma">{t("aprender.bemVindo.perfilTexto")}</p>
          <Campo rotulo={t("perfil.nome")} name="nome" defaultValue={perfil.nome} erro={erros.nome} autoComplete="name" />
          <Campo rotulo={t("perfil.empresa")} name="empresa_nome" defaultValue={perfil.empresa_nome ?? ""} erro={erros.empresa_nome} autoComplete="organization" />
          <Selecao rotulo={t("perfil.setor")} name="setor_id" defaultValue={perfil.setor_id?.toString() ?? ""} erro={erros.setor_id}>
            <option value="">{t("perfil.setor.selecione")}</option>
            {setores.map((s) => (
              <option key={s.id} value={s.id}>{lang === "en" ? (s.nome_en ?? s.nome) : s.nome}</option>
            ))}
          </Selecao>
          <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
            <Campo rotulo={t("perfil.cidade")} name="cidade" defaultValue={perfil.cidade ?? ""} erro={erros.cidade} autoComplete="address-level2" />
            <Campo rotulo={t("perfil.pais")} name="pais" defaultValue={perfil.pais ?? ""} erro={erros.pais} maxLength={2} ajuda={t("perfil.pais.ajuda")} />
          </div>
          <Selecao rotulo={t("perfil.visibilidade.legenda")} name="visibilidade" defaultValue={perfil.visibilidade} erro={erros.visibilidade}>
            <option value="membros">{t("perfil.visibilidade.membros")}</option>
            <option value="publico">{t("perfil.visibilidade.publico")}</option>
          </Selecao>
          <div className="flex flex-wrap items-center gap-4">
            <Botao type="submit" ocupado={ocupado} className="sm:w-auto">{t("aprender.bemVindo.continuar")}</Botao>
            <button type="button" onClick={() => setEtapa(2)} className={linkTexto}>{t("aprender.bemVindo.pular")}</button>
          </div>
        </form>
      ) : null}

      {etapa === 2 ? (
        <div className={`${cartao} space-y-6`}>
          {grupo ? (
            <>
              <p className="text-base text-bruma">{t("aprender.bemVindo.redeTexto")}</p>
              {grupoChips("procura", "aprender.bemVindo.busco")}
              {grupoChips("oferece", "aprender.bemVindo.ofereco")}
            </>
          ) : (
            <>
              <p className="text-base text-bruma">{t("aprender.bemVindo.conhecaRede")}</p>
              <Link to={caminho("/network")} className={linkTexto}>{t("aprender.bemVindo.verRede")}</Link>
            </>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" onClick={() => setEtapa(1)} className={botaoContorno}>{t("aprender.bemVindo.voltar")}</button>
            <Botao ocupado={ocupado} className="sm:w-auto" onClick={() => (grupo ? void salvarRede() : setEtapa(3))}>{t("aprender.bemVindo.continuar")}</Botao>
            <button type="button" onClick={() => setEtapa(3)} className={linkTexto}>{t("aprender.bemVindo.pular")}</button>
          </div>
        </div>
      ) : null}

      {etapa === 3 ? (
        <div className="space-y-6">
          {grupo ? (
            aula && aula.inicio_em ? (
              <div className={`${cartao} space-y-3`}>
                <p className="text-legenda font-medium text-nevoa">{t("aprender.inicio.proximaAula")}</p>
                <h3 className="text-corpo-g font-semibold">{aula.titulo}</h3>
                <p className="text-base text-bruma"><QuandoAula inicio={aula.inicio_em} /></p>
                <Agenda aula={{ ...aula, inicio_em: aula.inicio_em }} />
              </div>
            ) : (
              <p className="text-base text-nevoa">{t("aprender.aulas.vazio")}</p>
            )
          ) : (
            <Bloqueado frase={t("aprender.aulas.bloqueado")} minimo="grupo" />
          )}
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" onClick={() => setEtapa(2)} className={botaoContorno}>{t("aprender.bemVindo.voltar")}</button>
            <Botao variante={grupo ? "primario" : "contorno"} ocupado={ocupado} className="sm:w-auto" onClick={() => void concluir()}>{t("aprender.bemVindo.concluir")}</Botao>
          </div>
        </div>
      ) : null}
      </div>
    </Pagina>
  )
}
