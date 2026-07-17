import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCdrT97GXYoA7LNr5f39uRHuyNCeGfSJa4",
  authDomain: "waretrack-86cf0.firebaseapp.com",
  projectId: "waretrack-86cf0",
  storageBucket: "waretrack-86cf0.firebasestorage.app",
  messagingSenderId: "298683388454",
  appId: "1:298683388454:web:6f2c561dc0029a3ea64ce7",
  measurementId: "G-2GHTTSJ44E"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const mockItems = [
  { sku: 'PROD-001', name: 'Industrial Steel Pipe', category: 'Steel Alloys', quantity: 45, price: 29.99, location: 'Bin A-12', min_threshold: 10 },
  { sku: 'PROD-002', name: 'Copper Wire Spool 50m', category: 'Electrical', quantity: 8, price: 45.50, location: 'Shelf B-04', min_threshold: 15 },
  { sku: 'PROD-003', name: 'Heavy Duty Caster Wheel', category: 'Hardware', quantity: 120, price: 12.99, location: 'Aisle C-01', min_threshold: 20 },
  { sku: 'PROD-004', name: 'Lithium-Ion Battery Pack', category: 'Electrical', quantity: 18, price: 89.99, location: 'Locker E-08', min_threshold: 5 },
  { sku: 'PROD-005', name: 'Pneumatic Valve Assembly', category: 'Hydraulics', quantity: 32, price: 150.00, location: 'Shelf D-02', min_threshold: 8 },
  { sku: 'PROD-006', name: 'Aluminum Angle Bar 2m', category: 'Steel Alloys', quantity: 75, price: 18.50, location: 'Bin A-15', min_threshold: 15 },
  { sku: 'PROD-007', name: 'Optical Sensor Bracket', category: 'Hardware', quantity: 4, price: 8.75, location: 'Aisle C-04', min_threshold: 10 }
];

const mockTx = [
  { sku: 'PROD-001', change_qty: 45, type: 'INBOUND', timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() },
  { sku: 'PROD-002', change_qty: 20, type: 'INBOUND', timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
  { sku: 'PROD-002', change_qty: -12, type: 'OUTBOUND', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
  { sku: 'PROD-003', change_qty: 120, type: 'INBOUND', timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
  { sku: 'PROD-004', change_qty: 18, type: 'INBOUND', timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
  { sku: 'PROD-005', change_qty: 32, type: 'INBOUND', timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
  { sku: 'PROD-006', change_qty: 75, type: 'INBOUND', timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() },
  { sku: 'PROD-007', change_qty: 4, type: 'INBOUND', timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() }
];

const mockTasks = [
  { id: 'task-seed-1', title: 'Audit Locker E-08 battery levels', description: 'Double check counts, record details in operations scans.', assigned_to: 'staff@nexus.com', status: 'Pending', created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'task-seed-2', title: 'Reorganize Shelf B-04 copper spools', description: 'Stack wire spools neatly and ensure barcode labels are visible.', assigned_to: 'staff@nexus.com', status: 'In Progress', created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'task-seed-3', title: 'Count caster wheels in Aisle C-01', description: 'Perform end-of-week physical count audit.', assigned_to: 'staff@nexus.com', status: 'Completed', created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() }
];

const mockUsers = [
  { email: 'admin@nexus.com', name: 'Aarav Sharma', role: 'Administrator' },
  { email: 'manager@nexus.com', name: 'Priya Patel', role: 'Warehouse Manager' },
  { email: 'staff@nexus.com', name: 'Rohan Das', role: 'Staff' }
];

async function seed() {
  console.log("🔑 Authenticating with Firebase Cloud...");
  try {
    await signInWithEmailAndPassword(auth, "admin@nexus.com", "admin123");
    console.log("✅ Authenticated successfully as Aarav Sharma.");
  } catch (err) {
    if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
      console.log("ℹ️ Admin account not found in Auth. Provisioning admin credentials...");
      try {
        await createUserWithEmailAndPassword(auth, "admin@nexus.com", "admin123");
        console.log("✅ Admin account created successfully in Auth.");
      } catch (createErr) {
        console.warn("⚠️ Admin provisioning failed:", createErr.message);
      }
    } else {
      console.warn("⚠️ Authentication warning (proceeding in case rules are open):", err.message);
    }
  }

  // 1. Seed Inventory
  console.log("📦 Seeding Inventory Collection...");
  for (const item of mockItems) {
    const docRef = doc(db, "inventory", item.sku);
    await setDoc(docRef, {
      ...item,
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    });
    console.log(`   + SKU: ${item.sku} Added`);
  }

  // 2. Seed Transactions
  console.log("📋 Seeding Transactions Collection...");
  for (let i = 0; i < mockTx.length; i++) {
    const tx = mockTx[i];
    const item = mockItems.find(it => it.sku === tx.sku);
    const sync_id = `seed-${tx.sku}-${i}`;
    const docRef = doc(db, "transactions", sync_id);
    
    await setDoc(docRef, {
      sku: tx.sku,
      item_name: item ? item.name : "Unknown Item",
      type: tx.type,
      change_qty: tx.change_qty,
      user_email: "admin@nexus.com",
      user_name: "Aarav Sharma (Seed)",
      timestamp: tx.timestamp,
      sync_id
    });
    console.log(`   + Tx: ${sync_id} Added`);
  }

  // 3. Seed Tasks
  console.log("📅 Seeding Tasks Collection...");
  for (const task of mockTasks) {
    const docRef = doc(db, "tasks", task.id);
    await setDoc(docRef, task);
    console.log(`   + Task: ${task.id} Added`);
  }

  // 4. Seed User Directory
  console.log("👥 Seeding User Directory Profiles...");
  for (const user of mockUsers) {
    const docRef = doc(db, "users", user.email);
    await setDoc(docRef, user);
    console.log(`   + User: ${user.email} Registered`);
  }

  console.log("\n🎉 Seeding Completed Successfully! Your cloud database is populated.");
  process.exit(0);
}

seed().catch(err => {
  console.error("❌ Seeding failed with critical error:", err);
  process.exit(1);
});
