// Apify SDK - toolkit for building Apify Actors (Read more at https://docs.apify.com/sdk/js/)
import { Actor } from 'apify';
// Tomba SDK for person enrichment
import { Enrichment, TombaClient } from 'tomba';

interface ActorInput {
    tombaApiKey: string;
    tombaApiSecret: string;
    emails?: string[];
    maxResults?: number;
}

// Rate limiting: 150 requests per minute
const RATE_LIMIT = 150;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds
let requestCount = 0;
let windowStart = Date.now();

async function rateLimitedRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    const now = Date.now();

    // Reset counter if window has passed
    if (now - windowStart > RATE_LIMIT_WINDOW) {
        requestCount = 0;
        windowStart = now;
    }

    // Check if we've hit the rate limit
    if (requestCount >= RATE_LIMIT) {
        const waitTime = RATE_LIMIT_WINDOW - (now - windowStart);
        console.log(`Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)} seconds...`);
        await new Promise<void>((resolve) => {
            setTimeout(() => resolve(), waitTime);
        });

        // Reset after waiting
        requestCount = 0;
        windowStart = Date.now();
    }

    requestCount++;
    return await requestFn();
}

// The init() call configures the Actor for its environment
await Actor.init();

try {
    // Get input from the Actor
    const input = (await Actor.getInput()) as ActorInput;

    if (!input) {
        throw new Error('No input provided');
    }

    if (!input.tombaApiKey || !input.tombaApiSecret) {
        throw new Error('Tomba API key and secret are required');
    }

    console.log('Starting Tomba Clearbit-Person Actor...');
    console.log(`Processing ${input.emails?.length || 0} emails`);

    // Initialize Tomba client
    const client = new TombaClient();
    const enrichment = new Enrichment(client);

    client.setKey(input.tombaApiKey).setSecret(input.tombaApiSecret);

    const results: Record<string, unknown>[] = [];
    const maxResults = input.maxResults || 50;

    // Process emails
    if (input.emails && input.emails.length > 0) {
        console.log(`Processing ${input.emails.length} emails...`);

        for (const email of input.emails) {
            if (results.length >= maxResults) break;

            try {
                console.log(`Enriching person data for email: ${email}`);

                // Use Tomba's person enrichment method with rate limiting
                const tombaResult = await rateLimitedRequest(async () => enrichment.person(email));

                if (tombaResult && tombaResult.data) {
                    const personData = {
                        ...tombaResult.data,
                        email,
                        source: 'tomba_person_enrichment',
                    };

                    results.push(personData);
                    console.log(
                        `Found person data for: ${email} - ${tombaResult.data.name?.fullName || 'Unknown Person'}`,
                    );
                }
            } catch (error) {
                console.log(`Error processing email ${email}:`, error);

                // Add error entry to results for transparency
                results.push({
                    email,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    source: 'tomba_person_enrichment',
                });
            }
        }
    }

    if (results.length > 0) {
        await Actor.pushData(results);
    }

    // Log summary
    console.log('=== SUMMARY ===');
    console.log(`Total emails processed: ${input.emails?.length || 0}`);
    console.log(`Successful enrichments: ${results.filter((r) => !('error' in r)).length}`);
    console.log(`Failed enrichments: ${results.filter((r) => 'error' in r).length}`);
} catch (error) {
    console.error('Actor failed:', error);
    throw error;
}

// Gracefully exit the Actor process
await Actor.exit();
