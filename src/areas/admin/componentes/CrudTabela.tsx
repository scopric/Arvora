import { useState, type ReactNode } from "react"
import { DialogoConfirmar } from "../../../componentes/DialogoConfirmar"
import { Selo } from "../../../componentes/Selo"
import { Tabela, type Coluna } from "../../../componentes/Tabela"
import { Vazio } from "../../../componentes/Vazio"
import { useIdioma, useT, type Chave } from "../../../i18n"
import { exigirLinha, tabelaSolta, useAcao, useCarga } from "../lib/consulta"
import { dataHora } from "../lib/formato"
import { classeAcao } from "./Campos"
import { FormularioRegistro, type CampoDef } from "./FormularioRegistro"
import { AvisoDe, Mostrar } from "./Pagina"

type Linha = Record<string, unknown>

export type CrudProps = {
  tabela: string
  // colunas listadas à mão (nunca select *); inclua a chave primária e as colunas dos campos
  colunas: string
  campos: CampoDef[]
  ordem: { coluna: string; asc?: boolean }[]
  podeEditar: boolean
  chave?: string
  filtro?: { coluna: string; valor: string | number }
  // valores fixos do insert (ex.: edicao_id da página)
  fixos?: Record<string, unknown>
  podeApagar?: boolean
  // coluna extra por linha (ex.: link "Abrir")
  extra?: { titulo: Chave; celula: (l: Linha) => ReactNode }
  legenda: Chave
  vazio: Chave
  // chamado depois de gravar/apagar (ex.: recarregar a página-mãe)
  aoMudar?: () => void
}

function mostrar(c: CampoDef, l: Linha, lang: string, t: (c: Chave) => string): ReactNode {
  const x = l[c.chave]
  if (c.tipo === "checkbox") return x === true ? t("admin.comum.sim") : t("admin.comum.nao")
  if (c.tipo === "publicado") return x ? <Selo tom="destaque">{t("admin.comum.publicado")}</Selo> : <Selo>{t("admin.comum.rascunho")}</Selo>
  if (c.tipo === "dataHora") return dataHora(x as string | null, lang)
  if (c.tipo === "selecao") return c.opcoes?.find((o) => o.valor === String(x))?.texto ?? (x === null || x === undefined ? "—" : String(x))
  return x === null || x === undefined || x === "" ? "—" : String(x)
}

// Lista + formulário de um cadastro simples (tabela, campos). Escrita só com `podeEditar`; o banco barra o resto.
export function CrudTabela(p: CrudProps) {
  const t = useT()
  const lang = useIdioma()
  const chave = p.chave ?? "id"
  const [editando, setEditando] = useState<Linha | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [apagar, setApagar] = useState<Linha | null>(null)
  const acao = useAcao()
  const carga = useCarga(async () => {
    let q = tabelaSolta(p.tabela).select(p.colunas)
    if (p.filtro) q = q.eq(p.filtro.coluna, p.filtro.valor)
    for (const o of p.ordem) q = q.order(o.coluna, { ascending: o.asc !== false })
    const r = await q.limit(500)
    if (r.error) throw r.error
    return r.data ?? []
  }, [p.tabela, p.filtro?.coluna, p.filtro?.valor, p.colunas])

  function depois() {
    setEditando(null)
    setFormKey((k) => k + 1)
    carga.recarregar()
    p.aoMudar?.()
  }

  async function salvar(payload: Linha) {
    if (editando) {
      const r = await tabelaSolta(p.tabela).update(payload).eq(chave, editando[chave]).select(chave)
      exigirLinha(r)
    } else {
      const r = await tabelaSolta(p.tabela).insert({ ...p.fixos, ...payload }).select(chave)
      exigirLinha(r)
    }
    depois()
  }

  const colunasTabela: Coluna<Linha>[] = [
    ...p.campos.filter((c) => c.naTabela).map((c) => ({ chave: c.chave, titulo: t(c.rotulo), celula: (l: Linha) => mostrar(c, l, lang, t) })),
    ...(p.extra ? [{ chave: "extra", titulo: t(p.extra.titulo), celula: p.extra.celula }] : []),
    ...(p.podeEditar
      ? [{
          chave: "acoes",
          titulo: t("admin.comum.acoes"),
          celula: (l: Linha) => (
            <span className="flex gap-2">
              <button type="button" className={classeAcao} onClick={() => { setEditando(l); setFormKey((k) => k + 1) }}>{t("admin.comum.editar")}</button>
              {p.podeApagar ? <button type="button" className={classeAcao} onClick={() => setApagar(l)}>{t("admin.comum.apagar")}</button> : null}
            </span>
          ),
        }]
      : []),
  ]

  return (
    <div className="space-y-6">
      <Mostrar carga={carga}>
        {(linhas) =>
          linhas.length === 0 ? (
            <Vazio>{t(p.vazio)}</Vazio>
          ) : (
            <Tabela colunas={colunasTabela} linhas={linhas} id={(l) => String(l[chave])} legenda={t(p.legenda)} />
          )
        }
      </Mostrar>
      <AvisoDe aviso={acao.aviso} />
      {p.podeEditar ? (
        <div className="rounded-2xl border border-current/15 p-5">
          <h3 className="mb-4 text-lg font-semibold">{editando ? t("admin.comum.editando") : t("admin.comum.novo")}</h3>
          <FormularioRegistro key={formKey} campos={p.campos} linha={editando} aoSalvar={salvar} aoCancelar={editando ? () => { setEditando(null); setFormKey((k) => k + 1) } : undefined} />
        </div>
      ) : null}
      <DialogoConfirmar
        aberto={apagar !== null}
        perigo
        titulo={t("admin.comum.apagarTitulo")}
        texto={t("admin.comum.apagarTexto")}
        confirmar={t("admin.comum.apagar")}
        aoCancelar={() => setApagar(null)}
        aoConfirmar={() => {
          const alvo = apagar
          setApagar(null)
          if (!alvo) return
          void acao.rodar(async () => {
            exigirLinha(await tabelaSolta(p.tabela).delete().eq(chave, alvo[chave]).select(chave))
            depois()
          }, "admin.comum.apagado")
        }}
      />
    </div>
  )
}
