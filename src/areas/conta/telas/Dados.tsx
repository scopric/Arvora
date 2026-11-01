import { useEffect, useState, type SubmitEvent } from "react"
import { useNavigate } from "react-router"
import { Aviso } from "../../../componentes/Aviso"
import { Botao } from "../../../componentes/Botao"
import { Campo } from "../../../componentes/Campo"
import { Cartao } from "../../../componentes/Cartao"
import { DialogoConfirmar } from "../../../componentes/DialogoConfirmar"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Tabela } from "../../../componentes/Tabela"
import { Vazio } from "../../../componentes/Vazio"
import type { TablesInsert } from "../../../lib/database.types"
import { useCaminho, useIdioma, useT, type Chave } from "../../../i18n"
import { useAcesso } from "../../../lib/acesso"
import { baixarMeusDados } from "../../../lib/exportar"
import { excluirMinhaConta } from "../../../lib/excluirConta"
import { useAuth } from "../../../lib/sessao"
import { supabase } from "../../../lib/supabase"
import { dataCurta, dataDoDia } from "../formato"
import { Pagina } from "../Pagina"

type Pedido = { id: number; tipo: string; status: string; prazo_em: string; criado_em: string }
type Tipo = "exportacao" | "exclusao"
const TIPOS: Record<string, Chave> = { exportacao: "conta.dados.tipo.exportacao", exclusao: "conta.dados.tipo.exclusao", retificacao: "conta.dados.tipo.retificacao" }
const STATUS: Record<string, Chave> = {
  recebido: "conta.dados.status.recebido",
  em_andamento: "conta.dados.status.em_andamento",
  concluido: "conta.dados.status.concluido",
  recusado: "conta.dados.status.recusado",
}

export function Dados() {
  const { sessao } = useAuth()
  const uid = sessao?.user.id
  return (
    <Pagina titulo="conta.dados.titulo">
      <BlocoExportar />
      {uid ? <BlocoPedidos uid={uid} /> : null}
      <BlocoExcluir />
    </Pagina>
  )
}

function BlocoExportar() {
  const t = useT()
  const [baixando, setBaixando] = useState(false)
  const [erro, setErro] = useState<Chave | null>(null)
  async function baixar() {
    setErro(null)
    setBaixando(true)
    try {
      setErro(await baixarMeusDados())
    } catch {
      setErro("perfil.dados.erro")
    } finally {
      setBaixando(false)
    }
  }
  return (
    <Cartao>
      <h2 className="font-titulo text-2xl font-bold uppercase">{t("conta.dados.exportar.titulo")}</h2>
      <p className="mt-3 text-sm text-creme/70">{t("conta.dados.exportar.texto")}</p>
      {erro ? <div className="mt-4"><Aviso tipo="erro">{t(erro)}</Aviso></div> : null}
      <Botao type="button" variante="contorno" ocupado={baixando} onClick={() => void baixar()} className="mt-5 sm:w-auto">{t("conta.dados.exportar.botao")}</Botao>
    </Cartao>
  )
}

