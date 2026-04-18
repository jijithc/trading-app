using Microsoft.AspNetCore.Mvc;
using System.Net.Http;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using TradingApp.Api.Models;
using static System.Runtime.InteropServices.JavaScript.JSType;
using System.Text.Json;
using System;
using System.Diagnostics;

namespace TradingApp.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MarketDataController : ControllerBase
    {
        private readonly HttpClient _httpClient;
        private readonly IHttpClientFactory _clientFactory;
        private readonly ILogger<MarketDataController> _logger;

        public MarketDataController(IHttpClientFactory httpClientFactory, ILogger<MarketDataController> logger)
        {
            _httpClient = httpClientFactory.CreateClient();
            _clientFactory = httpClientFactory;
            _logger = logger;
        }

        [HttpGet("analyze/{symbol}")]
        public async Task<IActionResult> AnalyzeStock(string symbol)
        {
            var url = $"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}";

            using var http = new HttpClient();
            http.DefaultRequestHeaders.Add("User-Agent", 
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");

http.DefaultRequestHeaders.Add("Accept", "application/json");
            var response = await http.GetStringAsync(url);

            var json = JObject.Parse(response);

            var result = json["chart"]?["result"]?[0];
            if (result == null)
                return BadRequest("Invalid response");

            var meta = result["meta"];
            var timestamps = result["timestamp"]?.Select(t => (long)t).ToList();

            var quote = result["indicators"]?["quote"]?[0];

            var open = quote["open"]?.Select(x => (decimal?)x ?? 0).ToList();
            var high = quote["high"]?.Select(x => (decimal?)x ?? 0).ToList();
            var low = quote["low"]?.Select(x => (decimal?)x ?? 0).ToList();
            var close = quote["close"]?.Select(x => (decimal?)x ?? 0).ToList();
            var volume = quote["volume"]?.Select(x => (long?)x ?? 0).ToList();

            // 🔹 Basic validations
            if (timestamps == null || close == null || close.Count == 0)
                return BadRequest("No data");

            // 🔹 Latest values
            var latestPrice = close.Last();
            var previousClose = (decimal)(meta?["previousClose"] ?? 0);

            var change = latestPrice - previousClose;
            var changePercent = previousClose != 0
                ? (change / previousClose) * 100
                : 0;

            // 🔹 Trend (simple)
            var trend = close.Last() > close.First() ? "Bullish" : "Bearish";

            // 🔹 High / Low
            var dayHigh = high.Max();
            var dayLow = low.Min();

            var volatilityPercent = dayLow != 0
                ? ((dayHigh - dayLow) / dayLow) * 100
                : 0;

            // 🔹 Volume analysis
            var avgVolume = (long)volume.Average();
            var latestVolume = volume.Last();
            var isVolumeSpike = latestVolume > avgVolume * 1.5;

            // 🔹 Candle interval detection
            string interval = "Unknown";
            if (timestamps.Count > 1)
            {
                var diff = timestamps[1] - timestamps[0];
                interval = diff switch
                {
                    60 => "1m",
                    300 => "5m",
                    900 => "15m",
                    3600 => "1h",
                    86400 => "1d",
                    _ => $"{diff}s"
                };
            }
var now = DateTime.Now.TimeOfDay;

string phase = now switch
{
    var t when t >= TimeSpan.FromHours(9.25) && t <= TimeSpan.FromHours(10.30)
        => "BEST",

    var t when t >= TimeSpan.FromHours(14.30) && t <= TimeSpan.FromHours(15.15)
        => "GOOD",

    var t when t >= TimeSpan.FromHours(11.30) && t <= TimeSpan.FromHours(13.30)
        => "AVOID",

    _ => "NORMAL"
};
            var resultObj = new StockInferenceResponse
            {
                Symbol = symbol,
                LatestPrice = latestPrice,
                PreviousClose = previousClose,
                Change = change,
                ChangePercent = Math.Round(changePercent, 2),
                Trend = trend,

                DayHigh = dayHigh,
                DayLow = dayLow,
                VolatilityPercent = Math.Round(volatilityPercent, 2),

                AverageVolume = avgVolume,
                LatestVolume = latestVolume,
                IsVolumeSpike = isVolumeSpike,

                CandleInterval = interval,
                Phase = phase
            };

            return Ok(resultObj);
        }

        [HttpGet("yahoo/{symbol}")]
        public async Task<IActionResult> GetYahooData(string symbol)
        {
            var url = $"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}";
            var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
            
            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                return StatusCode((int)response.StatusCode, await response.Content.ReadAsStringAsync());
            }

            var json = await response.Content.ReadAsStringAsync();
            return Content(json, "application/json");
        }

        [HttpGet("nse/gainers")]
        public async Task<IActionResult> GetNseGainers()
        {
            var index = "NIFTY 50";
            var url = $"https://www.nseindia.com/api/equity-stockIndices?index={Uri.EscapeDataString(index)}";
            var json = await ProxyNseRequest(url
            );

            var result = JsonSerializer.Deserialize<NSEResponse>(json);

            var data = result?.data ?? new List<StockData>();

            var gainers = data
                .Where(x => x != null && x.pChange > 0 && x.lastPrice > 0)
                .OrderByDescending(x => x.pChange)
                .Take(100)
                .ToList();

            return Ok(gainers);
        }

        [HttpGet("nse/losers")]
        public async Task<IActionResult> GetNseLosers()
        {
            var index = "NIFTY 50";
            var url = $"https://www.nseindia.com/api/equity-stockIndices?index={Uri.EscapeDataString(index)}";
            var json = await ProxyNseRequest(url
            );

            var result = JsonSerializer.Deserialize<NSEResponse>(
                json,
                new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

            var data = result?.data ?? new List<StockData>();

            var losers = data
                .Where(x => x != null && x.pChange < 0 && x.lastPrice > 0)
                .OrderBy(x => x.pChange)   // most negative first
                .Take(100)
                .ToList();

            return Ok(losers);
        }

        [HttpGet("nse/volumespurts")]
        public async Task<IActionResult> GetNseVolumeSpurts()
        {
            var url = ("https://www.nseindia.com/api/live-analysis-volume-gainers");
            var json = await ProxyNseRequest(url
            );

            var result = JsonSerializer.Deserialize<NSEResponse>(
                json,
                new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

            var data = result?.data ?? new List<StockData>();

            var volumespurts = data
                .OrderByDescending(x => x.volume)   // most negative first
                .Take(100)
                .ToList();

            return Ok(volumespurts);
        }

        [HttpGet("nse/mostactive")]
        public async Task<IActionResult> GetNseMostActive()
        {
            var url = ("https://www.nseindia.com/api/live-analysis-most-active-securities?index=volume");

            var json = await ProxyNseRequest(url
            );

            var result = JsonSerializer.Deserialize<NSEResponse>(
                json,
                new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

            var data = result?.data ?? new List<StockData>();

            var losers = data
                .Where(x => x != null && x.pChange < 0 && x.lastPrice > 0)
                .Take(100)
                .ToList();

            return Ok(losers);
        }

        [NonAction]
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

        [HttpGet("scan")]
        public IActionResult Scan(string symbols)
        {
            var psi = new ProcessStartInfo
            {
                FileName = @"D:\stock-analysis-engine\venv\Scripts\python.exe",
                Arguments = $"D:\\stock-analysis-engine\\main.py {symbols}",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var process = Process.Start(psi);
            string result = process.StandardOutput.ReadToEnd();
            process.WaitForExit();

            return Content(result, "application/json");
        }

        public class NSEResponse
        {
            public List<StockData> data { get; set; }
        }
        public class StockData
        {
            public string symbol { get; set; }
            public decimal pChange { get; set; }
            public decimal lastPrice { get; set; }
            public long volume { get; set; }
            public decimal ltp {  get; set; }
        }
    }
}
