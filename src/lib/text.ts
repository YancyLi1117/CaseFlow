export function short(s: string | null | undefined, n = 26): string {
  if (!s) return "";
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

export type ParsedNodeContext = {
  raw: string;
  memory: string | null;
  output: string;
};

export function parseNodeContext(context: string | null | undefined): ParsedNodeContext {
  const raw = context ?? "";
  const outputMarker = "\nOUTPUT:\n";

  if (raw.includes(outputMarker)) {
    const [memory, ...rest] = raw.split(outputMarker);
    return {
      raw,
      memory,
      output: rest.join(outputMarker),
    };
  }

  if (raw.startsWith("Generated Output:")) {
    return {
      raw,
      memory: null,
      output: raw.replace(/^Generated Output:\n?/, ""),
    };
  }

  return {
    raw,
    memory: null,
    output: raw,
  };
}

export function extractOutput(context: string | null | undefined): string {
  return parseNodeContext(context).output;
}

export function replaceOutput(context: string | null | undefined, nextOutput: string): string {
  const parsed = parseNodeContext(context);
  if (parsed.memory !== null) {
    return `${parsed.memory}\nOUTPUT:\n${nextOutput}`;
  }
  return nextOutput;
}
