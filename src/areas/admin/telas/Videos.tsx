import { useT } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { CrudTabela } from "../componentes/CrudTabela"
import type { CampoDef } from "../componentes/FormularioRegistro"
import { Mostrar, Pagina, Secao } from "../componentes/Pagina"
import { exigir, exigirSemNulo, useCarga } from "../lib/consulta"
import { opcoesDe, useOpcoesNivel } from "../lib/opcoes"
import { EDITA, usePode } from "../lib/papel"

// Talks, Originals e cerimônias (videos) e as citações (videos_citados: vídeo ↔ premiado/empresa).
export function Videos() {
  const t = useT()
  const pode = usePode(EDITA)
  const niveis = useOpcoesNivel()
  const carga = useCarga(async () => {
    const [temas, edicoes, videos, premiados, empresas] = await Promise.all([
      supabase.from("temas").select("id, nome").order("ordem").order("nome"),
      supabase.from("edicoes").select("id, nome").order("ano", { ascending: false }),
      supabase.from("videos").select("id, titulo").order("titulo"),
      supabase.from("premiados").select("id, nome").order("nome"),
      supabase.from("empresas").select("id, nome").order("nome"),
    ])
    return { temas: exigir(temas), edicoes: exigir(edicoes), videos: exigir(videos), premiados: exigir(premiados), empresas: exigir(empresas) }
  }, [])

  return (
    <Pagina titulo="admin.videos.titulo" intro="admin.videos.intro">
      <Mostrar carga={carga}>
        {(o) => {
          const campos: CampoDef[] = [
            { chave: "titulo", rotulo: "admin.comum.titulo", tipo: "texto", obrigatorio: true, naTabela: true },
            {
              chave: "tipo", rotulo: "admin.comum.tipo", tipo: "selecao", obrigatorio: true, naTabela: true,
              opcoes: [{ valor: "talk", texto: t("admin.videos.tipo.talk") }, { valor: "original", texto: t("admin.videos.tipo.original") }, { valor: "cerimonia", texto: t("admin.videos.tipo.cerimonia") }],
            },
            { chave: "slug", rotulo: "admin.comum.slug", tipo: "texto", slugDe: "titulo", ajuda: "admin.comum.slugAjuda" },
            { chave: "tema_id", rotulo: "admin.videos.tema", tipo: "selecao", opcoes: opcoesDe(o.temas), naTabela: true },
            { chave: "edicao_id", rotulo: "admin.videos.edicao", tipo: "selecao", opcoes: opcoesDe(o.edicoes) },
            { chave: "video_id", rotulo: "admin.videos.videoId", tipo: "texto", obrigatorio: true, ajuda: "admin.videos.videoIdAjuda" },
            { chave: "trailer_video_id", rotulo: "admin.videos.trailer", tipo: "texto" },
            { chave: "duracao_min", rotulo: "admin.comum.duracaoMin", tipo: "numero" },
            { chave: "nivel_minimo", rotulo: "admin.comum.nivelMinimo", tipo: "selecao", obrigatorio: true, opcoes: niveis, naTabela: true },
            { chave: "descricao", rotulo: "admin.comum.descricao", tipo: "area" },
            { chave: "publicado_em", rotulo: "admin.comum.publicar", tipo: "publicado", naTabela: true },
          ]
          const citados: CampoDef[] = [
            { chave: "video_id", rotulo: "admin.videos.titulo", tipo: "selecao", obrigatorio: true, opcoes: opcoesDe(o.videos, "id", "titulo"), naTabela: true },
            { chave: "premiado_id", rotulo: "admin.videos.premiado", tipo: "selecao", opcoes: opcoesDe(o.premiados), naTabela: true },
            { chave: "empresa_id", rotulo: "admin.videos.empresa", tipo: "selecao", opcoes: opcoesDe(o.empresas), naTabela: true },
          ]
          return (
            <>
              <CrudTabela tabela="videos" colunas="id, tipo, titulo, slug, descricao, tema_id, edicao_id, trailer_video_id, duracao_min, nivel_minimo, publicado_em" campos={campos} aoEditar={async (l) => ({ ...l, video_id: exigirSemNulo(await supabase.rpc("video_do_video", { p_video: l.id as number })) })} ordem={[{ coluna: "criado_em", asc: false }]} podeEditar={pode} podeApagar legenda="admin.videos.titulo" vazio="admin.videos.vazio" />
              <Secao titulo="admin.videos.citados">
                <CrudTabela variante="secundario" tabela="videos_citados" colunas="id, video_id, premiado_id, empresa_id" campos={citados} ordem={[{ coluna: "id", asc: false }]} podeEditar={pode} podeApagar legenda="admin.videos.citados" vazio="admin.videos.citadosVazio" />
              </Secao>
            </>
          )
        }}
      </Mostrar>
    </Pagina>
  )
}
