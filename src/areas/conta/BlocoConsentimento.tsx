import { useId, useState } from "react"
import { Aviso } from "../../componentes/Aviso"
import { useIdioma, useT, type Chave } from "../../i18n"
import { useAuth } from "../../lib/sessao"
import { aceitesAtivos, conceder, documentoVigente, revogar, type Aceite, type Documento } from "./consentimentos"
import { focoApp } from "../../componentes/menuApp"
import { Interruptor } from "./Pagina"

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
    <div className="space-y-4">
      <Interruptor
        rotulo={t(rotulo)}
        ajuda={t(ajuda)}
        idAjuda={idAjuda}
        checked={ligado}
        disabled={ocupado || (!ligado && (!doc || !lido))}
        onChange={(e) => void alternar(e.target.checked)}
      />
      {!doc && !ligado ? <p className="text-corpo-p font-semibold text-cinza">{t("conta.consent.emBreve")}</p> : null}
      {doc ? (
        // O texto aparece antes de ligar: o interruptor só destrava depois que a pessoa abre e vê o texto vigente.
        <details onToggle={(e) => e.currentTarget.open && setLido(true)} className="rounded-lg bg-ardosia px-4 py-1 shadow-borda">
          <summary className={`min-h-10 cursor-pointer rounded-sm py-2 text-corpo-p font-semibold text-cinza pointer-coarse:min-h-11 hover:text-creme ${focoApp}`}>{t("conta.consent.ler")}: {doc.titulo} ({doc.versao})</summary>
          {/* Texto puro, em parágrafos: o React escapa tudo, nada de HTML vindo do banco. */}
          <div className="mt-1 mb-3 space-y-3 text-corpo">
            {doc.conteudo_md.split(/\n{2,}/).map((par, i) => <p key={i} className="whitespace-pre-line">{par}</p>)}
          </div>
        </details>
      ) : null}
      {doc && !ligado && !lido ? <p className="text-corpo-p text-cinza">{t("conta.consent.lerAntes")}</p> : null}
      {falhou ? <Aviso tipo="erro">{t("conta.consent.erro")}</Aviso> : null}
    </div>
  )
}
