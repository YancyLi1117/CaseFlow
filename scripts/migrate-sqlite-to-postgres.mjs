import "dotenv/config";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const sqlitePath = process.env.SQLITE_DATABASE_PATH ?? "prisma/dev.db";
const targetUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!targetUrl) {
  throw new Error("Missing DIRECT_URL or DATABASE_URL for the Postgres target database.");
}

function sqliteJson(query) {
  const raw = execFileSync("sqlite3", ["-json", sqlitePath, query], {
    encoding: "utf8",
  });
  return raw.trim() ? JSON.parse(raw) : [];
}

function asDate(value) {
  return value ? new Date(value) : undefined;
}

function parseJsonField(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: targetUrl,
    },
  },
  log: ["error", "warn"],
});

async function upsertAll(model, rows, mapper) {
  for (const row of rows) {
    const data = mapper(row);
    await model.upsert({
      where: { id: row.id },
      create: data,
      update: data,
    });
  }
}

async function main() {
  const canvases = sqliteJson("select * from Canvas order by createdAt asc;");
  const instructions = sqliteJson("select * from Instruction order by createdAt asc;");
  const nodes = sqliteJson("select * from Node order by createdAt asc;");
  const edges = sqliteJson("select * from Edge order by createdAt asc;");
  const nodeRuns = sqliteJson("select * from NodeRun order by createdAt asc;");
  const instructionNodes = sqliteJson("select * from InstructionNode order by createdAt asc;");
  const instructionEdges = sqliteJson("select * from InstructionEdge order by createdAt asc;");

  await upsertAll(prisma.canvas, canvases, (row) => ({
    id: row.id,
    title: row.title,
    createdAt: asDate(row.createdAt),
    updatedAt: asDate(row.updatedAt),
  }));

  await upsertAll(prisma.instruction, instructions, (row) => ({
    id: row.id,
    canvasId: row.canvasId,
    kind: row.kind,
    title: row.title,
    description: row.description,
    template: row.template,
    createdAt: asDate(row.createdAt),
    updatedAt: asDate(row.updatedAt),
  }));

  await upsertAll(prisma.node, nodes, (row) => ({
    id: row.id,
    canvasId: row.canvasId,
    title: row.title ?? "Node",
    context: row.context,
    x: row.x,
    y: row.y,
    activeRunId: row.activeRunId,
    createdAt: asDate(row.createdAt),
    updatedAt: asDate(row.updatedAt),
  }));

  await upsertAll(prisma.edge, edges, (row) => ({
    id: row.id,
    canvasId: row.canvasId,
    sourceNodeId: row.sourceNodeId,
    targetNodeId: row.targetNodeId,
    sourceHandle: row.sourceHandle,
    targetHandle: row.targetHandle,
    instructionId: row.instructionId,
    prompt: row.prompt,
    createdAt: asDate(row.createdAt),
    updatedAt: asDate(row.updatedAt),
  }));

  await upsertAll(prisma.nodeRun, nodeRuns, (row) => ({
    id: row.id,
    nodeId: row.nodeId,
    input: parseJsonField(row.input),
    output: row.output,
    model: row.model,
    createdAt: asDate(row.createdAt),
  }));

  await upsertAll(prisma.instructionNode, instructionNodes, (row) => ({
    id: row.id,
    instructionId: row.instructionId,
    context: row.context,
    x: row.x,
    y: row.y,
    createdAt: asDate(row.createdAt),
    updatedAt: asDate(row.updatedAt),
  }));

  await upsertAll(prisma.instructionEdge, instructionEdges, (row) => ({
    id: row.id,
    instructionId: row.instructionId,
    sourceNodeId: row.sourceNodeId,
    targetNodeId: row.targetNodeId,
    sourceHandle: row.sourceHandle,
    targetHandle: row.targetHandle,
    edgeInstructionId: row.edgeInstructionId,
    prompt: row.prompt,
    createdAt: asDate(row.createdAt),
    updatedAt: asDate(row.updatedAt),
  }));

  console.log(
    `Imported ${canvases.length} canvases, ${instructions.length} instructions, ${nodes.length} nodes, ${edges.length} edges, ${nodeRuns.length} node runs, ${instructionNodes.length} instruction nodes, and ${instructionEdges.length} instruction edges.`
  );
}

main()
  .catch((error) => {
    console.error("SQLite -> Postgres import failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
