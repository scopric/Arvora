import { lazy, Suspense, useEffect, useState } from "react"

const CenaArvore = lazy(() => import("./CenaArvore"))

// Carrega a cena 3D depois da primeira pintura: o texto continua sendo o LCP.
export function Cena({ className }: { className: string }) {
  const [pronto, setPronto] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setPronto(true), 200)
    return () => clearTimeout(id)
  }, [])
  return pronto ? (
    <Suspense fallback={null}>
      <CenaArvore className={className} />
    </Suspense>
  ) : null
}
