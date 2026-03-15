"use client";

import React from "react";
import { Paper, Stack, Box, Button } from "@mui/material";
import { ModeTabs, type AppMode } from "./ModeTabs";
import { TopBar } from "./TopBar";

export function Shell(props: {
  mode: AppMode;
  onModeChange: (m: AppMode) => void;

  topbar: {
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
  };

  left: React.ReactNode;
  right: React.ReactNode;
  rightCollapsed: boolean;
  onToggleRight: () => void;
}) {
  const rightWidth = props.rightCollapsed ? "28px" : "360px";

  return (
    <Box sx={{ height: "100vh", display: "grid", gridTemplateColumns: `1fr ${rightWidth}` }}>
      <Box sx={{ position: "relative", minHeight: 0 }}>
        <Paper
          elevation={2}
          sx={{
            position: "absolute",
            zIndex: 10,
            left: 12,
            top: 12,
            p: 1,
            borderRadius: 2,
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <ModeTabs mode={props.mode} onChange={props.onModeChange} />
            <TopBar {...props.topbar} />
          </Stack>
        </Paper>

        <Box sx={{ height: "100%", minHeight: 0 }}>{props.left}</Box>
      </Box>

      <Box sx={{ borderLeft: "1px solid", borderColor: "divider", height: "100%", overflow: "hidden" }}>
        {props.rightCollapsed ? (
          <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Button size="small" variant="outlined" onClick={props.onToggleRight}>
              {"<"}
            </Button>
          </Box>
        ) : (
          props.right
        )}
      </Box>
    </Box>
  );
}
