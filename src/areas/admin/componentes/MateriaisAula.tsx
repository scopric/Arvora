import { useState } from "react"
import { Botao } from "../../../componentes/Botao"
import { Selo } from "../../../componentes/Selo"
import { useT } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { abrirAssinado, enviarArquivo, exigirLinha, exigirSemDados, useAcao } from "../lib/consulta"
import { AreaTexto, classeAcao } from "./Campos"
import { AvisoDe } from "./Pagina"

export type Material = { id: number; tipo: "resumo" | "ebook" | "exercicios"; conteudo_md: string | null; arquivo_path: string | null; status: "rascunho" | "aprovado" }
export const TIPOS_MATERIAL = ["resumo", "ebook", "exercicios"] as const

// Um material (resumo, e-book ou exercícios): texto e/ou PDF/EPUB no bucket `materiais/{aula_id}/`. Editar volta a rascunho (banco);
// publicar para o membro exige aprovar_material (nada sem revisão de pessoa).
function Um({ aulaId, tipo, atual, aoMudar }: { aulaId: number; tipo: Material["tipo"]; atual: Material | undefined; aoMudar: () => void }) {
  const t = useT()
  const [texto, setTexto] = useState(atual?.conteudo_md ?? "")
  const [arquivo, setArquivo] = useState<File | null>(null)
  const acao = useAcao()

  const salvar = () =>
    acao.rodar(async () => {
      const caminho = arquivo ? await enviarArquivo("materiais", String(aulaId), arquivo) : (atual?.arquivo_path ?? null)
      const conteudo = texto.trim() === "" ? null : texto
      if (conteudo === null && caminho === null) throw new Error("material_vazio")
      if (atual) exigirLinha(await supabase.from("materiais_aula").update({ conteudo_md: conteudo, arquivo_path: caminho }).eq("id", atual.id).select("id"))
      else exigirLinha(await supabase.from("materiais_aula").insert({ aula_id: aulaId, tipo, conteudo_md: conteudo, arquivo_path: caminho }).select("id"))
      setArquivo(null)
      aoMudar()
    }, "admin.comum.salvo")

  const aprovar = () =>
    acao.rodar(async () => {
      if (!atual) return
      exigirSemDados(await supabase.rpc("aprovar_material", { material: atual.id }))
      aoMudar()
    }, "admin.aula.materialAprovado")

  return (
    <div className="space-y-3 rounded-2xl border border-current/15 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-semibold">{t(`admin.aula.material.${tipo}`)}</h3>
        <Selo tom={atual?.status === "aprovado" ? "destaque" : "neutro"}>{atual ? t(`admin.aula.materialStatus.${atual.status}`) : t("admin.aula.materialStatus.vazio")}</Selo>
      </div>
      <AreaTexto rotulo={t("admin.aula.materialTexto")} value={texto} onChange={(e) => setTexto(e.target.value)} />
      <label className="block text-sm font-semibold">
        {t("admin.aula.materialArquivo")}
        <input type="file" accept="application/pdf,application/epub+zip" className="mt-2 block w-full text-sm" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
      </label>
      {atual?.arquivo_path ? (
        <button type="button" className="text-sm underline" onClick={() => void acao.rodar(() => abrirAssinado("materiais", atual.arquivo_path!))}>{t("admin.aula.materialAbrir")}</button>
      ) : null}
      <AvisoDe aviso={acao.aviso} />
      <div className="flex flex-wrap gap-3">
        <Botao type="button" ocupado={acao.ocupado} onClick={salvar} className="sm:w-auto">{t("admin.comum.salvar")}</Botao>
        {atual?.status === "rascunho" ? <button type="button" disabled={acao.ocupado} className={classeAcao} onClick={aprovar}>{t("admin.aula.aprovarMaterial")}</button> : null}
      </div>
    </div>
  )
}

export function MateriaisAula({ aulaId, materiais, aoMudar }: { aulaId: number; materiais: Material[]; aoMudar: () => void }) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {TIPOS_MATERIAL.map((tipo) => {
        const atual = materiais.find((m) => m.tipo === tipo)
        return <Um key={`${tipo}-${atual?.id ?? 0}-${atual?.status ?? ""}`} aulaId={aulaId} tipo={tipo} atual={atual} aoMudar={aoMudar} />
      })}
    </div>
  )
}
