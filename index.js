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
    const message = data.message?.text || '';
    const leadId = data.lead_id || data.entity_id || null;

    if (
      !message ||
      message.toLowerCase().includes('moved to') ||
      message.toLowerCase().includes('field value') ||
      message.toLowerCase().includes('invoice sent') ||
      message.toLowerCase().includes('from robot') ||
      message.toLowerCase().includes('delivered')
    ) {
      return res.status(200).send('🔁 Пропущено: служебное сообщение');
    }

    const result = await analyzeMessage(message);

    if (leadId && result?.reply) {
      const noteText = `
🤖 *AI-анализ переписки:*
• 🌐 Язык: ${result.language}
• 🧩 Ключевые параметры: ${Array.isArray(result.keywords) ? result.keywords.join(', ') : '-'}
• 📊 Анализ: ${result.analysis}
• 💬 Ответ: ${result.reply}
• 📈 Рекомендация: ${result.sales_recommendation}
      `.trim();

      await axios.post(`https://${process.env.KOMMO_DOMAIN}/api/v4/leads/${leadId}/notes`, [
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
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Ошибка в Webhook:', err.message);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Mist Sales Bot запущен на http://localhost:${PORT}`));
