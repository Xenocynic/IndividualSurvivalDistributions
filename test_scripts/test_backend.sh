#!/bin/bash
set -e

echo "Activating virtual environment..."
source venv/bin/activate

echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "Starting Django server in background..."
cd isd
python3 manage.py runserver 0.0.0.0:8000 &
PID=$!

# Wait a few seconds for server to start
sleep 5

# Test if server is running (basic port check)
if lsof -i :8000 > /dev/null; then
    echo "Backend started successfully!"
else
    echo "Backend failed to start"
    exit 1
fi

# Kill the background process
kill $PID
wait $PID 2>/dev/null || true
echo "Backend test completed."
