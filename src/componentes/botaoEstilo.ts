// Botão do site público (D22 pílula 44 px; D54): base única da home, de Botao e dos links do topo.
export const botaoPublico =
  "inline-flex min-h-11 items-center justify-center rounded-full px-6 text-base font-medium transition-[box-shadow,border-color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destaque"

// Links com cara de botão no site público (Pagina): um só primário, igual ao Botao.
export const linkBotao = botaoPublico
export const linkPrimario = `${botaoPublico} bg-destaque text-fundo hover:shadow-brilho`
export const linkContorno = `${botaoPublico} border border-creme/30 text-creme hover:border-creme/60`

// Classes do botão no app (molde Linear). Um só lugar: Botao, Bloqueado, os helpers de aprender (botaoLink/botaoContorno)
// e as ações do admin (classeAcaoPrimaria) montam a partir daqui. Primário = o único botão cromático da tela (dourado,
// raio 6, 14px/510); contorno = ghost com hairline; perigo = ghost vermelho. 36px de altura, 44 no toque.
export const botaoApp = {
  base: "inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors pointer-coarse:min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado disabled:cursor-not-allowed disabled:opacity-60",
  primario: "bg-dourado text-breu hover:brightness-110",
  contorno: "border border-grafite text-bruma hover:bg-creme/5 hover:text-creme",
  perigo: "border border-red-300/30 text-red-300 hover:bg-red-300/10",
}
export const botaoPrimarioApp = `${botaoApp.base} ${botaoApp.primario}`
export const botaoContornoApp = `${botaoApp.base} ${botaoApp.contorno}`
// Botão pequeno de ação em linha (tabela, lista de notificações): ghost de 32px, 44 no toque.
export const botaoPequenoApp =
  "inline-flex min-h-8 items-center justify-center rounded-md border border-grafite px-2.5 text-xs font-medium text-bruma transition-colors pointer-coarse:min-h-11 hover:bg-creme/5 hover:text-creme focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dourado disabled:cursor-not-allowed disabled:opacity-60"
