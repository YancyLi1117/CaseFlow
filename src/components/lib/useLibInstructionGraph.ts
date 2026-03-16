"use client";

import { useEffect } from "react";
import type { Edge, Node } from "reactflow";

import { apiGet } from "@/lib/apiClient";
import { buildFlowEdge } from "@/lib/flowEdges";
import type { ApiInstruction, LibGraphResponse } from "@/types/api/lib";
import type { LibSelection } from "@/types/selection";
import type { CaseNodeData } from "@/types/flow/node";
import type { EdgeData } from "@/types/flow/edge";

export function useLibInstructionGraph(input: {
  libSelection: LibSelection;
  getInstructionTitle: (instructionId: string) => string | undefined;
  setLibInstruction: React.Dispatch<React.SetStateAction<ApiInstruction | null>>;
  setLibNodes: React.Dispatch<React.SetStateAction<Array<Node<CaseNodeData>>>>;
  setLibEdges: React.Dispatch<React.SetStateAction<Array<Edge<EdgeData>>>>;
  setLibSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  setLibSelectedEdgeId: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  useEffect(() => {
    const selection = input.libSelection;
    if (selection.kind !== "INSTRUCTION") return;

    let active = true;

    // CUSTOM instructions have a mini-canvas graph; QUICK instructions only
    // carry prompt metadata, so we clear any stale mini-canvas state.
    (async () => {
      input.setLibInstruction(null);
      const instruction = await apiGet<ApiInstruction>(
        `/api/lib/instructions/${selection.instructionId}`,
      );
      if (!active) return;
      input.setLibInstruction(instruction);

      if (instruction.kind !== "CUSTOM") {
        input.setLibNodes([]);
        input.setLibEdges([]);
        return;
      }

      const graph = await apiGet<LibGraphResponse>(`/api/lib/instructions/${instruction.id}/graph`);
      input.setLibNodes(
        graph.nodes.map((node) => ({
          id: node.id,
          type: "caseNode",
          position: { x: node.x, y: node.y },
          data: { context: node.context },
        })),
      );
      input.setLibEdges(
        graph.edges.map((edge) =>
          buildFlowEdge({
            id: edge.id,
            source: edge.sourceNodeId,
            target: edge.targetNodeId,
            sourceHandle: edge.sourceHandle ?? "out",
            targetHandle: edge.targetHandle ?? "in",
            instructionId: edge.edgeInstructionId ?? null,
            prompt: edge.prompt ?? undefined,
            instructionTitle: edge.edgeInstructionId
              ? input.getInstructionTitle(edge.edgeInstructionId)
              : undefined,
          }),
        ),
      );
      input.setLibSelectedNodeId(null);
      input.setLibSelectedEdgeId(null);
    })().catch(console.error);

    return () => {
      active = false;
    };
  }, [input]);
}
