import { useState, type ReactNode } from "react"
import { Botao } from "../../../componentes/Botao"
import { Selecao } from "../../../componentes/Campo"
import { DialogoConfirmar } from "../../../componentes/DialogoConfirmar"
import { Aviso } from "../../../componentes/Aviso"
import { Selo } from "../../../componentes/Selo"
import { Tabela } from "../../../componentes/Tabela"
import { Vazio } from "../../../componentes/Vazio"
import { useIdioma, useT, type Chave } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { AreaTexto, classeAcao } from "../componentes/Campos"
import { FormularioRegistro, type CampoDef } from "../componentes/FormularioRegistro"
import { AvisoDe, Mostrar, Pagina, Secao, SemPermissao } from "../componentes/Pagina"
import { enviarArquivo, exigir, exigirLinha, exigirSemDados, abrirAssinado, useAcao, useCarga } from "../lib/consulta"
import { cicloAnterior, cicloDe, cicloFim, dataCurta, decimalParaCentavos, hojeEmDublin, moeda } from "../lib/formato"
import { FINANCEIRO, SUPER, usePode } from "../lib/papel"

export type LinhaRel = { fonte: string; ref_id: number; data: string; conta_ou_origem: string; cliente: string | null; moeda: string; bruto: number; vat: number | null; taxa: number | null; bruto_eur: number | null; vat_eur: number | null; referencia: string | null }
export type Relatorio = {
  ciclo: { inicio: string; fim: string; estado: "rascunho" | "fechado"; ultima_versao: number | null }
  cambio: { data_referencia: string; taxas: { moeda: string; taxa: number; data: string | null; fonte_url: string | null }[] }
  receita: { stripe: number; externa: number; bruta: number }
  deducoes: { vat: number; estornos: number; estornos_vat: number; total: number }
  receita_base: number
  clientes_ativos: { quantidade: number; lista: { chave: string; origem: string }[] }
  ia: { avulsa: number; rateio: number; total: number; por_nivel: { nivel: string; receita_liquida: number; horas_ia: number; horas_total: number; rateio: number }[] }
  faixa: { faixa: number; limites: number[]; percentual: number | null; valor: number | null }
  pendencias: { tipo: string; moeda?: string; pagamento_id?: number }[]
  linhas: LinhaRel[]
  csv: string
}
type Versao = { versao: number; dados: Relatorio; enviado_em: string | null; reaberto_em: string | null; motivo_reabertura: string | null; csv_sha256: string; criado_em: string }

// Pendências que o banco recusa ao fechar (fechar_ciclo): sem câmbio ou item sem plano.
export const bloqueia = (r: Relatorio) => r.pendencias.some((p) => p.tipo === "cambio_ausente" || p.tipo === "item_sem_plano")

function baixar(nome: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
  const a = document.createElement("a")
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}

function Linhas({ linhas, extra }: { linhas: LinhaRel[]; extra?: (l: LinhaRel) => ReactNode }) {
  const t = useT()
  const lang = useIdioma()
  if (linhas.length === 0) return <p className="text-sm opacity-75">{t("admin.rel.semLinhas")}</p>
  return (
    <Tabela
      legenda={t("admin.rel.linhas")} linhas={linhas} id={(l) => `${l.fonte}-${l.ref_id}`}
      colunas={[
        { chave: "data", titulo: t("admin.rel.data"), celula: (l) => dataCurta(l.data) },
        { chave: "origem", titulo: t("admin.rel.origem"), celula: (l) => `${l.fonte} · ${l.conta_ou_origem}` },
        { chave: "cliente", titulo: t("admin.rel.cliente"), celula: (l) => l.cliente ?? "—" },
        { chave: "valor", titulo: t("admin.rel.valor"), celula: (l) => moeda(l.bruto, lang, l.moeda) },
        { chave: "taxa", titulo: t("admin.rel.taxa"), celula: (l) => l.taxa ?? "—" },
        { chave: "eur", titulo: t("admin.rel.valorEur"), celula: (l) => moeda(l.bruto_eur, lang) },
        { chave: "vat", titulo: t("admin.rel.vatEur"), celula: (l) => moeda(l.vat_eur, lang) },
        ...(extra ? [{ chave: "extra", titulo: t("admin.comum.acoes"), celula: extra }] : []),
      ]}
    />
  )
}

