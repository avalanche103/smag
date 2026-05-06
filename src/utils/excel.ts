import ExcelJS from "exceljs";

export async function parseWorkbookPreview(filePath: string): Promise<{ headers: string[]; rows: string[][] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return { headers: [], rows: [] };
  }

  const rows = worksheet
    .getSheetValues()
    .slice(1)
    .map((row) => (Array.isArray(row) ? row.slice(1).map((cell) => String(cell ?? "").trim()) : []))
    .filter((row) => row.some((cell) => cell !== ""));

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  return {
    headers: rows[0],
    rows: rows.slice(1)
  };
}
