import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { z } from 'zod';
import { env } from '../src/config/env.js';
import { yomoganAiService } from '../src/services/yomogan-ai.service.js';
test('AI adapter uses both protocols, validates structured output and redacts provider errors', async () => {
  const requests = [];
  const server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    requests.push({ path: req.url, body, key: req.headers.authorization });
    res.setHeader('content-type', 'application/json');
    if (body.model === 'bad') {
      res.statusCode = 503;
      return res.end('{"private":"provider secret"}');
    }
    if (req.url.endsWith('/api/chat'))
      return res.end(JSON.stringify({ message: { content: '{"answer":"hola"}' } }));
    if (req.url.endsWith('/chat/completions'))
      return res.end(JSON.stringify({ choices: [{ message: { content: '{"answer":"hola"}' } }] }));
    if (req.url.endsWith('/api/embed'))
      return res.end(JSON.stringify({ embeddings: body.input.map(() => [1, 0]) }));
    return res.end(
      JSON.stringify({
        data: body.input.map((_, index) => ({ index, embedding: [1, 0] })).reverse(),
      }),
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const previous = { ...env },
    root = 'http://127.0.0.1:' + server.address().port;
  try {
    for (const protocol of ['ollama', 'compatible']) {
      env.YOMOGAN_PROVIDER = protocol;
      env.YOMOGAN_EMBED_PROVIDER = protocol;
      env.YOMOGAN_CHAT_URL = root;
      env.YOMOGAN_EMBED_URL = root;
      env.YOMOGAN_API_KEY = 'fixture-key';
      env.YOMOGAN_MODEL = 'fixture';
      assert.deepEqual(
        await yomoganAiService.generate('test', {}, z.object({ answer: z.string() })),
        { answer: 'hola' },
      );
      assert.deepEqual(await yomoganAiService.embed(['a', 'b']), [
        [1, 0],
        [1, 0],
      ]);
    }
    assert.equal(requests[0].path, '/api/chat');
    assert.equal(requests[0].body.think, false);
    assert.equal(requests[0].body.stream, false);
    assert.equal(requests[0].body.format.type, 'object');
    assert.equal(requests[2].body.response_format.type, 'json_schema');
    assert.equal(requests[0].key, '***');
    env.YOMOGAN_MODEL = 'bad';
    await assert.rejects(
      yomoganAiService.generate('test', {}, z.object({ answer: z.string() })),
      (error) => error.status === 503 && !JSON.stringify(error).includes('provider secret'),
    );
  } finally {
    Object.assign(env, previous);
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
