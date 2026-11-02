import { useState } from "react"
import { useNavigate, useParams } from "react-router"
import { Abas } from "../../../componentes/Abas"
import { useCaminho, useT } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { ConsentimentoHof } from "../componentes/ConsentimentoHof"
import { CrudTabela } from "../componentes/CrudTabela"
import { FormularioRegistro, type CampoDef } from "../componentes/FormularioRegistro"
import { Mostrar, Pagina, Secao } from "../componentes/Pagina"
import { exigir, exigirLinha, useCarga } from "../lib/consulta"
import { opcoesDe } from "../lib/opcoes"
import { EDITA, usePode } from "../lib/papel"
import { faseDe } from "../lib/regras"

const COLUNAS = "id, slug, nome, ano, pais, cidade, descricao, durante_inicio, durante_fim, transmissao_url, gravacao_video_id, publicada_em"
const EDICAO: CampoDef[] = [
  { chave: "nome", rotulo: "admin.comum.nome", tipo: "texto", obrigatorio: true },
  { chave: "slug", rotulo: "admin.comum.slug", tipo: "texto", slugDe: "nome", ajuda: "admin.comum.slugAjuda" },
  { chave: "ano", rotulo: "admin.edicoes.ano", tipo: "numero", obrigatorio: true },
  { chave: "pais", rotulo: "admin.comum.pais", tipo: "texto", obrigatorio: true, ajuda: "admin.comum.paisAjuda" },
  { chave: "cidade", rotulo: "admin.comum.cidade", tipo: "texto", obrigatorio: true },
  { chave: "durante_inicio", rotulo: "admin.edicoes.inicio", tipo: "dataHora", obrigatorio: true },
  { chave: "durante_fim", rotulo: "admin.edicoes.fim", tipo: "dataHora", obrigatorio: true },
  { chave: "transmissao_url", rotulo: "admin.edicoes.transmissao", tipo: "url" },
  { chave: "gravacao_video_id", rotulo: "admin.edicoes.gravacao", tipo: "texto" },
  { chave: "descricao", rotulo: "admin.comum.descricao", tipo: "area" },
  { chave: "publicada_em", rotulo: "admin.comum.publicar", tipo: "publicado" },
]
const CATEGORIA: CampoDef[] = [
  { chave: "nome", rotulo: "admin.comum.nome", tipo: "texto", obrigatorio: true, naTabela: true },
  { chave: "slug", rotulo: "admin.comum.slug", tipo: "texto", slugDe: "nome", ajuda: "admin.comum.slugAjuda", naTabela: true },
  { chave: "ordem", rotulo: "admin.comum.ordem", tipo: "numero", naTabela: true },
]
const PATROCINADOR: CampoDef[] = [
  { chave: "nome", rotulo: "admin.comum.nome", tipo: "texto", obrigatorio: true, naTabela: true },
  { chave: "nivel", rotulo: "admin.edicao.nivelPatrocinio", tipo: "texto", naTabela: true },
  { chave: "ordem", rotulo: "admin.comum.ordem", tipo: "numero", naTabela: true },
  { chave: "site", rotulo: "admin.comum.site", tipo: "url" },
  { chave: "logo_path", rotulo: "admin.empresas.logo", tipo: "imagem", pasta: "patrocinadores" },
  { chave: "descricao", rotulo: "admin.comum.descricao", tipo: "area" },
]
const AGENDA: CampoDef[] = [
  { chave: "titulo", rotulo: "admin.comum.titulo", tipo: "texto", obrigatorio: true, naTabela: true },
  { chave: "inicio_em", rotulo: "admin.edicao.agendaInicio", tipo: "dataHora", obrigatorio: true, naTabela: true },
  { chave: "fim_em", rotulo: "admin.edicao.agendaFim", tipo: "dataHora" },
  { chave: "local", rotulo: "admin.edicao.local", tipo: "texto", naTabela: true },
  { chave: "descricao", rotulo: "admin.comum.descricao", tipo: "area" },
]

