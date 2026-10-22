import { z } from "zod"

const texto = (max: number) => z.string().trim().max(max, `No máximo ${max} caracteres.`)
const opcional = (max: number) => texto(max).transform((v) => (v === "" ? null : v))

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Informe seu e-mail.")
  .email("Esse e-mail não parece válido.")

// Mesma regra do Supabase local (config.toml): 8+ caracteres com minúscula, maiúscula e número.
export const senha = z
  .string()
  .min(8, "A senha precisa de pelo menos 8 caracteres.")
  .regex(/[a-z]/, "Inclua ao menos uma letra minúscula.")
  .regex(/[A-Z]/, "Inclua ao menos uma letra maiúscula.")
  .regex(/[0-9]/, "Inclua ao menos um número.")

export const cadastroSchema = z.object({
  nome: texto(120).min(1, "Informe seu nome."),
  email,
  senha,
  maior18: z.literal(true, { error: "Confirme que você tem 18 anos ou mais." }),
})

export const loginSchema = z.object({
  email,
  senha: z.string().min(1, "Informe sua senha."),
})

export const recuperarSchema = z.object({ email })

export const redefinirSchema = z.object({ senha })

// Espelha os checks da tabela perfis (migration f1_03). O banco é a barreira; aqui é a mensagem.
export const perfilSchema = z.object({
  nome: texto(120).min(1, "Informe seu nome."),
  empresa_nome: opcional(120),
  setor_id: z
    .string()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number().int().positive().nullable()),
  cidade: opcional(80),
  pais: z
    .string()
    .trim()
    .toUpperCase()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.string().regex(/^[A-Z]{2}$/, "Use o código de 2 letras, como IE ou BR.").nullable()),
  linkedin_url: z
    .string()
    .trim()
    .max(300, "No máximo 300 caracteres.")
    .transform((v) => (v === "" ? null : v))
    .pipe(
      z
        .string()
        .regex(/^https:\/\/([a-z0-9-]+\.)*linkedin\.com\//i, "Use o endereço completo, começando com https://linkedin.com/")
        .nullable(),
    ),
  instagram: z
    .string()
    .trim()
    .transform((v) => v.replace(/^@/, ""))
    .transform((v) => (v === "" ? null : v))
    .pipe(
      z
        .string()
        .regex(/^[A-Za-z0-9._]{1,30}$/, "Só letras, números, ponto e sublinhado (até 30).")
        .nullable(),
    ),
  bio: opcional(600),
  visibilidade: z.enum(["membros", "publico"]),
})

export type CamposDeErro = Record<string, string>

// Devolve { campo: mensagem } a partir de um erro do Zod (primeira mensagem de cada campo).
export function errosPorCampo(erro: z.ZodError): CamposDeErro {
  const saida: CamposDeErro = {}
  for (const item of erro.issues) {
    const campo = String(item.path[0] ?? "")
    if (campo && !(campo in saida)) saida[campo] = item.message
  }
  return saida
}

// Mensagens do Supabase Auth em português. Nada de texto técnico na tela.
export function mensagemDeErroAuth(erro: { message?: string; code?: string; status?: number }): string {
  switch (erro.code) {
    case "invalid_credentials":
      return "E-mail ou senha incorretos. Tente de novo ou recupere a senha."
    case "email_not_confirmed":
      return "Confirme seu e-mail para continuar. Procure o link na sua caixa de entrada."
    case "weak_password":
      return "Essa senha é fraca. Use 8 ou mais caracteres com maiúscula, minúscula e número."
    case "same_password":
      return "A nova senha precisa ser diferente da atual."
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Muitas tentativas em pouco tempo. Aguarde um instante e tente de novo."
    case "user_already_exists":
    case "email_exists":
      return "Não foi possível criar a conta com esses dados. Se você já tem conta, entre ou recupere a senha."
    default:
      return "Algo deu errado do nosso lado. Tente de novo; se persistir, escreva para o suporte."
  }
}
