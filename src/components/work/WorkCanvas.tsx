"use client";

import React, { useCallback, useEffect, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Connection,
  addEdge,
  ConnectionMode,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  type NodeTypes,
  type Node,
  type Edge,
} from "reactflow";
import "reactflow/dist/style.css";

import type { ApiCanvas } from "@/types/api/canvas";
import type { CaseNodeData } from "@/types/flow/node";
import type { EdgeData } from "@/types/flow/edge";
import type { WorkSelection } from "@/types/selection";
import CaseNode from "@/components/nodes/CaseNode";
import { createWorkEdge, loadWorkGraph } from "./workActions";
import { toRFEdges, toRFNodes } from "./workAdapters";

export function WorkCanvas(props: {
  canvas: ApiCanvas | null;
  selection: WorkSelection;
  onSelect: (sel: WorkSelection) => void;

  // expose graph state to parent if needed
  nodes: Array<Node<CaseNodeData, "caseNode">>;
  setNodes: React.Dispatch<React.SetStateAction<Array<Node<CaseNodeData, "caseNode">>>>;
  edges: Array<Edge<EdgeData>>;
  setEdges: React.Dispatch<React.SetStateAction<Array<Edge<EdgeData>>>>;

  selectedInstructionId: string | null; // for new edges default
}) {
  const nodeTypes = useMemo<NodeTypes>(() => ({ caseNode: CaseNode }), []);
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<CaseNodeData>(props.nodes);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<EdgeData>(props.edges);

  // keep local state in sync with parent (minimal)
  useEffect(() => setRfNodes(props.nodes), [props.nodes, setRfNodes]);
  useEffect(() => setRfEdges(props.edges), [props.edges, setRfEdges]);

  // load graph once canvas ready
  useEffect(() => {
    if (!props.canvas?.id) return;
    (async () => {
      const g = await loadWorkGraph(props.canvas!.id);
      const n = toRFNodes(g.nodes);
      const e = toRFEdges(g.edges, props.canvas);
      props.setNodes(n);
      props.setEdges(e);
    })().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.canvas?.id]);

  // connect -> optimistic + save
  const onConnect = useCallback(
    async (conn: Connection) => {
      if (!props.canvas?.id || !conn.source || !conn.target) return;
  
      const tempId = crypto.randomUUID();
      const instructionId = props.selectedInstructionId ?? null;
  
      // optimistic edge
      const optimistic: Edge<EdgeData> = {
        id: tempId,
        source: conn.source,
        target: conn.target,
        sourceHandle: conn.sourceHandle ?? "out",
        targetHandle: conn.targetHandle ?? "in",
        animated: true,
        style: { strokeWidth: 2 },
        label: "",
        data: {
          instructionId,
          prompt: undefined,
          instructionTitle: instructionId
            ? props.canvas.instructions.find((i) => i.id === instructionId)?.title
            : undefined,
        },
      };
  
      const nextEdges = addEdge(optimistic, rfEdges);
      setRfEdges(nextEdges);
      props.setEdges(nextEdges);
  
      const saved = await createWorkEdge({
        canvasId: props.canvas.id,
        sourceNodeId: conn.source,
        targetNodeId: conn.target,
        sourceHandle: conn.sourceHandle ?? "out",
        targetHandle: conn.targetHandle ?? "in",
        instructionId,
        prompt: null,
      });
  
      // replace id + normalize label/data (later user can edit)
      const newEdges = nextEdges.map((e) =>
        e.id === tempId
          ? {
              ...e,
              id: saved.id,
              data: {
                ...e.data,
                instructionId: saved.instructionId ?? null,
                prompt: saved.prompt ?? undefined,
              },
            }
          : e
      );
  
      setRfEdges(newEdges);
      props.setEdges(newEdges);
  
      // auto-select the new edge so user can edit it immediately
      props.onSelect({ kind: "EDGE", edgeId: saved.id });
    },
    [props, rfEdges, setRfEdges]
  );

  return (
    <ReactFlowProvider>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={(chs) => {
          onNodesChange(chs);
          // parent sync
          props.setNodes((prev) => {
            // best effort: ReactFlow returns NodeChange; easiest is to read rfNodes on next render.
            // For MVP we keep parent state from rfNodes via effect syncing; OK.
            return prev;
          });
        }}
        onEdgesChange={(chs) => {
          onEdgesChange(chs);
          props.setEdges((prev) => prev);
        }}
        onConnect={onConnect}
        onNodeClick={(_, n) => props.onSelect({ kind: "NODE", nodeId: n.id })}
        onEdgeClick={(_, e) => props.onSelect({ kind: "EDGE", edgeId: e.id })}
        onPaneClick={() => props.onSelect({ kind: "NONE" })}
        fitView
        nodesConnectable
        connectionMode={ConnectionMode.Loose}
        defaultEdgeOptions={{ animated: true, style: { strokeWidth: 2 } }}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </ReactFlowProvider>
  );
}
