import { useEffect, useRef, useState, type SubmitEvent } from "react"
import { Link } from "react-router"
import { Aviso } from "../../../componentes/Aviso"
import { Botao } from "../../../componentes/Botao"
import { DialogoConfirmar } from "../../../componentes/DialogoConfirmar"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Selo } from "../../../componentes/Selo"
import { Tabela } from "../../../componentes/Tabela"
import { Vazio } from "../../../componentes/Vazio"
import { useCaminho, useIdioma, useT, type Chave } from "../../../i18n"
import { useAuth } from "../../../lib/sessao"
import { supabase } from "../../../lib/supabase"
import { BlocoConsentimento } from "../BlocoConsentimento"
import { revogar, useConsentimentos, type Aceite } from "../consentimentos"
import { dataCurta } from "../formato"
import { Pagina, Secao } from "../Pagina"
import { botaoPequenoApp } from "../../../componentes/botaoEstilo"
import { linkTextoApp } from "../../../componentes/menuApp"

// Retirar vale para o que é escolha do titular. Termos, privacidade, reembolso e arrependimento são condição da conta
// (para retirar, a pessoa exclui a conta); a escolha de cookies é feita no banner e em /cookies, não aqui.
const REVOGAVEIS = ["match", "marketing", "hall_of_fame"]

type Visib = { fase: "carregando" } | { fase: "erro" } | { fase: "pronto"; visibilidade: "membros" | "publico"; aprovado: boolean }

export function Privacidade() {
  const t = useT()
  const { sessao } = useAuth()
  const uid = sessao?.user.id
  const { estado, recarregar } = useConsentimentos(uid)
  return (
    <Pagina titulo="conta.privacidade.titulo">
      {uid ? <BlocoVisibilidade uid={uid} /> : null}
      {estado.fase === "carregando" ? <Esqueleto linhas={4} /> : null}
      {estado.fase === "erro" ? <Erro aoTentar={recarregar}>{t("conta.erroCarregar")}</Erro> : null}
      {estado.fase === "pronto" ? (
        <>
          <Secao titulo={t("conta.privacidade.match.titulo")}>
            <BlocoConsentimento tipo="match" rotulo="conta.privacidade.match.rotulo" ajuda="conta.privacidade.match.texto" docs={estado.docs} aceites={estado.aceites} aoMudar={recarregar} />
          </Secao>
          <ListaConsentimentos aceites={estado.aceites} aoMudar={recarregar} />
        </>
      ) : null}
    </Pagina>
  )
}

function BlocoVisibilidade({ uid }: { uid: string }) {
  const t = useT()
  const [estado, setEstado] = useState<Visib>({ fase: "carregando" })
  const [msg, setMsg] = useState<{ tipo: "erro" | "ok"; texto: Chave } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let ativo = true
    supabase.from("perfis").select("visibilidade, publico_aprovado_em").eq("id", uid).maybeSingle().then(
      ({ data, error }) => ativo && setEstado(error || !data ? { fase: "erro" } : { fase: "pronto", visibilidade: data.visibilidade, aprovado: !!data.publico_aprovado_em }),
      () => ativo && setEstado({ fase: "erro" }),
    )
    return () => {
      ativo = false
    }
  }, [uid, tentativa])

  async function salvar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const valor = new FormData(e.currentTarget).get("visibilidade")
    if ((valor !== "membros" && valor !== "publico") || estado.fase !== "pronto") return
    setMsg(null)
    // Nada mudou: não grava (gravar tiraria a página pública do ar sem motivo) e não promete aprovação.
    if (valor === estado.visibilidade) return setMsg({ tipo: "ok", texto: "conta.privacidade.visib.igual" })
    setOcupado(true)
    // .select('id'): sob RLS um UPDATE que não casa linha volta "ok" e vazio (Erros 2.5).
    const { data, error } = await supabase.from("perfis").update({ visibilidade: valor }).eq("id", uid).select("id")
    setOcupado(false)
    if (error || !data || data.length === 0) return setMsg({ tipo: "erro", texto: "conta.erroSalvar" })
    // O gatilho do banco tira a página pública do ar até nova aprovação (ADM-02).
    setEstado({ fase: "pronto", visibilidade: valor, aprovado: false })
    setMsg({ tipo: "ok", texto: "conta.salvo" })
  }

  return (
    <Secao titulo={t("conta.privacidade.visib.titulo")} texto={t("conta.privacidade.visib.aviso")}>
      {estado.fase === "carregando" ? <Esqueleto linhas={2} /> : null}
      {estado.fase === "erro" ? <div><Erro aoTentar={() => (setEstado({ fase: "carregando" }), setTentativa((n) => n + 1))}>{t("conta.erroCarregar")}</Erro></div> : null}
      {estado.fase === "pronto" ? (
        <form key={estado.visibilidade} onSubmit={salvar} className="space-y-4">
          {msg ? <Aviso tipo={msg.tipo}>{t(msg.texto)}</Aviso> : null}
          <fieldset className="space-y-3">
            <legend className="sr-only">{t("conta.privacidade.visib.titulo")}</legend>
            <label className="flex min-h-9 items-center gap-3 text-base pointer-coarse:min-h-11">
              <input type="radio" name="visibilidade" value="membros" defaultChecked={estado.visibilidade === "membros"} className="size-4 accent-dourado" />
              {t("conta.privacidade.visib.membros")}
            </label>
            <label className="flex min-h-9 items-center gap-3 text-base pointer-coarse:min-h-11">
              <input type="radio" name="visibilidade" value="publico" defaultChecked={estado.visibilidade === "publico"} className="size-4 accent-dourado" />
              {t("conta.privacidade.visib.publico")}
            </label>
          </fieldset>
          {estado.visibilidade === "publico" ? (
            <p className="text-corpo-p text-nevoa">{t(estado.aprovado ? "conta.privacidade.visib.aprovado" : "conta.privacidade.visib.aguarda")}</p>
          ) : null}
          <Botao type="submit" ocupado={ocupado} className="sm:w-auto">{t("conta.privacidade.visib.salvar")}</Botao>
        </form>
      ) : null}
    </Secao>
  )
}

