import { NextRequest } from "next/server";
import { streamText, stepCountIs, convertToModelMessages } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { requireWorkspaceMember, AuthError } from "@/lib/api-workspace";
import { getAITools } from "@/lib/ai/tools";
import { getSystemPrompt } from "@/lib/ai/system-prompt";
import { db } from "@/db";
import { projects, teams } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireWorkspaceMember();

    const body = await request.json();
    console.log("AI chat request body keys:", Object.keys(body));
    console.log("AI chat body.provider:", body.provider);
    console.log("AI chat body.apiKey present:", !!body.apiKey);
    const { messages, provider, apiKey } = body;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "API key is required. Configure it in AI settings." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build context
    const [milestoneList, teamList] = await Promise.all([
      db.select({ id: projects.id, name: projects.name }).from(projects).where(eq(projects.workspaceId, ctx.workspaceId)),
      db.select({ id: teams.id, name: teams.name }).from(teams).where(eq(teams.workspaceId, ctx.workspaceId)),
    ]);

    const systemPrompt = getSystemPrompt({
      workspaceName: ctx.workspace.name,
      milestones: milestoneList,
      teams: teamList,
    });

    // Create provider-specific model
    let model;
    if (provider === "openai") {
      const openai = createOpenAI({ apiKey });
      model = openai("gpt-4o");
    } else {
      const anthropic = createAnthropic({ apiKey });
      model = anthropic("claude-sonnet-4-20250514");
    }

    const aiTools = getAITools(ctx.workspaceId, ctx.userId);

    // Convert UIMessages from the client to ModelMessages for streamText
    let modelMessages;
    try {
      modelMessages = await convertToModelMessages(messages);
    } catch (conversionError) {
      console.error("Message conversion error:", conversionError);
      console.error("Raw messages:", JSON.stringify(messages, null, 2));
      return new Response(
        JSON.stringify({ error: "Failed to process messages" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = streamText({
      model,
      system: systemPrompt,
      messages: modelMessages,
      tools: aiTools,
      stopWhen: stepCountIs(10),
      onError: (event) => {
        console.error("streamText error:", event.error);
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    if (error instanceof AuthError) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: error.status, headers: { "Content-Type": "application/json" } }
      );
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("AI chat error:", errorMessage, error);
    return new Response(
      JSON.stringify({ error: errorMessage || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
