import type { Node, Edge } from "reactflow";
import type { CaseNodeData } from "@/types/flow/node";
import type { EdgeData } from "@/types/flow/edge";
import type { ApiWorkNode, ApiWorkEdge } from "@/types/api/work";
import type { ApiCanvas } from "@/types/api/canvas";
import { short } from "@/lib/text";

export function toRFNodes(nodes: ApiWorkNode[]): Array<Node<CaseNodeData, "caseNode">> {
  return nodes.map((n) => ({
    id: n.id,
    type: "caseNode",
    position: { x: n.x, y: n.y },
    data: { context: n.context, title: n.title },
  }));
}

export function toRFEdges(edges: ApiWorkEdge[], canvas: ApiCanvas | null): Array<Edge<EdgeData>> {
  const getTitle = (id: string) => canvas?.instructions.find((x) => x.id === id)?.title ?? "Instruction";

  return edges.map((e) => {
    const label =
      e.prompt ? `⟶ ${short(e.prompt)}` : e.instructionId ? `⟶ ${getTitle(e.instructionId)}` : "";

    return {
      id: e.id,
      source: e.sourceNodeId,
      target: e.targetNodeId,
      sourceHandle: e.sourceHandle ?? "out",
      targetHandle: e.targetHandle ?? "in",
      animated: true,
      style: { strokeWidth: 2 },
      label,
      labelBgPadding: [6, 10],
      labelBgBorderRadius: 999,
      data: {
        instructionId: e.instructionId ?? null,
        prompt: e.prompt ?? undefined,
        instructionTitle: e.instructionId ? getTitle(e.instructionId) : undefined,
      },
    };
  });
}
