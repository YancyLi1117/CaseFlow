"use client";

import "./global.css";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ConnectionMode,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";


import { Shell } from "@/components/shell/SplitView";
import type { AppMode } from "@/components/shell/ModeTabs";

import type { ApiCanvas } from "@/types/api/canvas";
import type { CaseNodeData } from "@/types/flow/node";
import type { EdgeData } from "@/types/flow/edge";
import type { LibSelection, WorkSelection } from "@/types/selection";
import type { InstructionListResponse, ApiInstruction } from "@/types/api/lib";

import { apiPatch } from "@/lib/apiClient";
import { resolveNonOverlappingPosition } from "@/lib/nodeLayout";
import { patchWorkNode } from "@/components/work/workActions";
import { useWorkSelection } from "@/components/work/useWorkSelection";
import { useNodeExecution } from "@/components/work/useNodeExecution";
import { useWorkGraphActions } from "@/components/work/useWorkGraphActions";
import { createQuickInstruction } from "@/components/lib/libActions";
import { useLibCanvasActions } from "@/components/lib/useLibCanvasActions";
import { useCanvasLoader } from "@/components/work/useCanvasLoader";
import { useWorkGraphData } from "@/components/work/useWorkGraphData";
import { useLibInstructionGraph } from "@/components/lib/useLibInstructionGraph";
import {
  appendInstructionSummary,
  removeInstructionSummary,
  resolveSelectedInstruction,
  updateInstructionSummary,
} from "@/components/lib/libListState";

import CaseNode from "@/components/nodes/CaseNode";
import { InspectorPanel } from "@/components/inspector/InspectorPanel";
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
  // Shell-level UI state shared by both Work and Lib modes.
  const [mode, setMode] = useState<AppMode>("WORK");
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [clientApiKey, setClientApiKey] = useState(() =>
    typeof window !== "undefined" ? window.localStorage.getItem("caseflow.openaiApiKey") ?? "" : ""
  );

  // The loaded canvas is the backend "document" that owns work nodes, edges,
  // and the instruction library available to this workspace.
  const [canvas, setCanvas] = useState<ApiCanvas | null>(null);
  const canvasId = canvas?.id ?? null;

  // Work graph state drives the main canvas plus the shared inspector.
  const [workNodes, setWorkNodes, onNodesChange] = useNodesState<CaseNodeData>([]);
  const [workEdges, setWorkEdges, onEdgesChange] = useEdgesState<EdgeData>([]);

  const [selection, setSelection] = useState<WorkSelection>({ kind: "NONE" });
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);

  const nodeTypes = useMemo(() => ({ caseNode: CaseNode }), []);

  // Lib mode keeps its own selection and mini-canvas state because CUSTOM
  // instructions behave like editable subgraphs rather than work outputs.
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

  // Data-loading hooks keep backend synchronization separate from UI actions.
  // That lets the page focus on composing state rather than coordinating fetch
  // lifecycles by hand.
  useCanvasLoader(setCanvas);

  // clientApiKey is initialized from localStorage in the useState initializer above

  useEffect(() => {
    window.localStorage.setItem("caseflow.openaiApiKey", clientApiKey);
  }, [clientApiKey]);

  const getInstructionTitle = useCallback(
    (instructionId: string) => canvas?.instructions.find((instruction) => instruction.id === instructionId)?.title,
    [canvas]
  );

  // Selection and execution are the two busiest Work concerns. Moving them into
  // dedicated hooks keeps `page.tsx` focused on orchestration instead of every
  // implementation detail.
  const {
    onClearSelection,
    onSelectEdge,
    onSelectionChange,
  } = useWorkSelection({
    setWorkNodes,
    setWorkEdges,
    setSelection,
    setSelectedNodeIds,
    setSelectedEdgeIds,
    setInspectorCollapsed,
  });

  const { executeDone, executeStream, onQuickExecuteNode } = useNodeExecution({
    clientApiKey,
    workNodes,
    setWorkNodes,
    setWorkEdges,
    setSelection,
    setSelectedNodeIds,
    setSelectedEdgeIds,
    resolveNonOverlappingPosition,
    getInstructionTitle,
  });

  const {
    canCombine,
    canDelete,
    canMerge,
    canNew,
    onCombineToInstruction,
    onConnect,
    onDeleteSelection,
    onMergeSelected,
    onNewWorkNode,
  } = useWorkGraphActions({
    canvasId,
    mode,
    selection,
    workNodes,
    workEdges,
    selectedNodeIds,
    selectedEdgeIds,
    setWorkNodes,
    setWorkEdges,
    setSelection,
    setSelectedNodeIds,
    setSelectedEdgeIds,
    setLibList,
    setLibSelection,
    setMode,
  });

  useWorkGraphData({
    canvasId,
    canvas,
    setWorkNodes,
    setWorkEdges,
    setSelection,
    setSelectedNodeIds,
    setSelectedEdgeIds,
  });

  useLibInstructionGraph({
    libSelection,
    getInstructionTitle,
    setLibInstruction,
    setLibNodes,
    setLibEdges,
    setLibSelectedNodeId,
    setLibSelectedEdgeId,
  });

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

      setLibList((prev) => appendInstructionSummary(prev, created));
      setLibSelection({ kind: "INSTRUCTION", instructionId: created.id });
      setLibInstruction(created);
      return;
    }

    await onNewWorkNode();
  }, [canvasId, mode, onNewWorkNode, setLibInstruction, setLibList, setLibSelection]);

  /** =========================
   * LIB canvas actions
   ========================= */
  const { onClearLibSelection, onLibConnect, onNewLibNode, onSelectLibEdge, onSelectLibNode } = useLibCanvasActions({
    libInstruction,
    libNodes,
    setLibNodes,
    setLibEdges,
    setLibSelectedNodeId,
    setLibSelectedEdgeId,
    setInspectorCollapsed,
    getInstructionTitle,
  });

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
            setLibList((prev) => updateInstructionSummary(prev, inst));
          }}
          onInstructionDeleted={(id) => {
            setLibList((prev) => removeInstructionSummary(prev, id));
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

  const selectedInstruction = resolveSelectedInstruction({
    libSelection,
    libInstruction,
    libList,
  });

  return (
    <Shell
      mode={mode}
      onModeChange={setMode}
      rightCollapsed={inspectorCollapsed}
      onToggleRight={() => setInspectorCollapsed((prev) => !prev)}
      onAutoCollapse={() => setInspectorCollapsed(true)}
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
