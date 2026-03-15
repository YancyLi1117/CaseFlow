import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "../_utils/http";
import type { ApiCanvas } from "@/types/api/canvas";

const DEFAULT_QUICK: Array<{ title: string; template: string; description?: string }> = [
  { title: "Summarize", template: "Summarize the context into concise bullet points." },
  { title: "Rewrite (Professional)", template: "Rewrite the context in a professional tone." },
  { title: "Extract Entities", template: "Extract key entities (people, orgs, places, dates) from the context." },
  { title: "Key Risks", template: "Identify potential risks, red flags, and missing information in the context." },
];

export async function GET() {
  try {
    let canvas = await prisma.canvas.findFirst({
      orderBy: [{ nodes: { _count: "desc" } }, { createdAt: "asc" }],
      include: { instructions: { select: { id: true, kind: true, title: true, description: true } } },
    });

    if (!canvas) {
      canvas = await prisma.$transaction(async (tx) => {
        const c = await tx.canvas.create({ data: { title: "Default Canvas" } });

        await tx.instruction.createMany({
          data: DEFAULT_QUICK.map((q) => ({
            canvasId: c.id,
            kind: "QUICK",
            title: q.title,
            description: q.description ?? null,
            template: q.template,
          })),
        });

        return tx.canvas.findUniqueOrThrow({
          where: { id: c.id },
          include: { instructions: { select: { id: true, kind: true, title: true, description: true } } },
        });
      });
    }

    const resp: ApiCanvas = {
      id: canvas.id,
      title: canvas.title,
      instructions: canvas.instructions.map((i) => ({
        id: i.id,
        kind: i.kind,
        title: i.title,
        description: i.description,
      })),
    };

    return jsonOk(resp);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonError(500, "Failed to load canvas", msg);
  }
}
