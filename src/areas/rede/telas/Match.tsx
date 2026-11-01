import { useState } from "react"
import { Link } from "react-router"
import { Aviso } from "../../../componentes/Aviso"
import { Bloqueado } from "../../../componentes/Bloqueado"
import { Botao } from "../../../componentes/Botao"
import { DialogoConfirmar } from "../../../componentes/DialogoConfirmar"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Selo } from "../../../componentes/Selo"
import { Vazio } from "../../../componentes/Vazio"
import { useCaminho, useIdioma, useT, type Chave } from "../../../i18n"
import { botaoContornoApp } from "../../../componentes/botaoEstilo"
import { linkTextoApp } from "../../../componentes/menuApp"
import { PaginaApp } from "../../../componentes/PaginaApp"
import { temNivel, useAcesso } from "../../../lib/acesso"
import { useAuth } from "../../../lib/sessao"
import { supabase } from "../../../lib/supabase"
import { AcaoConexao, CartaoPerfil, Etiqueta } from "../componentes"
import { COLUNAS_CONEXAO, dia, nomeCategoria, nomeSetor, ok, useCarga, vitrinesPorId, type Categoria, type Conexao, type Setor } from "../lib"

type MotivoDados = { categoria_id?: number; tipo?: string; mesma_cidade?: boolean; cidade?: string; mesmo_setor?: boolean }
type Documento = { id: number; titulo: string; versao: string; conteudo_md: string }

// Prévia do Clube: dois cartões decorativos e borrados (aria-hidden dentro do Bloqueado); nenhum dado real.
function PreviaClube() {
  const t = useT()
  return (
    <div className="space-y-4">
      {[1, 2].map((n) => (
        <div key={n} className="rounded-xl p-5 shadow-borda">
          <p className="text-base font-semibold">{t("rede.match.previaNome")}</p>
          <p className="text-legenda text-nevoa">{t("rede.match.previaMotivo")}</p>
        </div>
      ))}
    </div>
  )
}

