import { Link } from "react-router"
import { Bloqueado } from "../../../componentes/Bloqueado"
import { botaoPrimarioApp } from "../../../componentes/botaoEstilo"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Icone, type NomeIcone } from "../../../componentes/Icone"
import { useCaminho, useT, type Chave } from "../../../i18n"
import { temNivel, useAcesso } from "../../../lib/acesso"
import { useAuth } from "../../../lib/sessao"
import { supabase } from "../../../lib/supabase"
import { Agenda } from "../componentes/Agenda"
import { Bloco } from "../componentes/Bloco"
import { Pagina } from "../componentes/Pagina"
import { QuandoAula } from "../componentes/QuandoAula"
import { COLUNAS_AULA, type AulaLinha } from "../tipos"
import { useCarga } from "../useCarga"
import { dados, foco, linhas, linkTexto } from "../util"

type Continua = { percentual: number; aulas: { slug: string; titulo: string; modulos: { cursos: { slug: string } | null } | null } | null }
type Salvo = { id: number; aulas: { slug: string; titulo: string } | null; videos: { slug: string; titulo: string } | null }
type Sugestao = { id: number; sugerido_id: string; motivo: string; nome: string }

// Molde Mercury (dashboard): saudação, linha de atalhos em pílula, grade de cartões em 2 colunas.
const cartao = "rounded-xl p-5 shadow-borda"
const atalho = `inline-flex min-h-9 items-center gap-2 rounded-full border border-grafite px-3 text-corpo-p font-medium text-bruma transition-colors pointer-coarse:min-h-11 hover:bg-creme/5 hover:text-creme ${foco}`
const lista = "divide-y divide-grafite"
const item = "flex flex-col items-start gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
const meta = "shrink-0 text-corpo-p text-nevoa tabular-nums"

