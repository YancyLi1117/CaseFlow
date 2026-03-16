"use client";

import React, { useEffect, useState } from "react";
import { Box, Paper, Typography, Divider, Stack, Button } from "@mui/material";
import type { ApiCanvas } from "@/types/api/canvas";
import type { LibSelection } from "@/types/selection";
import type { InstructionListResponse } from "@/types/api/lib";
import { loadInstructionList } from "./libActions";
import { InstructionList } from "./InstructionList";

export function LibPage(props: {
  canvas: ApiCanvas | null;
  selection: LibSelection;
  onSelect: (sel: LibSelection) => void;

  // expose list state to parent if needed
  list: InstructionListResponse | null;
  setList: React.Dispatch<React.SetStateAction<InstructionListResponse | null>>;

  selectedInstruction:
    | { id: string; kind: "QUICK" | "CUSTOM"; title: string; description: string | null }
    | null;
  miniCanvas: React.ReactNode;
  onNewQuickInstruction: () => void;
  onNewLibNode: () => void;
}) {
  const [loadingErr, setLoadingErr] = useState<string | null>(null);
  const canvasId = props.canvas?.id;
  const setList = props.setList;

  useEffect(() => {
    if (!canvasId) return;
    loadInstructionList(canvasId)
      .then((r) => {
        setList(r);
        setLoadingErr(null);
      })
      .catch((e: unknown) => setLoadingErr(e instanceof Error ? e.message : "Load failed"));
  }, [canvasId, setList]);

  const selectedInstructionId =
    props.selection.kind === "INSTRUCTION" ? props.selection.instructionId : null;

  return (
    <Box
      sx={{
        height: "100%",
        minHeight: 0,
        display: "grid",
        gridTemplateRows: { xs: "38% 62%", md: "30% 70%" },
        gap: 1,
        p: 1,
        pt: { xs: 1, md: 9 },
      }}
    >
      <Paper variant="outlined" sx={{ overflow: "auto", minHeight: 0 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 1 }}>
          <Typography variant="subtitle2">Instructions</Typography>
          <Button size="small" variant="outlined" onClick={props.onNewQuickInstruction}>
            New QUICK
          </Button>
        </Stack>
        <Divider />
        {loadingErr ? (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="error">
              {loadingErr}
            </Typography>
          </Box>
        ) : (
          <InstructionList
            data={props.list}
            selectedId={selectedInstructionId}
            onSelect={(id) => props.onSelect({ kind: "INSTRUCTION", instructionId: id })}
          />
        )}
      </Paper>

      <Paper
        variant="outlined"
        sx={{
          display: "grid",
          gridTemplateRows: "auto 1fr",
          minHeight: 0,
          height: "100%",
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 1 }}>
          <Typography variant="subtitle2">Mini Canvas</Typography>
          {props.selectedInstruction?.kind === "CUSTOM" ? (
            <Button size="small" variant="outlined" onClick={props.onNewLibNode}>
              New Node
            </Button>
          ) : null}
        </Stack>
        
        <Box sx={{ minHeight: { xs: 220, md: 320 }, height: "100%", overflow: "hidden" }}>
          {!props.selectedInstruction ? (
            <Box sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Select an instruction to view details.
              </Typography>
            </Box>
          ) : props.selectedInstruction.kind !== "CUSTOM" ? (
            <Box sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                QUICK instruction has no mini canvas.
              </Typography>
            </Box>
          ) : (
            props.miniCanvas
          )}
        </Box>
      </Paper>
    </Box>
  );
}
