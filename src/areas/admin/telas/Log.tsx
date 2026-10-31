import { useState } from "react"
import { Botao } from "../../../componentes/Botao"
import { Campo } from "../../../componentes/Campo"
import { Tabela } from "../../../componentes/Tabela"
import { Vazio } from "../../../componentes/Vazio"
import { useIdioma, useT } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { Mostrar, Pagina, SemPermissao } from "../componentes/Pagina"
import { exigir, useCarga } from "../lib/consulta"
import { dataHora } from "../lib/formato"
import { FINANCEIRO, usePode } from "../lib/papel"

const PAGINA = 100

// Log de ações (ADM-09): super_admin lê tudo; o auditor só as tabelas financeiras (RLS). Só leitura.
export function Log() {
  const t = useT()
  const lang = useIdioma()
  const pode = usePode(FINANCEIRO)
  const [tabela, setTabela] = useState("")
  const [limite, setLimite] = useState(PAGINA)
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
        <Campo rotulo={t("admin.log.filtroTabela")} value={tabela} onChange={(e) => { setTabela(e.target.value); setLimite(PAGINA) }} />
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
                        <summary className="cursor-pointer underline">{t("admin.log.ver")}</summary>
                        <pre className="mt-2 max-w-md overflow-x-auto text-xs">{JSON.stringify({ antes: l.antes, depois: l.depois }, null, 1)}</pre>
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
