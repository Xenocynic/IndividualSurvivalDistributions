#!/bin/bash
set -e

echo "Setting up Python environment..."
python3 -m venv venv
source venv/bin/activate

echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "Running all backend tests..."
cd isd
python3 manage.py test --noinput

echo "Starting Django server in background..."
# Let Django pick a free port dynamically
python3 manage.py runserver 0.0.0.0:0 &
PID=$!

# Wait a few seconds for server to start
sleep 5

# Check if the process is alive
if ps -p $PID > /dev/null; then
    echo "Backend server started successfully (PID: $PID)"
else
    echo "Backend server failed to start"
    exit 1
fi

# Kill the background process
kill $PID || true
wait $PID 2>/dev/null || true

echo "Backend test completed."
