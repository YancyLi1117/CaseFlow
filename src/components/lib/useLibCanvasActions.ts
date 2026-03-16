"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";
import { addEdge, type Connection, type Edge, type Node } from "reactflow";

import { apiPost } from "@/lib/apiClient";
import { buildFlowEdge, normalizeConnection } from "@/lib/flowEdges";
import { resolveNonOverlappingPosition } from "@/lib/nodeLayout";
import type { ApiInstruction } from "@/types/api/lib";
import type { CaseNodeData } from "@/types/flow/node";
import type { EdgeData } from "@/types/flow/edge";

type SetNodes = Dispatch<SetStateAction<Array<Node<CaseNodeData>>>>;
type SetEdges = Dispatch<SetStateAction<Array<Edge<EdgeData>>>>;

export function useLibCanvasActions(input: {
  libInstruction: ApiInstruction | null;
  libNodes: Array<Node<CaseNodeData>>;
  setLibNodes: SetNodes;
  setLibEdges: SetEdges;
  setLibSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  setLibSelectedEdgeId: Dispatch<SetStateAction<string | null>>;
  setInspectorCollapsed: Dispatch<SetStateAction<boolean>>;
  getInstructionTitle: (instructionId: string) => string | undefined;
}) {
  const onNewLibNode = useCallback(async () => {
    if (!input.libInstruction || input.libInstruction.kind !== "CUSTOM") return;

    const base = input.libNodes.length
      ? {
          x: input.libNodes[input.libNodes.length - 1].position.x + 260,
          y: input.libNodes[input.libNodes.length - 1].position.y,
        }
      : { x: 120, y: 120 };
    const position = resolveNonOverlappingPosition(base, input.libNodes);

    const created = await apiPost<{ id: string; context: string; x: number; y: number }>("/api/lib/nodes", {
      instructionId: input.libInstruction.id,
      context: "",
      x: position.x,
      y: position.y,
    });

    input.setLibNodes((prev) => [
      ...prev.map((node) => ({ ...node, selected: false })),
      { id: created.id, type: "caseNode", position, data: { context: created.context }, selected: true },
    ]);
    input.setLibSelectedNodeId(created.id);
    input.setLibSelectedEdgeId(null);
  }, [input]);

  const onLibConnect = useCallback(
    async (conn: Connection) => {
      if (!input.libInstruction || input.libInstruction.kind !== "CUSTOM") return;
      if (!conn.source || !conn.target) return;

      const normalized = normalizeConnection(conn);
      if (!normalized) return;

      const tempId = crypto.randomUUID();
      const edgeDraft = buildFlowEdge({
        id: tempId,
        source: normalized.source,
        target: normalized.target,
        sourceHandle: normalized.sourceHandle,
        targetHandle: normalized.targetHandle,
      });

      input.setLibEdges((prev) => addEdge(edgeDraft, prev));

      try {
        const saved = await apiPost<{ id: string; edgeInstructionId?: string | null; prompt?: string | null }>(
          "/api/lib/edges",
          {
            instructionId: input.libInstruction.id,
            sourceNodeId: normalized.source,
            targetNodeId: normalized.target,
            sourceHandle: normalized.sourceHandle,
            targetHandle: normalized.targetHandle,
          },
        );

        input.setLibEdges((prev) =>
          prev.map((edge) =>
            edge.id === tempId
              ? buildFlowEdge({
                  id: saved.id,
                  source: normalized.source,
                  target: normalized.target,
                  sourceHandle: normalized.sourceHandle,
                  targetHandle: normalized.targetHandle,
                  instructionId: saved.edgeInstructionId ?? null,
                  prompt: saved.prompt ?? undefined,
                  instructionTitle: saved.edgeInstructionId
                    ? input.getInstructionTitle(saved.edgeInstructionId)
                    : undefined,
                })
              : edge,
          ),
        );
      } catch (error) {
        console.error(error);
        input.setLibEdges((prev) => prev.filter((edge) => edge.id !== tempId));
      }
    },
    [input],
  );

  const onSelectLibNode = useCallback(
    (id: string) => {
      input.setLibSelectedNodeId(id);
      input.setLibSelectedEdgeId(null);
      input.setLibNodes((prev) => prev.map((node) => ({ ...node, selected: node.id === id })));
      input.setLibEdges((prev) => prev.map((edge) => ({ ...edge, selected: false })));
      input.setInspectorCollapsed(false);
    },
    [input],
  );

  const onSelectLibEdge = useCallback(
    (id: string) => {
      input.setLibSelectedEdgeId(id);
      input.setLibSelectedNodeId(null);
      input.setLibEdges((prev) => prev.map((edge) => ({ ...edge, selected: edge.id === id })));
      input.setLibNodes((prev) => prev.map((node) => ({ ...node, selected: false })));
      input.setInspectorCollapsed(false);
    },
    [input],
  );

  // Clearing mini-canvas selection should leave the selected instruction intact,
  // but reset any node/edge-specific inspector state.
  const onClearLibSelection = useCallback(() => {
    input.setLibSelectedNodeId(null);
    input.setLibSelectedEdgeId(null);
    input.setLibNodes((prev) => prev.map((node) => ({ ...node, selected: false })));
    input.setLibEdges((prev) => prev.map((edge) => ({ ...edge, selected: false })));
  }, [input]);

  return {
    onClearLibSelection,
    onLibConnect,
    onNewLibNode,
    onSelectLibEdge,
    onSelectLibNode,
  };
}
