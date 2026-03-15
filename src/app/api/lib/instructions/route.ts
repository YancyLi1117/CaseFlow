import { prisma } from "@/lib/db";
import { jsonError, jsonOk, mustString, mustStringOrNull } from "../../_utils/http";
import type { ApiInstruction, InstructionListResponse } from "@/types/api/lib";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const canvasId = url.searchParams.get("canvasId");
    if (!canvasId) return jsonError(400, "canvasId is required");

    const instructions = await prisma.instruction.findMany({
      where: { canvasId },
      select: { id: true, kind: true, title: true, description: true },
      orderBy: { createdAt: "asc" },
    });

    const resp: InstructionListResponse = {
      instructions: instructions.map((i) => ({
        id: i.id,
        kind: i.kind,
        title: i.title,
        description: i.description ?? null,
      })),
    };

    return jsonOk(resp);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonError(500, "Failed to load instructions", msg);
  }
}

type CreateBody = { canvasId: string; title: string; description?: string | null; template: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateBody;

    const canvasId = mustString(body.canvasId, "canvasId");
    const title = mustString(body.title, "title");
    const template = mustString(body.template, "template");
    const description = mustStringOrNull(body.description, "description");

    const inst = await prisma.instruction.create({
      data: { canvasId, kind: "QUICK", title, description, template },
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
    return jsonError(400, "Failed to create QUICK instruction", msg);
  }
}