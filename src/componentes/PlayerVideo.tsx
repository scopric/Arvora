import { useState } from "react"
import { useT } from "../i18n"
import { Erro } from "./Erro"

type Legenda = { src: string; idioma: string; rotulo: string; padrao?: boolean }
type Props = {
  titulo: string
  // Arquivo (URL assinada do Storage): <video> nativo. Embed (provedor de vídeo): <iframe>.
  tipo: "arquivo" | "embed"
  src: string
  capa?: string
  // Obrigatórias nas aulas (PRD §17.9): sem faixa, o player ainda abre, mas a tela que o usa deve exigir a legenda antes de publicar.
  legendas?: Legenda[]
}

// Só https; nada de javascript:/data: vindo do banco virar iframe ou vídeo.
const seguro = (url: string) => URL.canParse(url) && new URL(url).protocol === "https:"

export function PlayerVideo({ titulo, tipo, src, capa, legendas = [] }: Props) {
  const t = useT()
  const [falhou, setFalhou] = useState(false)
  if (falhou || !seguro(src)) return <Erro>{t("video.indisponivel")}</Erro>
  return (
    <div className="aspect-video overflow-hidden rounded-2xl bg-black">
      {tipo === "embed" ? (
        <iframe
          src={src}
          title={titulo}
          allow="fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
          className="size-full border-0"
        />
      ) : (
        // controls nativo = teclado (espaço, setas), velocidade e legendas; sem autoplay (PRD §17.9).
        <video src={src} poster={capa} controls preload="metadata" playsInline aria-label={titulo} onError={() => setFalhou(true)} className="size-full">
          {legendas.map((l) => (
            <track key={l.src} kind="subtitles" src={l.src} srcLang={l.idioma} label={l.rotulo} default={l.padrao} />
          ))}
          {t("video.semNavegador")}
        </video>
      )}
    </div>
  )
}
