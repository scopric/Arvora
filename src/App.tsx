function App() {
  return (
    <main className="relative isolate flex min-h-dvh flex-col justify-center overflow-hidden px-6 py-24 sm:px-16 lg:px-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-1/3 -right-1/4 -z-10 size-[60rem] rounded-full bg-superficie/25 blur-3xl"
      />

      <p
        className="animate-subir text-xs font-semibold tracking-[0.3em] text-destaque uppercase"
        style={{ "--atraso": "0ms" } as React.CSSProperties}
      >
        Em breve
      </p>

      <h1
        className="animate-subir mt-8 max-w-4xl font-titulo text-5xl leading-[1.05] font-medium text-balance sm:text-7xl lg:text-8xl"
        style={{ "--atraso": "120ms" } as React.CSSProperties}
      >
        Grupo Árvora
      </h1>

      <span
        aria-hidden="true"
        className="animate-subir mt-10 block h-px w-16 bg-dourado"
        style={{ "--atraso": "240ms" } as React.CSSProperties}
      />

      <p
        className="animate-subir mt-10 max-w-xl text-base leading-relaxed text-creme/75 sm:text-lg"
        style={{ "--atraso": "360ms" } as React.CSSProperties}
      >
        Cursos, acompanhamento e uma comunidade feitos para empreendedores
        brasileiros que constroem negócios fora do Brasil.
      </p>
    </main>
  )
}

export default App
