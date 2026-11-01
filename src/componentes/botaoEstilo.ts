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
