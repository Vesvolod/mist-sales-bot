import express from 'express';
import dotenv from 'dotenv';
import { analyzeMessage } from './utils/analyze.js';
import axios from 'axios';

dotenv.config();
const app = express();
app.use(express.json());

app.post('/webhook', async (req, res) => {
  try {
    const data = req.body;

    console.log('📥 Получен Webhook от Kommo:\n', JSON.stringify(data, null, 2));

    const message = data.message?.text || '';
    const direction = data.message?.direction || '';
    const entityId = data.message?.entity_id;
    const entityType = data.message?.entity_type;

    console.log(`➡️ direction: ${direction}`);
    console.log(`🧾 entity_type: ${entityType}`);
    console.log(`📌 entity_id: ${entityId}`);
    console.log(`💬 message: ${message}`);

    if (!message || !entityId || !entityType || direction !== 'in') {
      console.log('⚠️ Пропущено: либо нет текста, либо не входящее сообщение');
      return res.status(200).send('Ignored');
    }

    // Фильтр служебных сообщений
    const technical = ['moved to', 'field value', 'invoice', 'robot', 'delivered'];
    const isTechnical = technical.some(t => message.toLowerCase().includes(t));

    if (isTechnical) {
      console.log('🔁 Пропущено: техническое сообщение');
      return res.status(200).send('Technical message ignored');
    }

    console.log('🧠 Отправляем на анализ в Mist AI...');
    const result = await analyzeMessage(message);

    console.log('✅ Ответ от Mist AI:\n', JSON.stringify(result, null, 2));

    const noteText = `
🤖 *AI-анализ переписки:*
• 🌐 Язык: ${result.language}
• 🧩 Ключевые параметры: ${Array.isArray(result.keywords) ? result.keywords.join(', ') : '-'}
• 📊 Анализ: ${result.analysis}
• 💬 Ответ: ${result.reply}
• 📈 Рекомендация: ${result.sales_recommendation}
    `.trim();

    const url = `https://${process.env.KOMMO_DOMAIN}/api/v4/${entityType}s/${entityId}/notes`;

    console.log(`📝 Пытаемся записать комментарий в Kommo: ${url}`);

    await axios.post(url, [
      {
        note_type: "common",
        params: { text: noteText }
      }
    ], {
      headers: {
        Authorization: process.env.KOMMO_TOKEN,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Комментарий успешно добавлен в сделку!');
    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Ошибка в Webhook:', err.message);
    res.sendStatus(500);
  }
});

