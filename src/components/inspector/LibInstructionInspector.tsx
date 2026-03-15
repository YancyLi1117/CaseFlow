"use client";

import React, { useMemo } from "react";
import { Stack, Typography } from "@mui/material";
import type { InstructionListResponse } from "@/types/api/lib";

export function LibInstructionInspector(props: {
  instructionId: string;
  list: InstructionListResponse | null;
  refreshList: () => void;
}) {
  const inst = useMemo(
    () => props.list?.instructions.find((x) => x.id === props.instructionId) ?? null,
    [props.list, props.instructionId]
  );

  if (!inst) {
    return (
      <Typography variant="body2" color="text.secondary">
        Instruction not found.
      </Typography>
    );
  }

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">{inst.title}</Typography>
      <Typography variant="caption" color="text.secondary">
        {inst.kind} · {inst.id}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        (Next step) edit title/description/template (QUICK only).
      </Typography>
    </Stack>
  );
}