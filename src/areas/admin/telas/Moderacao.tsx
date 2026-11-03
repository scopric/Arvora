import { useState } from "react"
import { Cartao } from "../../../componentes/Cartao"
import { DialogoConfirmar } from "../../../componentes/DialogoConfirmar"
import { Selo } from "../../../componentes/Selo"
import { Vazio } from "../../../componentes/Vazio"
import { Abas } from "../../../componentes/Abas"
import { useIdioma, useT, type Chave } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { AvisoDe, Mostrar, Pagina, SemPermissao } from "../componentes/Pagina"
import { exigir, exigirSemDados, useAcao, useCarga } from "../lib/consulta"
import { dataHora } from "../lib/formato"
import { MODERA, usePode } from "../lib/papel"
import { classeAcao } from "../lib/estilo"

type Denuncia = { id: number; motivo: string; texto: string | null; criado_em: string; perfil_denunciado_id: string | null; post_id: number | null; comentario_id: number | null; empresa_id: number | null; conexao_id: number | null }
type Pergunta = { texto: Chave; aoConfirmar: () => void } | null

function Denuncias({ pergunta }: { pergunta: (p: Pergunta) => void }) {
  const t = useT()
  const lang = useIdioma()
  const acao = useAcao()
  const carga = useCarga(async () => {
    const den = exigir(await supabase.from("denuncias").select("id, motivo, texto, criado_em, perfil_denunciado_id, post_id, comentario_id, empresa_id, conexao_id").eq("status", "aberta").order("criado_em").limit(100)) as Denuncia[]
    const ids = (c: (d: Denuncia) => number | null) => [...new Set(den.map(c).filter((x): x is number => x !== null))]
    const [posts, coments, empresas] = await Promise.all([
      ids((d) => d.post_id).length ? supabase.from("posts").select("id, corpo, autor_id, oculto_em").in("id", ids((d) => d.post_id)) : Promise.resolve({ data: [], error: null }),
      ids((d) => d.comentario_id).length ? supabase.from("comentarios").select("id, corpo, autor_id, oculto_em").in("id", ids((d) => d.comentario_id)) : Promise.resolve({ data: [], error: null }),
      ids((d) => d.empresa_id).length ? supabase.from("empresas").select("id, nome").in("id", ids((d) => d.empresa_id)) : Promise.resolve({ data: [], error: null }),
    ])
    return { den, posts: new Map(exigir(posts).map((x) => [x.id, x])), coments: new Map(exigir(coments).map((x) => [x.id, x])), empresas: new Map(exigir(empresas).map((x) => [x.id, x.nome])) }
  }, [])
  const rpc = (fn: () => Promise<{ error: unknown }>, ok: Chave) => acao.rodar(async () => { exigirSemDados(await fn()); carga.recarregar() }, ok)
  return (
    <div className="space-y-4">
      <AvisoDe aviso={acao.aviso} />
      <Mostrar carga={carga}>
        {(d) =>
          d.den.length === 0 ? (
            <Vazio>{t("admin.vazio.nada")}</Vazio>
          ) : (
            <ul className="space-y-4">
              {d.den.map((x) => {
                const post = x.post_id ? d.posts.get(x.post_id) : undefined
                const com = x.comentario_id ? d.coments.get(x.comentario_id) : undefined
                const autor = post?.autor_id ?? com?.autor_id ?? x.perfil_denunciado_id
                return (
                  <li key={x.id}>
                    <Cartao>
                      <div className="flex flex-wrap items-center gap-3">
                        <Selo tom="alerta">{x.post_id ? t("admin.moderacao.alvo.post") : x.comentario_id ? t("admin.moderacao.alvo.comentario") : x.empresa_id ? t("admin.moderacao.alvo.empresa") : x.conexao_id ? t("admin.moderacao.alvo.conexao") : t("admin.moderacao.alvo.perfil")}</Selo>
                        <span className="text-corpo-p text-nevoa">{dataHora(x.criado_em, lang)}</span>
                      </div>
                      <p className="mt-3 font-semibold">{x.motivo}</p>
                      {x.texto ? <p className="mt-1 text-base">{x.texto}</p> : null}
                      {post || com ? <blockquote className="mt-3 border-l-2 border-fumaca pl-3 text-base text-cinza whitespace-pre-wrap">{(post ?? com)?.corpo}</blockquote> : null}
                      {x.empresa_id ? <p className="mt-3 text-base">{d.empresas.get(x.empresa_id) ?? "—"}</p> : null}
                      <div className="mt-4 flex flex-wrap gap-3">
                        {post || com ? (
                          <button type="button" className={classeAcao} disabled={acao.ocupado} onClick={() => pergunta({ texto: "admin.moderacao.ocultarTexto", aoConfirmar: () => void rpc(async () => supabase.rpc("moderar_conteudo", { alvo: post ? "post" : "comentario", alvo_id: (post?.id ?? com!.id) as number, ocultar: true }), "admin.moderacao.ocultado") })}>{t("admin.moderacao.ocultar")}</button>
                        ) : null}
                        {autor ? (
                          <button type="button" className={classeAcao} disabled={acao.ocupado} onClick={() => pergunta({ texto: "admin.moderacao.suspenderTexto", aoConfirmar: () => void rpc(async () => supabase.rpc("suspender_perfil", { perfil: autor, suspender: true }), "admin.moderacao.suspenso") })}>{t("admin.moderacao.suspender")}</button>
                        ) : null}
                        <button type="button" className={classeAcao} disabled={acao.ocupado} onClick={() => void rpc(async () => supabase.rpc("resolver_denuncia", { denuncia: x.id, procedente: true }), "admin.moderacao.resolvida")}>{t("admin.moderacao.procedente")}</button>
                        <button type="button" className={classeAcao} disabled={acao.ocupado} onClick={() => void rpc(async () => supabase.rpc("resolver_denuncia", { denuncia: x.id, procedente: false }), "admin.moderacao.resolvida")}>{t("admin.moderacao.improcedente")}</button>
                      </div>
                    </Cartao>
                  </li>
                )
              })}
            </ul>
          )
        }
      </Mostrar>
    </div>
  )
}

