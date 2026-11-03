import type { ReactNode } from "react"
import { Link, useParams } from "react-router"
import { Bloqueado } from "../../../componentes/Bloqueado"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Selo } from "../../../componentes/Selo"
import { useCaminho, useIdioma, useT } from "../../../i18n"
import { temNivel, useAcesso } from "../../../lib/acesso"
import { useAuth } from "../../../lib/sessao"
import { Exercicio, SeloStatus } from "../componentes/Exercicio"
import { Pagina } from "../componentes/Pagina"
import { carregarTarefas } from "../tarefas"
import { useCarga } from "../useCarga"
import { dataCurta, linkTexto } from "../util"

// Detalhe da tarefa: instruções, resposta (texto e arquivo), devolutiva da equipe e reenvio quando o status é "ajustar".
// Molde Linear (detalhe da issue, tela c0d1f40b no cofre): o enunciado ao centro e as propriedades (status, prazo,
// envio, aula) num painel de vidro à direita (no celular, abaixo).
export function Tarefa() {
  const { id } = useParams()
  const t = useT()
  const lang = useIdioma()
  const caminho = useCaminho()
  const acesso = useAcesso()
  const { sessao } = useAuth()
  const uid = sessao?.user.id ?? ""
  const numero = /^\d+$/.test(id ?? "") ? Number(id) : -1
  const [estado, recarregar] = useCarga(() => carregarTarefas(uid, numero), `${uid}:${numero}`)
  const chave = "aprender.tarefa.titulo"

  if (acesso.carregando) return <Pagina chave={chave}><Esqueleto linhas={4} /></Pagina>
  if (acesso.erro) return <Pagina chave={chave}><Erro aoTentar={acesso.recarregar}>{t("acesso.erro")}</Erro></Pagina>
  if (!temNivel(acesso.nivel, "grupo")) return <Pagina chave={chave}><Bloqueado frase={t("aprender.tarefas.bloqueado")} /></Pagina>
  if (estado.fase === "carregando") return <Pagina chave={chave}><Esqueleto linhas={4} /></Pagina>
  if (estado.fase === "erro") return <Pagina chave={chave}><Erro aoTentar={recarregar} /></Pagina>
  const item = estado.dados[0]
  const voltar = { para: caminho("/tarefas"), rotulo: t("aprender.tarefas.voltar") }
  if (!item) return <Pagina chave={chave} titulo={t("aprender.naoEncontrada")} voltar={voltar}>{null}</Pagina>

  const { exercicio, entrega } = item
  const propriedade = (rotulo: string, valor: ReactNode) => (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-corpo-p text-cinza">{rotulo}</dt>
      <dd className="text-right text-corpo-p">{valor}</dd>
    </div>
  )
  return (
    <Pagina chave={chave} titulo={exercicio.aulas?.titulo ?? t(chave)} voltar={voltar}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Exercicio exercicio={exercicio} entrega={entrega} uid={uid} podeEnviar={!!exercicio.aulas?.verticais?.aceita_entregas && temNivel(acesso.nivel, "grupo")} doGrupo={temNivel(acesso.nivel, "grupo")} aoAtualizar={recarregar} />
        <dl className="divide-y divide-fumaca rounded-lg px-4 py-1 vidro lg:sticky lg:top-24 lg:self-start">
          {propriedade(t("aprender.exercicio.n"), String(exercicio.ordem))}
          {propriedade(t("aprender.tarefas.titulo"), entrega ? <SeloStatus status={entrega.status} /> : <Selo>{t("aprender.exercicio.naoEnviado")}</Selo>)}
          {exercicio.prazo_dias ? propriedade(t("aprender.exercicio.prazo"), `${exercicio.prazo_dias} ${t("aprender.exercicio.dias")}`) : null}
          {entrega ? propriedade(t("aprender.exercicio.suaResposta"), dataCurta(entrega.enviada_em, lang)) : null}
          {exercicio.aulas ? propriedade(t("aprender.aula.titulo"), <Link to={caminho(`/aulas/${exercicio.aulas.slug}`)} className={linkTexto}>{t("aprender.tarefa.verAula")}</Link>) : null}
        </dl>
      </div>
    </Pagina>
  )
}
