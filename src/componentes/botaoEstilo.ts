// Botão do site público (D22 pílula 44 px; D54): base única da home, de Botao e dos links do topo.
export const botaoPublico =
  "inline-flex min-h-11 items-center justify-center rounded-full px-6 text-base font-medium transition-[box-shadow,border-color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destaque"

// Links com cara de botão no site público (Pagina): um só primário, igual ao Botao.
export const linkPrimario = `${botaoPublico} bg-destaque text-fundo hover:shadow-brilho`
export const linkContorno = `${botaoPublico} border border-creme/30 text-creme hover:border-creme/60`

const focoApp = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado"

// Classes do botão no app (molde MasterClass, Decisão 70). Um só lugar: Botao, Bloqueado e os links-botão das áreas
// montam a partir daqui. 48px de altura, raio 8, 16px/600 (12×24 do DESIGN.md). Primário = o único botão dourado da
// tela (texto em breu: creme sobre dourado dá 2,2:1); secundário = cinza cheio, o padrão do app (Share Lesson /
// Class Guide); contorno = o Ghost do site, para diálogo e ações repetidas por item; perigo = ghost vermelho.
export const botaoApp = {
  base: `inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-6 text-corpo font-semibold transition-colors ${focoApp} disabled:cursor-not-allowed disabled:opacity-60`,
  primario: "bg-dourado text-breu hover:brightness-110",
  secundario: "bg-fumaca text-creme hover:bg-fumaca/80",
  contorno: "border border-creme/40 text-creme hover:bg-creme/5",
  perigo: "border border-red-300/30 text-red-300 hover:bg-red-300/10",
}
export const botaoPrimarioApp = `${botaoApp.base} ${botaoApp.primario}`
export const botaoSecundarioApp = `${botaoApp.base} ${botaoApp.secundario}`
export const botaoContornoApp = `${botaoApp.base} ${botaoApp.contorno}`
// Botão pequeno de ação em linha (tabela, lista de notificações): secundário de 40px, 44 no toque.
export const botaoPequenoApp = `inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-fumaca px-3 text-corpo-p font-semibold text-creme transition-colors pointer-coarse:min-h-11 hover:bg-fumaca/80 ${focoApp} disabled:cursor-not-allowed disabled:opacity-60`
// Botão em coluna (ícone de 20px sobre o rótulo de 14px), a fileira de ações sob o player do MasterClass.
export const botaoColunaApp = `inline-flex min-h-16 min-w-28 flex-col items-center justify-center gap-1 rounded-lg bg-fumaca px-4 text-corpo-p font-semibold text-creme transition-colors hover:bg-fumaca/80 ${focoApp} disabled:cursor-not-allowed disabled:opacity-60`
// Pílula de categoria ("Category Pill" do MasterClass): dourado em traço; a ativa (aria-current ou aria-pressed) enche.
export const pilulaCategoriaApp = `inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-dourado px-4 text-corpo-p font-semibold text-dourado transition-colors pointer-coarse:min-h-11 hover:bg-dourado/10 aria-[current=true]:bg-dourado aria-[current=true]:text-breu aria-pressed:bg-dourado aria-pressed:text-breu ${focoApp}`
