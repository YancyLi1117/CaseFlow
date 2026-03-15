import { prisma } from "@/lib/db";
import { jsonError, jsonOk, mustStringOrNull } from "../../../_utils/http";
import type { ApiInstruction } from "@/types/api/lib";

type PatchBody = { title?: string; description?: string | null; template?: string | null };

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;

    const inst = await prisma.instruction.findUnique({
      where: { id },
      select: { id: true, canvasId: true, kind: true, title: true, description: true, template: true, createdAt: true, updatedAt: true },
    });
    if (!inst) return jsonError(404, "Instruction not found");

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
    return jsonOk(resp);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonError(500, "Failed to read instruction", msg);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as PatchBody;

    const existing = await prisma.instruction.findUnique({ where: { id }, select: { kind: true } });
    if (!existing) return jsonError(404, "Instruction not found");

    const data: { title?: string; description?: string | null; template?: string | null } = {};

    if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
    if (body.description !== undefined) data.description = mustStringOrNull(body.description, "description");

    if (body.template !== undefined) {
      if (existing.kind !== "QUICK") {
        return jsonError(400, "CUSTOM instruction has no editable template");
      }
      data.template = mustStringOrNull(body.template, "template");
      if (!data.template) return jsonError(400, "template must be non-empty for QUICK");
    }

    const inst = await prisma.instruction.update({
      where: { id },
      data,
      select: { id: true, canvasId: true, kind: true, title: true, description: true, template: true, createdAt: true, updatedAt: true },
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

    return jsonOk(resp);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonError(400, "Failed to update instruction", msg);
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;

    // onDelete:SetNull on Edge.instruction will auto-unbind
    await prisma.instruction.delete({ where: { id } });

    return jsonOk({ ok: true } as const);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.toLowerCase().includes("not found") ? 404 : 400;
    return jsonError(status, "Failed to delete instruction", msg);
  }
}