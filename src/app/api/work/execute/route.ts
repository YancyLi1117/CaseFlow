import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Body = { edgeId: string };

function fakeLLM(prompt: string) {
  const preview = prompt.trim().slice(0, 220);
  return `Generated Output:\n${preview}${prompt.length > 220 ? "..." : ""}`;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const { edgeId } = body;

  const edge = await prisma.edge.findUnique({ where: { id: edgeId } });
  if (!edge) return NextResponse.json({ error: "Edge not found" }, { status: 404 });

  const sourceNode = await prisma.node.findUnique({ where: { id: edge.sourceNodeId } });
  if (!sourceNode) return NextResponse.json({ error: "Source node not found" }, { status: 404 });

  const instruction = edge.instructionId
    ? await prisma.instruction.findUnique({ where: { id: edge.instructionId } })
    : null;

  // edge.prompt 优先；否则用 instruction.template（QUICK）
  const instructionText = edge.prompt?.trim()
    ? edge.prompt
    : instruction?.template?.trim()
      ? instruction.template
      : "";

  const prompt = [instructionText ? `Instruction:\n${instructionText}` : "", `Context:\n${sourceNode.context}`]
    .filter(Boolean)
    .join("\n\n");

  const output = fakeLLM(prompt);

  const run = await prisma.nodeRun.create({
    data: {
      nodeId: sourceNode.id,
      model: "fake",
      input: { edgeId: edge.id, instructionId: edge.instructionId ?? null, prompt },
      output,
    },
  });

  await prisma.node.update({
    where: { id: sourceNode.id },
    data: { activeRunId: run.id },
  });

  const nextNode = await prisma.node.create({
    data: {
      canvasId: sourceNode.canvasId,
      title: "Result",
      context: output,
      x: sourceNode.x + 380,
      y: sourceNode.y,
    },
  });

  const newEdge = await prisma.edge.create({
    data: {
      canvasId: sourceNode.canvasId,
      sourceNodeId: sourceNode.id,
      targetNodeId: nextNode.id,
      sourceHandle: edge.sourceHandle ?? "out",
      targetHandle: edge.targetHandle ?? "in",
      instructionId: edge.instructionId ?? null,
      prompt: edge.prompt ?? null,
    },
  });

  return NextResponse.json({
    runId: run.id,
    nextNode,
    edge: newEdge,
  });
}
