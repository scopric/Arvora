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
      <FundoArvore camada="w-full opacity-40 sm:w-3/5 sm:opacity-100" />
      <div className="animate-subir mx-auto w-full max-w-5xl">
        <p aria-hidden="true" className="font-titulo text-[clamp(7rem,28vw,18rem)] leading-[0.85] font-black text-destaque">404</p>
        <h1 className="mt-6 font-titulo text-4xl font-bold sm:text-5xl">{dic["sistema.naoEncontrada"]}</h1>
        <p className="mt-3 max-w-md text-creme/75 text-pretty">{dic["sistema.naoEncontradaTexto"]}</p>
        <a
          href={caminho("/")}
          className="mt-10 inline-flex min-h-11 items-center rounded-full bg-creme px-7 font-medium text-fundo transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado"
        >
          {dic["sistema.voltar"]}
        </a>
      </div>
    </main>
  )
}
