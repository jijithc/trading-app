using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;
using System;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using TradingApp.Api.Repositories;
using TradingApp.Api.Models;

namespace TradingApp.Api.Services
{
    public class TradeMonitorService : BackgroundService
    {
        private readonly ILogger<TradeMonitorService> _logger;
        private readonly IServiceProvider _serviceProvider;
        private readonly HttpClient _httpClient;
        private readonly IMarketService _market;
        private readonly IBrokerService _broker;
        private readonly ICsvRepository _repo;
        private readonly Microsoft.Extensions.Configuration.IConfiguration _config;

        public TradeMonitorService(ILogger<TradeMonitorService> logger, IServiceProvider serviceProvider, IHttpClientFactory httpClientFactory,
            IMarketService market, IBrokerService broker, ICsvRepository repo, Microsoft.Extensions.Configuration.IConfiguration config)
        {
            _logger = logger;
            _serviceProvider = serviceProvider;
            _httpClient = httpClientFactory.CreateClient();
            _market = market;
            _broker = broker;
            _repo = repo;
            _config = config;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Trade Monitor Background Service is starting.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await ProcessAutomatedStrategies(_repo, _market, stoppingToken);

                    var allTransactions = _repo.GetTransactions();
                    var allOrders = _repo.GetOrders();
                    var pendingOrders = allOrders.Where(o => o.Status == "Pending").ToList();
                    var activeTrades = allTransactions.Where(t => t.IsActive).ToList();

                    if (pendingOrders.Any() || activeTrades.Any())
                        _logger.LogInformation($"[MONITOR] Checking {pendingOrders.Count} pending orders and {activeTrades.Count} active trades.");

                    bool changedTxs = false;
                    bool changedOrders = false;

                    // 1. PROCESS PENDING ORDERS (WAITING FOR PRICE)
                    foreach (var order in pendingOrders)
                    {
                        var fetchSymbol = order.Symbol;
                        decimal currentPrice = await _market.GetCurrentPriceAsync(fetchSymbol);
                        if (currentPrice <= 0) continue;

                        try 
                        {
                            bool shouldExecute = false;
                            if (order.Type == "Buy" && currentPrice <= order.Price * 1.001m) 
                                shouldExecute = true;
                            else if (order.Type == "Sell" && currentPrice >= order.Price * 0.999m)
                                shouldExecute = true;

                            if (shouldExecute)
                            {
                                _logger.LogInformation($"[ORDER EXECUTED] {order.Symbol} @ ₹{currentPrice}");
                                order.Status = "Executed";
                                order.Price = currentPrice;
                                
                                decimal targetPrice, stopLossPrice;
                                if (order.Type == "Buy")
                                {
                                    targetPrice = Math.Round(currentPrice * (1 + (order.TargetPercent / 100m)), 2);
                                    stopLossPrice = Math.Round(currentPrice * (1 - (order.StopLossPercent / 100m)), 2);
                                }
                                else // Sell (Short)
                                {
                                    targetPrice = Math.Round(currentPrice * (1 - (order.TargetPercent / 100m)), 2);
                                    stopLossPrice = Math.Round(currentPrice * (1 + (order.StopLossPercent / 100m)), 2);
                                }

                                var userStrategies = _repo.GetStrategies();
                                var strategyRule = order.StrategyId != null ? userStrategies.FirstOrDefault(s => s.Id == order.StrategyId) : null;
                                
                                var transaction = _broker.ExecutePaperTrade(
                                    order.UserId, order.Symbol, order.Type, order.Quantity, currentPrice, 
                                    targetPrice, stopLossPrice
                                );
                                transaction.OrderId = order.Id;
                                _repo.AddTransaction(transaction);
                                changedOrders = true;
                            }
                        }
                        catch (Exception ex) { _logger.LogError(ex, "Error processing order"); }
                        await Task.Delay(300, stoppingToken);
                    }

                    if (changedOrders) _repo.UpdateOrders(allOrders);
                    
                    // 2. PROCESS ACTIVE TRADES (AUTO-EXIT)
                    foreach (var trade in activeTrades)
                    {
                        var fetchSymbol = trade.Symbol;
                        decimal currentPrice = await _market.GetCurrentPriceAsync(fetchSymbol);
                        if (currentPrice <= 0) continue;

                        try 
                        {
                            bool triggerExit = false;
                            var exitReason = "";
                            string exitType = trade.Type == "Buy" ? "Sell" : "Buy";

                            // Check for Scheduled EndTime (Auto-Square-off) 
                            // Fetch user strategies to find if this trade's specific strategy has hit its EndTime and wants a Square-Off
                            var userStrategies = _repo.GetStrategies().Where(s => s.UserId == trade.UserId && s.IsActive).ToList();
                            var tradeOrder = allOrders.FirstOrDefault(o => o.Id == trade.OrderId);
                            var tradeStrategy = tradeOrder?.StrategyId != null ? userStrategies.FirstOrDefault(s => s.Id == tradeOrder.StrategyId) : null;

                            if (tradeStrategy?.SquareOffAtEndTime == true &&
                                TimeSpan.TryParse(tradeStrategy.EndTime, out var endTime) &&
                                DateTime.Now.TimeOfDay >= endTime)
                            {
                                triggerExit = true;
                                exitReason = $"Auto Square-Off at {tradeStrategy.EndTime}";
                            }

                            if (!triggerExit && trade.Type == "Buy")
                            {
                                if (trade.TargetPrice.HasValue && currentPrice >= (trade.TargetPrice.Value - 0.01m)) 
                                { 
                                    triggerExit = true; exitReason = "Target Reached"; 
                                }
                                else if (trade.StopLossPrice.HasValue && currentPrice <= (trade.StopLossPrice.Value + 0.01m)) 
                                { 
                                    triggerExit = true; exitReason = "Stop Loss Triggered"; 
                                }
                            }
                            else if (!triggerExit && trade.Type == "Sell")
                            {
                                if (trade.TargetPrice.HasValue && currentPrice <= (trade.TargetPrice.Value + 0.01m)) 
                                { 
                                    triggerExit = true; exitReason = "Short Target Reached"; 
                                }
                                else if (trade.StopLossPrice.HasValue && currentPrice >= (trade.StopLossPrice.Value - 0.01m)) 
                                { 
                                    triggerExit = true; exitReason = "Short Stop Loss Triggered"; 
                                }
                            }

                            if (triggerExit)
                            {
                                _logger.LogInformation($"[AUTO-{exitType.ToUpper()} TRIGGERED] {trade.Symbol} | Reason: {exitReason} @ ₹{currentPrice}");
                                var exitTrade = _broker.ExecutePaperTrade(
                                    trade.UserId, trade.Symbol, exitType, trade.Quantity, currentPrice, null, null
                                );
                                exitTrade.OrderId = trade.OrderId;
                                exitTrade.IsActive = false; 
                                allTransactions.Add(exitTrade); 
                                
                                trade.IsActive = false; 
                                changedTxs = true;

                                // Log Execution Status for this specific trade/strategy
                                // Execution status is now dynamically derived from Transaction links in StrategyController
                            }
                        }
                        catch (Exception ex) { _logger.LogError(ex, "Error processing trade exit"); }
                        await Task.Delay(500, stoppingToken);
                    }

                    if (changedTxs)
                    {
                        _repo.UpdateTransactions(allTransactions);
                    }
                    // 3. CLEANUP MISSING OPPORTUNITIES (AFTER END TIME)
                    var pendingPicking = _repo.GetStrategyStockExecutions().Where(e => e.Status == "Pending" && e.PickedAt.Date == DateTime.Now.Date).ToList();
                    if (pendingPicking.Any())
                    {
                        var updatedExecs = _repo.GetStrategyStockExecutions();
                        bool changedExecs = false;
                        var strategies = _repo.GetStrategies();

                        foreach (var exec in pendingPicking)
                        {
                            var strategy = strategies.FirstOrDefault(s => s.Id == exec.StrategyId);
                            if (strategy != null && TimeSpan.TryParse(strategy.EndTime, out var endTime))
                            {
                                if (DateTime.Now.TimeOfDay >= endTime)
                                {
                                    var toUpdate = updatedExecs.FirstOrDefault(u => u.Id == exec.Id);
                                    if (toUpdate != null)
                                    {
                                        toUpdate.Status = "Failed";
                                        toUpdate.ErrorMessage = "Opportunity never arrived before EndTime.";
                                        changedExecs = true;
                                    }
                                }
                            }
                        }
                        if (changedExecs) _repo.UpdateStrategyStockExecutions(updatedExecs);
                    }
                }
                catch (OperationCanceledException)
                {
                    // Graceful shutdown
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Trade Monitor encountered a critical error.");
                }

