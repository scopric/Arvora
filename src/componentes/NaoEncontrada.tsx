import { useLocation } from "react-router"
import { textosDe, useCaminho, useIdioma, useTitulo } from "../i18n"
import { FundoArvore } from "./FundoArvore"

// Rota inexistente: mensagem de 404 em vez de redirecionar. Hospedagem estática serve o SPA com HTTP 200;
// noindex evita que buscadores indexem a página.
export function NaoEncontrada() {
  useTitulo("titulo.naoEncontrada", true)
  const caminho = useCaminho()
  const dic = textosDe(useIdioma())
  const { pathname } = useLocation()
  return (
    <main className="relative isolate flex min-h-screen items-center overflow-hidden px-6 sm:px-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-1/4 -bottom-1/3 -z-10 size-[70vmax] rounded-full bg-destaque/20 blur-3xl"
      />
      <FundoArvore camada="w-full opacity-40 sm:w-3/5 sm:opacity-100" />
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
          <p className="mt-6 w-fit max-w-full truncate rounded-full border border-creme/15 bg-creme/5 px-4 py-1.5 font-mono text-sm text-creme/60 backdrop-blur">
            {pathname}
          </p>
          <a
            href={caminho("/")}
            className="mt-8 inline-flex min-h-11 items-center rounded-full bg-destaque px-7 font-medium text-fundo transition-colors hover:bg-creme focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado"
          >
            {dic["sistema.voltar"]}
          </a>
        </div>
      </div>
    </main>
  )
}
