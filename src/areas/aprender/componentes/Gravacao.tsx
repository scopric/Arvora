import { useState, type SyntheticEvent } from "react"
import { PlayerVideo } from "../../../componentes/PlayerVideo"
import { Aviso } from "../../../componentes/Aviso"
import { Botao } from "../../../componentes/Botao"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { useT } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { useCarga } from "../useCarga"
import { dados, gravarProgresso, minutosParaTexto, videoDe } from "../util"

const A_CADA_SEG = 15 // não grava a cada quadro: um UPDATE a cada 15 s de vídeo

// Player da gravação + progresso (ACA-03). o vídeo vem da RPC video_da_aula (o banco confere o nível).
export function Gravacao({ aulaId, titulo, uid, aoMudarPercentual }: { aulaId: number; titulo: string; uid: string; aoMudarPercentual?: (p: number) => void }) {
  const t = useT()
  const [estado, recarregar] = useCarga(async () => {
    const [v, p] = await Promise.all([
      // RPC nova do banco (ainda fora de database.types.ts, por isso o cast). Qualquer erro, inclusive função ausente
      // ou sem_acesso, vira "vídeo indisponível": a tela não lê video_id da tabela.
      (supabase as unknown as { rpc: (f: string, a: object) => PromiseLike<{ data: string | null; error: unknown }> }).rpc("video_da_aula", { p_aula: aulaId }),
      supabase.from("progresso_aula").select("percentual, posicao_seg").eq("perfil_id", uid).eq("aula_id", aulaId).maybeSingle(),
    ])
    return { videoId: v.error ? null : v.data, progresso: dados(p) }
  }, `${aulaId}:${uid}`)
  const [percentual, setPercentual] = useState<number | null>(null)
  const [falhou, setFalhou] = useState(false)
  const [ultimo, setUltimo] = useState(0)

  if (estado.fase === "carregando") return <Esqueleto linhas={6} />
  if (estado.fase === "erro") return <Erro aoTentar={recarregar}>{t("aprender.erroVideo")}</Erro>
  const video = videoDe(estado.dados.videoId)
  const atual = percentual ?? estado.dados.progresso?.percentual ?? 0
  const posicaoSalva = estado.dados.progresso?.posicao_seg ?? 0

  async function salvar(p: number, pos: number) {
    const ok = await gravarProgresso(uid, aulaId, p, pos)
    setFalhou(!ok)
    if (ok) {
      setPercentual(p)
      aoMudarPercentual?.(p)
    }
  }
  // O <video> nativo avisa tempo e pausa; o evento não borbulha, então escutamos na captura do contêiner.
  function aoTocar(e: SyntheticEvent<HTMLElement>, forcar: boolean) {
    const v = e.target
    if (!(v instanceof HTMLVideoElement) || !v.duration) return
    if (!forcar && Math.abs(v.currentTime - ultimo) < A_CADA_SEG) return
    setUltimo(v.currentTime)
    void salvar((100 * v.currentTime) / v.duration, v.currentTime)
  }

  return (
    <div className="space-y-4">
      {video ? (
        <div onTimeUpdateCapture={(e) => aoTocar(e, false)} onPauseCapture={(e) => aoTocar(e, true)} onEndedCapture={(e) => aoTocar(e, true)}>
          {/* #t= retoma de onde parou no <video>; no iframe do provedor não há como (lacuna: provedor não decidido). */}
          <PlayerVideo titulo={titulo} tipo={video.tipo} src={video.tipo === "arquivo" && posicaoSalva > 5 ? `${video.src}#t=${posicaoSalva}` : video.src} />
        </div>
      ) : (
        <Erro>{t("video.indisponivel")}</Erro>
      )}
      {falhou ? <Aviso tipo="erro">{t("aprender.erroProgresso")}</Aviso> : null}
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-3 text-sm">
          <span>{t("aprender.progresso")}: {atual}%</span>
          <progress value={atual} max={100} className="h-2 w-40 accent-destaque" />
        </label>
        {posicaoSalva > 5 && atual < 100 ? <span className="text-sm opacity-75">{t("aprender.parouEm")} {minutosParaTexto(posicaoSalva)}</span> : null}
        {atual < 100 ? (
          <Botao variante="contorno" className="sm:w-auto" onClick={() => void salvar(100, posicaoSalva)}>
            {t("aprender.marcarConcluida")}
          </Botao>
        ) : null}
      </div>
    </div>
  )
}