export function Inicio() {
  const t = useT()
  const caminho = useCaminho()
  const acesso = useAcesso()
  const { sessao } = useAuth()
  const uid = sessao?.user.id ?? ""
  const grupo = temNivel(acesso.nivel, "grupo")
  const clube = temNivel(acesso.nivel, "clube")

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
  const [perfil] = useCarga(async () => dados(await supabase.from("perfis").select("nome, onboarding_em").eq("id", uid).maybeSingle()), uid)

  if (acesso.carregando) return <Pagina chave="aprender.inicio.titulo" titulo={t("aprender.inicio.ola")}><Esqueleto linhas={6} /></Pagina>
  if (acesso.erro) return <Pagina chave="aprender.inicio.titulo" titulo={t("aprender.inicio.ola")}><Erro aoTentar={acesso.recarregar}>{t("acesso.erro")}</Erro></Pagina>

  const nome = perfil.fase === "ok" ? perfil.dados?.nome?.trim().split(/\s+/)[0] : undefined
  const contaNova = perfil.fase === "ok" && perfil.dados !== null && perfil.dados.onboarding_em === null
  const atalhos: { rotulo: Chave; rota: string; icone: NomeIcone; mostrar: boolean }[] = [
    { rotulo: "menu.aulas", rota: "/aulas", icone: "video", mostrar: grupo },
    { rotulo: "menu.academy", rota: "/academy", icone: "aprender", mostrar: true },
    { rotulo: "menu.comunidade", rota: "/comunidade", icone: "balao", mostrar: clube },
    { rotulo: "menu.tarefas", rota: "/tarefas", icone: "check", mostrar: grupo },
  ]

  return (
    <Pagina
      chave="aprender.inicio.titulo"
      titulo={nome ? `${t("aprender.inicio.ola")}, ${nome}` : t("aprender.inicio.ola")}
      acoes={atalhos.filter((a) => a.mostrar).map((a) => (
        <Link key={a.rota} to={caminho(a.rota)} className={atalho}>
          <Icone nome={a.icone} className="size-4 text-nevoa" />
          {t(a.rotulo)}
        </Link>
      ))}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {contaNova ? (
          <section className={`${cartao} lg:col-span-2`}>
            <h2 className="text-base font-semibold">{t("aprender.inicio.comece")}</h2>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-base text-bruma">
              <li>{t("aprender.inicio.passo1")}</li>
              <li>{t(grupo ? "aprender.inicio.passo2" : "aprender.inicio.passo2Clube")}</li>
              <li>{t("aprender.inicio.passo3")}</li>
            </ol>
            {/* Um primário por tela: o CTA do Bloqueado é secundário, então "Começar" é o dourado para todos (Decisão 70). */}
            <Link to={caminho("/bem-vindo")} className={`${botaoPrimarioApp} mt-5`}>{t("aprender.inicio.comecar")}</Link>
          </section>
        ) : null}

        {grupo ? (
          <Bloco className="lg:col-span-2" titulo={t("aprender.inicio.proximaAula")} carga={proxima} recarregar={recProxima} vazio={t("aprender.aulas.vazio")}>
            {(a) =>
              a && a.inicio_em ? (
                <div>
                  <h3 className="text-titulo-p font-semibold">
                    <Link to={caminho(`/aulas/${a.slug}`)} className={`rounded-sm underline-offset-4 hover:underline ${foco}`}>{a.titulo}</Link>
                  </h3>
                  <p className="mt-2 text-base text-bruma"><QuandoAula inicio={a.inicio_em} /></p>
                  <div className="mt-5"><Agenda aula={{ ...a, inicio_em: a.inicio_em }} /></div>
                </div>
              ) : null
            }
          </Bloco>
        ) : (
          // Um cadeado só para os dois blocos do Grupo: dois "Bloqueado" iguais repetem o landmark (axe: landmark-unique).
          <section className="space-y-4 lg:col-span-2">
            <h2 className="text-base font-semibold">{t("aprender.inicio.proximaESugestoes")}</h2>
            <Bloqueado frase={t("aprender.inicio.parteDoGrupo")} />
          </section>
        )}

        <Bloco titulo={t("aprender.inicio.continue")} carga={continua} recarregar={recContinua} vazio={t("aprender.inicio.continueVazio")}>
          {(l) => (
            <ul className={lista}>
              {l.map((c) =>
                c.aulas ? (
                  <li key={c.aulas.slug} className={item}>
                    <Link to={caminho(c.aulas.modulos?.cursos ? `/academy/${c.aulas.modulos.cursos.slug}/${c.aulas.slug}` : `/aulas/${c.aulas.slug}`)} className={linkTexto}>{c.aulas.titulo}</Link>
                    <span className={`${meta} flex items-center gap-2`}>
                      <span aria-hidden="true" className="h-1 w-16 overflow-hidden rounded-full bg-fumaca"><span className="block h-full rounded-full bg-dourado" style={{ width: `${c.percentual}%` }} /></span>
                      {c.percentual}%
                    </span>
                  </li>
                ) : null,
              )}
            </ul>
          )}
        </Bloco>

        <Bloco titulo={t("aprender.inicio.materiais")} carga={materiais} recarregar={recMateriais} vazio={t("aprender.inicio.materiaisVazio")}>
          {(l) => (
            <ul className={lista}>
              {l.map((a) => (
                <li key={a.id} className={item}>
                  <Link to={caminho(`/aulas/${a.slug}`)} className={linkTexto}>{a.titulo}</Link>
                  <span className={meta}>{t("aprender.aba.resumo")} · {t("aprender.aba.ebook")} · {t("aprender.aba.exercicios")}</span>
                </li>
              ))}
            </ul>
          )}
        </Bloco>

        {grupo ? (
          <Bloco titulo={t("aprender.inicio.sugestoes")} carga={sugestoes} recarregar={recSugestoes} vazio={t("aprender.inicio.sugestoesVazio")}>
            {(l) => (
              <div>
                <ul className={lista}>
                  {l.map((s) => (
                    <li key={s.id} className="py-3 first:pt-0">
                      <p className="font-medium">{s.nome}</p>
                      <p className="mt-1 text-corpo-p text-nevoa">{s.motivo}</p>
                    </li>
                  ))}
                </ul>
                <Link to={caminho("/match")} className={`${linkTexto} mt-2 inline-block text-corpo-p`}>{t("aprender.inicio.verTodas")} <span aria-hidden="true">→</span></Link>
              </div>
            )}
          </Bloco>
        ) : null}

        {grupo ? (
          <Bloco titulo={t("aprender.inicio.conexoes")} carga={pendentes} recarregar={recPendentes} vazio="">
            {(n) =>
              n > 0 ? (
                <div>
                  <p className="text-titulo font-medium tabular-nums">{n}</p>
                  <p className="mt-1 text-base text-bruma">
                    {t(n === 1 ? "aprender.inicio.pedidoPendente" : "aprender.inicio.pedidosPendentes")} <Link to={caminho("/conexoes")} className={linkTexto}>{t("aprender.inicio.ver")}</Link>
                  </p>
                </div>
              ) : (
                <p className="text-base text-nevoa">
                  {t("aprender.inicio.semPedidos")} <Link to={caminho("/conexoes")} className={linkTexto}>{t("aprender.inicio.ver")}</Link>
                </p>
              )
            }
          </Bloco>
        ) : null}

        <Bloco titulo={t("aprender.inicio.salvos")} carga={salvos} recarregar={recSalvos} vazio={t("aprender.inicio.salvosVazio")}>
          {(l) => (
            <ul className={lista}>
              {l.map((s) => (
                <li key={s.id} className={item}>
                  {s.aulas ? <Link to={caminho(`/aulas/${s.aulas.slug}`)} className={linkTexto}>{s.aulas.titulo}</Link> : s.videos ? <Link to={caminho("/biblioteca")} className={linkTexto}>{s.videos.titulo}</Link> : null}
                </li>
              ))}
            </ul>
          )}
        </Bloco>

        {acesso.premiado ? (
          <section className={cartao}>
            <h2 className="text-base font-semibold">{t("menu.meuAward")}</h2>
            <Link to={caminho("/meu-award")} className={`${linkTexto} mt-4 inline-block`}>{t("aprender.inicio.verMeuAward")}</Link>
          </section>
        ) : null}
      </div>
    </Pagina>
  )
}
