# PulseCare

**Federated AI Platform for Real-Time PHC Resource Management**

A federated AI platform providing real-time visibility into medicine stocks, bed availability, and medical personnel attendance across a network of Primary Health Centres (PHCs). Features demand forecasting, stock-out early warnings, and AI-recommended cross-district resource redistribution.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      PulseCare Architecture                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────────┐   │
│  │  React + Vite │◄──│  WebSocket   │◄──│  Redis Stream    │   │
│  │  Dashboard    │    │  Gateway     │    │  Consumer        │   │
│  │  (Recharts)   │    └──────────────┘    └────────┬────────┘   │
│  └──────┬───────┘                                  │            │
│         │ REST                                     │            │
│         ▼                                          │            │
│  ┌──────────────┐    ┌──────────────┐    ┌────────┴────────┐   │
│  │  Fastify API  │───│  PostgreSQL   │    │  Redis Streams   │   │
│  │  Server       │    │  Database     │───│  (Pub/Sub)       │   │
│  └──────┬───────┘    └──────────────┘    └─────────────────┘   │
│         │                                                       │
│  ┌──────┴──────────────────────────┐                           │
│  │  AI Modules (Direct LLM Calls)  │                           │
│  │  ┌────────────┐ ┌─────────────┐ │                           │
│  │  │ Forecasting│ │Redistribution│ │                           │
│  │  │ & Risk     │ │ Engine      │ │                           │
│  │  └────────────┘ └─────────────┘ │                           │
│  └─────────────────────────────────┘                           │
│                                                                 │
│  ┌──────────────────────────────────┐                          │
│  │  Synthetic Data Generator        │                          │
│  │  (Seeds + Live Simulation)       │                          │
│  └──────────────────────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

## AI Pipeline Architecture

```
Stock History (7 days)
        │
        ▼
┌─────────────────────┐
│  Burn Rate Calculator│  ← Linear regression from time-series data
│  (Pure Math)         │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Risk Score (0-100)  │  ← Days-to-stockout × quantity × reorder-level
│  (Pure Math)         │
└────────┬────────────┘
         │
    ┌────┴────┐
    │ LLM?    │
    └────┬────┘
    ┌────┴────┐        ┌───────────────┐
    │ Yes     │───────►│ LLM contextual │──► Adjusted risk + plain-language summary
    └─────────┘        │ assessment     │     (for district health officers)
    │ No      │        └───────────────┘
    └────┬────┘
         │
    ┌────┴────────────┐
    │ Fallback scoring │──► Template-based risk levels
    └─────────────────┘

         │ (At-risk facilities)
         ▼
┌─────────────────────┐
│  Deficit/Surplus     │  ← Identify who needs stock, who has extra
│  Detection           │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Haversine Distance  │  ← Geographic proximity filter (≤200km)
│  Filtering           │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Candidate Ranking   │  ← Urgency(60%) + Feasibility(40%)
│  (urgency × distance)│
└────────┬────────────┘
         │
    ┌────┴────┐
    │ LLM?    │
    └────┬────┘
    ┌────┴────┐        ┌───────────────┐
    │ Yes     │───────►│ LLM reasoning  │──► Explainable transfer recommendations
    └─────────┘        │ over structured│     with plain-language justification
    │ No      │        │ data           │
    └────┬────┘        └───────────────┘
         │
    ┌────┴────────────┐
    │ Fallback template│──► Formulaic recommendations
    └─────────────────┘
```

## Federated Design

PulseCare is designed so each state can run its own instance:

```
State Instance A                    State Instance B
┌────────────────────┐              ┌────────────────────┐
│  Full PulseCare    │              │  Full PulseCare    │
│  - Own Postgres    │              │  - Own Postgres    │
│  - Own Redis       │              │  - Own Redis       │
│  - Own Dashboard   │              │  - Own Dashboard   │
│                    │              │                    │
│  Federated API ────┼──────────────┼── Federated API   │
│  POST /api/federated/demand       │                    │
│  GET  /api/federated/aggregate    │                    │
└────────────────────┘              └────────────────────┘
         │                                    │
         └──────────┬─────────────────────────┘
                    ▼
          National Aggregator
          (Consumes anonymized
           demand patterns only)
```

### Federation Contract

Each state instance exposes:
- `GET /api/federated/aggregate-demand` — Returns anonymized aggregate consumption data
- `POST /api/federated/share-patterns` — Receives demand patterns from other states
- Data shared: **only** aggregate medicine consumption rates, no patient data, no facility-level detail

The `FederatedAggregateDemand` type in `backend/src/types/index.ts` defines this contract.

### Implementation Status

| Feature | Status |
|---------|--------|
| Schema with state partition key | ✅ Implemented |
| State/district filtering on all APIs | ✅ Implemented |
| Federated API contract types | ✅ Defined |
| Cross-instance sync | 📐 Designed (contract documented) |
| National aggregator | 📐 Designed |

## Tech Stack

