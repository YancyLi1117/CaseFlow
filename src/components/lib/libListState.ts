import type { ApiInstruction, InstructionListResponse } from "@/types/api/lib";
import type { LibSelection } from "@/types/selection";

export function appendInstructionSummary(
  previous: InstructionListResponse | null,
  instruction: ApiInstruction,
): InstructionListResponse {
  const summary = {
    id: instruction.id,
    kind: instruction.kind,
    title: instruction.title,
    description: instruction.description ?? null,
  };

  return previous
    ? { instructions: [...previous.instructions, summary] }
    : { instructions: [summary] };
}

export function updateInstructionSummary(
  previous: InstructionListResponse | null,
  instruction: ApiInstruction,
): InstructionListResponse | null {
  if (!previous) return previous;

  return {
    instructions: previous.instructions.map((item) =>
      item.id === instruction.id
        ? {
            ...item,
            title: instruction.title,
            description: instruction.description ?? null,
            kind: instruction.kind,
          }
        : item,
    ),
  };
}

export function removeInstructionSummary(
  previous: InstructionListResponse | null,
  instructionId: string,
): InstructionListResponse | null {
  return previous
    ? { instructions: previous.instructions.filter((item) => item.id !== instructionId) }
    : previous;
}

// Resolve the list item to display in the left sidebar. If the full instruction
// object is already loaded, prefer it so the UI reflects the latest edits.
export function resolveSelectedInstruction(input: {
  libSelection: LibSelection;
  libInstruction: ApiInstruction | null;
  libList: InstructionListResponse | null;
}) {
  const selection = input.libSelection;
  if (selection.kind !== "INSTRUCTION") return null;

  if (input.libInstruction && input.libInstruction.id === selection.instructionId) {
    return {
      id: input.libInstruction.id,
      kind: input.libInstruction.kind,
      title: input.libInstruction.title,
      description: input.libInstruction.description ?? null,
    };
  }

  return input.libList?.instructions.find((item) => item.id === selection.instructionId) ?? null;
}
