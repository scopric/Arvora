import { useState } from "react"
import { Link } from "react-router"
import { Abas } from "../../../componentes/Abas"
import { Aviso } from "../../../componentes/Aviso"
import { Bloqueado } from "../../../componentes/Bloqueado"
import { Botao } from "../../../componentes/Botao"
import { DialogoConfirmar } from "../../../componentes/DialogoConfirmar"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Selo } from "../../../componentes/Selo"
import { Vazio } from "../../../componentes/Vazio"
import { useCaminho, useIdioma, useT, type Chave } from "../../../i18n"
import { linkTextoApp } from "../../../componentes/menuApp"
import { PaginaApp } from "../../../componentes/PaginaApp"
import { temNivel, useAcesso } from "../../../lib/acesso"
import { useAuth } from "../../../lib/sessao"
import { supabase } from "../../../lib/supabase"
import { Avatar, Contato } from "../componentes"
import { chaveSlug, COLUNAS_CONEXAO, dia, mudarStatus, ok, useCarga, vitrinesPorId, type Conexao, type Vitrine } from "../lib"

type Dados = { conexoes: Conexao[]; perfis: Map<string, Vitrine> }

// `primario`: só a primeira linha com "Aceitar" ganha o botão dourado (um primário por tela).
function Linha({ c, uid, perfis, aoMudar, primario }: { c: Conexao; uid: string; perfis: Map<string, Vitrine>; aoMudar: () => void | Promise<void>; primario?: boolean }) {
  const t = useT()
  const idioma = useIdioma()
  const caminho = useCaminho()
  const outroId = c.solicitante_id === uid ? c.destinatario_id : c.solicitante_id
  const p = perfis.get(outroId)
  const [erro, setErro] = useState<Chave | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [desfazendo, setDesfazendo] = useState(false)

  async function agir(status: Conexao["status"]) {
    setDesfazendo(false)
    setErro(null)
    setOcupado(true)
    const r = await mudarStatus(c.id, status)
    if (r) {
      setErro(r)
      return setOcupado(false)
    }
    await aoMudar()
    setOcupado(false)
  }
  const recebido = c.destinatario_id === uid
  const botao = "sm:w-auto"
  return (
    <li className="p-4">
      <div className="flex items-start gap-3">
        <Avatar nome={p?.nome ?? null} />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-medium">
            {p ? <Link to={caminho(`/network/${chaveSlug(p)}`)} className={linkTextoApp}>{p.nome}</Link> : t("rede.conexoes.membroIndisponivel")}
          </h2>
          <p className="text-legenda text-nevoa">
            {p?.empresa_nome ? `${p.empresa_nome} · ` : ""}{dia(c.pedida_em, idioma)}
            {c.origem === "match" ? ` · ${t("rede.conexoes.viaMatch")}` : ""}
          </p>
          {c.mensagem ? <p className="mt-2 rounded-md bg-creme/2 px-3 py-2 text-legenda whitespace-pre-wrap shadow-borda">{c.mensagem}</p> : null}
        </div>
      </div>
      {erro ? <div className="mt-3"><Aviso tipo="erro">{t(erro)}</Aviso></div> : null}
      <div className="mt-3 flex flex-wrap items-center gap-3 sm:pl-13">
        {c.status === "pendente" && recebido ? (
          <>
            <Botao variante={primario ? "primario" : "contorno"} onClick={() => void agir("aceita")} ocupado={ocupado} disabled={!p} className={botao}>{t("rede.conexoes.aceitar")}</Botao>
            <Botao variante="contorno" onClick={() => void agir("recusada")} ocupado={ocupado} className={botao}>{t("rede.conexoes.recusar")}</Botao>
          </>
        ) : null}
        {c.status === "pendente" && !recebido ? (
          <>
            <Selo>{t("rede.conexoes.aguardando")}</Selo>
            <Botao variante="contorno" onClick={() => void agir("cancelada")} ocupado={ocupado} className={botao}>{t("rede.conexao.cancelarPedido")}</Botao>
          </>
        ) : null}
        {c.status === "recusada" && !recebido ? <Selo tom="alerta">{t("rede.conexao.naoAceito")}</Selo> : null}
        {c.status === "aceita" ? (
          <>
            <Contato outroId={outroId} />
            <Botao variante="contorno" onClick={() => setDesfazendo(true)} ocupado={ocupado} className={botao}>{t("rede.conexoes.desfazer")}</Botao>
          </>
        ) : null}
      </div>
      <DialogoConfirmar aberto={desfazendo} titulo={t("rede.conexoes.desfazerTitulo")} texto={t("rede.conexoes.desfazerTexto")} confirmar={t("rede.conexoes.desfazer")} perigo aoConfirmar={() => void agir("cancelada")} aoCancelar={() => setDesfazendo(false)} />
    </li>
  )
}

