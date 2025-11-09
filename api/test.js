// api/test.js
export default async function handler(req, res) {
  // Устанавливаем заголовки для CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Обрабатываем OPTIONS-запрос
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Обрабатываем POST-запрос
  if (req.method === 'POST') {
    return res.status(200).json({ message: "Hello from the test endpoint! It works!" });
  }

  // Отклоняем все остальное
  return res.status(405).json({ message: 'Method Not Allowed' });
}
