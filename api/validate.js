// --- НАСТРОЙКИ ---
const BPIUM_CATALOG_ID = 'pin-codes';
const FIELD_ID_PIN_CODE = '2';
const FIELD_ID_PRODUCT_TYPE = '3';
const FIELD_ID_IS_USED = '4';
const ACCESS_MAP = {
  '2': ['app1', 'app2', 'app3', 'app4'],
  '1': ['app1', 'app2'],
};
const ID_IS_USED_NO = '1';
const ID_IS_USED_YES = '2';
// --- КОНЕЦ НАСТРОЕ-К ---

// Вспомогательная функция для ручного чтения тела запроса
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function handlePostRequest(req, res) {
  try {
    // --- ГЛАВНОЕ ИЗМЕНЕНИЕ: Читаем и парсим тело вручную ---
    const body = await parseBody(req);
    // ----------------------------------------------------

    const { pin_code, app_id } = body;
    if (!pin_code || !app_id) {
      return res.status(400).json({ isValid: false, message: 'pin_code and app_id are required' });
    }

    const BPIUM_USER = process.env.BPIUM_USER;
    const BPIUM_PASSWORD = process.env.BPIUM_PASSWORD;
    if (!BPIUM_USER || !BPIUM_PASSWORD) {
      console.error('Server Error: Bpium credentials are not set.');
      return res.status(500).json({ isValid: false, message: 'Server configuration error' });
    }

    const basicAuth = 'Basic ' + Buffer.from(BPIUM_USER + ':' + BPIUM_PASSWORD).toString('base64');
    const headers = { 'Authorization': basicAuth, 'Content-Type': 'application/json' };

    const filters = {
      [FIELD_ID_PIN_CODE]: pin_code,
      [FIELD_ID_IS_USED]: { "$or": [ID_IS_USED_NO] }
    };
    
    const params = new URLSearchParams({ filters: JSON.stringify(filters), limit: 1 });
    const findUrl = `https://yaronov.bpium.ru/api/v1/catalogs/${BPIUM_CATALOG_ID}/records?${params.toString()}`;

    const findResponse = await fetch(findUrl, { method: 'GET', headers: { 'Authorization': basicAuth } });

    if (!findResponse.ok) {
      throw new Error(`Bpium find request failed with status ${findResponse.status}`);
    }

    const records = await findResponse.json();
    const record = records[0];

    if (!record) {
      return res.status(404).json({ isValid: false, message: 'PIN not found or already used.' });
    }

    const productTypeId = record.values[FIELD_ID_PRODUCT_TYPE];
    const allowedApps = ACCESS_MAP[productTypeId];
    if (!allowedApps || !allowedApps.includes(app_id)) {
      return res.status(403).json({ isValid: false, message: 'Access to this application is denied for this PIN.' });
    }

    const updateUrl = `https://yaronov.bpium.ru/api/v1/catalogs/${BPIUM_CATALOG_ID}/records/${record.id}`;
    const updatePayload = { values: { [FIELD_ID_IS_USED]: [ID_IS_USED_YES] } };

    const updateResponse = await fetch(updateUrl, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify(updatePayload)
    });

    if (!updateResponse.ok) {
      throw new Error(`Bpium update request failed with status ${updateResponse.status}`);
    }

    return res.status(200).json({ isValid: true, message: 'Access granted' });

  } catch (error) {
    console.error('Error during PIN validation:', error.message);
    return res.status(500).json({ isValid: false, message: 'An error occurred while validating the PIN.' });
  }
}

// Главный обработчик
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'POST') {
    return await handlePostRequest(req, res);
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
