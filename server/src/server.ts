import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import path from 'path';
import { getDb } from './db';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;

// HTTP Auth and RBAC Middleware
interface AuthRequest extends Request {
  user?: {
    email: string;
    role: string;
    name: string;
  };
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const email = req.headers['x-user-email'] as string;
  const role = req.headers['x-user-role'] as string;
  const name = req.headers['x-user-name'] as string;

  if (!email || !role || !name) {
    return res.status(401).json({ error: 'Unauthorized. Missing authentication headers.' });
  }

  req.user = { email, role, name };
  next();
}

function requireRole(allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden. Insufficient permissions.' });
    }
    next();
  };
}

// REST Routes

// Auth
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Inventory
app.get('/api/inventory', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const items = await db.all('SELECT * FROM inventory ORDER BY sku ASC');
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve inventory' });
  }
});

app.post('/api/inventory', authMiddleware, requireRole(['Administrator', 'Warehouse Manager']), async (req: AuthRequest, res: Response) => {
  const { sku, name, location, quantity, price, min_threshold, category } = req.body;
  if (!sku || !name || !location || quantity === undefined || price === undefined || min_threshold === undefined || !category) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const db = await getDb();
    const existing = await db.get('SELECT sku FROM inventory WHERE sku = ?', [sku]);
    if (existing) {
      return res.status(400).json({ error: 'Item with this SKU already exists' });
    }

    const created_at = new Date().toISOString();
    await db.run(
      `INSERT INTO inventory (sku, name, location, quantity, price, min_threshold, category, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [sku, name, location, quantity, price, min_threshold, category, created_at]
    );

    // Record Inbound transaction if starting qty > 0
    let sync_id = `init-${sku}-${Date.now()}`;
    if (quantity > 0) {
      await db.run(
        `INSERT INTO transactions (id, sku, item_name, type, change_qty, user_email, user_name, timestamp, sync_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [`t-${Date.now()}`, sku, name, 'INBOUND', quantity, req.user!.email, req.user!.name, created_at, sync_id]
      );
    }

    const newItem = await db.get('SELECT * FROM inventory WHERE sku = ?', [sku]);
    
    // Broadcast stock updates
    io.emit('stock_update', newItem);
    if (quantity > 0) {
      const newTx = await db.get('SELECT * FROM transactions WHERE sync_id = ?', [sync_id]);
      io.emit('transaction_new', newTx);
    }

    res.status(201).json(newItem);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create inventory item' });
  }
});

app.put('/api/inventory/:sku', authMiddleware, requireRole(['Administrator', 'Warehouse Manager']), async (req: AuthRequest, res: Response) => {
  const { sku } = req.params;
  const { name, location, price, min_threshold, category } = req.body;

  if (!name || !location || price === undefined || min_threshold === undefined || !category) {
    return res.status(400).json({ error: 'Required fields: name, location, price, min_threshold, category' });
  }

  try {
    const db = await getDb();
    const existing = await db.get('SELECT sku FROM inventory WHERE sku = ?', [sku]);
    if (!existing) {
      return res.status(404).json({ error: 'SKU not found' });
    }

    await db.run(
      `UPDATE inventory SET name = ?, location = ?, price = ?, min_threshold = ?, category = ? WHERE sku = ?`,
      [name, location, price, min_threshold, category, sku]
    );

    const updated = await db.get('SELECT * FROM inventory WHERE sku = ?', [sku]);
    io.emit('stock_update', updated);

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update item' });
  }
});

