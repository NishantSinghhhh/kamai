/**
 * x402 paywall wiring (server side).
 *
 * Express middleware order in server.ts is: gate → paywall → /explain handler.
 * The gate runs first so a hungry kamai returns 503 and never takes money.
 *
 * Flow (x402 v2 "authorization"): a request with a payment header is verified
 * by the facilitator BEFORE the handler runs; settlement happens after the
 * handler responds. The afterSettle hook books the settled tx id and payer
 * into the ledger.
 */
import { ExactHederaScheme } from "@x402/hedera/exact/server";
import { HEDERA_TESTNET_CAIP2 } from "@x402/hedera";
import { HTTPFacilitatorClient, x402HTTPResourceServer, x402ResourceServer } from "@x402/core/server";
import { paymentMiddlewareFromHTTPServer } from "@x402/express";
import type { PaymentPayload } from "@x402/core/types";
import type { Request } from "express";

export type PaywallDeps = {
  facilitatorUrl: string;
  kamaiAccountId: string; // payTo — kamai's treasury
  usdcTokenId: string;
  /** Dynamic price in USD, from the Pricing service. */
  getPriceUsd: () => number;
  /** Called with the settled payment after a successful settle. */
  onSettled: (info: { paymentTxId: string; payer: string | null; correlationKey: string }) => void;
};

/**
 * Correlate the request the handler saw with the settlement the hook sees:
 * both share the client's partially-signed transaction bytes.
 */
export function payloadCorrelationKey(payload: PaymentPayload): string {
  return String(payload.payload?.transaction ?? JSON.stringify(payload.payload ?? {}));
}

export function readCorrelationKey(headerValue: string | undefined): string | null {
  if (!headerValue) return null;
  try {
    const parsed = JSON.parse(Buffer.from(headerValue, "base64").toString("utf8")) as PaymentPayload;
    return payloadCorrelationKey(parsed);
  } catch {
    return null;
  }
}

export function buildPaywall(deps: PaywallDeps): (req: Request, res: unknown, next: () => void) => Promise<void> {
  const facilitator = new HTTPFacilitatorClient({ url: deps.facilitatorUrl });
  const resourceServer = new x402ResourceServer(facilitator).register(
    HEDERA_TESTNET_CAIP2,
    new ExactHederaScheme(),
  );

  const httpServer = new x402HTTPResourceServer(resourceServer, {
    "/explain": {
      accepts: {
        scheme: "exact",
        payTo: deps.kamaiAccountId,
        // dynamic price: cost × (1 + margin), never below the floor
        price: () => deps.getPriceUsd(),
        network: HEDERA_TESTNET_CAIP2,
        extra: { asset: deps.usdcTokenId },
      },
      description: "Explain a Hedera transaction",
      mimeType: "application/json",
      resource: "/explain",
    },
  });

  resourceServer.onAfterSettle(async (ctx) => {
    const result = ctx.result;
    if (!result.success) return;
    deps.onSettled({
      paymentTxId: result.transaction,
      payer: result.payer ?? null,
      correlationKey: payloadCorrelationKey(ctx.paymentPayload as PaymentPayload),
    });
  });

  return paymentMiddlewareFromHTTPServer(httpServer) as never;
}
