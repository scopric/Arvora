import { useId, useState } from "react"
import { Aviso } from "../../componentes/Aviso"
import { useIdioma, useT, type Chave } from "../../i18n"
import { useAuth } from "../../lib/sessao"
import { aceitesAtivos, conceder, documentoVigente, revogar, type Aceite, type Documento } from "./consentimentos"

// Interruptor de um consentimento (Match, marketing): ligar = novo aceite; desligar = revoga os aceites ativos.
// Sem texto vigente publicado não há o que aceitar: fica desligado, desabilitado e "em breve" (quem já aceitou ainda pode retirar).
export function BlocoConsentimento({ tipo, rotulo, ajuda, docs, aceites, aoMudar }: {
  tipo: string
  rotulo: Chave
  ajuda: Chave
  docs: Documento[]
  aceites: Aceite[]
  aoMudar: () => Promise<void>
}) {
  const t = useT()
  const idioma = useIdioma()
  const { sessao } = useAuth()
  const idAjuda = useId()
  const [ocupado, setOcupado] = useState(false)
  const [falhou, setFalhou] = useState(false)
  const [lido, setLido] = useState(false)
  const doc = documentoVigente(docs, tipo, idioma)
  const ativos = aceitesAtivos(aceites, tipo)
  const ligado = ativos.length > 0

  async function alternar(ligar: boolean) {
    const uid = sessao?.user.id
    const email = sessao?.user.email
    if (!uid || !email || ocupado) return
    setFalhou(false)
    setOcupado(true)
    const ok = ligar ? !!doc && (await conceder(uid, email, doc)) : await revogar(ativos.map((a) => a.id))
    if (!ok) setFalhou(true)
    await aoMudar()
    setOcupado(false)
  }

  return (
    <div className="space-y-3">
      <label className="flex min-h-11 items-center gap-3 font-semibold">
        <input
          type="checkbox"
          role="switch"
          checked={ligado}
          disabled={ocupado || (!ligado && (!doc || !lido))}
          aria-describedby={idAjuda}
          onChange={(e) => void alternar(e.target.checked)}
          className="size-5 accent-dourado"
        />
        {t(rotulo)}
      </label>
      <p id={idAjuda} className="text-sm text-creme/70">{t(ajuda)}</p>
      {!doc && !ligado ? <p className="text-sm font-semibold">{t("conta.consent.emBreve")}</p> : null}
      {doc ? (
        // O texto aparece antes de ligar: o interruptor só destrava depois que a pessoa abre e vê o texto vigente.
        <details onToggle={(e) => e.currentTarget.open && setLido(true)} className="rounded-lg border border-creme/20 px-4 py-2 text-sm">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold">{t("conta.consent.ler")}: {doc.titulo} ({doc.versao})</summary>
          {/* Texto puro, em parágrafos: o React escapa tudo, nada de HTML vindo do banco. */}
          <div className="space-y-3 pb-2 text-creme/80">
            {doc.conteudo_md.split(/\n{2,}/).map((par, i) => <p key={i} className="whitespace-pre-line">{par}</p>)}
          </div>
        </details>
      ) : null}
      {doc && !ligado && !lido ? <p className="text-sm text-creme/70">{t("conta.consent.lerAntes")}</p> : null}
      {falhou ? <Aviso tipo="erro">{t("conta.consent.erro")}</Aviso> : null}
    </div>
  )
}
