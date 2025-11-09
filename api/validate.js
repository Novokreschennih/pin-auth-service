const { Pool } = require('pg');

// --- НАСТРОЙКИ ---
const ACCESS_MAP = {
  'full_package': ['app1', 'app2', 'app3', 'app4'],
  'base_package': ['app1', 'app2'],
};
// --- КОНЕЦ НАСТРОЕК ---

// Вспомогательная функция для ручного чтения тела запроса
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}')); // Добавили || '{}' на случай пустого тела
      } catch (e) {
        reject(e);
      }
    });
  });
}

// Создаем пул соединений. Он будет переиспользовать соединения для скорости.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function handlePostRequest(req, res) {
  try {
    // --- ГЛАВНОЕ ИЗМЕНЕНИЕ: Читаем и парсим тело вручную ---
    const body = await parseBody(req);

    const { pin_code, app_id } = body;
    if (!pin_code || !app_id) {
      return res.status(400).json({ isValid: false, message: 'pin_code and app_id are required' });
    }

    const query = 'SELECT product_type FROM pin_codes WHERE pin_code = $1';
    const result = await pool.query(query, [pin_code]);
    const record = result.rows[0];

    if (!record) {
      return res.status(404).json({ isValid: false, message: 'PIN not found.' });
    }

    const productType = record.product_type;
    const allowedApps = ACCESS_MAP[productType];
    if (!allowedApps || !allowedApps.includes(app_id)) {
      return res.status(403).json({ isValid: false, message: 'Access to this application is denied for this PIN.' });
    }
    
    return res.status(200).json({ isValid: true, message: 'Access granted' });

  } catch (error) {
    console.error('Database query error:', error);
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
