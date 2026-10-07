import { log } from 'apify';
import { Enrichment } from 'tomba';

import { InputError, queryInt, queryList, runActor } from './standby.js';
import type { RunOptions } from './tomba.js';
import { callTomba, getClient, normalizeEmail, runPool, unique } from './tomba.js';

interface ActorInput extends RunOptions {
    emails?: string[];
    maxResults?: number;
}

const SOURCE = 'tomba_person_enrichment';

await runActor<ActorInput>({
    title: 'Clearbit Person',
    count: (input) => Math.min(unique((input.emails ?? []).map(normalizeEmail)).length, input.maxResults ?? 50),
    fromQuery: (query) => ({
        emails: queryList(query, 'email', 'emails'),
        maxResults: queryInt(query, 'maxResults'),
    }),
    run: async (input, { push, isDone, markDone, standby }) => {
        if (!input.emails?.length) throw new InputError('Input must contain at least one email in "emails".');

        const maxResults = input.maxResults ?? 50;
        const enrichment = new Enrichment(getClient());

        // Each email yields one item, so maxResults caps the number of emails processed.
        const emails = unique(input.emails.map(normalizeEmail)).slice(0, maxResults);
        const pending = emails.filter((email) => !isDone(email));
        if (pending.length < emails.length) {
            log.info(`Resuming: ${emails.length - pending.length} emails already processed.`);
        }
        if (!standby) log.info(`Enriching person data for ${pending.length} emails`);

        await runPool(pending, async (email) => {
            const res = await callTomba('person', { email }, async () => enrichment.person(email));
            if (res.skipped) return;

            const data = res.data as Record<string, unknown> | null | undefined;
            const hasData = !res.error && typeof data === 'object' && data !== null && Object.keys(data).length > 0;

            if (hasData) {
                await push({
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
                await push({
                    email,
                    source: SOURCE,
                    charged: res.charged,
                    cached: res.cached,
                    error,
                });
                log.info(`${email}: ${error}`);
            }

            markDone(email);
        });
    },
});
