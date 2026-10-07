// End-to-end tests: run the Actor against a mock Tomba API.
import assert from 'node:assert/strict';
import { after, afterEach, describe, it } from 'node:test';

import type { MockHandler, MockServer } from './helpers.js';
import { removeStorage, runActor, startMockTomba, startStandbyActor, totalCharges } from './helpers.js';

function profile(email: string) {
    return {
        name: { fullName: 'John Collison', givenName: 'John', familyName: 'Collison' },
        email,
        location: 'US',
        gender: 'male',
        geo: { city: 'San Francisco', state: 'California', country: 'United States', countryCode: 'US' },
        employment: { domain: 'stripe.com', name: 'Stripe', title: 'Co-founder & President', role: 'executive' },
        linkedin: { handle: 'https://www.linkedin.com/in/johnbcollison' },
        twitter: { handle: 'https://twitter.com/collision' },
        verification: { date: '2026-09-01T00:00:00+02:00', status: 'valid' },
        phone: true,
    };
}

/** Default Tomba behaviour: known emails return a profile, special emails return edge cases. */
const tomba: MockHandler = (req) => {
    assert.equal(req.method, 'GET');
    assert.equal(req.path, '/people/find');
    const { email } = req.query;
    if (email === 'empty@example.com') return { body: { data: {} } };
    if (email === 'null@example.com') return { body: { data: null } };
    if (email === 'invalid@example.com') return { status: 422, body: { errors: { message: 'Invalid email' } } };
    if (email === 'html@example.com') return { raw: '<html>Bad gateway</html>' };
    return { body: { data: profile(email) } };
};

const servers: MockServer[] = [];
const dirs: string[] = [];

async function mock(handler: MockHandler = tomba): Promise<MockServer> {
    const server = await startMockTomba(handler);
    servers.push(server);
    return server;
}

async function run(...args: Parameters<typeof runActor>) {
    const result = await runActor(...args);
    dirs.push(result.storageDir);
    return result;
}

afterEach(async () => {
    await Promise.all(servers.splice(0).map(async (s) => s.close()));
});

after(async () => {
    await Promise.all(dirs.map(removeStorage));
});

