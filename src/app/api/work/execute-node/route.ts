import { NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { extractOutput } from "@/lib/text";

type Body = {
  nodeId: string;
  instructionId?: string | null;
  prompt?: string | null;
};

type MemoryNode = {
  id: string;
  context: string;
  createdAt: Date;
  depth: number;
};

function extractOutputText(resp: unknown): string {
  const r = resp as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  if (typeof r.output_text === "string" && r.output_text.trim().length > 0) return r.output_text;
  const chunks =
    r.output
      ?.flatMap((o) => o.content ?? [])
      ?.filter((c) => typeof c?.text === "string")
      ?.map((c) => c.text ?? "") ?? [];
  const joined = chunks.join("").trim();
  return joined;
}

// Walk backwards through incoming edges so execution only sees the local branch
// that feeds the selected node, rather than the entire canvas.
async function collectIncomingMemory(input: {
  nodeId: string;
  canvasId: string;
  incomingHops: number;
}): Promise<MemoryNode[]> {
  const memoryNodes: MemoryNode[] = [];
  if (input.incomingHops <= 0) return memoryNodes;

  const visited = new Set<string>([input.nodeId]);
  let frontier = [input.nodeId];

  for (let depth = 1; depth <= input.incomingHops; depth += 1) {
    const edges = await prisma.edge.findMany({
      where: { canvasId: input.canvasId, targetNodeId: { in: frontier } },
      select: { sourceNodeId: true },
    });
    const sourceIds = Array.from(
      new Set(edges.map((edge) => edge.sourceNodeId).filter((id) => id && !visited.has(id)))
    ) as string[];

    if (sourceIds.length === 0) break;

    const sources = await prisma.node.findMany({
      where: { id: { in: sourceIds } },
      select: { id: true, context: true, createdAt: true },
    });

    for (const source of sources) {
      visited.add(source.id);
      memoryNodes.push({
        id: source.id,
        context: extractOutput(source.context),
        createdAt: source.createdAt,
        depth,
      });
    }

    frontier = sourceIds;
  }

  return memoryNodes;
}

function buildExecutionPrompt(input: {
  instructionText: string;
  brevity: string;
  currentContext: string;
  memoryNodes: MemoryNode[];
}) {
  const orderedMemory = input.memoryNodes
    .sort((a, b) => {
      if (a.depth !== b.depth) return b.depth - a.depth;
      return a.createdAt.getTime() - b.createdAt.getTime();
    })
    .map((node) => node.context)
    .filter((context) => context.trim().length > 0)
    .join("\n\n---\n\n");

  const fullContext = orderedMemory
    ? `Upstream Context:\n${orderedMemory}\n\nCurrent Context:\n${input.currentContext}`
    : `Current Context:\n${input.currentContext}`;

  return [
    input.instructionText ? `Instruction:\n${input.instructionText}` : "",
    input.brevity ? `Style:\n${input.brevity}` : "",
    fullContext,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const { nodeId, instructionId = null, prompt = null } = body;
    const headerApiKey = req.headers.get("x-openai-api-key")?.trim() ?? "";
    const apiKey = headerApiKey || process.env.OPENAI_API_KEY || "";

    if (!apiKey) {
      return NextResponse.json({ error: "Missing OpenAI API key" }, { status: 500 });
    }

    const client = new OpenAI({ apiKey });

    const node = await prisma.node.findUnique({ where: { id: nodeId } });
    if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 });

    const incomingHops = Math.max(0, Number(process.env.WORK_INCOMING_HOPS ?? 3));
    const memoryNodes = await collectIncomingMemory({
      nodeId: node.id,
      canvasId: node.canvasId,
      incomingHops,
    });

    const instruction = instructionId
      ? await prisma.instruction.findUnique({ where: { id: instructionId } })
      : null;

    // ✅ 优先用用户手写 prompt；否则用 instruction.template（QUICK）
    const instructionText = (prompt ?? "").trim()
      ? (prompt ?? "").trim()
      : (instruction?.template ?? "").trim();

    const brevity = (process.env.OPENAI_BREVITY_PROMPT ?? "Be concise. Prefer bullet points. ")
      .trim();

    const currentOutput = extractOutput(node.context);
    const fullPrompt = buildExecutionPrompt({
      instructionText,
      brevity,
      currentContext: currentOutput,
      memoryNodes,
    });

    const model = process.env.OPENAI_MODEL ?? "gpt-5";
    const maxOutputTokens = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS ?? 1000);
    const reasoningEffort =
      (process.env.OPENAI_REASONING_EFFORT as "low" | "medium" | "high" | undefined) ??
      (model.startsWith("gpt-5") ? "low" : undefined);

    const wantStream = new URL(req.url).searchParams.get("stream") === "1";
    if (wantStream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const send = (event: string, data: unknown) => {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          };

          (async () => {
            let output = "";
            let responseId: string | null = null;

            // Stream partial text to the client so the UI can show progress
            // without persisting intermediate text into the graph.
            const events = await client.responses.create({
              model,
              input: fullPrompt,
              stream: true,
              max_output_tokens: Number.isFinite(maxOutputTokens) ? maxOutputTokens : undefined,
              text: { verbosity: "low" },
              ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
            });

            for await (const event of events) {
              const evt = event as { type?: string; delta?: string; text?: string; response_id?: string };
              if (evt.response_id) responseId = evt.response_id;

              if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
                output += evt.delta;
                send("delta", { delta: evt.delta });
              }

              if (evt.type === "response.output_text.done" && typeof evt.text === "string") {
                output = evt.text;
              }

              if (evt.type === "error") {
                throw new Error("OpenAI streaming error");
              }
            }

            if (!output.trim()) {
              send("error", { message: "Model returned no text output. Try increasing OPENAI_MAX_OUTPUT_TOKENS or lowering reasoning effort." });
              controller.close();
              return;
            }

            const nextContext = output;

            const run = await prisma.nodeRun.create({
              data: {
                nodeId: node.id,
                model,
                input: {
                  nodeId: node.id,
                  instructionId,
                  prompt: instructionText,
                  fullPrompt,
                  responseId,
                  incomingHops,
                  upstreamNodeIds: memoryNodes.map((n) => n.id),
                },
                output,
              },
            });

            await prisma.node.update({
              where: { id: node.id },
              data: { activeRunId: run.id },
            });

            const nextNode = await prisma.node.create({
              data: {
                canvasId: node.canvasId,
                title: "Result",
                context: nextContext,
                x: node.x + 380,
                y: node.y,
              },
            });

            const edge = await prisma.edge.create({
              data: {
                canvasId: node.canvasId,
                sourceNodeId: node.id,
                targetNodeId: nextNode.id,
                sourceHandle: "out",
                targetHandle: "in",
                instructionId,
                prompt: (prompt ?? "").trim() ? (prompt ?? "").trim() : null,
              },
            });

            send("done", { runId: run.id, nextNode, edge, output });
            controller.close();
          })().catch((err) => {
            send("error", { message: err instanceof Error ? err.message : "Unknown error" });
            controller.close();
          });
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const response = await client.responses.create({
      model,
      input: fullPrompt,
      max_output_tokens: Number.isFinite(maxOutputTokens) ? maxOutputTokens : undefined,
      text: { verbosity: "low" },
      ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
    });

    const output = extractOutputText(response);
    if (!output) {
      console.error("OpenAI response had no text output", {
        model,
        responseId: response.id,
        status: (response as { status?: string }).status ?? null,
        incomplete: (response as { incomplete_details?: unknown }).incomplete_details ?? null,
        usage: (response as { usage?: unknown }).usage ?? null,
        outputText: (response as { output_text?: string }).output_text ?? null,
        output: (response as { output?: unknown }).output ?? null,
      });
      return NextResponse.json(
        { error: "Execute failed", detail: "Model returned no text output. Try increasing OPENAI_MAX_OUTPUT_TOKENS or lowering reasoning effort." },
        { status: 502 }
      );
    }
    const nextContext = output;

    const run = await prisma.nodeRun.create({
      data: {
        nodeId: node.id,
        model,
        input: {
          nodeId: node.id,
          instructionId,
          prompt: instructionText,
          fullPrompt,
          responseId: response.id,
          incomingHops,
          upstreamNodeIds: memoryNodes.map((n) => n.id),
        },
        output,
      },
    });

    await prisma.node.update({
      where: { id: node.id },
      data: { activeRunId: run.id },
    });

    const nextNode = await prisma.node.create({
      data: {
        canvasId: node.canvasId,
        title: "Result",
        context: nextContext,
        x: node.x + 380,
        y: node.y,
      },
    });

    const edge = await prisma.edge.create({
      data: {
        canvasId: node.canvasId,
        sourceNodeId: node.id,
        targetNodeId: nextNode.id,
        sourceHandle: "out",
        targetHandle: "in",
        instructionId,
        prompt: (prompt ?? "").trim() ? (prompt ?? "").trim() : null,
      },
    });

    return NextResponse.json({ runId: run.id, nextNode, edge });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("execute-node failed:", e);
    return NextResponse.json({ error: "Execute failed", detail: msg }, { status: 500 });
  }
}