                await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
            }
        }

        private async Task ProcessAutomatedStrategies(ICsvRepository repo, IMarketService market, CancellationToken ct)
        {
            var strategies = repo.GetStrategies();
            var now = DateTime.Now;
            var nowStr = now.ToString("HH:mm");
            
            var nowTime = now.TimeOfDay;
            var activeRules = strategies.Where(s=> s.IsActive)
            .Where(s =>
            {
                if (!s.IsActive || (s.LastRunDate.HasValue && s.LastRunDate.Value.Date >= now.Date))
                    if (!s.IsActive)
                        return false;

                if (TimeSpan.TryParse(s.ScheduledTime, out var startTime) &&
                    TimeSpan.TryParse(s.EndTime, out var endTime))
                {
                    //Check if current time is past start time, but hasn't reached end time yet
                    return nowTime >= startTime && nowTime < endTime;
                }
                return false;
            })
            .ToList();

            if (!activeRules.Any()) 
            {
                // Log once every hour at minute 0 just to show live status
                if (now.Minute == 0 && now.Second < 30)
                    _logger.LogInformation($"[SCHEDULER] Heartbeat: Heartbeat. Checking {strategies.Count} total scenarios.");
                return;
            }

            foreach (var rule in activeRules)
            {
                _logger.LogInformation($"[SCHEDULER] Running engine '{rule.Name}' for {rule.StockSource}");
                var symbols = await _market.GetStocksForStrategyAsync(rule);
                
                if (symbols != null && symbols.Any())
                {
                    var allOrders = repo.GetOrders();
                    var allPicking = repo.GetStrategyStockExecutions();
                    // Use user-defined limit
                    int limit = rule.MaxStocks > 0 ? rule.MaxStocks : 5;
                    foreach (var sym in symbols.Take(limit))
                    {
                        // Prevent duplicate picking for the same stock by the same strategy today
                        if (allPicking.Any(p => p.StrategyId == rule.Id && p.Symbol == sym && p.PickedAt.Date == now.Date))
                        {
                            continue;
                        }

                        decimal cmp = 0;
                        decimal volatility = 0;
                        bool technicalOk = true;
                        string technicalReason = "";

                        if (rule.CheckBreakout || rule.CheckVolumeSurge)
                        {
                            var result = await market.AnalyzeIntradaySignalAsync(sym, rule);
                            technicalOk = result.ShouldTrade;
                            technicalReason = result.Reason;
                            cmp = result.Price;
                            volatility = result.Volatility;
                        }
                        else
                        {
                            var result = await market.GetCurrentPriceAndVolatilityAsync(sym);
                            cmp = result.Price;
                            volatility = result.VolatilityPercent;
                        }

                        if (cmp <= 0) continue;
                        if (!technicalOk)
                        {
                             _logger.LogInformation($"[SCHEDULER] Technical analysis rejected {sym}: {technicalReason}");
                             continue;
                        }

                        if (rule.MinVolatility.HasValue && volatility < rule.MinVolatility.Value) continue;
                        if (rule.MaxVolatility.HasValue && volatility > rule.MaxVolatility.Value) continue;

                        decimal targetPercent = rule.TargetPrice;
                        decimal stopLossPercent = rule.StopLoss;

                        if (rule.UseVolatilityForSlTgt && volatility > 0)
                        {
                            targetPercent = Math.Round(volatility * rule.TargetPrice, 2);
                            stopLossPercent = Math.Round(volatility * rule.StopLoss, 2);
                        }

                        decimal quantity = rule.Quantity ?? 0;
                        if (quantity <= 0 && rule.AllocationLimit.HasValue && rule.AllocationLimit.Value > 0)
                        {
                            quantity = Math.Floor(rule.AllocationLimit.Value / cmp);
                        }

                        if (quantity <= 0) continue;

                        // Calculate absolute entry based on multiplier (EntryPrice field used as multiplier)
                        decimal entryPrice = Math.Round(cmp * (rule.EntryPrice == 0 ? 1 : rule.EntryPrice), 2);
                        
                        // Confidence checking
                        int confidence = market.CalculateConfidence(sym);
                        if (rule.UseConfidence && confidence < rule.MinConfidence)
                        {
                            _logger.LogInformation($"[SCHEDULER] Skipping {sym} due to low confidence ({confidence}% < {rule.MinConfidence}%).");
                            continue;
                        }

                        // Check Strategy Total Amount Limit
                        if (rule.TotalAmount.HasValue && rule.TotalAmount.Value > 0) {
                            var currentStrategyTotal = allOrders.Where(o => o.UserId == rule.UserId && o.Date.Date == now.Date && o.StrategyId == rule.Id).Sum(o => o.Price * o.Quantity) 
                                                     + (entryPrice * quantity);
                            if (currentStrategyTotal > rule.TotalAmount.Value) {
                                _logger.LogWarning($"[SCHEDULER] Strategy '{rule.Name}' hit TotalAmount limit. Skipping {sym}.");
                                continue;
                            }
                        }

                        // Check Min Profit Booking Requirement (Filter instead of Adjust)
                        if (rule.MinProfitBooking.HasValue && rule.MinProfitBooking.Value > 0)
                        {
                            decimal expectedProfitPerShare = 0;
                            if (rule.Type == "Buy")
                                expectedProfitPerShare = entryPrice * (targetPercent / 100m);
                            else
                                expectedProfitPerShare = entryPrice * (targetPercent / 100m); // Same absolute magnitude for short target

                            decimal projectedProfit = Math.Round(expectedProfitPerShare * quantity, 2);
                            if (projectedProfit < rule.MinProfitBooking.Value)
                            {
                                _logger.LogInformation($"[SCHEDULER] Skipping {sym}: Projected profit ₹{projectedProfit} is below MinProfitBooking threshold (₹{rule.MinProfitBooking.Value})");
                                continue;
                            }
                        }

                        if (rule.UseChartAnalyser)
                        {
                            var execId = Guid.NewGuid().ToString();
                            var payload = new
                            {
                                symbol = sym,
                                strategy_id = rule.Id,
                                execution_id = execId,
                                timeframe = "15m", // AI resolution fixed at 15m
                                analysis_duration = rule.AnalysisDuration,
                                predict_sl_and_target = rule.PredictSlAndTarget
                            };
                            var content = new StringContent(System.Text.Json.JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json");
                            try
                            {
                                using var pythonClient = new HttpClient();
                                var baseUrl = _config["PythonEngine:Url"] ?? "http://localhost:8000";
                                var response = pythonClient.PostAsync($"{baseUrl.TrimEnd('/')}/add_symbol", content).Result;
                                if (response.IsSuccessStatusCode)
                                {
                                    _logger.LogInformation($"[SCHEDULER] Sent {sym} to Python Engine for opportunity checking.");
                                    repo.AddStrategyStockExecution(new StrategyStockExecution
                                    {
                                        Id = execId,
                                        StrategyId = rule.Id,
                                        Symbol = sym,
                                        Status = "Pending",
                                        PickedAt = DateTime.Now,
                                        PickedPrice = Math.Round(cmp, 2)
                                    });
                                }
                            }
                            catch (Exception ex)
                            {
                                _logger.LogError(ex, "Failed to call python engine");
                                repo.AddStrategyStockExecution(new StrategyStockExecution
                                {
                                    StrategyId = rule.Id,
                                    Symbol = sym,
                                    Status = "Failed",
                                    PickedAt = DateTime.Now,
                                    PickedPrice = Math.Round(cmp, 2),
                                    ErrorMessage = "Python Engine Unavailable: " + ex.Message
                                });
                            }
                        }
                        else
                        {
                            allOrders.Add(new Order {
                                Id = Guid.NewGuid().ToString(),
                                UserId = rule.UserId,
                                Symbol = sym,
                                Type = rule.Type,
                                Quantity = quantity,
                                Price = entryPrice,
                                TargetPercent = targetPercent,
                                StopLossPercent = stopLossPercent,
                                Status = "Pending",
                                Date = DateTime.Now,
                                StrategyId = rule.Id,
                                Confidence = confidence
                            });
                            _logger.LogInformation($"[SCHEDULER] Queued Order: {sym} x{quantity} @ ₹{entryPrice} (SL: {stopLossPercent}%, Tgt: {targetPercent}%, Vol: {volatility}%, Conf: {confidence}%)");
                            repo.AddStrategyStockExecution(new StrategyStockExecution
                            {
                                StrategyId = rule.Id,
                                Symbol = sym,
                                Status = "Executed",
                                PickedAt = DateTime.Now,
                                PickedPrice = Math.Round(cmp, 2)
                            });
                        }
                    }
                    repo.UpdateOrders(allOrders);
                }
                rule.LastRunDate = now;
            }
            repo.UpdateStrategies(strategies);
        }
    }
}