- **Backend**: Node.js + TypeScript + Fastify
- **Database**: PostgreSQL (schema ready for pgvector if embeddings needed)
- **Real-time**: Redis Streams + WebSocket
- **AI**: Direct Gemini/OpenAI/Anthropic API calls (no LangChain, no orchestration frameworks)
- **Frontend**: React (Vite) + Tailwind CSS v4 + Recharts
- **Testing**: Jest + SWC (33 tests)

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ (create database: `CREATE DATABASE pulsecare;`)
- Redis 7+

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your DB/Redis credentials and optionally an AI API key

npm install

# Full dev setup: reset DB + seed 25 facilities + start live simulation
npm run dev:seed

# Or step-by-step:
npm run seed:reset     # Drop tables, migrate, seed data
npm run dev            # Start server only
npm run dev:simulate   # Start with live data simulation
```

### Frontend

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
# Opens at http://localhost:5173
```

### Running Tests

```bash
cd backend
npm test              # 33 tests, <1s
npm run test:watch    # Watch mode
```

### Triggering AI Pipelines

```bash
# Via API (works without frontend)
curl -X POST http://localhost:3001/api/ai/forecast
curl -X POST http://localhost:3001/api/ai/redistribute
curl -X POST http://localhost:3001/api/ai/run-all

# Or use the AI Engine panel in the dashboard UI
```

## Project Structure

```
PulseCare/
├── backend/
│   └── src/
│       ├── server.ts                  # Main entry (--reset --seed --simulate flags)
│       ├── db/
│       │   ├── pool.ts                # PostgreSQL connection pool
│       │   └── migrations.ts          # 8-table schema
│       ├── redis/
│       │   └── client.ts              # Redis client + stream helpers
│       ├── routes/
│       │   ├── ingestion.ts           # Stock/bed/attendance ingest API
│       │   ├── dashboard.ts           # Dashboard query API (filtered)
│       │   └── ai.ts                  # Forecasting + redistribution triggers
│       ├── ai/
│       │   ├── llm-client.ts          # Direct LLM API (Gemini/OpenAI/Anthropic)
│       │   ├── forecasting.ts         # Burn-rate + risk scoring + LLM assessment
│       │   └── redistribution.ts      # Surplus/deficit + distance + LLM reasoning
│       ├── realtime/
│       │   └── websocket.ts           # WS server + Redis stream consumer
│       ├── seed/
│       │   ├── generator.ts           # 25 PHCs, 10 medicines, staff, beds
│       │   ├── simulator.ts           # Live stock depletion + restocks
│       │   └── run-seed.ts            # Standalone seed script
│       ├── types/
│       │   └── index.ts               # All types + federated contract
│       └── __tests__/
│           ├── forecasting.test.ts    # 17 tests: burn-rate, risk score
│           └── redistribution.test.ts # 16 tests: distance, candidates
├── frontend/
│   └── src/
│       ├── App.tsx                    # Main dashboard layout
│       ├── index.css                  # Dark glassmorphism theme
│       ├── components/
│       │   ├── Header.tsx             # Filters, live indicator
│       │   ├── StatsOverview.tsx      # KPI cards with animated counters
│       │   ├── AIControlPanel.tsx     # Forecast/redistribute triggers
│       │   ├── StockHeatmap.tsx       # Facility × medicine heatmap
│       │   ├── BedOccupancy.tsx       # Occupancy bar chart
│       │   ├── AttendancePanel.tsx    # Donut chart + warnings
│       │   ├── AlertsPanel.tsx        # Severity-sorted alerts
│       │   ├── RedistributionPanel.tsx # AI recommendation cards (centerpiece)
│       │   ├── DistrictSummary.tsx    # District bar + radar charts
│       │   └── LiveFeed.tsx           # Real-time event log
│       ├── hooks/
│       │   └── useWebSocket.ts        # Auto-reconnecting WS hook
│       └── services/
│           └── api.ts                 # Typed API client
└── README.md                          # This file
```

## API Reference

### Ingestion
- `POST /api/ingest/stock` — Update medicine stock
- `POST /api/ingest/beds` — Update bed occupancy
- `POST /api/ingest/attendance` — Record attendance
- `POST /api/ingest/stock/bulk` — Bulk stock update

### Dashboard
- `GET /api/facilities` — All facilities with bed status
- `GET /api/facilities/:id` — Facility detail
- `GET /api/dashboard/stock-summary` — Stock by facility (?state=&district=)
- `GET /api/dashboard/bed-summary` — Bed occupancy (?state=&district=)
- `GET /api/dashboard/attendance-summary` — Attendance (?state=&district=)
- `GET /api/alerts` — Active alerts (?resolved=&limit=)
- `GET /api/redistributions` — Transfer recommendations (?status=)
- `GET /api/filters` — Available states/districts

### AI
- `POST /api/ai/forecast` — Run forecasting pipeline
- `POST /api/ai/redistribute` — Run redistribution pipeline
- `POST /api/ai/run-all` — Run both pipelines

### System
- `GET /api/health` — Health check
- `ws://host/ws` — WebSocket for real-time updates

## License

MIT
