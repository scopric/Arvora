import { useEffect, useState } from "react"
import { Link } from "react-router"
import { Bloqueado } from "../../../componentes/Bloqueado"
import { botaoPrimarioApp } from "../../../componentes/botaoEstilo"
import { Erro } from "../../../componentes/Erro"
import { useCaminho, useT } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { caixaSutil, linkTexto } from "../util"

type Sala = { fase: "espera" } | { fase: "rede" } | { fase: "aberta"; url: string } | { fase: "semAcesso" } | { fase: "indisponivel" } | { fase: "erro" }

const A_CADA_MS = 30_000
const MARGEM_FIM_MIN = 30 // continua perguntando um pouco depois do fim previsto (aula que estoura)
const JANELA_MAX_MIN = 240 // o banco aceita abre_min_antes até 240; antes disso o link nunca abre, nem vale perguntar

// A RPC link_transmissao é a única fonte do link e da hora em que ele abre (a tabela transmissoes não é legível pelo membro).
// A tela só pergunta dentro da janela e mostra a data absoluta: sem contagem regressiva (PRD §17.1 nº6).
async function consultar(aulaId: number): Promise<Sala> {
  const { data, error } = await supabase.rpc("link_transmissao", { aula: aulaId })
  if (!error) return typeof data === "string" && URL.canParse(data) && new URL(data).protocol === "https:" ? { fase: "aberta", url: data } : { fase: "indisponivel" }
  if (error.message.includes("ainda_nao_abriu")) return { fase: "espera" }
  if (error.message.includes("sem_acesso")) return { fase: "semAcesso" }
  if (error.message.includes("aula_sem_transmissao")) return { fase: "indisponivel" }
  // Falha de rede (fetch) não traz código do Postgres; erro do servidor traz.
  return { fase: error.code ? "erro" : "rede" }
}

export function SalaAoVivo({ aulaId, inicio, duracaoMin }: { aulaId: number; inicio: string; duracaoMin: number | null }) {
  const t = useT()
  const caminho = useCaminho()
  const [sala, setSala] = useState<Sala | null>(null)
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let ativo = true
    const comeco = new Date(inicio).getTime()
    const fim = comeco + (duracaoMin ?? 60) * 60000 + MARGEM_FIM_MIN * 60000
    const timer = setInterval(() => void rodar(), A_CADA_MS)
    const parar = () => clearInterval(timer)
    async function rodar() {
      if (document.hidden) return // aba em segundo plano: não consulta (volta no próximo ciclo)
      if (Date.now() > fim) return parar() // a aula acabou: nada mais a perguntar
      if (Date.now() < comeco - JANELA_MAX_MIN * 60000) return ativo && setSala({ fase: "espera" })
      const r = await consultar(aulaId)
      if (!ativo) return
      setSala(r)
      // Com link ou sem acesso a resposta não muda sozinha: para de perguntar. Espera e falhas seguem tentando.
      if (r.fase === "aberta" || r.fase === "semAcesso") parar()
    }
    void rodar()
    return () => {
      ativo = false
      parar()
    }
  }, [aulaId, inicio, duracaoMin, tentativa])

  if (!sala) return <p role="status" className="text-corpo-p text-nevoa">{t("comum.carregandoConteudo")}</p>
  if (sala.fase === "semAcesso") return <Bloqueado frase={t("aprender.aulas.bloqueado")} />
  if (sala.fase === "rede") return <Erro aoTentar={() => setTentativa((n) => n + 1)}>{t("aprender.sala.rede")}</Erro>
  if (sala.fase === "indisponivel" || sala.fase === "erro")
    return (
      <Erro aoTentar={() => setTentativa((n) => n + 1)}>
        {t("aprender.sala.indisponivel")}{" "}
        <Link to={caminho("/suporte")} className={linkTexto}>{t("aprender.sala.suporte")}</Link>
      </Erro>
    )
  if (sala.fase === "aberta")
    return (
      <div className="space-y-2">
        <a href={sala.url} target="_blank" rel="noopener noreferrer" className={`${botaoPrimarioApp} w-full sm:w-auto`}>
          {t("aprender.sala.entrar")}
          <span className="sr-only"> ({t("aprender.abreFora")})</span>
        </a>
        <p className="text-corpo-p text-nevoa">{t("aprender.sala.abreFora")}</p>
      </div>
    )
  return <p className={caixaSutil}>{t("aprender.sala.espera")}</p>
}
