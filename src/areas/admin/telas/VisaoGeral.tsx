import { Link } from "react-router"
import { Cartao } from "../../../componentes/Cartao"
import { Vazio } from "../../../componentes/Vazio"
import { useCaminho, useT, type Chave } from "../../../i18n"
import type { PapelEquipe } from "../../../lib/acesso"
import { supabase } from "../../../lib/supabase"
import { Mostrar, Pagina } from "../componentes/Pagina"
import { useCarga } from "../lib/consulta"
import { hojeEmDublin } from "../lib/formato"
import { APROVA_EMPRESA, CORRIGE, EDITA, MODERA, SUPER } from "../lib/papel"
import { useAcesso } from "../../../lib/acesso"

type CartaoDef = { chave: string; titulo: Chave; rota: string; papeis: PapelEquipe[]; contar: () => PromiseLike<{ count: number | null; error: unknown }> }
const contar = { count: "exact", head: true } as const

// Visão geral: o que está esperando alguém da equipe. Cada cartão só aparece para o papel que pode agir nele.
export function VisaoGeral() {
  const t = useT()
  const caminho = useCaminho()
  const { papel } = useAcesso()
  const em7 = new Date(Date.parse(hojeEmDublin()) + 7 * 86400000).toISOString().slice(0, 10)
  const cartoes: CartaoDef[] = [
    { chave: "empresas", titulo: "admin.visao.empresas", rota: "/admin/empresas", papeis: APROVA_EMPRESA, contar: () => supabase.from("empresas").select("id", contar).eq("status", "pendente") },
    { chave: "denuncias", titulo: "admin.visao.denuncias", rota: "/admin/moderacao", papeis: MODERA, contar: () => supabase.from("denuncias").select("id", contar).eq("status", "aberta") },
    { chave: "pedidos", titulo: "admin.visao.pedidos", rota: "/admin/pedidos-de-dados", papeis: SUPER, contar: () => supabase.from("pedidos_gdpr").select("id", contar).in("status", ["recebido", "em_andamento"]) },
    { chave: "prazo", titulo: "admin.visao.pedidosPrazo", rota: "/admin/pedidos-de-dados", papeis: SUPER, contar: () => supabase.from("pedidos_gdpr").select("id", contar).in("status", ["recebido", "em_andamento"]).lte("prazo_em", em7) },
    { chave: "aulas", titulo: "admin.visao.aulas", rota: "/admin/aulas", papeis: EDITA, contar: () => supabase.from("aulas").select("id", contar).not("agendada_em", "is", null).is("materiais_publicados_em", null) },
    { chave: "entregas", titulo: "admin.visao.entregas", rota: "/admin/correcao", papeis: CORRIGE, contar: () => supabase.from("entregas").select("id", contar).eq("status", "enviada") },
    { chave: "alteracoes", titulo: "admin.visao.alteracoes", rota: "/admin/premiados", papeis: EDITA, contar: () => supabase.from("premiados").select("id", contar).not("alteracao_em", "is", null) },
  ].filter((c) => papel !== null && c.papeis.includes(papel))
  const carga = useCarga(async () => {
    const r = await Promise.all(cartoes.map((c) => c.contar()))
    const erro = r.find((x) => x.error)
    if (erro) throw erro.error
    return cartoes.map((c, i) => ({ ...c, n: r[i].count ?? 0 }))
  }, [papel])
  return (
    <Pagina titulo="admin.visaoGeral.titulo" intro="admin.visao.intro">
      <Mostrar carga={carga}>
        {(lista) =>
          lista.every((c) => c.n === 0) ? (
            <Vazio>{t("admin.vazio.nada")}</Vazio>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {lista.map((c) => (
                <li key={c.chave}>
                  <Cartao>
                    <p className="font-titulo text-6xl leading-none font-bold">{c.n}</p>
                    <p className="mt-3">{t(c.titulo)}</p>
                    <Link className="mt-4 inline-flex min-h-11 items-center underline" to={caminho(c.rota)}>{t("admin.visao.abrir")}</Link>
                  </Cartao>
                </li>
              ))}
            </ul>
          )
        }
      </Mostrar>
    </Pagina>
  )
}