export function Match() {
  const t = useT()
  const idioma = useIdioma()
  const caminho = useCaminho()
  const acesso = useAcesso()
  const { sessao } = useAuth()
  const uid = sessao?.user.id ?? ""
  const grupo = !acesso.carregando && !acesso.erro && temNivel(acesso.nivel, "grupo")
  const [desligando, setDesligando] = useState(false)
  const [lido, setLido] = useState(false)
  const [erro, setErro] = useState<Chave | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const { estado, recarregar } = useCarga(async () => {
    if (!grupo) return null
    const [doc, cons, conexoes] = await Promise.all([
      supabase.from("documentos_legais").select("id, titulo, versao, conteudo_md").eq("tipo", "match").eq("idioma", idioma)
        .lte("vigente_desde", new Date().toISOString()).order("vigente_desde", { ascending: false }).limit(1),
      supabase.from("consentimentos").select("id, revogado_em, documentos_legais!inner(tipo)").eq("perfil_id", uid).eq("documentos_legais.tipo", "match"),
      supabase.from("conexoes").select(COLUNAS_CONEXAO),
    ])
    const documento = (ok(doc)[0] ?? null) as Documento | null
    const vigentes = ok(cons).filter((c) => !c.revogado_em).map((c) => c.id)
    const ja = ok(cons).length > 0
    const minhas = ok(conexoes) as Conexao[]
    if (vigentes.length === 0) return { documento, vigentes, ja, sugestoes: [], minhas }

    // motivo_dados (jsonb) ainda pode não existir no banco: sem ele, cai no `motivo` em texto.
    type Sug = { id: number; sugerido_id: string; semana: string; motivo: string; pontuacao: number; motivo_dados?: MotivoDados | null }
    const consulta = (cols: string) => supabase.from("sugestoes_match").select(cols).order("semana", { ascending: false }).order("pontuacao", { ascending: false }).limit(50)
    let r = await consulta("id, sugerido_id, semana, motivo, pontuacao, motivo_dados")
    if (r.error) r = await consulta("id, sugerido_id, semana, motivo, pontuacao")
    const todas = ok(r as unknown as { data: Sug[] | null; error: unknown })
    const semana = todas[0]?.semana
    const atuais = todas.filter((s) => s.semana === semana)
    const ids = atuais.map((s) => s.sugerido_id)
    const [perfis, itens, setores, categorias] = await Promise.all([
      vitrinesPorId(ids),
      ids.length ? supabase.from("network_itens").select("perfil_id, categoria_id").eq("tipo", "oferece").in("perfil_id", ids) : { data: [], error: null },
      supabase.from("setores").select("id, nome, nome_en"),
      supabase.from("categorias_rede").select("id, nome, nome_en"),
    ])
    return {
      documento, vigentes, ja, minhas,
      sugestoes: atuais, perfis, itens: ok(itens), setores: ok(setores) as Setor[], categorias: ok(categorias) as Categoria[], semana,
    }
  }, `${grupo}-${idioma}`)

  async function ligar(documentoId: number, versao: string) {
    setErro(null)
    setOcupado(true)
    const { error } = await supabase.from("consentimentos").insert({
      documento_id: documentoId,
      perfil_id: uid,
      titular_email: sessao?.user.email ?? "", // o banco troca pelo e-mail da conta
      evidencia: `tela /match, texto v${versao}`,
    }).select("id")
    setOcupado(false)
    if (error) return setErro("rede.match.erroLigar")
    recarregar()
  }
  async function desligar(ids: number[]) {
    setDesligando(false)
    setErro(null)
    // .select('id'): se o RLS não casar linhas, o UPDATE volta vazio e o Match NÃO foi desligado (Erros 2.5).
    const { data, error } = await supabase.from("consentimentos").update({ revogado_em: new Date().toISOString() }).in("id", ids).select("id")
    if (error || !data || data.length !== ids.length) return setErro("rede.match.erroDesligar")
    recarregar()
  }

  let corpo
  if (acesso.carregando) corpo = <Esqueleto linhas={4} />
  else if (acesso.erro) corpo = <Erro aoTentar={acesso.recarregar}>{t("acesso.erro")}</Erro>
  else if (!temNivel(acesso.nivel, "clube")) corpo = <Bloqueado minimo="clube" frase={t("rede.match.bloqueadoVisitante")} />
  else if (!grupo) corpo = <Bloqueado previa={<PreviaClube />} frase={t("rede.match.bloqueado")} />
  else if (estado.fase === "carregando") corpo = <Esqueleto linhas={4} />
  else if (estado.fase === "erro" || !estado.dados) corpo = <Erro aoTentar={recarregar}>{t("rede.match.erro")}</Erro>
  else {
    const d = estado.dados
    const ligado = d.vigentes.length > 0
    if (!ligado) {
      // Primeira vez: pede o opt-in. Desligado: explica e deixa religar. Sem documento vigente não liga (aviso).
      corpo = (
        <section className="max-w-2xl rounded-xl p-6 shadow-borda">
          <h2 className="text-corpo-g font-semibold">{t(d.ja ? "rede.match.desligadoTitulo" : "rede.match.primeiraTitulo")}</h2>
          <p className="mt-3 max-w-prose text-base text-bruma">{t(d.ja ? "rede.match.desligadoTexto" : "rede.match.primeiraTexto")}</p>
          {d.documento ? (
            <>
              <details open className="mt-5 rounded-md bg-creme/2 px-4 py-1 shadow-borda">
                <summary className="min-h-9 cursor-pointer py-2 text-legenda font-medium text-bruma pointer-coarse:min-h-11">{d.documento.titulo} · v{d.documento.versao}</summary>
                <p className="mt-1 mb-3 max-h-64 overflow-y-auto text-base whitespace-pre-wrap">{d.documento.conteudo_md}</p>
              </details>
              <label className="mt-5 flex items-start gap-3 text-base">
                <input type="checkbox" checked={lido} onChange={(e) => setLido(e.target.checked)} className="mt-1 size-4 accent-dourado" />
                <span>{t("rede.match.li")} (v{d.documento.versao})</span>
              </label>
            </>
          ) : (
            <div className="mt-4"><Aviso tipo="erro">{t("rede.match.emRevisao")}</Aviso></div>
          )}
          {erro ? <div className="mt-4"><Aviso tipo="erro">{t(erro)}</Aviso></div> : null}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {d.documento ? (
              <Botao disabled={!lido} onClick={() => void ligar(d.documento!.id, d.documento!.versao)} ocupado={ocupado} className="sm:w-auto">{t(d.ja ? "rede.match.religar" : "rede.match.ativar")}</Botao>
            ) : null}
            {!d.ja ? <Link to={caminho("/inicio")} className={botaoContornoApp}>{t("rede.match.agoraNao")}</Link> : null}
          </div>
        </section>
      )
    } else {
      const porOutro = new Map(d.minhas.map((c) => [c.solicitante_id === uid ? c.destinatario_id : c.solicitante_id, c]))
      const frase = (s: { motivo: string; motivo_dados?: MotivoDados | null }) => {
        const m = s.motivo_dados
        if (!m || typeof m !== "object") return s.motivo
        const partes: string[] = []
        if (m.categoria_id !== undefined) partes.push(`${t("rede.match.oferece")} ${nomeCategoria(d.categorias ?? [], m.categoria_id, idioma)}${t("rede.match.queProcura")}`)
        if (m.mesma_cidade) partes.push(`${t("rede.match.mesmaCidade")}${m.cidade ? ` (${m.cidade})` : ""}`)
        if (m.mesmo_setor) partes.push(t("rede.match.mesmoSetor"))
        return partes.length ? partes.join("; ") : s.motivo
      }
      const visiveis = d.sugestoes.filter((s) => d.perfis?.get(s.sugerido_id))
      corpo = (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-3"><Selo tom="destaque">{t("rede.match.ligado")}</Selo>
              {d.semana ? <span className="text-legenda text-nevoa">{t("rede.match.semana")} {dia(`${d.semana}T12:00:00`, idioma)}</span> : null}
            </p>
            <Botao variante="contorno" onClick={() => setDesligando(true)} className="sm:w-auto">{t("rede.match.desligar")}</Botao>
          </div>
          {erro ? <div className="mt-4"><Aviso tipo="erro">{t(erro)}</Aviso></div> : null}
          <div className="mt-6">
            {visiveis.length === 0 ? (
              <Vazio>{t("rede.match.vazio")}</Vazio>
            ) : (
              <ul className="grid gap-4 md:grid-cols-2">
                {visiveis.map((s) => {
                  const p = d.perfis!.get(s.sugerido_id)!
                  return (
                    <CartaoPerfil
                      key={s.id}
                      perfil={p}
                      setor={nomeSetor(d.setores ?? [], p.setor_id, idioma)}
                      tags={(d.itens ?? []).filter((i) => i.perfil_id === s.sugerido_id).map((i) => <Etiqueta key={i.categoria_id}>{nomeCategoria(d.categorias ?? [], i.categoria_id, idioma)}</Etiqueta>)}
                      acoes={
                        <>
                          <AcaoConexao uid={uid} outroId={s.sugerido_id} nome={p.nome ?? ""} origem="match" conexao={porOutro.get(s.sugerido_id)} aoMudar={recarregar} destaque={false} />
                          <Link to={caminho(`/network/${p.slug ?? s.sugerido_id}`)} className={`inline-flex min-h-9 items-center text-legenda ${linkTextoApp}`}>{t("rede.match.verPerfil")}</Link>
                        </>
                      }
                    >
                      <p className="mt-4 border-l-2 border-destaque pl-3 text-legenda text-bruma">
                        <span className="block font-medium text-nevoa">{t("rede.match.porque")}</span>
                        {frase(s)}
                      </p>
                    </CartaoPerfil>
                  )
                })}
              </ul>
            )}
          </div>
          <p className="mt-8 text-legenda text-nevoa">{t("rede.match.rodape")}</p>
          <DialogoConfirmar aberto={desligando} titulo={t("rede.match.desligarTitulo")} texto={t("rede.match.desligarTexto")} confirmar={t("rede.match.desligar")} aoConfirmar={() => void desligar(d.vigentes)} aoCancelar={() => setDesligando(false)} />
        </>
      )
    }
  }
  return (
    <PaginaApp chave="rede.match.titulo" intro={t("rede.match.intro")}>
      {corpo}
    </PaginaApp>
  )
}
