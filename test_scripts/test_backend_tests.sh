#!/bin/bash
set -e  # exit immediately if any command fails

echo "Setting up Python environment..."
python3 -m venv venv
source venv/bin/activate

echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "Running all backend tests..."
cd isd
python3 manage.py test --noinput

echo "Backend tests completed successfully."