function Indicados({ edicaoId, pode }: { edicaoId: number; pode: boolean }) {
  const t = useT()
  const [versao, setVersao] = useState(0)
  const [ultimo, setUltimo] = useState<number | null>(null)
  const carga = useCarga(async () => {
    const [cats, emps] = await Promise.all([
      supabase.from("categorias_premio").select("id, nome").eq("edicao_id", edicaoId).order("ordem"),
      supabase.from("empresas").select("id, nome").order("nome"),
    ])
    return { cats: exigir(cats), emps: exigir(emps) }
  }, [edicaoId])
  return (
    <Mostrar carga={carga}>
      {({ cats, emps }) => {
        const campos: CampoDef[] = [
          { chave: "nome", rotulo: "admin.comum.nome", tipo: "texto", obrigatorio: true, naTabela: true },
          { chave: "categoria_id", rotulo: "admin.edicao.categoria", tipo: "selecao", obrigatorio: true, opcoes: opcoesDe(cats), naTabela: true },
          { chave: "empresa_id", rotulo: "admin.videos.empresa", tipo: "selecao", opcoes: opcoesDe(emps) },
          { chave: "foto_path", rotulo: "admin.premiado.foto", tipo: "imagem", pasta: "indicados" },
          { chave: "convite_email", rotulo: "admin.premiado.convite", tipo: "email", soEscrita: true, ajuda: "admin.edicao.conviteIndicadoAjuda" },
          { chave: "resumo", rotulo: "admin.edicao.resumo", tipo: "area" },
          { chave: "consentimento_id", rotulo: "admin.edicao.consentimentoId", tipo: "numero", ajuda: "admin.edicao.consentimentoIdAjuda", naTabela: true },
          { chave: "publicado_em", rotulo: "admin.comum.publicar", tipo: "publicado", naTabela: true },
        ]
        return (
          <div className="space-y-6">
            <ConsentimentoHof id={ultimo} aoRegistrar={async (id) => setUltimo(id)} aoMudar={() => setVersao((v) => v + 1)} />
            {ultimo ? <p className="text-legenda">{t("admin.edicao.useId")} <strong>{ultimo}</strong></p> : null}
            <CrudTabela
              variante="contorno"
              key={versao} tabela="indicados" colunas="id, edicao_id, categoria_id, nome, empresa_id, foto_path, resumo, consentimento_id, publicado_em" campos={campos} ordem={[{ coluna: "nome" }]}
              filtro={{ coluna: "edicao_id", valor: edicaoId }} fixos={{ edicao_id: edicaoId }} podeEditar={pode} podeApagar legenda="admin.edicao.indicados" vazio="admin.edicao.semIndicados"
            />
          </div>
        )
      }}
    </Mostrar>
  )
}

// Edição do Brazilian Awards (ADM-01): dados e fase, categorias, indicados, patrocinadores e agenda.
export function Edicao() {
  const t = useT()
  const caminho = useCaminho()
  const navegar = useNavigate()
  const { id } = useParams()
  const edicaoId = id ? Number(id) : null
  const pode = usePode(EDITA)
  const carga = useCarga(async () => (edicaoId === null ? null : exigir(await supabase.from("edicoes").select(COLUNAS).eq("id", edicaoId).maybeSingle())), [id])
  const filha = (tabela: string, colunas: string, campos: CampoDef[], legenda: "admin.edicao.categorias" | "admin.edicao.patrocinadores" | "admin.edicao.agenda", vazio: "admin.edicao.semCategorias" | "admin.edicao.semPatrocinadores" | "admin.edicao.semAgenda", ordem: string) => (
    <CrudTabela variante="contorno" tabela={tabela} colunas={colunas} campos={campos} ordem={[{ coluna: ordem }]} filtro={{ coluna: "edicao_id", valor: edicaoId! }} fixos={{ edicao_id: edicaoId }} podeEditar={pode} podeApagar legenda={legenda} vazio={vazio} />
  )
  return (
    <Pagina titulo={edicaoId === null ? "admin.edicaoNova.titulo" : "admin.edicao.titulo"} voltar={{ para: caminho("/admin/edicoes"), rotulo: t("admin.comum.voltar") }}>
      <Mostrar carga={carga}>
        {(ed) => (
          <>
            <Secao titulo="admin.edicao.dados">
              {ed ? <p className="mb-4 text-legenda text-nevoa">{t("admin.edicoes.fase")}: {t(`admin.edicoes.fase.${faseDe(ed)}`)}</p> : null}
              {pode ? (
                <FormularioRegistro
                  campos={EDICAO} linha={ed}
                  aoSalvar={async (c) => {
                    if (ed) exigirLinha(await supabase.from("edicoes").update(c as never).eq("id", ed.id).select("id"))
                    else {
                      const r = await supabase.from("edicoes").insert(c as never).select("id")
                      exigirLinha(r)
                      navegar(caminho(`/admin/edicoes/${r.data![0].id}`))
                    }
                  }}
                />
              ) : (
                <p>{ed?.nome}</p>
              )}
            </Secao>
            {ed ? (
              <Abas
                rotulo={t("admin.edicao.titulo")}
                abas={[
                  { chave: "cat", rotulo: t("admin.edicao.categorias"), conteudo: filha("categorias_premio", "id, edicao_id, nome, slug, ordem", CATEGORIA, "admin.edicao.categorias", "admin.edicao.semCategorias", "ordem") },
                  { chave: "ind", rotulo: t("admin.edicao.indicados"), conteudo: <Indicados edicaoId={ed.id} pode={pode} /> },
                  { chave: "pat", rotulo: t("admin.edicao.patrocinadores"), conteudo: filha("patrocinadores", "id, edicao_id, nome, nivel, ordem, site, logo_path, descricao", PATROCINADOR, "admin.edicao.patrocinadores", "admin.edicao.semPatrocinadores", "ordem") },
                  { chave: "age", rotulo: t("admin.edicao.agenda"), conteudo: filha("agenda_evento", "id, edicao_id, titulo, inicio_em, fim_em, local, descricao", AGENDA, "admin.edicao.agenda", "admin.edicao.semAgenda", "inicio_em") },
                ]}
              />
            ) : null}
          </>
        )}
      </Mostrar>
    </Pagina>
  )
}
