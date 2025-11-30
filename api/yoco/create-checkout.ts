import type { VercelRequest, VercelResponse } from "@vercel/node";

const YOCO_API = "https://payments.yoco.com/api/checkouts";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || '*';
  const allow = /^https?:\/\/.*$/i.test(String(origin)) ? origin : '*';
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', allow);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.setHeader('Access-Control-Allow-Origin', allow);
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const token = process.env.YOCO_SECRET_KEY;
  const siteUrl = process.env.SITE_URL || "http://localhost:8080";
  const testMode = String(process.env.YOCO_TEST_MODE || '').toLowerCase() === '1' || String(process.env.YOCO_TEST_MODE || '').toLowerCase() === 'true';

  if (!token && !testMode) {
    res.setHeader('Access-Control-Allow-Origin', allow);
    res.status(500).json({ error: "Missing YOCO_SECRET_KEY env" });
    return;
  }

  try {
    const { amount, currency = "ZAR", metadata, clientReferenceId } = (req.body as { amount: number; currency?: string; metadata?: Record<string, unknown>; clientReferenceId?: string }) || {};

    if (!amount || typeof amount !== "number") {
      res.setHeader('Access-Control-Allow-Origin', allow);
      res.status(400).json({ error: "Invalid or missing amount (cents)" });
      return;
    }

    const body: Record<string, unknown> = {
      amount,
      currency,
      metadata: { ...(metadata || {}), clientReferenceId },
      clientReferenceId,
    };

    // In non-localhost, include callback URLs
    if (!/^http:\/\/localhost/.test(siteUrl) && !/^http:\/\/127\.0\.0\.1/.test(siteUrl)) {
      body.successUrl = `${siteUrl}/payment/success?ref=${encodeURIComponent(clientReferenceId || "")}`;
      body.cancelUrl = `${siteUrl}/payment/cancel`;
      body.failureUrl = `${siteUrl}/payment/failure`;
    }

    if (testMode) {
      const fakeId = `test_${Date.now()}`;
      const redirectUrl = `${siteUrl}/payment/success?ref=${encodeURIComponent(clientReferenceId || fakeId)}`;
      res.setHeader('Access-Control-Allow-Origin', allow);
      res.status(200).json({ id: fakeId, redirectUrl });
      return;
    }

    const resp = await fetch(YOCO_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await resp.json();

    if (!resp.ok) {
      res.setHeader('Access-Control-Allow-Origin', allow);
      res.status(resp.status).json({ error: data });
      return;
    }

    res.setHeader('Access-Control-Allow-Origin', allow);
    res.status(200).json({ id: data.id, redirectUrl: data.redirectUrl });
  } catch (err) {
    res.setHeader('Access-Control-Allow-Origin', allow);
    res.status(500).json({ error: "Unexpected server error" });
  }
}
