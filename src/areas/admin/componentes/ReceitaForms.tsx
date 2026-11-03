import { useRef, useState, type SubmitEvent } from "react"
import { Botao } from "../../../componentes/Botao"
import { Campo, Selecao } from "../../../componentes/Campo"
import { DialogoConfirmar } from "../../../componentes/DialogoConfirmar"
import { useIdioma, useT, type Chave } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { enviarArquivo, exigir, exigirLinha, exigirSemDados, useAcao } from "../lib/consulta"
import { decimalParaCentavos, localParaIso, moeda } from "../lib/formato"
import type { Plano, Receita } from "../lib/relatorio"
import { AreaTexto } from "./Campos"
import { AvisoDe } from "./Pagina"
import { cartaoAdmin, classeAcao } from "../lib/estilo"

const ORIGENS = ["ingresso", "pix", "transferencia", "evento", "outro"] as const
const TIPOS = ["assinatura", "curso", "produto_digital", "ingresso"] as const
const caixa = `space-y-4 ${cartaoAdmin}`
const grade = "grid gap-5 sm:grid-cols-2"

// Escolhe um membro pelo nome (a equipe não lê e-mail em `perfis`). `valor` é o id do perfil ou "".
export function SeletorMembro({ rotulo, valor, aoMudar }: { rotulo: Chave; valor: string; aoMudar: (id: string) => void }) {
  const t = useT()
  const [busca, setBusca] = useState("")
  const [achados, setAchados] = useState<{ id: string; nome: string }[]>([])
  const acao = useAcao()
  const procurar = () =>
    acao.rodar(async () => {
      const termo = busca.trim().replace(/[%,()]/g, " ")
      aoMudar("")
      if (termo.length < 2) return setAchados([])
      setAchados(exigir(await supabase.from("perfis").select("id, nome").ilike("nome", `%${termo}%`).order("nome").limit(10)))
    })
  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Campo rotulo={t("admin.rel.membroBuscar")} value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void procurar() } }} />
        </div>
        <Botao type="button" variante="secundario" ocupado={acao.ocupado} onClick={() => void procurar()} className="sm:w-auto">{t("admin.rel.membroProcurar")}</Botao>
      </div>
      <AvisoDe aviso={acao.aviso} />
      {achados.length > 0 ? (
        <Selecao rotulo={t(rotulo)} value={valor} onChange={(e) => aoMudar(e.target.value)}>
          <option value="">{t("admin.rel.membroEscolher")}</option>
          {achados.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </Selecao>
      ) : null}
    </div>
  )
}

