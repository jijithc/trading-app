using Microsoft.AspNetCore.Mvc;
using System;
using System.Linq;
using TradingApp.Api.Models;
using TradingApp.Api.Repositories;

namespace TradingApp.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WatchlistController : ControllerBase
    {
        private readonly ICsvRepository _repo;

        public WatchlistController(ICsvRepository repo)
        {
            _repo = repo;
        }

        private string GetUserId()
        {
            return Request.Headers["Authorization"].FirstOrDefault()?.Replace("Bearer ", "") ?? "00001";
        }

        [HttpGet]
        public IActionResult GetWatchlist()
        {
            var userId = GetUserId();
            var list = _repo.GetWatchlist().Where(i => i.UserId == userId).OrderByDescending(i => i.AddedAt).ToList();
            return Ok(list);
        }

        [HttpPost]
        public IActionResult AddToWatchlist([FromBody] WatchlistItem item)
        {
            item.UserId = GetUserId();
            item.Id = Guid.NewGuid().ToString();
            item.AddedAt = DateTime.Now;
            _repo.AddToWatchlist(item);
            return Ok(item);
        }

        [HttpDelete("{id}")]
        public IActionResult RemoveFromWatchlist(string id)
        {
            _repo.RemoveFromWatchlist(id);
            return Ok(new { Message = "Removed from watchlist" });
        }
    }
}
