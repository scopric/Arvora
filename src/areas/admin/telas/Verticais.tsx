import { Selo } from "../../../componentes/Selo"
import { Tabela } from "../../../componentes/Tabela"
import { Vazio } from "../../../componentes/Vazio"
import { useT } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { Mostrar, Pagina } from "../componentes/Pagina"
import { exigir, useCarga } from "../lib/consulta"

// Só leitura no MVP (ADM-05 é P1: vertical nova entra direto no banco).
export function Verticais() {
  const t = useT()
  const carga = useCarga(
    async () => exigir(await supabase.from("verticais").select("id, slug, nome, nome_en, ordem, ativa, conta_como_ia, aceita_entregas").order("ordem").order("nome")),
    [],
  )
  const sim = (b: boolean) => (b ? <Selo tom="destaque">{t("admin.comum.sim")}</Selo> : <Selo>{t("admin.comum.nao")}</Selo>)
  return (
    <Pagina titulo="admin.verticais.titulo" intro="admin.verticais.intro">
      <Mostrar carga={carga}>
        {(linhas) =>
          linhas.length === 0 ? (
            <Vazio>{t("admin.verticais.vazio")}</Vazio>
          ) : (
            <Tabela
              legenda={t("admin.verticais.titulo")}
              linhas={linhas}
              id={(l) => l.id}
              colunas={[
                { chave: "nome", titulo: t("admin.comum.nome"), celula: (l) => l.nome },
                { chave: "slug", titulo: t("admin.comum.slug"), celula: (l) => l.slug },
                { chave: "ativa", titulo: t("admin.verticais.ativa"), celula: (l) => sim(l.ativa) },
                { chave: "ia", titulo: t("admin.verticais.ia"), celula: (l) => sim(l.conta_como_ia) },
                { chave: "entregas", titulo: t("admin.verticais.entregas"), celula: (l) => sim(l.aceita_entregas) },
              ]}
            />
          )
        }
      </Mostrar>
    </Pagina>
  )
}
