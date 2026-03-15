import { prisma } from "@/lib/db";
import { jsonError, jsonOk, mustString, mustStringArray, mustStringOrNull } from "../../../_utils/http";
import type { ApiInstruction } from "@/types/api/lib";

type Body = {
  canvasId: string;
  title: string;
  description?: string | null;
  selectedNodeIds: string[];
  selectedEdgeIds?: string[];
  edgePolicy?: "ONLY_SELECTED" | "ALL_BETWEEN_SELECTED_NODES";
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const canvasId = mustString(body.canvasId, "canvasId");
    const title = mustString(body.title, "title");
    const description = mustStringOrNull(body.description, "description");
    const selectedNodeIds = mustStringArray(body.selectedNodeIds, "selectedNodeIds");
    if (selectedNodeIds.length < 1) return jsonError(400, "selectedNodeIds must have at least 1 item");

    const edgePolicy = body.edgePolicy ?? "ALL_BETWEEN_SELECTED_NODES";
    const selectedEdgeIds = body.selectedEdgeIds ? mustStringArray(body.selectedEdgeIds, "selectedEdgeIds") : [];

    // fetch nodes
    const nodes = await prisma.node.findMany({
      where: { canvasId, id: { in: selectedNodeIds } },
      select: { id: true, context: true, x: true, y: true },
    });
    if (nodes.length !== selectedNodeIds.length) return jsonError(404, "Some work nodes not found in canvas");

    // fetch edges by policy
    const edges =
      edgePolicy === "ONLY_SELECTED"
        ? await prisma.edge.findMany({
            where: { canvasId, id: { in: selectedEdgeIds } },
            select: {
              id: true,
              sourceNodeId: true,
              targetNodeId: true,
              sourceHandle: true,
              targetHandle: true,
              instructionId: true,
              prompt: true,
            },
          })
        : await prisma.edge.findMany({
            where: {
              canvasId,
              sourceNodeId: { in: selectedNodeIds },
              targetNodeId: { in: selectedNodeIds },
            },
            select: {
              id: true,
              sourceNodeId: true,
              targetNodeId: true,
              sourceHandle: true,
              targetHandle: true,
              instructionId: true,
              prompt: true,
            },
          });

    // filter edges to only those whose endpoints are in selected nodes (safety)
    const selectedSet = new Set(selectedNodeIds);
    const filteredEdges = edges.filter((e) => selectedSet.has(e.sourceNodeId) && selectedSet.has(e.targetNodeId));

    const inst = await prisma.$transaction(async (tx) => {
      const instruction = await tx.instruction.create({
        data: { canvasId, kind: "CUSTOM", title, description, template: null },
        select: { id: true, canvasId: true, kind: true, title: true, description: true, template: true, createdAt: true, updatedAt: true },
      });

      // map workNodeId -> libNodeId
      const idMap = new Map<string, string>();

      // keep stable order by selectedNodeIds order
      const byId = new Map(nodes.map((n) => [n.id, n]));
      for (const workId of selectedNodeIds) {
        const n = byId.get(workId)!;
        const created = await tx.instructionNode.create({
          data: { instructionId: instruction.id, context: n.context, x: n.x, y: n.y },
          select: { id: true },
        });
        idMap.set(workId, created.id);
      }

      for (const e of filteredEdges) {
        const src = idMap.get(e.sourceNodeId);
        const tgt = idMap.get(e.targetNodeId);
        if (!src || !tgt) continue;

        await tx.instructionEdge.create({
          data: {
            instructionId: instruction.id,
            sourceNodeId: src,
            targetNodeId: tgt,
            sourceHandle: e.sourceHandle ?? null,
            targetHandle: e.targetHandle ?? null,
            edgeInstructionId: e.instructionId ?? null,
            prompt: e.prompt ?? null,
          },
        });
      }

      return instruction;
    });

    const resp: ApiInstruction = {
      id: inst.id,
      canvasId: inst.canvasId,
      kind: inst.kind,
      title: inst.title,
      description: inst.description ?? null,
      template: inst.template ?? null,
      createdAt: inst.createdAt.toISOString(),
      updatedAt: inst.updatedAt.toISOString(),
    };

    return jsonOk({ instruction: resp });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonError(400, "Combine failed", msg);
  }
}
