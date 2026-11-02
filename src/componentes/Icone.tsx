import type { ReactNode } from "react"

// Ícones de traço (24x24, traço 1,5) desenhados à mão: o PRD pede lucide, mas dependência nova não entrou na base.
// Para trocar por lucide-react depois, só este arquivo muda. Decorativos: o rótulo vem sempre do texto ao lado.
// No app eles aparecem a 16px (sidebar) e 20px (tab bar), por isso os traços são simples.
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
  video: (
    <>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M16 10l5-3v10l-5-3" />
    </>
  ),
  folha: <path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14zM5 19c3-4 6-7 9-9" />,
  livro: <path d="M4 19V5a2 2 0 012-2h13v14H6a2 2 0 00-2 2zM6 17h13v4H6a2 2 0 010-4M8 3v14" />,
  filme: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" />
    </>
  ),
  predio: <path d="M4 21V5a2 2 0 012-2h8a2 2 0 012 2v16M16 9h2a2 2 0 012 2v10M3 21h18M8 8h6M8 12h6M8 16h6" />,
  faisca: <path d="M12 3l2.2 6.3L20.5 12l-6.3 2.7L12 21l-2.2-6.3L3.5 12l6.3-2.7z" />,
  calendario: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  balao: <path d="M21 12a8 8 0 01-11.6 7.1L4 21l1.9-5.4A8 8 0 1121 12z" />,
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </>
  ),
  pessoa: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1" />
    </>
  ),
  engrenagem: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </>
  ),
  ajuda: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 014.3 1.7c0 1.7-2.3 2-2.3 3.3M12 17.5h.01" />
    </>
  ),
  cartao: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
  elo: <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />,
  painel: (
    <>
      <rect x="3" y="3" width="8" height="10" rx="1.5" />
      <rect x="13" y="3" width="8" height="6" rx="1.5" />
      <rect x="13" y="11" width="8" height="10" rx="1.5" />
      <rect x="3" y="15" width="8" height="6" rx="1.5" />
    </>
  ),
  etiqueta: <path d="M3 12V4h8l10 10-8 8L3 12zM7.5 8h.01" />,
  escudo: <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3zM9 12l2 2 4-4" />,
  arquivo: <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5zM14 3v5h5M9 13h6M9 17h6" />,
  grafico: <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />,
  lista: <path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  camadas: <path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5" />,
  seta: <path d="M15 5l-7 7 7 7" />,
  sair: <path d="M10 4H6a2 2 0 00-2 2v12a2 2 0 002 2h4M15 8l5 4-5 4M20 12H9" />,
} satisfies Record<string, ReactNode>

export type NomeIcone = keyof typeof desenhos

export function Icone({ nome, className = "size-5" }: { nome: NomeIcone; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={className}>
      {desenhos[nome]}
    </svg>
  )
}
