import { useEffect, useState } from "react"
import { Link } from "react-router"
import { Aviso } from "../../../componentes/Aviso"
import { Botao } from "../../../componentes/Botao"
import { Cartao } from "../../../componentes/Cartao"
import { Erro } from "../../../componentes/Erro"
import { Esqueleto } from "../../../componentes/Esqueleto"
import { Selo } from "../../../componentes/Selo"
import { Vazio } from "../../../componentes/Vazio"
import { useCaminho, useIdioma, useT } from "../../../i18n"
import { useAuth } from "../../../lib/sessao"
import { supabase } from "../../../lib/supabase"
import { dataCurta } from "../formato"
import { Pagina } from "../Pagina"

const agora = () => new Date().toISOString()
type Item = { id: number; titulo: string; link: string | null; lida_em: string | null; criado_em: string }
type Estado = { fase: "carregando" } | { fase: "erro" } | { fase: "pronto"; itens: Item[] }

export function Notificacoes() {
  const t = useT()
  const idioma = useIdioma()
  const caminho = useCaminho()
  const { sessao } = useAuth()
  const uid = sessao?.user.id
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" })
  const [tentativa, setTentativa] = useState(0)
  const [falhou, setFalhou] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    if (!uid) return
    let ativo = true
    // ponytail: as 100 mais novas; paginar quando alguém passar disso (apagar abre espaço).
    supabase
      .from("notificacoes")
      .select("id, titulo, link, lida_em, criado_em")
      .eq("perfil_id", uid)
      .order("criado_em", { ascending: false })
      .limit(100)
      .then(
        ({ data, error }) => ativo && setEstado(error || !data ? { fase: "erro" } : { fase: "pronto", itens: data }),
        () => ativo && setEstado({ fase: "erro" }),
      )
    return () => {
      ativo = false
    }
  }, [uid, tentativa])

  // Cada ação confirma com .select('id'): sob RLS, resposta vazia é erro (Erros 2.5). Só muda a tela depois do banco confirmar.
  async function agir(pedido: PromiseLike<{ data: { id: number }[] | null; error: unknown }>, esperado: number, aplicar: (itens: Item[]) => Item[]) {
    if (ocupado || estado.fase !== "pronto") return
    setFalhou(false)
    setOcupado(true)
    const { data, error } = await pedido
    setOcupado(false)
    if (error || !data || data.length !== esperado) return setFalhou(true)
    setEstado({ fase: "pronto", itens: aplicar(estado.itens) })
  }

  const marcar = (id: number) =>
    agir(supabase.from("notificacoes").update({ lida_em: agora() }).eq("id", id).select("id"), 1, (itens) =>
      itens.map((i) => (i.id === id ? { ...i, lida_em: agora() } : i)),
    )
  const apagar = (id: number) =>
    agir(supabase.from("notificacoes").delete().eq("id", id).select("id"), 1, (itens) => itens.filter((i) => i.id !== id))
  const marcarTodas = (naoLidas: Item[]) =>
    agir(
      supabase.from("notificacoes").update({ lida_em: agora() }).in("id", naoLidas.map((i) => i.id)).select("id"),
      naoLidas.length,
      (itens) => itens.map((i) => (i.lida_em ? i : { ...i, lida_em: agora() })),
    )

  const naoLidas = estado.fase === "pronto" ? estado.itens.filter((i) => !i.lida_em) : []
  return (
    <Pagina titulo="conta.notificacoes.titulo" menu={false}>
      {estado.fase === "carregando" ? <Esqueleto linhas={4} /> : null}
      {estado.fase === "erro" ? <Erro aoTentar={() => (setEstado({ fase: "carregando" }), setTentativa(tentativa + 1))}>{t("conta.erroCarregar")}</Erro> : null}
      {estado.fase === "pronto" && estado.itens.length === 0 ? <Vazio>{t("conta.notificacoes.vazio")}</Vazio> : null}
      {estado.fase === "pronto" && estado.itens.length > 0 ? (
        <>
          {falhou ? <Aviso tipo="erro">{t("conta.notificacoes.erroAcao")}</Aviso> : null}
          {naoLidas.length > 0 ? (
            <Botao type="button" variante="contorno" ocupado={ocupado} onClick={() => void marcarTodas(naoLidas)} className="sm:w-auto">
              {t("conta.notificacoes.marcarTodas")}
            </Botao>
          ) : null}
          <ul aria-label={t("conta.notificacoes.lista")} className="space-y-3">
            {estado.itens.map((i) => (
              <li key={i.id}>
                <Cartao className="flex flex-col gap-3 !p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className={i.lida_em ? "text-creme/75" : "font-semibold"}>{i.titulo}</p>
                    <p className="mt-1 flex items-center gap-2 text-sm text-creme/60">
                      <time dateTime={i.criado_em}>{dataCurta(i.criado_em, idioma)}</time>
                      {i.lida_em ? null : <Selo tom="destaque">{t("conta.notificacoes.nova")}</Selo>}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {i.link ? (
                      <Link to={caminho(i.link)} aria-label={`${t("conta.notificacoes.abrir")}: ${i.titulo}`} className="inline-flex min-h-11 items-center rounded-lg border border-creme/30 px-4 text-sm font-semibold hover:border-creme/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado">
                        {t("conta.notificacoes.abrir")}
                      </Link>
                    ) : null}
                    {i.lida_em ? null : (
                      <button type="button" disabled={ocupado} aria-label={`${t("conta.notificacoes.marcar")}: ${i.titulo}`} onClick={() => void marcar(i.id)} className="min-h-11 rounded-lg border border-creme/30 px-4 text-sm font-semibold hover:border-creme/60 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado">
                        {t("conta.notificacoes.marcar")}
                      </button>
                    )}
                    <button type="button" disabled={ocupado} aria-label={`${t("conta.notificacoes.apagar")}: ${i.titulo}`} onClick={() => void apagar(i.id)} className="min-h-11 rounded-lg border border-creme/30 px-4 text-sm font-semibold hover:border-creme/60 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado">
                      {t("conta.notificacoes.apagar")}
                    </button>
                  </div>
                </Cartao>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Pagina>
  )
}
