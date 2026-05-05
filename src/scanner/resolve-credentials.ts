import { NetworkError } from "@/utils";

export const resolveCredentials =
  async (
    scannerUrl: string,
    options: { apiKey?: string; consumerId?: string; fetchImpl?: typeof fetch },
  ): Promise<{ apiKey: string; consumerId: string }> => {
    const { apiKey, consumerId } = options;
    if (apiKey && consumerId) return { apiKey, consumerId };
    const created = await createConsumer(scannerUrl, options);
    return {
      apiKey: apiKey ?? created.apiKey,
      consumerId: consumerId ?? created.consumerId,
    };
  }


export const createConsumer = async (
    scannerUrl: string,
    options: { fetchImpl?: typeof fetch }
  ): Promise<{ apiKey: string; consumerId: string }> => {
    const fetchImpl =
      options.fetchImpl ??
      (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined);
    if (!fetchImpl) {
      throw new NetworkError('No fetch implementation available. Pass options.fetchImpl.');
    }
    const url = `${scannerUrl.replace(/\/$/, '')}/consumers`;
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username: `user${Date.now()}` }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new NetworkError(`Failed to create consumer: status=${res.status}, body=${body}`);
    }
    const data = (await res.json()) as { consumer?: { id?: string }; key?: string };
    if (!data.consumer?.id || !data.key) {
      throw new NetworkError(`Invalid consumer response: ${JSON.stringify(data)}`);
    }
    return { apiKey: data.key, consumerId: data.consumer.id };
}