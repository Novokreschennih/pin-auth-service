// Импортируем библиотеку для совершения HTTP-запросов
const axios = require('axios');

// --- НАСТРОЙКИ ВАШЕЙ СИСТЕМЫ ---
// Замените значения на ваши реальные ID из Бипиум

const BPIUM_CATALOG_ID = 'pin-codes'; // Текстовый ID вашего каталога

// Числовые ID полей
const FIELD_ID_PIN_CODE = '2';
const FIELD_ID_PRODUCT_TYPE = '3';
const FIELD_ID_IS_USED = '4';

// Карта доступа: определяет, какой тип продукта к каким приложениям дает доступ.
// Это центральное место для управления правами.
const ACCESS_MAP = {
  '2': ['app1', 'app2', 'app3', 'app4'],
  '1': ['app1', 'app2'],
  // Добавляйте сюда новые типы продуктов по мере необходимости
};

// --- КОНЕЦ НАСТРОЕК ---


// Основная функция, которая будет выполняться на Vercel
export default async function handler(req, res) {
  // 1. Проверяем, что запрос использует метод POST
  if (req.method !== 'POST') {
    return res.status(405).json({ isValid: false, message: 'Method Not Allowed' });
  }

  // 2. Получаем пин-код и ID приложения из тела запроса
  const { pin_code, app_id } = req.body;

  if (!pin_code || !app_id) {
    return res.status(400).json({ isValid: false, message: 'pin_code and app_id are required' });
  }

  // 3. Получаем логин и пароль из переменных окружения Vercel для безопасности
  const BPIUM_USER = process.env.BPIUM_USER;
  const BPIUM_PASSWORD = process.env.BPIUM_PASSWORD;

  if (!BPIUM_USER || !BPIUM_PASSWORD) {
    console.error('Error: Bpium credentials are not set in environment variables.');
    return res.status(500).json({ isValid: false, message: 'Server configuration error' });
  }

  // Настраиваем Basic Auth для всех запросов
  const authConfig = {
    auth: {
      username: BPIUM_USER,
      password: BPIUM_PASSWORD,
    },
  };

  try {
    // 4. Ищем пин-код в Бипиуме
    const findUrl = `https://yaronov.bpium.ru/api/v1/catalogs/${BPIUM_CATALOG_ID}/records`;
    const findPayload = {
      filters: {
        and: [
          { field: FIELD_ID_PIN_CODE, operator: '=', value: pin_code },
          { field: FIELD_ID_IS_USED, operator: '=', value: false },
        ],
      },
      limit: 1,
    };

    const findResponse = await axios.post(findUrl, findPayload, authConfig);
    const record = findResponse.data[0];

    // Если запись не найдена, значит пин неверный или уже использован
    if (!record) {
      return res.status(404).json({ isValid: false, message: 'PIN not found or already used.' });
    }

    // 5. Проверяем права доступа для этого пин-кода
    const productType = record.values[FIELD_ID_PRODUCT_TYPE]?.title; // У полей "Категория" значение лежит в .title
    const allowedApps = ACCESS_MAP[productType];

    if (!allowedApps || !allowedApps.includes(app_id)) {
      return res.status(403).json({ isValid: false, message: 'Access to this application is denied for this PIN.' });
    }

    // 6. Если все проверки пройдены, помечаем пин-код как использованный
    const updateUrl = `https://yaronov.bpium.ru/api/v1/catalogs/${BPIUM_CATALOG_ID}/records/${record.id}`;
    const updatePayload = {
      values: {
        [FIELD_ID_IS_USED]: true,
      },
    };
    
    await axios.patch(updateUrl, updatePayload, authConfig);
    
    // 7. Отправляем успешный ответ приложению
    return res.status(200).json({ isValid: true, message: 'Access granted' });

  } catch (error) {
    // 8. Обрабатываем возможные ошибки (включая плавающую 401)
    // Логируем ошибку на сервере для отладки
    console.error('Error during PIN validation:', error.response?.data || error.message);
    
    // Отправляем общую ошибку клиенту
    return res.status(500).json({ isValid: false, message: 'An error occurred while validating the PIN.' });
  }
}
