// utils/handleOutgoing.js

import fs from 'fs';
import path from 'path';

const logFilePath = path.resolve('outgoing_messages.log');

/**
 * Сохраняет исходящее сообщение менеджера для последующего анализа или логирования
 * @param {object} msg - Объект сообщения из webhook
 */
export function handleOutgoingMessage(msg) {
  try {
    const text = msg?.text || '';
    const entityId = msg?.entity_id || msg?.element_id;
    const createdAt = msg?.created_at || Date.now();
    const log = {
      entity_id: entityId,
      direction: 'outgoing',
      text,
      created_at: createdAt
    };

    const line = JSON.stringify(log) + '\n';
    fs.appendFileSync(logFilePath, line);
    console.log(`📝 Исходящее сообщение записано: ${text}`);
  } catch (err) {
    console.error('❌ Ошибка при логировании исходящего сообщения:', err.message);
  }
}
