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
const ID_IS_USED_NO = '1';  // ID для значения "Нет"
const ID_IS_USED_YES = '2'; // ID для значения "Да"
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

    const authConfig = { auth: { username: BPIUM_USER, password: BPIUM_PASSWORD } };

    // --- НОВЫЙ СПОСОБ ПОИСКА ПО ДОКУМЕНТАЦИИ ---
    // Мы используем GET-запрос и передаем фильтры как JSON в параметрах URL
    const filters = {
      [FIELD_ID_PIN_CODE]: pin_code,
      [FIELD_ID_IS_USED]: { "$or": [ID_IS_USED_NO] } // Ищем по ID значения "Нет"
    };
    
    const findUrl = `https://yaronov.bpium.ru/api/v1/catalogs/${BPIUM_CATALOG_ID}/records`;

    const findResponse = await axios.get(findUrl, {
      ...authConfig,
      params: {
        filters: JSON.stringify(filters),
        limit: 1
      }
    });

    const record = findResponse.data[0];

    if (!record) {
      return res.status(404).json({ isValid: false, message: 'PIN not found or already used.' });
    }

    const productTypeId = record.values[FIELD_ID_PRODUCT_TYPE]; // Для категорий ID лежит напрямую
    const allowedApps = ACCESS_MAP[productTypeId];
    if (!allowedApps || !allowedApps.includes(app_id)) {
      return res.status(403).json({ isValid: false, message: 'Access to this application is denied for this PIN.' });
    }

    // 6. Помечаем пин-код как использованный
    const updateUrl = `https://yaronov.bpium.ru/api/v1/catalogs/${BPIUM_CATALOG_ID}/records/${record.id}`;
    const updatePayload = { values: { [FIELD_ID_IS_USED]: [ID_IS_USED_YES] } }; // Передаем как массив
    await axios.patch(updateUrl, updatePayload, authConfig);
    
    return res.status(200).json({ isValid: true, message: 'Access granted' });

  } catch (error) {
    console.error('Error during PIN validation:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    return res.status(500).json({ isValid: false, message: 'An error occurred while validating the PIN.' });
  }
}

// Главный обработчик, который вызывает Vercel
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-control-allow-headers', 'Content-Type, Authorization'); // Добавили Authorization
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'POST') {
    return await handlePostRequest(req, res);
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