describe('clearbit-person', () => {
    it('returns the profile and charges one event per billable email', async () => {
        const server = await mock();
        const result = await run({
            input: { emails: ['john@stripe.com', 'empty@example.com', 'null@example.com'] },
            endpoint: server.url,
        });

        assert.equal(result.code, 0, result.output);
        assert.equal(result.items.length, 3);

        const john = result.items.find((i) => i.email === 'john@stripe.com');
        assert.deepEqual(john, {
            ...profile('john@stripe.com'),
            email: 'john@stripe.com',
            source: 'tomba_person_enrichment',
            charged: true,
            cached: false,
        });

        for (const email of ['empty@example.com', 'null@example.com']) {
            const item = result.items.find((i) => i.email === email);
            assert.deepEqual(item, {
                email,
                source: 'tomba_person_enrichment',
                charged: false,
                cached: false,
                error: 'No data found',
            });
        }

        assert.deepEqual(result.chargeCounts, { 'tomba-request': 1 });
    });

    it('sends the built-in credentials to Tomba', async () => {
        const server = await mock();
        await run({ input: { emails: ['john@stripe.com'] }, endpoint: server.url });
        assert.equal(server.requests[0].headers['x-tomba-key'], 'ta_test_key');
        assert.equal(server.requests[0].headers['x-tomba-secret'], 'ts_test_secret');
    });

    it('normalizes and deduplicates emails', async () => {
        const server = await mock();
        const result = await run({
            input: { emails: [' John@Stripe.com ', 'john@stripe.com', 'JOHN@STRIPE.COM', 'Info@Tomba.io', '   '] },
            endpoint: server.url,
        });
        assert.deepEqual(server.requests.map((r) => r.query.email).sort(), ['info@tomba.io', 'john@stripe.com']);
        assert.equal(result.items.length, 2);
        assert.equal(totalCharges(result), 2);
    });

    it('does not charge Tomba error statuses and does not retry them', async () => {
        const server = await mock();
        const result = await run({ input: { emails: ['invalid@example.com'] }, endpoint: server.url });
        assert.equal(result.code, 0, result.output);
        assert.equal(server.requests.length, 1);
        assert.equal(result.items[0].email, 'invalid@example.com');
        assert.equal(result.items[0].charged, false);
        assert.match(String(result.items[0].error), /422: Invalid email/);
        assert.equal(totalCharges(result), 0);
    });

    it('does not charge a non-JSON body', async () => {
        const server = await mock();
        const result = await run({ input: { emails: ['html@example.com'] }, endpoint: server.url });
        assert.equal(result.items[0].charged, false);
        assert.match(String(result.items[0].error), /Invalid response/);
        assert.equal(totalCharges(result), 0);
    });

    it('retries 429 and 5xx responses, then charges the success once', async () => {
        let calls = 0;
        const server = await mock(async (req) => {
            calls++;
            if (calls === 1)
                return {
                    status: 429,
                    body: { errors: { message: 'Too many requests' } },
                    headers: { 'retry-after': '1' },
                };
            if (calls === 2) return { status: 503, body: {} };
            return tomba(req);
        });
        const result = await run({ input: { emails: ['john@stripe.com'], maxRetries: 3 }, endpoint: server.url });
        assert.equal(server.requests.length, 3);
        assert.equal(result.items.length, 1);
        assert.equal(result.items[0].charged, true);
        assert.deepEqual(result.items[0].name, {
            fullName: 'John Collison',
            givenName: 'John',
            familyName: 'Collison',
        });
        assert.deepEqual(result.chargeCounts, { 'tomba-request': 1 });
    });

    it('serves repeated runs from the cache for free', async () => {
        const server = await mock();
        const first = await run({ input: { emails: ['john@stripe.com'] }, endpoint: server.url });
        const second = await run({
            input: { emails: ['john@stripe.com'] },
            endpoint: server.url,
            storageDir: first.storageDir,
        });

        assert.equal(server.requests.length, 1);
        assert.equal(totalCharges(first), 1);
        assert.equal(second.items.length, 1);
        assert.deepEqual(second.items[0].name, {
            fullName: 'John Collison',
            givenName: 'John',
            familyName: 'Collison',
        });
        assert.equal(second.items[0].cached, true);
        assert.equal(second.items[0].charged, false);
        assert.equal(totalCharges(second), 0);
    });

    it('calls Tomba again when the cache is disabled', async () => {
        const server = await mock();
        const first = await run({ input: { emails: ['john@stripe.com'], useCache: false }, endpoint: server.url });
        const second = await run({
            input: { emails: ['john@stripe.com'], useCache: false },
            endpoint: server.url,
            storageDir: first.storageDir,
        });
        assert.equal(server.requests.length, 2);
        assert.equal(second.items[0].cached, false);
        assert.equal(totalCharges(second), 1);
    });

    it('stops at the max charge limit and resumes without reprocessing', async () => {
        const server = await mock();
        const emails = ['a@a.com', 'b@b.com', 'c@c.com', 'd@d.com', 'e@e.com'];
        const input = { emails, maxConcurrency: 1, useCache: false, maxResults: 100 };

        // Locally every event costs $1, so a $2 budget allows two billable requests.
        const first = await run({ input, endpoint: server.url, maxTotalChargeUsd: 2 });
        assert.equal(first.code, 0, first.output);
        assert.equal(totalCharges(first), 2);
        assert.equal(server.requests.length, 2);
        assert.equal(first.items.length, 2);

        const second = await run({ input, endpoint: server.url, storageDir: first.storageDir, keepStorage: true });
        assert.equal(second.code, 0, second.output);
        assert.deepEqual(
            server.requests.map((r) => r.query.email),
            emails,
        );
        // The default storages are kept, so the dataset and charging log cover both runs.
        assert.equal(second.items.length, 5);
        assert.equal(totalCharges(second), 5);
    });

    it('respects maxResults', async () => {
        const server = await mock();
        const result = await run({
            input: { emails: ['a@a.com', 'b@b.com', 'c@c.com'], maxResults: 2, maxConcurrency: 1 },
            endpoint: server.url,
        });
        assert.equal(result.items.length, 2);
        assert.equal(server.requests.length, 2);
    });

    it('runs requests in parallel', async () => {
        let active = 0;
        let peak = 0;
        const server = await mock(async (req) => {
            active++;
            peak = Math.max(peak, active);
            await new Promise((r) => {
                setTimeout(r, 100);
            });
            active--;
            return tomba(req);
        });
        const emails = Array.from({ length: 8 }, (_, i) => `user${i}@site${i}.com`);
        await run({ input: { emails, maxConcurrency: 4 }, endpoint: server.url });
        assert.equal(server.requests.length, 8);
        assert.ok(peak > 1 && peak <= 4, `peak concurrency ${peak}`);
    });

    it('fails without Tomba credentials and never calls the API', async () => {
        const server = await mock();
        const result = await run({
            input: { emails: ['john@stripe.com'] },
            endpoint: server.url,
            withCredentials: false,
        });
        assert.notEqual(result.code, 0);
        assert.match(result.output, /misconfigured/);
        assert.doesNotMatch(result.output, /ta_test_key|ts_test_secret/);
        assert.equal(server.requests.length, 0);
    });

    it('fails on empty input', async () => {
        const server = await mock();
        const result = await run({ input: { emails: [] }, endpoint: server.url });
        assert.notEqual(result.code, 0);
        assert.match(result.output, /at least one email/);
        assert.equal(server.requests.length, 0);
    });

    it('fails when the emails field is missing', async () => {
        const server = await mock();
        const result = await run({ input: { domains: ['stripe.com'] }, endpoint: server.url });
        assert.notEqual(result.code, 0);
        assert.equal(server.requests.length, 0);
    });
});

