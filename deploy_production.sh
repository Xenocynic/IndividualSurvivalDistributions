#!/bin/bash

# Production Deployment Script for ISD
# This script manages all services needed for production deployment:
# - Django (via systemd/gunicorn)
# - Frontend (built and served via nginx)
# - ML API (via systemd)

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ML_API_DIR="$PROJECT_ROOT/../MakeSurvivalCalibratedAgain-MTLR-API"

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}ISD Production Deployment${NC}"
echo -e "${CYAN}========================================${NC}\n"

# Function to check if a systemd service exists
service_exists() {
    systemctl list-unit-files | grep -q "^$1"
}

# 1. Deploy Django Backend
echo -e "${RED}[1/3] Deploying Django Backend...${NC}"
cd "$PROJECT_ROOT"

# Activate venv and install dependencies
source venv/bin/activate
pip install -q -r requirements.txt

# Run migrations
cd isd
python manage.py migrate --noinput

# Collect static files
python manage.py collectstatic --noinput

# Restart Django service
echo -e "${RED}Restarting Django service...${NC}"
sudo systemctl restart isd-django.service
sudo systemctl enable isd-django.service

if sudo systemctl is-active --quiet isd-django.service; then
    echo -e "${GREEN}✓ Django backend is running${NC}"
else
    echo -e "${RED}✗ Django backend failed to start${NC}"
    sudo systemctl status isd-django.service --no-pager
    exit 1
fi

# 2. Deploy ML API
echo -e "\n${BLUE}[2/3] Deploying ML API...${NC}"
if [ -d "$ML_API_DIR" ]; then
    # Check if ML API service exists, create if not
    if ! service_exists "isd-ml-api.service"; then
        echo -e "${YELLOW}Creating ML API systemd service...${NC}"

        # Create ML API service file
        sudo tee /etc/systemd/system/isd-ml-api.service > /dev/null <<EOF
[Unit]
Description=ISD ML API Service
After=network.target

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=$ML_API_DIR
Environment="PATH=$ML_API_DIR/venv/bin"
ExecStart=$ML_API_DIR/venv/bin/python app.py
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

        sudo systemctl daemon-reload
    fi

    # Install dependencies
    cd "$ML_API_DIR"
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    source venv/bin/activate
    pip install -q -r requirements.txt

    # Restart ML API service
    echo -e "${BLUE}Restarting ML API service...${NC}"
    sudo systemctl restart isd-ml-api.service
    sudo systemctl enable isd-ml-api.service

    sleep 2
    if sudo systemctl is-active --quiet isd-ml-api.service; then
        echo -e "${GREEN}✓ ML API is running${NC}"
    else
        echo -e "${YELLOW}⚠ ML API may not be running (check logs)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ ML API directory not found at $ML_API_DIR${NC}"
    echo -e "${YELLOW}  Skipping ML API deployment${NC}"
fi

# 3. Build and Deploy Frontend
echo -e "\n${GREEN}[3/3] Building and Deploying Frontend...${NC}"
cd "$PROJECT_ROOT/frontend"

# Check if Node.js is available and version is adequate
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo -e "${YELLOW}⚠ Node.js version is too old (need v18+)${NC}"
        echo -e "${YELLOW}  Please upgrade Node.js to deploy the frontend${NC}"
        echo -e "${YELLOW}  Skipping frontend deployment${NC}"
    else
        # Create production .env file
        cat > .env.production <<EOF
VITE_API_BASE_URL=https://isd.srv.ualberta.ca
VITE_AUTH_MODE=real
EOF

        echo -e "${GREEN}Installing frontend dependencies...${NC}"
        npm install

        echo -e "${GREEN}Building frontend for production...${NC}"
        npm run build

        # Deploy to nginx
        FRONTEND_BUILD_DIR="$PROJECT_ROOT/frontend/dist"
        NGINX_FRONTEND_DIR="/var/www/isd-frontend"

        if [ -d "$FRONTEND_BUILD_DIR" ]; then
            echo -e "${GREEN}Deploying frontend to nginx...${NC}"
            sudo mkdir -p "$NGINX_FRONTEND_DIR"
            sudo rm -rf "$NGINX_FRONTEND_DIR"/*
            sudo cp -r "$FRONTEND_BUILD_DIR"/* "$NGINX_FRONTEND_DIR/"
            sudo chown -R www-data:www-data "$NGINX_FRONTEND_DIR"
            echo -e "${GREEN}✓ Frontend deployed${NC}"
        else
            echo -e "${RED}✗ Frontend build failed${NC}"
            exit 1
        fi
    fi
else
    echo -e "${YELLOW}⚠ Node.js not installed${NC}"
    echo -e "${YELLOW}  Please install Node.js v20+ to deploy the frontend${NC}"
    echo -e "${YELLOW}  Skipping frontend deployment${NC}"
fi

# Reload nginx
echo -e "\n${CYAN}Reloading Nginx...${NC}"
sudo systemctl reload nginx

echo -e "\n${CYAN}========================================${NC}"
echo -e "${CYAN}Deployment Complete!${NC}"
echo -e "${CYAN}========================================${NC}\n"

# Show service status
echo -e "${CYAN}Service Status:${NC}"
echo -e "${RED}Django Backend:${NC}"
sudo systemctl status isd-django.service --no-pager -l | head -5

if service_exists "isd-ml-api.service"; then
    echo -e "\n${BLUE}ML API:${NC}"
    sudo systemctl status isd-ml-api.service --no-pager -l | head -5
fi

echo -e "\n${GREEN}Nginx:${NC}"
sudo systemctl status nginx --no-pager -l | head -5

echo -e "\n${CYAN}========================================${NC}"
echo -e "${CYAN}Access your application at:${NC}"
echo -e "${GREEN}https://isd.srv.ualberta.ca/${NC}"
echo -e "${CYAN}========================================${NC}\n"

echo -e "${YELLOW}Note: SSL/HTTPS is currently disabled${NC}"
echo -e "${YELLOW}To enable SSL, run: ./setup_ssl.sh${NC}\n"
