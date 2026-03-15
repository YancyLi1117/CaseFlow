import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type PatchBody = {
  instructionId?: string | null;
  prompt?: string | null;
};

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json()) as PatchBody;

  const updated = await prisma.edge.update({
    where: { id },
    data: {
      instructionId: body.instructionId ?? null,
      prompt: body.prompt ?? null,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await prisma.edge.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}