function ListaConsentimentos({ aceites, aoMudar }: { aceites: Aceite[]; aoMudar: () => Promise<void> }) {
  const t = useT()
  const idioma = useIdioma()
  const [alvo, setAlvo] = useState<Aceite | null>(null)
  const [falhou, setFalhou] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const caminho = useCaminho()
  const titulo = useRef<HTMLHeadingElement>(null)

  async function retirar() {
    if (!alvo) return
    const id = alvo.id
    setAlvo(null)
    setFalhou(false)
    setOcupado(true)
    if (!(await revogar([id]))) setFalhou(true)
    await aoMudar()
    setOcupado(false)
    // O botão que abriu o diálogo some (a linha vira "Retirado"): o foco vai para o título da lista, não se perde.
    titulo.current?.focus()
  }

  return (
    <section>
      <h2 ref={titulo} tabIndex={-1} className="text-base font-semibold outline-none">{t("conta.consent.lista.titulo")}</h2>
      <p className="mt-1 text-corpo-p text-nevoa">{t("conta.consent.lista.texto")}</p>
      <div className="mt-4 space-y-4">
        {falhou ? <Aviso tipo="erro">{t("conta.consent.erro")}</Aviso> : null}
        {aceites.length === 0 ? (
          <Vazio>{t("conta.consent.lista.vazio")}</Vazio>
        ) : (
          <Tabela
            legenda={t("conta.consent.lista.titulo")}
            linhas={aceites}
            id={(a) => a.id}
            colunas={[
              { chave: "doc", titulo: t("conta.consent.col.documento"), celula: (a) => a.documentos_legais?.titulo ?? "—" },
              { chave: "versao", titulo: t("conta.consent.col.versao"), celula: (a) => a.documentos_legais?.versao ?? "—" },
              { chave: "aceito", titulo: t("conta.consent.col.aceito"), celula: (a) => dataCurta(a.aceito_em, idioma) },
              {
                chave: "situacao",
                titulo: t("conta.consent.col.situacao"),
                celula: (a) => (a.revogado_em ? <Selo tom="neutro">{t("conta.consent.retiradoEm")} {dataCurta(a.revogado_em, idioma)}</Selo> : <Selo tom="destaque">{t("conta.consent.ativo")}</Selo>),
              },
              {
                chave: "acao",
                titulo: t("conta.consent.col.acao"),
                celula: (a) =>
                  a.revogado_em ? null : REVOGAVEIS.includes(a.documentos_legais?.tipo ?? "") ? (
                    <button type="button" disabled={ocupado} aria-label={`${t("conta.consent.retirar")}: ${a.documentos_legais?.titulo ?? ""}`} onClick={() => setAlvo(a)} className={botaoPequenoApp}>
                      {t("conta.consent.retirar")}
                    </button>
                  ) : a.documentos_legais?.tipo === "cookies" ? (
                    <Link to={caminho("/cookies")} className={linkTextoApp}>{t("conta.consent.cookies")}</Link>
                  ) : (
                    <span className="text-nevoa">{t("conta.consent.condicao")}</span>
                  ),
              },
            ]}
          />
        )}
      </div>
      <DialogoConfirmar
        aberto={alvo !== null}
        titulo={t("conta.consent.dialogo.titulo")}
        texto={t("conta.consent.dialogo.texto")}
        confirmar={t("conta.consent.retirar")}
        perigo
        aoConfirmar={() => void retirar()}
        aoCancelar={() => setAlvo(null)}
      />
    </section>
  )
}
