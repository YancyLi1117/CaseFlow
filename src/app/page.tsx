"use client";

import "./global.css";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ConnectionMode,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type OnSelectionChangeParams,
  type Node,
  type Edge,
} from "reactflow";
import "reactflow/dist/style.css";


import { Shell } from "@/components/shell/SplitView";
import type { AppMode } from "@/components/shell/ModeTabs";

import type { ApiCanvas } from "@/types/api/canvas";
import type { WorkGraphResponse, ApiWorkNode, ApiWorkEdge } from "@/types/api/work";
import type { CaseNodeData } from "@/types/flow/node";
import type { EdgeData } from "@/types/flow/edge";
import type { LibSelection } from "@/types/selection";
import type { InstructionListResponse, LibGraphResponse, ApiInstruction } from "@/types/api/lib";

import { apiGet, apiPost, apiPatch } from "@/lib/apiClient";
import { short } from "@/lib/text";
import { toRFNodes, toRFEdges } from "@/components/work/workAdapters";
import { createWorkEdge, deleteWorkEdge, deleteWorkNode, patchWorkNode } from "@/components/work/workActions";
import { createQuickInstruction } from "@/components/lib/libActions";

import CaseNode from "@/components/nodes/CaseNode";
import { InspectorPanel, type WorkSelection } from "@/components/inspector/InspectorPanel";
import { LibPage } from "@/components/lib/LibPage";
import LibCanvas from "@/components/lib/LibCanvas";
import { LibInspectorPanel } from "@/components/inspector/LibInspectorPanel";

export default function Page() {
  return (
    <ReactFlowProvider>
      <PageInner />
    </ReactFlowProvider>
  );
}

