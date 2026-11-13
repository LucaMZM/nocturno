import { yomoganRepository } from '../ai/repositories/yomogan.repository.js';
import { indexEvents } from '../ai/services/yomogan.service.js';
try {
  const events = await yomoganRepository.candidates({});
  for (let i = 0; i < events.length; i += 16) await indexEvents(events.slice(i, i + 16));
  console.log('Yomogan public events indexed:', events.length);
} finally {
  // La caché es local al proceso; el calentamiento persistente se ejecuta en AI.
}
