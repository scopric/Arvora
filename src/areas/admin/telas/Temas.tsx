import { CrudTabela } from "../componentes/CrudTabela"
import type { CampoDef } from "../componentes/FormularioRegistro"
import { Pagina } from "../componentes/Pagina"
import { EDITA, usePode } from "../lib/papel"

const CAMPOS: CampoDef[] = [
  { chave: "nome", rotulo: "admin.comum.nome", tipo: "texto", obrigatorio: true, naTabela: true },
  { chave: "nome_en", rotulo: "admin.comum.nomeEn", tipo: "texto", naTabela: true },
  { chave: "slug", rotulo: "admin.comum.slug", tipo: "texto", slugDe: "nome", ajuda: "admin.comum.slugAjuda", naTabela: true },
  { chave: "ordem", rotulo: "admin.comum.ordem", tipo: "numero", naTabela: true },
]

export function Temas() {
  const pode = usePode(EDITA)
  return (
    <Pagina titulo="admin.temas.titulo" intro="admin.temas.intro">
      <CrudTabela tabela="temas" colunas="id, nome, nome_en, slug, ordem" campos={CAMPOS} ordem={[{ coluna: "ordem" }, { coluna: "nome" }]} podeEditar={pode} podeApagar legenda="admin.temas.titulo" vazio="admin.temas.vazio" />
    </Pagina>
  )
}
