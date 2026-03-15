import { apiGet, apiPost, apiDelete, apiPatch } from "@/lib/apiClient";
import type { InstructionListResponse, ApiInstruction } from "@/types/api/lib";

export async function loadInstructionList(canvasId: string) {
  return apiGet<InstructionListResponse>(`/api/lib/instructions?canvasId=${encodeURIComponent(canvasId)}`);
}

export async function createQuickInstruction(input: {
  canvasId: string;
  title: string;
  description?: string | null;
  template: string;
}) {
  return apiPost<ApiInstruction>("/api/lib/instructions", input);
}

export async function patchInstruction(id: string, input: { title?: string; description?: string | null; template?: string | null }) {
  return apiPatch<ApiInstruction>(`/api/lib/instructions/${id}`, input);
}

export async function deleteInstruction(id: string) {
  return apiDelete<{ ok: true }>(`/api/lib/instructions/${id}`);
}