import React, { useEffect, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ConnectionMode,
  useReactFlow,
  type Node,
  type Edge,
  type NodeTypes,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
} from "reactflow";
import "reactflow/dist/style.css";
import type { CaseNodeData } from "@/types/flow/node";
import type { EdgeData } from "@/types/flow/edge";
import CaseNode from "@/components/nodes/CaseNode";

export default function LibCanvas(props: {
  nodes: Array<Node<CaseNodeData>>;
  edges: Array<Edge<EdgeData>>;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (conn: Connection) => void;
  onNodeClick: (id: string) => void;
  onEdgeClick: (id: string) => void;
  onPaneClick: () => void;
  onNodeDragStop: (evt: React.MouseEvent, node: Node<CaseNodeData>) => void;
}) {
  const nodeTypes = useMemo<NodeTypes>(() => ({ caseNode: CaseNode }), []);
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (!props.nodes.length) return;
    const id = requestAnimationFrame(() => {
      fitView({ padding: 0.2, includeHiddenNodes: true });
    });
    return () => cancelAnimationFrame(id);
  }, [props.nodes, props.edges, fitView]);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        style={{ width: "100%", height: "100%" }}
        nodes={props.nodes}
        edges={props.edges}
        nodeTypes={nodeTypes}
        onNodesChange={props.onNodesChange}
        onEdgesChange={props.onEdgesChange}
        onConnect={props.onConnect}
      onNodeDragStop={props.onNodeDragStop}
      onNodeClick={(_, node) => props.onNodeClick(node.id)}
      onEdgeClick={(_, edge) => props.onEdgeClick(edge.id)}
      onPaneClick={props.onPaneClick}
      isValidConnection={(c) => {
        if (!c.source || !c.target) return false;
        if (!c.sourceHandle || !c.targetHandle) return false;
        if (c.sourceHandle === "out" && c.targetHandle === "in") return true;
        if (c.sourceHandle === "in" && c.targetHandle === "out") return true;
        return false;
      }}
      fitView
      nodesConnectable
      elementsSelectable
      connectionMode={ConnectionMode.Strict}
        defaultEdgeOptions={{ animated: true, style: { strokeWidth: 2 } }}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