export function Conexoes() {
  const t = useT()
  const acesso = useAcesso()
  const { sessao } = useAuth()
  const uid = sessao?.user.id ?? ""
  const grupo = !acesso.carregando && !acesso.erro && temNivel(acesso.nivel, "grupo")

  const { estado, recarregar } = useCarga(async (): Promise<Dados | null> => {
    if (!grupo) return null
    // O RLS já limita às minhas linhas. ponytail: 200 mais recentes, sem paginação.
    const conexoes = ok(await supabase.from("conexoes").select(COLUNAS_CONEXAO).order("pedida_em", { ascending: false }).limit(200)) as Conexao[]
    const perfis = await vitrinesPorId(conexoes.map((c) => (c.solicitante_id === uid ? c.destinatario_id : c.solicitante_id)))
    return { conexoes, perfis }
  }, `${grupo}`)

  let corpo
  if (acesso.carregando) corpo = <Esqueleto linhas={4} />
  else if (acesso.erro) corpo = <Erro aoTentar={acesso.recarregar}>{t("acesso.erro")}</Erro>
  else if (!grupo) corpo = <Bloqueado minimo={temNivel(acesso.nivel, "clube") ? "grupo" : "clube"} frase={t("rede.conexoes.bloqueado")} />
  else if (estado.fase === "carregando") corpo = <Esqueleto linhas={4} />
  else if (estado.fase === "erro" || !estado.dados) corpo = <Erro aoTentar={recarregar}>{t("rede.conexoes.erro")}</Erro>
  else {
    const { conexoes, perfis } = estado.dados
    const recebidos = conexoes.filter((c) => c.status === "pendente" && c.destinatario_id === uid)
    // Recusadas aparecem nos enviados só como "Pedido não aceito", sem motivo (PRD 6.4).
    const enviados = conexoes.filter((c) => c.solicitante_id === uid && (c.status === "pendente" || c.status === "recusada"))
    const ativas = conexoes.filter((c) => c.status === "aceita")
    const lista = (itens: Conexao[], vazio: Chave) =>
      itens.length === 0 ? (
        <Vazio>{t(vazio)}</Vazio>
      ) : (
        <ul className="divide-y divide-grafite overflow-hidden rounded-xl shadow-borda">{itens.map((c, i) => <Linha key={c.id} c={c} uid={uid} perfis={perfis} aoMudar={recarregar} primario={i === 0} />)}</ul>
      )
    corpo = (
      <Abas
        rotulo={t("rede.conexoes.abas")}
        abas={[
          { chave: "recebidos", rotulo: `${t("rede.conexoes.recebidos")} (${recebidos.length})`, conteudo: lista(recebidos, "rede.conexoes.vazioRecebidos") },
          { chave: "enviados", rotulo: `${t("rede.conexoes.enviados")} (${enviados.length})`, conteudo: lista(enviados, "rede.conexoes.vazioEnviados") },
          { chave: "conexoes", rotulo: `${t("rede.conexoes.conexoes")} (${ativas.length})`, conteudo: lista(ativas, "rede.conexoes.vazioConexoes") },
        ]}
      />
    )
  }
  return (
    <PaginaApp chave="rede.conexoes.titulo" intro={t("rede.conexoes.intro")} estreita>
      {corpo}
    </PaginaApp>
  )
}
