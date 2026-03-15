import { prisma } from "@/lib/db";
import { jsonError, jsonOk, mustNumber } from "../../../_utils/http";
import type { ApiLibNode } from "@/types/api/lib";

type PatchBody = { context?: string; x?: number; y?: number };

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;

    const node = await prisma.instructionNode.findUnique({
      where: { id },
      select: { id: true, instructionId: true, context: true, x: true, y: true },
    });
    if (!node) return jsonError(404, "Lib node not found");

    const resp: ApiLibNode = {
      id: node.id,
      instructionId: node.instructionId,
      context: node.context,
      x: node.x,
      y: node.y,
    };

    return jsonOk(resp);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonError(500, "Failed to read lib node", msg);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as PatchBody;

    const data: { context?: string; x?: number; y?: number } = {};
    if (typeof body.context === "string") data.context = body.context;
    if (body.x !== undefined) data.x = mustNumber(body.x, "x");
    if (body.y !== undefined) data.y = mustNumber(body.y, "y");

    const node = await prisma.instructionNode.update({
      where: { id },
      data,
      select: { id: true, instructionId: true, context: true, x: true, y: true },
    });

    const resp: ApiLibNode = { id: node.id, instructionId: node.instructionId, context: node.context, x: node.x, y: node.y };
    return jsonOk(resp);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonError(400, "Failed to update lib node", msg);
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;

    // delete edges touching this node (lib edge has no FK)
    await prisma.$transaction(async (tx) => {
      const node = await tx.instructionNode.findUnique({ where: { id }, select: { id: true, instructionId: true } });
      if (!node) throw new Error("Lib node not found");

      await tx.instructionEdge.deleteMany({
        where: {
          instructionId: node.instructionId,
          OR: [{ sourceNodeId: id }, { targetNodeId: id }],
        },
      });
      await tx.instructionNode.delete({ where: { id } });
    });

    return jsonOk({ ok: true } as const);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.toLowerCase().includes("not found") ? 404 : 400;
    return jsonError(status, "Failed to delete lib node", msg);
  }
}