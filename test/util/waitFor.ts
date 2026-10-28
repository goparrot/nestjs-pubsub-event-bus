export async function waitFor(predicate: () => boolean, timeoutMs = 10_000, intervalMs = 50): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    while (!predicate()) {
        if (Date.now() > deadline) {
            throw new Error(`Condition was not met within ${timeoutMs} ms`);
        }
        await new Promise((resolve: (value: unknown) => void) => setTimeout(resolve, intervalMs));
    }
}
