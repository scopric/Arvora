import { useSyncExternalStore } from "react"
import { textosDe, useIdiomaUrl } from "../i18n"

const semAssinatura = () => () => {}

// Fallback de carregamento. No HTML estático (__spa-fallback/index.html, igual para toda URL) o idioma é
// desconhecido: lá mostra só "…"; no navegador, já hidratado, mostra o texto no idioma da URL.
export function Carregando() {
  const noNavegador = useSyncExternalStore(semAssinatura, () => true, () => false)
  const dic = textosDe(useIdiomaUrl())
  return <p role="status" className="p-12 text-creme/70">{noNavegador ? dic["sistema.carregando"] : "…"}</p>
}
