import { loadGapiInsideDOM } from 'gapi-script';

const DISCOVERY_DOCS = [
  'https://sheets.googleapis.com/$discovery/rest?version=v4'
];
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

let gapiLoaded = false;

async function initClient() {
  if (!gapiLoaded) {
    await loadGapiInsideDOM();
    gapiLoaded = true;
  }

  return new Promise<void>((resolve, reject) => {
    gapi.load('client:auth2', async () => {
      try {
        await gapi.client.init({
          apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
          clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          discoveryDocs: DISCOVERY_DOCS,
          scope: SCOPES
        });
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function signIn() {
  await gapi.auth2.getAuthInstance().signIn();
}

async function ensureAuth() {
  if (!gapi.auth2.getAuthInstance()) {
    await initClient();
  }
  if (!gapi.auth2.getAuthInstance().isSignedIn.get()) {
    await signIn();
  }
}

async function createSpreadsheet(title: string) {
  await ensureAuth();
  const res = await gapi.client.sheets.spreadsheets.create({
    properties: { title }
  });
  return res.result.spreadsheetId as string;
}

async function updateValues(
  spreadsheetId: string,
  range: string,
  values: any[][]
) {
  await ensureAuth();
  await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    resource: { values }
  });
}

async function exportData(values: any[][], title: string) {
  const spreadsheetId = await createSpreadsheet(title);
  await updateValues(spreadsheetId, 'A1', values);
  return spreadsheetId;
}

export const googleSheets = {
  initClient,
  signIn,
  createSpreadsheet,
  updateValues,
  exportData
};
