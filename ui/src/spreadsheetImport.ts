import { createEmptySpreadsheetData } from "./boardList";

const parseCsv = (csvText: string): string[][] => {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentValue = "";
    let inQuotes = false;

    for (let index = 0; index < csvText.length; index += 1) {
        const character = csvText[index];

        if (character === '"') {
            if (inQuotes && csvText[index + 1] === '"') {
                currentValue += '"';
                index += 1;
            } else {
                inQuotes = !inQuotes;
            }

            continue;
        }

        if (character === ',' && !inQuotes) {
            currentRow.push(currentValue);
            currentValue = "";
            continue;
        }

        if ((character === '\n' || character === '\r') && !inQuotes) {
            if (character === '\r' && csvText[index + 1] === '\n') {
                index += 1;
            }

            currentRow.push(currentValue);
            rows.push(currentRow);
            currentRow = [];
            currentValue = "";
            continue;
        }

        currentValue += character;
    }

    if (currentValue.length > 0 || currentRow.length > 0) {
        currentRow.push(currentValue);
        rows.push(currentRow);
    }

    while (rows.length > 0 && rows[rows.length - 1].every((value) => value === "")) {
        rows.pop();
    }

    return rows;
}

export const csvTextToWorkbook = (csvText: string, sheetName: string) => {
    const workbook = createEmptySpreadsheetData() as {
        sheetOrder?: string[];
        sheets?: Record<string, any>;
    };
    const rows = parseCsv(csvText.replace(/^\uFEFF/, ""));
    const sheetId = workbook.sheetOrder?.[0] ?? Object.keys(workbook.sheets ?? {})[0];

    if (!sheetId || !workbook.sheets?.[sheetId]) {
        return workbook;
    }

    const existingSheet = workbook.sheets[sheetId];
    const rowCount = Math.max(existingSheet.rowCount ?? 1000, rows.length || 1);
    const columnCount = Math.max(
        existingSheet.columnCount ?? 20,
        rows.reduce((maxColumns, row) => Math.max(maxColumns, row.length), 0) || 1,
    );

    const cellData: Record<number, Record<number, { v: string }>> = {};

    rows.forEach((row, rowIndex) => {
        const nextRow: Record<number, { v: string }> = {};

        row.forEach((value, columnIndex) => {
            if (value === "") {
                return;
            }

            nextRow[columnIndex] = { v: value };
        });

        if (Object.keys(nextRow).length > 0) {
            cellData[rowIndex] = nextRow;
        }
    });

    workbook.sheets[sheetId] = {
        ...existingSheet,
        name: sheetName || existingSheet.name,
        rowCount,
        columnCount,
        cellData,
    };

    return workbook;
}

export const csvFileNameToBoardName = (fileName: string) => fileName.replace(/\.[^.]+$/, "") || "Untitled";