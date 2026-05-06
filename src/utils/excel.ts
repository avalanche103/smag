import readXlsxFile from "read-excel-file/node";

export async function parseWorkbookPreview(filePath: string): Promise<{ headers: string[]; rows: string[][] }> {
  const rows = (await readXlsxFile(filePath))
    .map((row) => row.map((cell) => String(cell ?? "").trim()))
    .filter((row) => row.some((cell) => cell !== ""));

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  return {
    headers: rows[0],
    rows: rows.slice(1)
  };
}
