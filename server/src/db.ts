import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (db) return db;

  const dbPath = path.resolve(__dirname, '../database.sqlite');
  
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Enable foreign keys
  await db.run('PRAGMA foreign_keys = ON');

  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory (
      sku TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      price REAL NOT NULL DEFAULT 0.0,
      min_threshold INTEGER NOT NULL DEFAULT 0,
      category TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      sku TEXT NOT NULL,
      item_name TEXT NOT NULL,
      type TEXT NOT NULL,
      change_qty INTEGER NOT NULL,
      user_email TEXT NOT NULL,
      user_name TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      sync_id TEXT UNIQUE
    );

    CREATE TABLE IF NOT EXISTS processed_syncs (
      sync_id TEXT PRIMARY KEY,
      processed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      assigned_to TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Seed Users
  const userCount = await db.get('SELECT COUNT(*) as count FROM users');
  if (userCount && userCount.count === 0) {
    await db.run(
      `INSERT INTO users (id, email, password, name, role) VALUES 
       ('u-1', 'admin@nexus.com', 'admin123', 'Aarav Sharma', 'Administrator'),
       ('u-2', 'manager@nexus.com', 'manager123', 'Priya Patel', 'Warehouse Manager'),
       ('u-3', 'staff@nexus.com', 'staff123', 'Rohan Das', 'Staff')`
    );
  }

  // Seed Inventory
  const invCount = await db.get('SELECT COUNT(*) as count FROM inventory');
  if (invCount && invCount.count === 0) {
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

    await db.run(
      `INSERT INTO inventory (sku, name, location, quantity, price, min_threshold, category, created_at) VALUES 
       ('SKU-1001', 'Heavy Duty Steel Bars', 'Bay A-12', 450, 1500.00, 100, 'Raw Materials', '${oneMonthAgo}'),
       ('SKU-1002', 'High-Speed Microprocessors', 'Locker B-03', 80, 4500.00, 150, 'Electronics', '${twoWeeksAgo}'),
       ('SKU-1003', 'Industrial Copper Wires', 'Bay A-05', 1200, 350.00, 300, 'Raw Materials', '${oneMonthAgo}'),
       ('SKU-1004', 'Hydraulic Lift Pumps', 'Bay C-02', 15, 18500.00, 25, 'Machinery', '${threeDaysAgo}'),
       ('SKU-1005', 'Reinforced Aluminum Sheets', 'Bay A-03', 300, 950.00, 50, 'Raw Materials', '${twoWeeksAgo}'),
       ('SKU-1006', 'Programmable Control Panels', 'Locker D-01', 5, 28000.00, 10, 'Electronics', '${threeDaysAgo}')`
    );

    // Seed Transactions
    await db.run(
      `INSERT INTO transactions (id, sku, item_name, type, change_qty, user_email, user_name, timestamp, sync_id) VALUES 
       ('t-1', 'SKU-1001', 'Heavy Duty Steel Bars', 'INBOUND', 450, 'manager@nexus.com', 'Priya Patel', '${oneMonthAgo}', 'sync-init-1'),
       ('t-2', 'SKU-1002', 'High-Speed Microprocessors', 'INBOUND', 100, 'manager@nexus.com', 'Priya Patel', '${twoWeeksAgo}', 'sync-init-2'),
       ('t-3', 'SKU-1002', 'High-Speed Microprocessors', 'OUTBOUND', -20, 'staff@nexus.com', 'Rohan Das', '${twoWeeksAgo}', 'sync-init-3'),
       ('t-4', 'SKU-1003', 'Industrial Copper Wires', 'INBOUND', 1200, 'admin@nexus.com', 'Aarav Sharma', '${oneMonthAgo}', 'sync-init-4'),
       ('t-5', 'SKU-1004', 'Hydraulic Lift Pumps', 'INBOUND', 15, 'manager@nexus.com', 'Priya Patel', '${threeDaysAgo}', 'sync-init-5')`
    );
  }

  // Seed Tasks
  const taskCount = await db.get('SELECT COUNT(*) as count FROM tasks');
  if (taskCount && taskCount.count === 0) {
    const nowStr = new Date().toISOString();
    await db.run(
      `INSERT INTO tasks (id, assigned_to, title, description, status, created_at) VALUES 
       ('task-1', 'staff@nexus.com', 'Recount locker B-03 inventory', 'Verify high-speed microprocessors quantity and location locker details', 'Pending', '${nowStr}'),
       ('task-2', 'staff@nexus.com', 'Organize Bay C-02 shelves', 'Stack the incoming hydraulic lift pumps safely and update signs', 'In Progress', '${nowStr}'),
       ('task-3', 'staff@nexus.com', 'Check copper wire bundle seals', 'Check all 1200 bundles of copper wire in Bay A-05 for moisture seals', 'Completed', '${nowStr}')`
    );
  }

  console.log('SQLite database initialized successfully.');
  return db;
}