function PageInner() {
  const [mode, setMode] = useState<AppMode>("WORK");
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [clientApiKey, setClientApiKey] = useState("");

  const [canvas, setCanvas] = useState<ApiCanvas | null>(null);
  const canvasId = canvas?.id ?? null;

  const [workNodes, setWorkNodes, onNodesChange] = useNodesState<CaseNodeData>([]);
  const [workEdges, setWorkEdges, onEdgesChange] = useEdgesState<EdgeData>([]);
  const [executeStream, setExecuteStream] = useState<{ nodeId: string; text: string; running: boolean } | null>(null);
  const [executeDone, setExecuteDone] = useState<{ nodeId: string; tick: number } | null>(null);

  const [selection, setSelection] = useState<WorkSelection>({ kind: "NONE" });
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);

  const nodeTypes = useMemo(() => ({ caseNode: CaseNode }), []);

  const [libSelection, setLibSelection] = useState<LibSelection>({ kind: "NONE" });
  const [libSelectedNodeId, setLibSelectedNodeId] = useState<string | null>(null);
  const [libSelectedEdgeId, setLibSelectedEdgeId] = useState<string | null>(null);
  const [libList, setLibList] = useState<InstructionListResponse | null>(null);
  const [libInstruction, setLibInstruction] = useState<ApiInstruction | null>(null);
  const [libNodes, setLibNodes, onLibNodesChange] = useNodesState<CaseNodeData>([]);
  const [libEdges, setLibEdges, onLibEdgesChange] = useEdgesState<EdgeData>([]);

  const onSelectLib = useCallback(
    (sel: LibSelection) => {
      setLibSelection(sel);
      setLibSelectedNodeId(null);
      setLibSelectedEdgeId(null);
      if (sel.kind === "INSTRUCTION") setInspectorCollapsed(false);

      if (sel.kind !== "INSTRUCTION") {
        setLibInstruction(null);
        setLibNodes([]);
        setLibEdges([]);
      }
    },
    [setLibEdges, setLibNodes, setLibSelectedEdgeId, setLibSelectedNodeId, setLibSelection, setInspectorCollapsed]
  );

  const resolveNonOverlappingPosition = useCallback(
    (base: { x: number; y: number }, nodes: Array<Node<CaseNodeData>>) => {
      const width = 220;
      const height = 140;
      const padding = 40;
      const step = 60;
      const maxRings = 6;

      const isFree = (x: number, y: number) =>
        nodes.every((n) => Math.abs(n.position.x - x) > width + padding || Math.abs(n.position.y - y) > height + padding);

      if (isFree(base.x, base.y)) return base;

      for (let r = 1; r <= maxRings; r += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
          for (let dy = -r; dy <= r; dy += 1) {
            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
            const x = base.x + dx * step;
            const y = base.y + dy * step;
            if (isFree(x, y)) return { x, y };
          }
        }
      }

      return base;
    },
    []
  );

  /** =========================
   * Load canvas
   ========================= */
  useEffect(() => {
    (async () => {
      const c = await apiGet<ApiCanvas>("/api/canvas");
      setCanvas(c);
    })().catch(console.error);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("caseflow.openaiApiKey") ?? "";
    setClientApiKey(saved);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("caseflow.openaiApiKey", clientApiKey);
  }, [clientApiKey]);

  /** =========================
   * Load work graph
   ========================= */
  useEffect(() => {
    if (!canvasId) return;

    (async () => {
      const g = await apiGet<WorkGraphResponse>(`/api/work/graph?canvasId=${canvasId}`);
      setWorkNodes(toRFNodes(g.nodes) as Array<Node<CaseNodeData>>);
      setWorkEdges(toRFEdges(g.edges, canvas) as Array<Edge<EdgeData>>);
      setSelection({ kind: "NONE" });
      setSelectedNodeIds([]);
      setSelectedEdgeIds([]);
    })().catch(console.error);
  }, [canvasId, canvas, setWorkNodes, setWorkEdges]);

  /** =========================
   * Load lib instruction + graph
   ========================= */
  useEffect(() => {
    if (libSelection.kind !== "INSTRUCTION") return;

    let active = true;

    (async () => {
      setLibInstruction(null);
      const inst = await apiGet<ApiInstruction>(`/api/lib/instructions/${libSelection.instructionId}`);
      if (!active) return;
      setLibInstruction(inst);

      if (inst.kind !== "CUSTOM") {
        setLibNodes([]);
        setLibEdges([]);
        return;
      }

      const g = await apiGet<LibGraphResponse>(`/api/lib/instructions/${inst.id}/graph`);
      setLibNodes(
        g.nodes.map((n) => ({
          id: n.id,
          type: "caseNode",
          position: { x: n.x, y: n.y },
          data: { context: n.context },
        }))
      );
      setLibEdges(
        g.edges.map((e) => {
          const instrTitle =
            e.edgeInstructionId && canvas
              ? canvas.instructions.find((i) => i.id === e.edgeInstructionId)?.title
              : undefined;
          const label = e.prompt
            ? `⟶ ${short(e.prompt)}`
            : e.edgeInstructionId
              ? `⟶ ${instrTitle ?? "Instruction"}`
              : "";

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
              instructionId: e.edgeInstructionId ?? null,
              prompt: e.prompt ?? undefined,
              instructionTitle: instrTitle,
            },
          };
        })
      );
      setLibSelectedNodeId(null);
      setLibSelectedEdgeId(null);
    })().catch(console.error);

    return () => {
      active = false;
    };
  }, [libSelection, canvas, setLibEdges, setLibNodes, setLibSelectedEdgeId, setLibSelectedNodeId]);

  /** =========================
   * Selection handlers
   ========================= */
  const applySelectionState = useCallback(
    (nodeIds: string[], edgeIds: string[]) => {
      setSelectedNodeIds(nodeIds);
      setSelectedEdgeIds(edgeIds);

      if (nodeIds.length > 0 || edgeIds.length > 0) {
        setInspectorCollapsed(false);
      }

      if (nodeIds.length === 1 && edgeIds.length === 0) {
        setSelection({ kind: "NODE", nodeId: nodeIds[0] });
        return;
      }

      if (edgeIds.length === 1 && nodeIds.length === 0) {
        setSelection({ kind: "EDGE", edgeId: edgeIds[0] });
        return;
      }

      setSelection({ kind: "NONE" });
    },
    [setSelectedNodeIds, setSelectedEdgeIds, setInspectorCollapsed]
  );

  const updateEdgeSelectionStyles = useCallback(
    (edgeIds: string[]) => {
      setWorkEdges((prev) =>
        prev.map((e) => ({
          ...e,
          selected: edgeIds.includes(e.id),
          style: {
            ...e.style,
            strokeWidth: edgeIds.includes(e.id) ? 3 : 2,
            stroke: edgeIds.includes(e.id) ? "#1976d2" : undefined,
          },
        }))
      );
    },
    [setWorkEdges]
  );

  const onSelectEdge = useCallback(
    (edgeId: string) => {
      setWorkNodes((prev) => prev.map((n) => ({ ...n, selected: false })));
      updateEdgeSelectionStyles([edgeId]);
      applySelectionState([], [edgeId]);
    },
    [applySelectionState, setWorkNodes, updateEdgeSelectionStyles]
  );

  const onClearSelection = useCallback(() => {
    setWorkNodes((prev) => prev.map((n) => ({ ...n, selected: false })));
    updateEdgeSelectionStyles([]);
    applySelectionState([], []);
  }, [applySelectionState, setWorkNodes, updateEdgeSelectionStyles]);

  const onSelectionChange = useCallback(
    (sel: OnSelectionChangeParams) => {
      const nodeIds = sel.nodes.map((n) => n.id);
      const edgeIds = sel.edges.map((e) => e.id);
      updateEdgeSelectionStyles(edgeIds);
      applySelectionState(nodeIds, edgeIds);
    },
    [applySelectionState, updateEdgeSelectionStyles]
  );

  /** =========================
   * Toolbar actions
   ========================= */
  const onNewNode = useCallback(async () => {
    if (!canvasId) return;
    if (mode === "LIB") {
      const title = window.prompt("Quick instruction title?");
      if (!title) return;
      const template = window.prompt("Quick instruction prompt?");
      if (!template) return;

      const created = await createQuickInstruction({
        canvasId,
        title,
        description: null,
        template,
      });

      setLibList((prev) =>
        prev
          ? {
              instructions: [
                ...prev.instructions,
                {
                  id: created.id,
                  kind: created.kind,
                  title: created.title,
                  description: created.description ?? null,
                },
              ],
            }
          : {
              instructions: [
                {
                  id: created.id,
                  kind: created.kind,
                  title: created.title,
                  description: created.description ?? null,
                },
              ],
            }
      );
      setLibSelection({ kind: "INSTRUCTION", instructionId: created.id });
      setLibInstruction(created);
      return;
    }

    const fallbackBase = workNodes.length
      ? { x: workNodes[workNodes.length - 1].position.x + 260, y: workNodes[workNodes.length - 1].position.y }
      : { x: 120, y: 120 };
    const position = resolveNonOverlappingPosition(fallbackBase, workNodes);

    const created = await apiPost<ApiWorkNode>("/api/work/nodes", {
      canvasId,
      context: "",
      x: position.x,
      y: position.y,
    });

    const rfNode: Node<CaseNodeData> = {
      id: created.id,
      type: "caseNode",
      position,
      data: { context: created.context, title: created.title },
      selected: true,
    };

    setWorkNodes((prev) => [...prev.map((n) => ({ ...n, selected: false })), rfNode]);
    setSelection({ kind: "NODE", nodeId: created.id });
    setSelectedNodeIds([created.id]);
    setSelectedEdgeIds([]);
  }, [
    canvasId,
    mode,
    resolveNonOverlappingPosition,
    setWorkNodes,
    workNodes,
    setSelectedNodeIds,
    setSelectedEdgeIds,
    setLibList,
    setLibSelection,
    setLibInstruction,
  ]);

  const canCombine = mode === "WORK" && selectedNodeIds.length > 0;
  const canMerge = mode === "WORK" && selectedNodeIds.length >= 2;
  const canNew = mode === "WORK";

  const onCombineToInstruction = useCallback(async () => {
    if (!canvasId) return;
    if (selectedNodeIds.length < 1) return;

    const title = window.prompt("Instruction title?");
    if (!title) return;
    const description = window.prompt("Instruction description (optional)") ?? null;

    const selectedSet = new Set(selectedNodeIds);
    const filteredEdgeIds = selectedEdgeIds.filter((id) => {
      const e = workEdges.find((edge) => edge.id === id);
      if (!e) return false;
      return selectedSet.has(e.source) && selectedSet.has(e.target);
    });

    const resp = await apiPost<{ instruction: ApiInstruction }>("/api/lib/instructions/combine", {
      canvasId,
      title,
      description,
      selectedNodeIds,
      edgePolicy: filteredEdgeIds.length > 0 ? "ONLY_SELECTED" : "ALL_BETWEEN_SELECTED_NODES",
      selectedEdgeIds: filteredEdgeIds,
    });

    setLibList((prev) =>
      prev
        ? {
            instructions: [
              ...prev.instructions,
              {
                id: resp.instruction.id,
                kind: resp.instruction.kind,
                title: resp.instruction.title,
                description: resp.instruction.description ?? null,
              },
            ],
          }
        : {
            instructions: [
              {
                id: resp.instruction.id,
                kind: resp.instruction.kind,
                title: resp.instruction.title,
                description: resp.instruction.description ?? null,
              },
            ],
          }
    );

    setLibSelection({ kind: "INSTRUCTION", instructionId: resp.instruction.id });
    setMode("LIB");
  }, [canvasId, selectedNodeIds, selectedEdgeIds, workEdges, setLibList, setLibSelection, setMode]);

  const onMergeSelected = useCallback(async () => {
    if (!canvasId) return;
    if (selectedNodeIds.length < 2) return;

    const extraPrompt = window.prompt("Merged prompt (optional)") ?? "";
    const resp = await apiPost<{ mergedNode: ApiWorkNode }>("/api/work/merge", {
      canvasId,
      nodeIds: selectedNodeIds,
      separator: "HR",
    });

    const merged = resp.mergedNode;
    const position = resolveNonOverlappingPosition({ x: merged.x, y: merged.y }, workNodes);
    if (position.x !== merged.x || position.y !== merged.y) {
      void patchWorkNode(merged.id, { x: position.x, y: position.y });
    }

    const mergedContext =
      extraPrompt.trim().length > 0 ? `${merged.context}\n\n---\n\n${extraPrompt.trim()}` : merged.context;
    if (mergedContext !== merged.context) {
      void patchWorkNode(merged.id, { context: mergedContext });
    }

    setWorkNodes((prev) => [
      ...prev.map((n) => ({ ...n, selected: false })),
      { id: merged.id, type: "caseNode", position, data: { context: mergedContext, title: merged.title }, selected: true },
    ]);
    setSelection({ kind: "NODE", nodeId: merged.id });
    setSelectedNodeIds([merged.id]);
    setSelectedEdgeIds([]);

    // create edges from original nodes to merged node with default "add" prompt
    try {
      const createdEdges = await Promise.all(
        selectedNodeIds.map((sourceNodeId) =>
          createWorkEdge({
            canvasId,
            sourceNodeId,
            targetNodeId: merged.id,
            sourceHandle: "out",
            targetHandle: "in",
            instructionId: null,
            prompt: "add",
          })
        )
      );

      const newEdges: Array<Edge<EdgeData>> = createdEdges.map((edge) => ({
        id: edge.id,
        source: edge.sourceNodeId,
        target: edge.targetNodeId,
        sourceHandle: edge.sourceHandle ?? "out",
        targetHandle: edge.targetHandle ?? "in",
        animated: true,
        style: { strokeWidth: 2 },
        label: "⟶ add",
        labelBgPadding: [6, 10],
        labelBgBorderRadius: 999,
        data: { instructionId: null, prompt: "add" },
      }));

      setWorkEdges((prev) => [...prev, ...newEdges]);
    } catch (err) {
      console.error(err);
    }
  }, [
    canvasId,
    resolveNonOverlappingPosition,
    selectedNodeIds,
    setWorkNodes,
    workNodes,
    setSelectedNodeIds,
    setSelectedEdgeIds,
    setWorkEdges,
  ]);

  const canDelete = mode === "WORK" && (selectedNodeIds.length > 0 || selectedEdgeIds.length > 0 || selection.kind !== "NONE");

  const onDeleteSelection = useCallback(() => {
    if (mode !== "WORK") return;

    const nodeIds = selectedNodeIds.length > 0 ? selectedNodeIds : selection.kind === "NODE" ? [selection.nodeId] : [];
    const edgeIds = selectedEdgeIds.length > 0 ? selectedEdgeIds : selection.kind === "EDGE" ? [selection.edgeId] : [];

    if (nodeIds.length > 0) {
      setWorkNodes((prev) => prev.filter((n) => !nodeIds.includes(n.id)));
      setWorkEdges((prev) => prev.filter((e) => !nodeIds.includes(e.source) && !nodeIds.includes(e.target)));
      nodeIds.forEach((id) => void deleteWorkNode(id).catch(console.error));
    }

    if (edgeIds.length > 0) {
      setWorkEdges((prev) => prev.filter((e) => !edgeIds.includes(e.id)));
      edgeIds.forEach((id) => void deleteWorkEdge(id).catch(console.error));
    }

    setSelection({ kind: "NONE" });
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
  }, [mode, selection, selectedNodeIds, selectedEdgeIds, setWorkNodes, setWorkEdges, setSelectedNodeIds, setSelectedEdgeIds]);

  /** =========================
   * Connect (edge create)
   ========================= */
  const onConnect = useCallback(
    async (conn: Connection) => {
      if (!canvasId || !conn.source || !conn.target) return;

      const normalized = (() => {
        const sourceHandle = conn.sourceHandle;
        const targetHandle = conn.targetHandle;
        if (!sourceHandle || !targetHandle) return null;
        if (sourceHandle === "out" && targetHandle === "in") {
          return {
            source: conn.source!,
            target: conn.target!,
            sourceHandle,
            targetHandle,
          };
        }
        if (sourceHandle === "in" && targetHandle === "out") {
          return {
            source: conn.target!,
            target: conn.source!,
            sourceHandle: "out",
            targetHandle: "in",
          };
        }
        return null;
      })();
      if (!normalized) return;

      const inlinePrompt = "add";
      const tempId = crypto.randomUUID();
      const edgeDraft: Edge<EdgeData> = {
        id: tempId,
        source: normalized.source,
        target: normalized.target,
        sourceHandle: normalized.sourceHandle,
        targetHandle: normalized.targetHandle,
        animated: true,
        style: { strokeWidth: 2 },
        label: `⟶ ${inlinePrompt}`,
        labelBgPadding: [6, 10],
        labelBgBorderRadius: 999,
        data: { instructionId: null, prompt: inlinePrompt },
      };

      setWorkEdges((prev) => addEdge(edgeDraft, prev));

      try {
        const saved = await createWorkEdge({
          canvasId,
          sourceNodeId: normalized.source,
          targetNodeId: normalized.target,
          sourceHandle: normalized.sourceHandle,
          targetHandle: normalized.targetHandle,
          prompt: inlinePrompt,
        });

        setWorkEdges((prev) =>
          prev.map((e) =>
            e.id === tempId
              ? {
                  ...e,
                  id: saved.id,
                  data: {
                    instructionId: saved.instructionId ?? null,
                    prompt: saved.prompt ?? inlinePrompt,
                  },
                }
              : e
          )
        );
      } catch (err) {
        console.error(err);
        setWorkEdges((prev) => prev.filter((e) => e.id !== tempId));
      }
    },
    [canvasId, setWorkEdges]
  );

  /** =========================
   * LIB canvas actions
   ========================= */
  const onNewLibNode = useCallback(async () => {
    if (!libInstruction || libInstruction.kind !== "CUSTOM") return;

    const base = libNodes.length
      ? { x: libNodes[libNodes.length - 1].position.x + 260, y: libNodes[libNodes.length - 1].position.y }
      : { x: 120, y: 120 };
    const position = resolveNonOverlappingPosition(base, libNodes);

    const created = await apiPost<{ id: string; context: string; x: number; y: number }>("/api/lib/nodes", {
      instructionId: libInstruction.id,
      context: "",
      x: position.x,
      y: position.y,
    });

    setLibNodes((prev) => [
      ...prev.map((n) => ({ ...n, selected: false })),
      { id: created.id, type: "caseNode", position, data: { context: created.context }, selected: true },
    ]);
    setLibSelectedNodeId(created.id);
    setLibSelectedEdgeId(null);
  }, [libInstruction, libNodes, resolveNonOverlappingPosition, setLibNodes]);

  const onLibConnect = useCallback(
    async (conn: Connection) => {
      if (!libInstruction || libInstruction.kind !== "CUSTOM") return;
      if (!conn.source || !conn.target) return;

      const normalized = (() => {
        const sourceHandle = conn.sourceHandle;
        const targetHandle = conn.targetHandle;
        if (!sourceHandle || !targetHandle) return null;
        if (sourceHandle === "out" && targetHandle === "in") {
          return {
            source: conn.source!,
            target: conn.target!,
            sourceHandle,
            targetHandle,
          };
        }
        if (sourceHandle === "in" && targetHandle === "out") {
          return {
            source: conn.target!,
            target: conn.source!,
            sourceHandle: "out",
            targetHandle: "in",
          };
        }
        return null;
      })();
      if (!normalized) return;

      const tempId = crypto.randomUUID();
      const edgeDraft: Edge<EdgeData> = {
        id: tempId,
        source: normalized.source,
        target: normalized.target,
        sourceHandle: normalized.sourceHandle,
        targetHandle: normalized.targetHandle,
        animated: true,
        style: { strokeWidth: 2 },
        label: "",
        labelBgPadding: [6, 10],
        labelBgBorderRadius: 999,
        data: { instructionId: null, prompt: undefined },
      };

      setLibEdges((prev) => addEdge(edgeDraft, prev));

      try {
        const saved = await apiPost<{ id: string; edgeInstructionId?: string | null; prompt?: string | null }>("/api/lib/edges", {
          instructionId: libInstruction.id,
          sourceNodeId: normalized.source,
          targetNodeId: normalized.target,
          sourceHandle: normalized.sourceHandle,
          targetHandle: normalized.targetHandle,
        });
        const label = saved.prompt
          ? `⟶ ${short(saved.prompt)}`
          : saved.edgeInstructionId
            ? `⟶ ${canvas?.instructions.find((i) => i.id === saved.edgeInstructionId)?.title ?? "Instruction"}`
            : "";
        setLibEdges((prev) =>
          prev.map((e) =>
            e.id === tempId
              ? {
                  ...e,
                  id: saved.id,
                  label,
                  data: {
                    instructionId: saved.edgeInstructionId ?? null,
                    prompt: saved.prompt ?? undefined,
                  },
                }
              : e
          )
        );
      } catch (err) {
        console.error(err);
        setLibEdges((prev) => prev.filter((e) => e.id !== tempId));
      }
    },
    [libInstruction, canvas, setLibEdges]
  );

  const onSelectLibNode = useCallback(
    (id: string) => {
      setLibSelectedNodeId(id);
      setLibSelectedEdgeId(null);
      setLibNodes((prev) => prev.map((n) => ({ ...n, selected: n.id === id })));
      setLibEdges((prev) => prev.map((e) => ({ ...e, selected: false })));
      setInspectorCollapsed(false);
    },
    [setLibEdges, setLibNodes, setInspectorCollapsed]
  );

  const onSelectLibEdge = useCallback(
    (id: string) => {
      setLibSelectedEdgeId(id);
      setLibSelectedNodeId(null);
      setLibEdges((prev) => prev.map((e) => ({ ...e, selected: e.id === id })));
      setLibNodes((prev) => prev.map((n) => ({ ...n, selected: false })));
      setInspectorCollapsed(false);
    },
    [setLibEdges, setLibNodes, setInspectorCollapsed]
  );

  const onClearLibSelection = useCallback(() => {
    setLibSelectedNodeId(null);
    setLibSelectedEdgeId(null);
    setLibNodes((prev) => prev.map((n) => ({ ...n, selected: false })));
    setLibEdges((prev) => prev.map((e) => ({ ...e, selected: false })));
  }, [setLibEdges, setLibNodes]);

  type ExecuteNodeResp = {
    runId: string;
    nextNode: ApiWorkNode;
    edge: ApiWorkEdge;
  };
  
  const onQuickExecuteNode = useCallback(
    async (nodeId: string, payload: { instructionId: string | null; prompt: string | null }) => {
      setExecuteStream({ nodeId, text: "", running: true });

      const res = await fetch("/api/work/execute-node?stream=1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(clientApiKey.trim() ? { "x-openai-api-key": clientApiKey.trim() } : {}),
        },
        body: JSON.stringify({ nodeId, ...payload }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setExecuteStream((prev) => (prev && prev.nodeId === nodeId ? null : prev));
        throw new Error(text || `HTTP ${res.status}`);
      }
      if (!res.body) {
        setExecuteStream((prev) => (prev && prev.nodeId === nodeId ? null : prev));
        throw new Error("Streaming response body not available");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const applyResult = (resp: ExecuteNodeResp) => {
        const next = resp.nextNode;

        const position = resolveNonOverlappingPosition({ x: next.x, y: next.y }, workNodes);
        if (position.x !== next.x || position.y !== next.y) {
          void patchWorkNode(next.id, { x: position.x, y: position.y });
        }

        setWorkNodes((prev) => [
          ...prev.map((n) => ({ ...n, selected: false })),
          { id: next.id, type: "caseNode", position, data: { context: next.context, title: next.title }, selected: true },
        ]);

        setWorkEdges((prev) => {
          const instrTitle =
            resp.edge.instructionId && canvas
              ? canvas.instructions.find((i) => i.id === resp.edge.instructionId)?.title
              : undefined;

          const label =
            resp.edge.prompt
              ? `⟶ ${resp.edge.prompt.length > 26 ? resp.edge.prompt.slice(0, 26) + "…" : resp.edge.prompt}`
              : resp.edge.instructionId
                ? `⟶ ${instrTitle ?? "Instruction"}`
                : "";

          const newEdge: Edge<EdgeData> = {
            id: resp.edge.id,
            source: resp.edge.sourceNodeId,
            target: resp.edge.targetNodeId,
            sourceHandle: resp.edge.sourceHandle ?? "out",
            targetHandle: resp.edge.targetHandle ?? "in",
            animated: true,
            style: { strokeWidth: 2 },
            label,
            labelBgPadding: [6, 10],
            labelBgBorderRadius: 999,
            data: { instructionId: resp.edge.instructionId ?? null, prompt: resp.edge.prompt ?? undefined, instructionTitle: instrTitle },
          };

          return [...prev, newEdge];
        });

        setSelection({ kind: "NODE", nodeId: next.id });
        setSelectedNodeIds([next.id]);
        setSelectedEdgeIds([]);
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          if (!raw.trim()) continue;

          let event = "message";
          let data = "";
          for (const line of raw.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            if (line.startsWith("data:")) data += line.slice(5).trim();
          }
          if (!data) continue;

          const payloadData = JSON.parse(data) as { delta?: string; message?: string; output?: string; runId?: string; nextNode?: ApiWorkNode; edge?: ApiWorkEdge };

          if (event === "delta" && typeof payloadData.delta === "string") {
            setExecuteStream((prev) =>
              prev && prev.nodeId === nodeId
                ? { ...prev, text: prev.text + payloadData.delta }
                : prev
            );
          }

          if (event === "done" && payloadData.nextNode && payloadData.edge) {
            applyResult({ runId: payloadData.runId ?? "", nextNode: payloadData.nextNode, edge: payloadData.edge });
            setExecuteDone({ nodeId, tick: Date.now() });
            setExecuteStream((prev) => (prev && prev.nodeId === nodeId ? null : prev));
          }

          if (event === "error") {
            setExecuteStream((prev) => (prev && prev.nodeId === nodeId ? null : prev));
            throw new Error(payloadData.message ?? "Stream error");
          }
        }
      }
    },
    [
      canvas,
      resolveNonOverlappingPosition,
      setWorkNodes,
      setWorkEdges,
      workNodes,
      setSelectedNodeIds,
      setSelectedEdgeIds,
      clientApiKey,
      setExecuteDone,
    ]
  );
  

  /** =========================
   * LEFT: Work canvas / Lib placeholder
   ========================= */
  const left = useMemo(() => {
    return (
      <ReactFlow
        nodes={workNodes}
        edges={workEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={(c) => {
          if (!c.source || !c.target) return false;
          if (!c.sourceHandle || !c.targetHandle) return false;
          if (c.sourceHandle === "out" && c.targetHandle === "in") return true;
          if (c.sourceHandle === "in" && c.targetHandle === "out") return true;
          return false;
        }}
        fitView
        connectionMode={ConnectionMode.Strict}
        nodesConnectable
        elementsSelectable
        selectionOnDrag
        selectionKeyCode="Shift"
        multiSelectionKeyCode="Shift"
        onSelectionChange={onSelectionChange}
        onNodeDragStop={(_, node) => void patchWorkNode(node.id, { x: node.position.x, y: node.position.y })}
        onPaneClick={onClearSelection}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    );
  }, [
    workNodes,
    workEdges,
    nodeTypes,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onSelectionChange,
    onClearSelection,
  ]);

  /** =========================
   * RIGHT: Inspector (Work now; Lib next2.2)
   ========================= */
  const right = useMemo(() => {
    if (mode === "LIB") {
      return (
        <LibInspectorPanel
          key={libInstruction?.id ?? "none"}
          canvas={canvas}
          instruction={libInstruction}
          onInstructionUpdated={(inst) => {
            setLibInstruction(inst);
            setLibList((prev) =>
              prev
                ? {
                    instructions: prev.instructions.map((i) =>
                      i.id === inst.id
                        ? { ...i, title: inst.title, description: inst.description ?? null, kind: inst.kind }
                        : i
                    ),
                  }
                : prev
            );
          }}
          onInstructionDeleted={(id) => {
            setLibList((prev) =>
              prev ? { instructions: prev.instructions.filter((i) => i.id !== id) } : prev
            );
            setLibSelection({ kind: "NONE" });
            setLibInstruction(null);
            setLibNodes([]);
            setLibEdges([]);
            setLibSelectedNodeId(null);
            setLibSelectedEdgeId(null);
          }}
          nodeId={libSelectedNodeId}
          edgeId={libSelectedEdgeId}
          nodes={libNodes}
          setNodes={setLibNodes}
          edges={libEdges}
          setEdges={setLibEdges}
          onClearSelection={onClearLibSelection}
          onCollapse={() => setInspectorCollapsed(true)}
        />
      );
    }

    return (
      <InspectorPanel
        canvas={canvas}
        selection={selection}
        workNodes={workNodes}
        setWorkNodes={setWorkNodes}
        workEdges={workEdges}
        setWorkEdges={setWorkEdges}
        onSelectWorkEdge={onSelectEdge}
        onQuickExecuteNode={onQuickExecuteNode}
        onCollapse={() => setInspectorCollapsed(true)}
        executeStream={executeStream}
        executeDone={executeDone}
      />
    );
  }, [
    mode,
    canvas,
    selection,
    workNodes,
    setWorkNodes,
    workEdges,
    setWorkEdges,
    onSelectEdge,
    onQuickExecuteNode,
    executeStream,
    executeDone,
    libInstruction,
    setLibInstruction,
    setLibList,
    setLibSelection,
    libSelectedNodeId,
    libSelectedEdgeId,
    libNodes,
    setLibNodes,
    libEdges,
    setLibEdges,
    onClearLibSelection,
    setInspectorCollapsed,
  ]);

  const selectedInstruction =
    libSelection.kind === "INSTRUCTION"
      ? libInstruction && libInstruction.id === libSelection.instructionId
        ? {
            id: libInstruction.id,
            kind: libInstruction.kind,
            title: libInstruction.title,
            description: libInstruction.description ?? null,
          }
        : libList?.instructions.find((i) => i.id === libSelection.instructionId) ?? null
      : null;

  return (
    <Shell
      mode={mode}
      onModeChange={setMode}
      rightCollapsed={inspectorCollapsed}
      onToggleRight={() => setInspectorCollapsed((prev) => !prev)}
      topbar={{
        onNewNode,
        onCombineToInstruction,
        onMergeSelected,
        onDeleteSelection,
        apiKey: clientApiKey,
        onApiKeyChange: setClientApiKey,
        canNew,
        canCombine,
        canMerge,
        canDelete,
      }}
      left={
        mode === "LIB" ? (
          <LibPage
            canvas={canvas}
            selection={libSelection}
            onSelect={onSelectLib}
            list={libList}
            setList={setLibList}
            selectedInstruction={selectedInstruction}
            onNewQuickInstruction={onNewNode}
            onNewLibNode={onNewLibNode}
            miniCanvas={
              selectedInstruction?.kind === "CUSTOM" ? (
                <LibCanvas
                  nodes={libNodes}
                  edges={libEdges}
                  onNodesChange={onLibNodesChange}
                  onEdgesChange={onLibEdgesChange}
                  onConnect={onLibConnect}
                  onNodeClick={onSelectLibNode}
                  onEdgeClick={onSelectLibEdge}
                  onPaneClick={onClearLibSelection}
                  onNodeDragStop={(_, node) => void apiPatch(`/api/lib/nodes/${node.id}`, { x: node.position.x, y: node.position.y })}
                />
              ) : null
            }
          />
        ) : (
          left
        )
      }
      right={right}
    />
  );
}
