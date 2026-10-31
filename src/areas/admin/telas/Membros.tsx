import { useState } from "react"
import { Link } from "react-router"
import { Botao } from "../../../componentes/Botao"
import { Campo, Selecao } from "../../../componentes/Campo"
import { Selo } from "../../../componentes/Selo"
import { Tabela } from "../../../componentes/Tabela"
import { Vazio } from "../../../componentes/Vazio"
import { useCaminho, useT } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { Mostrar, Pagina } from "../componentes/Pagina"
import { exigir, useCarga } from "../lib/consulta"
import { dataCurta } from "../lib/formato"
import { FINANCEIRO, usePode } from "../lib/papel"
import { VIGENTES } from "../lib/regras"

const PAGINA = 50
// Membros (ADM-04): perfis + nível/status da assinatura. Pagamento só leitura; assinatura só para super_admin e auditor (RLS).
export function Membros() {
  const t = useT()
  const caminho = useCaminho()
  const financeiro = usePode(FINANCEIRO)
  const [nome, setNome] = useState("")
  const [busca, setBusca] = useState("")
  const [nivel, setNivel] = useState("")
  const [suspensos, setSuspensos] = useState(false)
  const [limite, setLimite] = useState(PAGINA)
  const carga = useCarga(async () => {
    let q = supabase.from("perfis").select("id, nome, empresa_nome, cidade, pais, visibilidade, suspenso_em, criado_em").order("criado_em", { ascending: false }).limit(limite)
    if (busca.trim()) q = q.ilike("nome", `%${busca.trim().replace(/[%,()]/g, " ")}%`)
    if (suspensos) q = q.not("suspenso_em", "is", null)
    const perfis = exigir(await q)
    const niveis = new Map<string, { nivel: string | null; status: string }>()
    if (financeiro && perfis.length) {
      const ass = exigir(await supabase.from("assinaturas").select("perfil_id, plano_id, status, periodo_fim").in("perfil_id", perfis.map((p) => p.id)).in("status", VIGENTES).gt("periodo_fim", new Date().toISOString()))
      const planos = ass.length ? exigir(await supabase.from("planos").select("id, nivel").in("id", [...new Set(ass.map((a) => a.plano_id))])) : []
      for (const a of ass) if (a.perfil_id) niveis.set(a.perfil_id, { nivel: planos.find((p) => p.id === a.plano_id)?.nivel ?? null, status: a.status })
    }
    return { perfis, niveis }
  }, [busca, suspensos, limite, financeiro])

  return (
    <Pagina titulo="admin.membros.titulo" intro={financeiro ? "admin.membros.intro" : "admin.membros.introSemPlano"}>
      <form className="grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); setBusca(nome); setLimite(PAGINA) }}>
        <Campo rotulo={t("admin.membros.buscar")} value={nome} onChange={(e) => setNome(e.target.value)} />
        <Selecao rotulo={t("admin.membros.situacao")} value={suspensos ? "suspensos" : ""} onChange={(e) => { setSuspensos(e.target.value === "suspensos"); setLimite(PAGINA) }}>
          <option value="">{t("admin.comum.todos")}</option>
          <option value="suspensos">{t("admin.membros.soSuspensos")}</option>
        </Selecao>
        <Botao type="submit" variante="contorno" className="sm:w-auto">{t("admin.membros.filtrar")}</Botao>
      </form>
      {financeiro ? (
        <div className="max-w-xs">
          <Selecao rotulo={t("admin.membros.nivel")} value={nivel} onChange={(e) => setNivel(e.target.value)}>
            <option value="">{t("admin.comum.todos")}</option>
            <option value="clube">{t("nivel.clube")}</option>
            <option value="grupo">{t("nivel.grupo")}</option>
            <option value="nenhum">{t("admin.membros.semAssinatura")}</option>
          </Selecao>
        </div>
      ) : null}
      <Mostrar carga={carga}>
        {({ perfis, niveis }) => {
          const linhas = perfis.filter((p) => !nivel || (nivel === "nenhum" ? !niveis.has(p.id) : niveis.get(p.id)?.nivel === nivel))
          return linhas.length === 0 ? (
            <Vazio>{t("admin.membros.vazio")}</Vazio>
          ) : (
            <>
              <Tabela
                legenda={t("admin.membros.titulo")} linhas={linhas} id={(l) => l.id}
                colunas={[
                  { chave: "nome", titulo: t("admin.comum.nome"), celula: (l) => <Link className="underline" to={caminho(`/admin/membros/${l.id}`)}>{l.nome}</Link> },
                  { chave: "empresa", titulo: t("admin.membros.empresa"), celula: (l) => l.empresa_nome ?? "—" },
                  { chave: "local", titulo: t("admin.comum.cidade"), celula: (l) => [l.cidade, l.pais].filter(Boolean).join(", ") || "—" },
                  ...(financeiro ? [{ chave: "plano", titulo: t("admin.membros.plano"), celula: (l: (typeof linhas)[number]) => { const n = niveis.get(l.id); return n ? <Selo tom="destaque">{n.nivel ? t(`nivel.${n.nivel as "clube"}`) : "—"} · {t(`admin.assinatura.${n.status as "active"}`)}</Selo> : <Selo>{t("admin.membros.semAssinatura")}</Selo> } }] : []),
                  { chave: "situacao", titulo: t("admin.membros.situacao"), celula: (l) => (l.suspenso_em ? <Selo tom="alerta">{t("admin.membros.suspenso")}</Selo> : t("admin.membros.ativo")) },
                  { chave: "desde", titulo: t("admin.membros.desde"), celula: (l) => dataCurta(l.criado_em) },
                ]}
              />
              {perfis.length >= limite ? <Botao variante="contorno" className="sm:w-auto" onClick={() => setLimite((n) => n + PAGINA)}>{t("admin.comum.carregarMais")}</Botao> : null}
            </>
          )
        }}
      </Mostrar>
    </Pagina>
  )
}
