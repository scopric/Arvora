import { textosDe, useCaminho, useIdioma, useTitulo } from "../i18n"

// Rota inexistente: mensagem de 404 em vez de redirecionar. Hospedagem estática serve o SPA com HTTP 200;
// noindex evita que buscadores indexem a página.
export function NaoEncontrada() {
  useTitulo("titulo.naoEncontrada", true)
  const caminho = useCaminho()
  const dic = textosDe(useIdioma())
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <h1 className="font-titulo text-4xl">{dic["sistema.naoEncontrada"]}</h1>
      <a href={caminho("/")} className="mt-8 inline-block underline">{dic["sistema.voltar"]}</a>
    </main>
  )
}