// Pedido manual (CON-04): linha em pedidos_gdpr, atendida pela equipe em até um mês (prazo_em vem do banco).
function BlocoPedidos({ uid }: { uid: string }) {
  const t = useT()
  const idioma = useIdioma()
  const [lista, setLista] = useState<{ fase: "carregando" } | { fase: "erro" } | { fase: "pronto"; itens: Pedido[] }>({ fase: "carregando" })
  const [tentativa, setTentativa] = useState(0)
  const [msg, setMsg] = useState<{ tipo: "erro" | "ok"; texto: Chave } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [confirmar, setConfirmar] = useState<Tipo | null>(null)

  useEffect(() => {
    let ativo = true
    // perfil_id explícito: o super_admin lê todos os pedidos e aqui só entram os do titular.
    supabase.from("pedidos_gdpr").select("id, tipo, status, prazo_em, criado_em").eq("perfil_id", uid).order("criado_em", { ascending: false }).then(
      ({ data, error }) => ativo && setLista(error || !data ? { fase: "erro" } : { fase: "pronto", itens: data }),
      () => ativo && setLista({ fase: "erro" }),
    )
    return () => {
      ativo = false
    }
  }, [uid, tentativa])

  async function pedir(tipo: Tipo) {
    setConfirmar(null)
    setMsg(null)
    setOcupado(true)
    // O grant de insert é só (perfil_id, tipo); e-mail e prazo vêm do gatilho, mas os tipos gerados os marcam como obrigatórios.
    // `satisfies` confere o que enviamos; o cast é só para esses dois campos que o banco preenche.
    const linha = { perfil_id: uid, tipo } satisfies Pick<TablesInsert<"pedidos_gdpr">, "perfil_id" | "tipo">
    const { data, error } = await supabase.from("pedidos_gdpr").insert(linha as TablesInsert<"pedidos_gdpr">).select("id")
    setOcupado(false)
    // Índice único: um pedido aberto por tipo e por pessoa.
    if (error?.code === "23505") return setMsg({ tipo: "erro", texto: "conta.dados.pedido.jaAberto" })
    if (error || !data || data.length === 0) return setMsg({ tipo: "erro", texto: "conta.dados.pedido.erro" })
    setMsg({ tipo: "ok", texto: "conta.dados.pedido.enviado" })
    setTentativa((n) => n + 1)
  }

  return (
    <Cartao>
      <h2 className="font-titulo text-2xl font-bold uppercase">{t("conta.dados.pedido.titulo")}</h2>
      <p className="mt-3 text-sm text-creme/70">{t("conta.dados.pedido.texto")}</p>
      <div className="mt-5 space-y-4">
        {msg ? <Aviso tipo={msg.tipo}>{t(msg.texto)}</Aviso> : null}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Botao type="button" variante="contorno" ocupado={ocupado} onClick={() => setConfirmar("exportacao")} className="sm:w-auto">{t("conta.dados.pedido.exportacao")}</Botao>
          <Botao type="button" variante="contorno" ocupado={ocupado} onClick={() => setConfirmar("exclusao")} className="sm:w-auto">{t("conta.dados.pedido.exclusao")}</Botao>
        </div>
        <h3 className="pt-2 text-sm font-semibold">{t("conta.dados.lista.titulo")}</h3>
        {lista.fase === "carregando" ? <Esqueleto linhas={2} /> : null}
        {lista.fase === "erro" ? <Erro aoTentar={() => (setLista({ fase: "carregando" }), setTentativa((n) => n + 1))}>{t("conta.erroCarregar")}</Erro> : null}
        {lista.fase === "pronto" && lista.itens.length === 0 ? <Vazio>{t("conta.dados.lista.vazio")}</Vazio> : null}
        {lista.fase === "pronto" && lista.itens.length > 0 ? (
          <Tabela
            legenda={t("conta.dados.lista.titulo")}
            linhas={lista.itens}
            id={(p) => p.id}
            colunas={[
              { chave: "tipo", titulo: t("conta.dados.col.tipo"), celula: (p) => (TIPOS[p.tipo] ? t(TIPOS[p.tipo]) : p.tipo) },
              { chave: "status", titulo: t("conta.dados.col.status"), celula: (p) => (STATUS[p.status] ? t(STATUS[p.status]) : p.status) },
              { chave: "recebido", titulo: t("conta.dados.col.recebido"), celula: (p) => dataCurta(p.criado_em, idioma) },
              { chave: "prazo", titulo: t("conta.dados.col.prazo"), celula: (p) => dataDoDia(p.prazo_em, idioma) },
            ]}
          />
        ) : null}
      </div>
      <DialogoConfirmar
        aberto={confirmar !== null}
        titulo={t(confirmar === "exclusao" ? "conta.dados.pedido.dialogoExclusao" : "conta.dados.pedido.dialogoExportacao")}
        texto={t(confirmar === "exclusao" ? "conta.dados.pedido.dialogoTextoExclusao" : "conta.dados.pedido.dialogoTextoExportacao")}
        confirmar={t("conta.dados.pedido.enviar")}
        perigo={confirmar === "exclusao"}
        aoConfirmar={() => confirmar && void pedir(confirmar)}
        aoCancelar={() => setConfirmar(null)}
      />
    </Cartao>
  )
}

// Duas etapas: (1) o diálogo explica o que se perde; (2) só então aparecem e-mail e senha, que o servidor reconfere.
function BlocoExcluir() {
  const t = useT()
  const navegar = useNavigate()
  const caminho = useCaminho()
  const { equipe } = useAcesso()
  const [dialogo, setDialogo] = useState(false)
  const [etapa2, setEtapa2] = useState(false)
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [erro, setErro] = useState<Chave | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function excluir(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (ocupado || !email.trim() || !senha) return
    setErro(null)
    setOcupado(true)
    const falha = await excluirMinhaConta(email, senha)
    if (falha) {
      setOcupado(false)
      return setErro(falha)
    }
    navegar(caminho("/"), { replace: true })
  }

  return (
    <Cartao>
      <h2 className="font-titulo text-2xl font-bold uppercase">{t("conta.dados.excluir.titulo")}</h2>
      <div className="mt-3 space-y-2 text-sm text-creme/80">
        <p>{t("perfil.excluir.aviso")}</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t("perfil.excluir.perde")}</li>
          <li>{t("perfil.excluir.assinatura")}</li>
          <li>{t("perfil.excluir.retidos")}</li>
          <li>{t("perfil.excluir.backup")}</li>
        </ul>
      </div>
      {equipe ? (
        <div className="mt-5"><Aviso tipo="erro">{t("erro.excluir.equipe")}</Aviso></div>
      ) : !etapa2 ? (
        <Botao type="button" variante="contorno" onClick={() => setDialogo(true)} className="mt-5 sm:w-auto">{t("conta.dados.excluir.abrir")}</Botao>
      ) : (
        <form onSubmit={excluir} noValidate className="mt-5 space-y-5">
          <p className="text-sm font-semibold">{t("conta.dados.excluir.etapa2")}</p>
          {erro ? <Aviso tipo="erro">{t(erro)}</Aviso> : null}
          <Campo rotulo={t("perfil.excluir.email")} name="confirmar_email" type="email" autoComplete="off" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          <Campo rotulo={t("perfil.excluir.senha")} name="confirmar_senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          <div className="flex flex-col gap-3 sm:flex-row">
            <Botao type="submit" variante="contorno" ocupado={ocupado} disabled={!email.trim() || !senha} className="sm:w-auto">{t("perfil.excluir.confirmar")}</Botao>
            <Botao type="button" variante="contorno" disabled={ocupado} onClick={() => (setEtapa2(false), setErro(null))} className="sm:w-auto">{t("comum.cancelar")}</Botao>
          </div>
        </form>
      )}
      <DialogoConfirmar
        aberto={dialogo}
        titulo={t("conta.dados.excluir.dialogoTitulo")}
        texto={t("conta.dados.excluir.dialogoTexto")}
        confirmar={t("conta.dados.excluir.continuar")}
        perigo
        aoConfirmar={() => (setDialogo(false), setEtapa2(true))}
        aoCancelar={() => setDialogo(false)}
      />
    </Cartao>
  )
}
