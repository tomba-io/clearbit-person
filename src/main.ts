import { Actor, log } from 'apify';
import { Enrichment } from 'tomba';

import type { RunOptions } from './tomba.js';
import { callTomba, logSummary, normalizeEmail, runPool, setupTomba, unique, useRunState } from './tomba.js';

interface ActorInput extends RunOptions {
    emails: string[];
    maxResults?: number;
}

const SOURCE = 'tomba_person_enrichment';

await Actor.init();

const input = await Actor.getInput<ActorInput>();
if (!input?.emails?.length) {
    await Actor.fail('Input must contain at least one email in "emails".');
}

const { emails: rawEmails, maxResults = 50, ...runOptions } = input!;
const client = await setupTomba(runOptions);
const enrichment = new Enrichment(client);
const state = await useRunState();

// Each email yields one dataset item, so maxResults caps the number of emails processed.
const emails = unique(rawEmails.map(normalizeEmail)).slice(0, maxResults);
const pending = emails.filter((email) => !state.done[email]);
if (pending.length < emails.length) {
    log.info(`Resuming: ${emails.length - pending.length} emails already processed.`);
}

const startedAt = Date.now();
log.info(`Enriching person data for ${pending.length} emails`);

await runPool(pending, async (email) => {
    const res = await callTomba('person', { email }, async () => enrichment.person(email));
    if (res.skipped) return;

    const data = res.data as Record<string, unknown> | null | undefined;
    const hasData = !res.error && typeof data === 'object' && data !== null && Object.keys(data).length > 0;

    if (hasData) {
        await Actor.pushData({
            ...data,
            email,
            source: SOURCE,
            charged: res.charged,
            cached: res.cached,
        });
        log.info(
            `${email}: found ${String((data.name as { fullName?: string } | undefined)?.fullName ?? 'Unknown Person')}${res.cached ? ' (cached)' : ''}`,
        );
    } else {
        const error = res.error ?? 'No data found';
        await Actor.pushData({
            email,
            source: SOURCE,
            charged: res.charged,
            cached: res.cached,
            error,
        });
        log.info(`${email}: ${error}`);
    }

    state.done[email] = true;
});

logSummary('Clearbit Person', emails.length, startedAt);

await Actor.exit();
