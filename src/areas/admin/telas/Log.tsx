import { useEffect, useState } from "react"
import { Botao } from "../../../componentes/Botao"
import { Campo } from "../../../componentes/Campo"
import { Tabela } from "../../../componentes/Tabela"
import { Vazio } from "../../../componentes/Vazio"
import { useIdioma, useT, type Chave } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { Mostrar, Pagina, SemPermissao } from "../componentes/Pagina"
import { exigir, useCarga } from "../lib/consulta"
import { dataHora } from "../lib/formato"
import { FINANCEIRO, usePode } from "../lib/papel"
import { classeLink } from "../lib/estilo"

const PAGINA = 100

const obj = (x: unknown) => (x && typeof x === "object" ? (x as Record<string, unknown>) : {})
// Campos que mudaram entre o antes e o depois (insert: só o depois; delete: só o antes).
const mudancas = (antes: unknown, depois: unknown) => [...new Set([...Object.keys(obj(antes)), ...Object.keys(obj(depois))])].filter((k) => JSON.stringify(obj(antes)[k]) !== JSON.stringify(obj(depois)[k]))
const valor = (x: unknown, k: string) => { const v = obj(x)[k]; return v === undefined || v === null ? "—" : typeof v === "string" ? v : JSON.stringify(v) }

// Log de ações (ADM-09): super_admin lê tudo; o auditor só as tabelas financeiras (RLS). Só leitura.
export function Log() {
  const t = useT()
  const lang = useIdioma()
  const pode = usePode(FINANCEIRO)
  const [filtro, setFiltro] = useState("")
  const [tabela, setTabela] = useState("")
  const [limite, setLimite] = useState(PAGINA)
  // Espera a pessoa parar de digitar antes de consultar.
  useEffect(() => {
    const id = setTimeout(() => { setTabela(filtro); setLimite(PAGINA) }, 400)
    return () => clearTimeout(id)
  }, [filtro])
  const carga = useCarga(async () => {
    let q = supabase.from("log_admin").select("id, ator_id, acao, tabela, alvo_id, antes, depois, criado_em").order("criado_em", { ascending: false }).limit(limite)
    if (tabela.trim()) q = q.eq("tabela", tabela.trim())
    const linhas = exigir(await q)
    const atores = [...new Set(linhas.map((l) => l.ator_id))]
    const nomes = atores.length ? exigir(await supabase.from("perfis").select("id, nome").in("id", atores)) : []
    return { linhas, nomes: new Map(nomes.map((n) => [n.id, n.nome])) }
  }, [tabela, limite, pode])
  if (!pode) return <Pagina titulo="admin.log.titulo"><SemPermissao /></Pagina>
  return (
    <Pagina titulo="admin.log.titulo" intro="admin.log.intro">
      <div className="max-w-xs">
        <Campo rotulo={t("admin.log.filtroTabela")} value={filtro} onChange={(e) => setFiltro(e.target.value)} />
      </div>
      <Mostrar carga={carga}>
        {({ linhas, nomes }) =>
          linhas.length === 0 ? (
            <Vazio>{t("admin.vazio.nada")}</Vazio>
          ) : (
            <>
              <Tabela
                legenda={t("admin.log.titulo")} linhas={linhas} id={(l) => l.id}
                colunas={[
                  { chave: "quando", titulo: t("admin.log.quando"), celula: (l) => dataHora(l.criado_em, lang) },
                  { chave: "quem", titulo: t("admin.log.quem"), celula: (l) => nomes.get(l.ator_id) ?? l.ator_id.slice(0, 8) },
                  { chave: "acao", titulo: t("admin.log.acao"), celula: (l) => l.acao },
                  { chave: "tabela", titulo: t("admin.log.tabela"), celula: (l) => `${l.tabela}${l.alvo_id ? ` #${l.alvo_id}` : ""}` },
                  {
                    chave: "det", titulo: t("admin.log.detalhe"),
                    celula: (l) => (
                      <details>
                        <summary className={`min-h-9 cursor-pointer py-2 text-corpo-p pointer-coarse:min-h-11 ${classeLink}`}>{t("admin.log.ver")}</summary>
                        <ul className="mt-2 max-w-md space-y-1 text-corpo-p">
                          {mudancas(l.antes, l.depois).map((m) => (
                            <li key={m}><strong>{t(`admin.campo.${m}` as Chave) || m}</strong>: {valor(l.antes, m)} → {valor(l.depois, m)}</li>
                          ))}
                        </ul>
                      </details>
                    ),
                  },
                ]}
              />
              {linhas.length >= limite ? <Botao variante="contorno" className="sm:w-auto" onClick={() => setLimite((n) => n + PAGINA)}>{t("admin.comum.carregarMais")}</Botao> : null}
            </>
          )
        }
      </Mostrar>
    </Pagina>
  )
}
