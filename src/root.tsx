import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration, useParams } from "react-router"
import "./index.css"
import { BannerCookies } from "./componentes/BannerCookies"
import { Carregando } from "./componentes/Carregando"
import { ehIdioma, textosDe, useIdiomaUrl } from "./i18n"
import { IDIOMAS, LANG_HTML, type Idioma } from "./site"

export function Layout({ children }: { children: React.ReactNode }) {
  const { lang } = useParams()
  const idioma = IDIOMAS.find((l) => l === lang) as Idioma | undefined
  return (
    <html lang={idioma ? LANG_HTML[idioma] : "pt-BR"}>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content="#112019" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export function meta({ params }: { params: { lang?: string } }) {
  const dic = textosDe(ehIdioma(params.lang) ? params.lang : "pt")
  return [
    { title: dic["doc.titulo"] },
    { name: "description", content: dic["doc.descricao"] },
  ]
}

export default function Root() {
  return (
    <>
      {/* Antes do conteúdo no DOM (ordem de tab/leitor de tela); visualmente fica embaixo (fixed). */}
      <BannerCookies />
      <Outlet />
    </>
  )
}

// Mostrado enquanto o SPA hidrata (e no __spa-fallback.html). Fora do /:lang: idioma pela URL.
export function HydrateFallback() {
  return <Carregando />
}

// Título do erro: 404 ou genérico.
export function chaveErro(error: unknown) {
  return isRouteErrorResponse(error) && error.status === 404 ? "sistema.naoEncontrada" : "sistema.erro"
}

// Sem stack na tela. Em páginas pré-renderizadas o status HTTP continua 200 (limite do ssr:false).
export function ErrorBoundary({ error }: { error: unknown }) {
  const idioma = useIdiomaUrl()
  const dic = textosDe(idioma)
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <h1 className="font-titulo text-4xl">{dic[chaveErro(error)]}</h1>
      <a href={`/${idioma}`} className="mt-8 inline-block underline">{dic["sistema.voltar"]}</a>
    </main>
  )
}
