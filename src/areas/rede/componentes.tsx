import { Children, useEffect, useId, useRef, useState, type ReactNode, type SubmitEvent } from "react"
import { Link } from "react-router"
import { Aviso } from "../../componentes/Aviso"
import { Botao } from "../../componentes/Botao"
import { Selecao } from "../../componentes/Campo"
import { Selo } from "../../componentes/Selo"
import { useCaminho, useIdioma, useT, type Chave } from "../../i18n"
import { supabase } from "../../lib/supabase"
import { chaveSlug, dia, iniciais, mudarStatus, pedirConexao, podePedirDe, type Conexao, type Vitrine } from "./lib"

export const campoTexto =
  "w-full rounded-lg border border-creme/25 bg-transparent px-4 py-3 text-base outline-none focus-visible:border-dourado focus-visible:ring-2 focus-visible:ring-dourado/40"

// Avatar de iniciais: a foto de perfil ainda não tem bucket (fora do lançamento), então ninguém mostra imagem aqui.
export function Avatar({ nome }: { nome: string | null }) {
  return (
    <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full border border-creme/25 bg-superficie/40 font-titulo text-xl">
      {iniciais(nome)}
    </span>
  )
}

// Diálogo com <dialog> nativo (foco preso, Esc fecha). O conteúdo (formulário) vem de quem usa.
export function Dialogo({ aberto, titulo, aoFechar, children }: { aberto: boolean; titulo: string; aoFechar: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (aberto && !d.open) d.showModal()
    if (!aberto && d.open) d.close()
  }, [aberto])
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault()
        aoFechar()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-creme/20 bg-painel p-6 text-creme backdrop:bg-black/60"
    >
      <h2 id={id} className="font-titulo text-3xl font-bold uppercase">{titulo}</h2>
      {aberto ? children : null}
    </dialog>
  )
}

export type AlvoDenuncia = { perfil_denunciado_id: string } | { post_id: number } | { comentario_id: number }
// Motivo é um código curto e estável (a coluna aceita até 80 caracteres); a equipe lê o código e o texto livre.
const MOTIVOS = ["spam", "assedio", "improprio", "golpe", "outro"] as const

// Denúncia (COM-02, NET-04): cai na fila de moderação. Não oculta nada sozinha.
export function DialogoDenuncia({ alvo, aberto, aoFechar }: { alvo: AlvoDenuncia; aberto: boolean; aoFechar: () => void }) {
  const t = useT()
  const [erro, setErro] = useState(false)
  const [enviado, setEnviado] = useState<"nao" | "ok" | "ja">("nao") // fica gravado enquanto a tela viver: sem reenvio
  const [ocupado, setOcupado] = useState(false)

  async function enviar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const texto = String(f.get("texto") ?? "").trim()
    setErro(false)
    setOcupado(true)
    const { error } = await supabase.from("denuncias").insert({ ...alvo, motivo: String(f.get("motivo")), texto: texto || null })
    setOcupado(false)
    // 23505: o banco só aceita uma denúncia por pessoa e alvo.
    if (error?.code === "23505") return setEnviado("ja")
    if (error) return setErro(true)
    setEnviado("ok")
  }
  function fechar() {
    setErro(false)
    aoFechar()
  }
  return (
    <Dialogo aberto={aberto} titulo={t("rede.denuncia.titulo")} aoFechar={fechar}>
      {enviado !== "nao" ? (
        <div className="mt-4 space-y-5">
          <Aviso tipo="ok">{t(enviado === "ja" ? "rede.denuncia.jaDenunciou" : "rede.denuncia.enviada")}</Aviso>
          <Botao variante="contorno" onClick={fechar}>{t("comum.fechar")}</Botao>
        </div>
      ) : (
        <form onSubmit={enviar} className="mt-4 space-y-5">
          <p className="text-sm opacity-80">{t("rede.denuncia.texto")}</p>
          {erro ? <Aviso tipo="erro">{t("rede.denuncia.erro")}</Aviso> : null}
          <Selecao rotulo={t("rede.denuncia.motivo")} name="motivo" required defaultValue="">
            <option value="" disabled>{t("rede.denuncia.escolha")}</option>
            {MOTIVOS.map((m) => (
              <option key={m} value={m}>{t(`rede.denuncia.motivo.${m}`)}</option>
            ))}
          </Selecao>
          <div>
            <label htmlFor="den-texto" className="mb-2 block text-sm font-semibold">{t("rede.denuncia.detalhe")}</label>
            <textarea id="den-texto" name="texto" rows={3} maxLength={1000} className={campoTexto} />
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Botao type="button" variante="contorno" onClick={fechar} className="sm:w-auto">{t("comum.cancelar")}</Botao>
            <Botao type="submit" ocupado={ocupado} className="sm:w-auto">{t("rede.denuncia.enviar")}</Botao>
          </div>
        </form>
      )}
    </Dialogo>
  )
}

