import { useState } from "react"
import { Link } from "react-router"
import { Bloqueado } from "../../../componentes/Bloqueado"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Selecao } from "../../../componentes/Campo"
import { Selo } from "../../../componentes/Selo"
import { Vazio } from "../../../componentes/Vazio"
import { useCaminho, useIdioma, useT } from "../../../i18n"
import { temNivel, useAcesso } from "../../../lib/acesso"
import { useAuth } from "../../../lib/sessao"
import { supabase } from "../../../lib/supabase"
import { Agenda } from "../componentes/Agenda"
import { Pagina } from "../componentes/Pagina"
import { QuandoAula } from "../componentes/QuandoAula"
import { COLUNAS_AULA, nomeVertical, type AulaLinha } from "../tipos"
import { useCarga } from "../useCarga"
import { caixaSutil, dados, formatar, foco, segundaDaSemana } from "../util"

type VerticalLinha = { id: number; slug: string; nome: string; nome_en: string | null }
const LIMITE = 120 // PROVISÓRIO: sem paginação no lançamento; 120 aulas cobrem mais de um ano de duas aulas por semana

// Calendário de aulas (AUL-01, AUL-06): lista por semana, filtro por vertical, .ics e Google Agenda.
// /bem-estar usa esta mesma tela fixada na vertical `bem-estar` (MEN-01), com o aviso fixo.
// Molde Linear (lista agrupada): "Próximas / Anteriores" → semana → linhas com selo, título e meta em 13px.
export function Aulas({ verticalFixa }: { verticalFixa?: string }) {
  const t = useT()
  const lang = useIdioma()
  const caminho = useCaminho()
  const acesso = useAcesso()
  const { sessao } = useAuth()
  const uid = sessao?.user.id
  const [filtro, setFiltro] = useState("")
  const [agora] = useState(Date.now) // fixo durante a visita: a lista não muda de lugar sozinha
  const bemEstar = verticalFixa === "bem-estar"
  const chave = bemEstar ? "aprender.bemEstar.titulo" : "aprender.aulas.titulo"

  const [estado, recarregar] = useCarga(async () => {
    const [v, a, p] = await Promise.all([
      supabase.from("verticais").select("id, slug, nome, nome_en").eq("ativa", true).order("ordem"),
      supabase.from("aulas").select(COLUNAS_AULA).is("modulo_id", null).not("inicio_em", "is", null).order("inicio_em", { ascending: false }).limit(LIMITE),
      uid ? supabase.from("progresso_aula").select("aula_id, percentual").eq("perfil_id", uid) : Promise.resolve({ data: [], error: null }),
    ])
    return { verticais: dados(v) as VerticalLinha[], aulas: dados(a) as AulaLinha[], progresso: new Map((dados(p) as { aula_id: number; percentual: number }[]).map((x) => [x.aula_id, x.percentual])) }
  }, uid)

  if (acesso.carregando || estado.fase === "carregando") return <Pagina chave={chave}><Esqueleto linhas={6} /></Pagina>
  if (acesso.erro) return <Pagina chave={chave}><Erro aoTentar={acesso.recarregar}>{t("acesso.erro")}</Erro></Pagina>
  if (estado.fase === "erro") return <Pagina chave={chave}><Erro aoTentar={recarregar} /></Pagina>

  const { verticais, aulas, progresso } = estado.dados
  const idFixo = verticalFixa ? verticais.find((v) => v.slug === verticalFixa)?.id : undefined
  const idFiltro = verticalFixa ? idFixo : filtro ? Number(filtro) : undefined
  const visiveis = aulas.filter((a) => (verticalFixa ? a.vertical_id === idFixo : idFiltro === undefined || a.vertical_id === idFiltro))
  const nomeDe = (id: number) => {
    const v = verticais.find((x) => x.id === id)
    return v ? nomeVertical(v, lang) : ""
  }

  if (!temNivel(acesso.nivel, "grupo"))
    return (
      <Pagina chave={chave}>
        <Bloqueado
          previa={
            <ul className="space-y-2">
              {visiveis.slice(0, 3).map((a) => (
                <li key={a.id} className="text-base">{a.titulo}</li>
              ))}
            </ul>
          }
          frase={t(bemEstar ? "aprender.bemEstar.bloqueado" : "aprender.aulas.bloqueado")}
        />
      </Pagina>
    )

  // Próximas: da mais perto para a mais longe; anteriores: da mais recente para a mais antiga. Cada bloco agrupado por semana.
  const proximas = visiveis.filter((a) => new Date(a.inicio_em!).getTime() >= agora - 3 * 3600000).reverse()
  const passadas = visiveis.filter((a) => !proximas.includes(a))
  const semanas = (lista: AulaLinha[]) => {
    const por = new Map<string, AulaLinha[]>()
    for (const a of lista) por.set(segundaDaSemana(a.inicio_em!), [...(por.get(segundaDaSemana(a.inicio_em!)) ?? []), a])
    return [...por.entries()]
  }

  const bloco = (titulo: string, lista: AulaLinha[]) => (
    <section className="space-y-6">
      <h2 className="text-subtitulo font-semibold">{titulo}</h2>
      {semanas(lista).map(([segunda, itens]) => (
        <div key={segunda}>
          <h3 className="mb-2 text-corpo-p font-medium text-nevoa">
            {t("aprender.aulas.semanaDe")} {formatar(`${segunda}T12:00:00Z`, lang, { day: "numeric", month: "long" }, "UTC")}
          </h3>
          <ul className="divide-y divide-grafite rounded-xl shadow-borda">
            {itens.map((a) => {
              const live = a.tipo === "ao_vivo" && !a.materiais_publicados_em
              return (
                <li key={a.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Selo tom={live ? "destaque" : "neutro"}>{live ? t("aprender.aoVivo") : t("aprender.gravada")}</Selo>
                    {progresso.get(a.id) === 100 ? <Selo>{t("aprender.assistida")}</Selo> : null}
                    <span className="text-corpo-p text-nevoa">{nomeDe(a.vertical_id)}{a.duracao_min ? ` · ${a.duracao_min} ${t("aprender.min")}` : ""}</span>
                  </div>
                  <h4 className="mt-2 text-base font-medium">
                    <Link to={caminho(`/aulas/${a.slug}`)} className={`rounded-sm underline-offset-4 hover:underline ${foco}`}>{a.titulo}</Link>
                  </h4>
                  <p className="mt-1 text-corpo-p text-nevoa"><QuandoAula inicio={a.inicio_em!} /></p>
                  {live && new Date(a.inicio_em!).getTime() > agora ? (
                    <div className="mt-3"><Agenda aula={{ ...a, inicio_em: a.inicio_em! }} /></div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
  )

  return (
    <Pagina chave={chave}>
      <div className="space-y-10">
        {bemEstar ? <p className={caixaSutil}>{t("aprender.bemEstar.aviso")}</p> : null}
        {!verticalFixa && verticais.length > 1 ? (
          <div className="w-56">
            <Selecao rotulo={t("aprender.aulas.vertical")} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
              <option value="">{t("aprender.aulas.todas")}</option>
              {verticais.map((v) => (
                <option key={v.id} value={v.id}>{nomeVertical(v, lang)}</option>
              ))}
            </Selecao>
          </div>
        ) : null}
        {visiveis.length === 0 ? <Vazio>{t("aprender.aulas.vazio")}</Vazio> : null}
        {proximas.length ? bloco(t("aprender.aulas.proximas"), proximas) : visiveis.length ? <Vazio>{t("aprender.aulas.vazio")}</Vazio> : null}
        {passadas.length ? bloco(t("aprender.aulas.anteriores"), passadas) : null}
      </div>
    </Pagina>
  )
}

export function BemEstar() {
  return <Aulas verticalFixa="bem-estar" />
}
