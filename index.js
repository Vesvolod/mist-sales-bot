import express from 'express';
import dotenv from 'dotenv';
import crypto from 'crypto';
import axios from 'axios';
import { analyzeMessage } from './utils/analyze.js';

dotenv.config();

const app = express();

// 🔐 Сохраняем raw тело для подписи
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
    console.log('📥 RAW Webhook body:');
    console.dir(req.body, { depth: null });

    const msg =
      req.body?.message?.add?.[0] ||
      req.body?.data?.message?.[0] ||
      req.body?.payload?.message?.[0] ||
      req.body?.message || 
      req.body;

    console.log('🧾 Предположительный msg:\n', msg);

    const message = msg.text || '';
    const direction = msg.type === 'incoming' ? 'in' : msg.direction || '';
    const entityId = msg.entity_id || msg.lead_id || msg.element_id;
    const entityType = msg.entity_type || (msg.lead_id ? 'lead' : 'contact');

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
      return res.status(200).send('Technical message ignored');
    }

    console.log('🧠 Отправляем в Mist AI на анализ...');
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

    console.log('📩 Отправка заметки в Kommo...');

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

    console.log('✅ Комментарий успешно добавлен!');
    res.sendStatus(200);

  } catch (err) {
    console.error('❌ Ошибка в Webhook:', err.message);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Mist Sales Bot работает на http://localhost:${PORT}`));
