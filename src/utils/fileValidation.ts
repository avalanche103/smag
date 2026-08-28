const signatures: Array<{ kind: UploadKind; mime: string; check: (buffer: Buffer) => boolean }> = [
  { kind: "cover", mime: "image/jpeg", check: (buffer) => buffer[0] === 0xff && buffer[1] === 0xd8 },
  { kind: "cover", mime: "image/png", check: (buffer) => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { kind: "cover", mime: "image/webp", check: (buffer) => buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP" },
  { kind: "invoice", mime: "application/pdf", check: (buffer) => buffer.subarray(0, 5).toString("ascii") === "%PDF-" },
  { kind: "pdfList", mime: "application/pdf", check: (buffer) => buffer.subarray(0, 5).toString("ascii") === "%PDF-" },
  {
    kind: "list",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    check: (buffer) => buffer[0] === 0x50 && buffer[1] === 0x4b
  }
];

export type UploadKind = "cover" | "invoice" | "list" | "pdfList";

export async function validateUploadedFile(filePath: string, kind: UploadKind): Promise<boolean> {
  const fs = await import("node:fs/promises");
  const buffer = await fs.readFile(filePath);
  return signatures.some((entry) => entry.kind === kind && entry.check(buffer));
}
