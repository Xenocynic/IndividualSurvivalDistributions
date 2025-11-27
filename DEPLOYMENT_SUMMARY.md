# Deployment Summary

## ✅ What's Been Configured

Your Django application is now ready for production deployment at **https://isd.srv.ualberta.ca/**

### Current Status

1. **✅ Security Hardened**
   - Environment variables configured
   - Secrets moved to `.env` file
   - DEBUG=False for production
   - Security headers enabled
   - CORS properly restricted

2. **✅ Production Services Configured**
   - Gunicorn WSGI server (3 workers)
   - Nginx reverse proxy
   - Systemd services (auto-start on boot)
   - Static file serving
   - Media file serving

3. **✅ Domain Configuration Ready**
   - Domain: `isd.srv.ualberta.ca`
   - IPv4: `10.2.14.245`
   - IPv6: `2605:fd00:4:1001:f816:3eff:fec6:3fd9`
   - ALLOWED_HOSTS configured
   - CORS origins configured

4. **✅ Deployment Scripts Created**
   - `./deploy_production.sh` - Full production deployment
   - `./setup_ssl.sh` - SSL/HTTPS setup
   - `./start_all.sh` - Local development (existing)

## 🔧 What You Need to Do

### Step 1: Configure DNS (REQUIRED)

Contact your UAlberta IT department to configure DNS:

**Required DNS Records:**
```
Type: A
Name: isd.srv.ualberta.ca
Value: 10.2.14.245

Type: AAAA
Name: isd.srv.ualberta.ca
Value: 2605:fd00:4:1001:f816:3eff:fec6:3fd9
```

**Verify DNS is working:**
```bash
dig isd.srv.ualberta.ca A      # Should return 10.2.14.245
dig isd.srv.ualberta.ca AAAA   # Should return 2605:fd00:4:1001:f816:3eff:fec6:3fd9
```

### Step 2: Configure Firewall (REQUIRED)

Ensure these ports are open on your server and network firewall:
```bash
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 22/tcp   # SSH
sudo ufw enable
```

### Step 3: Upgrade Node.js (REQUIRED for Frontend)

Current Node.js version is too old (v12). Upgrade to v20:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
nvm alias default 20
```

Verify:
```bash
node --version  # Should show v20.x.x
```

### Step 4: Deploy Application

Once DNS, firewall, and Node.js are configured:
```bash
cd /home/ubuntu/f25project-DeptofComputingScience
./deploy_production.sh
```

This will:
- Install all dependencies
- Run database migrations
- Collect static files
- Build and deploy frontend
- Start all services (Django, ML API, Nginx)

### Step 5: Enable SSL/HTTPS

After confirming the site works over HTTP, enable HTTPS:
```bash
./setup_ssl.sh
```

This will:
- Obtain free SSL certificate from Let's Encrypt
- Configure Nginx for HTTPS
- Enable automatic SSL redirect
- Set up auto-renewal

## 📊 Services Overview

| Service | What | How to Manage |
|---------|------|---------------|
| **Django Backend** | API + Admin interface | `sudo systemctl restart isd-django.service` |
| **ML API** | Machine learning predictions | `sudo systemctl restart isd-ml-api.service` |
| **Frontend** | React web interface | Rebuild: `cd frontend && npm run build` |
| **Nginx** | Web server + reverse proxy | `sudo systemctl reload nginx` |

## 🔄 Deployment Workflows

### Local Development
```bash
./start_all.sh
```
- Django dev server on http://localhost:8000
- Vite dev server on http://localhost:5173
- Hot reload enabled
- Use this for development

### Production Deployment
```bash
./deploy_production.sh
```
- All services via systemd
- Nginx reverse proxy
- Production builds
- Auto-restart on failure
- Use this for production

## 📁 Key Files

| File | Purpose |
|------|---------|
| `isd/.env` | Environment variables (secrets) |
| `isd/.env.example` | Template for environment variables |
| `/etc/nginx/sites-available/isd` | Nginx configuration |
| `/etc/systemd/system/isd-django.service` | Django service config |
| `/etc/systemd/system/isd-ml-api.service` | ML API service config |
| `DEPLOYMENT.md` | Complete deployment documentation |

## 🌐 Access Points

After deployment:

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | https://isd.srv.ualberta.ca/ | Main web interface |
| **API** | https://isd.srv.ualberta.ca/api/ | REST API endpoints |
| **Admin** | https://isd.srv.ualberta.ca/admin/ | Django admin panel |
| **API Docs** | https://isd.srv.ualberta.ca/api/schema/swagger-ui/ | API documentation |

## 🆚 start_all.sh vs deploy_production.sh

### `./start_all.sh` (Development)
- **Django**: Development server (`runserver`)
- **Frontend**: Vite dev server with hot reload
- **ML API**: Development mode
- **Logs**: Terminal output
- **Use for**: Local development, debugging
- **Stops when**: Terminal closed

### `./deploy_production.sh` (Production)
- **Django**: Gunicorn with 3 workers
- **Frontend**: Static build served by Nginx
- **ML API**: Systemd service
- **Logs**: Files + journalctl
- **Use for**: Production deployment
- **Runs as**: Background services

## 📝 Quick Commands

```bash
# Full production deployment
./deploy_production.sh

# Enable SSL (after DNS configured)
./setup_ssl.sh

# Check all services
sudo systemctl status isd-django.service nginx isd-ml-api.service

# Restart Django
sudo systemctl restart isd-django.service

# View Django logs
tail -f ~/.logs/gunicorn-error.log

# View Nginx logs
sudo tail -f /var/log/nginx/error.log

# Test Nginx config
sudo nginx -t
```

## ⚠️ Important Notes

1. **DNS First**: Domain won't work until DNS is configured
2. **SSL Later**: Get HTTP working first, then enable SSL
3. **Node.js Required**: Frontend build needs Node.js v20+
4. **Firewall**: Ensure ports 80 and 443 are open
5. **ML API**: Requires `MakeSurvivalCalibratedAgain-MTLR-API` in parent directory

## 📖 Full Documentation

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete documentation including:
- Detailed configuration
- Troubleshooting guide
- Security checklist
- Monitoring setup
- Update procedures

## 🆘 Getting Help

If something doesn't work:
1. Check the logs (see Quick Commands above)
2. Verify DNS configuration: `dig isd.srv.ualberta.ca`
3. Check firewall: `sudo ufw status`
4. Review [DEPLOYMENT.md](DEPLOYMENT.md)
5. Check service status: `sudo systemctl status <service-name>`
