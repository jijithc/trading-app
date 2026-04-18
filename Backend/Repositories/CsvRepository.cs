using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using TradingApp.Api.Models;
using Microsoft.Extensions.Configuration;

namespace TradingApp.Api.Repositories
{
    public interface ICsvRepository
    {
        List<User> GetUsers();
        void AddUser(User user);
        List<Transaction> GetTransactions();
        void AddTransaction(Transaction transaction);
        void UpdateTransactions(List<Transaction> transactions);
        List<MarketResearch> GetMarketResearches();
        void AddMarketResearch(MarketResearch research);
        List<Order> GetOrders();
        void AddOrder(Order order);
        void UpdateOrders(List<Order> orders);
        List<TradingStrategy> GetStrategies();
        void AddStrategy(TradingStrategy strategy);
        void UpdateStrategies(List<TradingStrategy> strategies);
        List<WatchlistItem> GetWatchlist();
        void AddToWatchlist(WatchlistItem item);
        void RemoveFromWatchlist(string id);
        List<StrategyStockExecution> GetStrategyStockExecutions();
        void AddStrategyStockExecution(StrategyStockExecution execution);
        void UpdateStrategyStockExecutions(List<StrategyStockExecution> executions);
    }

    public class CsvRepository : ICsvRepository
    {
        private readonly string UsersFile;
        private readonly string TransactionsFile;
        private readonly string MarketFile;
        private readonly string OrdersFile;
        private readonly string StrategiesFile;
        private readonly string WatchlistFile;
        private readonly string StrategyStockExecutionsFile;
        private readonly string DataPath;

        public CsvRepository(IConfiguration config)
        {
            DataPath = config["Data:Directory"] ?? "Data";
            UsersFile = Path.Combine(DataPath, "users.csv");
            TransactionsFile = Path.Combine(DataPath, "transactions.csv");
            MarketFile = Path.Combine(DataPath, "market.csv");
            OrdersFile = Path.Combine(DataPath, "orders.csv");
            StrategiesFile = Path.Combine(DataPath, "strategies.csv");
            WatchlistFile = Path.Combine(DataPath, "watchlist.csv");
            StrategyStockExecutionsFile = Path.Combine(DataPath, "strategy_stock_executions.csv");
            InitializeFiles();
        }

        private void InitializeFiles()
        {
            if (!Directory.Exists(DataPath)) Directory.CreateDirectory(DataPath);
            if (!File.Exists(UsersFile)) File.WriteAllText(UsersFile, "Id,Username,Password,BrokerApiKey\n00001,tester,password,MOCK_KEY\n");
            
            if (!File.Exists(TransactionsFile)) File.WriteAllText(TransactionsFile, "Id,UserId,Symbol,Type,Quantity,Price,Date,TargetPrice,StopLossPrice,IsActive,OrderId\n");
            if (!File.Exists(MarketFile)) File.WriteAllText(MarketFile, "Symbol,Date,Recommendation,CurrentPrice,Reason\n");
            if (!File.Exists(OrdersFile)) File.WriteAllText(OrdersFile, "Id,UserId,Symbol,Type,Quantity,Price,Date,Status,TargetPercent,StopLossPercent,Confidence,StrategyId\n");
            
            if (!File.Exists(StrategiesFile)) File.WriteAllText(StrategiesFile, "Id,UserId,Name,StockSource,ScheduledTime,SelectionReasoning,LastRunDate,EntryPrice,StopLoss,TargetPrice,AnalysisReasoning,TriggerCondition,Type,Quantity,AllocationLimit,TotalAmount,MaxStocks,EndTime,MinVolatility,MaxVolatility,UseVolatilityForSlTgt,IsActive,CreatedAt,UseConfidence,MinConfidence,SquareOffAtEndTime,MinProfitBooking,CheckVolumeSurge,VolumeSurgeRatio,CheckBreakout,Timeframe,LookbackPeriod,UseChartAnalyser,AnalysisDuration,PredictSlAndTarget,WatchlistGroup\n");
            
            if (!File.Exists(WatchlistFile)) File.WriteAllText(WatchlistFile, "Id,UserId,Symbol,WatchlistName,AddedAt\n");
            if (!File.Exists(StrategyStockExecutionsFile)) File.WriteAllText(StrategyStockExecutionsFile, "Id,StrategyId,Symbol,Status,PickedAt,PickedPrice,ErrorMessage\n");
        }

