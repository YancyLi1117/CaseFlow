"use client";

import React, { useEffect, useRef } from "react";
import { Paper, Stack, Box, Button, useMediaQuery, useTheme } from "@mui/material";
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
  onAutoCollapse: () => void;
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isCompact = useMediaQuery(theme.breakpoints.down("lg"));
  const wasCompactRef = useRef(isCompact);

  useEffect(() => {
    if (isCompact && !wasCompactRef.current && !props.rightCollapsed) {
      props.onAutoCollapse();
    }
    wasCompactRef.current = isCompact;
  }, [isCompact, props.onAutoCollapse, props.rightCollapsed]);

  const rightWidth = props.rightCollapsed ? "36px" : isCompact ? "320px" : "360px";
  const mobileInspectorHeight = props.rightCollapsed ? "44px" : "42vh";
  const toolbar = (
    <Paper
      elevation={2}
      sx={{
        position: isMobile ? "relative" : "absolute",
        zIndex: 10,
        left: isMobile ? "auto" : 12,
        top: isMobile ? "auto" : 12,
        m: isMobile ? 1 : 0,
        p: 1,
        borderRadius: 2,
        maxWidth: isMobile ? "calc(100vw - 16px)" : "min(960px, calc(100vw - 420px))",
      }}
    >
      <Stack direction={isMobile ? "column" : "row"} spacing={isMobile ? 1 : 2} alignItems={isMobile ? "stretch" : "center"}>
        <ModeTabs mode={props.mode} onChange={props.onModeChange} />
        <TopBar {...props.topbar} />
      </Stack>
    </Paper>
  );

  const collapsedButton = (
    <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", p: 0.5 }}>
      <Button size="small" variant="outlined" onClick={props.onToggleRight}>
        {isMobile ? "Inspector" : "<"}
      </Button>
    </Box>
  );

  if (isMobile) {
    return (
      <Box sx={{ height: "100vh", display: "grid", gridTemplateRows: `auto minmax(0, 1fr) ${mobileInspectorHeight}` }}>
        {toolbar}
        <Box sx={{ minHeight: 0, overflow: "hidden" }}>{props.left}</Box>
        <Box sx={{ borderTop: "1px solid", borderColor: "divider", minHeight: 0, overflow: "hidden" }}>
          {props.rightCollapsed ? collapsedButton : props.right}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ height: "100vh", display: "grid", gridTemplateColumns: `1fr ${rightWidth}` }}>
      <Box sx={{ position: "relative", minHeight: 0 }}>
        {toolbar}

        <Box sx={{ height: "100%", minHeight: 0 }}>{props.left}</Box>
      </Box>

      <Box sx={{ borderLeft: "1px solid", borderColor: "divider", height: "100%", overflow: "hidden" }}>
        {props.rightCollapsed ? collapsedButton : props.right}
      </Box>
    </Box>
  );
}
