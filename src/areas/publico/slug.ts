// slug: nome sem acento e sem símbolo + sufixo curto aleatório (o slug é único no banco e vira o endereço da página).
export function criarSlug(nome: string) {
  const base = nome.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/, "")
  return `${base || "empresa"}-${crypto.randomUUID().slice(0, 6)}`
}