        public List<User> GetUsers()
        {
            if (!File.Exists(UsersFile)) return new List<User>();
            var lines = File.ReadAllLines(UsersFile).Skip(1);
            return lines.Select(l => {
                var p = l.Split(',');
                return new User { 
                    Id = p[0], 
                    Username = p[1], 
                    Password = p[2],
                    BrokerApiKey = p.Length >= 4 ? p[3] : "" 
                };
            }).ToList();
        }

        public void AddUser(User user)
        {
            File.AppendAllText(UsersFile, $"{user.Id},{user.Username},{user.Password},{user.BrokerApiKey}\n");
        }

        public List<Transaction> GetTransactions()
        {
            var lines = File.ReadAllLines(TransactionsFile).Skip(1);
            var items = new List<Transaction>();
            foreach (var line in lines)
            {
                var parts = line.Split(',');
                if (parts.Length >= 7)
                {
                    var t = new Transaction
                    {
                        Id = parts[0],
                        UserId = parts[1],
                        Symbol = parts[2],
                        Type = parts[3],
                        Quantity = decimal.Parse(parts[4]),
                        Price = decimal.Parse(parts[5]),
                        Date = DateTime.Parse(parts[6])
                    };
                    
                    if (parts.Length >= 10)
                    {
                        t.TargetPrice = string.IsNullOrEmpty(parts[7]) ? null : decimal.Parse(parts[7]);
                        t.StopLossPrice = string.IsNullOrEmpty(parts[8]) ? null : decimal.Parse(parts[8]);
                        t.IsActive = bool.Parse(parts[9]);
                    }

                    if (parts.Length >= 11)
                    {
                        t.OrderId = parts[10];
                    }

                    items.Add(t);
                }
            }
            return items;
        }

        public void AddTransaction(Transaction t)
        {
            File.AppendAllText(TransactionsFile, $"{t.Id},{t.UserId},{t.Symbol},{t.Type},{t.Quantity},{t.Price},{t.Date:O},{t.TargetPrice},{t.StopLossPrice},{t.IsActive},{t.OrderId}\n");
        }

        public void UpdateTransactions(List<Transaction> transactions)
        {
            var lines = new List<string> { "Id,UserId,Symbol,Type,Quantity,Price,Date,TargetPrice,StopLossPrice,IsActive,OrderId" };
            foreach(var t in transactions)
            {
                lines.Add($"{t.Id},{t.UserId},{t.Symbol},{t.Type},{t.Quantity},{t.Price},{t.Date:O},{t.TargetPrice},{t.StopLossPrice},{t.IsActive},{t.OrderId}");
            }
            File.WriteAllLines(TransactionsFile, lines);
        }

        public List<MarketResearch> GetMarketResearches()
        {
            var lines = File.ReadAllLines(MarketFile).Skip(1);
            var items = new List<MarketResearch>();
            foreach (var line in lines)
            {
                var parts = line.Split(',');
                if (parts.Length >= 5)
                {
                    items.Add(new MarketResearch
                    {
                        Symbol = parts[0],
                        Date = DateTime.Parse(parts[1]),
                        Recommendation = parts[2],
                        CurrentPrice = decimal.Parse(parts[3]),
                        Reason = parts[4].Replace("\"", "")
                    });
                }
            }
            return items;
        }

        public void AddMarketResearch(MarketResearch r)
        {
            File.AppendAllText(MarketFile, $"{r.Symbol},{r.Date:O},{r.Recommendation},{r.CurrentPrice},\"{r.Reason}\"\n");
        }

