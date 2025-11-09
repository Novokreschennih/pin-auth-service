// --- НАСТРОЙКИ ---
const BPIUM_CATALOG_ID = 'pin-codes';
const FIELD_ID_PIN_CODE = '2';
const FIELD_ID_PRODUCT_TYPE = '3';
const FIELD_ID_IS_USED = '4';
const ACCESS_MAP = {
  '2': ['app1', 'app2', 'app3', 'app4'],
  '1': ['app1', 'app2'],
};
// --- КОНЕЦ НАСТРОЕК ---

async function handlePostRequest(req, res) {
  try {
    const { pin: pin_code, app_id } = req.body;
    if (!pin_code || !app_id) {
      return res.status(400).json({ isValid: false, message: 'pin_code and app_id are required' });
    }

    const BPIUM_USER = process.env.BPIUM_USER;
    const BPIUM_PASSWORD = process.env.BPIUM_PASSWORD;
    if (!BPIUM_USER || !BPIUM_PASSWORD) {
      console.error('Server Error: Bpium credentials are not set.');
      return res.status(500).json({ isValid: false, message: 'Server configuration error' });
    }

    // Создаем заголовок для Basic Auth
    const basicAuth = 'Basic ' + Buffer.from(BPIUM_USER + ':' + BPIUM_PASSWORD).toString('base64');

    // 4. Ищем пин-код в Бипиуме с помощью fetch
    const findUrl = `https://yaronov.bpium.ru/api/v1/catalogs/${BPIUM_CATALOG_ID}/records/find`;
    const findPayload = {
      filters: {
        and: [
          { field: FIELD_ID_PIN_CODE, operator: '=', value: pin_code },
          // ИСПРАВЛЕНО: Ищем записи, где галочка "is_used" имеет значение '1' (что равно "Нет")
          { field: FIELD_ID_IS_USED, operator: '=', value: '1' },
        ],
      },
      limit: 1,
    };
    
    const findResponse = await fetch(findUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': basicAuth
      },
      body: JSON.stringify(findPayload)
    });

    if (!findResponse.ok) throw new Error(`Bpium find request failed with status ${findResponse.status}`);
    
    const records = await findResponse.json();
    const record = records[0];

    if (!record) {
      return res.status(404).json({ isValid: false, message: 'PIN not found or already used.' });
    }

    // 5. Проверяем права доступа
    const productTypeId = record.values[FIELD_ID_PRODUCT_TYPE]?.id;
    const allowedApps = ACCESS_MAP[productTypeId];
    if (!allowedApps || !allowedApps.includes(app_id)) {
      return res.status(403).json({ isValid: false, message: 'Access to this application is denied for this PIN.' });
    }

    // 6. Помечаем пин-код как использованный
    const updateUrl = `https://yaronov.bpium.ru/api/v1/catalogs/${BPIUM_CATALOG_ID}/records/${record.id}`;
    const updatePayload = { values: { [FIELD_ID_IS_USED]: '2' } };

    const updateResponse = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': basicAuth
      },
      body: JSON.stringify(updatePayload)
    });

    if (!updateResponse.ok) throw new Error(`Bpium update request failed with status ${updateResponse.status}`);

    // 7. Отправляем успешный ответ
    return res.status(200).json({ isValid: true, message: 'Access granted' });

  } catch (error) {
    console.error('Error during PIN validation:', error.message);
    return res.status(500).json({ isValid: false, message: 'An error occurred while validating the PIN.' });
  }
}

// Главный обработчик, который вызывает Vercel
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'POST') {
    return await handlePostRequest(req, res);
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
