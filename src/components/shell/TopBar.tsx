"use client";

import React from "react";
import { Stack, Button, TextField } from "@mui/material";

export function TopBar(props: {
  onNewNode: () => void;
  onCombineToInstruction: () => void;
  onMergeSelected: () => void;
  onDeleteSelection: () => void;
  apiKey: string;
  onApiKeyChange: (value: string) => void;

  canNew: boolean;
  canCombine: boolean;
  canMerge: boolean;
  canDelete: boolean;
}) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
      <Button size="small" variant="contained" onClick={props.onNewNode} disabled={!props.canNew}>
        New Node
      </Button>

      <Button size="small" variant="outlined" disabled={!props.canCombine} onClick={props.onCombineToInstruction}>
        Combine 
      </Button>

      <Button size="small" variant="outlined" disabled={!props.canMerge} onClick={props.onMergeSelected}>
        Merge
      </Button>

      <Button size="small" color="error" variant="outlined" disabled={!props.canDelete} onClick={props.onDeleteSelection}>
        Delete
      </Button>

      <TextField
        size="small"
        type="password"
        label="OpenAI API Key"
        value={props.apiKey}
        onChange={(e) => props.onApiKeyChange(e.target.value)}
        placeholder="sk-..."
        sx={{ width: { xs: "100%", sm: 260 } }}
      />
    </Stack>
  );
}