        public List<Order> GetOrders()
        {
            if (!File.Exists(OrdersFile)) return new List<Order>();
            var lines = File.ReadAllLines(OrdersFile).Skip(1);
            var items = new List<Order>();
            foreach (var line in lines)
            {
                var parts = line.Split(',');
                if (parts.Length >= 8)
                {
                    var o = new Order
                    {
                        Id = parts[0],
                        UserId = parts[1],
                        Symbol = parts[2],
                        Type = parts[3],
                        Quantity = decimal.Parse(parts[4]),
                        Price = decimal.Parse(parts[5]),
                        Date = DateTime.Parse(parts[6]),
                        Status = parts[7]
                    };
                    if (parts.Length >= 10)
                    {
                        o.TargetPercent = decimal.Parse(parts[8]);
                        o.StopLossPercent = decimal.Parse(parts[9]);
                    }
                    if (parts.Length >= 11)
                    {
                        o.Confidence = int.Parse(parts[10]);
                    }
                    if (parts.Length >= 12)
                    {
                        o.StrategyId = parts[11];
                    }
                    items.Add(o);
                }
            }
            return items;
        }

        public void AddOrder(Order o)
        {
            File.AppendAllText(OrdersFile, $"{o.Id},{o.UserId},{o.Symbol},{o.Type},{o.Quantity},{o.Price},{o.Date:O},{o.Status},{o.TargetPercent},{o.StopLossPercent},{o.Confidence},{o.StrategyId}\n");
        }

        public void UpdateOrders(List<Order> orders)
        {
            var lines = new List<string> { "Id,UserId,Symbol,Type,Quantity,Price,Date,Status,TargetPercent,StopLossPercent,Confidence,StrategyId" };
            foreach (var o in orders)
            {
                lines.Add($"{o.Id},{o.UserId},{o.Symbol},{o.Type},{o.Quantity},{o.Price},{o.Date:O},{o.Status},{o.TargetPercent},{o.StopLossPercent},{o.Confidence},{o.StrategyId}");
            }
            File.WriteAllLines(OrdersFile, lines);
        }

        public List<TradingStrategy> GetStrategies()
        {
            if (!File.Exists(StrategiesFile)) return new List<TradingStrategy>();
            var items = new List<TradingStrategy>();
            var lines = File.ReadAllLines(StrategiesFile).Skip(1);
            foreach (var line in lines)
            {
                var parts = ParseCsvLine(line);
                if (parts.Length >= 19)
                {
                    var ts = new TradingStrategy
                    {
                        Id = parts[0],
                        UserId = parts[1],
                        Name = parts[2].Replace("\"", ""),
                        StockSource = parts[3].Replace("\"", ""),
                        ScheduledTime = parts[4],
                        SelectionReasoning = parts[5].Replace("\"", ""),
                        LastRunDate = string.IsNullOrEmpty(parts[6]) ? null : DateTime.Parse(parts[6]),
                        EntryPrice = decimal.Parse(parts[7]),
                        StopLoss = decimal.Parse(parts[8]),
                        TargetPrice = decimal.Parse(parts[9]),
                        AnalysisReasoning = parts[10].Replace("\"", ""),
                        TriggerCondition = parts[11],
                        Type = parts[12],
                        Quantity = string.IsNullOrEmpty(parts[13]) ? null : decimal.Parse(parts[13]),
                        AllocationLimit = string.IsNullOrEmpty(parts[14]) ? null : decimal.Parse(parts[14])
                    };

                    if (parts.Length >= 35)
                    {
                        ts.TotalAmount = string.IsNullOrEmpty(parts[15]) ? null : decimal.Parse(parts[15]);
                        ts.MaxStocks = int.Parse(parts[16]);
                        ts.EndTime = parts[17];
                        ts.MinVolatility = string.IsNullOrEmpty(parts[18]) ? null : decimal.Parse(parts[18]);
                        ts.MaxVolatility = string.IsNullOrEmpty(parts[19]) ? null : decimal.Parse(parts[19]);
                        ts.UseVolatilityForSlTgt = bool.Parse(parts[20]);
                        ts.IsActive = bool.Parse(parts[21]);
                        ts.CreatedAt = DateTime.Parse(parts[22]);
                        ts.UseConfidence = bool.Parse(parts[23]);
                        ts.MinConfidence = int.Parse(parts[24]);
                        ts.SquareOffAtEndTime = bool.Parse(parts[25]);
                        ts.MinProfitBooking = string.IsNullOrEmpty(parts[26]) ? null : decimal.Parse(parts[26]);
                        ts.CheckVolumeSurge = bool.Parse(parts[27]);
                        ts.VolumeSurgeRatio = string.IsNullOrEmpty(parts[28]) ? 1.5m : decimal.Parse(parts[28]);
                        ts.CheckBreakout = bool.Parse(parts[29]);
                        ts.Timeframe = parts[30];
                        ts.LookbackPeriod = int.Parse(parts[31]);
                        ts.UseChartAnalyser = bool.Parse(parts[32]);
                        ts.AnalysisDuration = int.Parse(parts[33]);
                        ts.PredictSlAndTarget = bool.Parse(parts[34]);
                        ts.WatchlistGroup = parts.Length > 35 ? parts[35] : null;
                    }
                    else
                    {
                        ts.MaxStocks = int.TryParse(parts[15], out int max) ? max : 5;
                        ts.EndTime = parts.Length > 16 ? parts[16] : "15:15";
                        ts.IsActive = parts.Length > 17 && bool.TryParse(parts[17], out bool a) ? a : true;
                    }
                    items.Add(ts);
                }
            }
            return items;
        }

