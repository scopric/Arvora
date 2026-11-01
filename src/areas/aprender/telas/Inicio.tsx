import { Link } from "react-router"
import { Bloqueado } from "../../../componentes/Bloqueado"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { useCaminho, useT } from "../../../i18n"
import { temNivel, useAcesso } from "../../../lib/acesso"
import { useAuth } from "../../../lib/sessao"
import { supabase } from "../../../lib/supabase"
import { Agenda } from "../componentes/Agenda"
import { Bloco } from "../componentes/Bloco"
import { Pagina } from "../componentes/Pagina"
import { QuandoAula } from "../componentes/QuandoAula"
import { COLUNAS_AULA, type AulaLinha } from "../tipos"
import { useCarga } from "../useCarga"
import { botaoLink, dados, foco, linhas, linkTexto } from "../util"

type Continua = { percentual: number; aulas: { slug: string; titulo: string; modulos: { cursos: { slug: string } | null } | null } | null }
type Salvo = { id: number; aulas: { slug: string; titulo: string } | null; videos: { slug: string; titulo: string } | null }
type Sugestao = { id: number; sugerido_id: string; motivo: string; nome: string }

const cartao = "rounded-2xl border border-current/15 bg-superficie/25 p-5"

export function Inicio() {
  const t = useT()
  const caminho = useCaminho()
  const acesso = useAcesso()
  const { sessao } = useAuth()
  const uid = sessao?.user.id ?? ""
  const grupo = temNivel(acesso.nivel, "grupo")

  const [proxima, recProxima] = useCarga(async () => {
    const desde = new Date(Date.now() - 3 * 3600000).toISOString()
    const r = await supabase.from("aulas").select(COLUNAS_AULA).eq("tipo", "ao_vivo").is("materiais_publicados_em", null).gte("inicio_em", desde).order("inicio_em").limit(1).maybeSingle()
    return dados(r) as AulaLinha | null
  }, grupo ? "g" : "c")
  const [continua, recContinua] = useCarga(
    async () => dados(await supabase.from("progresso_aula").select("percentual, aulas(slug, titulo, modulos(cursos(slug)))").eq("perfil_id", uid).lt("percentual", 100).order("atualizado_em", { ascending: false }).limit(3)) as unknown as Continua[],
    uid,
  )
  const [materiais, recMateriais] = useCarga(
    async () => dados(await supabase.from("aulas").select("id, slug, titulo").is("modulo_id", null).not("materiais_publicados_em", "is", null).order("materiais_publicados_em", { ascending: false }).limit(3)) as { id: number; slug: string; titulo: string }[],
    uid,
  )
  const [salvos, recSalvos] = useCarga(
    async () => dados(await supabase.from("salvos").select("id, aulas(slug, titulo), videos(slug, titulo)").eq("perfil_id", uid).order("criado_em", { ascending: false }).limit(5)) as unknown as Salvo[],
    uid,
  )
  const [sugestoes, recSugestoes] = useCarga(async () => {
    if (!grupo) return []
    const s = linhas(await supabase.from("sugestoes_match").select("id, sugerido_id, motivo").eq("perfil_id", uid).order("semana", { ascending: false }).order("pontuacao", { ascending: false }).limit(3))
    if (!s.length) return []
    const v = linhas(await supabase.from("perfis_vitrine").select("id, nome").in("id", s.map((x) => x.sugerido_id)))
    return s.map((x): Sugestao => ({ ...x, nome: v.find((p) => p.id === x.sugerido_id)?.nome ?? "" }))
  }, grupo ? "g" : "c")
  const [pendentes, recPendentes] = useCarga(async () => {
    if (!grupo) return 0
    const r = await supabase.from("conexoes").select("id", { count: "exact", head: true }).eq("destinatario_id", uid).eq("status", "pendente")
    if (r.error) throw r.error
    return r.count ?? 0
  }, grupo ? "g" : "c")
  const [perfil] = useCarga(async () => dados(await supabase.from("perfis").select("onboarding_em").eq("id", uid).maybeSingle()), uid)

  if (acesso.carregando) return <Pagina chave="aprender.inicio.titulo"><Esqueleto linhas={6} /></Pagina>
  if (acesso.erro) return <Pagina chave="aprender.inicio.titulo"><Erro aoTentar={acesso.recarregar}>{t("acesso.erro")}</Erro></Pagina>

  const contaNova = perfil.fase === "ok" && perfil.dados !== null && perfil.dados.onboarding_em === null

  return (
    <Pagina chave="aprender.inicio.titulo">
      <div className="grid gap-10 lg:grid-cols-2">
        {contaNova ? (
          <section className={`${cartao} lg:col-span-2`}>
            <h2 className="font-titulo text-2xl font-bold uppercase">{t("aprender.inicio.comece")}</h2>
            <ol className="mt-3 list-decimal space-y-1 pl-5">
              <li>{t("aprender.inicio.passo1")}</li>
              <li>{t(grupo ? "aprender.inicio.passo2" : "aprender.inicio.passo2Clube")}</li>
              <li>{t("aprender.inicio.passo3")}</li>
            </ol>
            <Link to={caminho("/bem-vindo")} className={`${botaoLink} mt-5`}>{t("aprender.inicio.comecar")}</Link>
          </section>
        ) : null}

        <div className="lg:col-span-2">
          {grupo ? (
            <Bloco titulo={t("aprender.inicio.proximaAula")} carga={proxima} recarregar={recProxima} vazio={t("aprender.aulas.vazio")}>
              {(a) =>
                a && a.inicio_em ? (
                  <div className={`${cartao} space-y-3`}>
                    <h3 className="text-xl font-semibold">
                      <Link to={caminho(`/aulas/${a.slug}`)} className={`underline-offset-4 hover:underline ${foco}`}>{a.titulo}</Link>
                    </h3>
                    <p className="opacity-80"><QuandoAula inicio={a.inicio_em} /></p>
                    <Agenda aula={{ ...a, inicio_em: a.inicio_em }} />
                  </div>
                ) : null
              }
            </Bloco>
          ) : (
            // Um cadeado só para os dois blocos do Grupo: dois "Bloqueado" iguais repetem o landmark (axe: landmark-unique).
            <section className="space-y-4">
              <h2 className="font-titulo text-2xl font-bold uppercase">{t("aprender.inicio.proximaESugestoes")}</h2>
              <Bloqueado frase={t("aprender.inicio.parteDoGrupo")} />
            </section>
          )}
        </div>

        <Bloco titulo={t("aprender.inicio.continue")} carga={continua} recarregar={recContinua} vazio={t("aprender.inicio.continueVazio")}>
          {(lista) => (
            <ul className="space-y-3">
              {lista.map((c) =>
                c.aulas ? (
                  <li key={c.aulas.slug} className={cartao}>
                    <Link to={caminho(c.aulas.modulos?.cursos ? `/academy/${c.aulas.modulos.cursos.slug}/${c.aulas.slug}` : `/aulas/${c.aulas.slug}`)} className={linkTexto}>{c.aulas.titulo}</Link>
                    <span className="ml-2 text-sm opacity-75">{c.percentual}%</span>
                  </li>
                ) : null,
              )}
            </ul>
          )}
        </Bloco>

        <Bloco titulo={t("aprender.inicio.materiais")} carga={materiais} recarregar={recMateriais} vazio={t("aprender.inicio.materiaisVazio")}>
          {(lista) => (
            <ul className="space-y-3">
              {lista.map((a) => (
                <li key={a.id} className={cartao}>
                  <Link to={caminho(`/aulas/${a.slug}`)} className={linkTexto}>{a.titulo}</Link>
                  <span className="ml-2 text-sm opacity-75">{t("aprender.aba.resumo")} · {t("aprender.aba.ebook")} · {t("aprender.aba.exercicios")}</span>
                </li>
              ))}
            </ul>
          )}
        </Bloco>

        {grupo ? (
          <Bloco titulo={t("aprender.inicio.sugestoes")} carga={sugestoes} recarregar={recSugestoes} vazio={t("aprender.inicio.sugestoesVazio")}>
            {(lista) => (
              <div className="space-y-3">
                <ul className="space-y-3">
                  {lista.map((s) => (
                    <li key={s.id} className={cartao}>
                      <p className="font-semibold">{s.nome}</p>
                      <p className="text-sm opacity-80">{s.motivo}</p>
                    </li>
                  ))}
                </ul>
                <Link to={caminho("/match")} className={linkTexto}>{t("aprender.inicio.verTodas")} →</Link>
              </div>
            )}
          </Bloco>
        ) : null}

        {grupo ? (
          <Bloco titulo={t("aprender.inicio.conexoes")} carga={pendentes} recarregar={recPendentes} vazio="">
            {(n) => (
              <p>
                {n > 0 ? `${n} ${t(n === 1 ? "aprender.inicio.pedidoPendente" : "aprender.inicio.pedidosPendentes")}` : t("aprender.inicio.semPedidos")}{" "}
                <Link to={caminho("/conexoes")} className={linkTexto}>{t("aprender.inicio.ver")}</Link>
              </p>
            )}
          </Bloco>
        ) : null}

        <Bloco titulo={t("aprender.inicio.salvos")} carga={salvos} recarregar={recSalvos} vazio={t("aprender.inicio.salvosVazio")}>
          {(lista) => (
            <ul className="space-y-2">
              {lista.map((s) => (
                <li key={s.id}>
                  {s.aulas ? <Link to={caminho(`/aulas/${s.aulas.slug}`)} className={linkTexto}>{s.aulas.titulo}</Link> : s.videos ? <Link to={caminho("/biblioteca")} className={linkTexto}>{s.videos.titulo}</Link> : null}
                </li>
              ))}
            </ul>
          )}
        </Bloco>

        {acesso.premiado ? (
          <section className={`${cartao} space-y-2`}>
            <h2 className="font-titulo text-2xl font-bold uppercase">{t("menu.meuAward")}</h2>
            <Link to={caminho("/meu-award")} className={linkTexto}>{t("aprender.inicio.verMeuAward")}</Link>
          </section>
        ) : null}
      </div>
    </Pagina>
  )
}