function Numero({ rotulo, valor, forte }: { rotulo: Chave; valor: ReactNode; forte?: boolean }) {
  const t = useT()
  return (
    <div className={`flex items-baseline justify-between gap-4 border-b border-current/10 py-2 ${forte ? "text-lg font-semibold" : ""}`}>
      <dt>{t(rotulo)}</dt>
      <dd className="tabular-nums">{valor}</dd>
    </div>
  )
}
function Como({ children }: { children: ReactNode }) {
  const t = useT()
  return (
    <details className="mt-3">
      <summary className="min-h-11 cursor-pointer py-2 text-sm underline">{t("admin.rel.como")}</summary>
      <div className="mt-2">{children}</div>
    </details>
  )
}

function Anular({ id, aoFeito }: { id: number; aoFeito: () => void }) {
  const t = useT()
  const [motivo, setMotivo] = useState("")
  const acao = useAcao()
  return (
    <details>
      <summary className="cursor-pointer underline">{t("admin.rel.anular")}</summary>
      <div className="mt-2 w-64 space-y-2">
        <AreaTexto rotulo={t("admin.rel.motivoAnulacao")} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        <AvisoDe aviso={acao.aviso} />
        <button type="button" className={classeAcao} disabled={acao.ocupado || motivo.trim() === ""} onClick={() => void acao.rodar(async () => { exigirLinha(await supabase.from("receitas_externas").update({ motivo_anulacao: motivo.trim() }).eq("id", id).select("id")); aoFeito() }, "admin.rel.anulada")}>{t("admin.rel.anular")}</button>
      </div>
    </details>
  )
}

const ORIGENS = ["ingresso", "pix", "transferencia", "evento", "outro"] as const
const TIPOS = ["assinatura", "curso", "produto_digital", "ingresso"] as const

function LancarReceita({ aoFeito }: { aoFeito: () => void }) {
  const t = useT()
  const [arquivo, setArquivo] = useState<File | null>(null)
  const campos: CampoDef[] = [
    { chave: "recebido_em", rotulo: "admin.rel.recebidoEm", tipo: "data", obrigatorio: true },
    { chave: "origem", rotulo: "admin.rel.origem", tipo: "selecao", obrigatorio: true, opcoes: ORIGENS.map((o) => ({ valor: o, texto: t(`admin.rel.origem.${o}`) })) },
    { chave: "tipo_receita", rotulo: "admin.comum.tipo", tipo: "selecao", obrigatorio: true, opcoes: TIPOS.map((o) => ({ valor: o, texto: t(`admin.rel.tipoReceita.${o}`) })) },
    { chave: "cliente_nome", rotulo: "admin.rel.cliente", tipo: "texto", obrigatorio: true },
    { chave: "cliente_email", rotulo: "admin.comum.email", tipo: "email" },
    { chave: "moeda", rotulo: "admin.rel.moeda", tipo: "texto", obrigatorio: true },
    { chave: "bruto", rotulo: "admin.rel.bruto", tipo: "texto", obrigatorio: true, ajuda: "admin.rel.valorAjuda" },
    { chave: "vat", rotulo: "admin.rel.vat", tipo: "texto", ajuda: "admin.rel.valorAjuda" },
    { chave: "descricao", rotulo: "admin.comum.descricao", tipo: "texto" },
  ]
  return (
    <div className="space-y-4 rounded-2xl border border-current/15 p-5">
      <label className="block text-sm font-semibold">
        {t("admin.rel.comprovante")} *
        <input type="file" accept="application/pdf,image/png,image/jpeg" className="mt-2 block w-full text-sm" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
      </label>
      <FormularioRegistro
        campos={campos} linha={{ moeda: "EUR", origem: "pix", tipo_receita: "assinatura" }} salvar="admin.rel.lancar"
        aoSalvar={async (c) => {
          if (!arquivo) throw new Error("comprovante_obrigatorio")
          const bruto = decimalParaCentavos(String(c.bruto))
          const vat = c.vat ? decimalParaCentavos(String(c.vat)) : 0
          if (bruto === null || bruto <= 0 || vat === null) throw new Error("valor_invalido")
          const caminho = await enviarArquivo("comprovantes", String(c.recebido_em).slice(0, 4), arquivo)
          exigirLinha(await supabase.from("receitas_externas").insert({
            recebido_em: String(c.recebido_em), origem: c.origem as (typeof ORIGENS)[number], tipo_receita: c.tipo_receita as (typeof TIPOS)[number],
            cliente_nome: String(c.cliente_nome), cliente_email: (c.cliente_email as string | null) ?? null, moeda: String(c.moeda).toUpperCase(),
            bruto_centavos: bruto, vat_centavos: vat, comprovante_path: caminho, descricao: (c.descricao as string | null) ?? null,
          }).select("id"))
          aoFeito()
        }}
      />
    </div>
  )
}

