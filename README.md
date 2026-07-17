# Nexus Waretrack ERP

An advanced, highly-responsive warehouse operations and inventory management ERP portal. Nexus Waretrack integrates supply metrics, haptic check-in logs, real-time WebSocket activities, and conversational AI assistance into one cohesive dashboard.

## 🚀 Key Features

* 📦 **Dynamic Inventory Stock Control:** Complete CRUD SKU operations, real-time threshold monitoring, and automated low-stock warnings.
* 📊 **Interactive Analytics Dashboard:** Elegant data visualization charting inventory valuation, category asset divisions, and stock volume trends over **24 Hours**, **1 Week**, and **1 Month** intervals.
* 🌲 **Stock Aging Analysis:** Visualized segmentation dividing materials into *Fast Moving Stock*, *Stable Stock*, and *Dead or Slow Stock* pools to optimize bin allocations.
* 🌴 **Leave Request & Moderation Center:** 
  * Staff/Managers can apply for leaves with customized start/end dates and justifications.
  * Admins can approve or reject leaves with moderator remarks.
  * *Automated Sync:* Approving leaves automatically writes daily `"Absent" (On Approved Leave)` logs to the employee's attendance registry.
* ⏰ **Haptic Attendance Logging:** Built-in clock-in/out console calculating duration, late-status markers, manual logging retrospectively, admin overrides, and Excel spreadsheet downloads via SheetJS.
* 🤖 **Nexus AI Assistant Chatbot:** Natural language processor parsing real-time valuation, out-of-stock items, categories, item locations, and weekly summaries.
* 🔑 **Employee Directory & Credentials Bypass:** Admin panel to register workers, promote roles, update names dynamically, and reset staff passwords directly in Firestore (without email dependencies).
* 📱 **Refined Mobile Layouts:** Glassmorphic sidebars, stacked forms, edge-to-edge scalable tables, and responsive tap targets for viewports under `768px`.

## 🛠️ Technology Stack

* **Frontend:** React (TypeScript), Vite, Recharts (Charts), Lucide React (Icons), SheetJS (XLSX Exporting)
* **Database & Auth:** Firebase Firestore (Real-time Cloud Sync) & Firebase Client Authentication Bypass
* **Hosting:** Vercel Production Deployments

## 📦 Setup & Installation

### Prerequisites
* Node.js (v18+)
* npm (v9+)

### Installation Steps
1. **Clone the repository:**
   ```bash
   git clone https://github.com/manojreddye47/ERP_HUB.git
   cd ERP_HUB
   ```

2. **Install Client Dependencies:**
   ```bash
   cd client
   npm install
   ```

3. **Configure Firebase:**
   Ensure the Firebase client SDK config is configured in `client/src/firebase.ts`.

4. **Launch Local Dev Server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

## 👥 Seed Profiles

Use these credentials to preview role-based access control inside the local or production environments:
* **Administrator:** `admin@nexus.com` (Password: `admin123`)
* **Warehouse Manager:** `manager@nexus.com` (Password: `manager123`)
* **Staff Operator:** `staff@nexus.com` (Password: `staff123`)