        public void AddStrategy(TradingStrategy s)
        {
            File.AppendAllText(StrategiesFile, $"{s.Id},{s.UserId},\"{s.Name}\",{s.StockSource},{s.ScheduledTime},\"{s.SelectionReasoning}\",{s.LastRunDate:O},{s.EntryPrice},{s.StopLoss},{s.TargetPrice},\"{s.AnalysisReasoning}\",{s.TriggerCondition},{s.Type},{s.Quantity},{s.AllocationLimit},{s.TotalAmount},{s.MaxStocks},{s.EndTime},{s.MinVolatility},{s.MaxVolatility},{s.UseVolatilityForSlTgt},{s.IsActive},{s.CreatedAt:O},{s.UseConfidence},{s.MinConfidence},{s.SquareOffAtEndTime},{s.MinProfitBooking},{s.CheckVolumeSurge},{s.VolumeSurgeRatio},{s.CheckBreakout},{s.Timeframe},{s.LookbackPeriod},{s.UseChartAnalyser},{s.AnalysisDuration},{s.PredictSlAndTarget},{s.WatchlistGroup}\n");
        }

        public void UpdateStrategies(List<TradingStrategy> strategies)
        {
            var lines = new List<string> { "Id,UserId,Name,StockSource,ScheduledTime,SelectionReasoning,LastRunDate,EntryPrice,StopLoss,TargetPrice,AnalysisReasoning,TriggerCondition,Type,Quantity,AllocationLimit,TotalAmount,MaxStocks,EndTime,MinVolatility,MaxVolatility,UseVolatilityForSlTgt,IsActive,CreatedAt,UseConfidence,MinConfidence,SquareOffAtEndTime,MinProfitBooking,CheckVolumeSurge,VolumeSurgeRatio,CheckBreakout,Timeframe,LookbackPeriod,UseChartAnalyser,AnalysisDuration,PredictSlAndTarget,WatchlistGroup" };
            foreach (var s in strategies)
            {
                lines.Add($"{s.Id},{s.UserId},\"{s.Name}\",{s.StockSource},{s.ScheduledTime},\"{s.SelectionReasoning}\",{s.LastRunDate:O},{s.EntryPrice},{s.StopLoss},{s.TargetPrice},\"{s.AnalysisReasoning}\",{s.TriggerCondition},{s.Type},{s.Quantity},{s.AllocationLimit},{s.TotalAmount},{s.MaxStocks},{s.EndTime},{s.MinVolatility},{s.MaxVolatility},{s.UseVolatilityForSlTgt},{s.IsActive},{s.CreatedAt:O},{s.UseConfidence},{s.MinConfidence},{s.SquareOffAtEndTime},{s.MinProfitBooking},{s.CheckVolumeSurge},{s.VolumeSurgeRatio},{s.CheckBreakout},{s.Timeframe},{s.LookbackPeriod},{s.UseChartAnalyser},{s.AnalysisDuration},{s.PredictSlAndTarget},{s.WatchlistGroup}");
            }
            File.WriteAllLines(StrategiesFile, lines);
        }

