import { useEffect, useRef, useState } from "react"

type Resposta<T> = PromiseLike<{ data: T; error: unknown }>

// Uma leitura do Supabase com os três estados que as telas precisam (Ca/Er/dados). `chave` deve mudar quando a consulta muda
// (idioma, filtro, sessão). Erro NUNCA vira lista vazia (Erros 3.2): a tela mostra <Erro aoTentar={recarregar} />.
export function useConsulta<T>(buscar: () => Resposta<T>, chave: string) {
  const [tentativa, setTentativa] = useState(0)
  const [r, setR] = useState<{ k: string; data: T | null; erro: boolean } | null>(null)
  const ultima = useRef(buscar)
  useEffect(() => {
    ultima.current = buscar
  })
  const k = `${chave}#${tentativa}`
  useEffect(() => {
    let vivo = true
    // Falha ao montar a consulta (cliente indisponível) conta como erro de leitura, não como tela quebrada.
    new Promise<{ data: T; error: unknown }>((ok) => ok(ultima.current())).then(
      ({ data, error }) => vivo && setR({ k, data, erro: Boolean(error) }),
      () => vivo && setR({ k, data: null, erro: true }),
    )
    return () => {
      vivo = false
    }
  }, [k])
  const pronto = r?.k === k
  return {
    carregando: !pronto,
    erro: pronto && r.erro,
    dados: pronto ? r.data : null,
    recarregar: () => setTentativa((n) => n + 1),
  }
}
