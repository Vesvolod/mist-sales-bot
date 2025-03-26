import express from 'express';
import dotenv from 'dotenv';
import crypto from 'crypto';
import axios from 'axios';
import bodyParser from 'body-parser';
import { analyzeMessage } from './utils/analyze.js';

dotenv.config();

const app = express();

// ✅ Поддержка x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

// 🔍 Healthcheck
app.get('/healthcheck', (req, res) => {
  res.json({ status: 'Mist Sales Bot работает ✅' });
});

// 🚀 Основной Webhook
app.post('/webhook', async (req, res) => {
  try {
    // 🔐 Подпись (если есть)
    const signature = req.headers['x-signature'];
    const secret = process.env.KOMMO_SECRET;

    if (signature && secret) {
      const payload = new URLSearchParams(req.body).toString();
      const hmac = crypto.createHmac('sha1', secret);
      hmac.update(payload);
      const digest = hmac.digest('hex');

      if (digest !== signature) {
        console.warn('❌ Неверная подпись Kommo');
        return res.status(403).send('Invalid signature');
      }

      console.log('✅ Подпись Kommo подтверждена');
    } else {
      console.warn('⚠️ Подписи нет — продолжаем без валидации');
    }

    console.log('📥 Пришёл Webhook:\n', JSON.stringify(req.body, null, 2));

    const msg = req.body?.['message[add][0][text]']
      ? {
          text: req.body['message[add][0][text]'],
          type: req.body['message[add][0][type]'],
          entity_id: req.body['message[add][0][entity_id]'],
          entity_type: req.body['message[add][0][entity_type]']
        }
      : null;

    if (!msg || !msg.text || msg.type !== 'incoming') {
      console.log('⚠️ Пропущено: это не входящее сообщение с текстом (или другой тип события)');
      return res.status(200).send('Ignored');
    }

    const { text, entity_id: entityId, entity_type: entityType } = msg;

    console.log(`💬 Получено сообщение: "${text}"`);
    console.log(`📌 entity_id: ${entityId}`);
    console.log(`🧾 entity_type: ${entityType}`);

    if (!text || !entityId || entityType !== 'lead') {
      console.log('⚠️ Пропущено: не сделка или пустой ID');
      return res.status(200).send('Invalid');
    }

    const result = await analyzeMessage(text);
    console.log('✅ Ответ от Mist AI:\n', JSON.stringify(result, null, 2));

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

    console.log('✅ Комментарий добавлен в сделку Kommo');
    res.sendStatus(200);

  } catch (err) {
    console.error('❌ Ошибка в Webhook:', err.message);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Mist Sales Bot активен: http://localhost:${PORT}`));
