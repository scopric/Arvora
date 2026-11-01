import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { Botao } from "../../../componentes/Botao"
import { DialogoConfirmar } from "../../../componentes/DialogoConfirmar"
import { Cartao } from "../../../componentes/Cartao"
import { Selo } from "../../../componentes/Selo"
import { useCaminho, useIdioma, useT } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { CrudTabela } from "../componentes/CrudTabela"
import { FormularioRegistro, type CampoDef } from "../componentes/FormularioRegistro"
import { MateriaisAula, type Material } from "../componentes/MateriaisAula"
import { AvisoDe, Mostrar, Pagina, Secao } from "../componentes/Pagina"
import { exigir, exigirLinha, exigirSemNulo, useAcao, useCarga } from "../lib/consulta"
import { FUSO, dataHora } from "../lib/formato"
import { opcoesDe, useOpcoesNivel } from "../lib/opcoes"
import { EDITA, usePode } from "../lib/papel"
import { estadoAula } from "../lib/regras"

const COLUNAS = "id, modulo_id, vertical_id, tipo, titulo, slug, descricao, nivel_minimo, ordem, inicio_em, duracao_min, trailer_video_id, agendada_em, materiais_publicados_em"
const EXERCICIO: CampoDef[] = [
  { chave: "ordem", rotulo: "admin.comum.ordem", tipo: "numero", obrigatorio: true, naTabela: true },
  { chave: "enunciado_md", rotulo: "admin.aula.enunciado", tipo: "area", obrigatorio: true, naTabela: true },
  { chave: "prazo_dias", rotulo: "admin.aula.prazoDias", tipo: "numero", naTabela: true },
  { chave: "aceita_arquivo", rotulo: "admin.aula.aceitaArquivo", tipo: "checkbox", naTabela: true },
]
const TRANSMISSAO: CampoDef[] = [
  { chave: "url", rotulo: "admin.aula.urlPrincipal", tipo: "url", obrigatorio: true },
  { chave: "url_reserva", rotulo: "admin.aula.urlReserva", tipo: "url" },
  { chave: "usar_reserva", rotulo: "admin.aula.usarReserva", tipo: "checkbox", ajuda: "admin.aula.usarReservaAjuda" },
  { chave: "abre_min_antes", rotulo: "admin.aula.abreMinAntes", tipo: "numero", obrigatorio: true },
]

