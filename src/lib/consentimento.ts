// Consentimento de cookies/analytics. Sem analytics hoje: só armazenamento estritamente necessário.
// Mudou o texto do banner? Suba a versão: a escolha antiga deixa de valer e o banner volta.
export const VERSAO_CONSENTIMENTO = "2026-10-provisorio"
const CHAVE = "arvora.consentimento"

export type Escolha = "aceito" | "recusado"
export type Consentimento = { versao: string; escolha: Escolha; em: string }

const EVENTO = "arvora:consentimento"
let memoria: Consentimento | null = null // vale na visita se o localStorage estiver bloqueado

// Avisa o banner (que vive no layout raiz) de que a escolha mudou.
export function aoMudarConsentimento(cb: () => void) {
  window.addEventListener(EVENTO, cb)
  return () => window.removeEventListener(EVENTO, cb)
}
const avisar = () => window.dispatchEvent(new Event(EVENTO))

export function lerConsentimento(): Consentimento | null {
  if (memoria) return memoria
  try {
    const c = JSON.parse(localStorage.getItem(CHAVE) ?? "null")
    const ok = c && c.versao === VERSAO_CONSENTIMENTO && (c.escolha === "aceito" || c.escolha === "recusado")
    return ok && typeof c.em === "string" ? c : null
  } catch {
    return null
  }
}

export function gravarConsentimento(escolha: Escolha) {
  try {
    memoria = { versao: VERSAO_CONSENTIMENTO, escolha, em: new Date().toISOString() }
    localStorage.setItem(CHAVE, JSON.stringify(memoria))
  } catch {
    // armazenamento bloqueado: vale só nesta visita (memoria)
  }
  avisar()
}

// Retirada do consentimento: apaga a escolha e o banner reabre.
export function limparConsentimento() {
  memoria = null
  try {
    localStorage.removeItem(CHAVE)
  } catch {
    // ignora
  }
  avisar()
}

// Para uso futuro: true só com aceite explícito na versão atual. Ler no cliente, depois de montar.
export const consentimentoAnalytics = () => lerConsentimento()?.escolha === "aceito"
