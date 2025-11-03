#!/bin/bash

echo "================================================"
echo "  {ascend.py} - Integration Demo Setup"
echo "================================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "Error: Run this script from the project root directory"
    exit 1
fi

# Step 1: Seed database
echo "Step 1: Seeding database from JSON..."
echo "  → Run scripts/001-create-tables.sql"
echo "  → Run scripts/003-seed-from-json.sql"
echo "  (Execute these in your database client or v0 interface)"
echo ""

# Step 2: Install dependencies
echo "Step 2: Installing dependencies..."
if [ ! -d "node_modules" ]; then
    npm install
fi

if [ -d "ml-service" ] && [ ! -d "ml-service/venv" ]; then
    echo "  → Setting up Python ML service..."
    cd ml-service
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    cd ..
fi
echo ""

# Step 3: Check environment variables
echo "Step 3: Checking environment..."
if [ -z "$NEON_NEON_DATABASE_URL" ]; then
    echo "  ⚠️  Warning: NEON_DATABASE_URL not set"
fi

if [ -z "$ML_API_URL" ]; then
    echo "  ℹ️  ML_API_URL not set - will use rules-based fallback"
    echo "  To enable ML: export ML_API_URL=http://localhost:8000"
fi
echo ""

# Step 4: Start services
echo "Step 4: Starting services..."
echo ""
echo "To run the complete demo:"
echo ""
echo "  Terminal 1 (ML Service - optional):"
echo "    cd ml-service"
echo "    source venv/bin/activate"
echo "    uvicorn main:app --reload --port 8000"
echo ""
echo "  Terminal 2 (Next.js App):"
echo "    npm run dev"
echo ""
echo "  Terminal 3 (CLI Demo):"
echo "    python3 cli/main.py"
echo ""
echo "================================================"
echo "  Ready to demo CLI + Web Tutor"
echo "  (Rules-based and ML-ready)"
echo "================================================"
