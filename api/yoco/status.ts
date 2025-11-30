import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || '*';
  const allow = /^https?:\/\/.*$/i.test(String(origin)) ? origin : '*';
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', allow);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.setHeader('Access-Control-Allow-Origin', allow);
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  res.setHeader('Access-Control-Allow-Origin', allow);
  res.status(501).json({ error: "Status endpoint not configured for serverless. Use persistent storage." });
}
