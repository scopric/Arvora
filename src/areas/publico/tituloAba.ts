import { useEffect } from "react"
import { useIdioma } from "../../i18n"

// <title> com o nome do registro (edição, empresa, vídeo) depois que ele carrega; `noindex` para página "não encontrada".
// useTitulo da base só aceita chave fixa; roda depois dele (o efeito do pai vem depois do filho) e prevalece.
export function useTituloNome(nome: string | null, noindex = false) {
  const idioma = useIdioma()
  useEffect(() => {
    if (nome) document.title = `${nome} — Grupo Árvora`
  }, [nome, idioma])
  useEffect(() => {
    if (!noindex) return
    const meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]') ?? document.head.appendChild(Object.assign(document.createElement("meta"), { name: "robots" }))
    meta.content = "noindex"
    return () => meta.remove()
  }, [noindex])
}
