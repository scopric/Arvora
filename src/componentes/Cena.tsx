import { lazy, Suspense, useEffect, useState } from "react"

const CenaArvore = lazy(() => import("./CenaArvore"))

// Carrega a cena 3D depois da primeira pintura: o texto continua sendo o LCP.
// `soLarga`: não monta (nem cria contexto WebGL) abaixo de 1024 px, onde o painel hospedeiro fica oculto.
export function Cena({ className, cheia, classeCanvas, soLarga }: { className: string; cheia?: boolean; classeCanvas?: string; soLarga?: boolean }) {
  const [pronto, setPronto] = useState(false)
  useEffect(() => {
    if (soLarga && typeof matchMedia === "function" && !matchMedia("(min-width: 1024px)").matches) return
    const id = setTimeout(() => setPronto(true), 200)
    return () => clearTimeout(id)
  }, [soLarga])
  return pronto ? (
    <Suspense fallback={null}>
      <CenaArvore className={className} cheia={cheia} classeCanvas={classeCanvas} />
    </Suspense>
  ) : null
}
