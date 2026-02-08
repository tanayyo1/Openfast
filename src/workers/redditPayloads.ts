export type ParsedSubmitResponse = {
  redditFullname: string;
  redditId: string;
  permalink: string;
  url: string | null;
};

export function parseSubmitResponse(payload: unknown): ParsedSubmitResponse {
  const data = payload as
    | {
        json?: {
          data?: {
            name?: string;
            id?: string;
            permalink?: string;
            url?: string | null;
          };
        };
      }
    | undefined;

  const name = data?.json?.data?.name;
  const id = data?.json?.data?.id;
  const permalinkFromPayload = data?.json?.data?.permalink;
  const url = data?.json?.data?.url ?? null;
  const permalink =
    permalinkFromPayload ||
    (url && url.includes("reddit.com") ? new URL(url).pathname : null);

  if (!name || !id || !permalink) {
    throw new Error("INVALID_REDDIT_SUBMIT_RESPONSE");
  }

  return {
    redditFullname: name,
    redditId: id,
    permalink,
    url,
  };
}