// Receita fora do Stripe. Tudo é validado ANTES de subir o comprovante (não sobra arquivo órfão por erro de digitação).
export function LancarReceita({ ciclo, planos, aoFeito }: { ciclo: { inicio: string; fim: string }; planos: Plano[]; aoFeito: () => void }) {
  const t = useT()
  const vazio = { recebido_em: "", origem: "pix", tipo_receita: "assinatura", plano: "", membro: "", cliente_nome: "", cliente_email: "", moeda: "EUR", bruto: "", vat: "", descricao: "" }
  const [v, setV] = useState(vazio)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const ref = useRef<HTMLInputElement>(null)
  const acao = useAcao()
  const muda = (k: keyof typeof vazio) => (e: { target: { value: string } }) => setV((a) => ({ ...a, [k]: e.target.value }))

  const enviar = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    void acao.rodar(async () => {
      if (!v.recebido_em || !v.cliente_nome.trim() || !v.bruto.trim()) throw new Error("campo_obrigatorio")
      if (!v.plano) throw new Error("plano_obrigatorio")
      const codigo = v.moeda.trim().toUpperCase()
      if (!/^[A-Z]{3}$/.test(codigo)) throw new Error("moeda_invalida")
      const bruto = decimalParaCentavos(v.bruto)
      const vat = v.vat.trim() ? decimalParaCentavos(v.vat) : 0
      if (bruto === null || bruto <= 0 || vat === null) throw new Error("valor_invalido")
      if (vat > bruto) throw new Error("vat_maior_que_bruto")
      if (v.recebido_em < ciclo.inicio || v.recebido_em > ciclo.fim) throw new Error("data_fora_do_ciclo")
      if (!arquivo) throw new Error("comprovante_obrigatorio")
      const caminho = await enviarArquivo("comprovantes", v.recebido_em.slice(0, 4), arquivo)
      exigirLinha(await supabase.from("receitas_externas").insert({
        recebido_em: v.recebido_em, origem: v.origem as (typeof ORIGENS)[number], tipo_receita: v.tipo_receita as (typeof TIPOS)[number],
        plano_id: Number(v.plano), perfil_id: v.membro || null, cliente_nome: v.cliente_nome.trim(), cliente_email: v.cliente_email.trim() || null,
        moeda: codigo, bruto_centavos: bruto, vat_centavos: vat, comprovante_path: caminho, descricao: v.descricao.trim() || null,
      } as never).select("id"))
      setV(vazio)
      setArquivo(null)
      if (ref.current) ref.current.value = ""
      aoFeito()
    }, "admin.comum.salvo")
  }

  return (
    <form onSubmit={enviar} noValidate className={caixa}>
      <div className={grade}>
        <Campo rotulo={`${t("admin.rel.recebidoEm")} *`} type="date" value={v.recebido_em} min={ciclo.inicio} max={ciclo.fim} onChange={muda("recebido_em")} />
        <Selecao rotulo={`${t("admin.rel.origem")} *`} value={v.origem} onChange={muda("origem")}>
          {ORIGENS.map((o) => <option key={o} value={o}>{t(`admin.rel.origem.${o}`)}</option>)}
        </Selecao>
        <Selecao rotulo={`${t("admin.comum.tipo")} *`} value={v.tipo_receita} onChange={muda("tipo_receita")}>
          {TIPOS.map((o) => <option key={o} value={o}>{t(`admin.rel.tipoReceita.${o}`)}</option>)}
        </Selecao>
        <Selecao rotulo={`${t("admin.rel.plano")} *`} value={v.plano} onChange={muda("plano")}>
          <option value="">—</option>
          {planos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </Selecao>
        <Campo rotulo={`${t("admin.rel.cliente")} *`} value={v.cliente_nome} onChange={muda("cliente_nome")} />
        <Campo rotulo={t("admin.comum.email")} type="email" value={v.cliente_email} onChange={muda("cliente_email")} />
        <Campo rotulo={`${t("admin.rel.moeda")} *`} value={v.moeda} maxLength={3} onChange={muda("moeda")} />
        <Campo rotulo={`${t("admin.rel.bruto")} *`} value={v.bruto} ajuda={t("admin.rel.valorAjuda")} onChange={muda("bruto")} />
        <Campo rotulo={t("admin.rel.vat")} value={v.vat} ajuda={t("admin.rel.valorAjuda")} onChange={muda("vat")} />
        <Campo rotulo={t("admin.comum.descricao")} value={v.descricao} onChange={muda("descricao")} />
      </div>
      <SeletorMembro rotulo="admin.rel.membroOpcional" valor={v.membro} aoMudar={(id) => setV((a) => ({ ...a, membro: id }))} />
      <label className="block text-corpo-p font-semibold text-creme">
        {t("admin.rel.comprovante")} *
        <input ref={ref} type="file" accept="application/pdf,image/png,image/jpeg" className="mt-2 block w-full text-corpo-p text-cinza" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
      </label>
      <AvisoDe aviso={acao.aviso} />
      <Botao type="submit" variante="secundario" ocupado={acao.ocupado} className="sm:w-auto">{t("admin.rel.lancar")}</Botao>
    </form>
  )
}

const rotuloReceita = (r: Receita, lang: string) => `#${r.id} · ${r.cliente_nome} · ${moeda(r.bruto_centavos, lang, r.moeda)} · ${r.recebido_em.split("-").reverse().join("/")}`