function Cambio({ aoFeito }: { aoFeito: () => void }) {
  const campos: CampoDef[] = [
    { chave: "data", rotulo: "admin.rel.dataTaxa", tipo: "data", obrigatorio: true },
    { chave: "moeda", rotulo: "admin.rel.moeda", tipo: "texto", obrigatorio: true, ajuda: "admin.rel.moedaAjuda" },
    { chave: "taxa", rotulo: "admin.rel.taxaBce", tipo: "numero", obrigatorio: true, ajuda: "admin.rel.taxaAjuda" },
    { chave: "fonte_url", rotulo: "admin.rel.fonte", tipo: "url", obrigatorio: true },
  ]
  return (
    <FormularioRegistro
      campos={campos} linha={null} salvar="admin.rel.cadastrarCambio"
      aoSalvar={async (c) => {
        const linha = { data: String(c.data), moeda: String(c.moeda).toUpperCase(), taxa: Number(c.taxa), fonte_url: String(c.fonte_url) }
        const r = await supabase.from("cambio_bce").insert(linha).select("data")
        if ((r.error as { code?: string } | null)?.code === "23505") {
          exigirLinha(await supabase.from("cambio_bce").update({ taxa: linha.taxa, fonte_url: linha.fonte_url }).eq("data", linha.data).eq("moeda", linha.moeda).select("data"))
        } else exigirLinha(r)
        aoFeito()
      }}
    />
  )
}

