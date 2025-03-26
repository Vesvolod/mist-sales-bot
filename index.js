import express from 'express';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { analyzeMessage } from './utils/analyze.js';
import axios from 'axios';

dotenv.config();

const app = express();

// Используем "raw body" для валидации подписи
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

app.get('/healthcheck', (req, res) => {
  res.json({ status: 'Mist Sales Bot работает ✅' });
});

app.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-signature'];
    const secret = process.env.KOMMO_SECRET;

    if (!signature || !secret) {
      console.warn('❗ Отсутствует подпись или секрет!');
      return res.status(403).send('Missing signature or secret');
    }

    // Проверяем HMAC-SHA1 подпись
    const hmac = crypto.createHmac('sha1', secret);
    hmac.update(req.rawBody);
    const digest = hmac.digest('hex');

    if (digest !== signature) {
      console.warn('❌ Неверная подпись Kommo Webhook');
      return res.status(403).send('Invalid signature');
    }

    const data = req.body;
    const msg = data?.message?.add?.[0];

    if (!msg) {
      console.log('⚠️ Webhook не содержит сообщения');
      return res.status(200).send('No message found');
    }

    const message = msg.text || '';
    const direction = msg.type === 'incoming' ? 'in' : 'out';
    const entityId = msg.entity_id;
    const entityType = msg.entity_type;

    console.log(`➡️ direction: ${direction}`);
    console.log(`🧾 entity_type: ${entityType}`);
    console.log(`📌 entity_id: ${entityId}`);
    console.log(`💬 message: ${message}`);

    if (!message || direction !== 'in' || !entityId || entityType !== 'lead') {
      console.log('⚠️ Пропущено: не входящее или неполное сообщение');
      return res.status(200).send('Ignored');
    }

    const technical = ['moved to', 'field value', 'invoice', 'robot', 'delivered'];
    if (technical.some(t => message.toLowerCase().includes(t))) {
      console.log('🔁 Пропущено: техническое сообщение');
      return res.status(200).send('Technical ignored');
    }

    console.log('🧠 Анализируем через Mist AI...');
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

    console.log('📩 Создаём TextNote в Kommo...');

    await axios.post(`https://${process.env.KOMMO_DOMAIN}/private/api/v2/json/leads/note/add`, {
      request: {
        leads: {
          note: [
            {
              note_type: "4",
              element_type: "2",
              element_id: entityId,
              text: noteText
            }
          ]
        }
      }
    }, {
      headers: {
        Authorization: process.env.KOMMO_TOKEN,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Комментарий добавлен!');
    res.sendStatus(200);

  } catch (err) {
    console.error('❌ Ошибка:', err.message);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Mist Sales Bot работает на http://localhost:${PORT}`));
