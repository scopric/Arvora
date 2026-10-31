import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router"
import { Bloqueado } from "../../../componentes/Bloqueado"
import { Erro } from "../../../componentes/Erro"
import { useCaminho, useT } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { botaoLink, linkTexto } from "../util"

type Sala = { fase: "espera" } | { fase: "aberta"; url: string } | { fase: "semAcesso" } | { fase: "indisponivel" } | { fase: "erro" }

const A_CADA_MS = 30_000
const JANELA_MAX_MIN = 240 // o banco aceita abre_min_antes até 240; antes disso o link nunca abre, nem vale perguntar

// A RPC link_transmissao é a única fonte do link e da hora em que ele abre (a tabela transmissoes não é legível pelo membro).
// A tela só pergunta dentro da janela e mostra a data absoluta: sem contagem regressiva (PRD §17.1 nº6).
async function consultar(aulaId: number): Promise<Sala> {
  const { data, error } = await supabase.rpc("link_transmissao", { aula: aulaId })
  if (!error) return typeof data === "string" && URL.canParse(data) && new URL(data).protocol === "https:" ? { fase: "aberta", url: data } : { fase: "indisponivel" }
  if (error.message.includes("ainda_nao_abriu")) return { fase: "espera" }
  if (error.message.includes("sem_acesso")) return { fase: "semAcesso" }
  if (error.message.includes("aula_sem_transmissao")) return { fase: "indisponivel" }
  return { fase: "erro" }
}

export function SalaAoVivo({ aulaId, inicio }: { aulaId: number; inicio: string }) {
  const t = useT()
  const caminho = useCaminho()
  const [sala, setSala] = useState<Sala | null>(null)
  const dentroDaJanela = useCallback(() => Date.now() >= new Date(inicio).getTime() - JANELA_MAX_MIN * 60000, [inicio])

  const perguntar = useCallback(async () => setSala(await consultar(aulaId)), [aulaId])
  useEffect(() => {
    let ativo = true
    const rodar = async () => {
      if (!dentroDaJanela()) return ativo && setSala({ fase: "espera" })
      const r = await consultar(aulaId)
      if (ativo) setSala(r)
    }
    void rodar()
    const timer = setInterval(() => void rodar(), A_CADA_MS)
    return () => {
      ativo = false
      clearInterval(timer)
    }
  }, [aulaId, dentroDaJanela])

  if (!sala) return <p role="status" className="opacity-75">{t("comum.carregandoConteudo")}</p>
  if (sala.fase === "semAcesso") return <Bloqueado frase={t("aprender.aulas.bloqueado")} />
  if (sala.fase === "indisponivel" || sala.fase === "erro")
    return (
      <Erro aoTentar={() => void perguntar()}>
        {t("aprender.sala.indisponivel")}{" "}
        <Link to={caminho("/suporte")} className={linkTexto}>{t("aprender.sala.suporte")}</Link>
      </Erro>
    )
  if (sala.fase === "aberta")
    return (
      <div className="space-y-2">
        <a href={sala.url} target="_blank" rel="noopener noreferrer" className={`${botaoLink} w-full sm:w-auto`}>
          {t("aprender.sala.entrar")}
          <span className="sr-only"> ({t("aprender.abreFora")})</span>
        </a>
        <p className="text-sm opacity-75">{t("aprender.sala.abreFora")}</p>
      </div>
    )
  return <p className="rounded-xl border border-current/15 px-4 py-3">{t("aprender.sala.espera")}</p>
}
