import { useId, useState, type SubmitEvent } from "react"
import { Aviso } from "../../../componentes/Aviso"
import { Botao } from "../../../componentes/Botao"
import { Selo } from "../../../componentes/Selo"
import { useIdioma, useT, type Chave } from "../../../i18n"
import { supabase } from "../../../lib/supabase"
import { campoBase, dataCurta, linkTexto } from "../util"
import type { EntregaLinha, ExercicioLinha } from "../tipos"

// Mesmos limites do bucket `entregas` (migration f2_03). PROVISÓRIO no banco; se mudarem lá, mudam aqui.
const TIPOS = ["application/pdf", "image/png", "image/jpeg", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
const MAX_BYTES = 10 * 1024 * 1024

const rotuloStatus: Record<EntregaLinha["status"], Chave> = {
  enviada: "aprender.status.enviada",
  aprovada: "aprender.status.aprovada",
  ajustar: "aprender.status.ajustar",
}

// "Ajustar" não é erro: sem vermelho (plano de desenho P11). O sentido vai na palavra, não na cor.
export function SeloStatus({ status }: { status: EntregaLinha["status"] }) {
  const t = useT()
  return <Selo tom={status === "enviada" ? "neutro" : "destaque"}>{t(rotuloStatus[status])}</Selo>
}

async function abrirArquivo(caminho: string): Promise<boolean> {
  const { data, error } = await supabase.storage.from("entregas").createSignedUrl(caminho, 60, { download: true })
  if (error || !data) return false
  window.location.assign(data.signedUrl)
  return true
}

// Um exercício: enunciado, a resposta enviada, o status, a devolutiva e (se pode) o formulário de envio/reenvio.
// `podeEnviar` = vertical aceita entregas e o membro é do Grupo (o RLS confere de novo).
// `rascunho`/`aoDigitar` (opcionais): quem hospeda o exercício em abas guarda o texto fora daqui, porque a aba inativa é
// desmontada. `aoDigitar(undefined)` = apagar o rascunho (depois de enviar).
export function Exercicio({ exercicio, entrega, uid, podeEnviar, aoAtualizar, rascunho, aoDigitar }: { exercicio: ExercicioLinha; entrega: EntregaLinha | null; uid: string; podeEnviar: boolean; aoAtualizar: () => void; rascunho?: string; aoDigitar?: (texto: string | undefined) => void }) {
  const t = useT()
  const lang = useIdioma()
  const id = useId()
  const reenvio = entrega?.status === "ajustar" ? entrega : null
  const [local, setLocal] = useState(entrega?.texto ?? "")
  const texto = rascunho ?? local
  const setTexto = (v: string) => {
    setLocal(v)
    aoDigitar?.(v)
  }
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [erro, setErro] = useState<Chave | null>(null)
  const [ok, setOk] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  async function enviar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    setOk(false)
    const limpo = texto.trim()
    if (!limpo && !arquivo && !reenvio?.arquivo_path) return setErro("aprender.exercicio.vazio")
    if (limpo.length > 20000) return setErro("aprender.exercicio.longo")
    if (arquivo && (!TIPOS.includes(arquivo.type) || arquivo.size > MAX_BYTES)) return setErro("aprender.exercicio.arquivoInvalido")
    // Reenviar o mesmo texto sem arquivo novo não muda nada para o banco (e não volta o status): avisa em vez de fingir.
    if (reenvio && limpo === (reenvio.texto ?? "") && !arquivo) return setErro("aprender.exercicio.semMudanca")
    setOcupado(true)
    const antigo = reenvio?.arquivo_path ?? null
    let caminho = antigo
    if (arquivo) {
      const nome = arquivo.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-80)
      caminho = `${uid}/${exercicio.id}-${Date.now()}-${nome}`
      const up = await supabase.storage.from("entregas").upload(caminho, arquivo, { contentType: arquivo.type })
      if (up.error) {
        setOcupado(false)
        return setErro("aprender.exercicio.erroEnvio")
      }
    }
    const valores = { texto: limpo || null, arquivo_path: caminho }
    // UPDATE sob RLS: .select('id') e resposta vazia = erro (Erros 2.5).
    const r = reenvio
      ? await supabase.from("entregas").update(valores).eq("id", reenvio.id).select("id")
      : await supabase.from("entregas").insert({ exercicio_id: exercicio.id, perfil_id: uid, ...valores }).select("id")
    setOcupado(false)
    if (r.error || !r.data || r.data.length === 0) {
      if (arquivo && caminho) void supabase.storage.from("entregas").remove([caminho]) // não deixa arquivo órfão
      return setErro(r.error?.code === "23505" ? "aprender.exercicio.jaEnviado" : "aprender.exercicio.erroEnvio") // o texto fica na tela
    }
    // ponytail: a remoção do arquivo antigo (e a do órfão acima) é best-effort e sem checar o resultado; se falhar, sobra um
    // arquivo solto no bucket do próprio membro. Varrer por job só se o volume incomodar.
    if (arquivo && antigo) void supabase.storage.from("entregas").remove([antigo])
    aoDigitar?.(undefined)
    setArquivo(null)
    setOk(true)
    aoAtualizar()
  }

  const mostrarForm = podeEnviar && (!entrega || reenvio)
  return (
    <article className="rounded-2xl border border-current/15 bg-superficie/25 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-corpo-g font-semibold">
          {t("aprender.exercicio.n")} {exercicio.ordem}
        </h3>
        {entrega ? <SeloStatus status={entrega.status} /> : <Selo>{t("aprender.exercicio.naoEnviado")}</Selo>}
      </header>
      <p className="mt-3 max-w-prose whitespace-pre-line">{exercicio.enunciado_md}</p>
      {exercicio.prazo_dias ? (
        <p className="mt-2 text-sm opacity-75">
          {t("aprender.exercicio.prazo")}: {exercicio.prazo_dias} {t("aprender.exercicio.dias")}
        </p>
      ) : null}

      {entrega ? (
        <section aria-label={t("aprender.exercicio.suaResposta")} className="mt-5 border-t border-current/15 pt-4">
          <h4 className="text-sm font-semibold">
            {t("aprender.exercicio.suaResposta")} · {dataCurta(entrega.enviada_em, lang)}
          </h4>
          {entrega.texto ? <p className="mt-2 max-w-prose whitespace-pre-line opacity-90">{entrega.texto}</p> : null}
          {entrega.arquivo_path ? (
            <button
              type="button"
              className={`mt-2 ${linkTexto}`}
              onClick={async () => {
                if (!(await abrirArquivo(entrega.arquivo_path!))) setErro("aprender.exercicio.erroArquivo")
              }}
            >
              {t("aprender.exercicio.verArquivo")}
            </button>
          ) : null}
        </section>
      ) : null}

      {entrega && entrega.status !== "enviada" && entrega.devolutiva ? (
        <section aria-label={t("aprender.exercicio.devolutiva")} className="mt-5 rounded-xl border-2 border-destaque p-4">
          <h4 className="text-sm font-semibold text-destaque">
            {t("aprender.exercicio.devolutiva")}
            {entrega.corrigido_em ? ` · ${dataCurta(entrega.corrigido_em, lang)}` : ""}
          </h4>
          <p className="mt-2 max-w-prose whitespace-pre-line">{entrega.devolutiva}</p>
        </section>
      ) : null}
      {entrega?.status === "enviada" ? <p className="mt-4 text-sm opacity-75">{t("aprender.exercicio.aguardando")}</p> : null}

      {mostrarForm ? (
        <form onSubmit={enviar} noValidate className="mt-5 space-y-4">
          <div>
            <label htmlFor={`${id}-t`} className="mb-2 block text-sm font-semibold">
              {reenvio ? t("aprender.exercicio.novaResposta") : t("aprender.exercicio.suaResposta")}
            </label>
            <textarea id={`${id}-t`} rows={6} value={texto} onChange={(e) => setTexto(e.target.value)} className={campoBase} />
          </div>
          {exercicio.aceita_arquivo ? (
            <div>
              <label htmlFor={`${id}-a`} className="mb-2 block text-sm font-semibold">
                {t("aprender.exercicio.anexar")}
              </label>
              <input id={`${id}-a`} type="file" accept={TIPOS.join(",")} onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
              <p className="mt-1 text-sm opacity-70">{t("aprender.exercicio.arquivoAjuda")}</p>
            </div>
          ) : null}
          {erro ? <Aviso tipo="erro">{t(erro)}</Aviso> : null}
          <Botao type="submit" ocupado={ocupado} className="sm:w-auto">
            {reenvio ? t("aprender.exercicio.reenviar") : t("aprender.exercicio.enviar")}
          </Botao>
        </form>
      ) : (
        <>
          {erro ? (
            <div className="mt-4">
              <Aviso tipo="erro">{t(erro)}</Aviso>
            </div>
          ) : null}
          {!entrega && !podeEnviar ? <p className="mt-4 text-sm opacity-75">{t("aprender.exercicio.semEnvio")}</p> : null}
        </>
      )}
      {ok ? (
        <div className="mt-4">
          <Aviso tipo="ok">{t("aprender.exercicio.enviado")}</Aviso>
        </div>
      ) : null}
    </article>
  )
}
