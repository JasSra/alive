# 🚀 Live Event Tracker Dashboard - User Guide

## ✅ **Fixed Issues:**
1. **Table Layout**: No more ellipses truncation for correlation IDs
2. **Request/Response Nesting**: Events with same correlation ID are grouped with expandable details
3. **WebSocket Fallback**: Graceful fallback to SSE when WebSocket fails (no more console errors)
4. **Enhanced Seeder**: Realistic request/response simulation with varied status codes

## 📊 **Dashboard Features:**

### **Live Events Table** (Left Panel)
- **Grouped Display**: Request/response pairs grouped by correlation ID
- **Expandable Rows**: Click on any correlation group to see individual request/response details
- **Visual Indicators**:
  - 📤 Request events (statusCode: 0)
  - ✅ Success responses (2xx)
  - ❌ Error responses (4xx/5xx)
  - ▶/▼ Expand/collapse correlation groups
- **Correlation ID**: Shows last 8 characters with full ID on hover
- **Nested View**: Request → Response flow clearly visible

### **Request/Response Pairs** (Right Panel)
- **Correlation Analysis**: Grouped by correlation ID
- **Status Filtering**: Filter by pending/2xx/4xx/5xx
- **Latency Tracking**: Color-coded response times
- **Search**: Filter by event name or correlation ID

## 🎮 **How to Use:**

### **1. Start the Dashboard**
```bash
cd /Users/jas/code/alive
npm run dev
```
Dashboard will be available at: http://localhost:3000

### **2. Generate Live Events**
```bash
# Generate 50 events (default)
npm run seed

# Generate specific number
node scripts/seed.js 10
```

### **3. Transport Options**
- **SSE (Default)**: Reliable Server-Sent Events
- **WebSocket**: Attempts WebSocket, gracefully falls back to SSE if unavailable

### **4. Viewing Modes**
- **Live Mode**: Real-time event streaming
- **Manual Mode**: Historical range fetching

## 🔧 **Event Generation Details:**

The seeder now creates realistic request/response patterns:

```
[seed] 1/10 -> user-logout :: ✅ 202 in 1247ms
[seed] 2/10 -> error :: ❌ 400 in 1473ms
```

Each event generates:
1. **Request** (statusCode: 0) - When request starts
2. **Response** (statusCode: 200/400/500/etc) - When request completes
3. **Correlation ID** - Links request/response pairs
4. **Realistic Latency** - 250-1400ms response times
5. **Various Status Codes**: 200, 201, 202, 400, 401, 403, 404, 500, 502, 503

## 🎯 **Table Improvements:**

### **Before**: 
- Long correlation IDs truncated with ellipses
- Flat list of events
- No request/response relationship visible

### **After**:
- ✅ **Grouped Events**: Request/response pairs grouped together
- ✅ **Expandable Details**: Click to see individual request/response
- ✅ **Full Correlation IDs**: Last 8 chars shown, full ID on hover
- ✅ **Visual Hierarchy**: Clear nesting with └─ indicators
- ✅ **JSON Details**: Expandable data viewing with `<details>`
- ✅ **Status Icons**: 📤 for requests, ✅/❌ for responses

## 🚨 **No More Errors:**
- **WebSocket Error Fixed**: Graceful fallback prevents console errors
- **Connection Timeout**: 5-second timeout before SSE fallback
- **Clean Error Handling**: No more "{}" error objects in console

## 🎪 **Live Demo Flow:**

1. Open dashboard at http://localhost:3000
2. Set transport to "SSE" (default)
3. Turn on "Live" mode
4. Run `npm run seed` in terminal
5. Watch events appear in real-time:
   - Grouped by correlation ID
   - Expandable request/response details
   - Color-coded status indicators
   - Real-time latency monitoring

## 📈 **Status Indicators:**
- 📤 **Yellow**: Request started (statusCode: 0)
- ✅ **Green**: Success (200-299)
- ❌ **Red**: Error (400-599)
- 🔍 **Expandable**: Click group to see details
- ⚡ **Real-time**: Live updates via SSE

## 🔄 **Start/Stop Controls:**
- **Live Toggle**: Switch between live streaming and manual mode
- **Transport Selector**: Choose SSE or WebSocket (with fallback)
- **Fetch Range**: Manually fetch historical data
- **Clear Button**: Clear current events
- **Filters**: Search and filter in correlation panel

Your dashboard is now production-ready with enhanced UX and error-free operation! 🎉
