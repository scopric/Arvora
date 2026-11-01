import { useState } from "react"
import { Link } from "react-router"
import { Selecao } from "../../../componentes/Campo"
import { Selo } from "../../../componentes/Selo"
import { Tabela } from "../../../componentes/Tabela"
import { Vazio } from "../../../componentes/Vazio"
import { useCaminho, useT } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { classeAcao } from "../componentes/Campos"
import { Mostrar, Pagina } from "../componentes/Pagina"
import { exigir, useCarga } from "../lib/consulta"
import { EDITA, usePode } from "../lib/papel"

export function Premiados() {
  const t = useT()
  const caminho = useCaminho()
  const pode = usePode(EDITA)
  const [edicao, setEdicao] = useState("")
  const carga = useCarga(async () => {
    const [premiados, edicoes] = await Promise.all([
      supabase.from("premiados").select("id, nome, edicao_id, publicado_em, alteracao_em").order("criado_em", { ascending: false }).limit(300),
      supabase.from("edicoes").select("id, nome").order("ano", { ascending: false }),
    ])
    return { premiados: exigir(premiados), edicoes: exigir(edicoes) }
  }, [pode])
  return (
    <Pagina titulo="admin.premiados.titulo" intro="admin.premiados.intro" acoes={pode ? <Link className={classeAcao} to={caminho("/admin/premiados/novo")}>{t("admin.premiados.novo")}</Link> : null}>
      <Mostrar carga={carga}>
        {({ premiados, edicoes }) => {
          const nome = new Map(edicoes.map((e) => [e.id, e.nome]))
          const linhas = premiados.filter((p) => !edicao || String(p.edicao_id) === edicao)
          return (
            <>
              <div className="max-w-xs">
                <Selecao rotulo={t("admin.videos.edicao")} value={edicao} onChange={(e) => setEdicao(e.target.value)}>
                  <option value="">{t("admin.comum.todos")}</option>
                  {edicoes.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </Selecao>
              </div>
              {linhas.length === 0 ? (
                <Vazio>{t("admin.premiados.vazio")}</Vazio>
              ) : (
                <Tabela
                  legenda={t("admin.premiados.titulo")} linhas={linhas} id={(l) => l.id}
                  colunas={[
                    { chave: "nome", titulo: t("admin.comum.nome"), celula: (l) => <Link className="underline" to={caminho(`/admin/premiados/${l.id}`)}>{l.nome}</Link> },
                    { chave: "edicao", titulo: t("admin.videos.edicao"), celula: (l) => nome.get(l.edicao_id) ?? "—" },
                    { chave: "pub", titulo: t("admin.comum.status"), celula: (l) => (l.publicado_em ? <Selo tom="destaque">{t("admin.comum.publicado")}</Selo> : <Selo>{t("admin.comum.rascunho")}</Selo>) },
                    { chave: "alt", titulo: t("admin.premiado.alteracao"), celula: (l) => (l.alteracao_em ? <Selo tom="alerta">{t("admin.premiado.pendente")}</Selo> : "—") },
                  ]}
                />
              )}
            </>
          )
        }}
      </Mostrar>
    </Pagina>
  )
}