// Cartão de membro (Network e Match): nome, empresa, setor · cidade; `tags` e `acoes` vêm de quem usa.
export function CartaoPerfil({ perfil, setor, tags, children, acoes }: { perfil: Vitrine; setor?: string; tags?: ReactNode; children?: ReactNode; acoes?: ReactNode }) {
  const caminho = useCaminho()
  const local = [setor, perfil.cidade].filter(Boolean).join(" · ")
  return (
    <li className="rounded-2xl border border-current/15 bg-superficie/25 p-5">
      <div className="flex items-start gap-4">
        <Avatar nome={perfil.nome} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">
            <Link to={caminho(`/network/${chaveSlug(perfil)}`)} className="hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado">{perfil.nome}</Link>
          </h2>
          {perfil.empresa_nome ? <p className="text-sm opacity-80">{perfil.empresa_nome}</p> : null}
          {local ? <p className="text-sm opacity-60">{local}</p> : null}
          {Children.count(tags) > 0 ? <ul className="mt-3 flex flex-wrap gap-2">{tags}</ul> : null}
        </div>
      </div>
      {children}
      {acoes ? <div className="mt-4 flex flex-wrap items-center gap-3">{acoes}</div> : null}
    </li>
  )
}

export const Etiqueta = ({ children }: { children: ReactNode }) => <li><Selo>{children}</Selo></li>

// Contato só depois do aceite (NET-03): a RPC revelar_contato é quem decide; aqui só se chama e se mostra.
export function Contato({ outroId }: { outroId: string }) {
  const t = useT()
  const [estado, setEstado] = useState<"fechado" | "carregando" | "erro" | "indisponivel" | { email: string | null; whatsapp: string | null } | "vazio">("fechado")
  async function ver() {
    setEstado("carregando")
    const { data, error } = await supabase.rpc("revelar_contato", { outro: outroId })
    if (error) return setEstado(error.code === "42501" ? "indisponivel" : "erro")
    const c = data?.[0]
    setEstado(c && (c.email_contato || c.whatsapp) ? { email: c.email_contato, whatsapp: c.whatsapp } : "vazio")
  }
  if (estado === "fechado" || estado === "carregando" || estado === "erro")
    return (
      <div>
        {estado === "erro" ? <Aviso tipo="erro">{t("rede.contato.erro")}</Aviso> : null}
        <Botao variante="contorno" onClick={() => void ver()} ocupado={estado === "carregando"} className={`sm:w-auto ${estado === "erro" ? "mt-3" : ""}`}>
          {t("rede.contato.ver")}
        </Botao>
      </div>
    )
  if (estado === "indisponivel") return <p className="text-sm opacity-80">{t("rede.contato.indisponivel")}</p>
  if (estado === "vazio") return <p className="text-sm opacity-80">{t("rede.contato.vazio")}</p>
  return (
    <dl className="space-y-1 text-sm">
      {estado.email ? (
        <div className="flex gap-2"><dt className="font-semibold">{t("rede.contato.email")}</dt><dd><a href={`mailto:${estado.email}`} className="underline">{estado.email}</a></dd></div>
      ) : null}
      {estado.whatsapp ? (
        <div className="flex gap-2"><dt className="font-semibold">WhatsApp</dt><dd><a href={`https://wa.me/${estado.whatsapp.replace(/\D/g, "")}`} className="underline">{estado.whatsapp}</a></dd></div>
      ) : null}
    </dl>
  )
}

