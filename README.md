# 🌟 fam-kit - Gemini-Powered Family Organizer PWA

An ultra-responsive, AnyList-inspired family organizer and grocery manager powered by **Gemini 3.6 Flash**, **Vite**, **React 19**, **Tailwind CSS**, and **SQLite (`sql.js` WASM)**.

![fam-kit](https://img.shields.io/badge/Gemini_3.6_Flash-Multimodal_AI-10b981?style=for-the-badge)
![React 19](https://img.shields.io/badge/React_19-Vite_6-3b82f6?style=for-the-badge)
![PWA](https://img.shields.io/badge/PWA-Installable-ec4899?style=for-the-badge)
![SQLite](https://img.shields.io/badge/SQLite-sql.js_WASM-f59e0b?style=for-the-badge)

---

## ✨ Features

- 🤖 **Multimodal AI Assistant (Gemini 3.6 Flash)**
  - Real-time Speech-to-Text (STT) and Text-to-Speech (TTS) voice conversations.
  - Image recognition: upload photos of your fridge, handwritten recipes, or grocery receipts.
  - Autonomous function calling: schedules calendar events, adds groceries, and plans meals directly.

- 🛒 **AnyList-Style Categorized Grocery Lists**
  - Grouped by store aisles with department color accents.
  - **Rearrange Store Aisles**: Customize aisle order to match your local supermarket layout.
  - **In-Store Shopping Mode**: Large interactive checkboxes, cross-off animations, and completed section.
  - Custom checklists (e.g. Costco, Home Depot, Packing Lists).

- 🍲 **Weekly Meal Planner & Recipe Link Importer**
  - 7-Day matrix (Breakfast, Lunch, Dinner, Snacks).
  - **Recipe Web Importer**: Extracts Schema.org JSON-LD and meta tags from any cooking website.
  - **1-Tap Export**: Automatically adds missing ingredients from the weekly plan to your grocery list.
  - **Cook Mode**: Step-by-step interactive cooking assistant with keep-awake and checklist.

- 📅 **Shared Family Calendar**
  - Week and Month views with color-coded member tags (Mom, Dad, Maya, Leo).
  - AI Assistant scheduling and clash detection.

- 👨‍👩‍👧‍👦 **Family Household Sharing**
  - Instant join with a 6-character invite code (`FAMKIT`).
  - Web Push notifications for grocery updates and calendar alerts.

- 📱 **Fast & Installable PWA**
  - Sub-millisecond response times, offline support via Service Worker, and mobile home-screen installable.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file:
```env
GEMINI_API_KEY=your_gemini_api_key_here
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🚢 Deployment (Render.com)

1. Connect your GitHub repository (`joshuaburkhalter/fam-kit`) to Render.com.
2. Select **Web Service** or use the included `render.yaml`.
3. Set Build Command: `npm install && npm run build`
4. Set Start Command: `npm start`
5. Add `GEMINI_API_KEY` to your Render environment variables.
