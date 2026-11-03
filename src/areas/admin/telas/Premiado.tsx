import { useNavigate, useParams } from "react-router"
import { Botao } from "../../../componentes/Botao"
import { Cartao } from "../../../componentes/Cartao"
import { useCaminho, useT } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { ConsentimentoHof } from "../componentes/ConsentimentoHof"
import { FormularioRegistro, type CampoDef } from "../componentes/FormularioRegistro"
import { AvisoDe, Mostrar, Pagina, Secao } from "../componentes/Pagina"
import { exigir, exigirLinha, exigirSemDados, useAcao, useCarga } from "../lib/consulta"
import { opcoesDe } from "../lib/opcoes"
import { EDITA, usePode } from "../lib/papel"
import { camposParaRedes, redesParaCampos, type Json } from "../lib/regras"

const COLUNAS = "id, edicao_id, categoria_id, empresa_id, perfil_id, nome, slug, foto_path, historia, video_entrevista_id, video_premiacao_id, materia_url, redes, consentimento_id, alteracao_em, publicado_em"
// Premiado (HOF-01/04/05): dados, convite por e-mail, consentimento com data e versão, publicação (o banco barra sem consentimento
// vigente) e aprovação da alteração pedida pelo próprio premiado.
export function Premiado() {
  const t = useT()
  const caminho = useCaminho()
  const navegar = useNavigate()
  const { id } = useParams()
  const premiadoId = id && id !== "novo" ? Number(id) : null
  const pode = usePode(EDITA)
  const acao = useAcao()
  const carga = useCarga(async () => {
    const [edicoes, cats, emps] = await Promise.all([
      supabase.from("edicoes").select("id, nome").order("ano", { ascending: false }),
      supabase.from("categorias_premio").select("id, nome, edicao_id").order("ordem"),
      supabase.from("empresas").select("id, nome").order("nome"),
    ])
    const base = { edicoes: exigir(edicoes), cats: exigir(cats), emps: exigir(emps) }
    if (premiadoId === null) return { ...base, p: null, privado: null, vinculo: null }
    const p = exigir(await supabase.from("premiados").select(COLUNAS).eq("id", premiadoId).maybeSingle())
    const priv = exigir(await supabase.rpc("premiado_privado", { premiado: premiadoId })) as { convite_email: string | null; alteracao_pendente: Json | null }
    const vinc = p.perfil_id ? (await supabase.from("perfis").select("nome").eq("id", p.perfil_id).maybeSingle()).data : null
    return { ...base, p, privado: priv, vinculo: vinc?.nome ?? null }
  }, [id])

  return (
    <Pagina titulo={premiadoId === null ? "admin.premiadoNovo.titulo" : "admin.premiado.titulo"} voltar={{ para: caminho("/admin/premiados"), rotulo: t("admin.comum.voltar") }}>
      <Mostrar carga={carga}>
        {(d) => {
          const nomeEdicao = new Map(d.edicoes.map((e) => [e.id, e.nome]))
          const campos: CampoDef[] = [
            { chave: "edicao_id", rotulo: "admin.videos.edicao", tipo: "selecao", obrigatorio: true, opcoes: opcoesDe(d.edicoes) },
            { chave: "categoria_id", rotulo: "admin.edicao.categoria", tipo: "selecao", obrigatorio: true, opcoes: d.cats.map((c) => ({ valor: String(c.id), texto: `${nomeEdicao.get(c.edicao_id) ?? "?"} · ${c.nome}` })) },
            { chave: "nome", rotulo: "admin.comum.nome", tipo: "texto", obrigatorio: true },
            { chave: "slug", rotulo: "admin.comum.slug", tipo: "texto", slugDe: "nome", ajuda: "admin.comum.slugAjuda" },
            { chave: "empresa_id", rotulo: "admin.videos.empresa", tipo: "selecao", opcoes: opcoesDe(d.emps) },
            { chave: "foto_path", rotulo: "admin.premiado.foto", tipo: "imagem", pasta: "premiados" },
            { chave: "video_entrevista_id", rotulo: "admin.premiado.videoEntrevista", tipo: "texto" },
            { chave: "video_premiacao_id", rotulo: "admin.premiado.videoPremiacao", tipo: "texto" },
            { chave: "materia_url", rotulo: "admin.premiado.materia", tipo: "url" },
            { chave: "redes_instagram", rotulo: "admin.premiado.instagram", tipo: "texto" },
            { chave: "redes_linkedin", rotulo: "admin.premiado.linkedin", tipo: "url" },
            { chave: "redes_site", rotulo: "admin.comum.site", tipo: "url" },
            { chave: "convite_email", rotulo: "admin.premiado.convite", tipo: "email", ajuda: "admin.premiado.conviteAjuda" },
            { chave: "historia", rotulo: "admin.premiado.historia", tipo: "area" },
            { chave: "publicado_em", rotulo: "admin.comum.publicar", tipo: "publicado", ajuda: "admin.premiado.publicarAjuda" },
          ]
          const linha = d.p ? { ...d.p, ...redesParaCampos(d.p.redes), convite_email: d.privado?.convite_email ?? null } : null
          const pend = d.privado?.alteracao_pendente ?? null
          const decidir = (aprovar: boolean) =>
            acao.rodar(async () => {
              exigirSemDados(await supabase.rpc("aprovar_alteracao_premiado", { premiado: d.p!.id, aprovar }))
              carga.recarregar()
            }, aprovar ? "admin.premiado.alteracaoAprovada" : "admin.premiado.alteracaoRecusada")
          return (
            <>
              {pend && d.p ? (
                <Secao titulo="admin.premiado.alteracaoPedida">
                  <Cartao>
                    <dl className="space-y-3">
                      {Object.entries(pend).map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-corpo-p font-semibold text-creme">{k}</dt>
                          <dd className="text-corpo whitespace-pre-wrap"><span className="text-cinza">{t("admin.premiado.atual")}: </span>{String((d.p as unknown as Json)[k] === undefined ? "" : typeof (d.p as unknown as Json)[k] === "object" ? JSON.stringify((d.p as unknown as Json)[k]) : (d.p as unknown as Json)[k])}</dd>
                          <dd className="text-corpo whitespace-pre-wrap"><span className="text-cinza">{t("admin.premiado.proposto")}: </span>{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
                        </div>
                      ))}
                    </dl>
                    <AvisoDe aviso={acao.aviso} />
                    {pode ? (
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Botao type="button" variante="secundario" ocupado={acao.ocupado} onClick={() => void decidir(true)} className="sm:w-auto">{t("admin.premiado.aprovar")}</Botao>
                        <Botao type="button" variante="contorno" disabled={acao.ocupado} onClick={() => void decidir(false)} className="sm:w-auto">{t("admin.premiado.recusar")}</Botao>
                      </div>
                    ) : null}
                  </Cartao>
                </Secao>
              ) : null}
              <Secao titulo="admin.premiado.dados">
                {d.vinculo ? <p className="mb-4 text-corpo-p">{t("admin.premiado.vinculado")}: {d.vinculo}</p> : d.p ? <p className="mb-4 text-corpo-p text-cinza">{t("admin.premiado.semVinculo")}</p> : null}
                {pode ? (
                  <FormularioRegistro
                    campos={campos} linha={linha}
                    aoSalvar={async (c) => {
                      const { redes_instagram: _a, redes_linkedin: _b, redes_site: _c, ...resto } = c
                      const carga2 = { ...resto, redes: camposParaRedes(c, d.p?.redes) }
                      if (d.p) exigirLinha(await supabase.from("premiados").update(carga2 as never).eq("id", d.p.id).select("id"))
                      else {
                        const r = await supabase.from("premiados").insert(carga2 as never).select("id")
                        exigirLinha(r)
                        navegar(caminho(`/admin/premiados/${r.data![0].id}`))
                      }
                    }}
                  />
                ) : null}
              </Secao>
              {d.p ? (
                <Secao titulo="admin.premiado.consentimento">
                  <ConsentimentoHof
                    id={d.p.consentimento_id} emailInicial={d.privado?.convite_email ?? ""} nomeInicial={d.p.nome}
                    aoRegistrar={async (cid) => { exigirLinha(await supabase.from("premiados").update({ consentimento_id: cid }).eq("id", d.p!.id).select("id")); carga.recarregar() }}
                    aoMudar={carga.recarregar}
                  />
                </Secao>
              ) : null}
            </>
          )
        }}
      </Mostrar>
    </Pagina>
  )
}
