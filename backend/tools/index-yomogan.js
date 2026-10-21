import { yomoganRepository } from '../src/repositories/yomogan.repository.js';
import { indexEvents } from '../src/services/yomogan.service.js';
import { closePool } from '../src/config/db.js';
try {
  const events = await yomoganRepository.candidates({});
  for (let i = 0; i < events.length; i += 16) await indexEvents(events.slice(i, i + 16));
  console.log('Yomogan public events indexed:', events.length);
} finally {
  await closePool();
}
