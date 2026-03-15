import { prisma } from "@/lib/db";
import { jsonError, jsonOk, mustNumber, mustString } from "../../_utils/http";
import type { ApiLibNode } from "@/types/api/lib";

type Body = { instructionId: string; context?: string; x: number; y: number };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const instructionId = mustString(body.instructionId, "instructionId");
    const x = mustNumber(body.x, "x");
    const y = mustNumber(body.y, "y");
    const context = typeof body.context === "string" ? body.context : "";

    const inst = await prisma.instruction.findUnique({ where: { id: instructionId }, select: { kind: true } });
    if (!inst) return jsonError(404, "Instruction not found");
    if (inst.kind !== "CUSTOM") return jsonError(400, "Only CUSTOM instruction has a graph");

    const node = await prisma.instructionNode.create({
      data: { instructionId, context, x, y },
      select: { id: true, instructionId: true, context: true, x: true, y: true },
    });

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
    return jsonError(400, "Failed to create lib node", msg);
  }
}