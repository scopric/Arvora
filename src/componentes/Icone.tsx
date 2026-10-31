import type { ReactNode } from "react"

// Ícones de traço (24x24, traço 1,5) desenhados à mão: o PRD pede lucide, mas dependência nova não entrou na base.
// Para trocar por lucide-react depois, só este arquivo muda. Decorativos: o rótulo vem sempre do texto ao lado.
const desenhos = {
  casa: <path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" />,
  aprender: <path d="M2 9l10-5 10 5-10 5-10-5zM6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" />,
  award: (
    <>
      <circle cx="12" cy="9" r="6" />
      <path d="M8.5 14L7 22l5-3 5 3-1.5-8" />
    </>
  ),
  rede: (
    <>
      <circle cx="9.5" cy="7" r="4" />
      <path d="M16 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M21 20v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  sino: <path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 003.4 0" />,
  cadeado: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </>
  ),
  fechar: <path d="M6 6l12 12M18 6L6 18" />,
} satisfies Record<string, ReactNode>

export type NomeIcone = keyof typeof desenhos

export function Icone({ nome, className = "size-5" }: { nome: NomeIcone; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={className}>
      {desenhos[nome]}
    </svg>
  )
}
