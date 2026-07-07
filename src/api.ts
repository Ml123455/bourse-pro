const BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/'
const SEARCH = 'https://query1.finance.yahoo.com/v1/finance/search'
const QUOTE = 'https://query1.finance.yahoo.com/v7/finance/quote'

export interface StockData {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  high: number
  low: number
  volume: number
  currency: string
}

export interface SearchResult {
  symbol: string
  name: string
  exchange: string
  type: string
}

export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

export async function searchStocks(query: string): Promise<SearchResult[]> {
  const r = await fetch(`${SEARCH}?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0`)
  const d = await r.json()
  return (d.quotes || []).map((q: any) => ({
    symbol: q.symbol,
    name: q.shortname || q.longname || q.symbol,
    exchange: q.exchange || '',
    type: q.quoteType || '',
  }))
}

export async function getQuote(symbol: string): Promise<StockData | null> {
  const r = await fetch(`${QUOTE}?symbols=${encodeURIComponent(symbol)}`)
  const d = await r.json()
  const q = d.quoteResponse?.result?.[0]
  if (!q) return null
  return {
    symbol: q.symbol,
    name: q.shortName || q.longName || q.symbol,
    price: q.regularMarketPrice ?? 0,
    change: q.regularMarketChange ?? 0,
    changePercent: q.regularMarketChangePercent ?? 0,
    high: q.regularMarketDayHigh ?? 0,
    low: q.regularMarketDayLow ?? 0,
    volume: q.regularMarketVolume ?? 0,
    currency: q.currency || 'USD',
  }
}

export async function getChart(symbol: string, interval = '1d', range = '1mo'): Promise<Candle[]> {
  const r = await fetch(`${BASE}${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`)
  const d = await r.json()
  const result = d.chart?.result?.[0]
  if (!result) return []
  const timestamps = result.timestamp || []
  const quotes = result.indicators?.quote?.[0] || {}
  const opens = quotes.open || []
  const highs = quotes.high || []
  const lows = quotes.low || []
  const closes = quotes.close || []
  return timestamps.map((t: number, i: number) => ({
    time: t,
    open: opens[i] ?? closes[i],
    high: highs[i] ?? closes[i],
    low: lows[i] ?? closes[i],
    close: closes[i] ?? 0,
  })).filter((c: Candle) => c.close > 0)
}

// Major indices
export const INDICES = [
  { symbol: '^GSPC', name: 'S&P 500', flag: '🇺🇸' },
  { symbol: '^IXIC', name: 'NASDAQ', flag: '🇺🇸' },
  { symbol: '^DJI', name: 'Dow Jones', flag: '🇺🇸' },
  { symbol: '^FCHI', name: 'CAC 40', flag: '🇫🇷' },
  { symbol: '^N225', name: 'Nikkei 225', flag: '🇯🇵' },
  { symbol: '^STOXX50E', name: 'Euro Stoxx 50', flag: '🇪🇺' },
]

const WATCHLIST_KEY = 'bourse-pro-watchlist'

export function getWatchlist(): string[] {
  try {
    return JSON.parse(localStorage.getItem(WATCHLIST_KEY) || '[]')
  } catch { return [] }
}

export function saveWatchlist(list: string[]): void {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list))
}
