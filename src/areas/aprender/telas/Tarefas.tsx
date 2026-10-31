import { Link } from "react-router"
import { Abas } from "../../../componentes/Abas"
import { Bloqueado } from "../../../componentes/Bloqueado"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Vazio } from "../../../componentes/Vazio"
import { useCaminho, useIdioma, useT, type Chave } from "../../../i18n"
import { temNivel, useAcesso } from "../../../lib/acesso"
import { useAuth } from "../../../lib/sessao"
import { Pagina } from "../componentes/Pagina"
import { SeloStatus } from "../componentes/Exercicio"
import { carregarTarefas, type TarefaLinha } from "../tarefas"
import { useCarga } from "../useCarga"
import { dataCurta, foco } from "../util"

// Minhas tarefas (AUL-04, AUL-09): Pendentes · Enviadas · Aprovadas · Ajustar. Pendente = exercício liberado, ainda sem
// entrega, em vertical que aceita entregas (Bem-Estar fica de fora até a decisão jurídica).
export function Tarefas() {
  const t = useT()
  const lang = useIdioma()
  const caminho = useCaminho()
  const acesso = useAcesso()
  const { sessao } = useAuth()
  const uid = sessao?.user.id ?? ""
  const [estado, recarregar] = useCarga(() => carregarTarefas(uid), uid)
  const chave = "aprender.tarefas.titulo"

  if (acesso.carregando) return <Pagina chave={chave}><Esqueleto linhas={4} /></Pagina>
  if (acesso.erro) return <Pagina chave={chave}><Erro aoTentar={acesso.recarregar}>{t("acesso.erro")}</Erro></Pagina>
  if (!temNivel(acesso.nivel, "grupo")) return <Pagina chave={chave}><Bloqueado frase={t("aprender.tarefas.bloqueado")} /></Pagina>
  if (estado.fase === "carregando") return <Pagina chave={chave}><Esqueleto linhas={4} /></Pagina>
  if (estado.fase === "erro") return <Pagina chave={chave}><Erro aoTentar={recarregar} /></Pagina>

  const todas = estado.dados
  const grupos: [string, Chave, TarefaLinha[], Chave][] = [
    ["pendentes", "aprender.tarefas.pendentes", todas.filter((x) => !x.entrega && x.exercicio.aulas?.verticais?.aceita_entregas), "aprender.tarefas.vazioPendentes"],
    ["enviadas", "aprender.tarefas.enviadas", todas.filter((x) => x.entrega?.status === "enviada"), "aprender.tarefas.vazioEnviadas"],
    ["aprovadas", "aprender.tarefas.aprovadas", todas.filter((x) => x.entrega?.status === "aprovada"), "aprender.tarefas.vazioAprovadas"],
    ["ajustar", "aprender.tarefas.ajustar", todas.filter((x) => x.entrega?.status === "ajustar"), "aprender.tarefas.vazioAjustar"],
  ]
  return (
    <Pagina chave={chave}>
      <Abas
        rotulo={t(chave)}
        // Quem tem algo a ajustar abre direto nessa aba.
        inicial={grupos[3][2].length ? "ajustar" : undefined}
        abas={grupos.map(([k, rotulo, lista, vazio]) => ({
          chave: k,
          rotulo: `${t(rotulo)} (${lista.length})`,
          conteudo: lista.length ? (
            <ul className="space-y-3">
              {lista.map(({ exercicio, entrega }) => (
                <li key={exercicio.id}>
                  <Link to={caminho(`/tarefas/${exercicio.id}`)} className={`flex flex-wrap items-center gap-3 rounded-2xl border border-current/15 bg-superficie/25 p-4 hover:border-current/40 ${foco}`}>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{exercicio.aulas?.titulo}</span>
                      <span className="block text-sm opacity-75">
                        {t("aprender.exercicio.n")} {exercicio.ordem}
                        {entrega ? ` · ${dataCurta(entrega.enviada_em, lang)}` : ""}
                      </span>
                    </span>
                    {entrega ? <SeloStatus status={entrega.status} /> : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Vazio>{t(vazio)}</Vazio>
          ),
        }))}
      />
    </Pagina>
  )
}
