// Webhook do Stripe: verifica a assinatura, chama a RPC processar_evento_stripe e responde.
// A lógica de negócio fica no banco; aqui só autenticação e tradução para HTTP.
import Stripe from "stripe";

export type Deps = {
  segredoDaConta(id: string): string | undefined;
  processar(contaId: number, evento: unknown): Promise<string>;
};

// Só verificação de assinatura (Stripe.webhooks é estático): sem cliente, sem chave de API.
// O SDK 23.0.1 corresponde à API 2026-09-30.endive.
const cripto = Stripe.createSubtleCryptoProvider();

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  const id = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
    return new Response(null, { status: 400 });
  }
  const segredo = deps.segredoDaConta(id);
  if (!segredo) return new Response(null, { status: 400 });

  const corpo = await req.text();
  const header = req.headers.get("stripe-signature");
  if (!header) return new Response(null, { status: 400 });

  let evento: Stripe.Event;
  try {
    evento = await Stripe.webhooks.constructEventAsync(
      corpo,
      header,
      segredo,
      300,
      cripto,
    );
  } catch {
    return new Response(null, { status: 400 });
  }

  try {
    const resultado = await deps.processar(Number(id), evento);
    return new Response(resultado, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(
      "stripe-webhook falhou",
      evento.id,
      evento.type,
      msg.slice(0, 120),
    );
    return new Response("erro", { status: 500 });
  }
}
