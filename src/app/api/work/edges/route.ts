import { prisma } from "@/lib/db";
import {
  jsonError,
  jsonOk,
  mustString,
  mustStringOrNull,
  parseXorInstructionOrPrompt,
} from "../../_utils/http";
import type { ApiWorkEdge } from "@/types/api/work";

type Body = {
  canvasId: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  instructionId?: string | null;
  prompt?: string | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const canvasId = mustString(body.canvasId, "canvasId");
    const sourceNodeId = mustString(body.sourceNodeId, "sourceNodeId");
    const targetNodeId = mustString(body.targetNodeId, "targetNodeId");
    const sourceHandle = mustStringOrNull(body.sourceHandle, "sourceHandle");
    const targetHandle = mustStringOrNull(body.targetHandle, "targetHandle");
    const xor = parseXorInstructionOrPrompt({ instructionId: body.instructionId, prompt: body.prompt });

    // validate nodes are in same canvas
    const [s, t] = await Promise.all([
      prisma.node.findUnique({ where: { id: sourceNodeId }, select: { canvasId: true } }),
      prisma.node.findUnique({ where: { id: targetNodeId }, select: { canvasId: true } }),
    ]);
    if (!s || !t) return jsonError(404, "Node not found");
    if (s.canvasId !== canvasId || t.canvasId !== canvasId) return jsonError(409, "Cross-canvas edge not allowed");

    // if using instruction, ensure it belongs to canvasId
    if (xor.instructionId) {
      const inst = await prisma.instruction.findUnique({ where: { id: xor.instructionId }, select: { canvasId: true } });
      if (!inst) return jsonError(404, "Instruction not found");
      if (inst.canvasId !== canvasId) return jsonError(409, "Cross-canvas instruction not allowed");
    }

    const edge = await prisma.edge.create({
      data: {
        canvasId,
        sourceNodeId,
        targetNodeId,
        sourceHandle,
        targetHandle,
        instructionId: xor.instructionId,
        prompt: xor.prompt,
      },
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
    });

    const resp: ApiWorkEdge = {
      id: edge.id,
      canvasId: edge.canvasId,
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
      instructionId: edge.instructionId ?? null,
      prompt: edge.prompt ?? null,
      createdAt: edge.createdAt.toISOString(),
      updatedAt: edge.updatedAt.toISOString(),
    };

    return jsonOk(resp);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonError(400, "Failed to create edge", msg);
  }
}