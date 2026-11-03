import { useState } from "react"
import { Link } from "react-router"
import { Selecao } from "../../../componentes/Campo"
import { Selo } from "../../../componentes/Selo"
import { Tabela } from "../../../componentes/Tabela"
import { Vazio } from "../../../componentes/Vazio"
import { useCaminho, useIdioma, useT } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { Barra, Mostrar, Pagina } from "../componentes/Pagina"
import { exigir, useCarga } from "../lib/consulta"
import { botaoPrimarioApp } from "../../../componentes/botaoEstilo"
import { classeLink, contagem } from "../lib/estilo"
import { dataHora } from "../lib/formato"
import { EDITA, usePode } from "../lib/papel"
import { estadoAula } from "../lib/regras"

const LIMITE = 300

export function Aulas() {
  const t = useT()
  const lang = useIdioma()
  const caminho = useCaminho()
  const pode = usePode(EDITA)
  const [filtro, setFiltro] = useState("")
  const carga = useCarga(async () => {
    const [aulas, verticais] = await Promise.all([
      supabase.from("aulas").select("id, titulo, tipo, vertical_id, nivel_minimo, inicio_em, agendada_em, materiais_publicados_em").order("criado_em", { ascending: false }).limit(LIMITE + 1),
      supabase.from("verticais").select("id, nome"),
    ])
    // Busca LIMITE+1 só para saber se há mais; mostra LIMITE.
    const todas = exigir(aulas)
    return { aulas: todas.slice(0, LIMITE), haMais: todas.length > LIMITE, verticais: exigir(verticais) }
  }, [])
  return (
    <Pagina titulo="admin.aulas.titulo" intro="admin.aulas.intro">
      {/* A barra fica fora do Mostrar: "Nova aula" continua à vista enquanto a lista carrega ou falha. */}
      <Barra acoes={pode ? <Link className={botaoPrimarioApp} to={caminho("/admin/aulas/nova")}>{t("admin.aulas.nova")}</Link> : null}>
        <div className="w-56">
          <Selecao rotulo={t("admin.aulas.filtroEstado")} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">{t("admin.comum.todos")}</option>
            {(["rascunho", "agendada", "publicados"] as const).map((e) => <option key={e} value={e}>{t(`admin.aulas.estado.${e}`)}</option>)}
          </Selecao>
        </div>
      </Barra>
      <Mostrar carga={carga}>
        {({ aulas, haMais, verticais }) => {
          const nomeVertical = new Map(verticais.map((v) => [v.id, v.nome]))
          const linhas = aulas.filter((a) => !filtro || estadoAula(a) === filtro)
          return linhas.length === 0 ? (
            <Vazio>{t("admin.aulas.vazio")}</Vazio>
          ) : (
            <Tabela
              legenda={t("admin.aulas.titulo")} linhas={linhas} id={(l) => l.id}
              contagem={contagem(linhas.length, haMais, t)}
              colunas={[
                { chave: "titulo", titulo: t("admin.comum.titulo"), celula: (l) => <Link className={classeLink} to={caminho(`/admin/aulas/${l.id}`)}>{l.titulo}</Link> },
                { chave: "tipo", titulo: t("admin.comum.tipo"), celula: (l) => t(`admin.aulas.tipo.${l.tipo}`) },
                { chave: "vertical", titulo: t("admin.comum.vertical"), celula: (l) => nomeVertical.get(l.vertical_id) ?? "—" },
                { chave: "nivel", titulo: t("admin.comum.nivelMinimo"), celula: (l) => t(`nivel.${l.nivel_minimo}`) },
                { chave: "inicio", titulo: t("admin.aulas.inicio"), celula: (l) => dataHora(l.inicio_em, lang) },
                { chave: "estado", titulo: t("admin.comum.status"), celula: (l) => <Selo tom={estadoAula(l) === "publicados" ? "destaque" : "neutro"}>{t(`admin.aulas.estado.${estadoAula(l)}`)}</Selo> },
              ]}
            />
          )
        }}
      </Mostrar>
    </Pagina>
  )
}
