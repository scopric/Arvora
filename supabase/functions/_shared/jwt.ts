// Claim aal do JWT. Sem verificar assinatura: quem chama já validou o token com getUser() no mesmo pedido.
export function aalDoJwt(authorization: string): string | undefined {
  try {
    const p = authorization.replace(/^Bearer /i, "").split(".")[1];
    const b = p.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b + "=".repeat((4 - b.length % 4) % 4))).aal;
  } catch {
    return undefined;
  }
}
