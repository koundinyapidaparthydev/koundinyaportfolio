/**
 * Shared Google Sheets helpers for job-pipeline scripts.
 * Requires GOOGLE_SHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON in the environment.
 */
import { google } from "googleapis";

function sheetEnv() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!spreadsheetId || !serviceAccountJson) {
    throw new Error("Missing GOOGLE_SHEET_ID or GOOGLE_SERVICE_ACCOUNT_JSON");
  }
  return { spreadsheetId, serviceAccountJson };
}

/** @returns {Promise<import("googleapis").sheets_v4.Sheets>} */
export async function getSheets() {
  const { serviceAccountJson } = sheetEnv();
  const credentials = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

/**
 * Read data rows from a tab (A2:M, no header).
 * @param {string} tabName
 * @returns {Promise<string[][]>}
 */
export async function getSheetRows(tabName) {
  const { spreadsheetId } = sheetEnv();
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A2:M`,
  });
  return res.data.values ?? [];
}

/**
 * Update a single cell.
 * @param {string} tab
 * @param {number} rowIndex 1-based sheet row (data row 1 = row 2)
 * @param {string} columnLetter e.g. "G"
 * @param {string} value
 */
export async function updateSheetCell(tab, rowIndex, columnLetter, value) {
  const { spreadsheetId } = sheetEnv();
  const sheets = await getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tab}!${columnLetter}${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [[value]] },
  });
}
