// All Gamma API calls go through the local backend proxy to avoid CORS
const PROXY = "/api/polymarket/events";

function buildUrl(params) {
  return `${PROXY}?${new URLSearchParams(params).toString()}`;
}

function parseMarket(event, market) {
  let prices = [0.5, 0.5];
  try { prices = JSON.parse(market.outcomePrices); } catch (e) {}
  let clobTokenIds = [];
  try { clobTokenIds = JSON.parse(market.clobTokenIds || "[]"); } catch (e) {}
  return {
    question: market.question,
    slug: market.slug,
    url: `https://polymarket.com/event/${event.slug}`,
    prices,
    clobTokenIds,
    liquidity: parseFloat(market.liquidity || 0),
    volume: parseFloat(market.volume || 0),
  };
}

/**
 * Fetches the top active Polymarket markets by volume across multiple pages.
 * Returns a flat deduplicated array sorted by volume descending.
 */
export async function fetchTopMarkets(total = 200) {
  const pageSize = 50;
  const pages = Math.ceil(total / pageSize);
  const seen = new Set();
  const markets = [];

  const fetches = Array.from({ length: pages }, (_, i) =>
    fetch(buildUrl({ limit: pageSize, offset: i * pageSize, active: "true", closed: "false", order: "volume", ascending: "false" }))
      .then(r => r.ok ? r.json() : [])
      .catch(() => [])
  );

  const results = await Promise.all(fetches);

  for (const events of results) {
    if (!Array.isArray(events)) continue;
    for (const event of events) {
      if (!event.markets) continue;
      for (const market of event.markets) {
        if (market.active && !market.closed && !seen.has(market.slug)) {
          seen.add(market.slug);
          markets.push(parseMarket(event, market));
        }
      }
    }
  }

  markets.sort((a, b) => b.volume - a.volume);
  return markets;
}

/**
 * Searches Polymarket for active events matching the query (proxied).
 * Returns the top active market with its prices and URL.
 */
export async function searchPolymarket(query) {
  try {
    const response = await fetch(buildUrl({ limit: 5, active: "true", query }));
    if (!response.ok) return null;
    const events = await response.json();
    if (!events || events.length === 0) return null;

    for (const event of events) {
      if (!event.markets) continue;
      const market = event.markets.find(m => m.active && !m.closed);
      if (market) return parseMarket(event, market);
    }
    return null;
  } catch (error) {
    console.error("Failed to search Polymarket:", error);
    return null;
  }
}
