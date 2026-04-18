using Microsoft.AspNetCore.Mvc;
using System.Linq;
using TradingApp.Api.Models;
using TradingApp.Api.Repositories;

namespace TradingApp.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly ICsvRepository _repo;

        public AuthController(ICsvRepository repo)
        {
            _repo = repo;
        }

        [HttpPost("register")]
        public IActionResult Register([FromBody] User user)
        {
            if (string.IsNullOrEmpty(user.Username) || string.IsNullOrEmpty(user.Password))
                return BadRequest("Invalid credentials.");

            var exists = _repo.GetUsers().Any(u => u.Username == user.Username);
            if (exists) return Conflict("User already exists.");

            _repo.AddUser(user);
            return Ok(new { message = "Registration successful", userId = user.Id });
        }

        [HttpPost("login")]
        public IActionResult Login([FromBody] User dto)
        {
            var user = _repo.GetUsers().FirstOrDefault(u => u.Username == dto.Username && u.Password == dto.Password);
            if (user == null) return Unauthorized("Invalid username or password.");

            // Fake JWT token (for simplicity) return userId as token
            return Ok(new { token = user.Id, username = user.Username, brokerApiKey = user.BrokerApiKey });
        }
    }
}
