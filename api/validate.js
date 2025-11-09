// Импортируем axios
const axios = require('axios');

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

// Отдельная асинхронная функция для основной логики
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

    const authConfig = { auth: { username: BPIUM_USER, password: BPIUM_PASSWORD } };
    const findUrl = `https://yaronov.bpium.ru/api/v1/catalogs/${BPIUM_CATALOG_ID}/records/find`;
    const findPayload = {
      filters: { and: [{ field: FIELD_ID_PIN_CODE, operator: '=', value: pin_code }, { field: FIELD_ID_IS_USED, operator: '=', value: false }] },
      limit: 1,
    };

    const findResponse = await axios.post(findUrl, findPayload, authConfig);
    const record = findResponse.data[0];

    if (!record) {
      return res.status(404).json({ isValid: false, message: 'PIN not found or already used.' });
    }

    const productTypeId = record.values[FIELD_ID_PRODUCT_TYPE]?.id;
    const allowedApps = ACCESS_MAP[productTypeId];
    if (!allowedApps || !allowedApps.includes(app_id)) {
      return res.status(403).json({ isValid: false, message: 'Access to this application is denied for this PIN.' });
    }

    const updateUrl = `https://yaronov.bpium.ru/api/v1/catalogs/${BPIUM_CATALOG_ID}/records/${record.id}`;
    const updatePayload = { values: { [FIELD_ID_IS_USED]: true } };
    await axios.patch(updateUrl, updatePayload, authConfig);
    
    return res.status(200).json({ isValid: true, message: 'Access granted' });

  } catch (error) {
    console.error('Error during PIN validation:', error.response?.data || error.message);
    return res.status(500).json({ isValid: false, message: 'An error occurred while validating the PIN.' });
  }
}

// Главный обработчик, который вызывает Vercel
export default async function handler(req, res) {
  // --- УЛУЧШЕННАЯ ОБРАБОТКА CORS ---
  // Устанавливаем заголовки для ВСЕХ ответов
  res.setHeader('Access-Control-Allow-Origin', '*'); // Разрешаем доступ всем
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Если это предварительный OPTIONS-запрос, просто отвечаем OK и выходим.
  // Никакой другой логики здесь быть не должно!
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Если это POST-запрос, передаем управление нашей основной функции
  if (req.method === 'POST') {
    return await handlePostRequest(req, res);
  }

  // Для всех остальных методов (GET и т.д.) отвечаем ошибкой
  return res.status(405).json({ message: 'Method Not Allowed' });
}
