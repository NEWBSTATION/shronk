import { NextRequest } from "next/server";
import { requireWorkspaceMember, AuthError } from "@/lib/api-workspace";

export async function POST(request: NextRequest) {
  try {
    await requireWorkspaceMember();

    const { provider, apiKey } = await request.json();

    if (!apiKey) {
      return Response.json({ valid: false, error: "No API key provided" });
    }

    if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        return Response.json({ valid: true });
      }
      const body = await res.json().catch(() => null);
      return Response.json({
        valid: false,
        error: body?.error?.message || `HTTP ${res.status}`,
      });
    } else {
      // Anthropic — use a minimal messages request
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
      });
      if (res.ok) {
        return Response.json({ valid: true });
      }
      const body = await res.json().catch(() => null);
      // 401 = bad key, anything else (like 429) means the key is valid
      if (res.status === 401) {
        return Response.json({
          valid: false,
          error: body?.error?.message || "Invalid API key",
        });
      }
      // Rate limit or other non-auth errors mean the key itself is valid
      return Response.json({ valid: true });
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ valid: false, error: "Failed to test key" });
  }
}
