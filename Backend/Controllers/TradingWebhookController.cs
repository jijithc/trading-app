using Microsoft.AspNetCore.Mvc;
using System;
using System.Linq;
using TradingApp.Api.Models;
using TradingApp.Api.Repositories;

namespace TradingApp.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TradingWebhookController : ControllerBase
    {
        private readonly ICsvRepository _repo;

        public TradingWebhookController(ICsvRepository repo)
        {
            _repo = repo;
        }

        public class OpportunityPayload
        {
            public string? StrategyId { get; set; }
            public string? ExecutionId { get; set; }
            public string? Symbol { get; set; }
            public decimal Price { get; set; }
            public decimal Volume { get; set; }
            public decimal? TargetPrice { get; set; }
            public decimal? StopLossPrice { get; set; }
        }

        [HttpPost("opportunity")]
        public IActionResult OpportunityFound([FromBody] OpportunityPayload payload)
        {
            var strategy = _repo.GetStrategies().FirstOrDefault(s => s.Id == payload.StrategyId);
            if (strategy == null) return NotFound();

            var executions = _repo.GetStrategyStockExecutions()
                .Where(e => e.StrategyId == payload.StrategyId && e.PickedAt.Date == DateTime.Now.Date && e.Status == "Executed")
                .ToList();
                
            var totalAmountTraded = executions.Sum(e => e.PickedPrice * (strategy.Quantity ?? 1)); // Approximation if quantity not stored in picking
            var numTrades = executions.Count;

            bool limitReached = false;
            if (strategy.TotalAmount.HasValue && totalAmountTraded >= strategy.TotalAmount.Value) limitReached = true;
            if (strategy.MaxStocks > 0 && numTrades >= strategy.MaxStocks) limitReached = true;

            if (limitReached)
            {
                using var client = new System.Net.Http.HttpClient();
                var req = new { strategy_id = payload.StrategyId };
                var content = new System.Net.Http.StringContent(System.Text.Json.JsonSerializer.Serialize(req), System.Text.Encoding.UTF8, "application/json");
                client.PostAsync("http://localhost:8000/remove_strategy", content).Wait();
            }
            else
            {
                var entryPrice = Math.Round(payload.Price > 0 ? payload.Price : (strategy.EntryPrice > 0 ? strategy.EntryPrice : 100), 2);
                var quantity = strategy.Quantity > 0 ? strategy.Quantity.Value : 1;
                
                if (strategy.AllocationLimit.HasValue && strategy.AllocationLimit.Value > 0 && entryPrice > 0)
                {
                    quantity = Math.Floor(strategy.AllocationLimit.Value / entryPrice);
                }

                var orderId = Guid.NewGuid().ToString();
                var newOrder = new Order 
                {
                    Id = orderId,
                    UserId = strategy.UserId,
                    Symbol = payload.Symbol,
                    Type = strategy.Type,
                    Quantity = quantity,
                    Price = entryPrice,
                    Date = DateTime.Now,
                    Status = "Executed",
                    TargetPercent = strategy.TargetPrice,
                    StopLossPercent = strategy.StopLoss,
                    StrategyId = strategy.Id
                };
                
                var entryTx = new Transaction
                {
                    Id = Guid.NewGuid().ToString(),
                    UserId = strategy.UserId,
                    Symbol = payload.Symbol,
                    Type = strategy.Type,
                    Quantity = quantity,
                    Price = entryPrice,
                    Date = DateTime.Now,
                    IsActive = true,
                    OrderId = orderId,
                    TargetPrice = payload.TargetPrice > 0 ? payload.TargetPrice.Value : (decimal?)null,
                    StopLossPrice = payload.StopLossPrice > 0 ? payload.StopLossPrice.Value : (decimal?)null
                };

                _repo.AddOrder(newOrder);
                _repo.AddTransaction(entryTx);

                // Update Strategy Execution Log (Strict ID Match)
                var allExecs = _repo.GetStrategyStockExecutions();
                var log = allExecs.FirstOrDefault(e => e.Id == payload.ExecutionId) 
                        ?? allExecs.FirstOrDefault(e => e.StrategyId == payload.StrategyId && e.Symbol == payload.Symbol && e.PickedAt.Date == DateTime.Now.Date);
                        
                if (log != null)
                {
                    log.Status = "Executed";
                    _repo.UpdateStrategyStockExecutions(allExecs);
                }

                totalAmountTraded += (entryPrice * quantity);
                numTrades++;
                
                if ((strategy.TotalAmount.HasValue && totalAmountTraded >= strategy.TotalAmount.Value) || 
                    (strategy.MaxStocks > 0 && numTrades >= strategy.MaxStocks))
                {
                    using var client = new System.Net.Http.HttpClient();
                    var req = new { strategy_id = payload.StrategyId };
                    var content = new System.Net.Http.StringContent(System.Text.Json.JsonSerializer.Serialize(req), System.Text.Encoding.UTF8, "application/json");
                    client.PostAsync("http://localhost:8000/remove_strategy", content).Wait();
                }
            }
            return Ok();
        }
        [HttpPost("expired")]
        public IActionResult OpportunityExpired([FromBody] ExpiredPayload payload)
        {
            var allExecs = _repo.GetStrategyStockExecutions();
            var log = allExecs.FirstOrDefault(e => e.Id == payload.ExecutionId);
            if (log != null && log.Status == "Pending")
            {
                log.Status = "Expired";
                _repo.UpdateStrategyStockExecutions(allExecs);
            }
            return Ok();
        }

        public class ExpiredPayload
        {
            public string ExecutionId { get; set; }
        }
    }
}
