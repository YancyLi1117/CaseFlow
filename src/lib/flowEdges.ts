import type { Connection, Edge } from "reactflow";
import type { EdgeData } from "@/types/flow/edge";
import { short } from "@/lib/text";

export type NormalizedConnection = {
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
};

// React Flow lets users drag from either side of a node. We normalize the
// interaction so the persisted graph always points from "out" to "in".
export function normalizeConnection(conn: Connection): NormalizedConnection | null {
  const sourceHandle = conn.sourceHandle;
  const targetHandle = conn.targetHandle;

  if (!conn.source || !conn.target || !sourceHandle || !targetHandle) return null;

  if (sourceHandle === "out" && targetHandle === "in") {
    return {
      source: conn.source,
      target: conn.target,
      sourceHandle,
      targetHandle,
    };
  }

  if (sourceHandle === "in" && targetHandle === "out") {
    return {
      source: conn.target,
      target: conn.source,
      sourceHandle: "out",
      targetHandle: "in",
    };
  }

  return null;
}

export function buildEdgeLabel(input: {
  prompt?: string | null;
  instructionId?: string | null;
  resolveInstructionTitle?: (id: string) => string | undefined;
}) {
  if (input.prompt) return `⟶ ${short(input.prompt)}`;
  if (input.instructionId) {
    return `⟶ ${input.resolveInstructionTitle?.(input.instructionId) ?? "Instruction"}`;
  }
  return "";
}

// Keep all React Flow edge cosmetics in one place so the UI does not drift
// between work graph rendering, optimistic edges, and lib graph previews.
export function buildFlowEdge(input: {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  instructionId?: string | null;
  prompt?: string | null;
  instructionTitle?: string;
  animated?: boolean;
}): Edge<EdgeData> {
  return {
    id: input.id,
    source: input.source,
    target: input.target,
    sourceHandle: input.sourceHandle ?? "out",
    targetHandle: input.targetHandle ?? "in",
    animated: input.animated ?? true,
    style: { strokeWidth: 2 },
    label: buildEdgeLabel({
      prompt: input.prompt,
      instructionId: input.instructionId,
      resolveInstructionTitle: () => input.instructionTitle,
    }),
    labelBgPadding: [6, 10],
    labelBgBorderRadius: 999,
    data: {
      instructionId: input.instructionId ?? null,
      prompt: input.prompt ?? undefined,
      instructionTitle: input.instructionTitle,
    },
  };
}
