import { apiBase } from "@/lib/utils";

export interface CreateCheckoutRequest {
  amountInRands: number;
  currency?: string;
  metadata?: Record<string, unknown>;
  clientReferenceId?: string;
}

export interface CreateCheckoutResponse {
  id: string;
  redirectUrl: string;
}

export async function createCheckout(req: CreateCheckoutRequest): Promise<CreateCheckoutResponse> {
  const amountCents = Math.round((req.amountInRands || 0) * 100);
  const base = String((import.meta as any).env?.VITE_API_BASE_URL || '').replace(/\/+$/, '');
  const testModeEnv = String((import.meta as any).env?.VITE_YOCO_TEST_MODE || '').toLowerCase();
  const TEST_MODE = testModeEnv === '' || testModeEnv === 'true';
  const endpoint = `${base}/api/yoco/create-checkout`;

  // If no backend configured and test mode is on, return a local redirect
  if (!base && TEST_MODE) {
    const id = `test_${Date.now()}`;
    const ref = req.clientReferenceId || id;
    return { id, redirectUrl: `/payment/success?ref=${encodeURIComponent(ref)}` };
  }

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: amountCents, currency: req.currency || "ZAR", metadata: req.metadata || {}, clientReferenceId: req.clientReferenceId }),
  });

  if (!resp.ok) {
    let bodyText = "";
    try {
      bodyText = await resp.text();
    } catch (_) {}
    throw new Error(`Failed to create checkout: ${resp.status} ${bodyText}`);
  }

  const ct = resp.headers.get('content-type') || '';
  if (ct.includes('text/html')) {
    const sample = await resp.text();
    throw new Error(`Backend returned HTML instead of JSON. Is API configured? ${sample.slice(0, 120)}...`);
  }
  return (await resp.json()) as CreateCheckoutResponse;
}