function PerfisPublicos() {
  const t = useT()
  const acao = useAcao()
  const carga = useCarga(async () => exigir(await supabase.from("perfis").select("id, nome, empresa_nome, cidade, bio, atualizado_em").eq("visibilidade", "publico").is("publico_aprovado_em", null).is("suspenso_em", null).order("criado_em").limit(100)), [])
  return (
    <div className="space-y-4">
      <AvisoDe aviso={acao.aviso} />
      <Mostrar carga={carga}>
        {(linhas) =>
          linhas.length === 0 ? (
            <Vazio>{t("admin.vazio.nada")}</Vazio>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {linhas.map((p) => (
                <li key={p.id}>
                  <Cartao>
                    <h3 className="text-base font-semibold">{p.nome}</h3>
                    <p className="text-corpo-p text-nevoa">{[p.empresa_nome, p.cidade].filter(Boolean).join(" · ")}</p>
                    {p.bio ? <p className="mt-2 text-base text-bruma">{p.bio}</p> : null}
                    <button type="button" className={`${classeAcao} mt-3`} disabled={acao.ocupado} onClick={() => void acao.rodar(async () => { try { exigirSemDados(await supabase.rpc("aprovar_perfil_publico", { perfil: p.id, versao: p.atualizado_em, aprovar: true })) } finally { carga.recarregar() } }, "admin.moderacao.perfilAprovado")}>{t("admin.moderacao.aprovarPerfil")}</button>
                  </Cartao>
                </li>
              ))}
            </ul>
          )
        }
      </Mostrar>
    </div>
  )
}

function Ocultos() {
  const t = useT()
  const acao = useAcao()
  const carga = useCarga(async () => {
    const [p, c] = await Promise.all([
      supabase.from("posts").select("id, corpo").not("oculto_em", "is", null).order("oculto_em", { ascending: false }).limit(50),
      supabase.from("comentarios").select("id, corpo").not("oculto_em", "is", null).order("oculto_em", { ascending: false }).limit(50),
    ])
    return [...exigir(p).map((x) => ({ ...x, alvo: "post" as const })), ...exigir(c).map((x) => ({ ...x, alvo: "comentario" as const }))]
  }, [])
  return (
    <div className="space-y-4">
      <AvisoDe aviso={acao.aviso} />
      <Mostrar carga={carga}>
        {(linhas) =>
          linhas.length === 0 ? (
            <Vazio>{t("admin.vazio.nada")}</Vazio>
          ) : (
            <ul className="space-y-3">
              {linhas.map((x) => (
                <li key={`${x.alvo}-${x.id}`}>
                  <Cartao>
                    <Selo>{t(`admin.moderacao.alvo.${x.alvo}`)}</Selo>
                    <p className="mt-2 text-base whitespace-pre-wrap">{x.corpo}</p>
                    <button type="button" className={`${classeAcao} mt-3`} disabled={acao.ocupado} onClick={() => void acao.rodar(async () => { exigirSemDados(await supabase.rpc("moderar_conteudo", { alvo: x.alvo, alvo_id: x.id, ocultar: false })); carga.recarregar() }, "admin.moderacao.reexibido")}>{t("admin.moderacao.reexibir")}</button>
                  </Cartao>
                </li>
              ))}
            </ul>
          )
        }
      </Mostrar>
    </div>
  )
}

// Moderação (COM-02, NET-04, ADM-02): denúncias, perfis públicos a aprovar e conteúdo oculto. O log é gravado pelas RPCs.
export function Moderacao() {
  const t = useT()
  const pode = usePode(MODERA)
  const [pergunta, setPergunta] = useState<Pergunta>(null)
  if (!pode) return <Pagina titulo="admin.moderacao.titulo"><SemPermissao /></Pagina>
  return (
    <Pagina titulo="admin.moderacao.titulo" intro="admin.moderacao.intro">
      <Abas
        rotulo={t("admin.moderacao.titulo")}
        abas={[
          { chave: "denuncias", rotulo: t("admin.moderacao.abaDenuncias"), conteudo: <Denuncias pergunta={setPergunta} /> },
          { chave: "perfis", rotulo: t("admin.moderacao.abaPerfis"), conteudo: <PerfisPublicos /> },
          { chave: "ocultos", rotulo: t("admin.moderacao.abaOcultos"), conteudo: <Ocultos /> },
        ]}
      />
      <DialogoConfirmar
        aberto={pergunta !== null} perigo titulo={t("admin.moderacao.confirmarTitulo")} texto={pergunta ? t(pergunta.texto) : ""}
        aoCancelar={() => setPergunta(null)}
        aoConfirmar={() => { const p = pergunta; setPergunta(null); p?.aoConfirmar() }}
      />
    </Pagina>
  )
}
