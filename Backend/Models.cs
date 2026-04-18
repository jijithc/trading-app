using System;

namespace TradingApp.Api.Models
{
    public class User
    {
        public string? Id { get; set; } = Guid.NewGuid().ToString();
        public string? Username { get; set; }
        public string? Password { get; set; }
        public string? BrokerApiKey { get; set; }
    }

    public class Transaction
    {
        public string? Id { get; set; } = Guid.NewGuid().ToString();
        public string? UserId { get; set; }
        public string? Symbol { get; set; }
        public string? Type { get; set; } // Buy, Sell
        public decimal Quantity { get; set; }
        public decimal Price { get; set; }
        public DateTime Date { get; set; }
        public decimal? TargetPrice { get; set; }
        public decimal? StopLossPrice { get; set; }
        public bool IsActive { get; set; }
        public string? OrderId { get; set; }
    }

    public class Order
    {
        public string? Id { get; set; } = Guid.NewGuid().ToString();
        public string? UserId { get; set; }
        public string? Symbol { get; set; }
        public string? Type { get; set; } // Buy, Sell
        public decimal Quantity { get; set; }
        public decimal Price { get; set; }
        public DateTime Date { get; set; }
        public string? Status { get; set; } // Pending, Executed, Rejected
        public decimal TargetPercent { get; set; }
        public decimal StopLossPercent { get; set; }
        public int Confidence { get; set; }
        public string? StrategyId { get; set; }
    }

    public class MarketResearch
    {
        public string? Symbol { get; set; }
        public DateTime Date { get; set; }
        public string? Recommendation { get; set; } // Buy, Sell, Hold
        public decimal CurrentPrice { get; set; }
        public string? Reason { get; set; }
    }

    public class StockInferenceResponse
    {
        public string Symbol { get; set; }
        public decimal LatestPrice { get; set; }
        public decimal PreviousClose { get; set; }
        public decimal Change { get; set; }
        public decimal ChangePercent { get; set; }
        public string Trend { get; set; }

        public decimal DayHigh { get; set; }
        public decimal DayLow { get; set; }
        public decimal VolatilityPercent { get; set; }

        public long AverageVolume { get; set; }
        public long LatestVolume { get; set; }
        public bool IsVolumeSpike { get; set; }

        public string CandleInterval { get; set; }
        public string Phase { get; set; }   
    }

    public class TradingStrategy
    {
        public string? Id { get; set; } = Guid.NewGuid().ToString();
        public string? UserId { get; set; }
        public string? Name { get; set; }
        
        // Section 1: Picking Stock
        public string? StockSource { get; set; } // Gainers, VolumeSpurts, MostActive
        public string? ScheduledTime { get; set; } // HH:mm format
        public string? SelectionReasoning { get; set; }
        public DateTime? LastRunDate { get; set; }
        
        // Section 2: Analysis and Reasoning
        public decimal EntryPrice { get; set; }
        public decimal StopLoss { get; set; }
        public decimal TargetPrice { get; set; }
        public string? AnalysisReasoning { get; set; }
        
        // Section 3: Trade Trigger
        public string? TriggerCondition { get; set; } // e.g. Price Below, Price Above, Immediate
        public string? Type { get; set; } // Buy/Sell
        public decimal? Quantity { get; set; }
        public decimal? AllocationLimit { get; set; } // Max budget per stock
        public decimal? TotalAmount { get; set; } // Total amount used for this strategy
        public int MaxStocks { get; set; } = 5; // Top N stocks from source
        public string? EndTime { get; set; } // HH:mm format for auto-exit/stop
        public decimal? MinVolatility { get; set; }
        public decimal? MaxVolatility { get; set; }
        public bool UseVolatilityForSlTgt { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public bool UseConfidence { get; set; }
        public int MinConfidence { get; set; } = 70;
        public bool SquareOffAtEndTime { get; set; }
        public decimal? MinProfitBooking { get; set; }
        
        // Section 5: Technical Analysis
        public bool CheckVolumeSurge { get; set; }
        public decimal VolumeSurgeRatio { get; set; } = 1.5m;
        public bool CheckBreakout { get; set; }
        public string Timeframe { get; set; } = "15m"; // 1m, 5m, 15m, 1h, 1d
        public int LookbackPeriod { get; set; } = 20;

        // Section 6: Python Engine / Chart Analyser
        public bool UseChartAnalyser { get; set; }
        public int AnalysisDuration { get; set; } = 60; // Minutes to watch the stock for opportunity
        public bool PredictSlAndTarget { get; set; }
        public string? WatchlistGroup { get; set; }

    }

    public class StrategyExecutionStatus
    {
        public string StrategyId { get; set; } = string.Empty;
        public string Symbol { get; set; } = string.Empty;
        public decimal EntryPrice { get; set; }
        public decimal Quantity { get; set; }
        public decimal ExitPrice { get; set; }
        public decimal? TargetPrice { get; set; }
        public decimal? StopLossPrice { get; set; }
        public decimal ProfitLoss { get; set; }
        public string Status { get; set; } = string.Empty; // Success, Failure
        public DateTime ExecutionDate { get; set; } = DateTime.Now;
    }

    public class WatchlistItem
    {
        public string? Id { get; set; } = Guid.NewGuid().ToString();
        public string? UserId { get; set; }
        public string? Symbol { get; set; }
        public string? WatchlistName { get; set; } // The name of the custom list/group
        public DateTime AddedAt { get; set; } = DateTime.Now;
    }
    public class StrategyStockExecution
    {
        public string? Id { get; set; } = Guid.NewGuid().ToString();
        public string? StrategyId { get; set; }
        public string? Symbol { get; set; }
        public string? Status { get; set; } // Waiting for Opportunity, Executed, Failed, etc.
        public DateTime PickedAt { get; set; } = DateTime.Now;
        public decimal PickedPrice { get; set; }
        public string? ErrorMessage { get; set; }
    }
}
