// utils/getChatHistory.js

import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Получает последние N сообщений из чата сделки Kommo
 * @param {string} leadId ID сделки (entity_id)
 * @param {number} limit Количество сообщений (по умолчанию 10)
 * @returns {Promise<string>} Сформированный текст переписки
 */
export async function getChatHistory(leadId, limit = 10) {
  try {
    const response = await axios.get(
      `https://${process.env.KOMMO_DOMAIN}/api/v4/leads/${leadId}/chats/messages`,
      {
        headers: {
          Authorization: process.env.KOMMO_TOKEN
        },
        params: {
          limit,
          sort: 'created_at' // по времени создания
        }
      }
    );

    const messages = response.data?._embedded?.messages || [];

    if (!messages.length) {
      return 'Переписка пуста.';
    }

    const formatted = messages.map(msg => {
      const who = msg.direction === 'out' ? 'Менеджер' : 'Клиент';
      return `${who}: ${msg.text}`;
    });

    return formatted.join('\n');
  } catch (err) {
    console.error('❌ Ошибка при загрузке истории переписки:', err.message);
    return 'Не удалось получить переписку.';
  }
}