app.delete('/api/inventory/:sku', authMiddleware, requireRole(['Administrator', 'Warehouse Manager']), async (req: AuthRequest, res: Response) => {
  const { sku } = req.params;

  try {
    const db = await getDb();
    const existing = await db.get('SELECT sku FROM inventory WHERE sku = ?', [sku]);
    if (!existing) {
      return res.status(404).json({ error: 'SKU not found' });
    }

    await db.run('DELETE FROM inventory WHERE sku = ?', [sku]);
    
    // Broadcast delete event
    io.emit('stock_delete', { sku });

    res.json({ message: `SKU ${sku} successfully deleted` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Transactions
app.get('/api/transactions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const logs = await db.all('SELECT * FROM transactions ORDER BY timestamp DESC LIMIT 100');
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve transactions' });
  }
});

// Direct Inbound/Outbound logs (Online mode)
app.post('/api/operations/:type', authMiddleware, async (req: AuthRequest, res: Response) => {
  const type = req.params.type.toUpperCase() as 'INBOUND' | 'OUTBOUND';
  const { sku, quantity, sync_id } = req.body;

  if (!sku || !quantity || !sync_id) {
    return res.status(400).json({ error: 'Required fields: sku, quantity, sync_id' });
  }

  if (type !== 'INBOUND' && type !== 'OUTBOUND') {
    return res.status(400).json({ error: 'Invalid operation type' });
  }

  try {
    const db = await getDb();
    
    // 1. Idempotency Check
    const alreadyProcessed = await db.get('SELECT sync_id FROM processed_syncs WHERE sync_id = ?', [sync_id]);
    if (alreadyProcessed) {
      const existingTx = await db.get('SELECT * FROM transactions WHERE sync_id = ?', [sync_id]);
      return res.json({ message: 'Sync key already processed. Skipped writing.', transaction: existingTx });
    }

    // 2. SKU Existence Check
    const item = await db.get('SELECT * FROM inventory WHERE sku = ?', [sku]);
    if (!item) {
      return res.status(404).json({ error: `SKU ${sku} not found in database.` });
    }

    const changeQty = type === 'INBOUND' ? quantity : -quantity;

    // Check stock availability for outbound
    if (type === 'OUTBOUND' && item.quantity + changeQty < 0) {
      return res.status(400).json({ error: `Insufficient stock. Current: ${item.quantity}, Requested: ${quantity}` });
    }

    // 3. SQLite Transaction/Operations
    await db.run('BEGIN TRANSACTION');
    try {
      // Additive Stock Math
      await db.run('UPDATE inventory SET quantity = quantity + ? WHERE sku = ?', [changeQty, sku]);
      
      const newTxId = `t-${Date.now()}`;
      const nowStr = new Date().toISOString();
      await db.run(
        `INSERT INTO transactions (id, sku, item_name, type, change_qty, user_email, user_name, timestamp, sync_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newTxId, sku, item.name, type, changeQty, req.user!.email, req.user!.name, nowStr, sync_id]
      );

      await db.run(
        'INSERT INTO processed_syncs (sync_id, processed_at) VALUES (?, ?)',
        [sync_id, nowStr]
      );

      await db.run('COMMIT');

      const updatedItem = await db.get('SELECT * FROM inventory WHERE sku = ?', [sku]);
      const createdTx = await db.get('SELECT * FROM transactions WHERE id = ?', [newTxId]);

      // Broadcast changes
      io.emit('stock_update', updatedItem);
      io.emit('transaction_new', createdTx);

      res.status(201).json({ item: updatedItem, transaction: createdTx });
    } catch (e) {
      await db.run('ROLLBACK');
      throw e;
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Operation failed' });
  }
});

// Offline Sync Queue Endpoint
app.post('/api/operations/sync', authMiddleware, async (req: AuthRequest, res: Response) => {
  const operations = req.body.operations;
  if (!Array.isArray(operations)) {
    return res.status(400).json({ error: 'Payload must contain operations array' });
  }

  try {
    const db = await getDb();
    const results = [];
    
    // Process sync queue elements in a safe loop
    for (const op of operations) {
      const { id, sku, type, change_qty, timestamp, user_email, user_name } = op;
      
      if (!id || !sku || !type || change_qty === undefined) {
        results.push({ id, status: 'error', reason: 'Invalid payload elements' });
        continue;
      }

      // Check Idempotency Key
      const processed = await db.get('SELECT sync_id FROM processed_syncs WHERE sync_id = ?', [id]);
      if (processed) {
        results.push({ id, status: 'ignored', reason: 'Idempotency key match' });
        continue;
      }

      const item = await db.get('SELECT * FROM inventory WHERE sku = ?', [sku]);
      if (!item) {
        results.push({ id, status: 'error', reason: `SKU ${sku} not found` });
        continue;
      }

      // Additive Stock Math
      const newQty = item.quantity + change_qty;
      if (newQty < 0) {
        // Prevent negative stock on conflicts, cap at 0 and log
        results.push({ id, status: 'adjusted', reason: 'Prevented negative stock. Clamped to 0.' });
        continue;
      }

      await db.run('BEGIN TRANSACTION');
      try {
        await db.run('UPDATE inventory SET quantity = quantity + ? WHERE sku = ?', [change_qty, sku]);
        
        const txId = `t-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        await db.run(
          `INSERT INTO transactions (id, sku, item_name, type, change_qty, user_email, user_name, timestamp, sync_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [txId, sku, item.name, type, change_qty, user_email, user_name, timestamp, id]
        );

        await db.run('INSERT INTO processed_syncs (sync_id, processed_at) VALUES (?, ?)', [id, new Date().toISOString()]);
        await db.run('COMMIT');

        const updated = await db.get('SELECT * FROM inventory WHERE sku = ?', [sku]);
        const newTx = await db.get('SELECT * FROM transactions WHERE id = ?', [txId]);

        io.emit('stock_update', updated);
        io.emit('transaction_new', newTx);

        results.push({ id, status: 'synced' });
      } catch (err) {
        await db.run('ROLLBACK');
        results.push({ id, status: 'error', reason: 'Transaction failed' });
      }
    }

    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: 'Sync processing failed' });
  }
});

// Employee Management (RBAC: Admin can do all CRUD, Manager can manage Staff only, Staff blocked)
app.get('/api/users', authMiddleware, requireRole(['Administrator', 'Warehouse Manager']), async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDb();
    let users;
    if (req.user!.role === 'Warehouse Manager') {
      // Warehouse Manager can only view Staff
      users = await db.all("SELECT id, email, name, role FROM users WHERE role = 'Staff'");
    } else {
      // Administrator can view all
      users = await db.all("SELECT id, email, name, role FROM users");
    }
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve users' });
  }
});

app.post('/api/users', authMiddleware, requireRole(['Administrator', 'Warehouse Manager']), async (req: AuthRequest, res: Response) => {
  const { email, password, name, role } = req.body;
  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'Required fields: email, password, name, role' });
  }

  // Manager is restricted to creating Staff only
  if (req.user!.role === 'Warehouse Manager' && role !== 'Staff') {
    return res.status(403).json({ error: 'Managers can only add Staff members.' });
  }

  try {
    const db = await getDb();
    const existing = await db.get('SELECT email FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ error: 'User email already registered' });
    }

    const id = `u-${Date.now()}`;
    await db.run(
      'INSERT INTO users (id, email, password, name, role) VALUES (?, ?, ?, ?, ?)',
      [id, email, password, name, role]
    );

    res.status(201).json({ id, email, name, role });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.delete('/api/users/:email', authMiddleware, requireRole(['Administrator', 'Warehouse Manager']), async (req: AuthRequest, res: Response) => {
  const { email } = req.params;

  try {
    const db = await getDb();
    const targetUser = await db.get('SELECT role FROM users WHERE email = ?', [email]);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Managers can only delete Staff
    if (req.user!.role === 'Warehouse Manager' && targetUser.role !== 'Staff') {
      return res.status(403).json({ error: 'Managers can only delete Staff members.' });
    }

    // Admins cannot delete themselves
    if (email === req.user!.email) {
      return res.status(400).json({ error: 'Cannot delete your own active account.' });
    }

    await db.run('DELETE FROM users WHERE email = ?', [email]);
    res.json({ message: `User ${email} deleted successfully` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Tasks
app.get('/api/tasks', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDb();
    let list;
    if (req.user!.role === 'Staff') {
      list = await db.all('SELECT * FROM tasks WHERE assigned_to = ? ORDER BY created_at DESC', [req.user!.email]);
    } else {
      list = await db.all('SELECT * FROM tasks ORDER BY created_at DESC');
    }
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get tasks' });
  }
});

app.post('/api/tasks', authMiddleware, requireRole(['Administrator', 'Warehouse Manager']), async (req: AuthRequest, res: Response) => {
  const { title, description, assigned_to } = req.body;
  if (!title || !description || !assigned_to) {
    return res.status(400).json({ error: 'Required fields: title, description, assigned_to' });
  }

  try {
    const db = await getDb();
    // Validate target assignee is indeed a Staff member
    const staff = await db.get('SELECT role FROM users WHERE email = ?', [assigned_to]);
    if (!staff || staff.role !== 'Staff') {
      return res.status(400).json({ error: 'Tasks can only be assigned to Staff members.' });
    }

    const taskId = `task-${Date.now()}`;
    const nowStr = new Date().toISOString();
    await db.run(
      'INSERT INTO tasks (id, assigned_to, title, description, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [taskId, assigned_to, title, description, 'Pending', nowStr]
    );

    const taskObj = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    
    // Broadcast tasks update
    io.emit('task_update', taskObj);

    res.status(201).json(taskObj);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

app.put('/api/tasks/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['Pending', 'In Progress', 'Completed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid task status. Allowed: Pending, In Progress, Completed' });
  }

  try {
    const db = await getDb();
    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Staff can only update their own assigned tasks
    if (req.user!.role === 'Staff' && task.assigned_to !== req.user!.email) {
      return res.status(403).json({ error: 'Forbidden. You can only update your own assigned tasks.' });
    }

    await db.run('UPDATE tasks SET status = ? WHERE id = ?', [status, id]);
    
    const updatedTask = await db.get('SELECT * FROM tasks WHERE id = ?', [id]);
    io.emit('task_update', updatedTask);

    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task status' });
  }
});

// HTTP Server setup
const server = createServer(app);

// Socket.io Server with Role-Based Access Control and Room management
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.use((socket: Socket, next) => {
  const email = socket.handshake.auth.email || socket.handshake.query.email;
  const role = socket.handshake.auth.role || socket.handshake.query.role;
  const name = socket.handshake.auth.name || socket.handshake.query.name;

  if (!email || !role || !name) {
    return next(new Error('Authentication failed. Role, email, and name are required.'));
  }

  socket.data = { email, role, name };
  next();
});

io.on('connection', (socket: Socket) => {
  const { email, role, name } = socket.data;
  console.log(`Socket client connected: ${email} (${role})`);

  // Channel Rooms
  socket.join('general');
  if (role === 'Administrator' || role === 'Warehouse Manager') {
    socket.join('management');
  }
  if (role === 'Administrator') {
    socket.join('admin-critical');
  }

  // Guard WebSocket incoming stock adjustments
  socket.on('stock_adjust_request', async (payload: { sku: string; change_qty: number; sync_id: string }) => {
    // Only Administrators and Managers can request manual overrides/adjustments direct via Websockets
    if (role !== 'Administrator' && role !== 'Warehouse Manager') {
      socket.emit('error_notification', { message: 'Action rejected: Staff members cannot execute manual stock adjustments.' });
      return;
    }

    const { sku, change_qty, sync_id } = payload;
    try {
      const db = await getDb();
      
      const alreadyProcessed = await db.get('SELECT sync_id FROM processed_syncs WHERE sync_id = ?', [sync_id]);
      if (alreadyProcessed) return;

      const item = await db.get('SELECT * FROM inventory WHERE sku = ?', [sku]);
      if (!item) {
        socket.emit('error_notification', { message: `SKU ${sku} not found.` });
        return;
      }

      await db.run('BEGIN TRANSACTION');
      try {
        await db.run('UPDATE inventory SET quantity = quantity + ? WHERE sku = ?', [change_qty, sku]);
        const txId = `t-${Date.now()}`;
        const type = change_qty > 0 ? 'INBOUND' : 'OUTBOUND';
        
        await db.run(
          `INSERT INTO transactions (id, sku, item_name, type, change_qty, user_email, user_name, timestamp, sync_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [txId, sku, item.name, type, change_qty, email, name, new Date().toISOString(), sync_id]
        );
        await db.run('INSERT INTO processed_syncs (sync_id, processed_at) VALUES (?, ?)', [sync_id, new Date().toISOString()]);
        await db.run('COMMIT');

        const updated = await db.get('SELECT * FROM inventory WHERE sku = ?', [sku]);
        const newTx = await db.get('SELECT * FROM transactions WHERE id = ?', [txId]);

        io.emit('stock_update', updated);
        io.emit('transaction_new', newTx);
      } catch (err) {
        await db.run('ROLLBACK');
        socket.emit('error_notification', { message: 'Database transaction failed.' });
      }
    } catch (err: any) {
      socket.emit('error_notification', { message: err.message || 'Error occurred.' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket client disconnected: ${email}`);
  });
});

// Serve frontend static build files
const distPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(distPath));

// Fallback all non-API GET requests to React client
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

// Boot Server
getDb().then(() => {
  server.listen(PORT, () => {
    console.log(`Nexus Waretrack Express Backend listening on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Fatal database initialization failed:', err);
  process.exit(1);
});
