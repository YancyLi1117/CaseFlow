"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { Edge, Node, OnSelectionChangeParams } from "reactflow";

import type { CaseNodeData } from "@/types/flow/node";
import type { EdgeData } from "@/types/flow/edge";
import type { WorkSelection } from "@/types/selection";

type SetNodes = Dispatch<SetStateAction<Array<Node<CaseNodeData>>>>;
type SetEdges = Dispatch<SetStateAction<Array<Edge<EdgeData>>>>;

export function useWorkSelection(input: {
  setWorkNodes: SetNodes;
  setWorkEdges: SetEdges;
  setSelection: Dispatch<SetStateAction<WorkSelection>>;
  setSelectedNodeIds: Dispatch<SetStateAction<string[]>>;
  setSelectedEdgeIds: Dispatch<SetStateAction<string[]>>;
  setInspectorCollapsed: Dispatch<SetStateAction<boolean>>;
}) {
  const applySelectionState = useCallback(
    (nodeIds: string[], edgeIds: string[]) => {
      input.setSelectedNodeIds(nodeIds);
      input.setSelectedEdgeIds(edgeIds);

      if (nodeIds.length > 0 || edgeIds.length > 0) {
        input.setInspectorCollapsed(false);
      }

      if (nodeIds.length === 1 && edgeIds.length === 0) {
        input.setSelection({ kind: "NODE", nodeId: nodeIds[0] });
        return;
      }

      if (edgeIds.length === 1 && nodeIds.length === 0) {
        input.setSelection({ kind: "EDGE", edgeId: edgeIds[0] });
        return;
      }

      input.setSelection({ kind: "NONE" });
    },
    [input],
  );

  const updateEdgeSelectionStyles = useCallback(
    (edgeIds: string[]) => {
      input.setWorkEdges((prev) =>
        prev.map((edge) => ({
          ...edge,
          selected: edgeIds.includes(edge.id),
          style: {
            ...edge.style,
            strokeWidth: edgeIds.includes(edge.id) ? 3 : 2,
            stroke: edgeIds.includes(edge.id) ? "#1976d2" : undefined,
          },
        })),
      );
    },
    [input],
  );

  const onSelectEdge = useCallback(
    (edgeId: string) => {
      input.setWorkNodes((prev) => prev.map((node) => ({ ...node, selected: false })));
      updateEdgeSelectionStyles([edgeId]);
      applySelectionState([], [edgeId]);
    },
    [applySelectionState, input, updateEdgeSelectionStyles],
  );

  const onClearSelection = useCallback(() => {
    input.setWorkNodes((prev) => prev.map((node) => ({ ...node, selected: false })));
    updateEdgeSelectionStyles([]);
    applySelectionState([], []);
  }, [applySelectionState, input, updateEdgeSelectionStyles]);

  // React Flow selection events contain both node and edge sets, so this hook
  // becomes the single place where we translate them into the app-level
  // inspector selection model.
  const onSelectionChange = useCallback(
    (selection: OnSelectionChangeParams) => {
      const nodeIds = selection.nodes.map((node) => node.id);
      const edgeIds = selection.edges.map((edge) => edge.id);
      updateEdgeSelectionStyles(edgeIds);
      applySelectionState(nodeIds, edgeIds);
    },
    [applySelectionState, updateEdgeSelectionStyles],
  );

  return {
    applySelectionState,
    onClearSelection,
    onSelectEdge,
    onSelectionChange,
    updateEdgeSelectionStyles,
  };
}
