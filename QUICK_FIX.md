# Quick Fix for "Evaluate Button Not Working"

## Problem
Port mismatch between frontend and backend + slow evaluation timeout

## Solution

### 1. Restart Backend Server
```powershell
# Stop any running backend (Press Ctrl+C in the server terminal)
# Then start with:
cd backend
python start_server.py
```

The server will show which port it's using (e.g., port 8005).

### 2. Update Frontend API URL
Open `frontend/src/services/api.ts` and update:
```typescript
const API_BASE_URL = 'http://localhost:8005';  // Match the port from step 1
```

### 3. Restart Frontend (if running)
```powershell
cd frontend
npm run dev
```

## What Was Fixed

1. **Port Configuration**: Created `start_server.py` that shows which port is being used
2. **Performance**: Switched from slow "deep" scrapers to faster "live" scrapers
3. **OCR**: Temporarily disabled OCR (was causing 60+ second timeouts)
4. **Image Filtering**: Added smart filter to process only product packaging images

## Test the Fix

1. Open your browser to the frontend URL (usually http://localhost:5173)
2. Go to "Product Scanner" page
3. Enter "poha" or "amul milk" 
4. Click "Evaluate"
5. Should see results within 10-15 seconds

## Current Server Status
- Backend: Port 8005 (check terminal output for actual port)
- Frontend API configured for: Port 8005

**Note**: Make sure both match! The server prints the port when it starts.