export function Corpo({ rel, versao, super_, financeiro, aoMudar, hoje }: { rel: Relatorio; versao: Versao | null; super_: boolean; financeiro: boolean; aoMudar: () => void; hoje: string }) {
  const t = useT()
  const lang = useIdioma()
  const acao = useAcao()
  const [fechar, setFechar] = useState(false)
  const [motivo, setMotivo] = useState("")
  const fechado = rel.ciclo.estado === "fechado"
  const m = (c: number) => moeda(c, lang)
  const terminou = hoje > cicloFim(rel.ciclo.inicio)
  const nome = `relatorio-ciclo-${rel.ciclo.inicio}${versao ? `-v${versao.versao}` : "-rascunho"}.csv`
  const ext = rel.linhas.filter((l) => l.fonte === "externa")
  const estornos = rel.linhas.filter((l) => l.fonte.startsWith("estorno"))
  const editar = super_ && !fechado
  const pendTexto = (p: Relatorio["pendencias"][number]) => (p.tipo === "cambio_ausente" ? `${t("admin.rel.pend.cambio_ausente")}: ${p.moeda}` : p.tipo === "item_sem_plano" ? `${t("admin.rel.pend.item_sem_plano")} #${p.pagamento_id}` : t("admin.rel.pend.faixa_percentuais_indefinidos"))

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Selo tom={fechado ? "destaque" : "neutro"}>{t(fechado ? "admin.rel.fechado" : "admin.rel.rascunho")}</Selo>
        {fechado && versao ? <span className="text-sm">v{versao.versao} · SHA-256 <code className="break-all">{versao.csv_sha256}</code></span> : null}
        {versao?.enviado_em ? <Selo tom="destaque">{t("admin.rel.enviado")} {dataCurta(versao.enviado_em)}</Selo> : null}
      </div>
      {!fechado ? <p className="text-sm opacity-75">{t("admin.rel.previa")}</p> : null}
      {rel.pendencias.length > 0 ? (
        <Aviso tipo="erro">
          {t("admin.rel.pendencias")}: {rel.pendencias.map(pendTexto).join(" · ")}
        </Aviso>
      ) : null}

      <Secao titulo="admin.rel.s1">
        <dl>
          <Numero rotulo="admin.rel.stripe" valor={m(rel.receita.stripe)} />
          <Numero rotulo="admin.rel.foraStripe" valor={m(rel.receita.externa)} />
          <Numero rotulo="admin.rel.receitaBruta" valor={m(rel.receita.bruta)} forte />
        </dl>
        <Como><Linhas linhas={rel.linhas.filter((l) => l.fonte === "stripe" || l.fonte === "externa")} extra={editar ? (l) => (l.fonte === "externa" ? <Anular id={l.ref_id} aoFeito={aoMudar} /> : "—") : undefined} /></Como>
        {ext.length > 0 && financeiro ? (
          <Como>
            <ul className="space-y-1 text-sm">
              {ext.map((l) => (
                <li key={l.ref_id}>
                  {l.cliente} — {l.referencia ? <button type="button" className="underline" onClick={() => void acao.rodar(() => abrirAssinado("comprovantes", l.referencia!))}>{t("admin.rel.verComprovante")}</button> : "—"}
                </li>
              ))}
            </ul>
          </Como>
        ) : null}
        <AvisoDe aviso={acao.aviso} />
        {editar ? <div className="mt-4 max-md:hidden"><h3 className="mb-3 font-semibold">{t("admin.rel.lancarTitulo")}</h3><LancarReceita aoFeito={aoMudar} /></div> : null}
      </Secao>

      <Secao titulo="admin.rel.s2">
        <dl>
          <Numero rotulo="admin.rel.vatRecolhido" valor={m(rel.deducoes.vat)} />
          <Numero rotulo="admin.rel.estornos" valor={m(rel.deducoes.estornos - rel.deducoes.estornos_vat)} />
          <Numero rotulo="admin.rel.deducoesTotal" valor={m(rel.deducoes.total)} forte />
        </dl>
        <Como><Linhas linhas={estornos} /></Como>
      </Secao>

      <Secao titulo="admin.rel.s3">
        <p>{t("admin.rel.taxaEm")} {dataCurta(rel.cambio.data_referencia)}</p>
        {rel.cambio.taxas.length === 0 ? (
          <p className="mt-2 text-sm opacity-75">{t("admin.rel.soEur")}</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {rel.cambio.taxas.map((x) => (
              <li key={x.moeda}>
                1 EUR = <strong>{x.taxa ?? "—"}</strong> {x.moeda} {x.data ? `(${dataCurta(x.data)})` : ""}{" "}
                {x.fonte_url ? <a className="underline" href={x.fonte_url} target="_blank" rel="noopener noreferrer">{t("admin.rel.fonte")}</a> : null}
              </li>
            ))}
          </ul>
        )}
        {editar ? <div className="mt-4 max-md:hidden"><h3 className="mb-3 font-semibold">{t("admin.rel.cadastrarCambio")}</h3><Cambio aoFeito={aoMudar} /></div> : null}
      </Secao>

      <Secao titulo="admin.rel.s4">
        <dl><Numero rotulo="admin.rel.receitaBase" valor={m(rel.receita_base)} forte /></dl>
      </Secao>

      <Secao titulo="admin.rel.s5">
        <dl><Numero rotulo="admin.rel.clientesAtivos" valor={rel.clientes_ativos.quantidade} forte /></dl>
        <Como>
          {rel.clientes_ativos.lista.length === 0 ? <p className="text-sm">{t("admin.rel.semLinhas")}</p> : (
            <ul className="text-sm">{rel.clientes_ativos.lista.map((c) => <li key={c.chave}>{c.chave} · {c.origem}</li>)}</ul>
          )}
        </Como>
      </Secao>

      <Secao titulo="admin.rel.s6">
        <dl>
          <Numero rotulo="admin.rel.iaAvulsa" valor={m(rel.ia.avulsa)} />
          <Numero rotulo="admin.rel.iaRateio" valor={m(rel.ia.rateio)} />
          <Numero rotulo="admin.rel.iaTotal" valor={m(rel.ia.total)} forte />
        </dl>
        <Como>
          <ul className="text-sm">
            {rel.ia.por_nivel.map((n) => (
              <li key={n.nivel}>{t(`nivel.${n.nivel as "clube"}`)}: {n.horas_ia} h / {n.horas_total} h · {m(n.receita_liquida)} → {m(n.rateio)}</li>
            ))}
          </ul>
        </Como>
      </Secao>

      <Secao titulo="admin.rel.s7">
        <dl>
          <Numero rotulo="admin.rel.faixa" valor={`${rel.faixa.faixa} / 3 (${rel.faixa.limites.join(" · ")})`} />
          <Numero rotulo="admin.rel.percentual" valor={rel.faixa.percentual === null ? t("admin.rel.aDefinir") : `${rel.faixa.percentual}%`} />
          <Numero rotulo="admin.rel.valores" valor={rel.faixa.valor === null ? t("admin.rel.aDefinir") : m(rel.faixa.valor)} />
        </dl>
      </Secao>

      <AvisoDe aviso={acao.aviso} />
      <div className="flex flex-wrap gap-3">
        <Botao type="button" variante="contorno" className="sm:w-auto" onClick={() => baixar(nome, rel.csv)}>{t("admin.rel.baixarCsv")}</Botao>
        {super_ && !fechado ? <Botao type="button" ocupado={acao.ocupado} disabled={!terminou || bloqueia(rel)} onClick={() => setFechar(true)} className="max-md:hidden sm:w-auto">{t("admin.rel.fechar")}</Botao> : null}
        {super_ && fechado && versao && !versao.enviado_em ? (
          <Botao type="button" variante="contorno" ocupado={acao.ocupado} className="max-md:hidden sm:w-auto" onClick={() => void acao.rodar(async () => { exigirSemDados(await supabase.rpc("marcar_relatorio_enviado", { ciclo_inicio: rel.ciclo.inicio, versao: versao.versao })); aoMudar() }, "admin.rel.marcadoEnviado")}>{t("admin.rel.marcarEnviado")}</Botao>
        ) : null}
      </div>
      {super_ && !fechado && (!terminou || bloqueia(rel)) ? <p className="text-sm opacity-75">{!terminou ? t("admin.rel.cicloEmAndamento") : t("admin.rel.fecharBloqueado")}</p> : null}
      <p className="text-sm opacity-75 md:hidden">{t("admin.rel.soLeituraCelular")}</p>
      {super_ && fechado ? (
        <div className="max-w-xl space-y-3 max-md:hidden">
          <h3 className="font-semibold">{t("admin.rel.reabrirTitulo")}</h3>
          <AreaTexto rotulo={t("admin.rel.motivoReabertura")} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <Botao type="button" variante="contorno" disabled={acao.ocupado || motivo.trim().length < 5} className="sm:w-auto" onClick={() => void acao.rodar(async () => { exigirSemDados(await supabase.rpc("reabrir_ciclo", { ciclo_inicio: rel.ciclo.inicio, motivo: motivo.trim() })); setMotivo(""); aoMudar() }, "admin.rel.reaberto")}>{t("admin.rel.reabrir")}</Botao>
        </div>
      ) : null}
      <DialogoConfirmar
        aberto={fechar} titulo={t("admin.rel.fecharTitulo")} texto={t("admin.rel.fecharTexto")} confirmar={t("admin.rel.fechar")}
        aoCancelar={() => setFechar(false)}
        aoConfirmar={() => { setFechar(false); void acao.rodar(async () => { exigirSemDados(await supabase.rpc("fechar_ciclo", { ciclo_inicio: rel.ciclo.inicio })); aoMudar() }, "admin.rel.fechou") }}
      />
    </div>
  )
}