// Estorno de receita externa (reembolsos). Estorno do Stripe chega pelo webhook.
export function LancarEstorno({ receitas, aoFeito }: { receitas: Receita[]; aoFeito: () => void }) {
  const t = useT()
  const lang = useIdioma()
  const vazio = { tipo: "reembolso", receita: "", valor: "", vat: "", devolvido_em: "" }
  const [v, setV] = useState(vazio)
  const acao = useAcao()
  const muda = (k: keyof typeof vazio) => (e: { target: { value: string } }) => setV((a) => ({ ...a, [k]: e.target.value }))
  const enviar = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    void acao.rodar(async () => {
      const r = receitas.find((x) => String(x.id) === v.receita)
      if (!r) throw new Error("receita_obrigatoria")
      if (!v.devolvido_em) throw new Error("campo_obrigatorio")
      const valor = decimalParaCentavos(v.valor)
      const vat = v.vat.trim() ? decimalParaCentavos(v.vat) : 0
      if (valor === null || valor <= 0 || vat === null) throw new Error("valor_invalido")
      if (vat > valor) throw new Error("vat_maior_que_bruto")
      if (valor > r.bruto_centavos) throw new Error("valor_maior_que_receita")
      exigirLinha(await supabase.from("reembolsos").insert({
        tipo: v.tipo as "reembolso", receita_externa_id: r.id, moeda: r.moeda, valor_centavos: valor, vat_centavos: vat, devolvido_em: localParaIso(`${v.devolvido_em}T12:00`),
      }).select("id"))
      setV(vazio)
      aoFeito()
    }, "admin.rel.estornoLancado")
  }
  return (
    <form onSubmit={enviar} noValidate className={caixa}>
      <p className="text-corpo text-cinza">{t("admin.rel.estornoIntro")}</p>
      <div className={grade}>
        <Selecao rotulo={`${t("admin.rel.estornoTipo")} *`} value={v.tipo} onChange={muda("tipo")}>
          <option value="reembolso">{t("admin.rel.estornoTipo.reembolso")}</option>
          <option value="chargeback">{t("admin.rel.estornoTipo.chargeback")}</option>
        </Selecao>
        <Selecao rotulo={`${t("admin.rel.estornoReceita")} *`} value={v.receita} onChange={muda("receita")}>
          <option value="">—</option>
          {receitas.map((r) => <option key={r.id} value={r.id}>{rotuloReceita(r, lang)}</option>)}
        </Selecao>
        <Campo rotulo={`${t("admin.rel.estornoValor")} *`} value={v.valor} ajuda={t("admin.rel.valorAjuda")} onChange={muda("valor")} />
        <Campo rotulo={t("admin.rel.estornoVat")} value={v.vat} ajuda={t("admin.rel.valorAjuda")} onChange={muda("vat")} />
        <Campo rotulo={`${t("admin.rel.devolvidoEm")} *`} type="date" value={v.devolvido_em} onChange={muda("devolvido_em")} />
      </div>
      <AvisoDe aviso={acao.aviso} />
      <Botao type="submit" variante="secundario" ocupado={acao.ocupado} className="sm:w-auto">{t("admin.rel.estornoLancar")}</Botao>
    </form>
  )
}

// conceder_acesso_manual(perfil, plano, receita, ate). O plano é o da receita (o banco exige igualdade).
export function ConcederAcesso({ receitas, planos, aoFeito }: { receitas: Receita[]; planos: Plano[]; aoFeito: () => void }) {
  const t = useT()
  const lang = useIdioma()
  const [membro, setMembro] = useState("")
  const [receita, setReceita] = useState("")
  const [ate, setAte] = useState("")
  const acao = useAcao()
  const comPlano = receitas.filter((r) => r.plano_id !== null)
  const enviar = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    void acao.rodar(async () => {
      if (!membro) throw new Error("membro_obrigatorio")
      const r = comPlano.find((x) => String(x.id) === receita)
      if (!r) throw new Error("receita_obrigatoria")
      if (!ate) throw new Error("campo_obrigatorio")
      exigirSemDados(await supabase.rpc("conceder_acesso_manual", { perfil: membro, plano: r.plano_id!, receita: r.id, ate: localParaIso(`${ate}T23:59`) }))
      setReceita("")
      setAte("")
      aoFeito()
    }, "admin.rel.acessoConcedido")
  }
  return (
    <form onSubmit={enviar} noValidate className={caixa}>
      <p className="text-corpo text-cinza">{t("admin.rel.acessoIntro")}</p>
      <SeletorMembro rotulo="admin.rel.membro" valor={membro} aoMudar={setMembro} />
      <div className={grade}>
        <Selecao rotulo={`${t("admin.rel.acessoReceita")} *`} value={receita} onChange={(e) => setReceita(e.target.value)}>
          <option value="">—</option>
          {comPlano.map((r) => <option key={r.id} value={r.id}>{rotuloReceita(r, lang)} · {planos.find((p) => p.id === r.plano_id)?.nome ?? ""}</option>)}
        </Selecao>
        <Campo rotulo={`${t("admin.rel.acessoAte")} *`} type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
      </div>
      <AvisoDe aviso={acao.aviso} />
      <Botao type="submit" variante="secundario" ocupado={acao.ocupado} className="sm:w-auto">{t("admin.rel.acessoConceder")}</Botao>
    </form>
  )
}

