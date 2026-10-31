import { useState } from "react"
import { Botao } from "../../../componentes/Botao"
import { Selecao } from "../../../componentes/Campo"
import { Selo } from "../../../componentes/Selo"
import { Tabela } from "../../../componentes/Tabela"
import { Vazio } from "../../../componentes/Vazio"
import { useT } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { AreaTexto } from "../componentes/Campos"
import { AvisoDe, Mostrar, Pagina, SemPermissao } from "../componentes/Pagina"
import { exigir, exigirLinha, useAcao, useCarga } from "../lib/consulta"
import { dataCurta, hojeEmDublin } from "../lib/formato"
import { SUPER, usePode } from "../lib/papel"

const STATUS = ["recebido", "em_andamento", "concluido", "recusado"] as const
type Status = (typeof STATUS)[number]
type Pedido = { id: number; email: string; tipo: "exportacao" | "exclusao" | "retificacao"; status: Status; prazo_em: string; observacao: string | null }

// Dias até o prazo (negativo = vencido). Datas 'YYYY-MM-DD' em UTC puro para não depender do fuso do navegador.
export function diasAte(prazo: string, hoje: string) {
  return Math.round((Date.parse(prazo.slice(0, 10)) - Date.parse(hoje)) / 86400000)
}

function Linha({ p, aoMudar }: { p: Pedido; aoMudar: () => void }) {
  const t = useT()
  const [status, setStatus] = useState<Status>(p.status)
  const [obs, setObs] = useState(p.observacao ?? "")
  const acao = useAcao()
  const salvar = (novo: Status) =>
    acao.rodar(async () => {
      exigirLinha(await supabase.from("pedidos_gdpr").update({ status: novo, observacao: obs.trim() === "" ? null : obs }).eq("id", p.id).select("id"))
      setStatus(novo)
      aoMudar()
    }, "admin.comum.salvo")
  return (
    <div className="space-y-3">
      <Selecao rotulo={t("admin.comum.status")} value={status} onChange={(e) => setStatus(e.target.value as Status)}>
        {STATUS.map((s) => <option key={s} value={s}>{t(`admin.pedidos.status.${s}`)}</option>)}
      </Selecao>
      <AreaTexto rotulo={t("admin.pedidos.observacao")} rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
      <AvisoDe aviso={acao.aviso} />
      <div className="flex flex-wrap gap-2">
        <Botao type="button" ocupado={acao.ocupado} onClick={() => void salvar(status)} className="sm:w-auto">{t("admin.comum.salvar")}</Botao>
        {p.status !== "concluido" ? <Botao type="button" variante="contorno" disabled={acao.ocupado} onClick={() => void salvar("concluido")} className="sm:w-auto">{t("admin.pedidos.atendido")}</Botao> : null}
      </div>
    </div>
  )
}

// Fila do GDPR (CON-04): exportação, exclusão, retificação; prazo de 1 mês (RGPD art. 12(3)). Só o super_admin lê e muda.
export function PedidosDeDados() {
  const t = useT()
  const pode = usePode(SUPER)
  const [abertos, setAbertos] = useState(true)
  const carga = useCarga(async () => {
    let q = supabase.from("pedidos_gdpr").select("id, email, tipo, status, prazo_em, observacao").order("prazo_em").limit(300)
    if (abertos) q = q.in("status", ["recebido", "em_andamento"])
    return exigir(await q) as Pedido[]
  }, [abertos, pode])
  if (!pode) return <Pagina titulo="admin.pedidosDeDados.titulo"><SemPermissao /></Pagina>
  const hoje = hojeEmDublin()
  return (
    <Pagina titulo="admin.pedidosDeDados.titulo" intro="admin.pedidos.intro">
      <div className="max-w-xs">
        <Selecao rotulo={t("admin.pedidos.mostrar")} value={abertos ? "abertos" : "todos"} onChange={(e) => setAbertos(e.target.value === "abertos")}>
          <option value="abertos">{t("admin.pedidos.abertos")}</option>
          <option value="todos">{t("admin.comum.todos")}</option>
        </Selecao>
      </div>
      <Mostrar carga={carga}>
        {(linhas) =>
          linhas.length === 0 ? (
            <Vazio>{t("admin.vazio.nada")}</Vazio>
          ) : (
            <Tabela
              legenda={t("admin.pedidosDeDados.titulo")} linhas={linhas} id={(l) => l.id}
              colunas={[
                { chave: "email", titulo: t("admin.comum.email"), celula: (l) => l.email },
                { chave: "tipo", titulo: t("admin.comum.tipo"), celula: (l) => t(`admin.pedidos.tipo.${l.tipo}`) },
                {
                  chave: "prazo", titulo: t("admin.pedidos.prazo"),
                  celula: (l) => {
                    const d = diasAte(l.prazo_em, hoje)
                    const aberto = l.status === "recebido" || l.status === "em_andamento"
                    return (
                      <span className="flex flex-wrap items-center gap-2">
                        {dataCurta(l.prazo_em)}
                        {aberto && d < 0 ? <Selo tom="alerta">{t("admin.pedidos.vencido")}</Selo> : aberto && d <= 7 ? <Selo tom="alerta">{t("admin.pedidos.venceEmBreve")}</Selo> : null}
                      </span>
                    )
                  },
                },
                { chave: "acao", titulo: t("admin.comum.acoes"), celula: (l) => <Linha key={`${l.id}-${l.status}`} p={l} aoMudar={carga.recarregar} /> },
              ]}
            />
          )
        }
      </Mostrar>
    </Pagina>
  )
}
