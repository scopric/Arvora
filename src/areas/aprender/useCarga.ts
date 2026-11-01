import { useCallback, useEffect, useRef, useState } from "react"

export type Carga<T> = { fase: "carregando" } | { fase: "erro" } | { fase: "ok"; dados: T }

// Busca ao montar (e quando `chave` muda). Falha vira { fase: "erro" } com "tentar de novo" (`recarregar`); nunca lista vazia.
export function useCarga<T>(buscar: () => Promise<T>, chave: string | number | undefined): [Carga<T>, () => void] {
  const [estado, setEstado] = useState<Carga<T>>({ fase: "carregando" })
  const [tentativa, setTentativa] = useState(0)
  const recarregar = useCallback(() => setTentativa((n) => n + 1), [])
  const chaveAnterior = useRef(chave)
  useEffect(() => {
    let ativo = true
    // Chave nova = tela nova: volta ao esqueleto. Só "tentar de novo" ou recarregar depois de um envio mantém o que já está na tela.
    const mesma = chaveAnterior.current === chave
    chaveAnterior.current = chave
    setEstado((e) => (mesma && e.fase === "ok" ? e : { fase: "carregando" }))
    buscar().then(
      (dados) => ativo && setEstado({ fase: "ok", dados }),
      () => ativo && setEstado({ fase: "erro" }),
    )
    return () => {
      ativo = false
    }
    // buscar muda a cada render; a busca só refaz com a chave ou ao pedir de novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, tentativa])
  return [estado, recarregar]
}
