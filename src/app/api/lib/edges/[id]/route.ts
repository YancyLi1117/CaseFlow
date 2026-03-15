import { prisma } from "@/lib/db";
import { jsonError, jsonOk, mustStringOrNull } from "../../../_utils/http";
import type { ApiLibEdge } from "@/types/api/lib";

type PatchBody = {
  sourceHandle?: string | null;
  targetHandle?: string | null;
  edgeInstructionId?: string | null;
  prompt?: string | null;
};

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;

    const edge = await prisma.instructionEdge.findUnique({
      where: { id },
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
    if (!edge) return jsonError(404, "Lib edge not found");

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
    return jsonError(500, "Failed to read lib edge", msg);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as PatchBody;

    const data: { sourceHandle?: string | null; targetHandle?: string | null; edgeInstructionId?: string | null; prompt?: string | null } = {};
    if (body.sourceHandle !== undefined) data.sourceHandle = mustStringOrNull(body.sourceHandle, "sourceHandle");
    if (body.targetHandle !== undefined) data.targetHandle = mustStringOrNull(body.targetHandle, "targetHandle");
    if (body.edgeInstructionId !== undefined) data.edgeInstructionId = mustStringOrNull(body.edgeInstructionId, "edgeInstructionId");
    if (body.prompt !== undefined) data.prompt = mustStringOrNull(body.prompt, "prompt");

    const edge = await prisma.instructionEdge.update({
      where: { id },
      data,
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
    return jsonError(400, "Failed to update lib edge", msg);
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await prisma.instructionEdge.delete({ where: { id } });
    return jsonOk({ ok: true } as const);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.toLowerCase().includes("not found") ? 404 : 400;
    return jsonError(status, "Failed to delete lib edge", msg);
  }
}
