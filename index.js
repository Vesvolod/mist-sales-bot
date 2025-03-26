import express from 'express';
import dotenv from 'dotenv';
import { analyzeMessage } from './utils/analyze.js';
import axios from 'axios';

dotenv.config();

const app = express();
app.use(express.json());

app.get('/healthcheck', (req, res) => {
  res.json({ status: 'Mist Sales Bot работает ✅' });
});

app.post('/webhook', async (req, res) => {
  try {
    console.log('📥 Получен Webhook от Kommo:');
    console.dir(req.body, { depth: null });

    const msg = req.body?.message?.add?.[0];

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
      console.log('⚠️ Пропущено: либо не входящее сообщение, либо пустое, либо не сделка');
      return res.status(200).send('Ignored');
    }

    const technical = ['moved to', 'field value', 'invoice', 'robot', 'delivered'];
    if (technical.some(t => message.toLowerCase().includes(t))) {
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

    console.log('📝 Пытаемся записать TextNote через Kommo API v2...');

    await axios.post(`https://${process.env.KOMMO_DOMAIN}/private/api/v2/json/leads/note/add`, {
      request: {
        leads: {
          note: [
            {
              note_type: "4", // TextNote
              element_type: "2", // 2 = сделка
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

    console.log('✅ Комментарий успешно добавлен в сделку!');
    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Ошибка в Webhook:', err.message);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Mist Sales Bot запущен на http://localhost:${PORT}`));
