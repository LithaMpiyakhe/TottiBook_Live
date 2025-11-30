import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const event = req.body as { type?: string; data?: unknown };

    if (!event || !event.type) {
      res.status(400).json({ error: "Invalid webhook payload" });
      return;
    }

    console.log("Yoco webhook received:", JSON.stringify(event));

    res.status(200).json({ received: true });
  } catch (err) {
    res.status(500).json({ error: "Unexpected server error" });
  }
}