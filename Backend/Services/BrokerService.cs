using System;
using System.Collections.Generic;
using TradingApp.Api.Models;

namespace TradingApp.Api.Services
{
    public interface IBrokerService
    {
        bool Authenticate(string apiKey);
        object GetPortfolio(string userId);
        Transaction ExecuteTrade(string userId, string symbol, string type, decimal quantity);
        Transaction ExecutePaperTrade(string userId, string symbol, string type, decimal quantity, decimal price, decimal? targetPrice, decimal? stopLossPrice);
    }

    public class BrokerService : IBrokerService
    {
        private readonly Random _random = new Random();

        public bool Authenticate(string apiKey)
        {
            // Mock authentication
            return !string.IsNullOrEmpty(apiKey);
        }

        public object GetPortfolio(string userId)
        {
            // Mock fetching from broker
            return new
            {
                AccountId = "ACC-" + userId.Substring(0, 4),
                Balance = 10000m + (decimal)_random.NextDouble() * 5000m,
                Positions = new List<object>
                {
                    new { Symbol = "AAPL", Quantity = 10, CurrentPrice = 150m + (decimal)_random.NextDouble() * 10m },
                    new { Symbol = "MSFT", Quantity = 5, CurrentPrice = 250m + (decimal)_random.NextDouble() * 10m }
                }
            };
        }

        public Transaction ExecuteTrade(string userId, string symbol, string type, decimal quantity)
        {
            // Mock execution
            var price = 100m + (decimal)_random.NextDouble() * 100m; // Mock price
            return new Transaction
            {
                UserId = userId,
                Symbol = symbol,
                Type = type,
                Quantity = quantity,
                Price = price,
                Date = DateTime.UtcNow
            };
        }

        public Transaction ExecutePaperTrade(string userId, string symbol, string type, decimal quantity, decimal price, decimal? targetPrice, decimal? stopLossPrice)
        {
            return new Transaction
            {
                UserId = userId,
                Symbol = symbol,
                Type = type,
                Quantity = quantity,
                Price = Math.Round(price, 2),
                Date = DateTime.Now, // Use local time for better alignment with logs
                TargetPrice = targetPrice.HasValue ? Math.Round(targetPrice.Value, 2) : (decimal?)null,
                StopLossPrice = stopLossPrice.HasValue ? Math.Round(stopLossPrice.Value, 2) : (decimal?)null,
                IsActive = true // All new positions start as active to monitor TP/SL goals
            };
        }
    }
}
