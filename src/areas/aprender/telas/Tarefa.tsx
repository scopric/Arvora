import { Link, useParams } from "react-router"
import { Bloqueado } from "../../../componentes/Bloqueado"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { useCaminho, useT } from "../../../i18n"
import { temNivel, useAcesso } from "../../../lib/acesso"
import { useAuth } from "../../../lib/sessao"
import { Exercicio } from "../componentes/Exercicio"
import { Pagina } from "../componentes/Pagina"
import { carregarTarefas } from "../tarefas"
import { useCarga } from "../useCarga"
import { linkTexto } from "../util"

// Detalhe da tarefa: instruções, resposta (texto e arquivo), devolutiva da equipe e reenvio quando o status é "ajustar".
export function Tarefa() {
  const { id } = useParams()
  const t = useT()
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
  const voltar = <Link to={caminho("/tarefas")} className={`mb-6 inline-block ${linkTexto}`}>‹ {t("aprender.tarefas.voltar")}</Link>
  if (!item) return <Pagina chave={chave} titulo={t("aprender.naoEncontrada")}>{voltar}</Pagina>

  const { exercicio, entrega } = item
  return (
    <Pagina chave={chave} titulo={exercicio.aulas?.titulo ?? t(chave)}>
      {voltar}
      {exercicio.aulas ? (
        <p className="mb-6">
          <Link to={caminho(`/aulas/${exercicio.aulas.slug}`)} className={linkTexto}>{t("aprender.tarefa.verAula")}</Link>
        </p>
      ) : null}
      <Exercicio exercicio={exercicio} entrega={entrega} uid={uid} podeEnviar={!!exercicio.aulas?.verticais?.aceita_entregas} aoAtualizar={recarregar} />
    </Pagina>
  )
}
