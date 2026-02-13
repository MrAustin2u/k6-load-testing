#!/bin/bash

# Load test runner script for k6
# This script loads environment variables from .env file and runs the k6 test

set -e  # Exit on error

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check if .env file exists
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo "Error: .env file not found!"
    echo "Please copy .env.example to .env and fill in your credentials:"
    echo "  cp $SCRIPT_DIR/.env.example $SCRIPT_DIR/.env"
    echo "  # Then edit .env with your actual values"
    exit 1
fi

# Load environment variables from .env file
echo "Loading environment variables from .env..."
export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)

# Verify required variables are set
if [ -z "$AUTH_TOKEN" ] || [ "$AUTH_TOKEN" = "your_bearer_token_here" ]; then
    echo "Error: AUTH_TOKEN is not set or still has the example value"
    echo "Please edit .env and set your actual AUTH_TOKEN"
    exit 1
fi

if [ -z "$STAFF_ID" ] || [ "$STAFF_ID" = "your_staff_id_here" ]; then
    echo "Error: STAFF_ID is not set or still has the example value"
    echo "Please edit .env and set your actual STAFF_ID"
    exit 1
fi

# Display configuration
echo "========================================="
echo "k6 Load Test Configuration"
echo "========================================="
echo "Base URL: $BASE_URL"
echo "Auth Token: ${AUTH_TOKEN:0:20}..." # Show only first 20 chars
echo "Staff ID: $STAFF_ID"
echo "========================================="
echo ""

# Run k6 with environment variables
echo "Starting k6 load test..."
k6 run \
    -e BASE_URL="$BASE_URL" \
    -e AUTH_TOKEN="$AUTH_TOKEN" \
    -e STAFF_ID="$STAFF_ID" \
    "$SCRIPT_DIR/index.ts" \
    "$@"  # Pass any additional arguments to k6

echo ""
echo "Load test completed!"
