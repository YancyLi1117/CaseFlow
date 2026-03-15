import { prisma } from "@/lib/db";
import { jsonError, jsonOk, mustString, mustStringArray } from "../../_utils/http";
import type { ApiWorkNode } from "@/types/api/work";

type Body = { canvasId: string; nodeIds: string[]; separator?: "BLANK_LINE" | "HR" };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const canvasId = mustString(body.canvasId, "canvasId");
    const nodeIds = mustStringArray(body.nodeIds, "nodeIds");
    if (nodeIds.length < 2) return jsonError(400, "nodeIds must have at least 2 items");

    const sep = body.separator === "HR" ? "\n\n---\n\n" : "\n\n";

    const nodes = await prisma.node.findMany({
      where: { id: { in: nodeIds }, canvasId },
      select: { id: true, context: true, x: true, y: true },
    });
    if (nodes.length !== nodeIds.length) return jsonError(404, "Some nodes not found in canvas");

    // simple: keep order by input nodeIds
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const contexts = nodeIds.map((id) => byId.get(id)!.context);

    const mergedContext = contexts.join(sep);

    // place merged node near the average position
    const avgX = nodes.reduce((s, n) => s + n.x, 0) / nodes.length;
    const avgY = nodes.reduce((s, n) => s + n.y, 0) / nodes.length;

    const merged = await prisma.node.create({
      data: { canvasId, title: "Merged", context: mergedContext, x: avgX + 260, y: avgY },
      select: { id: true, canvasId: true, title: true, context: true, x: true, y: true, activeRunId: true },
    });

    const resp: ApiWorkNode = {
      id: merged.id,
      canvasId: merged.canvasId,
      title: merged.title,
      context: merged.context,
      x: merged.x,
      y: merged.y,
      activeRunId: merged.activeRunId ?? null,
    };

    return jsonOk({ mergedNode: resp });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonError(400, "Merge failed", msg);
  }
}
