"use client";

import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import type { Edge, Node } from "reactflow";

import { buildFlowEdge } from "@/lib/flowEdges";
import { patchWorkNode } from "@/components/work/workActions";
import type { ApiWorkEdge, ApiWorkNode } from "@/types/api/work";
import type { CaseNodeData } from "@/types/flow/node";
import type { EdgeData } from "@/types/flow/edge";
import type { WorkSelection } from "@/types/selection";

type ExecuteStreamState = { nodeId: string; text: string; running: boolean } | null;
type ExecuteDoneState = { nodeId: string; tick: number } | null;

type ExecuteNodeResp = {
  runId: string;
  nextNode: ApiWorkNode;
  edge: ApiWorkEdge;
};

type SetNodes = Dispatch<SetStateAction<Array<Node<CaseNodeData>>>>;
type SetEdges = Dispatch<SetStateAction<Array<Edge<EdgeData>>>>;

export function useNodeExecution(input: {
  clientApiKey: string;
  workNodes: Array<Node<CaseNodeData>>;
  setWorkNodes: SetNodes;
  setWorkEdges: SetEdges;
  setSelection: Dispatch<SetStateAction<WorkSelection>>;
  setSelectedNodeIds: Dispatch<SetStateAction<string[]>>;
  setSelectedEdgeIds: Dispatch<SetStateAction<string[]>>;
  resolveNonOverlappingPosition: (
    base: { x: number; y: number },
    nodes: Array<Node<CaseNodeData>>,
  ) => { x: number; y: number };
  getInstructionTitle: (instructionId: string) => string | undefined;
}) {
  const [executeStream, setExecuteStream] = useState<ExecuteStreamState>(null);
  const [executeDone, setExecuteDone] = useState<ExecuteDoneState>(null);

  const onQuickExecuteNode = useCallback(
    async (nodeId: string, payload: { instructionId: string | null; prompt: string | null }) => {
      setExecuteStream({ nodeId, text: "", running: true });

      const res = await fetch("/api/work/execute-node?stream=1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(input.clientApiKey.trim() ? { "x-openai-api-key": input.clientApiKey.trim() } : {}),
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

      // Once the backend confirms the final result, we convert it into the next
      // graph state: add the new node, connect it, and move the inspector focus.
      const applyResult = (resp: ExecuteNodeResp) => {
        const next = resp.nextNode;
        const position = input.resolveNonOverlappingPosition(
          { x: next.x, y: next.y },
          input.workNodes,
        );

        if (position.x !== next.x || position.y !== next.y) {
          void patchWorkNode(next.id, { x: position.x, y: position.y });
        }

        input.setWorkNodes((prev) => [
          ...prev.map((node) => ({ ...node, selected: false })),
          {
            id: next.id,
            type: "caseNode",
            position,
            data: { context: next.context, title: next.title },
            selected: true,
          },
        ]);

        input.setWorkEdges((prev) => [
          ...prev,
          buildFlowEdge({
            id: resp.edge.id,
            source: resp.edge.sourceNodeId,
            target: resp.edge.targetNodeId,
            sourceHandle: resp.edge.sourceHandle ?? "out",
            targetHandle: resp.edge.targetHandle ?? "in",
            instructionId: resp.edge.instructionId ?? null,
            prompt: resp.edge.prompt ?? undefined,
            instructionTitle: resp.edge.instructionId
              ? input.getInstructionTitle(resp.edge.instructionId)
              : undefined,
          }),
        ]);

        input.setSelection({ kind: "NODE", nodeId: next.id });
        input.setSelectedNodeIds([next.id]);
        input.setSelectedEdgeIds([]);
      };

      // The route returns Server-Sent Events. We read them manually so the UI
      // can reveal output incrementally while the model is still generating.
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

          const payloadData = JSON.parse(data) as {
            delta?: string;
            message?: string;
            runId?: string;
            nextNode?: ApiWorkNode;
            edge?: ApiWorkEdge;
          };

          if (event === "delta" && typeof payloadData.delta === "string") {
            setExecuteStream((prev) =>
              prev && prev.nodeId === nodeId
                ? { ...prev, text: prev.text + payloadData.delta }
                : prev,
            );
          }

          if (event === "done" && payloadData.nextNode && payloadData.edge) {
            applyResult({
              runId: payloadData.runId ?? "",
              nextNode: payloadData.nextNode,
              edge: payloadData.edge,
            });
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
    [input],
  );

  return {
    executeDone,
    executeStream,
    onQuickExecuteNode,
  };
}
