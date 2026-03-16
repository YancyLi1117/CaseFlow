"use client";

import { useEffect } from "react";
import type { Edge, Node } from "reactflow";

import { apiGet } from "@/lib/apiClient";
import { toRFEdges, toRFNodes } from "@/components/work/workAdapters";
import type { ApiCanvas } from "@/types/api/canvas";
import type { WorkGraphResponse } from "@/types/api/work";
import type { CaseNodeData } from "@/types/flow/node";
import type { EdgeData } from "@/types/flow/edge";
import type { WorkSelection } from "@/types/selection";

export function useWorkGraphData(input: {
  canvasId: string | null;
  canvas: ApiCanvas | null;
  setWorkNodes: React.Dispatch<React.SetStateAction<Array<Node<CaseNodeData>>>>;
  setWorkEdges: React.Dispatch<React.SetStateAction<Array<Edge<EdgeData>>>>;
  setSelection: React.Dispatch<React.SetStateAction<WorkSelection>>;
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedEdgeIds: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  useEffect(() => {
    if (!input.canvasId) return;

    // Reload the work graph whenever the active canvas or its instruction list
    // changes so edge labels stay aligned with the latest instruction titles.
    (async () => {
      const graph = await apiGet<WorkGraphResponse>(`/api/work/graph?canvasId=${input.canvasId}`);
      input.setWorkNodes(toRFNodes(graph.nodes) as Array<Node<CaseNodeData>>);
      input.setWorkEdges(toRFEdges(graph.edges, input.canvas) as Array<Edge<EdgeData>>);
      input.setSelection({ kind: "NONE" });
      input.setSelectedNodeIds([]);
      input.setSelectedEdgeIds([]);
    })().catch(console.error);
  }, [input]);
}
