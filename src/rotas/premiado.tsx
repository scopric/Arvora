import { Link, useLoaderData } from "react-router"
import premiados from "../dados/premiados-exemplo.json" with { type: "json" }
import { textosDe } from "../i18n"
import { idiomaValido, linksIdioma } from "../site"
import type { Route } from "./+types/premiado"

const textos = {
  pt: { voltar: "Voltar ao Hall of Fame", aviso: "Exemplo: dados fictícios do piloto, não é um premiado real." },
  en: { voltar: "Back to the Hall of Fame", aviso: "Example: fictional pilot data, not a real award winner." },
}

export function loader({ params }: Route.LoaderArgs) {
  const lang = idiomaValido(params.lang)
  const premiado = premiados.find((p) => p.edicao === params.edicao && p.slug === params.slug)
  if (!premiado) throw new Response("Premiado não encontrado", { status: 404 })
  return { lang, premiado }
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: `${loaderData.premiado.nome} — Hall of Fame (exemplo)` },
    { name: "description", content: textosDe(loaderData.lang)["doc.descricao"] },
    ...linksIdioma(loaderData.lang, `/hall-of-fame/${loaderData.premiado.edicao}/${loaderData.premiado.slug}`).map((l) => ({ tagName: "link" as const, ...l })),
  ]
}

export default function Premiado() {
  const { lang, premiado } = useLoaderData<typeof loader>()
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="inline-block rounded border border-dourado px-3 py-1 text-sm text-dourado">
        {textos[lang].aviso}
      </p>
      <h1 className="mt-6 font-titulo text-5xl">{premiado.nome}</h1>
      <p className="mt-2 text-destaque">{premiado.categoria[lang]}</p>
      <p className="mt-8 text-lg leading-relaxed text-creme/80">{premiado.historia[lang]}</p>
      <Link to={`/${lang}/hall-of-fame`} className="mt-10 inline-block underline">
        {textos[lang].voltar}
      </Link>
    </main>
  )
}
