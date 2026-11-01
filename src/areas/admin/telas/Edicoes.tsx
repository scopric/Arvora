import { Link } from "react-router"
import { Selo } from "../../../componentes/Selo"
import { Tabela } from "../../../componentes/Tabela"
import { Vazio } from "../../../componentes/Vazio"
import { useCaminho, useT } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { Mostrar, Pagina } from "../componentes/Pagina"
import { exigir, useCarga } from "../lib/consulta"
import { EDITA, usePode } from "../lib/papel"
import { faseDe } from "../lib/regras"
import { classeAcao } from "../lib/estilo"

export function Edicoes() {
  const t = useT()
  const caminho = useCaminho()
  const pode = usePode(EDITA)
  const carga = useCarga(async () => exigir(await supabase.from("edicoes").select("id, nome, ano, pais, cidade, durante_inicio, durante_fim, publicada_em").order("ano", { ascending: false })), [])
  return (
    <Pagina titulo="admin.edicoes.titulo" intro="admin.edicoes.intro" acoes={pode ? <Link className={classeAcao} to={caminho("/admin/edicoes/nova")}>{t("admin.edicoes.nova")}</Link> : null}>
      <Mostrar carga={carga}>
        {(linhas) =>
          linhas.length === 0 ? (
            <Vazio>{t("admin.edicoes.vazio")}</Vazio>
          ) : (
            <Tabela
              legenda={t("admin.edicoes.titulo")} linhas={linhas} id={(l) => l.id}
              colunas={[
                { chave: "nome", titulo: t("admin.comum.nome"), celula: (l) => <Link className="underline" to={caminho(`/admin/edicoes/${l.id}`)}>{l.nome}</Link> },
                { chave: "ano", titulo: t("admin.edicoes.ano"), celula: (l) => l.ano },
                { chave: "local", titulo: t("admin.comum.cidade"), celula: (l) => `${l.cidade}, ${l.pais}` },
                { chave: "fase", titulo: t("admin.edicoes.fase"), celula: (l) => t(`admin.edicoes.fase.${faseDe(l)}`) },
                { chave: "pub", titulo: t("admin.comum.status"), celula: (l) => (l.publicada_em ? <Selo tom="destaque">{t("admin.comum.publicado")}</Selo> : <Selo>{t("admin.comum.rascunho")}</Selo>) },
              ]}
            />
          )
        }
      </Mostrar>
    </Pagina>
  )
}