// Botão certo para o estado do par (Network, perfil e Match). `conexao` = linha do par, se existir.
export function AcaoConexao({ uid, outroId, nome, origem, conexao, aoMudar }: { uid: string; outroId: string; nome: string; origem: Conexao["origem"]; conexao?: Conexao; aoMudar: () => void | Promise<void> }) {
  const t = useT()
  const caminho = useCaminho()
  const idioma = useIdioma()
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<Chave | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [agora] = useState(() => Date.now())

  async function enviar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setOcupado(true)
    const r = await pedirConexao(outroId, origem, String(new FormData(e.currentTarget).get("mensagem") ?? ""), conexao)
    setErro(r)
    if (!r) {
      setAberto(false)
      await aoMudar() // segue ocupado até a leitura nova chegar
    }
    setOcupado(false)
  }
  async function cancelar() {
    if (!conexao) return
    setOcupado(true)
    const r = await mudarStatus(conexao.id, "cancelada")
    setErro(r)
    if (!r) await aoMudar()
    setOcupado(false)
  }

  const refazer = conexao && (conexao.status === "recusada" || conexao.status === "cancelada")
  const liberaEm = refazer ? podePedirDe(conexao) : null
  const podeAgora = !!liberaEm && liberaEm.getTime() <= agora
  let corpo: ReactNode
  if (!conexao || podeAgora) {
    corpo = <Botao onClick={() => setAberto(true)} className="sm:w-auto">{t(conexao ? "rede.conexao.pedirDeNovo" : "rede.conexao.pedir")}</Botao>
  } else if (conexao.status === "pendente" && conexao.solicitante_id === uid) {
    corpo = (
      <>
        <Selo tom="destaque">{t("rede.conexao.enviado")}</Selo>
        <Botao variante="contorno" onClick={() => void cancelar()} ocupado={ocupado} className="sm:w-auto">{t("rede.conexao.cancelarPedido")}</Botao>
      </>
    )
  } else if (conexao.status === "pendente") {
    corpo = (
      <>
        <Selo tom="destaque">{t("rede.conexao.recebido")}</Selo>
        <Link to={caminho("/conexoes")} className="inline-flex min-h-12 items-center underline">{t("rede.conexao.responder")}</Link>
      </>
    )
  } else if (conexao.status === "aceita") {
    corpo = <Selo tom="destaque">{t("rede.conexao.conectados")}</Selo>
  } else {
    corpo = (
      <p className="text-sm opacity-80">
        {t(conexao.status === "recusada" && conexao.solicitante_id === uid ? "rede.conexao.naoAceito" : "rede.conexao.encerrada")}{" "}
        {liberaEm ? `${t("rede.conexao.novoPedidoEm")} ${dia(liberaEm.toISOString(), idioma)}.` : null}
      </p>
    )
  }
  return (
    <>
      {corpo}
      {erro && !aberto ? <Aviso tipo="erro">{t(erro)}</Aviso> : null}
      <Dialogo aberto={aberto} titulo={`${t("rede.conexao.pedirA")} ${nome}`} aoFechar={() => setAberto(false)}>
        <form onSubmit={enviar} className="mt-4 space-y-5">
          <p className="text-sm opacity-80">{t("rede.conexao.dica")}</p>
          {erro ? <Aviso tipo="erro">{t(erro)}</Aviso> : null}
          <div>
            <label htmlFor="cx-msg" className="mb-2 block text-sm font-semibold">{t("rede.conexao.mensagem")}</label>
            <textarea id="cx-msg" name="mensagem" rows={3} maxLength={500} className={campoTexto} />
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Botao type="button" variante="contorno" onClick={() => setAberto(false)} className="sm:w-auto">{t("comum.cancelar")}</Botao>
            <Botao type="submit" ocupado={ocupado} className="sm:w-auto">{t("rede.conexao.enviar")}</Botao>
          </div>
        </form>
      </Dialogo>
    </>
  )
}
