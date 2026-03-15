import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "../../_utils/http";
import type { WorkGraphResponse } from "@/types/api/work";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const canvasId = url.searchParams.get("canvasId");
    if (!canvasId) return jsonError(400, "canvasId is required");

    const [nodes, edges] = await Promise.all([
      prisma.node.findMany({
        where: { canvasId },
        select: { id: true, canvasId: true, title: true, context: true, x: true, y: true, activeRunId: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.edge.findMany({
        where: { canvasId },
        select: {
          id: true,
          canvasId: true,
          sourceNodeId: true,
          targetNodeId: true,
          sourceHandle: true,
          targetHandle: true,
          instructionId: true,
          prompt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const resp: WorkGraphResponse = {
      nodes: nodes.map((n) => ({
        id: n.id,
        canvasId: n.canvasId,
        title: n.title,
        context: n.context,
        x: n.x,
        y: n.y,
        activeRunId: n.activeRunId ?? null,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        canvasId: e.canvasId,
        sourceNodeId: e.sourceNodeId,
        targetNodeId: e.targetNodeId,
        sourceHandle: e.sourceHandle ?? null,
        targetHandle: e.targetHandle ?? null,
        instructionId: e.instructionId ?? null,
        prompt: e.prompt ?? null,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      })),
    };

    return jsonOk(resp);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonError(500, "Failed to load work graph", msg);
  }
}