        public List<WatchlistItem> GetWatchlist()
        {
            if (!File.Exists(WatchlistFile)) return new List<WatchlistItem>();
            var lines = File.ReadAllLines(WatchlistFile).Skip(1);
            return lines.Select(l => {
                var p = l.Split(',');
                return new WatchlistItem { Id = p[0], UserId = p[1], Symbol = p[2], WatchlistName = p[3], AddedAt = DateTime.Parse(p[4]) };
            }).ToList();
        }

        public void AddToWatchlist(WatchlistItem item)
        {
            File.AppendAllText(WatchlistFile, $"{item.Id},{item.UserId},{item.Symbol},{item.WatchlistName},{item.AddedAt:O}\n");
        }

        public void RemoveFromWatchlist(string id)
        {
            var list = GetWatchlist();
            list.RemoveAll(i => i.Id == id);
            var lines = new List<string> { "Id,UserId,Symbol,WatchlistName,AddedAt" };
            foreach (var i in list) lines.Add($"{i.Id},{i.UserId},{i.Symbol},{i.WatchlistName},{i.AddedAt:O}");
            File.WriteAllLines(WatchlistFile, lines);
        }

        public List<StrategyStockExecution> GetStrategyStockExecutions()
        {
            if (!File.Exists(StrategyStockExecutionsFile)) return new List<StrategyStockExecution>();
            var lines = File.ReadAllLines(StrategyStockExecutionsFile).Skip(1);
            return lines.Select(l => {
                var p = l.Split(',');
                return new StrategyStockExecution { 
                    Id = p[0], 
                    StrategyId = p[1], 
                    Symbol = p[2], 
                    Status = p[3], 
                    PickedAt = DateTime.Parse(p[4]), 
                    PickedPrice = decimal.Parse(p[5]), 
                    ErrorMessage = p.Length > 6 ? p[6] : "" 
                };
            }).ToList();
        }

        public void AddStrategyStockExecution(StrategyStockExecution e)
        {
            File.AppendAllText(StrategyStockExecutionsFile, $"{e.Id},{e.StrategyId},{e.Symbol},{e.Status},{e.PickedAt:O},{e.PickedPrice},{e.ErrorMessage}\n");
        }

        public void UpdateStrategyStockExecutions(List<StrategyStockExecution> executions)
        {
            var lines = new List<string> { "Id,StrategyId,Symbol,Status,PickedAt,PickedPrice,ErrorMessage" };
            foreach (var e in executions) lines.Add($"{e.Id},{e.StrategyId},{e.Symbol},{e.Status},{e.PickedAt:O},{e.PickedPrice},{e.ErrorMessage}");
            File.WriteAllLines(StrategyStockExecutionsFile, lines);
        }

        private string[] ParseCsvLine(string line)
        {
            var result = new List<string>();
            bool inQuote = false;
            var current = new System.Text.StringBuilder();
            for (int i = 0; i < line.Length; i++)
            {
                char c = line[i];
                if (c == '\"')
                {
                    inQuote = !inQuote;
                }
                else if (c == ',' && !inQuote)
                {
                    result.Add(current.ToString());
                    current.Clear();
                }
                else
                {
                    current.Append(c);
                }
            }
            result.Add(current.ToString());
            return result.ToArray();
        }
    }
}
