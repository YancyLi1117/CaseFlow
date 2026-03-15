import type { Metadata } from "next";
import "./global.css";

import React from "react";
import { CssBaseline } from "@mui/material";

export const metadata: Metadata = {
  title: "CaseFlow MVP",
  description: "Canvas-based AI case flow tool",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CssBaseline />
        {children}
      </body>
    </html>
  );
}