describe('clearbit-person standby (real-time API)', () => {
    it('answers the readiness probe and a bare GET with usage info', async () => {
        const server = await mock();
        const actor = await startStandbyActor({ endpoint: server.url });
        try {
            const probe = await actor.call('/', { headers: { 'x-apify-container-server-readiness-probe': '1' } });
            assert.equal(probe.status, 200);
            const usage = await actor.call('/');
            assert.equal(usage.status, 200);
            assert.match(String(usage.body.usage), /GET/);
            assert.equal(server.requests.length, 0);
        } finally {
            await actor.stop();
        }
    });

    it('looks up emails from GET query parameters and charges per billable email', async () => {
        const server = await mock();
        const actor = await startStandbyActor({ endpoint: server.url });
        let stopped;
        try {
            const res = await actor.call('/?email=%20John@Stripe.com&email=empty@example.com');
            assert.equal(res.status, 200);
            const items = res.body.items as Record<string, unknown>[];
            assert.equal(items.length, 2);
            assert.deepEqual(
                items.find((i) => i.email === 'john@stripe.com'),
                {
                    ...profile('john@stripe.com'),
                    email: 'john@stripe.com',
                    source: 'tomba_person_enrichment',
                    charged: true,
                    cached: false,
                },
            );
            assert.equal(items.find((i) => i.email === 'empty@example.com')?.error, 'No data found');
            assert.deepEqual(
                server.requests.map((r) => r.query.email).sort(),
                ['empty@example.com', 'john@stripe.com'].sort(),
            );
        } finally {
            stopped = await actor.stop();
        }
        assert.deepEqual(stopped.chargeCounts, { 'tomba-request': 1 });
    });

    it('accepts a POST with the same JSON input as a normal run', async () => {
        const server = await mock();
        const actor = await startStandbyActor({ endpoint: server.url });
        try {
            const res = await actor.call('/', { body: { emails: ['a@a.com', 'b@b.com', 'c@c.com'], maxResults: 2 } });
            assert.equal(res.status, 200);
            assert.equal((res.body.items as unknown[]).length, 2);
            assert.equal(server.requests.length, 2);
        } finally {
            await actor.stop();
        }
    });

    it('serves repeated requests from the cache for free', async () => {
        const server = await mock();
        const actor = await startStandbyActor({ endpoint: server.url });
        let stopped;
        try {
            await actor.call('/?email=john@stripe.com');
            const second = await actor.call('/?emails=john@stripe.com');
            assert.ok((second.body.items as Record<string, unknown>[]).every((i) => i.cached === true));
            assert.equal(server.requests.length, 1);
        } finally {
            stopped = await actor.stop();
        }
        assert.deepEqual(stopped.chargeCounts, { 'tomba-request': 1 });
    });

    it('keeps serving after a request hits maxResults', async () => {
        const server = await mock();
        const actor = await startStandbyActor({ endpoint: server.url });
        try {
            const first = await actor.call('/?emails=a@a.com,b@b.com&maxResults=1');
            assert.equal((first.body.items as unknown[]).length, 1);
            const second = await actor.call('/?email=c@c.com');
            assert.equal((second.body.items as unknown[]).length, 1);
            assert.equal(server.requests.length, 2);
        } finally {
            await actor.stop();
        }
    });

    it('rejects invalid input with 400 and unknown paths with 404', async () => {
        const server = await mock();
        const actor = await startStandbyActor({ endpoint: server.url });
        try {
            const empty = await actor.call('/', { body: {} });
            assert.equal(empty.status, 400);
            assert.match(String(empty.body.error), /at least one email/);
            assert.equal((await actor.call('/', { body: 'not json' })).status, 400);
            assert.equal((await actor.call('/?maxResults=abc&email=a@a.com')).status, 400);
            assert.equal((await actor.call('/nope')).status, 404);
            assert.equal((await actor.call('/', { method: 'DELETE' })).status, 405);
            assert.equal(server.requests.length, 0);
        } finally {
            await actor.stop();
        }
    });

    it('returns 402 once the max charge limit is reached', async () => {
        const server = await mock();
        const actor = await startStandbyActor({ endpoint: server.url, maxTotalChargeUsd: 1 });
        try {
            const first = await actor.call('/?email=a@a.com');
            assert.equal(first.status, 200);
            const second = await actor.call('/?email=b@b.com');
            assert.equal(second.status, 402);
            assert.equal(server.requests.length, 1);
        } finally {
            await actor.stop();
        }
    });
});
