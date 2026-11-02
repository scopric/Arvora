import { Link } from "react-router"
import { useCaminho, useT } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { CrudTabela } from "../componentes/CrudTabela"
import { Mostrar, Pagina } from "../componentes/Pagina"
import { exigir, useCarga } from "../lib/consulta"
import { useOpcoesNivel } from "../lib/opcoes"
import { EDITA, usePode } from "../lib/papel"
import { COLUNAS_CURSO, camposCurso } from "../lib/camposCurso"
import { classeLink } from "../lib/estilo"

export function Cursos() {
  const t = useT()
  const caminho = useCaminho()
  const pode = usePode(EDITA)
  const niveis = useOpcoesNivel()
  const carga = useCarga(async () => exigir(await supabase.from("verticais").select("id, nome").order("ordem")), [])
  return (
    <Pagina titulo="admin.cursos.titulo" intro="admin.cursos.intro">
      <Mostrar carga={carga}>
        {(verticais) => (
          <CrudTabela
            tabela="cursos" colunas={COLUNAS_CURSO} campos={camposCurso(verticais, niveis)} ordem={[{ coluna: "ordem" }, { coluna: "titulo" }]}
            podeEditar={pode} podeApagar legenda="admin.cursos.titulo" vazio="admin.cursos.vazio"
            extra={{ titulo: "admin.cursos.estrutura", celula: (l) => <Link className={classeLink} to={caminho(`/admin/cursos/${l.id}`)}>{t("admin.cursos.abrir")}</Link> }}
          />
        )}
      </Mostrar>
    </Pagina>
  )
}
