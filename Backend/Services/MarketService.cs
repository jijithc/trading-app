using System;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using TradingApp.Api.Models;
using TradingApp.Api.Repositories;
using System.Collections.Generic;
using System.Linq;
using static TradingApp.Api.Controllers.MarketDataController;

namespace TradingApp.Api.Services
{
    public interface IMarketService
    {
        Task<MarketResearch> GetResearchAsync(string symbol);
        Task<decimal> GetCurrentPriceAsync(string symbol);
        Task<(decimal Price, decimal VolatilityPercent)> GetCurrentPriceAndVolatilityAsync(string symbol);
        Task<System.Collections.Generic.List<string>> GetNseStocksAsync(string source);
        int CalculateConfidence(string symbol);
        Task<(bool ShouldTrade, string Reason, decimal Price, decimal Volatility)> AnalyzeIntradaySignalAsync(string symbol, TradingStrategy strategy);
        Task<System.Collections.Generic.List<string>> GetStocksForStrategyAsync(TradingStrategy strategy);
    }

    public class MarketService : IMarketService
    {
        private readonly Random _random = new Random();
        private readonly HttpClient _httpClient;
        private readonly IHttpClientFactory _clientFactory;
        private readonly ICsvRepository _repo;

        public MarketService(IHttpClientFactory httpClientFactory, ICsvRepository repo)
        {
            _httpClient = httpClientFactory.CreateClient();
            _clientFactory = httpClientFactory;
            _repo = repo;
        }

        public async Task<MarketResearch> GetResearchAsync(string symbol)
        {
            var (price, vol) = await GetCurrentPriceAndVolatilityAsync(symbol);
            
            // Logic for recommendation based on simple metrics or confidence
            var confidence = CalculateConfidence(symbol);
            var recommendation = confidence > 85 ? "Buy" : (confidence > 70 ? "Hold" : "Sell");
            
            var reason = recommendation == "Buy" ? $"Price of {price} is showing strength with {vol}% volatility." 
                       : recommendation == "Sell" ? $"Price of {price} is under pressure with {vol}% volatility." 
                       : "Market consolidating.";

            return new MarketResearch
            {
                Symbol = symbol,
                Date = DateTime.Now,
                CurrentPrice = price,
                Recommendation = recommendation,
                Reason = reason
            };
        }

        public int CalculateConfidence(string symbol)
        {
            // Placeholder: Returning distinct random 0-100 for each call
            return 100;
        }

        public async Task<decimal> GetCurrentPriceAsync(string symbol)
        {
            var res = await GetCurrentPriceAndVolatilityAsync(symbol);
            return res.Price;
        }

        public async Task<(decimal Price, decimal VolatilityPercent)> GetCurrentPriceAndVolatilityAsync(string symbol)
        {
            try
            {
                var fetchSymbol = symbol;
                if (!symbol.Contains(".") && !symbol.Contains("-") && !symbol.Contains("=")) {
                    fetchSymbol = $"{symbol}.NS";
                }

                var url = $"https://query1.finance.yahoo.com/v8/finance/chart/{fetchSymbol}";
                var req = new HttpRequestMessage(HttpMethod.Get, url);
                req.Headers.Add("User-Agent", "Mozilla/5.0");
                var rep = await _httpClient.SendAsync(req);

                if (!rep.IsSuccessStatusCode && fetchSymbol.EndsWith(".NS")) 
                {
                    fetchSymbol = symbol;
                    url = $"https://query1.finance.yahoo.com/v8/finance/chart/{fetchSymbol}";
                    req = new HttpRequestMessage(HttpMethod.Get, url);
                    req.Headers.Add("User-Agent", "Mozilla/5.0");
                    rep = await _httpClient.SendAsync(req);
                }

                if (!rep.IsSuccessStatusCode) return (0, 0);

                using var json = JsonDocument.Parse(await rep.Content.ReadAsStringAsync());
                var meta = json.RootElement.GetProperty("chart").GetProperty("result")[0].GetProperty("meta");
                
                var price = Math.Round(meta.GetProperty("regularMarketPrice").GetDecimal(), 2);
                
                decimal volatility = 0;
                if (meta.TryGetProperty("regularMarketDayHigh", out var h) && 
                    meta.TryGetProperty("regularMarketDayLow", out var l) &&
                    meta.TryGetProperty("previousClose", out var prev))
                {
                    decimal high = h.GetDecimal();
                    decimal low = l.GetDecimal();
                    decimal prevClose = prev.GetDecimal();
                    
                    if (prevClose > 0)
                        volatility = Math.Round(((high - low) / prevClose) * 100, 2);
                    else if (price > 0)
                        volatility = Math.Round(((high - low) / price) * 100, 2);
                }

                return (price, volatility);
            }
            catch { return (0, 0); }
        }

