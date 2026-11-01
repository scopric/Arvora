import { useState } from "react"
import { Botao } from "../../../componentes/Botao"
import { Cartao } from "../../../componentes/Cartao"
import { Vazio } from "../../../componentes/Vazio"
import { useIdioma, useT } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { AreaTexto } from "../componentes/Campos"
import { AvisoDe, Mostrar, Pagina, SemPermissao } from "../componentes/Pagina"
import { abrirAssinado, exigir, exigirSemDados, useAcao, useCarga } from "../lib/consulta"
import { dataHora } from "../lib/formato"
import { CORRIGE, usePode } from "../lib/papel"
import { classeLink } from "../lib/estilo"

type Entrega = { id: number; exercicio_id: number; perfil_id: string; texto: string | null; arquivo_path: string | null; enviada_em: string }

function Item({ e, titulo, membro, enunciado, aoMudar }: { e: Entrega; titulo: string; membro: string; enunciado: string; aoMudar: () => void }) {
  const t = useT()
  const lang = useIdioma()
  const [devolutiva, setDevolutiva] = useState("")
  const [erro, setErro] = useState("")
  const acao = useAcao()
  const corrigir = (status: "aprovada" | "ajustar") => {
    if (status === "ajustar" && devolutiva.trim() === "") return setErro(t("admin.correcao.devolutivaObrigatoria"))
    setErro("")
    void acao.rodar(async () => {
      exigirSemDados(await supabase.rpc("corrigir_entrega", { entrega: e.id, novo_status: status, devolutiva: devolutiva.trim() }))
      aoMudar()
    }, "admin.correcao.corrigida")
  }
  const [agora] = useState(() => Date.now())
  const dias = Math.max(0, Math.floor((agora - Date.parse(e.enviada_em)) / 86400000))
  return (
    <Cartao>
      <h2 className="text-base font-semibold">{membro} · {titulo}</h2>
      <p className="mt-1 text-legenda text-nevoa">{t("admin.correcao.enviadaEm")} {dataHora(e.enviada_em, lang)} · {dias} {t("admin.correcao.diasNaFila")}</p>
      <p className="mt-3 text-base text-bruma">{enunciado}</p>
      {e.texto ? <p className="mt-3 whitespace-pre-wrap">{e.texto}</p> : null}
      {e.arquivo_path ? (
        <button type="button" className={`mt-3 inline-flex min-h-9 items-center text-legenda pointer-coarse:min-h-11 ${classeLink}`} onClick={() => void acao.rodar(() => abrirAssinado("entregas", e.arquivo_path!))}>{t("admin.correcao.abrirArquivo")}</button>
      ) : null}
      <div className="mt-4">
        <AreaTexto rotulo={t("admin.correcao.devolutiva")} rows={3} value={devolutiva} erro={erro} onChange={(x) => setDevolutiva(x.target.value)} />
      </div>
      <div className="mt-3"><AvisoDe aviso={acao.aviso} /></div>
      <div className="mt-3 flex flex-wrap gap-3">
        <Botao type="button" variante="contorno" ocupado={acao.ocupado} onClick={() => corrigir("aprovada")} className="sm:w-auto">{t("admin.correcao.aprovar")}</Botao>
        <Botao type="button" variante="contorno" disabled={acao.ocupado} onClick={() => corrigir("ajustar")} className="sm:w-auto">{t("admin.correcao.pedirAjuste")}</Botao>
      </div>
    </Cartao>
  )
}

// Fila de correção (AUL-09). Arquivo por URL assinada de curta duração do bucket privado `entregas`.
export function Correcao() {
  const t = useT()
  const pode = usePode(CORRIGE)
  const carga = useCarga(async () => {
    const entregas = exigir(await supabase.from("entregas").select("id, exercicio_id, perfil_id, texto, arquivo_path, enviada_em").eq("status", "enviada").order("enviada_em").limit(100)) as Entrega[]
    if (entregas.length === 0) return { entregas, exercicios: new Map<number, { aula_id: number; enunciado_md: string }>(), aulas: new Map<number, string>(), perfis: new Map<string, string>() }
    const exercicios = exigir(await supabase.from("exercicios").select("id, aula_id, enunciado_md").in("id", [...new Set(entregas.map((x) => x.exercicio_id))]))
    const [aulas, perfis] = await Promise.all([
      supabase.from("aulas").select("id, titulo").in("id", [...new Set(exercicios.map((x) => x.aula_id))]),
      supabase.from("perfis").select("id, nome").in("id", [...new Set(entregas.map((x) => x.perfil_id))]),
    ])
    return {
      entregas,
      exercicios: new Map(exercicios.map((x) => [x.id, x])),
      aulas: new Map(exigir(aulas).map((x) => [x.id, x.titulo])),
      perfis: new Map(exigir(perfis).map((x) => [x.id, x.nome])),
    }
  }, [pode])
  if (!pode) return <Pagina titulo="admin.correcao.titulo"><SemPermissao /></Pagina>
  return (
    <Pagina titulo="admin.correcao.titulo" intro="admin.correcao.intro">
      <Mostrar carga={carga}>
        {(d) =>
          d.entregas.length === 0 ? (
            <Vazio>{t("admin.correcao.vazio")}</Vazio>
          ) : (
            <ul className="space-y-4">
              {d.entregas.map((e) => {
                const ex = d.exercicios.get(e.exercicio_id)
                return (
                  <li key={e.id}>
                    <Item e={e} titulo={ex ? (d.aulas.get(ex.aula_id) ?? "—") : "—"} membro={d.perfis.get(e.perfil_id) ?? "—"} enunciado={ex?.enunciado_md ?? ""} aoMudar={carga.recarregar} />
                  </li>
                )
              })}
            </ul>
          )
        }
      </Mostrar>
    </Pagina>
  )
}
