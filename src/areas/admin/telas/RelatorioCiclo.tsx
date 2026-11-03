import { useState, type ReactNode } from "react"
import { Botao } from "../../../componentes/Botao"
import { focoApp } from "../../../componentes/menuApp"
import { Campo, Selecao } from "../../../componentes/Campo"
import { DialogoConfirmar } from "../../../componentes/DialogoConfirmar"
import { Aviso } from "../../../componentes/Aviso"
import { Selo } from "../../../componentes/Selo"
import { Tabela } from "../../../componentes/Tabela"
import { Vazio } from "../../../componentes/Vazio"
import { useIdioma, useT, type Chave } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { AreaTexto } from "../componentes/Campos"
import { AvisoDe, Mostrar, Pagina, Secao, SemPermissao } from "../componentes/Pagina"
import { Anular, Cambio, ConcederAcesso, LancarEstorno, LancarReceita } from "../componentes/ReceitaForms"
import { exigir, exigirSemDados, abrirAssinado, useAcao, useCarga } from "../lib/consulta"
import { cicloDe, cicloFim, dataCurta, dataHora, hojeEmDublin, moeda } from "../lib/formato"
import { FINANCEIRO, SUPER, usePode } from "../lib/papel"
import { bloqueia } from "../lib/regras"
import type { LinhaRel, Plano, Receita, Relatorio, Versao } from "../lib/relatorio"
import { classeAcao, classeLink, caixaSutilAdmin, celulaNumeroAdmin } from "../lib/estilo"

function baixar(nome: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
  const a = document.createElement("a")
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}

function Linhas({ linhas, extra, liquido }: { linhas: LinhaRel[]; extra?: (l: LinhaRel) => ReactNode; liquido?: boolean }) {
  const t = useT()
  const lang = useIdioma()
  if (linhas.length === 0) return <p className="text-corpo-p text-cinza">{t("admin.rel.semLinhas")}</p>
  return (
    <Tabela
      legenda={t("admin.rel.linhas")} linhas={linhas} id={(l) => `${l.fonte}-${l.ref_id}`}
      colunas={[
        { chave: "data", titulo: t("admin.rel.data"), celula: (l) => dataCurta(l.data) },
        { chave: "origem", titulo: t("admin.rel.origem"), celula: (l) => `${l.fonte} · ${l.conta_ou_origem}` },
        { chave: "cliente", titulo: t("admin.rel.cliente"), celula: (l) => l.cliente ?? "—" },
        { chave: "valor", titulo: t("admin.rel.valor"), celula: (l) => moeda(l.bruto, lang, l.moeda) },
        { chave: "taxa", titulo: t("admin.rel.taxa"), celula: (l) => l.taxa ?? "—" },
        ...(liquido
          ? [{ chave: "eur", titulo: t("admin.rel.valorEurLiquido"), celula: (l: LinhaRel) => moeda(l.bruto_eur === null ? null : l.bruto_eur - (l.vat_eur ?? 0), lang) }]
          : [
              { chave: "eur", titulo: t("admin.rel.valorEur"), celula: (l: LinhaRel) => moeda(l.bruto_eur, lang) },
              { chave: "vat", titulo: t("admin.rel.vatEur"), celula: (l: LinhaRel) => moeda(l.vat_eur, lang) },
            ]),
        ...(extra ? [{ chave: "extra", titulo: t("admin.comum.acoes"), celula: extra }] : []),
      ]}
    />
  )
}

// Molde Intercom 0d71c83b: células de número lado a lado (rótulo 14 em cinza, número 24/600 tabular; o total, `forte`, em 32).
// Colunas automáticas de no mínimo 13rem: "€ 12.345,67" em 32px não cabe em 1/3 de 640px.
function Numero({ rotulo, valor, forte }: { rotulo: Chave; valor: ReactNode; forte?: boolean }) {
  const t = useT()
  return (
    <div className={`min-w-0 ${celulaNumeroAdmin}`}>
      <dt className="text-corpo-p font-semibold text-cinza">{t(rotulo)}</dt>
      <dd className={`mt-1 font-semibold break-words tabular-nums ${forte ? "text-titulo" : "text-titulo-p"}`}>{valor}</dd>
    </div>
  )
}
// "Como foi calculado": detalhe em cinza abaixo das células.
function Como({ children }: { children: ReactNode }) {
  const t = useT()
  return (
    <details className="mt-3">
      <summary className={`min-h-10 cursor-pointer rounded-sm py-2 text-corpo-p font-semibold text-cinza pointer-coarse:min-h-11 hover:text-creme ${focoApp}`}>{t("admin.rel.como")}</summary>
      <div className="mt-2 text-corpo-p text-cinza">{children}</div>
    </details>
  )
}