        public async Task<System.Collections.Generic.List<string>> GetNseStocksAsync(string source)
        {
            try
            {
                var index = "NIFTY 50";
                var url = $"https://www.nseindia.com/api/equity-stockIndices?index={Uri.EscapeDataString(index)}";
                var json = await ProxyNseRequest(url);

                var result = JsonSerializer.Deserialize<NSEResponse>(json);
                var data = result?.data ?? new List<StockData>();

                var stocks = new List<StockData>();

                if (source == "gainers")
                {
                    stocks = data
                        .Where(x => x != null && x.pChange > 0 && x.lastPrice > 0)
                        .OrderByDescending(x => x.pChange)
                        .Take(100)
                        .ToList();
                }
                else if (source == "losers")
                {
                    stocks = data
                        .Where(x => x != null && x.pChange < 0 && x.lastPrice > 0)
                        .OrderBy(x => x.pChange)
                        .Take(100)
                        .ToList();
                }
                else if (source == "volumespurts")
                {
                    stocks = data
                        .Where(x => x != null && x.lastPrice > 0)
                        .OrderByDescending(x => x.volume)
                        .Take(100)
                        .ToList();
                }
                else
                {
                    stocks = data.Where(x => x != null && x.lastPrice > 0).ToList();
                }

                return stocks?.Select(i => i.symbol).ToList() ?? new List<string>();
            }
            catch { return new System.Collections.Generic.List<string>(); }
        }

        public async Task<List<string>> GetStocksForStrategyAsync(TradingStrategy strategy)
        {
            if (strategy.StockSource?.ToLower() == "watchlist")
            {
                return _repo.GetWatchlist()
                    .Where(w => w.UserId == strategy.UserId && (string.IsNullOrEmpty(strategy.WatchlistGroup) || w.WatchlistName == strategy.WatchlistGroup))
                    .Select(w => w.Symbol)
                    .ToList();
            }

            return await GetNseStocksAsync(strategy.StockSource ?? "gainers");
        }


        public async Task<string> ProxyNseRequest(string url)
        {
            var client = new HttpClient();

            client.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0");
            client.DefaultRequestHeaders.Add("Accept", "application/json");
            client.DefaultRequestHeaders.Add("Referer", "https://www.nseindia.com/");

            await client.GetAsync("https://www.nseindia.com");

            var response = await client.GetAsync(url);

            return await response.Content.ReadAsStringAsync();
        }

