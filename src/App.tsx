import { useState, useEffect, useRef } from 'react'
import { createChart, ColorType } from 'lightweight-charts'
import {
  searchStocks, getQuote, getChart, INDICES,
  getWatchlist, saveWatchlist,
  type StockData, type SearchResult,
} from './api'

type Page = 'watchlist' | 'indices'

export default function App() {
  const [page, setPage] = useState<Page>('watchlist')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null)
  const [stockData, setStockData] = useState<StockData | null>(null)
  const [chartRange, setChartRange] = useState('1mo')
  const [watchlist, setWatchlist] = useState<string[]>(getWatchlist)
  const [wlData, setWlData] = useState<Record<string, StockData>>({})
  const [idxData, setIdxData] = useState<StockData[]>([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [showInstall, setShowInstall] = useState(false)
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<any>(null)
  const searchTimer = useRef<any>(null)
  const installPrompt = useRef<any>(null)

  // PWA install detection
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      installPrompt.current = e
      setShowInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (installPrompt.current) {
      installPrompt.current.prompt()
      const r = await installPrompt.current.userChoice
      if (r.outcome === 'accepted') setShowInstall(false)
    }
  }

  // Search
  useEffect(() => {
    if (query.length < 1) { setResults([]); return }
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      const r = await searchStocks(query)
      setResults(r.filter(x => x.type === 'EQUITY' || x.type === 'ETF' || x.type === 'INDEX'))
      setSearching(false)
    }, 300)
    return () => clearTimeout(searchTimer.current)
  }, [query])

  // Load watchlist data
  useEffect(() => {
    watchlist.forEach(async (sym) => {
      const d = await getQuote(sym)
      if (d) setWlData(prev => ({ ...prev, [sym]: d }))
    })
  }, [watchlist])

  // Load index data
  useEffect(() => {
    INDICES.forEach(async (idx) => {
      const d = await getQuote(idx.symbol)
      if (d) setIdxData(prev => {
        const filtered = prev.filter(x => x.symbol !== idx.symbol)
        return [...filtered, d].sort((a, b) =>
          INDICES.findIndex(i => i.symbol === a.symbol) - INDICES.findIndex(i => i.symbol === b.symbol)
        )
      })
    })
  }, [])

  // Chart
  useEffect(() => {
    if (!activeSymbol || !chartRef.current) return
    const container = chartRef.current
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 260,
      layout: {
        background: { type: ColorType.Solid, color: '#111827' },
        textColor: '#94a3b8',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: '#1e293b',
      },
      crosshair: {
        mode: 0,
      },
    })
    chartInstance.current = chart

    const series = (chart as any).addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      wickUpColor: '#22c55e',
    })

    const loadChart = async () => {
      const data = await getChart(activeSymbol, '1d', chartRange)
      series.setData(data.map(c => ({
        time: c.time as any,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })))
      chart.timeScale().fitContent()
    }
    loadChart()

    const handleResize = () => {
      chart.resize(container.clientWidth, 260)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [activeSymbol, chartRange])

  const selectStock = async (sym: string) => {
    setActiveSymbol(sym)
    setQuery('')
    setResults([])
    setLoading(true)
    const d = await getQuote(sym)
    setStockData(d)
    setLoading(false)
    if (!watchlist.includes(sym)) {
      const updated = [sym, ...watchlist]
      setWatchlist(updated)
      saveWatchlist(updated)
    }
  }

  const removeFromWatchlist = (sym: string) => {
    const updated = watchlist.filter(s => s !== sym)
    setWatchlist(updated)
    saveWatchlist(updated)
    setWlData(prev => {
      const next = { ...prev }
      delete next[sym]
      return next
    })
  }

  const formatPrice = (p: number) => {
    if (p >= 1000) return p.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
    if (p >= 1) return p.toFixed(2)
    return p.toFixed(4)
  }

  const fmt = (n: number) => n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2)
  const fmtPct = (n: number) => n >= 0 ? `+${n.toFixed(2)}%` : `${n.toFixed(2)}%`
  const fmtVol = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
    return n.toString()
  }

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <h1>Bourse Pro</h1>
        <span>Marchés en direct</span>
      </div>

      {/* Install banner */}
      {showInstall && (
        <div className="install-banner" style={{ display: 'block' }} onClick={install}>
          📲 Installer l'application sur l'écran d'accueil
        </div>
      )}

      {/* Search */}
      <div className="search-wrap">
        <input
          type="text"
          placeholder="Rechercher une action (AAPL, TSLA, LVMH...)"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <span className="search-icon">{searching ? '⏳' : '🔍'}</span>
        {results.length > 0 && (
          <div className="search-results">
            {results.map(r => (
              <div key={r.symbol} className="search-item" onClick={() => selectStock(r.symbol)}>
                <div>
                  <div className="sym">{r.symbol}</div>
                  <div className="name">{r.name}</div>
                </div>
                <span className="exch">{r.exchange}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Index bar */}
      <div className="indices">
        {idxData.map(idx => (
          <div key={idx.symbol} className="index-card" onClick={() => selectStock(idx.symbol)}>
            <div className="name">{INDICES.find(i => i.symbol === idx.symbol)?.flag} {idx.name || idx.symbol}</div>
            <div className="price">{formatPrice(idx.price)}</div>
            <div className="change" style={{ color: idx.change >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {fmtPct(idx.changePercent)}
            </div>
          </div>
        ))}
      </div>

      {/* Stock detail */}
      {loading && (
        <div className="loading"><div className="spinner" /> Chargement...</div>
      )}
      {activeSymbol && stockData && !loading && (
        <div className="fade-in">
          <div className="stock-header">
            <div className="sym">{stockData.symbol}</div>
            <div className="name">{stockData.name}</div>
            <div className="price-row">
              <span className="price">{formatPrice(stockData.price)}</span>
              <span className="change" style={{ color: stockData.change >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {fmt(stockData.change)} ({fmtPct(stockData.changePercent)})
              </span>
            </div>
            <div className="stats">
              <div className="stat">
                <div className="label">Haut</div>
                <div className="val">{formatPrice(stockData.high)}</div>
              </div>
              <div className="stat">
                <div className="label">Bas</div>
                <div className="val">{formatPrice(stockData.low)}</div>
              </div>
              <div className="stat">
                <div className="label">Volume</div>
                <div className="val">{fmtVol(stockData.volume)}</div>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="chart-wrap">
            <div className="chart-controls">
              {[
                ['1d', '1j'], ['5d', '5j'], ['1mo', '1mo'], ['3mo', '3mo'], ['1y', '1an'], ['5y', '5ans'],
              ].map(([r, l]) => (
                <button
                  key={r}
                  className={chartRange === r ? 'active' : ''}
                  onClick={() => setChartRange(r)}
                >{l}</button>
              ))}
            </div>
            <div ref={chartRef} style={{ width: '100%', height: 260 }} />
          </div>
        </div>
      )}

      {/* Watchlist */}
      {page === 'watchlist' && (
        <div className="watchlist">
          <div className="title">⭐ Ma Watchlist</div>
          {watchlist.length === 0 && (
            <div style={{ color: 'var(--text2)', padding: '20px 0', textAlign: 'center', fontSize: '13px' }}>
              Recherche une action pour l'ajouter
            </div>
          )}
          {watchlist.map(sym => {
            const d = wlData[sym]
            return (
              <div key={sym} className="watchlist-item fade-in" onClick={() => selectStock(sym)}>
                <div>
                  <div className="wl-sym">{sym}</div>
                  {d && <div className="wl-name">{d.name}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {d && (
                    <div className="wl-right">
                      <div className="wl-price">{formatPrice(d.price)} {d.currency === 'USD' ? '$' : '€'}</div>
                      <div className="wl-change" style={{ color: d.change >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {fmtPct(d.changePercent)}
                      </div>
                    </div>
                  )}
                  <button className="wl-remove" onClick={e => { e.stopPropagation(); removeFromWatchlist(sym) }}>✕</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Bottom nav */}
      <nav className="bottom-nav">
        <button className={page === 'watchlist' ? 'active' : ''} onClick={() => setPage('watchlist')}>
          <span className="nav-icon">⭐</span>Watchlist
        </button>
        <button className={page === 'indices' ? 'active' : ''} onClick={() => setPage('indices')}>
          <span className="nav-icon">📈</span>Indices
        </button>
      </nav>
    </div>
  )
}
