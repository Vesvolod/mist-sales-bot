import express from 'express';
import dotenv from 'dotenv';
import crypto from 'crypto';
import bodyParser from 'body-parser';
import axios from 'axios';
import { analyzeMessage } from './utils/analyze.js';

dotenv.config();

const app = express();

// 🧠 Слушаем raw body для HMAC или нестандартных форматов
app.use(bodyParser.raw({ type: '*/*' }));

app.get('/healthcheck', (req, res) => {
  res.json({ status: 'Mist Sales Bot работает ✅' });
});

app.post('/webhook', async (req, res) => {
  try {
    let bodyRaw = req.body.toString();
    let data;

    try {
      data = JSON.parse(bodyRaw);
    } catch (err) {
      console.warn('❗ Не удалось распарсить тело как JSON:', err.message);
      return res.status(400).send('Invalid JSON body');
    }

    const signature = req.headers['x-signature'];
    const secret = process.env.KOMMO_SECRET;

    if (signature && secret) {
      const hmac = crypto.createHmac('sha1', secret);
      hmac.update(req.body);
      const digest = hmac.digest('hex');
      if (digest !== signature) {
        console.warn('❌ Неверная подпись Kommo');
        return res.status(403).send('Invalid signature');
      }
      console.log('✅ Подпись Kommo подтверждена');
    } else {
      console.warn('⚠️ Webhook без подписи — продолжаем без валидации');
    }

    const msg = data?.message?.add?.[0];

    if (!msg) {
      console.log('⚠️ Webhook не содержит message.add');
      return res.status(200).send('No message');
    }

    const message = msg.text || '';
    const direction = msg.type === 'incoming' ? 'in' : 'out';
    const entityId = msg.entity_id;
    const entityType = msg.entity_type;

    console.log(`➡️ direction: ${direction}`);
    console.log(`📌 entity_id: ${entityId}`);
    console.log(`🧾 entity_type: ${entityType}`);
    console.log(`💬 message: ${message}`);

    if (!message || direction !== 'in' || !entityId || entityType !== 'lead') {
      return res.status(200).send('Ignored');
    }

    const result = await analyzeMessage(message);

    const noteText = `
🤖 *AI-анализ переписки:*
• 🌐 Язык: ${result.language}
• 🧩 Ключевые параметры: ${Array.isArray(result.keywords) ? result.keywords.join(', ') : '-'}
• 📊 Анализ: ${result.analysis}
• 💬 Ответ: ${result.reply}
• 📈 Рекомендация: ${result.sales_recommendation}
    `.trim();

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
app.listen(PORT, () => console.log(`🚀 Mist Sales Bot на http://localhost:${PORT}`));
