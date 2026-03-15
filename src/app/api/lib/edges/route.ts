import { prisma } from "@/lib/db";
import { jsonError, jsonOk, mustString, mustStringOrNull } from "../../_utils/http";
import type { ApiLibEdge } from "@/types/api/lib";

type Body = {
  instructionId: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  edgeInstructionId?: string | null;
  prompt?: string | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const instructionId = mustString(body.instructionId, "instructionId");
    const sourceNodeId = mustString(body.sourceNodeId, "sourceNodeId");
    const targetNodeId = mustString(body.targetNodeId, "targetNodeId");
    const sourceHandle = mustStringOrNull(body.sourceHandle, "sourceHandle");
    const targetHandle = mustStringOrNull(body.targetHandle, "targetHandle");
    const edgeInstructionId = mustStringOrNull(body.edgeInstructionId, "edgeInstructionId");
    const prompt = mustStringOrNull(body.prompt, "prompt");

    const inst = await prisma.instruction.findUnique({ where: { id: instructionId }, select: { kind: true } });
    if (!inst) return jsonError(404, "Instruction not found");
    if (inst.kind !== "CUSTOM") return jsonError(400, "Only CUSTOM instruction has a graph");

    // validate nodes belong to this instruction graph
    const [s, t] = await Promise.all([
      prisma.instructionNode.findUnique({ where: { id: sourceNodeId }, select: { instructionId: true } }),
      prisma.instructionNode.findUnique({ where: { id: targetNodeId }, select: { instructionId: true } }),
    ]);
    if (!s || !t) return jsonError(404, "Lib node not found");
    if (s.instructionId !== instructionId || t.instructionId !== instructionId) return jsonError(409, "Cross-instruction edge not allowed");

    const edge = await prisma.instructionEdge.create({
      data: { instructionId, sourceNodeId, targetNodeId, sourceHandle, targetHandle, edgeInstructionId, prompt },
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
    });

    const resp: ApiLibEdge = {
      id: edge.id,
      instructionId: edge.instructionId,
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
      edgeInstructionId: edge.edgeInstructionId ?? null,
      prompt: edge.prompt ?? null,
    };

    return jsonOk(resp);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonError(400, "Failed to create lib edge", msg);
  }
}
