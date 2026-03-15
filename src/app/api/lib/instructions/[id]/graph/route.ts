import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "../../../../_utils/http";
import type { LibGraphResponse } from "@/types/api/lib";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;

    const inst = await prisma.instruction.findUnique({ where: { id }, select: { id: true, kind: true } });
    if (!inst) return jsonError(404, "Instruction not found");
    if (inst.kind !== "CUSTOM") return jsonOk({ nodes: [], edges: [] } satisfies LibGraphResponse);

    const [nodes, edges] = await Promise.all([
      prisma.instructionNode.findMany({
        where: { instructionId: id },
        select: { id: true, instructionId: true, context: true, x: true, y: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.instructionEdge.findMany({
        where: { instructionId: id },
        select: {
          id: true,
          instructionId: true,
          sourceNodeId: true,
          targetNodeId: true,
          sourceHandle: true,
          targetHandle: true,
          edgeInstructionId: true,
          prompt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const resp: LibGraphResponse = {
      nodes: nodes.map((n) => ({
        id: n.id,
        instructionId: n.instructionId,
        context: n.context,
        x: n.x,
        y: n.y,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        instructionId: e.instructionId,
        sourceNodeId: e.sourceNodeId,
        targetNodeId: e.targetNodeId,
        sourceHandle: e.sourceHandle ?? null,
        targetHandle: e.targetHandle ?? null,
        edgeInstructionId: e.edgeInstructionId ?? null,
        prompt: e.prompt ?? null,
      })),
    };

    return jsonOk(resp);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonError(500, "Failed to load instruction graph", msg);
  }
}
