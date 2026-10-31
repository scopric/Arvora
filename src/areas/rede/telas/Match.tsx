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
import { useCaminho, useIdioma, useT, useTitulo, type Chave } from "../../../i18n"
import { temNivel, useAcesso } from "../../../lib/acesso"
import { useAuth } from "../../../lib/sessao"
import { supabase } from "../../../lib/supabase"
import { AcaoConexao, CartaoPerfil, Etiqueta } from "../componentes"
import { COLUNAS_CONEXAO, dia, nomeCategoria, nomeSetor, ok, useCarga, vitrinesPorId, type Categoria, type Conexao, type Setor } from "../lib"

type Documento = { id: number; titulo: string; versao: string; conteudo_md: string }

// Prévia do Clube: dois cartões decorativos e borrados (aria-hidden dentro do Bloqueado); nenhum dado real.
function PreviaClube() {
  const t = useT()
  return (
    <div className="space-y-4">
      {[1, 2].map((n) => (
        <div key={n} className="rounded-2xl border border-current/15 p-5">
          <p className="text-lg font-semibold">{t("rede.match.previaNome")}</p>
          <p className="text-sm opacity-70">{t("rede.match.previaMotivo")}</p>
        </div>
      ))}
    </div>
  )
}

export function Match() {
  const t = useT()
  const idioma = useIdioma()
  const caminho = useCaminho()
  useTitulo("rede.match.titulo")
  const acesso = useAcesso()
  const { sessao } = useAuth()
  const uid = sessao?.user.id ?? ""
  const grupo = !acesso.carregando && !acesso.erro && temNivel(acesso.nivel, "grupo")
  const [desligando, setDesligando] = useState(false)
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

    const todas = ok(await supabase.from("sugestoes_match").select("id, sugerido_id, semana, motivo, pontuacao").order("semana", { ascending: false }).order("pontuacao", { ascending: false }).limit(50))
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

  async function ligar(documentoId: number) {
    setErro(null)
    setOcupado(true)
    const { error } = await supabase.from("consentimentos").insert({
      documento_id: documentoId,
      perfil_id: uid,
      titular_email: sessao?.user.email ?? "", // o banco troca pelo e-mail da conta
      evidencia: "tela /match",
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
        <section className="rounded-2xl border border-current/15 p-6">
          <h2 className="font-titulo text-3xl font-bold uppercase">{t(d.ja ? "rede.match.desligadoTitulo" : "rede.match.primeiraTitulo")}</h2>
          <p className="mt-3 max-w-prose">{t(d.ja ? "rede.match.desligadoTexto" : "rede.match.primeiraTexto")}</p>
          {d.documento ? (
            <details className="mt-4">
              <summary className="min-h-11 cursor-pointer py-2 font-semibold">{d.documento.titulo} · v{d.documento.versao}</summary>
              <p className="mt-2 max-h-64 overflow-y-auto text-sm whitespace-pre-wrap opacity-85">{d.documento.conteudo_md}</p>
            </details>
          ) : (
            <div className="mt-4"><Aviso tipo="erro">{t("rede.match.emRevisao")}</Aviso></div>
          )}
          {erro ? <div className="mt-4"><Aviso tipo="erro">{t(erro)}</Aviso></div> : null}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {d.documento ? (
              <Botao onClick={() => void ligar(d.documento!.id)} ocupado={ocupado} className="sm:w-auto">{t(d.ja ? "rede.match.religar" : "rede.match.ativar")}</Botao>
            ) : null}
            {!d.ja ? <Link to={caminho("/inicio")} className="inline-flex min-h-12 items-center justify-center rounded-lg border border-creme/30 px-6 font-semibold hover:border-creme/60">{t("rede.match.agoraNao")}</Link> : null}
          </div>
        </section>
      )
    } else {
      const porOutro = new Map(d.minhas.map((c) => [c.solicitante_id === uid ? c.destinatario_id : c.solicitante_id, c]))
      const visiveis = d.sugestoes.filter((s) => d.perfis?.get(s.sugerido_id))
      corpo = (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-3"><Selo tom="destaque">{t("rede.match.ligado")}</Selo>
              {d.semana ? <span className="text-sm opacity-70">{t("rede.match.semana")} {dia(`${d.semana}T12:00:00`, idioma)}</span> : null}
            </p>
            <Botao variante="contorno" onClick={() => setDesligando(true)} className="sm:w-auto">{t("rede.match.desligar")}</Botao>
          </div>
          {erro ? <div className="mt-4"><Aviso tipo="erro">{t(erro)}</Aviso></div> : null}
          <div className="mt-6">
            {visiveis.length === 0 ? (
              <Vazio>{t("rede.match.vazio")}</Vazio>
            ) : (
              <ul className="space-y-4">
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
                          <AcaoConexao uid={uid} outroId={s.sugerido_id} nome={p.nome ?? ""} origem="match" conexao={porOutro.get(s.sugerido_id)} aoMudar={recarregar} />
                          <Link to={caminho(`/network/${p.slug ?? s.sugerido_id}`)} className="inline-flex min-h-12 items-center px-2 underline">{t("rede.match.verPerfil")}</Link>
                        </>
                      }
                    >
                      <p className="mt-4 rounded-lg border border-destaque/40 px-4 py-3">
                        <span className="block font-mono text-xs font-semibold tracking-[0.2em] text-destaque uppercase">{t("rede.match.porque")}</span>
                        {s.motivo}
                      </p>
                    </CartaoPerfil>
                  )
                })}
              </ul>
            )}
          </div>
          <p className="mt-8 text-sm opacity-70">{t("rede.match.rodape")}</p>
          <DialogoConfirmar aberto={desligando} titulo={t("rede.match.desligarTitulo")} texto={t("rede.match.desligarTexto")} confirmar={t("rede.match.desligar")} aoConfirmar={() => void desligar(d.vigentes)} aoCancelar={() => setDesligando(false)} />
        </>
      )
    }
  }
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <h1 className="font-titulo text-4xl font-medium">{t("rede.match.titulo")}</h1>
      <p className="mt-2 opacity-75">{t("rede.match.intro")}</p>
      <div className="mt-8">{corpo}</div>
    </div>
  )
}
