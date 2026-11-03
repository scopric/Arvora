import { Link } from "react-router"
import { Abas } from "../../../componentes/Abas"
import { Bloqueado } from "../../../componentes/Bloqueado"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Icone } from "../../../componentes/Icone"
import { Vazio } from "../../../componentes/Vazio"
import { useCaminho, useIdioma, useT, type Chave } from "../../../i18n"
import { temNivel, useAcesso } from "../../../lib/acesso"
import { useAuth } from "../../../lib/sessao"
import { Pagina } from "../componentes/Pagina"
import { SeloStatus } from "../componentes/Exercicio"
import { carregarTarefas, type TarefaLinha } from "../tarefas"
import { useCarga } from "../useCarga"
import { dataCurta } from "../util"

// Minhas tarefas (AUL-04, AUL-09): Pendentes · Enviadas · Aprovadas · Ajustar. Pendente = exercício liberado, ainda sem
// entrega, em vertical que aceita entregas (Bem-Estar fica de fora até a decisão jurídica).
// Molde Linear (lista de issues, tela adf9d449 no cofre): abas por status com contagem; linhas compactas de vidro com
// ícone de status, título, "Exercício n", data e selo à direita.
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
            <ul className="divide-y divide-placa overflow-hidden rounded-lg vidro-fundo">
              {lista.map(({ exercicio, entrega }) => (
                <li key={exercicio.id}>
                  <Link to={caminho(`/tarefas/${exercicio.id}`)} className={`flex min-h-14 items-center gap-4 px-4 py-3 transition-colors hover:bg-creme/3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-dourado`}>
                    <Icone nome={entrega?.status === "aprovada" ? "check" : "arquivo"} className={`size-4 shrink-0 ${entrega?.status === "aprovada" ? "text-destaque" : "text-cinza"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-corpo font-semibold">{exercicio.aulas?.titulo}</span>
                      <span className="mt-0.5 block text-corpo-p text-cinza">
                        {t("aprender.exercicio.n")} {exercicio.ordem}
                        {exercicio.prazo_dias ? ` · ${t("aprender.exercicio.prazo")}: ${exercicio.prazo_dias} ${t("aprender.exercicio.dias")}` : ""}
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
