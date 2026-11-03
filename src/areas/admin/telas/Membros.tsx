import { useState } from "react"
import { Link } from "react-router"
import { Botao } from "../../../componentes/Botao"
import { Campo, Selecao } from "../../../componentes/Campo"
import { Selo } from "../../../componentes/Selo"
import { Tabela } from "../../../componentes/Tabela"
import { Vazio } from "../../../componentes/Vazio"
import { useCaminho, useT } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { Barra, Mostrar, Pagina } from "../componentes/Pagina"
import { exigir, useCarga } from "../lib/consulta"
import { dataCurta } from "../lib/formato"
import { FINANCEIRO, usePode } from "../lib/papel"
import { VIGENTES } from "../lib/regras"
import { classeLink } from "../lib/estilo"

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
    // Filtro de nível no servidor (a paginação conta só quem passa no filtro). ponytail: lista de ids na URL, ok até alguns milhares de assinaturas vigentes.
    let ids: string[] | null = null
    if (financeiro && nivel) {
      const planos = exigir(await supabase.from("planos").select("id, nivel").not("nivel", "is", null))
      const daqui = nivel === "nenhum" ? planos : planos.filter((p) => p.nivel === nivel)
      const vig = daqui.length ? exigir(await supabase.from("assinaturas").select("perfil_id").in("plano_id", daqui.map((p) => p.id)).in("status", VIGENTES).gt("periodo_fim", new Date().toISOString())) : []
      ids = [...new Set(vig.map((a) => a.perfil_id).filter((x): x is string => !!x))]
    }
    let q = supabase.from("perfis").select("id, nome, empresa_nome, cidade, pais, visibilidade, suspenso_em, criado_em").order("criado_em", { ascending: false }).limit(limite)
    if (busca.trim()) q = q.ilike("nome", `%${busca.trim().replace(/[%,()]/g, " ")}%`)
    if (suspensos) q = q.not("suspenso_em", "is", null)
    if (ids) {
      if (nivel === "nenhum") { if (ids.length) q = q.not("id", "in", `(${ids.join(",")})`) }
      else if (ids.length) q = q.in("id", ids)
      else return { perfis: [], niveis: new Map<string, { nivel: string | null; status: string }>() }
    }
    const perfis = exigir(await q)
    const niveis = new Map<string, { nivel: string | null; status: string }>()
    if (financeiro && perfis.length) {
      const ass = exigir(await supabase.from("assinaturas").select("perfil_id, plano_id, status, periodo_fim").in("perfil_id", perfis.map((p) => p.id)).in("status", VIGENTES).gt("periodo_fim", new Date().toISOString()))
      const planos = ass.length ? exigir(await supabase.from("planos").select("id, nivel").in("id", [...new Set(ass.map((a) => a.plano_id))])) : []
      for (const a of ass) if (a.perfil_id) niveis.set(a.perfil_id, { nivel: planos.find((p) => p.id === a.plano_id)?.nivel ?? null, status: a.status })
    }
    return { perfis, niveis }
  }, [busca, suspensos, limite, financeiro, nivel])

  return (
    <Pagina titulo="admin.membros.titulo" intro={financeiro ? "admin.membros.intro" : "admin.membros.introSemPlano"}>
      {/* Molde Attio/Linear: busca e filtros numa barra de vidro-fundo; "Filtrar" em cinza cheio (nenhum dourado na tela). */}
      <Barra onSubmit={(e) => { e.preventDefault(); setBusca(nome); setLimite(PAGINA) }} acoes={<Botao type="submit" variante="secundario" className="sm:w-auto">{t("admin.membros.filtrar")}</Botao>}>
        <div className="w-64 max-w-full"><Campo rotulo={t("admin.membros.buscar")} value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div className="w-48 max-w-full">
          <Selecao rotulo={t("admin.membros.situacao")} value={suspensos ? "suspensos" : ""} onChange={(e) => { setSuspensos(e.target.value === "suspensos"); setLimite(PAGINA) }}>
            <option value="">{t("admin.comum.todos")}</option>
            <option value="suspensos">{t("admin.membros.soSuspensos")}</option>
          </Selecao>
        </div>
        {financeiro ? (
          <div className="w-48 max-w-full">
            <Selecao rotulo={t("admin.membros.nivel")} value={nivel} onChange={(e) => { setNivel(e.target.value); setLimite(PAGINA) }}>
              <option value="">{t("admin.comum.todos")}</option>
              <option value="clube">{t("nivel.clube")}</option>
              <option value="grupo">{t("nivel.grupo")}</option>
              <option value="nenhum">{t("admin.membros.semAssinatura")}</option>
            </Selecao>
          </div>
        ) : null}
      </Barra>
      <Mostrar carga={carga}>
        {({ perfis, niveis }) => {
          const linhas = perfis
          return linhas.length === 0 ? (
            <Vazio>{t("admin.membros.vazio")}</Vazio>
          ) : (
            <>
              <Tabela
                legenda={t("admin.membros.titulo")} linhas={linhas} id={(l) => l.id}
                colunas={[
                  { chave: "nome", titulo: t("admin.comum.nome"), celula: (l) => <Link className={classeLink} to={caminho(`/admin/membros/${l.id}`)}>{l.nome}</Link> },
                  { chave: "empresa", titulo: t("admin.membros.empresa"), celula: (l) => l.empresa_nome ?? "—" },
                  { chave: "local", titulo: t("admin.comum.cidade"), celula: (l) => [l.cidade, l.pais].filter(Boolean).join(", ") || "—" },
                  ...(financeiro ? [{ chave: "plano", titulo: t("admin.membros.plano"), celula: (l: (typeof linhas)[number]) => { const n = niveis.get(l.id); return n ? <Selo tom="destaque">{n.nivel ? t(`nivel.${n.nivel as "clube"}`) : "—"} · {t(`admin.assinatura.${n.status as "active"}`)}</Selo> : <Selo>{t("admin.membros.semAssinatura")}</Selo> } }] : []),
                  { chave: "situacao", titulo: t("admin.membros.situacao"), celula: (l) => (l.suspenso_em ? <Selo tom="alerta">{t("admin.membros.suspenso")}</Selo> : t("admin.membros.ativo")) },
                  { chave: "desde", titulo: t("admin.membros.desde"), celula: (l) => dataCurta(l.criado_em) },
                ]}
              />
              {perfis.length >= limite ? <Botao variante="secundario" className="sm:w-auto" onClick={() => setLimite((n) => n + PAGINA)}>{t("admin.comum.carregarMais")}</Botao> : null}
            </>
          )
        }}
      </Mostrar>
    </Pagina>
  )
}
