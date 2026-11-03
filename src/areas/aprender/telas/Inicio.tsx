import { Link } from "react-router"
import { Bloqueado } from "../../../componentes/Bloqueado"
import { botaoPrimarioApp, botaoSecundarioApp, pilulaCategoriaApp } from "../../../componentes/botaoEstilo"
import { Cartao } from "../../../componentes/Cartao"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Icone, type NomeIcone } from "../../../componentes/Icone"
import { useCaminho, useIdioma, useT, type Chave } from "../../../i18n"
import { temNivel, useAcesso } from "../../../lib/acesso"
import { useAuth } from "../../../lib/sessao"
import { supabase } from "../../../lib/supabase"
import { Agenda } from "../componentes/Agenda"
import { Bloco } from "../componentes/Bloco"
import { Pagina } from "../componentes/Pagina"
import { QuandoAula } from "../componentes/QuandoAula"
import { COLUNAS_AULA, type AulaLinha } from "../tipos"
import { useCarga } from "../useCarga"
import { barraProgresso, dados, dataCurta, linhas, linkTexto, miniaturaAula } from "../util"
import { urlCapa } from "../curso"

type Continua = { percentual: number; aulas: { slug: string; titulo: string; modulos: { cursos: { slug: string; capa_path: string | null } | null } | null } | null }
type Salvo = { id: number; aulas: { slug: string; titulo: string } | null; videos: { slug: string; titulo: string } | null }
type Sugestao = { id: number; sugerido_id: string; motivo: string; nome: string }

// Início: composição própria sobre três moldes do Refero (não há tela única no Refero que junte saudação, próximos
// eventos e progresso): Mercury c5295ca8 (saudação + atalhos em pílula + grade de cartões com rótulo pequeno em cima e
// o valor grande embaixo), Partiful 29ecaeb7 (próximo evento em destaque com a data em pílula) e Brilliant f841b4a0
// ("Jump back in": a aula em andamento como cartão com capa e barra de progresso). Cartões de vidro em 2 colunas.
// Desvios conscientes: só UMA próxima aula (o banco entrega a próxima ao vivo; não há carrossel) e, para o Clube sem
// conta nova, nenhum dourado cheio (não há ação principal: o cadeado é secundário por regra). Um dourado por tela.
const lista = "divide-y divide-placa"
const item = "flex flex-col items-start gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
const meta = "shrink-0 text-corpo-p text-cinza tabular-nums"
// Link de texto em lista: no toque ganha 44px de altura (os `li` têm o espaço, o link não tinha).
const linkLista = `${linkTexto} pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center`

