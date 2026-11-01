import { Link } from "react-router"
import { textosDe, useCaminho, useIdioma, useTitulo } from "../i18n"
import { FundoArvore } from "./FundoArvore"

// Rota inexistente: mensagem de 404 em vez de redirecionar. Hospedagem estática serve o SPA com HTTP 200;
// noindex evita que buscadores indexem a página.
export function NaoEncontrada() {
  useTitulo("titulo.naoEncontrada", true)
  const caminho = useCaminho()
  const dic = textosDe(useIdioma())
  return (
    <main className="relative isolate flex min-h-screen items-center overflow-hidden px-6 sm:px-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_90%_70%_at_85%_100%,color-mix(in_oklab,var(--color-destaque)_22%,transparent),transparent_70%)]"
      />
      <FundoArvore camada="w-full sm:w-3/5" />
      <div className="animate-subir relative mx-auto w-full max-w-5xl">
        <p
          aria-hidden="true"
          className="bg-linear-to-b from-destaque via-destaque/40 to-transparent bg-clip-text font-titulo text-[clamp(9rem,34vw,26rem)] leading-[0.8] font-black text-transparent select-none"
        >
          404
        </p>
        <div className="-mt-[clamp(2rem,8vw,7rem)] relative">
          <h1 className="font-titulo text-4xl font-bold sm:text-6xl">{dic["sistema.naoEncontrada"]}</h1>
          <p className="mt-3 max-w-md text-creme/75 text-pretty">{dic["sistema.naoEncontradaTexto"]}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={caminho("/")}
              className="inline-flex min-h-11 items-center rounded-full bg-destaque px-7 font-medium text-fundo transition-colors hover:bg-creme focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado"
            >
              {dic["sistema.voltar"]}
            </a>
            <Link
              to={caminho("/suporte")}
              className="inline-flex min-h-11 items-center rounded-full border border-creme/30 px-7 font-medium transition-colors hover:bg-creme/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado"
            >
              {dic["sistema.falarConosco"]}
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