// Relatório do Ciclo (ADM-07, PRD §17.5.6). Ciclo fechado mostra a versão congelada de `relatorios_ciclo`; senão, a prévia calculada
// pelo banco (relatorio_ciclo). A tela nunca recalcula: só exibe os números do banco.
export function RelatorioCiclo() {
  const t = useT()
  const financeiro = usePode(FINANCEIRO)
  const super_ = usePode(SUPER)
  const hoje = hojeEmDublin()
  const [ciclo, setCiclo] = useState(cicloDe(hoje))
  const opcoes: string[] = [cicloDe(hoje)]
  for (let i = 0; i < 11; i++) opcoes.push(cicloAnterior(opcoes[opcoes.length - 1]))
  const carga = useCarga(async () => {
    if (!financeiro) return null
    const versoes = exigir(await supabase.from("relatorios_ciclo").select("versao, dados, enviado_em, reaberto_em, motivo_reabertura, csv_sha256, criado_em").eq("ciclo_inicio", ciclo).order("versao", { ascending: false })) as unknown as Versao[]
    const ultima = versoes[0] ?? null
    if (ultima && !ultima.reaberto_em) return { rel: ultima.dados, versao: ultima }
    const rel = exigir(await supabase.rpc("relatorio_ciclo", { ciclo_inicio: ciclo })) as unknown as Relatorio
    return { rel, versao: ultima }
  }, [ciclo, financeiro])
  if (!financeiro) return <Pagina titulo="admin.relatorioCiclo.titulo"><SemPermissao /></Pagina>
  return (
    <Pagina titulo="admin.relatorioCiclo.titulo" intro="admin.rel.intro">
      <div className="max-w-md">
        <Selecao rotulo={t("admin.rel.ciclo")} value={ciclo} onChange={(e) => setCiclo(e.target.value)}>
          {opcoes.map((o) => <option key={o} value={o}>{dataCurta(o)} → {dataCurta(cicloFim(o))}</option>)}
        </Selecao>
      </div>
      <Mostrar carga={carga}>
        {(d) => (d ? <Corpo key={`${ciclo}-${d.versao?.versao ?? 0}-${d.rel.ciclo.estado}`} rel={d.rel} versao={d.versao} super_={super_} financeiro={financeiro} aoMudar={carga.recarregar} hoje={hoje} /> : <Vazio>{t("admin.vazio.nada")}</Vazio>)}
      </Mostrar>
    </Pagina>
  )
}
