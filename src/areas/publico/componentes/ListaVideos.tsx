import { useSearchParams } from "react-router"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Vazio } from "../../../componentes/Vazio"
import { useIdioma, useT, useTitulo, type Chave } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { CartaoVideo } from "../componentes/CartaoVideo"
import { Pagina } from "../Pagina"
import { useConsulta } from "../usarConsulta"

type Props = { tipo: "talk" | "original"; base: string; titulo: Chave; apoio: Chave; vazio: Chave; comTemas: boolean }

// Lista de vídeos publicados de um tipo (Biblioteca = talk, Originals = original). Visitante vê título, descrição e o cadeado;
// o vídeo em si (e o trecho) fica na página do vídeo. O filtro de tema vai na URL (?tema=slug) para dar para compartilhar.
export function ListaVideos({ tipo, base, titulo, apoio, vazio, comTemas }: Props) {
  const t = useT()
  const idioma = useIdioma()
  useTitulo(titulo)
  const [params, setParams] = useSearchParams()
  const temaSlug = comTemas ? params.get("tema") : null
  const temas = useConsulta(() => (comTemas ? supabase.from("temas").select("id,nome,nome_en,slug").order("ordem") : Promise.resolve({ data: [], error: null })), `temas/${comTemas}`)
  const videos = useConsulta(() => {
    const q = supabase
      .from("videos")
      .select("id,titulo,slug,descricao,duracao_min,nivel_minimo,tema_id")
      .eq("tipo", tipo)
      .not("publicado_em", "is", null)
      .order("publicado_em", { ascending: false })
    return q
  }, `videos/${tipo}`)

  const lista = temas.dados ?? []
  const tema = lista.find((x) => x.slug === temaSlug)
  const todos = videos.dados ?? []
  const visiveis = tema ? todos.filter((v) => v.tema_id === tema.id) : todos
  const nomeTema = (x: { nome: string; nome_en: string | null }) => (idioma === "en" && x.nome_en) || x.nome

  const chip = "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado"
  const escolher = (slug: string | null) => setParams(slug ? { tema: slug } : {}, { replace: true })

  return (
    <Pagina titulo={t(titulo)} apoio={t(apoio)}>
      {comTemas && lista.length ? (
        <div role="group" aria-label={t("publico.biblioteca.temas")} className="mb-8 flex flex-wrap gap-2">
          <button type="button" aria-pressed={!tema} onClick={() => escolher(null)} className={`${chip} ${!tema ? "border-creme bg-creme text-fundo" : "border-creme/30 hover:border-creme/60"}`}>
            {t("publico.biblioteca.todos")}
          </button>
          {lista.map((x) => (
            <button key={x.id} type="button" aria-pressed={tema?.id === x.id} onClick={() => escolher(x.slug)} className={`${chip} ${tema?.id === x.id ? "border-creme bg-creme text-fundo" : "border-creme/30 hover:border-creme/60"}`}>
              {nomeTema(x)}
            </button>
          ))}
        </div>
      ) : null}
      {videos.carregando ? (
        <Esqueleto linhas={6} />
      ) : videos.erro ? (
        <Erro aoTentar={videos.recarregar} />
      ) : visiveis.length === 0 ? (
        <Vazio>{t(tema ? "publico.biblioteca.vazioTema" : vazio)}</Vazio>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visiveis.map((v) => (
            <CartaoVideo key={v.id} video={v} base={base} />
          ))}
        </ul>
      )}
    </Pagina>
  )
}
