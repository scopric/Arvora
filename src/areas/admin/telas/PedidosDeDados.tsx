import { useState } from "react"
import { Botao } from "../../../componentes/Botao"
import { DialogoConfirmar } from "../../../componentes/DialogoConfirmar"
import { Selecao } from "../../../componentes/Campo"
import { Selo } from "../../../componentes/Selo"
import { Tabela } from "../../../componentes/Tabela"
import { Vazio } from "../../../componentes/Vazio"
import { useT } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { AreaTexto } from "../componentes/Campos"
import { Barra, AvisoDe, Mostrar, Pagina, SemPermissao } from "../componentes/Pagina"
import { exigir, exigirLinha, useAcao, useCarga } from "../lib/consulta"
import { dataCurta, hojeEmDublin } from "../lib/formato"
import { SUPER, usePode } from "../lib/papel"
import { diasAte } from "../lib/regras"

const STATUS = ["recebido", "em_andamento", "concluido", "recusado"] as const
type Status = (typeof STATUS)[number]
type Pedido = { id: number; email: string; tipo: "exportacao" | "exclusao" | "retificacao"; status: Status; prazo_em: string; criado_em: string; observacao: string | null }

function Linha({ p, aoMudar }: { p: Pedido; aoMudar: () => void }) {
  const t = useT()
  const [status, setStatus] = useState<Status>(p.status)
  const [confirmando, setConfirmando] = useState(false)
  const [obs, setObs] = useState(p.observacao ?? "")
  const [erroObs, setErroObs] = useState(false)
  const acao = useAcao()
  const salvar = (novo: Status) => {
    // GDPR art. 12(4): a recusa tem de dizer o motivo ao titular
    const semMotivo = novo === "recusado" && obs.trim() === ""
    setErroObs(semMotivo)
    if (semMotivo) return
    return acao.rodar(async () => {
      exigirLinha(await supabase.from("pedidos_gdpr").update({ status: novo, observacao: obs.trim() === "" ? null : obs }).eq("id", p.id).select("id"))
      setStatus(novo)
      aoMudar()
    }, "admin.comum.salvo")
  }
  return (
    <div className="space-y-3">
      <Selecao rotulo={t("admin.comum.status")} value={status} onChange={(e) => setStatus(e.target.value as Status)}>
        {STATUS.map((s) => <option key={s} value={s}>{t(`admin.pedidos.status.${s}`)}</option>)}
      </Selecao>
      <AreaTexto rotulo={t("admin.pedidos.observacao")} erro={erroObs ? t("admin.pedidos.recusaSemMotivo") : undefined} rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
      <AvisoDe aviso={acao.aviso} />
      <div className="flex flex-wrap gap-2">
        <Botao type="button" pequeno ocupado={acao.ocupado} onClick={() => void salvar(status)}>{t("admin.comum.salvar")}</Botao>
        {p.status !== "concluido" && p.status !== "recusado" ? <Botao type="button" pequeno disabled={acao.ocupado} onClick={() => setConfirmando(true)}>{t("admin.pedidos.atendido")}</Botao> : null}
      </div>
      <DialogoConfirmar
        aberto={confirmando} titulo={t("admin.pedidos.atendidoTitulo")} texto={t("admin.pedidos.atendidoTexto")} confirmar={t("admin.pedidos.atendido")}
        aoCancelar={() => setConfirmando(false)}
        aoConfirmar={() => { setConfirmando(false); void salvar("concluido") }}
      />
    </div>
  )
}

// Fila do GDPR (CON-04): exportação, exclusão, retificação; prazo de 1 mês (RGPD art. 12(3)). Só o super_admin lê e muda.
export function PedidosDeDados() {
  const t = useT()
  const pode = usePode(SUPER)
  const [abertos, setAbertos] = useState(true)
  const carga = useCarga(async () => {
    let q = supabase.from("pedidos_gdpr").select("id, email, tipo, status, prazo_em, criado_em, observacao").order("prazo_em").limit(300)
    if (abertos) q = q.in("status", ["recebido", "em_andamento"])
    return exigir(await q) as Pedido[]
  }, [abertos, pode])
  if (!pode) return <Pagina titulo="admin.pedidosDeDados.titulo"><SemPermissao /></Pagina>
  const hoje = hojeEmDublin()
  return (
    <Pagina titulo="admin.pedidosDeDados.titulo" intro="admin.pedidos.intro">
      <Barra>
        <div className="w-56 max-w-full">
          <Selecao rotulo={t("admin.pedidos.mostrar")} value={abertos ? "abertos" : "todos"} onChange={(e) => setAbertos(e.target.value === "abertos")}>
            <option value="abertos">{t("admin.pedidos.abertos")}</option>
            <option value="todos">{t("admin.comum.todos")}</option>
          </Selecao>
        </div>
      </Barra>
      <Mostrar carga={carga}>
        {(linhas) =>
          linhas.length === 0 ? (
            <Vazio>{t("admin.vazio.nada")}</Vazio>
          ) : (
            <Tabela
              legenda={t("admin.pedidosDeDados.titulo")} linhas={linhas} id={(l) => l.id}
              colunas={[
                { chave: "email", titulo: t("admin.comum.email"), celula: (l) => l.email },
                { chave: "recebido", titulo: t("admin.pedidos.recebidoEm"), celula: (l) => dataCurta(l.criado_em) },
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
