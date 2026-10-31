import { useState, type SubmitEvent } from "react"
import { Botao } from "../../../componentes/Botao"
import { Campo, Selecao } from "../../../componentes/Campo"
import { useT, type Chave } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { enviarArquivo, useAcao } from "../lib/consulta"
import { isoParaLocal, localParaIso, slugificar } from "../lib/formato"
import { AvisoDe } from "./Pagina"
import { AreaTexto, Caixa } from "./Campos"

export type OpcaoSel = { valor: string; texto: string }
export type CampoDef = {
  chave: string
  rotulo: Chave
  tipo: "texto" | "email" | "url" | "numero" | "area" | "data" | "dataHora" | "checkbox" | "publicado" | "selecao" | "imagem"
  obrigatorio?: boolean
  opcoes?: OpcaoSel[]
  // selecao opcional: texto da opção em branco
  vazio?: Chave
  ajuda?: Chave
  // imagem: pasta dentro do bucket `imagens`
  pasta?: string
  // slug: se ficar em branco, sai do texto deste outro campo
  slugDe?: string
  naTabela?: boolean
}
export type Valores = Record<string, string | boolean>
type Linha = Record<string, unknown>

// Linha do banco → valores do formulário (tudo texto, menos as caixas). dataHora entra como hora de Dublin.
export function paraValores(campos: CampoDef[], linha: Linha | null): Valores {
  const v: Valores = {}
  for (const c of campos) {
    const x = linha?.[c.chave]
    if (c.tipo === "checkbox") v[c.chave] = x === true
    else if (c.tipo === "publicado") v[c.chave] = x !== null && x !== undefined
    else if (c.tipo === "dataHora") v[c.chave] = isoParaLocal(x as string | null)
    else v[c.chave] = x === null || x === undefined ? "" : String(x)
  }
  return v
}

// Valores do formulário → carga para o banco. Vazio vira null; "publicado" mantém a data antiga ou usa agora.
// Devolve `erros` por campo (obrigatório vazio, número inválido) e não monta carga se houver erro.
export function paraCarga(campos: CampoDef[], v: Valores, anterior: Linha | null): { carga: Linha; erros: Record<string, "obrigatorio" | "numero"> } {
  const carga: Linha = {}
  const erros: Record<string, "obrigatorio" | "numero"> = {}
  for (const c of campos) {
    const x = v[c.chave]
    if (c.tipo === "checkbox") carga[c.chave] = x === true
    else if (c.tipo === "publicado") carga[c.chave] = x === true ? ((anterior?.[c.chave] as string | null | undefined) ?? new Date().toISOString()) : null
    else {
      let texto = String(x ?? "").trim()
      if (texto === "" && c.slugDe) texto = slugificar(String(v[c.slugDe] ?? ""))
      if (texto === "") {
        if (c.obrigatorio) erros[c.chave] = "obrigatorio"
        carga[c.chave] = null
      } else if (c.tipo === "numero") {
        if (Number.isNaN(Number(texto))) erros[c.chave] = "numero"
        carga[c.chave] = Number(texto)
      } else if (c.tipo === "dataHora") carga[c.chave] = localParaIso(texto)
      else carga[c.chave] = texto
    }
  }
  return { carga, erros }
}

