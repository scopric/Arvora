import { createContext, use } from "react"

// Escopo visual do app (membro e admin), estilo-base Linear (Decisão 55). Fora deste provider os componentes
// compartilhados mostram a variante pública, byte a byte como aprovada; a trava em publico-intacto.test.tsx garante.
export const EscopoApp = createContext(false)
export const useApp = () => use(EscopoApp)
