export type ApiInstruction = {
  id: string;
  kind: "QUICK" | "CUSTOM";
  title: string;
  description?: string | null;
  template?: string | null; // QUICK 的一句话 prompt
};

export type ApiCanvas = {
  id: string;
  title: string;
  instructions: ApiInstruction[];
};