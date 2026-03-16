"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";
import { addEdge, type Connection, type Edge, type Node } from "reactflow";

import { apiPost } from "@/lib/apiClient";
import { buildFlowEdge, normalizeConnection } from "@/lib/flowEdges";
import { resolveNonOverlappingPosition } from "@/lib/nodeLayout";
import { createWorkEdge, deleteWorkEdge, deleteWorkNode, patchWorkNode } from "@/components/work/workActions";
import { appendInstructionSummary } from "@/components/lib/libListState";
import type { AppMode } from "@/components/shell/ModeTabs";
import type { ApiInstruction, InstructionListResponse } from "@/types/api/lib";
import type { ApiWorkNode } from "@/types/api/work";
import type { CaseNodeData } from "@/types/flow/node";
import type { EdgeData } from "@/types/flow/edge";
import type { LibSelection, WorkSelection } from "@/types/selection";

type SetNodes = Dispatch<SetStateAction<Array<Node<CaseNodeData>>>>;
type SetEdges = Dispatch<SetStateAction<Array<Edge<EdgeData>>>>;

export function useWorkGraphActions(input: {
  canvasId: string | null;
  mode: AppMode;
  selection: WorkSelection;
  workNodes: Array<Node<CaseNodeData>>;
  workEdges: Array<Edge<EdgeData>>;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  setWorkNodes: SetNodes;
  setWorkEdges: SetEdges;
  setSelection: Dispatch<SetStateAction<WorkSelection>>;
  setSelectedNodeIds: Dispatch<SetStateAction<string[]>>;
  setSelectedEdgeIds: Dispatch<SetStateAction<string[]>>;
  setLibList: Dispatch<SetStateAction<InstructionListResponse | null>>;
  setLibSelection: Dispatch<SetStateAction<LibSelection>>;
  setMode: Dispatch<SetStateAction<AppMode>>;
}) {
  const onNewWorkNode = useCallback(async () => {
    if (!input.canvasId) return;

    const fallbackBase = input.workNodes.length
      ? {
          x: input.workNodes[input.workNodes.length - 1].position.x + 260,
          y: input.workNodes[input.workNodes.length - 1].position.y,
        }
      : { x: 120, y: 120 };
    const position = resolveNonOverlappingPosition(fallbackBase, input.workNodes);

    const created = await apiPost<ApiWorkNode>("/api/work/nodes", {
      canvasId: input.canvasId,
      context: "",
      x: position.x,
      y: position.y,
    });

    const nextNode: Node<CaseNodeData> = {
      id: created.id,
      type: "caseNode",
      position,
      data: { context: created.context, title: created.title },
      selected: true,
    };

    input.setWorkNodes((prev) => [...prev.map((node) => ({ ...node, selected: false })), nextNode]);
    input.setSelection({ kind: "NODE", nodeId: created.id });
    input.setSelectedNodeIds([created.id]);
    input.setSelectedEdgeIds([]);
  }, [input]);

  // Combine turns a selected work subgraph into a reusable CUSTOM instruction
  // without mutating the original work graph.
  const onCombineToInstruction = useCallback(async () => {
    if (!input.canvasId || input.selectedNodeIds.length < 1) return;

    const title = window.prompt("Instruction title?");
    if (!title) return;
    const description = window.prompt("Instruction description (optional)") ?? null;

    const selectedSet = new Set(input.selectedNodeIds);
    const filteredEdgeIds = input.selectedEdgeIds.filter((id) => {
      const edge = input.workEdges.find((candidate) => candidate.id === id);
      return edge ? selectedSet.has(edge.source) && selectedSet.has(edge.target) : false;
    });

    const resp = await apiPost<{ instruction: ApiInstruction }>("/api/lib/instructions/combine", {
      canvasId: input.canvasId,
      title,
      description,
      selectedNodeIds: input.selectedNodeIds,
      edgePolicy: filteredEdgeIds.length > 0 ? "ONLY_SELECTED" : "ALL_BETWEEN_SELECTED_NODES",
      selectedEdgeIds: filteredEdgeIds,
    });

    input.setLibList((prev) => appendInstructionSummary(prev, resp.instruction));
    input.setLibSelection({ kind: "INSTRUCTION", instructionId: resp.instruction.id });
    input.setMode("LIB");
  }, [input]);

  // Merge creates a new summary node, then links each source node into it with
  // an explicit "add" edge so the provenance stays visible in the graph.
  const onMergeSelected = useCallback(async () => {
    if (!input.canvasId || input.selectedNodeIds.length < 2) return;

    const extraPrompt = window.prompt("Merged prompt (optional)") ?? "";
    const resp = await apiPost<{ mergedNode: ApiWorkNode }>("/api/work/merge", {
      canvasId: input.canvasId,
      nodeIds: input.selectedNodeIds,
      separator: "HR",
    });

    const merged = resp.mergedNode;
    const position = resolveNonOverlappingPosition({ x: merged.x, y: merged.y }, input.workNodes);
    if (position.x !== merged.x || position.y !== merged.y) {
      void patchWorkNode(merged.id, { x: position.x, y: position.y });
    }

    const mergedContext =
      extraPrompt.trim().length > 0 ? `${merged.context}\n\n---\n\n${extraPrompt.trim()}` : merged.context;
    if (mergedContext !== merged.context) {
      void patchWorkNode(merged.id, { context: mergedContext });
    }

    input.setWorkNodes((prev) => [
      ...prev.map((node) => ({ ...node, selected: false })),
      {
        id: merged.id,
        type: "caseNode",
        position,
        data: { context: mergedContext, title: merged.title },
        selected: true,
      },
    ]);
    input.setSelection({ kind: "NODE", nodeId: merged.id });
    input.setSelectedNodeIds([merged.id]);
    input.setSelectedEdgeIds([]);

    try {
      const createdEdges = await Promise.all(
        input.selectedNodeIds.map((sourceNodeId) =>
          createWorkEdge({
            canvasId: input.canvasId!,
            sourceNodeId,
            targetNodeId: merged.id,
            sourceHandle: "out",
            targetHandle: "in",
            instructionId: null,
            prompt: "add",
          }),
        ),
      );

      input.setWorkEdges((prev) => [
        ...prev,
        ...createdEdges.map((edge) =>
          buildFlowEdge({
            id: edge.id,
            source: edge.sourceNodeId,
            target: edge.targetNodeId,
            sourceHandle: edge.sourceHandle ?? "out",
            targetHandle: edge.targetHandle ?? "in",
            prompt: "add",
          }),
        ),
      ]);
    } catch (error) {
      console.error(error);
    }
  }, [input]);

  const onDeleteSelection = useCallback(() => {
    if (input.mode !== "WORK") return;

    const nodeIds =
      input.selectedNodeIds.length > 0
        ? input.selectedNodeIds
        : input.selection.kind === "NODE"
          ? [input.selection.nodeId]
          : [];
    const edgeIds =
      input.selectedEdgeIds.length > 0
        ? input.selectedEdgeIds
        : input.selection.kind === "EDGE"
          ? [input.selection.edgeId]
          : [];

    if (nodeIds.length > 0) {
      input.setWorkNodes((prev) => prev.filter((node) => !nodeIds.includes(node.id)));
      input.setWorkEdges((prev) => prev.filter((edge) => !nodeIds.includes(edge.source) && !nodeIds.includes(edge.target)));
      nodeIds.forEach((id) => void deleteWorkNode(id).catch(console.error));
    }

    if (edgeIds.length > 0) {
      input.setWorkEdges((prev) => prev.filter((edge) => !edgeIds.includes(edge.id)));
      edgeIds.forEach((id) => void deleteWorkEdge(id).catch(console.error));
    }

    input.setSelection({ kind: "NONE" });
    input.setSelectedNodeIds([]);
    input.setSelectedEdgeIds([]);
  }, [input]);

  // Connection creation stays here because it belongs to work graph editing,
  // not to the generic page shell.
  const onConnect = useCallback(
    async (conn: Connection) => {
      if (!input.canvasId || !conn.source || !conn.target) return;

      const normalized = normalizeConnection(conn);
      if (!normalized) return;

      const inlinePrompt = "add";
      const tempId = crypto.randomUUID();
      const edgeDraft = buildFlowEdge({
        id: tempId,
        source: normalized.source,
        target: normalized.target,
        sourceHandle: normalized.sourceHandle,
        targetHandle: normalized.targetHandle,
        prompt: inlinePrompt,
      });

      input.setWorkEdges((prev) => addEdge(edgeDraft, prev));

      try {
        const saved = await createWorkEdge({
          canvasId: input.canvasId,
          sourceNodeId: normalized.source,
          targetNodeId: normalized.target,
          sourceHandle: normalized.sourceHandle,
          targetHandle: normalized.targetHandle,
          prompt: inlinePrompt,
        });

        input.setWorkEdges((prev) =>
          prev.map((edge) =>
            edge.id === tempId
              ? {
                  ...edge,
                  id: saved.id,
                  data: {
                    instructionId: saved.instructionId ?? null,
                    prompt: saved.prompt ?? inlinePrompt,
                  },
                }
              : edge,
          ),
        );
      } catch (error) {
        console.error(error);
        input.setWorkEdges((prev) => prev.filter((edge) => edge.id !== tempId));
      }
    },
    [input],
  );

  return {
    canCombine: input.mode === "WORK" && input.selectedNodeIds.length > 0,
    canDelete:
      input.mode === "WORK" &&
      (input.selectedNodeIds.length > 0 || input.selectedEdgeIds.length > 0 || input.selection.kind !== "NONE"),
    canMerge: input.mode === "WORK" && input.selectedNodeIds.length >= 2,
    canNew: input.mode === "WORK",
    onCombineToInstruction,
    onConnect,
    onDeleteSelection,
    onMergeSelected,
    onNewWorkNode,
  };
}
