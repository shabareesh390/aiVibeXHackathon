# ⚡ Dequeue

> **Smart Campus Canteen Queue Busting & Real-Time Kitchen Orchestration**  
> *Transforming peak-hour college canteen chaos into seamless, zero-wait meal pickups.*

[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TanStack Router](https://img.shields.io/badge/TanStack-Router%20%26%20Start-FF4154?logo=tanstack)](https://tanstack.com/router)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Zustand](https://img.shields.io/badge/State-Zustand-443e38)](https://github.com/pmndrs/zustand)
[![Vitest](https://img.shields.io/badge/Tested_with-Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)

---

## 📌 The Problem

During 15-minute lecture breaks, 200+ students rush into the college canteen simultaneously:
- **Massive Queues:** 10–12 minutes wasted standing at the billing counter just to get a paper token.
- **Kitchen Bottlenecks:** Kitchen staff get overwhelmed with unbatched orders across disjoint stations (e.g., tawa, fryer, beverages).
- **Cold Food & Missed Classes:** Students wait around crowded counters not knowing when their food will be ready, leading to abandoned orders or late attendance.

---

## 💡 The Solution

**Dequeue** is an end-to-end canteen ordering and kitchen management system built specifically for high-density campus environments. It bridges the gap between hungry students and fast-paced kitchen staff through conversational NLP ordering, dynamic load-balanced pickup slots, and intelligent station batching.

```
       [ Student ]                                    [ Kitchen Crew ]
  Types in Hinglish / Voice                      Receives Auto-Batched Tasks
 "2 masala dosa, ek cold coffee"                     Grouped by Station & Slot
              │                                                ▲
              ▼                                                │
   ┌──────────────────────┐    Calculates Load     ┌──────────────────────┐
   │ NLP Intent & Entity  │ ─────────────────────► │ Capacity & Slot      │
   │ Parser (Hinglish/EN) │   (Green/Amber/Red)    │ Allocator (5m Slots) │
   └──────────────────────┘                        └──────────────────────┘
              │                                                │
              ▼                                                ▼
     Real-Time Token &                                Manager Analytics
   Live Pickup Countdown                              & Demand Heatmaps
```

---

## ✨ Key Features

### 1. 🗣️ Conversational Hinglish & Natural Language Ordering
- Type or speak naturally: *"2 masala dosa bina pyaaz and ek cold coffee 1:15 tak"*.
- **Entity & Quantity Extraction:** Recognizes Hindi/Hinglish and English numerals (`ek`, `do`, `teen`, `single`, `couple`, `char`, `paanch`).
- **Modifier Detection:** Extracts customizations like `bina pyaaz`, `extra butter`, `less spicy`, `without ice`.
- **Family Disambiguation:** Asks smart clarifying questions when input is ambiguous (e.g., typing *"dosa"* prompts *"Which dosa? Plain, Masala, or Cheese Onion?"*).
- **Requested Ready-By Time:** Automatically infers target pickup slots from natural phrases (`"1:15 tak"`, `"in 10 mins"`).

### 2. ⏱️ Dynamic Slot Allocation & Kitchen Load Engine
- Divides time into **5-minute pickup windows**.
- Tracks real-time throughput across four independent kitchen preparation stations:
  - 🍳 **Tawa Station:** Dosa, uttapam, parottas (governed by hotplate surface area).
  - 🍟 **Fryer Station:** Samosas, vadas, cutlets, french fries (governed by oil vat batch limits).
  - ☕ **Beverage Station:** Filter coffee, chai, cold coffee, shakes (high-throughput liquid bar).
  - 📦 **Packing Station:** Final assembly, quality check, bagging, and handoff.
- **Color-Coded Load Thresholds:**
  - 🟢 **Green (< 60% load):** Fast prep, immediate pickup window recommended.
  - 🟡 **Amber (60% – 85% load):** Busy, slots filling up quickly.
  - 🔴 **Red (> 85% load):** Capped capacity; safely routes next orders to the subsequent slot to prevent kitchen meltdowns.

### 3. 🍳 Kitchen Display System (KDS) & Smart Batching
- Tablet-optimized view designed specifically for kitchen staff.
- Aggregates disparate orders into consolidated cooking batches (e.g., *"Make 6 Masala Dosas now"* rather than 6 individual tickets).
- Single-tap status transitions: `Queued` ➔ `In Progress` ➔ `Ready`.

### 4. 📱 Live Student Tracking & Token Handoff
- Clean, mobile-friendly order status dashboard.
- Live countdown timer with estimated ready time and token number.
- Push/visual notifications alert students the exact second their order arrives at the pickup counter.

### 5. 📊 Manager Dashboard & Demand Forecasting
- Live load distribution across all stations.
- Station throughput metrics and revenue tracking.
- Instant menu controls: toggle availability or update stock counts with immediate cross-system propagation.

---

## 🛠️ Tech Stack & Architecture

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Framework** | [React 19](https://react.dev/) + [TanStack Start](https://tanstack.com/start) | Modern full-stack React framework with SSR and streaming capabilities |
| **Routing** | [TanStack Router](https://tanstack.com/router) | 100% type-safe, file-based routing with integrated loaders and error boundaries |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) | Next-generation utility-first CSS engine |
| **UI Components** | [Radix UI](https://www.radix-ui.com/) + [Lucide Icons](https://lucide.dev/) | Accessible, unstyled UI primitives and icon set |
| **State Management** | [Zustand](https://github.com/pmndrs/zustand) | Lightweight reactive store with `localStorage` persistence and cross-tab `BroadcastChannel` synchronization |
| **Data & Backend** | [Supabase](https://supabase.com/) ready | Clean service layer pattern (`src/services/*`) with swappable mock/live APIs |
| **Testing** | [Vitest](https://vitest.dev/) + Testing Library | Blazing fast unit and integration test runner |

### Architecture Guidelines
- **Decoupled Data Layer:** All data mutations flow through typed asynchronous functions in `src/services/*`. UI components never mutate stores directly, keeping database and backend integrations seamlessly swappable.
- **Client Synchronization:** The Zustand store boots client-side (`useAppReady`) and broadcasts state changes across all browser tabs via `BroadcastChannel`, allowing simultaneous simulation of Student, Kitchen, and Manager views in real time.
- **Deterministic Load Logic:** Slot capacity and station limits are centralized exclusively in `src/lib/load.ts` and `src/lib/planning.ts`.

---

## 📂 Project Structure

```text
aiVibeXHackathon/
├── src/
│   ├── components/
│   │   ├── dq/               # Dequeue domain components (Logo, LoadBadge, CartList, etc.)
│   │   └── ui/               # Radix UI + Tailwind primitives (Button, Dialog, Sheet, etc.)
│   ├── hooks/                # Custom React hooks (useMobile, etc.)
│   ├── lib/                  # Core algorithms (planning.ts, load.ts, time.ts, utils.ts)
│   ├── mock/                 # Realistic campus menu seed data & initial station states
│   ├── routes/               # TanStack file-based routes
│   │   ├── index.tsx         # Role selection portal (Student / Kitchen / Manager)
│   │   ├── student/          # Student ordering, slot selection, and order tracking
│   │   ├── kitchen.tsx       # Kitchen Display System (KDS) tablet view
│   │   └── manager/          # Manager dashboard, demand analytics, and menu management
│   ├── services/             # Typed API services (orderService, menuService, parser, etc.)
│   ├── store/                # Zustand stores (appStore, sessionStore)
│   ├── test/                 # Vitest test suites (planning algorithms, routing tests)
│   └── views/                # Role-specific view components
├── package.json
└── vite.config.ts
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v20.x or later recommended; v26.x supported)
- **npm** (v10+ or v11+)

### 1. Clone & Install
```bash
git clone https://github.com/shabareesh390/aiVibeXHackathon.git
cd aiVibeXHackathon
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Run Tests
```bash
npm test
```

### 4. Build for Production
```bash
npm run build
npm run preview
```

---

## 👥 User Roles Walkthrough

1. **Student (`/student/order`)**:
   - Choose your persona or enter your name.
   - Use the natural language input bar to order in plain English or Hinglish.
   - Select an available 5-minute pickup slot (guided by green/amber load badges).
   - Track your order live with real-time countdown to collection.

2. **Kitchen Staff (`/kitchen`)**:
   - View aggregated, batched tickets divided by preparation station (Tawa, Fryer, Beverage, Packing).
   - Mark batches as cooking or completed to update student statuses instantly.

3. **Manager (`/manager/dashboard`)**:
   - Monitor live queue health, station loads, and peak-hour demand trends.
   - Manage real-time menu availability and out-of-stock toggles.

---

## 👥 Contributors

- **Shabareesh S Gowda**
- **Samahith Jain**
- **Jnanesh Gowda**

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
