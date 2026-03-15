import { prisma } from "@/lib/db";
import { jsonError, jsonOk, mustNumber } from "../../../_utils/http";
import type { ApiWorkNode } from "@/types/api/work";

type PatchBody = { context?: string; title?: string; x?: number; y?: number };

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;

    const node = await prisma.node.findUnique({
      where: { id },
      select: { id: true, canvasId: true, title: true, context: true, x: true, y: true, activeRunId: true },
    });
    if (!node) return jsonError(404, "Node not found");

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
    return jsonError(500, "Failed to read node", msg);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as PatchBody;

    const data: { context?: string; title?: string; x?: number; y?: number } = {};
    if (typeof body.context === "string") data.context = body.context;
    if (typeof body.title === "string") data.title = body.title;
    if (body.x !== undefined) data.x = mustNumber(body.x, "x");
    if (body.y !== undefined) data.y = mustNumber(body.y, "y");

    const node = await prisma.node.update({
      where: { id },
      data,
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
    return jsonError(400, "Failed to update node", msg);
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;

    // cascade: delete edges touching this node (because Edge has no FK in schema)
    await prisma.$transaction(async (tx) => {
      const node = await tx.node.findUnique({ where: { id }, select: { id: true } });
      if (!node) throw new Error("Node not found");

      await tx.edge.deleteMany({ where: { OR: [{ sourceNodeId: id }, { targetNodeId: id }] } });
      await tx.node.delete({ where: { id } });
    });

    return jsonOk({ ok: true } as const);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("not found") ? 404 : 400;
    return jsonError(status, "Failed to delete node", msg);
  }
}
