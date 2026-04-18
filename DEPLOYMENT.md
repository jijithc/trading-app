# Trading App: Docker, Hosting & Domain Guide

This document provides a deep dive into how your application is structured for deployment and how to take it live with a custom domain.

---

## 1. Docker Setup & Architecture

Your solution uses **Docker Compose** to orchestrate three independent services.

### Service Breakdown & Networking

| Service | Internal Name | Port (External) | Port (Internal) | Role |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | `frontend` | `5173` | `80` | Serves the React UI via Nginx. |
| **Backend** | `backend` | `5044` | `8080` | .NET 8 API handling logic & data. |
| **Python Engine** | `python-engine`| `8000` | `8000` | FastAPI service for market analysis. |

### How they communicate:
1.  **Internal (Server-to-Server)**: 
    - The Backend talks to the Python Engine using `http://python-engine:8000`.
    - The Python Engine talks to the Backend using `http://backend:8080`.
    - *Why?* Docker creates a private virtual network where containers can "see" each other by their service names.
2.  **External (Browser-to-Server)**:
    - Your browser talks to the Frontend at `localhost:5173`.
    - Your browser talks to the Backend at `localhost:5044`.

### Environment Variable Logic:
- **`PythonEngine__Url`**: Set in the Backend container to override its default `localhost` settings.
- **`BACKEND_URL`**: Set in the Python container to tell it where the .NET API lives.

---

## 2. Steps to Host the Solution (Cloud Deployment)

If you are moving from local Docker to a real server (VPS or AWS):

### Step 1: Prepare the Server
1.  Install **Docker** and **Docker Compose** on your remote server.
2.  Clone your code to the server using Git.

### Step 2: Configure for Production
1.  Update your `Frontend/src/apiConfig.js` to use your server's Public IP or Domain.
2.  Build the images on the server:
    ```bash
    docker-compose build
    ```

### Step 3: Run in Detached Mode
Start the services in the background:
```bash
docker-compose up -d
```

---

## 3. How to Point a Domain

Once your app is running on a server IP (e.g., `12.34.56.78`), follow these steps:

### Step 1: DNS Configuration
Go to your domain provider (GoDaddy, Namecheap, Route53) and add these records:
- **Type A**: Name: `@`, Value: `your_server_ip` (Points `example.com` to your server).
- **Type CNAME**: Name: `www`, Value: `example.com` (Optional).

### Step 2: Reverse Proxy (Nginx)
While Docker runs on ports 5173/5044, users expect to visit you on Port 80 (HTTP) or 443 (HTTPS). You should install Nginx on the host server to redirect traffic:

```nginx
# Example Nginx Config (/etc/nginx/sites-available/default)
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://localhost:5173; # Directs traffic to Frontend Docker
    }

    location /api/ {
        proxy_pass http://localhost:5044/api/; # Directs API traffic to Backend Docker
    }
}
```

### Step 3: SSL (HTTPS)
Never host a trading app without SSL. Use **Certbot** (Free):
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d example.com
```
Certbot will automatically update your Nginx config to support HTTPS and redirect all users to the secure version.

---

## 4. Summary of Links (Local Docker)
- **UI**: [http://localhost:5173](http://localhost:5173)
- **API Docs**: [http://localhost:5044/swagger](http://localhost:5044/swagger)
- **Python Health**: [http://localhost:8000/docs](http://localhost:8000/docs)
