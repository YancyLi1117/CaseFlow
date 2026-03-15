import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/apiClient";
import type { ApiCanvas } from "@/types/api/canvas";
import type { ApiWorkNode, ApiWorkEdge, WorkGraphResponse } from "@/types/api/work";

export async function loadCanvas(): Promise<ApiCanvas> {
  return apiGet<ApiCanvas>("/api/canvas");
}

export async function loadWorkGraph(canvasId: string): Promise<WorkGraphResponse> {
  return apiGet<WorkGraphResponse>(`/api/work/graph?canvasId=${encodeURIComponent(canvasId)}`);
}

export async function createWorkNode(input: { canvasId: string; x: number; y: number; context?: string; title?: string }) {
  return apiPost<ApiWorkNode>("/api/work/nodes", input);
}

export async function patchWorkNode(id: string, input: { context?: string; x?: number; y?: number; title?: string }) {
  return apiPatch<ApiWorkNode>(`/api/work/nodes/${id}`, input);
}

export async function deleteWorkNode(id: string) {
  return apiDelete<{ ok: true }>(`/api/work/nodes/${id}`);
}

export async function createWorkEdge(input: {
  canvasId: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  instructionId?: string | null;
  prompt?: string | null;
}) {
  return apiPost<ApiWorkEdge>("/api/work/edges", input);
}

export async function deleteWorkEdge(id: string) {
  return apiDelete<{ ok: true }>(`/api/work/edges/${id}`);
}

export async function executeWork(input: { nodeId: string; instructionId?: string | null; prompt?: string | null }) {
  return apiPost<{ run: unknown; nextNode: ApiWorkNode; edge: ApiWorkEdge }>("/api/work/execute", input);
}
export async function patchWorkEdge(
  id: string,
  input: { instructionId?: string | null; prompt?: string | null }
) {
  return apiPatch<ApiWorkEdge>(`/api/work/edges/${id}`, input);
}
