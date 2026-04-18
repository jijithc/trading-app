using Microsoft.AspNetCore.Mvc;
using System;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using TradingApp.Api.Models;
using TradingApp.Api.Repositories;
using TradingApp.Api.Services;

namespace TradingApp.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TradingController : ControllerBase
    {
        private static readonly Random _rnd = new Random();
        private readonly ICsvRepository _repo;
        private readonly IBrokerService _brokerService;
        private readonly IMarketService _marketService;
        private readonly ILogger<TradingController> _logger;

        public TradingController(ICsvRepository repo, IBrokerService brokerService, IMarketService marketService, ILogger<TradingController> logger)
        {
            _repo = repo;
            _brokerService = brokerService;
            _marketService = marketService;
            _logger = logger;
        }

        private User GetCurrentUser()
        {
            // Assuming Authorization header contains user Id
            var userId = Request.Headers["Authorization"].FirstOrDefault()?.Replace("Bearer ", "");
            return _repo.GetUsers().FirstOrDefault(u => u.Id == userId);
        }


        [HttpGet("portfolio")]
        public async Task<IActionResult> GetPortfolio()
        {
            var user = GetCurrentUser();
            if (user == null) return Unauthorized();

            if (!_brokerService.Authenticate(user.BrokerApiKey))
                return BadRequest("Invalid Broker API Key");

            var userTxs = _repo.GetTransactions().Where(t => t.UserId == user.Id).OrderBy(t => t.Date).ToList();
            
            decimal balance = 1000000m; // Starting mock balance 10L
            var positions = new System.Collections.Generic.Dictionary<string, PositionItem>();

            foreach (var t in userTxs)
            {
                if (!positions.ContainsKey(t.Symbol))
                {
                    positions[t.Symbol] = new PositionItem { Symbol = t.Symbol, Quantity = 0 };
                }

                var p = positions[t.Symbol];

                if (t.Type == "Buy")
                {
                    balance -= t.Quantity * t.Price;
                    p.Quantity += t.Quantity;
                    p.TotalBuyCost += t.Quantity * t.Price;
                    p.TotalBuyQty += t.Quantity;
                }
                else if (t.Type == "Sell")
                {
                    balance += t.Quantity * t.Price;
                    var avgCost = p.TotalBuyQty > 0 ? (p.TotalBuyCost / p.TotalBuyQty) : 0;
                    var cogs = t.Quantity * avgCost;

                    p.Quantity -= t.Quantity;
                    p.TotalBuyCost -= cogs;
                    p.TotalBuyQty -= t.Quantity;
                    p.TotalSellRevenue += t.Quantity * t.Price;
                    p.TotalSellQty += t.Quantity;
                    p.PnL += ((t.Quantity * t.Price) - cogs);
                }
            }

            var activePositions = positions.Values.Where(p => p.Quantity > 0).ToList();
            
            decimal totalInvested = 0;
            decimal totalCurrent = 0;

            foreach (var p in activePositions)
            {
                p.AvgBuyPrice = p.TotalBuyQty > 0 ? p.TotalBuyCost / p.TotalBuyQty : 0;
                p.CurrentPrice = await _marketService.GetCurrentPriceAsync(p.Symbol);
                
                p.InvestedValue = p.Quantity * p.AvgBuyPrice;
                p.CurrentValue = p.Quantity * p.CurrentPrice;
                p.ValueChange = p.CurrentValue - p.InvestedValue;
                p.PercChange = p.InvestedValue > 0 ? (p.ValueChange / p.InvestedValue) * 100 : 0;

                totalInvested += p.InvestedValue;
                totalCurrent += p.CurrentValue;
            }

            var portfolio = new
            {
                AccountId = "ACC-" + (user.Id.Length >= 4 ? user.Id.Substring(0, 4) : user.Id),
                Balance = balance,
                TotalInvested = totalInvested,
                TotalCurrentValue = totalCurrent,
                TotalPnL = totalCurrent - totalInvested,
                Positions = activePositions
            };

            return Ok(portfolio);
        }

        [HttpGet("research/{symbol}")]
        public async Task<IActionResult> GetResearch(string symbol)
        {
            var user = GetCurrentUser();
            if (user == null) return Unauthorized();

            var research = await _marketService.GetResearchAsync(symbol);
            
            // Save Market Research Copy 
            _repo.AddMarketResearch(research);

            return Ok(research);
        }

        [HttpPost("trade")]
        public async Task<IActionResult> ExecuteTrade([FromBody] TransactionRequest req)
        {
            var user = GetCurrentUser();
            if (user == null) return Unauthorized();

            if (!_brokerService.Authenticate(user.BrokerApiKey))
                return BadRequest("Invalid Broker API Key");

            var marketAnalysis = await _marketService.GetResearchAsync(req.Symbol);
            _repo.AddMarketResearch(marketAnalysis); // Save research before action as requested

            // 1. Create PENDING order
            var order = new Order
            {
                UserId = user.Id,
                Symbol = req.Symbol,
                Type = req.Type,
                Quantity = req.Quantity,
                Price = Math.Round(marketAnalysis.CurrentPrice, 2), // Use current ltp
                Date = DateTime.Now,
                Status = "Pending",
                TargetPercent = req.TargetPercent,
                StopLossPercent = req.StopLossPercent,
                Confidence = _marketService.CalculateConfidence(req.Symbol)
            };
            _repo.AddOrder(order);

            try 
            {
                // We no longer call the broker here. 
                // The TradeMonitorService will pick up the 'Pending' order and execute it when the price is right.
                return Ok(new { 
                    Message = "Order placed in book. Waiting for execution...", 
                    Order = order,
                    Research = marketAnalysis 
                });
            }
            catch (Exception ex)
            {
                order.Status = "Rejected";
                var allOrders = _repo.GetOrders();
                var index = allOrders.FindIndex(o => o.Id == order.Id);
                if (index != -1) allOrders[index] = order;
                _repo.UpdateOrders(allOrders);
                return BadRequest(new { Message = "Order placement failed.", Error = ex.Message });
            }
        }

        [HttpGet("transactions")]
        public IActionResult GetTransactions()
        {
            var user = GetCurrentUser();
            if (user == null) return Unauthorized();

            var txs = _repo.GetTransactions().Where(t => t.UserId == user.Id).OrderByDescending(t => t.Date).ToList();
            return Ok(txs);
        }

        [HttpPost("bulk-trade")]
        public IActionResult ExecuteBulkTrade([FromBody] BulkTradeRequest req)
        {
            _logger.LogInformation($"Bulk Trade Request Received: {System.Text.Json.JsonSerializer.Serialize(req)}");
            var user = GetCurrentUser();
            if (user == null) return Unauthorized();

            if (req.Trades == null || !req.Trades.Any())
                return BadRequest("No trades provided.");

            var executed = new System.Collections.Generic.List<Transaction>();
            foreach (var trade in req.Trades)
            {
                var order = new Order
                {
                    UserId = user.Id,
                    Symbol = trade.Symbol,
                    Type = trade.Type ?? "Buy",
                    Quantity = trade.Quantity,
                    Price = Math.Round(trade.Price, 2),
                    Date = DateTime.Now,
                    Status = "Pending",
                    TargetPercent = trade.TargetPercent,
                    StopLossPercent = trade.StopLossPercent,
                    Confidence = _marketService.CalculateConfidence(trade.Symbol)
                };
                _repo.AddOrder(order);

                // We only create the pending orders. No immediate broker call.
                // The background service will handle the 'limit' or 'market' hit simulation.
            }

            return Ok(new { Message = "Bulk orders placed in book.", Count = req.Trades.Count });
        }

        [HttpGet("analyze-confidence/{symbol}")]
        public IActionResult AnalyzeConfidence(string symbol)
        {
            var user = GetCurrentUser();
            if (user == null) return Unauthorized();

            var conf = _marketService.CalculateConfidence(symbol);
            return Ok(new { Symbol = symbol, Confidence = conf, Rating = conf > 85 ? "Strong" : (conf > 75 ? "Moderate" : "Cautions") });
        }

        [HttpPost("refresh-confidence")]
        public IActionResult RefreshConfidence()
        {
            var user = GetCurrentUser();
            if (user == null) return Unauthorized();

            var allOrders = _repo.GetOrders();
            bool changed = false;

            foreach (var order in allOrders.Where(o => o.UserId == user.Id && o.Status == "Pending"))
            {
                order.Confidence = _marketService.CalculateConfidence(order.Symbol);
                changed = true;
            }

            if (changed)
            {
                _repo.UpdateOrders(allOrders);
                return Ok(new { Message = "Confidence levels updated for pending orders." });
            }

            return Ok(new { Message = "No pending orders to refresh." });
        }

        [HttpGet("orders")]
        public IActionResult GetOrders()
        {
            var user = GetCurrentUser();
            if (user == null) return Unauthorized();

            var strategies = _repo.GetStrategies();
            var orders = _repo.GetOrders().Where(o => o.UserId == user.Id).OrderByDescending(o => o.Date).Select(o => new {
                o.Id,
                o.Symbol,
                o.Type,
                o.Quantity,
                o.Price,
                o.Date,
                o.Status,
                o.TargetPercent,
                o.StopLossPercent,
                o.Confidence,
                o.StrategyId,
                StrategyName = !string.IsNullOrEmpty(o.StrategyId) ? strategies.FirstOrDefault(s => s.Id == o.StrategyId)?.Name : null
            }).ToList();
            
            return Ok(orders);
        }
    }

    public class TransactionRequest
    {
        public string Symbol { get; set; }
        public string Type { get; set; } // Buy/Sell
        public decimal Quantity { get; set; }
        public decimal TargetPercent { get; set; }
        public decimal StopLossPercent { get; set; }
    }

    public class BulkTradeRequest
    {
        public List<TradeItem> Trades { get; set; }
    }

    public class TradeItem
    {
        public string Symbol { get; set; }
        public string Type { get; set; } // Buy/Sell
        public decimal Quantity { get; set; }
        public decimal Price { get; set; }
        public decimal TargetPercent { get; set; }
        public decimal StopLossPercent { get; set; }
    }

    public class PositionItem
    {
        public string Symbol { get; set; }
        public decimal Quantity { get; set; }
        public decimal AvgBuyPrice { get; set; }
        public decimal CurrentPrice { get; set; }
        public decimal InvestedValue { get; set; }
        public decimal CurrentValue { get; set; }
        public decimal ValueChange { get; set; }
        public decimal PercChange { get; set; }
        
        [System.Text.Json.Serialization.JsonIgnore]
        public decimal TotalBuyCost { get; set; }
        [System.Text.Json.Serialization.JsonIgnore]
        public decimal TotalBuyQty { get; set; }
        [System.Text.Json.Serialization.JsonIgnore]
        public decimal TotalSellRevenue { get; set; }
        [System.Text.Json.Serialization.JsonIgnore]
        public decimal TotalSellQty { get; set; }
        [System.Text.Json.Serialization.JsonIgnore]
        public decimal PnL { get; set; }
    }
}