        public async Task<(bool ShouldTrade, string Reason, decimal Price, decimal Volatility)> AnalyzeIntradaySignalAsync(string symbol, TradingStrategy strategy)
        {
            try
            {
                var fetchSymbol = symbol;
                if (!symbol.Contains(".") && !symbol.Contains("-") && !symbol.Contains("=")) {
                    fetchSymbol = $"{symbol}.NS";
                }
                string interval = strategy.Timeframe ?? "15m";
                string range = interval switch
                {
                    "1m" => "1d",
                    "5m" => "5d",
                    "15m" => "5d",
                    "1h" => "1mo",
                    "1d" => "3mo",
                    _ => "5d"
                };

                var url = $"https://query1.finance.yahoo.com/v8/finance/chart/{fetchSymbol}?interval={interval}&range={range}";
                var req = new HttpRequestMessage(HttpMethod.Get, url);
                req.Headers.Add("User-Agent", "Mozilla/5.0");
                var rep = await _httpClient.SendAsync(req);

                if (!rep.IsSuccessStatusCode && fetchSymbol.EndsWith(".NS")) 
                {
                    fetchSymbol = symbol;
                    url = $"https://query1.finance.yahoo.com/v8/finance/chart/{fetchSymbol}?interval={interval}&range={range}";
                    req = new HttpRequestMessage(HttpMethod.Get, url);
                    req.Headers.Add("User-Agent", "Mozilla/5.0");
                    rep = await _httpClient.SendAsync(req);
                }

                if (!rep.IsSuccessStatusCode) return (false, "Failed to fetch market data.", 0, 0);

                using var json = JsonDocument.Parse(await rep.Content.ReadAsStringAsync());
                var result = json.RootElement.GetProperty("chart").GetProperty("result")[0];
                var meta = result.GetProperty("meta");
                var indicators = result.GetProperty("indicators").GetProperty("quote")[0];

                // ✅ Extract timestamps
                var timestamps = result.GetProperty("timestamp")
                    .EnumerateArray()
                    .Select(t => t.GetInt64())
                    .ToList();

                var closes = indicators.GetProperty("close").EnumerateArray()
                    .Select(c => c.ValueKind == JsonValueKind.Number ? c.GetDecimal() : 0m).ToList();

                var volumes = indicators.GetProperty("volume").EnumerateArray()
                    .Select(v => v.ValueKind == JsonValueKind.Number ? v.GetDecimal() : 0m).ToList();

                var highs = indicators.GetProperty("high").EnumerateArray()
                    .Select(h => h.ValueKind == JsonValueKind.Number ? h.GetDecimal() : 0m).ToList();

                var lows = indicators.GetProperty("low").EnumerateArray()
                    .Select(l => l.ValueKind == JsonValueKind.Number ? l.GetDecimal() : 0m).ToList();

                // ✅ Build CLEAN candles (remove null/zero candles)
                var candles = new List<(long ts, decimal high, decimal low, decimal close, decimal volume)>();

                for (int i = 0; i < timestamps.Count; i++)
                {
                    var close = closes[i];
                    var high = highs[i];
                    var low = lows[i];
                    var volume = volumes[i];

                    if (close <= 0 || high <= 0 || low <= 0)
                        continue;

                    candles.Add((timestamps[i], high, low, close, volume));
                }

                if (candles.Count < 2)
                    return (false, "Insufficient clean candles.", 0, 0);

                // ✅ Remove incomplete last candle
                int intervalSeconds = interval switch
                {
                    "1m" => 60,
                    "5m" => 300,
                    "15m" => 900,
                    "1h" => 3600,
                    _ => 60
                };

                var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

                if (candles.Count > 0)
                {
                    var last = candles.Last();
                    if (now - last.ts < intervalSeconds)
                    {
                        candles.RemoveAt(candles.Count - 1);
                    }
                }

                if (candles.Count < 2)
                    return (false, "Not enough confirmed candles.", 0, 0);

                // ✅ Extract clean series
                var cleanCloses = candles.Select(c => c.close).ToList();
                var cleanVolumes = candles.Select(c => c.volume).ToList();
                var cleanHighs = candles.Select(c => c.high).ToList();
                var cleanLows = candles.Select(c => c.low).ToList();

                // ✅ Safe current price
                var currentPrice = cleanCloses.LastOrDefault();
                if (currentPrice <= 0)
                    currentPrice = meta.GetProperty("regularMarketPrice").GetDecimal();

                // ✅ Volatility
                decimal volatility = 0;
                if (meta.TryGetProperty("regularMarketDayHigh", out var h_) &&
                    meta.TryGetProperty("regularMarketDayLow", out var l_) &&
                    meta.TryGetProperty("previousClose", out var prev_))
                {
                    decimal dh = h_.GetDecimal();
                    decimal dl = l_.GetDecimal();
                    decimal pc = prev_.GetDecimal();
                    if (pc > 0)
                        volatility = Math.Round(((dh - dl) / pc) * 100, 2);
                }

                bool technicalOk = true;
                string technicalReason = "Technical conditions met.";

                // ✅ Volume Surge
                if (strategy.CheckVolumeSurge)
                {
                    int lb = strategy.LookbackPeriod > 0 ? strategy.LookbackPeriod : 20;

                    if (cleanVolumes.Count < lb + 2)
                        return (false, "Not enough data for volume analysis.", currentPrice, volatility);

                    var avgVol = cleanVolumes
                        .TakeLast(lb + 1)
                        .SkipLast(1)
                        .Where(v => v > 0)
                        .DefaultIfEmpty(0)
                        .Average();

                    var latestVol = cleanVolumes.Last();
                    var ratio = strategy.VolumeSurgeRatio > 0 ? strategy.VolumeSurgeRatio : 1.5m;

                    if (latestVol < avgVol * ratio)
                    {
                        technicalOk = false;
                        technicalReason = $"Volume surge not detected. Ratio: {Math.Round(avgVol > 0 ? latestVol / avgVol : 0, 2)} < {ratio}";
                    }
                }

                // ✅ Breakout / Breakdown
                if (technicalOk && strategy.CheckBreakout)
                {
                    var lookback = strategy.LookbackPeriod > 0 ? strategy.LookbackPeriod : 20;

                    if (cleanHighs.Count < lookback + 2)
                        return (false, "Not enough data for breakout analysis.", currentPrice, volatility);

                    var historicalHighs = cleanHighs
                        .TakeLast(lookback + 1)
                        .SkipLast(1)
                        .ToList();

                    var historicalLows = cleanLows
                        .TakeLast(lookback + 1)
                        .SkipLast(1)
                        .ToList();

                    var resistance = historicalHighs.Max();
                    var support = historicalLows.Min();

                    if (strategy.Type == "Buy")
                    {
                        if (currentPrice <= resistance)
                        {
                            technicalOk = false;
                            technicalReason = $"Price ₹{currentPrice} hasn't broken resistance ₹{resistance}.";
                        }
                    }
                    else if (strategy.Type == "Sell")
                    {
                        if (currentPrice >= support)
                        {
                            technicalOk = false;
                            technicalReason = $"Price ₹{currentPrice} hasn't broken support ₹{support}.";
                        }
                    }
                }

                return (technicalOk, technicalReason, currentPrice, volatility);
            }
            catch (Exception ex)
            {
                return (false, $"Error during analysis: {ex.Message}", 0, 0);
            }
        }
    }
}
