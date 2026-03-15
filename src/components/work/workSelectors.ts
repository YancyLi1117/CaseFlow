import type { Edge } from "reactflow";
import type { EdgeData } from "@/types/flow/edge";

export function outgoingEdgesOf(nodeId: string, edges: Array<Edge<EdgeData>>) {
  return edges.filter((e) => e.source === nodeId);
}