// Taxa do BCE. Se já existe taxa para a data e a moeda, mostra a atual e a nova e só troca depois de confirmar.
export function Cambio({ aoFeito }: { aoFeito: () => void }) {
  const t = useT()
  const vazio = { data: "", moeda: "", taxa: "", fonte_url: "" }
  const [v, setV] = useState(vazio)
  const [pendente, setPendente] = useState<{ linha: { data: string; moeda: string; taxa: number; fonte_url: string }; atual: number } | null>(null)
  const acao = useAcao()
  const confirma = useAcao()
  const muda = (k: keyof typeof vazio) => (e: { target: { value: string } }) => setV((a) => ({ ...a, [k]: e.target.value }))
  const enviar = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    void acao.rodar(async () => {
      const taxa = Number(v.taxa)
      if (!v.data || !v.moeda.trim() || !v.fonte_url.trim() || !(taxa > 0)) throw new Error("campo_obrigatorio")
      const linha = { data: v.data, moeda: v.moeda.trim().toUpperCase(), taxa, fonte_url: v.fonte_url.trim() }
      const atual = await supabase.from("cambio_bce").select("taxa").eq("data", linha.data).eq("moeda", linha.moeda).maybeSingle()
      if (atual.error) throw atual.error
      if (atual.data) {
        setPendente({ linha, atual: Number(atual.data.taxa) })
        throw new Error("cambio_existente")
      }
      exigirLinha(await supabase.from("cambio_bce").insert(linha).select("data"))
      setV(vazio)
      aoFeito()
    }, "admin.comum.salvo")
  }
  return (
    <>
      <form onSubmit={enviar} noValidate className="space-y-5">
        <div className={grade}>
          <Campo rotulo={`${t("admin.rel.dataTaxa")} *`} type="date" value={v.data} onChange={muda("data")} />
          <Campo rotulo={`${t("admin.rel.moeda")} *`} value={v.moeda} maxLength={3} ajuda={t("admin.rel.moedaAjuda")} onChange={muda("moeda")} />
          <Campo rotulo={`${t("admin.rel.taxaBce")} *`} type="number" step="any" value={v.taxa} ajuda={t("admin.rel.taxaAjuda")} onChange={muda("taxa")} />
          <Campo rotulo={`${t("admin.rel.fonte")} *`} type="url" value={v.fonte_url} onChange={muda("fonte_url")} />
        </div>
        <AvisoDe aviso={acao.aviso} />
        <AvisoDe aviso={confirma.aviso} />
        <Botao type="submit" variante="secundario" ocupado={acao.ocupado} className="sm:w-auto">{t("admin.rel.cadastrarCambio")}</Botao>
      </form>
      <DialogoConfirmar
        aberto={pendente !== null} titulo={t("admin.rel.cambioConfirmarTitulo")} confirmar={t("admin.rel.cambioTrocar")}
        texto={pendente ? `${pendente.linha.moeda} ${pendente.linha.data}: ${t("admin.rel.cambioAtual")} ${pendente.atual} → ${t("admin.rel.cambioNova")} ${pendente.linha.taxa}` : ""}
        aoCancelar={() => setPendente(null)}
        aoConfirmar={() => {
          const p = pendente
          setPendente(null)
          if (p) void confirma.rodar(async () => {
            exigirLinha(await supabase.from("cambio_bce").update({ taxa: p.linha.taxa, fonte_url: p.linha.fonte_url }).eq("data", p.linha.data).eq("moeda", p.linha.moeda).select("data"))
            setV(vazio)
            aoFeito()
          }, "admin.comum.salvo")
        }}
      />
    </>
  )
}

// Anulação de receita externa (motivo obrigatório). Some no celular (relatório é só leitura lá).
export function Anular({ id, cliente, aoFeito }: { id: number; cliente: string | null; aoFeito: () => void }) {
  const t = useT()
  const [motivo, setMotivo] = useState("")
  const acao = useAcao()
  return (
    <details className="max-md:hidden">
      <summary className="min-h-9 cursor-pointer py-2 text-corpo-p font-semibold text-cinza pointer-coarse:min-h-11" aria-label={`${t("admin.rel.anularDe")} ${cliente ?? `#${id}`}`}>{t("admin.rel.anular")}</summary>
      <div className="mt-2 w-64 space-y-2">
        <AreaTexto rotulo={t("admin.rel.motivoAnulacao")} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        <AvisoDe aviso={acao.aviso} />
        <button type="button" className={classeAcao} disabled={acao.ocupado || motivo.trim() === ""} onClick={() => void acao.rodar(async () => { exigirLinha(await supabase.from("receitas_externas").update({ motivo_anulacao: motivo.trim() }).eq("id", id).select("id")); aoFeito() }, "admin.rel.anulada")}>{t("admin.rel.anular")}</button>
      </div>
    </details>
  )
}
