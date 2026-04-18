using Microsoft.AspNetCore.Mvc;
using System;
using System.Linq;
using TradingApp.Api.Models;
using TradingApp.Api.Repositories;

namespace TradingApp.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class StrategyController : ControllerBase
    {
        private readonly ICsvRepository _repo;
        private readonly IConfiguration _config;

        public StrategyController(ICsvRepository repo, IConfiguration config)
        {
            _repo = repo;
            _config = config;
        }

        private User GetCurrentUser()
        {
            var userId = Request.Headers["Authorization"].FirstOrDefault()?.Replace("Bearer ", "");
            return _repo.GetUsers().FirstOrDefault(u => u.Id == userId);
        }

        [HttpGet]
        public IActionResult GetStrategies()
        {
            var user = GetCurrentUser();
            if (user == null) return Unauthorized();

            var strategies = _repo.GetStrategies().Where(s => s.UserId == user.Id).ToList();
            return Ok(strategies);
        }

        [HttpPost]
        public IActionResult CreateStrategy([FromBody] TradingStrategy strategy)
        {
            var user = GetCurrentUser();
            if (user == null) return Unauthorized();

            strategy.Id = Guid.NewGuid().ToString();
            strategy.UserId = user.Id;
            strategy.CreatedAt = DateTime.Now;

            _repo.AddStrategy(strategy);

            return Ok(strategy);
        }

        [HttpPut("{id}")]
        public IActionResult UpdateStrategy(string id, [FromBody] TradingStrategy updated)
        {
            var user = GetCurrentUser();
            if (user == null) return Unauthorized();

            var strategies = _repo.GetStrategies();
            var existing = strategies.FirstOrDefault(s => s.Id == id && s.UserId == user.Id);
            if (existing == null) return NotFound();

            // Maintain stable fields
            updated.Id = id;
            updated.UserId = user.Id;
            updated.CreatedAt = existing.CreatedAt;
            updated.LastRunDate = existing.LastRunDate;

            // Remove existing and add updated
            strategies.Remove(existing);
            strategies.Add(updated);
            
            _repo.UpdateStrategies(strategies);
            return Ok(updated);
        }

        [HttpDelete("{id}")]
        public IActionResult DeleteStrategy(string id)
        {
            var user = GetCurrentUser();
            if (user == null) return Unauthorized();

            var strategies = _repo.GetStrategies();
            var strategy = strategies.FirstOrDefault(s => s.Id == id && s.UserId == user.Id);
            if (strategy == null) return NotFound();

            strategies.Remove(strategy);
            _repo.UpdateStrategies(strategies);

            return Ok(new { Message = "Strategy deleted successfully" });
        }

        [HttpGet("execution-status")]
        public IActionResult GetExecutionStatuses()
        {
            var user = GetCurrentUser();
            if (user == null) return Unauthorized();

            var orders = _repo.GetOrders().Where(o => o.UserId == user.Id && !string.IsNullOrEmpty(o.StrategyId)).ToList();
            var txs = _repo.GetTransactions().Where(t => t.UserId == user.Id && !string.IsNullOrEmpty(t.OrderId)).ToList();

            var statuses = new System.Collections.Generic.List<TradingApp.Api.Models.StrategyExecutionStatus>();

            foreach (var order in orders)
            {
                var orderTxs = txs.Where(t => t.OrderId == order.Id).OrderBy(t => t.Date).ToList();
                if (!orderTxs.Any()) continue;

                var entryTx = orderTxs.FirstOrDefault(t => t.Type == order.Type);
                var exitTx = orderTxs.FirstOrDefault(t => t.Type != order.Type); // The opposite interaction

                var entryPrice = entryTx?.Price ?? order.Price;
                decimal exitPrice = exitTx?.Price ?? 0;
                decimal pnl = 0;
                string status = "Active Trade";
                DateTime execDate = entryTx?.Date ?? order.Date;

                if (exitTx != null)
                {
                    if (order.Type == "Buy")
                        pnl = (exitPrice - entryPrice) * order.Quantity;
                    else
                        pnl = (entryPrice - exitPrice) * order.Quantity;

                    status = pnl >= 0 ? "Success" : "Loss";
                    execDate = exitTx.Date;
                }

                statuses.Add(new TradingApp.Api.Models.StrategyExecutionStatus
                {
                    StrategyId = order.StrategyId,
                    Symbol = order.Symbol,
                    EntryPrice = entryPrice,
                    Quantity = order.Quantity,
                    ExitPrice = exitPrice,
                    TargetPrice = entryTx?.TargetPrice ?? null,
                    StopLossPrice = entryTx?.StopLossPrice ?? null,
                    ProfitLoss = pnl,
                    Status = status,
                    ExecutionDate = execDate
                });
            }

            return Ok(statuses.OrderByDescending(s => s.ExecutionDate).ToList());
        }

        [HttpGet("picking-status")]
        public IActionResult GetPickingStatuses([FromQuery] string? strategy_id = null)
        {
            var user = GetCurrentUser();
            if (user == null) return Unauthorized();

            var strategies = _repo.GetStrategies().Where(s => s.UserId == user.Id).Select(s => s.Id).ToList();
            var allPicking = _repo.GetStrategyStockExecutions();

            var filtered = allPicking.Where(p => strategies.Contains(p.StrategyId)).ToList();
            
            if (!string.IsNullOrEmpty(strategy_id))
            {
                filtered = filtered.Where(p => p.StrategyId == strategy_id).ToList();
            }

            return Ok(filtered.OrderByDescending(p => p.PickedAt).ToList());
        }

        [HttpGet("python-logs")]
        public async System.Threading.Tasks.Task<IActionResult> GetPythonLogs([FromQuery] string? strategy_id = null)
        {
            try
            {
                using var client = new System.Net.Http.HttpClient();
                var baseUrl = _config["PythonEngine:Url"] ?? "http://localhost:8000";
                var url = $"{baseUrl.TrimEnd('/')}/logs";
                if (!string.IsNullOrEmpty(strategy_id))
                {
                    url += $"?strategy_id={strategy_id}";
                }
                var response = await client.GetAsync(url);
                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    return Content(content, "application/json");
                }
                
                return StatusCode(500, new { message = "Failed to fetch python logs" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }
    }
}