export function Inicio() {
  const t = useT()
  const lang = useIdioma()
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
    async () => dados(await supabase.from("progresso_aula").select("percentual, aulas(slug, titulo, modulos(cursos(slug, capa_path)))").eq("perfil_id", uid).lt("percentual", 100).order("atualizado_em", { ascending: false }).limit(3)) as unknown as Continua[],
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
  // Um dourado por tela: com conta nova, "Começar" é o primário e a próxima aula fica em secundário. Enquanto o perfil
  // não chegou, fica secundário (senão o dourado pisca e troca de lugar).
  const ctaProxima = perfil.fase === "ok" && !contaNova ? botaoPrimarioApp : botaoSecundarioApp

  return (
    <Pagina
      chave="aprender.inicio.titulo"
      titulo={nome ? `${t("aprender.inicio.ola")}, ${nome}` : t("aprender.inicio.ola")}
      acoes={atalhos.filter((a) => a.mostrar).map((a) => (
        <Link key={a.rota} to={caminho(a.rota)} className={pilulaCategoriaApp}>
          <Icone nome={a.icone} className="size-4" />
          {t(a.rotulo)}
        </Link>
      ))}
    >
      <div className="grid gap-5 lg:grid-cols-2">
        {contaNova ? (
          <Cartao className="lg:col-span-2">
            <h2 className="text-corpo-p font-semibold text-cinza">{t("aprender.inicio.comece")}</h2>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-corpo text-creme">
              <li>{t("aprender.inicio.passo1")}</li>
              <li>{t(grupo ? "aprender.inicio.passo2" : "aprender.inicio.passo2Clube")}</li>
              <li>{t("aprender.inicio.passo3")}</li>
            </ol>
            <Link to={caminho("/bem-vindo")} className={`${botaoPrimarioApp} mt-5`}>{t("aprender.inicio.comecar")}</Link>
          </Cartao>
        ) : null}

        {grupo ? (
          <Bloco className="lg:col-span-2" titulo={t("aprender.inicio.proximaAula")} carga={proxima} recarregar={recProxima} vazio={t("aprender.aulas.vazio")}>
            {(a) =>
              a && a.inicio_em ? (
                // Partiful: o próximo evento em destaque, com a data numa pílula e a ação principal ao lado.
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <span className="inline-flex items-center rounded-full bg-fumaca px-3 py-1 text-corpo-p font-semibold tabular-nums">{dataCurta(a.inicio_em, lang)}</span>
                    <h3 className="mt-3 text-titulo-p font-semibold">{a.titulo}</h3>
                    <p className="mt-2 text-corpo text-cinza"><QuandoAula inicio={a.inicio_em} /></p>
                    <div className="mt-5"><Agenda aula={{ ...a, inicio_em: a.inicio_em }} /></div>
                  </div>
                  <Link to={caminho(`/aulas/${a.slug}`)} className={`${ctaProxima} shrink-0`}>{t("aprender.inicio.abrirAula")}</Link>
                </div>
              ) : null
            }
          </Bloco>
        ) : (
          // Um cadeado só para os dois blocos do Grupo: dois "Bloqueado" iguais repetem o landmark (axe: landmark-unique).
          <section className="space-y-4 lg:col-span-2">
            <h2 className="text-corpo-p font-semibold text-cinza">{t("aprender.inicio.proximaESugestoes")}</h2>
            <Bloqueado frase={t("aprender.inicio.parteDoGrupo")} />
          </section>
        )}

        <Bloco titulo={t("aprender.inicio.continue")} carga={continua} recarregar={recContinua} vazio={t("aprender.inicio.continueVazio")}>
          {(l) => (
            // Brilliant ("Jump back in"): a aula mais recente como cartão com a capa do curso (ou a miniatura escura) e a barra
            // de progresso; as demais em linhas.
            <ul className={lista}>
              {l.map((c, i) => {
                if (!c.aulas) return null
                const rota = c.aulas.modulos?.cursos ? `/academy/${c.aulas.modulos.cursos.slug}/${c.aulas.slug}` : `/aulas/${c.aulas.slug}`
                const capa = urlCapa(c.aulas.modulos?.cursos?.capa_path ?? null)
                return i === 0 ? (
                  <li key={c.aulas.slug} className="pb-4 first:pt-0">
                    {capa ? <img src={capa} alt="" className="aspect-video w-full rounded-lg object-cover" /> : <span aria-hidden="true" className={`${miniaturaAula} w-full sm:w-full`} />}
                    <Link to={caminho(rota)} className={`${linkLista} mt-4 block text-subtitulo`}>{c.aulas.titulo}</Link>
                    <span className={`${meta} mt-2 flex items-center gap-3`}>
                      <progress value={c.percentual} max={100} aria-hidden="true" className={barraProgresso} />
                      {c.percentual}%
                    </span>
                  </li>
                ) : (
                  <li key={c.aulas.slug} className={item}>
                    <Link to={caminho(rota)} className={linkLista}>{c.aulas.titulo}</Link>
                    <span className={`${meta} flex items-center gap-2`}>
                      <progress value={c.percentual} max={100} aria-hidden="true" className={`${barraProgresso} w-24`} />
                      {c.percentual}%
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Bloco>

        <Bloco titulo={t("aprender.inicio.materiais")} carga={materiais} recarregar={recMateriais} vazio={t("aprender.inicio.materiaisVazio")}>
          {(l) => (
            <ul className={lista}>
              {l.map((a) => (
                <li key={a.id} className={item}>
                  <Link to={caminho(`/aulas/${a.slug}`)} className={linkLista}>{a.titulo}</Link>
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
                      <p className="font-semibold">{s.nome}</p>
                      <p className="mt-1 text-corpo-p text-cinza">{s.motivo}</p>
                    </li>
                  ))}
                </ul>
                <Link to={caminho("/match")} className={`${linkLista} mt-2 inline-block text-corpo-p`}>{t("aprender.inicio.verTodas")} <span aria-hidden="true">→</span></Link>
              </div>
            )}
          </Bloco>
        ) : null}

        {grupo ? (
          <Bloco titulo={t("aprender.inicio.conexoes")} carga={pendentes} recarregar={recPendentes} vazio="">
            {(n) =>
              n > 0 ? (
                // Mercury (célula de número): o valor grande em 48/600, o texto embaixo.
                <div>
                  <p className="text-titulo-g font-semibold tabular-nums">{n}</p>
                  <p className="mt-1 text-corpo text-creme">
                    {t(n === 1 ? "aprender.inicio.pedidoPendente" : "aprender.inicio.pedidosPendentes")} <Link to={caminho("/conexoes")} className={linkLista}>{t("aprender.inicio.ver")}</Link>
                  </p>
                </div>
              ) : (
                <p className="text-corpo text-cinza">
                  {t("aprender.inicio.semPedidos")} <Link to={caminho("/conexoes")} className={linkLista}>{t("aprender.inicio.ver")}</Link>
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
                  {s.aulas ? <Link to={caminho(`/aulas/${s.aulas.slug}`)} className={linkLista}>{s.aulas.titulo}</Link> : s.videos ? <Link to={caminho("/biblioteca")} className={linkLista}>{s.videos.titulo}</Link> : null}
                </li>
              ))}
            </ul>
          )}
        </Bloco>

        {acesso.premiado ? (
          <Cartao>
            <h2 className="text-corpo-p font-semibold text-cinza">{t("menu.meuAward")}</h2>
            <Link to={caminho("/meu-award")} className={`${linkLista} mt-4 inline-block`}>{t("aprender.inicio.verMeuAward")}</Link>
          </Cartao>
        ) : null}
      </div>
    </Pagina>
  )
}
