// --- НАСТРОЙКИ ---
const BPIUM_CATALOG_ID = 'pin-codes';
const FIELD_ID_PIN_CODE = '2';
const FIELD_ID_PRODUCT_TYPE = '3';
// Поле is_used нам больше не нужно для логики, но оставляем его ID для ясности
const FIELD_ID_IS_USED = '4'; 
const ACCESS_MAP = {
  '2': ['app1', 'app2', 'app3', 'app4'],
  '1': ['app1', 'app2'],
};
// --- КОНЕЦ НАСТРОЕК ---

async function handlePostRequest(req, res) {
  try {
    const { pin_code, app_id } = req.body;
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

    // Ищем пин-код, ИГНОРИРУЯ статус is_used
    const filters = {
      [FIELD_ID_PIN_CODE]: pin_code
    };
    
    const params = new URLSearchParams({ filters: JSON.stringify(filters), limit: 1 });
    const findUrl = `https://yaronov.bpium.ru/api/v1/catalogs/${BPIUM_CATALOG_ID}/records?${params.toString()}`;

    const findResponse = await fetch(findUrl, {
      method: 'GET',
      headers: { 'Authorization': basicAuth }
    });

    if (!findResponse.ok) {
      throw new Error(`Bpium find request failed with status ${findResponse.status}`);
    }

    const records = await findResponse.json();
    const record = records[0];

    // Если запись не найдена, значит пин-код просто не существует
    if (!record) {
      return res.status(404).json({ isValid: false, message: 'PIN not found.' });
    }

    const productTypeId = record.values[FIELD_ID_PRODUCT_TYPE];
    const allowedApps = ACCESS_MAP[productTypeId];
    if (!allowedApps || !allowedApps.includes(app_id)) {
      return res.status(403).json({ isValid: false, message: 'Access to this application is denied for this PIN.' });
    }

    // БЛОК ОБНОВЛЕНИЯ ПОЛНОСТЬЮ УДАЛЕН

    // Если все проверки пройдены, отправляем успешный ответ
    return res.status(200).json({ isValid: true, message: 'Access granted' });

  } catch (error) {
    console.error('Error during PIN validation:', error.message);
    return res.status(500).json({ isValid: false, message: 'An error occurred while validating the PIN.' });
  }
}

// Главный обработчик (остается без изменений)
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