// Formulário genérico de um registro. `aoSalvar` faz a escrita (insert/update/RPC) e lança erro se falhar.
export function FormularioRegistro({
  campos, linha, aoSalvar, salvar, aoCancelar,
}: {
  campos: CampoDef[]
  linha: Linha | null
  aoSalvar: (carga: Linha) => Promise<void>
  salvar?: Chave
  aoCancelar?: () => void
}) {
  const t = useT()
  const [v, setV] = useState<Valores>(() => paraValores(campos, linha))
  const [erros, setErros] = useState<Record<string, string>>({})
  const acao = useAcao()
  const muda = (chave: string, valor: string | boolean) => setV((a) => ({ ...a, [chave]: valor }))

  async function enviar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const { carga, erros: faltas } = paraCarga(campos, v, linha)
    const msgs = Object.fromEntries(Object.entries(faltas).map(([k, m]) => [k, t(m === "numero" ? "admin.erro.numero" : "admin.erro.obrigatorio")]))
    setErros(msgs)
    if (Object.keys(msgs).length > 0) return
    await acao.rodar(() => aoSalvar(carga), "admin.comum.salvo")
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        {campos.map((c) => {
          const rotulo = t(c.rotulo) + (c.obrigatorio ? " *" : "")
          const ajuda = c.tipo === "dataHora" ? t("admin.comum.horaDublin") : c.ajuda ? t(c.ajuda) : undefined
          const erro = erros[c.chave]
          if (c.tipo === "area") return <div key={c.chave} className="sm:col-span-2"><AreaTexto rotulo={rotulo} erro={erro} ajuda={ajuda} value={v[c.chave] as string} onChange={(e) => muda(c.chave, e.target.value)} /></div>
          if (c.tipo === "checkbox" || c.tipo === "publicado") return <Caixa key={c.chave} rotulo={t(c.rotulo)} checked={v[c.chave] === true} onChange={(e) => muda(c.chave, e.target.checked)} />
          if (c.tipo === "selecao")
            return (
              <Selecao key={c.chave} rotulo={rotulo} erro={erro} value={v[c.chave] as string} onChange={(e) => muda(c.chave, e.target.value)}>
                <option value="">{c.vazio ? t(c.vazio) : "—"}</option>
                {c.opcoes?.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
              </Selecao>
            )
          if (c.tipo === "imagem") return <CampoImagem key={c.chave} rotulo={rotulo} pasta={c.pasta ?? "geral"} valor={v[c.chave] as string} aoMudar={(p) => muda(c.chave, p)} />
          const tipoInput = { texto: "text", email: "email", url: "url", numero: "number", data: "date", dataHora: "datetime-local" }[c.tipo]
          return <Campo key={c.chave} rotulo={rotulo} erro={erro} ajuda={ajuda} type={tipoInput} step={c.tipo === "numero" ? "any" : undefined} value={v[c.chave] as string} onChange={(e) => muda(c.chave, e.target.value)} />
        })}
      </div>
      <AvisoDe aviso={acao.aviso} />
      <div className="flex flex-wrap gap-3">
        <Botao type="submit" ocupado={acao.ocupado} className="sm:w-auto">{t(salvar ?? "admin.comum.salvar")}</Botao>
        {aoCancelar ? <Botao type="button" variante="contorno" onClick={aoCancelar} className="sm:w-auto">{t("comum.cancelar")}</Botao> : null}
      </div>
    </form>
  )
}

// Imagem no bucket público `imagens`: envia ao escolher o arquivo e guarda o caminho no campo.
function CampoImagem({ rotulo, pasta, valor, aoMudar }: { rotulo: string; pasta: string; valor: string; aoMudar: (p: string) => void }) {
  const t = useT()
  const acao = useAcao()
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-creme">
        {rotulo}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="mt-2 block w-full text-sm"
          onChange={(e) => {
            const arq = e.target.files?.[0]
            if (arq) void acao.rodar(async () => aoMudar(await enviarArquivo("imagens", pasta, arq)), "admin.comum.enviado")
          }}
        />
      </label>
      {valor ? (
        <p className="mt-2 flex items-center gap-3 text-sm text-creme/70">
          <img src={supabase.storage.from("imagens").getPublicUrl(valor).data.publicUrl} alt="" className="size-12 rounded object-cover" />
          <span className="break-all">{valor}</span>
          <button type="button" className="underline" onClick={() => aoMudar("")}>{t("admin.comum.remover")}</button>
        </p>
      ) : null}
      <AvisoDe aviso={acao.aviso} />
    </div>
  )
}