function ClassificarItem({ itemId, planos, aoFeito }: { itemId: number; planos: Plano[]; aoFeito: () => void }) {
  const t = useT()
  const [plano, setPlano] = useState("")
  const acao = useAcao()
  return (
    <li className="space-y-2">
      <Selecao rotulo={`${t("admin.rel.classificar")} #${itemId}`} value={plano} onChange={(e) => setPlano(e.target.value)}>
        <option value="">—</option>
        {planos.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
      </Selecao>
      <AvisoDe aviso={acao.aviso} />
      <button type="button" className={classeAcao} disabled={acao.ocupado || plano === ""} onClick={() => void acao.rodar(async () => { exigirSemDados(await supabase.rpc("classificar_item_pagamento", { item: itemId, plano: Number(plano) })); aoFeito() }, "admin.rel.classificado")}>{t("admin.rel.classificarBotao")}</button>
    </li>
  )
}

export function Corpo({ rel, versao, versoes, super_, financeiro, aoMudar, hoje, planos, receitas }: { rel: Relatorio; versao: Versao | null; versoes: Versao[]; super_: boolean; financeiro: boolean; aoMudar: () => void; hoje: string; planos: Plano[]; receitas: Receita[] }) {
  const t = useT()
  const lang = useIdioma()
  const acao = useAcao()
  const [fechar, setFechar] = useState(false)
  const [motivo, setMotivo] = useState("")
  const fechado = rel.ciclo.estado === "fechado"
  const m = (c: number) => moeda(c, lang)
  const terminou = hoje > cicloFim(rel.ciclo.inicio)
  const nome = `relatorio-ciclo-${rel.ciclo.inicio}${fechado && versao ? `-v${versao.versao}` : "-rascunho"}.csv`
  const ext = rel.linhas.filter((l) => l.fonte === "externa")
  const estornos = rel.linhas.filter((l) => l.fonte.startsWith("estorno"))
  const editar = super_ && !fechado
  const bloqueante = (p: Relatorio["pendencias"][number]) => p.tipo !== "faixa_percentuais_indefinidos"
  const pendTexto = (p: Relatorio["pendencias"][number]) => (p.tipo === "cambio_ausente" ? `${t("admin.rel.pend.cambio_ausente")}: ${p.moeda}` : p.tipo === "item_sem_plano" ? `${t("admin.rel.pend.item_sem_plano")} #${p.pagamento_id}` : t("admin.rel.pend.faixa_percentuais_indefinidos"))

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Selo tom={fechado ? "destaque" : "neutro"}>{t(fechado ? "admin.rel.fechado" : "admin.rel.rascunho")}</Selo>
        {fechado && versao ? <span className="text-corpo-p text-cinza">v{versao.versao} · SHA-256 <code className="break-all">{versao.csv_sha256}</code></span> : null}
        {fechado && versao?.enviado_em ? <Selo tom="destaque">{t("admin.rel.enviado")} {dataCurta(versao.enviado_em)}</Selo> : null}
      </div>
      {!fechado ? <p className="text-corpo-p text-cinza">{t("admin.rel.previa")}</p> : null}
      {rel.pendencias.some(bloqueante) ? (
        <Aviso tipo="erro">
          {t("admin.rel.pendencias")}: {rel.pendencias.filter(bloqueante).map(pendTexto).join(" · ")}
        </Aviso>
      ) : null}
      {rel.pendencias.some((p) => p.tipo === "faixa_percentuais_indefinidos") ? <p className={`text-corpo ${caixaSutilAdmin}`}>{t("admin.rel.avisoFaixa")}</p> : null}
      {super_ && !fechado && rel.pendencias.some((x) => x.tipo === "item_sem_plano" && x.item_id) ? (
        <ul className="max-w-md space-y-4 max-md:hidden">
          {rel.pendencias.filter((x) => x.tipo === "item_sem_plano" && x.item_id).map((x) => <ClassificarItem key={x.item_id} itemId={x.item_id!} planos={planos} aoFeito={aoMudar} />)}
        </ul>
      ) : null}

      <Secao titulo="admin.rel.s1">
        <dl className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))]">
          <Numero rotulo="admin.rel.stripe" valor={m(rel.receita.stripe)} />
          <Numero rotulo="admin.rel.foraStripe" valor={m(rel.receita.externa)} />
          <Numero rotulo="admin.rel.receitaBruta" valor={m(rel.receita.bruta)} forte />
        </dl>
        <Como><Linhas linhas={rel.linhas.filter((l) => l.fonte === "stripe" || l.fonte === "externa")} extra={editar ? (l) => (l.fonte === "externa" ? <Anular id={l.ref_id} cliente={l.cliente} aoFeito={aoMudar} /> : "—") : undefined} /></Como>
        {ext.length > 0 && financeiro ? (
          <Como>
            <ul className="space-y-1 text-corpo-p">
              {ext.map((l) => (
                <li key={l.ref_id}>
                  {l.cliente} — {l.referencia ? <button type="button" className={classeLink} onClick={() => void acao.rodar(() => abrirAssinado("comprovantes", l.referencia!))}>{t("admin.rel.verComprovante")}</button> : "—"}
                </li>
              ))}
            </ul>
          </Como>
        ) : null}
        <AvisoDe aviso={acao.aviso} />
        {editar ? <div className="mt-4 max-md:hidden"><h3 className="mb-3 text-corpo font-semibold">{t("admin.rel.lancarTitulo")}</h3><LancarReceita ciclo={{ inicio: rel.ciclo.inicio, fim: cicloFim(rel.ciclo.inicio) }} planos={planos} aoFeito={aoMudar} /></div> : null}
      </Secao>

      <Secao titulo="admin.rel.s2">
        <dl className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))]">
          <Numero rotulo="admin.rel.vatRecolhido" valor={m(rel.deducoes.vat)} />
          <Numero rotulo="admin.rel.estornos" valor={m(rel.deducoes.estornos - rel.deducoes.estornos_vat)} />
          <Numero rotulo="admin.rel.deducoesTotal" valor={m(rel.deducoes.total)} forte />
        </dl>
        <Como><Linhas linhas={estornos} liquido /></Como>
        {editar ? <div className="mt-4 max-md:hidden"><h3 className="mb-3 text-corpo font-semibold">{t("admin.rel.estornoTitulo")}</h3><LancarEstorno receitas={receitas} aoFeito={aoMudar} /></div> : null}
      </Secao>

      <Secao titulo="admin.rel.s3">
        <p>{t("admin.rel.taxaEm")} {dataCurta(rel.cambio.data_referencia)}</p>
        {rel.cambio.taxas.length === 0 ? (
          <p className="mt-2 text-corpo-p text-cinza">{t("admin.rel.soEur")}</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {rel.cambio.taxas.map((x) => (
              <li key={x.moeda}>
                1 EUR = <strong>{x.taxa ?? "—"}</strong> {x.moeda} {x.data ? `(${dataCurta(x.data)})` : ""}{" "}
                {x.fonte_url ? <a className={classeLink} href={x.fonte_url} target="_blank" rel="noopener noreferrer">{t("admin.rel.fonte")}</a> : null}
              </li>
            ))}
          </ul>
        )}
        {editar ? <div className="mt-4 max-md:hidden"><h3 className="mb-3 text-corpo font-semibold">{t("admin.rel.cadastrarCambio")}</h3><Cambio aoFeito={aoMudar} /></div> : null}
      </Secao>

      <Secao titulo="admin.rel.s4">
        <dl className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))]"><Numero rotulo="admin.rel.receitaBase" valor={m(rel.receita_base)} forte /></dl>
      </Secao>

      <Secao titulo="admin.rel.s5">
        <dl className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))]"><Numero rotulo="admin.rel.clientesAtivos" valor={rel.clientes_ativos.quantidade} forte /></dl>
        <Como>
          {rel.clientes_ativos.lista.length === 0 ? <p className="text-corpo-p text-cinza">{t("admin.rel.semLinhas")}</p> : (
            <ul className="text-corpo-p">{rel.clientes_ativos.lista.map((c) => <li key={c.chave}>{c.chave} · {c.origem}</li>)}</ul>
          )}
        </Como>
      </Secao>

      <Secao titulo="admin.rel.s6">
        <dl className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))]">
          <Numero rotulo="admin.rel.iaAvulsa" valor={m(rel.ia.avulsa)} />
          <Numero rotulo="admin.rel.iaRateio" valor={m(rel.ia.rateio)} />
          <Numero rotulo="admin.rel.iaTotal" valor={m(rel.ia.total)} forte />
        </dl>
        <Como>
          <ul className="text-corpo-p">
            {rel.ia.por_nivel.map((n) => (
              <li key={n.nivel}>{t(`nivel.${n.nivel as "clube"}`)}: {n.horas_ia} h / {n.horas_total} h · {m(n.receita_liquida)} → {m(n.rateio)}</li>
            ))}
          </ul>
        </Como>
      </Secao>

      <Secao titulo="admin.rel.s7">
        <dl className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))]">
          <Numero rotulo="admin.rel.faixa" valor={`${rel.faixa.faixa} / 3 (${rel.faixa.limites.join(" · ")})`} />
          <Numero rotulo="admin.rel.percentual" valor={rel.faixa.percentual === null ? t("admin.rel.aDefinir") : `${rel.faixa.percentual}%`} />
          <Numero rotulo="admin.rel.valores" valor={rel.faixa.valor === null ? t("admin.rel.aDefinir") : m(rel.faixa.valor)} />
        </dl>
      </Secao>

      {versoes.length > 0 ? (
        <Secao titulo="admin.rel.versoes">
          <Tabela
            legenda={t("admin.rel.versoes")} linhas={versoes} id={(x) => x.versao}
            colunas={[
              { chave: "v", titulo: t("admin.rel.versao"), celula: (x) => `v${x.versao}` },
              { chave: "quando", titulo: t("admin.log.quando"), celula: (x) => dataHora(x.criado_em, lang) },
              { chave: "sit", titulo: t("admin.rel.versaoSituacao"), celula: (x) => (x.reaberto_em ? `${t("admin.rel.versaoReaberta")} ${dataHora(x.reaberto_em, lang)}` : x === versoes[0] ? t("admin.rel.versaoAtual") : "—") },
              { chave: "env", titulo: t("admin.rel.enviado"), celula: (x) => (x.enviado_em ? dataHora(x.enviado_em, lang) : "—") },
              { chave: "sha", titulo: "SHA-256", celula: (x) => <code className="text-corpo-p break-all">{x.csv_sha256}</code> },
              { chave: "csv", titulo: "CSV", celula: (x) => <button type="button" className={classeAcao} onClick={() => baixar(`relatorio-ciclo-${rel.ciclo.inicio}-v${x.versao}.csv`, x.dados.csv)}>{t("admin.rel.baixarVersao")}</button> },
            ]}
          />
        </Secao>
      ) : null}
      {super_ ? <div className="max-md:hidden"><Secao titulo="admin.rel.acessoTitulo"><ConcederAcesso receitas={receitas} planos={planos} aoFeito={aoMudar} /></Secao></div> : null}
      <AvisoDe aviso={acao.aviso} />
      <div className="flex flex-wrap gap-3">
        <Botao type="button" variante="secundario" className="sm:w-auto" onClick={() => baixar(nome, rel.csv)}>{t("admin.rel.baixarCsv")}</Botao>
        {super_ && !fechado ? <Botao type="button" ocupado={acao.ocupado} disabled={!terminou || bloqueia(rel)} onClick={() => setFechar(true)} className="max-md:hidden sm:w-auto">{t("admin.rel.fechar")}</Botao> : null}
        {super_ && fechado && versao && !versao.enviado_em ? (
          <Botao type="button" variante="secundario" ocupado={acao.ocupado} className="max-md:hidden sm:w-auto" onClick={() => void acao.rodar(async () => { exigirSemDados(await supabase.rpc("marcar_relatorio_enviado", { ciclo_inicio: rel.ciclo.inicio, versao: versao.versao })); aoMudar() }, "admin.rel.marcadoEnviado")}>{t("admin.rel.marcarEnviado")}</Botao>
        ) : null}
      </div>
      {super_ && !fechado && (!terminou || bloqueia(rel)) ? <p className="text-corpo-p text-cinza">{!terminou ? t("admin.rel.cicloEmAndamento") : t("admin.rel.fecharBloqueado")}</p> : null}
      <p className="text-corpo-p text-cinza md:hidden">{t("admin.rel.soLeituraCelular")}</p>
      {super_ && fechado ? (
        <div className="max-w-xl space-y-3 max-md:hidden">
          <h3 className="text-corpo font-semibold">{t("admin.rel.reabrirTitulo")}</h3>
          <AreaTexto rotulo={t("admin.rel.motivoReabertura")} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <Botao type="button" variante="secundario" disabled={acao.ocupado || motivo.trim().length < 5} className="sm:w-auto" onClick={() => void acao.rodar(async () => { exigirSemDados(await supabase.rpc("reabrir_ciclo", { ciclo_inicio: rel.ciclo.inicio, motivo: motivo.trim() })); setMotivo(""); aoMudar() }, "admin.rel.reaberto")}>{t("admin.rel.reabrir")}</Botao>
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
  const [mes, setMes] = useState(ciclo.slice(0, 7))
  const carga = useCarga(async () => {
    if (!financeiro) return null
    const planos = super_ ? exigir(await supabase.from("planos").select("id, nome").order("nome")) : []
    const receitas = super_ ? (exigir(await supabase.from("receitas_externas").select("id, cliente_nome, plano_id, perfil_id, moeda, bruto_centavos, recebido_em").is("anulado_em", null).order("recebido_em", { ascending: false }).limit(100)) as unknown as Receita[]) : []
    const versoes = exigir(await supabase.from("relatorios_ciclo").select("versao, dados, enviado_em, reaberto_em, motivo_reabertura, csv_sha256, criado_em").eq("ciclo_inicio", ciclo).order("versao", { ascending: false })) as unknown as Versao[]
    const ultima = versoes[0] ?? null
    if (ultima && !ultima.reaberto_em) return { rel: ultima.dados, versao: ultima, versoes, planos, receitas }
    const rel = exigir(await supabase.rpc("relatorio_ciclo", { ciclo_inicio: ciclo })) as unknown as Relatorio
    return { rel, versao: ultima, versoes, planos, receitas }
  }, [ciclo, financeiro, super_])
  if (!financeiro) return <Pagina titulo="admin.relatorioCiclo.titulo"><SemPermissao /></Pagina>
  return (
    <Pagina titulo="admin.relatorioCiclo.titulo" intro="admin.rel.intro">
      <div className="max-w-md">
        <Campo
          rotulo={t("admin.rel.mes")} type="month" value={mes} ajuda={`${t("admin.rel.mesAjuda")} ${dataCurta(ciclo)} → ${dataCurta(cicloFim(ciclo))}`}
          onChange={(e) => { setMes(e.target.value); if (/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)) setCiclo(`${e.target.value}-10`) }}
        />
      </div>
      <Mostrar carga={carga}>
        {(d) => (d ? <Corpo key={`${ciclo}-${d.versao?.versao ?? 0}-${d.rel.ciclo.estado}`} rel={d.rel} versao={d.versao} versoes={d.versoes} receitas={d.receitas} super_={super_} financeiro={financeiro} aoMudar={carga.recarregar} hoje={hoje} planos={d.planos} /> : <Vazio>{t("admin.vazio.nada")}</Vazio>)}
      </Mostrar>
    </Pagina>
  )
}
