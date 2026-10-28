import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { EnvHttpProxyAgent, getGlobalDispatcher, setGlobalDispatcher } from 'undici';
import { configureProxy } from '../source/Network.js';

test('proxy setup honors NO_PROXY and leaves unconfigured dispatchers untouched', async () => {
    const keys = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'NO_PROXY', 'no_proxy'];
    const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
    const dispatcher = getGlobalDispatcher();
    const server = createServer((_request, response) => response.end('direct connection'));
    let proxy: EnvHttpProxyAgent | undefined;

    try {
        for (const key of keys) delete process.env[key];
        configureProxy();
        assert.equal(getGlobalDispatcher(), dispatcher);

        process.env.HTTP_PROXY = 'http://127.0.0.1:1';
        process.env.HTTPS_PROXY = 'http://127.0.0.1:1';
        process.env.NO_PROXY = '127.0.0.1';
        configureProxy();
        const configured = getGlobalDispatcher();
        assert.ok(configured instanceof EnvHttpProxyAgent);
        proxy = configured;
        await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
        const address = server.address();
        assert.ok(address && typeof address !== 'string');
        const response = await fetch(`http://127.0.0.1:${address.port}`);
        assert.equal(await response.text(), 'direct connection');
    } finally {
        setGlobalDispatcher(dispatcher);
        for (const key of keys) {
            if (original[key] === undefined) delete process.env[key];
            else process.env[key] = original[key];
        }
        await proxy?.close();
        if (server.listening)
            await new Promise<void>((resolve, reject) =>
                server.close(error => (error ? reject(error) : resolve()))
            );
    }
});
