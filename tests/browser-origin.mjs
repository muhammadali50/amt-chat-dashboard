import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import ts from 'typescript';

// Real native form navigation, using the actual login HTML and configured header.
// Only disposable dummy data is submitted to a loopback server.
const { outputText } = ts.transpileModule(readFileSync('next.config.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
});
const { default: config } = await import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'));
const configuredPolicy = (await config.headers())[0].headers.find(header => header.key === 'Referrer-Policy').value;
const loginHtml = readFileSync('app/login/route.ts', 'utf8').match(/return new Response\(`([^`]+)`/)[1];
const chromium = process.env.CHROMIUM_PATH || 'chromium';
async function formOrigin(policy) {
  const profile = mkdtempSync(join(tmpdir(), 'amt-browser-origin-'));
  let finish;
  const received = new Promise(resolve => { finish = resolve; });
  const server = createServer(async (request, response) => {
    if (request.method === 'POST' && request.url === '/api/auth/login') {
      for await (const _chunk of request) { /* Discard dummy form body. */ }
      finish(request.headers.origin);
      response.end('Test complete');
      return;
    }
    response.setHeader('Content-Type', 'text/html');
    response.setHeader('Referrer-Policy', policy);
    response.end(loginHtml + '<script>document.getElementById("password").value="test-only";document.querySelector("form").requestSubmit();</script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const child = spawn(chromium, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, `${origin}/login`], { stdio: 'ignore' });
  let timer;
  try {
    const value = await Promise.race([
      received,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Native browser form test timed out')), 20000); }),
      once(child, 'error').then(([error]) => { throw error; })
    ]);
    return { value, origin };
  } finally {
    clearTimeout(timer);
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      await exited;
    }
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    rmSync(profile, { recursive: true, force: true });
  }
}
const broken = await formOrigin('no-referrer');
assert.equal(broken.value, 'null', 'Reproduce the previous native-form CSRF failure');
assert.equal(configuredPolicy, 'same-origin');
const fixed = await formOrigin(configuredPolicy);
assert.equal(fixed.value, fixed.origin, 'Native form must preserve Origin for the strict CSRF check');
console.log('PASS: 3 Chromium assertions: reproduced null Origin with the old policy; configured policy preserves the actual native form Origin.');
