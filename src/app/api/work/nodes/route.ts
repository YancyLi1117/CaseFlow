import { prisma } from "@/lib/db";
import { jsonError, jsonOk, mustNumber, mustString } from "../../_utils/http";
import type { ApiWorkNode } from "@/types/api/work";

type Body = { canvasId: string; context?: string; title?: string; x: number; y: number };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const canvasId = mustString(body.canvasId, "canvasId");
    const x = mustNumber(body.x, "x");
    const y = mustNumber(body.y, "y");
    const context = typeof body.context === "string" ? body.context : "";

    const title = typeof body.title === "string" ? body.title : undefined;

    const node = await prisma.node.create({
      data: { canvasId, context, x, y, ...(title !== undefined ? { title } : {}) },
      select: { id: true, canvasId: true, title: true, context: true, x: true, y: true, activeRunId: true },
    });

    const resp: ApiWorkNode = {
      id: node.id,
      canvasId: node.canvasId,
      title: node.title,
      context: node.context,
      x: node.x,
      y: node.y,
      activeRunId: node.activeRunId ?? null,
    };

    return jsonOk(resp);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonError(400, "Failed to create node", msg);
  }
}