// Cadastro e publicação de aula (PRD §17.4.5): dados, transmissão principal/reserva, materiais, exercícios, Agendar e Publicar materiais.
export function AulaForm() {
  const t = useT()
  const lang = useIdioma()
  const caminho = useCaminho()
  const navegar = useNavigate()
  const { id } = useParams()
  const aulaId = id ? Number(id) : null
  const pode = usePode(EDITA)
  const niveis = useOpcoesNivel()
  const acao = useAcao()
  const [confirmar, setConfirmar] = useState(false)

  const carga = useCarga(async () => {
    const [verticais, modulos, cursos] = await Promise.all([
      supabase.from("verticais").select("id, nome").order("ordem"),
      supabase.from("modulos").select("id, titulo, curso_id").order("ordem"),
      supabase.from("cursos").select("id, titulo"),
    ])
    const base = { verticais: exigir(verticais), modulos: exigir(modulos), cursos: exigir(cursos) }
    if (aulaId === null) return { ...base, aula: null, transmissao: null, materiais: [] as Material[] }
    const [aula, transmissao, materiais] = await Promise.all([
      supabase.from("aulas").select(COLUNAS).eq("id", aulaId).maybeSingle(),
      supabase.from("transmissoes").select("aula_id, url, url_reserva, usar_reserva, abre_min_antes").eq("aula_id", aulaId).maybeSingle(),
      supabase.from("materiais_aula").select("id, tipo, conteudo_md, arquivo_path, status").eq("aula_id", aulaId),
    ])
    if (transmissao.error) throw transmissao.error
    const a = exigir(aula)
    // video_id não sai por select: a equipe lê pela RPC (e grava normalmente).
    const video = exigirSemNulo(await supabase.rpc("video_da_aula", { p_aula: aulaId }))
    return { ...base, aula: { ...a, video_id: video }, transmissao: transmissao.data, materiais: exigir(materiais) as Material[] }
  }, [id])

  return (
    <Pagina titulo={aulaId === null ? "admin.aulasNova.titulo" : "admin.aula.titulo"} acoes={<Link className="underline" to={caminho("/admin/aulas")}>{t("admin.comum.voltar")}</Link>}>
      <Mostrar carga={carga}>
        {(d) => {
          const nomeCurso = new Map(d.cursos.map((c) => [c.id, c.titulo]))
          const campos: CampoDef[] = [
            { chave: "titulo", rotulo: "admin.comum.titulo", tipo: "texto", obrigatorio: true },
            { chave: "slug", rotulo: "admin.comum.slug", tipo: "texto", slugDe: "titulo", ajuda: "admin.comum.slugAjuda" },
            { chave: "tipo", rotulo: "admin.comum.tipo", tipo: "selecao", obrigatorio: true, opcoes: [{ valor: "gravada", texto: t("admin.aulas.tipo.gravada") }, { valor: "ao_vivo", texto: t("admin.aulas.tipo.ao_vivo") }] },
            { chave: "vertical_id", rotulo: "admin.comum.vertical", tipo: "selecao", obrigatorio: true, opcoes: opcoesDe(d.verticais) },
            { chave: "modulo_id", rotulo: "admin.aula.modulo", tipo: "selecao", opcoes: d.modulos.map((m) => ({ valor: String(m.id), texto: `${nomeCurso.get(m.curso_id) ?? "?"} · ${m.titulo}` })) },
            { chave: "nivel_minimo", rotulo: "admin.comum.nivelMinimo", tipo: "selecao", obrigatorio: true, opcoes: niveis },
            { chave: "inicio_em", rotulo: "admin.aulas.inicio", tipo: "dataHora", ajuda: "admin.aula.inicioAjuda" },
            { chave: "duracao_min", rotulo: "admin.comum.duracaoMin", tipo: "numero" },
            { chave: "ordem", rotulo: "admin.comum.ordem", tipo: "numero" },
            { chave: "video_id", rotulo: "admin.aula.gravacao", tipo: "texto", ajuda: "admin.videos.videoIdAjuda" },
            { chave: "trailer_video_id", rotulo: "admin.videos.trailer", tipo: "texto" },
            { chave: "descricao", rotulo: "admin.comum.descricao", tipo: "area" },
          ]
          async function salvarAula(valores: Record<string, unknown>) {
            if (d.aula) exigirLinha(await supabase.from("aulas").update(valores as never).eq("id", d.aula.id).select("id"))
            else {
              const r = await supabase.from("aulas").insert({ ordem: 0, ...valores } as never).select("id")
              exigirLinha(r)
              navegar(caminho(`/admin/aulas/${r.data![0].id}`))
              return
            }
            carga.recarregar()
          }
          const aula = d.aula
          const estado = aula ? estadoAula(aula) : "rascunho"
          const pendentes = d.materiais.some((m) => m.status === "rascunho")
          const falta = !aula ? null : aula.tipo === "ao_vivo" && !aula.inicio_em ? "admin.aula.faltaInicio" : !aula.duracao_min ? "admin.aula.faltaDuracao" : pendentes ? "admin.aula.faltaAprovar" : null

          return (
            <div className="grid gap-8 xl:grid-cols-[1fr_20rem]">
              <div className="space-y-8">
                <Secao titulo="admin.aula.dados">
                  {pode ? <FormularioRegistro campos={campos} linha={aula} aoSalvar={salvarAula} /> : <p>{aula?.titulo}</p>}
                </Secao>
                {aula ? (
                  <>
                    {aula.tipo === "ao_vivo" && pode ? (
                      <Secao titulo="admin.aula.transmissao">
                        <FormularioRegistro
                          campos={TRANSMISSAO} linha={d.transmissao ?? { abre_min_antes: 15 }}
                          aoSalvar={async (c) => {
                            if (d.transmissao) exigirLinha(await supabase.from("transmissoes").update(c as never).eq("aula_id", aula.id).select("aula_id"))
                            else exigirLinha(await supabase.from("transmissoes").insert({ ...c, aula_id: aula.id } as never).select("aula_id"))
                            carga.recarregar() // sem isto, o próximo "Salvar" tentaria inserir de novo e bateria na chave única
                          }}
                        />
                      </Secao>
                    ) : null}
                    <Secao titulo="admin.aula.materiais">
                      {pode ? <MateriaisAula aulaId={aula.id} materiais={d.materiais} aoMudar={carga.recarregar} /> : null}
                    </Secao>
                    <Secao titulo="admin.aula.exercicios">
                      <CrudTabela
                        tabela="exercicios" colunas="id, aula_id, ordem, enunciado_md, prazo_dias, aceita_arquivo" campos={EXERCICIO} ordem={[{ coluna: "ordem" }]}
                        filtro={{ coluna: "aula_id", valor: aula.id }} fixos={{ aula_id: aula.id }} podeEditar={pode} podeApagar legenda="admin.aula.exercicios" vazio="admin.aula.semExercicios"
                      />
                    </Secao>
                  </>
                ) : null}
              </div>
              {aula ? (
                <aside className="space-y-4">
                  <Cartao>
                    <h2 className="text-corpo-g font-semibold">{t("admin.aula.previa")}</h2>
                    <p className="mt-3 text-lg font-semibold">{aula.titulo}</p>
                    <p className="mt-1 text-sm opacity-75">
                      {t(`admin.aulas.tipo.${aula.tipo}`)} · {t(`nivel.${aula.nivel_minimo}`)}
                      {aula.duracao_min ? ` · ${aula.duracao_min} min` : ""}
                    </p>
                    <p className="mt-1 text-sm opacity-75">{dataHora(aula.inicio_em, lang)} ({FUSO}) · {dataHora(aula.inicio_em, lang, "America/Sao_Paulo")} (Brasília)</p>
                    <div className="mt-3"><Selo tom={estado === "publicados" ? "destaque" : "neutro"}>{t(`admin.aulas.estado.${estado}`)}</Selo></div>
                    <ul className="mt-3 text-sm">
                      {(["resumo", "ebook", "exercicios"] as const).map((m) => {
                        const x = d.materiais.find((y) => y.tipo === m)
                        return <li key={m}>{t(`admin.aula.material.${m}`)}: {x ? t(`admin.aula.materialStatus.${x.status}`) : t("admin.aula.materialStatus.vazio")}</li>
                      })}
                    </ul>
                  </Cartao>
                  {pode ? (
                    <div className="space-y-3">
                      <AvisoDe aviso={acao.aviso} />
                      <Botao
                        type="button" variante="contorno" ocupado={acao.ocupado} disabled={estado !== "rascunho" || (aula.tipo === "ao_vivo" && !aula.inicio_em)}
                        onClick={() => void acao.rodar(async () => { exigirLinha(await supabase.from("aulas").update({ agendada_em: new Date().toISOString() }).eq("id", aula.id).select("id")); carga.recarregar() }, "admin.aula.agendada")}
                      >
                        {t("admin.aula.agendar")}
                      </Botao>
                      <Botao type="button" ocupado={acao.ocupado} disabled={estado === "publicados" || falta !== null} onClick={() => setConfirmar(true)}>{t("admin.aula.publicarMateriais")}</Botao>
                      {falta ? <p className="text-sm opacity-75">{t(falta)}</p> : null}
                    </div>
                  ) : null}
                </aside>
              ) : null}
              <DialogoConfirmar
                aberto={confirmar} titulo={t("admin.aula.publicarTitulo")} texto={t("admin.aula.publicarTexto")} confirmar={t("admin.aula.publicarMateriais")}
                aoCancelar={() => setConfirmar(false)}
                aoConfirmar={() => {
                  setConfirmar(false)
                  if (!aula) return
                  void acao.rodar(async () => { exigirLinha(await supabase.from("aulas").update({ materiais_publicados_em: new Date().toISOString() }).eq("id", aula.id).select("id")); carga.recarregar() }, "admin.aula.publicada")
                }}
              />
            </div>
          )
        }}
      </Mostrar>
    </Pagina>
  )
}
