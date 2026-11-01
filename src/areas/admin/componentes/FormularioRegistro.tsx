import { useState, type SubmitEvent } from "react"
import { Botao } from "../../../componentes/Botao"
import { Campo, Selecao } from "../../../componentes/Campo"
import { useT, type Chave } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { enviarArquivo, useAcao } from "../lib/consulta"
import { paraCarga, paraValores, type CampoDef, type Linha, type Valores } from "../lib/campos"
import { AvisoDe } from "./Pagina"
import { AreaTexto, Caixa } from "./Campos"
import { classeLink } from "../lib/estilo"

export type { CampoDef, OpcaoSel, Valores } from "../lib/campos"

// Formulário genérico de um registro. `aoSalvar` faz a escrita (insert/update/RPC) e lança erro se falhar.
export function FormularioRegistro({
  campos, linha, aoSalvar, salvar, aoCancelar, variante = "primario",
}: {
  campos: CampoDef[]
  linha: Linha | null
  aoSalvar: (carga: Linha) => Promise<void>
  salvar?: Chave
  aoCancelar?: () => void
  // "contorno" nos formulários secundários da tela: só um botão dourado por tela.
  variante?: "primario" | "contorno"
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
        <Botao type="submit" variante={variante} ocupado={acao.ocupado} className="sm:w-auto">{t(salvar ?? "admin.comum.salvar")}</Botao>
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
      <label className="mb-1.5 block text-legenda font-medium text-bruma">
        {rotulo}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="mt-2 block w-full text-legenda text-bruma"
          onChange={(e) => {
            const arq = e.target.files?.[0]
            if (arq) void acao.rodar(async () => aoMudar(await enviarArquivo("imagens", pasta, arq)), "admin.comum.enviado")
          }}
        />
      </label>
      {valor ? (
        <p className="mt-2 flex items-center gap-3 text-legenda text-nevoa">
          <img src={supabase.storage.from("imagens").getPublicUrl(valor).data.publicUrl} alt="" className="size-12 rounded object-cover" />
          <span className="break-all">{valor}</span>
          <button type="button" className={classeLink} onClick={() => aoMudar("")}>{t("admin.comum.remover")}</button>
        </p>
      ) : null}
      <AvisoDe aviso={acao.aviso} />
    </div>
  )
}
