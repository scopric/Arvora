import { Link } from "react-router"
import { Cartao } from "../../../componentes/Cartao"
import { Icone } from "../../../componentes/Icone"
import { useCaminho, useT } from "../../../i18n"
import { temNivel, useAcesso, type Nivel } from "../../../lib/acesso"

export type VideoLista = { id: number; titulo: string; slug: string; descricao: string | null; duracao_min: number | null; nivel_minimo: Nivel }

// Card de vídeo sem capa (o banco não guarda imagem de capa): título, trecho da descrição, duração e, se o nível
// do visitante não alcança, o cadeado com texto (nunca só ícone, §17.9). `base` = "/biblioteca" ou "/originals".
export function CartaoVideo({ video, base }: { video: VideoLista; base: string }) {
  const t = useT()
  const caminho = useCaminho()
  const { nivel } = useAcesso()
  const bloqueado = !temNivel(nivel, video.nivel_minimo)
  return (
    <li className="relative">
      <Cartao className="h-full transition-colors focus-within:border-creme/60 hover:border-creme/60">
        <h2 className="font-titulo text-2xl leading-tight font-bold uppercase">
          <Link to={caminho(`${base}/${video.slug}`)} className="after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado">
            {video.titulo}
          </Link>
        </h2>
        {video.descricao ? <p className="mt-3 line-clamp-3 text-creme/80">{video.descricao}</p> : null}
        <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs tracking-[0.1em] text-creme/70">
          {video.duracao_min ? <span>{video.duracao_min} {t("publico.video.min")}</span> : null}
          {bloqueado ? (
            <span className="flex items-center gap-1.5 font-semibold text-destaque">
              <Icone nome="cadeado" className="size-4" />
              {t(video.nivel_minimo === "grupo" ? "menu.bloqueadoGrupo" : "menu.bloqueadoClube")}
            </span>
          ) : null}
        </p>
      </Cartao>
    </li>
  )
}
