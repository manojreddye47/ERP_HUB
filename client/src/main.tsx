import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { ToastProvider, useToast } from './components/Toast';
import Login from './views/Login';
import Dashboard from './views/Dashboard';
import Inventory from './views/Inventory';
import Operations from './views/Operations';
import Employees from './views/Employees';
import { Attendance } from './views/Attendance';
import Chatbot from './components/Chatbot';
import './index.css';
import { 
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, 
  increment, query, orderBy, limit, where 
} from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { 
  LayoutDashboard, Package, RefreshCw, Users, CheckSquare, Calendar, LogOut, Bell, BellOff, Menu, X, Sun, Moon, Trash2 
} from 'lucide-react';

interface UserProfile {
  email: string;
  role: string;
  name: string;
}

const App: React.FC = () => {
  const { showToast, isToastEnabled, setToastEnabled } = useToast();
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('nexus-user-session');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.warn("Failed to parse user session, clearing cache:", e);
      localStorage.removeItem('nexus-user-session');
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('nexus-theme');
    return (saved as 'dark' | 'light') || 'dark';
  });

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('nexus-theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [tasksList, setTasksList] = useState<any[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Task Assign Form Fields
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [activeNewTask, setActiveNewTask] = useState<any | null>(null);
  const isFirstTasksLoad = useRef(true);

  // Ascending audio notification tone synthesis using Web Audio API
  const playAlertSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      
      // First tone (C5)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.frequency.setValueAtTime(523.25, audioCtx.currentTime);
      gain1.gain.setValueAtTime(0.08, audioCtx.currentTime);
      osc1.start();
      osc1.stop(audioCtx.currentTime + 0.12);

      // Second tone (E5)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.15);
      gain2.gain.setValueAtTime(0.08, audioCtx.currentTime + 0.15);
      osc2.start(audioCtx.currentTime + 0.15);
      osc2.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      console.warn("Notification audio failed:", e);
    }
  };

  // 1. Session Storage sync
  useEffect(() => {
    if (user) {
      localStorage.setItem('nexus-user-session', JSON.stringify(user));
    } else {
      localStorage.removeItem('nexus-user-session');
    }
  }, [user]);

  // 2. Track connection status
  useEffect(() => {
    const onlineHandler = () => {
      setIsOnline(true);
      showToast('Network online. Synchronizing cloud logs.', 'success');
    };
    const offlineHandler = () => {
      setIsOnline(false);
      showToast('Network offline. Operations running on local disk cache.', 'warning');
    };
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
    return () => {
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
    };
  }, []);

  // 3. Track Firebase Auth state change
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        // Retrieve details from Firestore profile doc
        const email = firebaseUser.email.toLowerCase();
        const userDocRef = doc(db, 'users', email);
        
        onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUser({
              email: data.email || email,
              role: data.role || 'Staff',
              name: data.name || email.split('@')[0]
            });
          }
        }, (err) => {
          console.warn("User doc snapshot error:", err);
        });
      } else {
        // Checked auth and user signed out or null
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // 4. Firestore Database Real-time Snapshot listeners
  useEffect(() => {
    if (!user) return;

    // A. Subscribe to Inventory
    const qInv = query(collection(db, 'inventory'));
    const unsubInv = onSnapshot(qInv, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach((doc) => {
        items.push({ ...doc.data() });
      });
      setInventory(items.sort((a, b) => a.sku.localeCompare(b.sku)));
    }, () => {
      console.warn("Firestore offline warning: inventory snapshot fallback active.");
    });

    // B. Subscribe to Transactions (logs feed)
    const qTx = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'), limit(100));
    const unsubTx = onSnapshot(qTx, (snapshot) => {
      const logs: any[] = [];
      snapshot.forEach((doc) => {
        logs.push({ id: doc.id, ...doc.data() });
      });
      setTransactions(logs);
    }, () => {
      console.warn("Firestore offline warning: transaction snapshot fallback active.");
    });

    // C. Subscribe to Tasks (role specific)
    let qTasks = query(collection(db, 'tasks'));
    if (user.role === 'Staff') {
      qTasks = query(collection(db, 'tasks'), where('assigned_to', '==', user.email));
    }
    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      const tasks: any[] = [];
      snapshot.forEach((doc) => {
        tasks.push({ ...doc.data() });
      });
      const sorted = tasks.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      setTasksList(sorted);

      // Trigger pop-up alert for staff users when a new task is added dynamically
      if (user.role === 'Staff') {
        if (isFirstTasksLoad.current) {
          isFirstTasksLoad.current = false;
        } else {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const taskData = change.doc.data();
              if (taskData && taskData.status === 'Pending') {
                setActiveNewTask(taskData);
                playAlertSound();
              }
            }
          });
        }
      }
    }, (err) => {
      console.warn("Tasks snapshot error:", err);
    });

    // D. Subscribe to Users profile (Admin and Managers only)
    let unsubUsers = () => {};
    if (user.role === 'Administrator' || user.role === 'Warehouse Manager') {
      const qUsers = query(collection(db, 'users'));
      unsubUsers = onSnapshot(qUsers, (snapshot) => {
        const users: any[] = [];
        snapshot.forEach((doc) => {
          users.push({ ...doc.data() });
        });
        setUsersList(users);
      }, (err) => {
        console.warn("Users list snapshot error:", err);
      });
    }

    return () => {
      unsubInv();
      unsubTx();
      unsubTasks();
      unsubUsers();
    };
  }, [user]);

  // 5. Firestore operations CRUD triggers
  const handleAddSku = async (item: any): Promise<boolean> => {
    try {
      const created_at = new Date().toISOString();
      const skuDocRef = doc(db, 'inventory', item.sku);
      
      // Save item
      await setDoc(skuDocRef, {
        sku: item.sku,
        name: item.name,
        location: item.location,
        quantity: item.quantity,
        price: item.price,
        min_threshold: item.min_threshold,
        category: item.category,
        vendor_name: item.vendor_name || '',
        vendor_email: item.vendor_email || '',
        created_at
      });

      // Record Inbound transaction if quantity > 0
      if (item.quantity > 0) {
        const sync_id = `init-${item.sku}-${Date.now()}`;
        const txDocRef = doc(db, 'transactions', sync_id);
        await setDoc(txDocRef, {
          sku: item.sku,
          item_name: item.name,
          type: 'INBOUND',
          change_qty: item.quantity,
          user_email: user!.email,
          user_name: user!.name,
          timestamp: created_at,
          sync_id
        });
      }

      showToast(`SKU ${item.sku} successfully cataloged`, 'success');
      return true;
    } catch (err: any) {
      showToast(err.message || 'Failed to create SKU record', 'error');
      return false;
    }
  };

  const handleEditSku = async (sku: string, fields: any): Promise<boolean> => {
    try {
      const skuDocRef = doc(db, 'inventory', sku);
      await updateDoc(skuDocRef, fields);
      showToast(`SKU ${sku} modified successfully`, 'success');
      return true;
    } catch (err: any) {
      showToast(err.message || 'Failed to modify SKU', 'error');
      return false;
    }
  };

  const handleDeleteSku = async (sku: string): Promise<boolean> => {
    if (!window.confirm(`Delete SKU record: ${sku}?`)) return false;
    try {
      const skuDocRef = doc(db, 'inventory', sku);
      await deleteDoc(skuDocRef);
      showToast(`SKU ${sku} deleted successfully`, 'success');
      return true;
    } catch (err: any) {
      showToast(err.message || 'Failed to delete SKU', 'error');
      return false;
    }
  };

  const handleLogOperation = async (payload: { sku: string; quantity: number; type: 'INBOUND' | 'OUTBOUND'; sync_id: string }): Promise<boolean> => {
    try {
      const { sku, quantity, type, sync_id } = payload;
      const changeQty = type === 'INBOUND' ? quantity : -quantity;
      const nowStr = new Date().toISOString();

      const matchedItem = inventory.find(i => i.sku === sku);
      if (!matchedItem) {
        showToast(`SKU ${sku} not found`, 'error');
        return false;
      }

      // Additive Stock Math (increment/decrement) + Idempotency writes
      const skuDocRef = doc(db, 'inventory', sku);
      await updateDoc(skuDocRef, {
        quantity: increment(changeQty)
      });

      const txDocRef = doc(db, 'transactions', sync_id);
      await setDoc(txDocRef, {
        sku,
        item_name: matchedItem.name,
        type,
        change_qty: changeQty,
        user_email: user!.email,
        user_name: user!.name,
        timestamp: nowStr,
        sync_id
      });

      const syncDocRef = doc(db, 'processed_syncs', sync_id);
      await setDoc(syncDocRef, {
        processed_at: nowStr
      });

      showToast(`Logged movement: ${type} ${quantity} units`, 'success');
      return true;
    } catch (err: any) {
      showToast(err.message || 'Operation failed', 'error');
      return false;
    }
  };

  const syncOfflineQueue = async (operations: any[]): Promise<boolean> => {
    try {
      // Loop through offline queued elements and apply them safely
      for (const op of operations) {
        const changeQty = op.type === 'INBOUND' ? Math.abs(op.change_qty) : -Math.abs(op.change_qty);
        const itemObj = inventory.find(i => i.sku === op.sku);
        if (!itemObj) continue;

        const skuDocRef = doc(db, 'inventory', op.sku);
        await updateDoc(skuDocRef, {
          quantity: increment(changeQty)
        });

        const txDocRef = doc(db, 'transactions', op.id);
        await setDoc(txDocRef, {
          sku: op.sku,
          item_name: itemObj.name,
          type: op.type,
          change_qty: changeQty,
          user_email: op.user_email,
          user_name: op.user_name,
          timestamp: op.timestamp,
          sync_id: op.id
        });

        const syncDocRef = doc(db, 'processed_syncs', op.id);
        await setDoc(syncDocRef, {
          processed_at: new Date().toISOString()
        });
      }
      return true;
    } catch (e) {
      console.error("Queue sync error:", e);
      return false;
    }
  };

  const handleSeedMockData = async () => {
    try {
      showToast('Seeding sample warehouse database...', 'info');

      const mockItems = [
        { sku: 'PROD-001', name: 'Industrial Steel Pipe', category: 'Steel Alloys', quantity: 45, price: 29.99, location: 'Bin A-12', min_threshold: 10 },
        { sku: 'PROD-002', name: 'Copper Wire Spool 50m', category: 'Electrical', quantity: 8, price: 45.50, location: 'Shelf B-04', min_threshold: 15 },
        { sku: 'PROD-003', name: 'Heavy Duty Caster Wheel', category: 'Hardware', quantity: 120, price: 12.99, location: 'Aisle C-01', min_threshold: 20 },
        { sku: 'PROD-004', name: 'Lithium-Ion Battery Pack', category: 'Electrical', quantity: 18, price: 89.99, location: 'Locker E-08', min_threshold: 5 },
        { sku: 'PROD-005', name: 'Pneumatic Valve Assembly', category: 'Hydraulics', quantity: 32, price: 150.00, location: 'Shelf D-02', min_threshold: 8 },
        { sku: 'PROD-006', name: 'Aluminum Angle Bar 2m', category: 'Steel Alloys', quantity: 75, price: 18.50, location: 'Bin A-15', min_threshold: 15 },
        { sku: 'PROD-007', name: 'Optical Sensor Bracket', category: 'Hardware', quantity: 4, price: 8.75, location: 'Aisle C-04', min_threshold: 10 }
      ];

      for (const item of mockItems) {
        await setDoc(doc(db, 'inventory', item.sku), {
          ...item,
          created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() // 5 days ago
        });
      }

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

      for (let i = 0; i < mockTx.length; i++) {
        const tx = mockTx[i];
        const matched = mockItems.find(item => item.sku === tx.sku);
        const name = matched ? matched.name : 'Unknown Product';
        const sync_id = `seed-${tx.sku}-${i}`;
        
        await setDoc(doc(db, 'transactions', sync_id), {
          sku: tx.sku,
          item_name: name,
          type: tx.type,
          change_qty: tx.change_qty,
          user_email: 'admin@nexus.com',
          user_name: 'Aarav Sharma (Seed)',
          timestamp: tx.timestamp,
          sync_id
        });
      }

      const mockTasks = [
        { id: 'task-seed-1', title: 'Audit Locker E-08 battery levels', description: 'Double check counts, record details in operations scans.', assigned_to: 'staff@nexus.com', status: 'Pending', created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
        { id: 'task-seed-2', title: 'Reorganize Shelf B-04 copper spools', description: 'Stack wire spools neatly and ensure barcode labels are visible.', assigned_to: 'staff@nexus.com', status: 'In Progress', created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
        { id: 'task-seed-3', title: 'Count caster wheels in Aisle C-01', description: 'Perform end-of-week physical count audit.', assigned_to: 'staff@nexus.com', status: 'Completed', created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() }
      ];

      for (const task of mockTasks) {
        await setDoc(doc(db, 'tasks', task.id), task);
      }

      showToast('Warehouse database successfully seeded!', 'success');
    } catch (e: any) {
      showToast(e.message || 'Seeding failed', 'error');
    }
  };

  const handleAddUser = async (fields: any): Promise<boolean> => {
    try {
      showToast('Registering employee credentials in cloud auth...', 'info');

      const firebaseConfig = {
        apiKey: "AIzaSyCdrT97GXYoA7LNr5f39uRHuyNCeGfSJa4",
        authDomain: "waretrack-86cf0.firebaseapp.com",
        projectId: "waretrack-86cf0",
        storageBucket: "waretrack-86cf0.firebasestorage.app",
        messagingSenderId: "298683388454",
        appId: "1:298683388454:web:6f2c561dc0029a3ea64ce7",
        measurementId: "G-2GHTTSJ44E"
      };

      const { initializeApp, deleteApp } = await import('firebase/app');
      const { getAuth, createUserWithEmailAndPassword, signOut } = await import('firebase/auth');

      // Create a unique temporary app instance name
      const tempAppName = `EmployeeAuth-${Date.now()}`;
      const secondaryApp = initializeApp(firebaseConfig, tempAppName);
      const secondaryAuth = getAuth(secondaryApp);

      // Sign up using under-the-hood master password
      const masterAuthPassword = 'nexusMasterPassword123!';

      try {
        await createUserWithEmailAndPassword(secondaryAuth, fields.email.toLowerCase(), masterAuthPassword);
        await signOut(secondaryAuth);
      } finally {
        await deleteApp(secondaryApp);
      }

      // Write profile and custom password to Firestore
      const userDocRef = doc(db, 'users', fields.email.toLowerCase());
      await setDoc(userDocRef, {
        email: fields.email.toLowerCase(),
        name: fields.name,
        role: fields.role,
        password: fields.password // Store custom password in Firestore
      });
      
      showToast(`Employee credentials and profile created for ${fields.name}`, 'success');
      return true;
    } catch (err: any) {
      console.error("Employee creation failed:", err);
      let msg = err.message || 'Failed to create user record';
      if (err.code === 'auth/weak-password') {
        msg = 'Registration failed: Password must be at least 6 characters long.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'Registration failed: This email is already registered in Authentication.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Registration failed: The email address is invalid.';
      }
      showToast(msg, 'error');
      return false;
    }
  };

  const handleDeleteUser = async (email: string): Promise<boolean> => {
    if (!window.confirm(`Delete employee user profile: ${email}?`)) return false;
    try {
      const userDocRef = doc(db, 'users', email.toLowerCase());
      await deleteDoc(userDocRef);
      showToast('Employee profile deleted from database', 'success');
      return true;
    } catch (err: any) {
      showToast(err.message || 'Failed to delete user profile', 'error');
      return false;
    }
  };

  const handleResetPassword = async (email: string, newPass: string): Promise<boolean> => {
    try {
      const userDocRef = doc(db, 'users', email.toLowerCase());
      await updateDoc(userDocRef, {
        password: newPass
      });
      showToast(`Password successfully changed for ${email}`, 'success');
      return true;
    } catch (err: any) {
      showToast(err.message || 'Failed to update user password', 'error');
      return false;
    }
  };

  const handleChangeName = async (email: string, newName: string): Promise<boolean> => {
    try {
      const userDocRef = doc(db, 'users', email.toLowerCase());
      await updateDoc(userDocRef, {
        name: newName
      });
      
      if (user && email.toLowerCase() === user.email.toLowerCase()) {
        setUser(prev => prev ? { ...prev, name: newName } : null);
      }
      
      showToast(`Name successfully updated to ${newName}`, 'success');
      return true;
    } catch (err: any) {
      showToast(err.message || 'Failed to update employee name', 'error');
      return false;
    }
  };

  const handlePromoteUser = async (email: string, newRole: string): Promise<boolean> => {
    try {
      const userDocRef = doc(db, 'users', email.toLowerCase());
      await updateDoc(userDocRef, {
        role: newRole
      });
      const actionWord = newRole === 'Staff' ? 'demoted' : 'promoted';
      showToast(`User ${email} successfully ${actionWord} to ${newRole}`, 'success');
      return true;
    } catch (err: any) {
      showToast(err.message || 'Failed to change employee role', 'error');
      return false;
    }
  };

  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle || !taskDesc || !taskAssignee) {
      showToast('Provide title, description, and select assignee', 'error');
      return;
    }

    try {
      const taskId = `task-${Date.now()}`;
      const taskDocRef = doc(db, 'tasks', taskId);
      await setDoc(taskDocRef, {
        id: taskId,
        title: taskTitle,
        description: taskDesc,
        assigned_to: taskAssignee,
        status: 'Pending',
        created_at: new Date().toISOString()
      });

      showToast('Task successfully cataloged', 'success');
      setTaskTitle('');
      setTaskDesc('');
      setTaskAssignee('');
    } catch (err: any) {
      showToast(err.message || 'Task creation failed', 'error');
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, nextStatus: string) => {
    try {
      const taskDocRef = doc(db, 'tasks', taskId);
      await updateDoc(taskDocRef, {
        status: nextStatus
      });
      showToast(`Task marked as ${nextStatus}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update task status', 'error');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this completed task record?')) return;
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      showToast('Completed task record deleted', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete task', 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setActiveTab('dashboard');
      setIsSidebarOpen(false);
      showToast('Signed out of session', 'info');
    } catch (err) {
      showToast('Logout failed', 'error');
    }
  };

  if (!user) {
    return <Login onLoginSuccess={(u) => setUser(u)} />;
  }

  const staffMembers = usersList.filter(u => u.role === 'Staff');

  return (
    <div className="app-container">
      {/* Mobile Sidebar dim-overlay backdrop */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(3px)',
            zIndex: 95
          }}
        />
      )}

      <nav className={`sidebar ${isSidebarOpen ? 'active' : ''}`}>
        <div className="sidebar-header">
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            backgroundColor: 'var(--accent-primary-glow)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-primary)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <Package size={18} />
          </div>
          <span className="logo-text" style={{ fontSize: '15px', letterSpacing: '0.05em' }}>NEXUS WARETRACK</span>
        </div>

        <ul className="sidebar-menu">
          <li>
            <a 
              className={`sidebar-link ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('dashboard');
                setIsSidebarOpen(false);
              }}
            >
              <LayoutDashboard size={18} /> Dashboard
            </a>
          </li>
          <li>
            <a 
              className={`sidebar-link ${activeTab === 'inventory' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('inventory');
                setIsSidebarOpen(false);
              }}
            >
              <Package size={18} /> Inventory Stock
            </a>
          </li>
          <li>
            <a 
              className={`sidebar-link ${activeTab === 'operations' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('operations');
                setIsSidebarOpen(false);
              }}
            >
              <RefreshCw size={18} /> Scans & Sync
            </a>
          </li>
          {(user.role === 'Administrator' || user.role === 'Warehouse Manager') && (
            <li>
              <a 
                className={`sidebar-link ${activeTab === 'employees' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('employees');
                  setIsSidebarOpen(false);
                }}
              >
                <Users size={18} /> Employees
              </a>
            </li>
          )}
          <li>
            <a 
              className={`sidebar-link ${activeTab === 'tasks' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('tasks');
                setIsSidebarOpen(false);
              }}
            >
              <CheckSquare size={18} /> Assigned Tasks
            </a>
          </li>
          <li>
            <a 
              className={`sidebar-link ${activeTab === 'attendance' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('attendance');
                setIsSidebarOpen(false);
              }}
            >
              <Calendar size={18} /> Attendance Logs
            </a>
          </li>
        </ul>

        <div className="sidebar-footer">
          <div className="user-profile" style={{ marginBottom: '12px' }}>
            <div className="user-avatar">
              {user.name.substring(0, 2).toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{user.name}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{user.role}</div>
            </div>
          </div>
          <button 
            onClick={handleLogout} 
            className="btn btn-secondary" 
            style={{ width: '100%', fontSize: '12px', padding: '8px' }}
          >
            <LogOut size={14} /> Log Out
          </button>
        </div>
      </nav>

      <div className="main-content">
        <header className="top-bar">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="btn btn-secondary mobile-menu-toggle"
              style={{ padding: '8px', marginRight: '12px' }}
              title="Toggle Menu"
            >
              {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <h2 className="page-title" style={{ textTransform: 'capitalize', margin: 0 }}>
              {activeTab === 'employees' ? 'Employee Management' : activeTab === 'tasks' ? 'Assigned Tasks' : activeTab}
            </h2>
          </div>

          <div className="top-bar-actions">
            <button 
              onClick={toggleTheme}
              className="btn btn-secondary"
              style={{ padding: '8px', borderRadius: '50%', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button 
              onClick={() => setToastEnabled(!isToastEnabled)}
              className="btn btn-secondary"
              style={{ padding: '8px', borderRadius: '50%', color: isToastEnabled ? 'var(--success)' : 'var(--text-muted)' }}
              title={isToastEnabled ? 'Mute Alert Toasts' : 'Unmute Alert Toasts'}
            >
              {isToastEnabled ? <Bell size={16} /> : <BellOff size={16} />}
            </button>

            <div className={`status-badge ${isOnline ? 'status-online' : 'status-offline'}`}>
              <div style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                backgroundColor: isOnline ? 'var(--success)' : 'var(--danger)' 
              }} />
              <span>{isOnline ? 'Cloud Sync' : 'Offline Mode'}</span>
            </div>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <Dashboard 
            user={user} 
            inventory={inventory} 
            transactions={transactions} 
            onSeedMockData={handleSeedMockData} 
          />
        )}
        {activeTab === 'inventory' && (
          <Inventory 
            user={user} 
            inventory={inventory} 
            transactions={transactions}
            onAddSku={handleAddSku} 
            onEditSku={handleEditSku} 
            onDeleteSku={handleDeleteSku} 
          />
        )}
        {activeTab === 'operations' && (
          <Operations 
            user={user} 
            inventory={inventory} 
            transactions={transactions} 
            onLogOperation={handleLogOperation} 
            syncOfflineQueue={syncOfflineQueue} 
          />
        )}
        {activeTab === 'employees' && (
          <Employees 
            user={user} 
            users={usersList} 
            onAddUser={handleAddUser} 
            onDeleteUser={handleDeleteUser} 
            onPromoteUser={handlePromoteUser}
            onResetPassword={handleResetPassword}
            onChangeName={handleChangeName}
          />
        )}

        {activeTab === 'tasks' && (
          <div className="page-container animate-slide-up">
            {(user.role === 'Administrator' || user.role === 'Warehouse Manager') && (
              <div className="panel-glass">
                <h3>Assign Task to Staff Operator</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '16px' }}>
                  Assign audits or shelf organization tasks directly.
                </p>
                <form onSubmit={handleAssignTask} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ flex: '1 1 200px' }}>
                    <label className="form-label">Task Title</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Audit Locker B-03 items" 
                      className="form-input"
                      required
                      value={taskTitle}
                      onChange={e => setTaskTitle(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ flex: '2 1 300px' }}>
                    <label className="form-label">Instructions / Description</label>
                    <input 
                      type="text" 
                      placeholder="Double check counts, record details in operations scans" 
                      className="form-input"
                      required
                      value={taskDesc}
                      onChange={e => setTaskDesc(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ flex: '1 1 180px' }}>
                    <label className="form-label">Assignee (Staff Only)</label>
                    <select 
                      className="form-select" 
                      required 
                      value={taskAssignee} 
                      onChange={e => setTaskAssignee(e.target.value)}
                    >
                      <option value="">Choose Staff...</option>
                      {staffMembers.map(st => (
                        <option key={st.email} value={st.email}>{st.name} ({st.email})</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ height: '44px', marginBottom: '16px' }}>
                    Assign Task
                  </button>
                </form>
              </div>
            )}

            <div className="panel-glass">
              <h3>Task Registry</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '16px' }}>
                {user.role === 'Staff' ? 'Your active task list assignments' : 'Complete system task statuses'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {tasksList.map(task => (
                  <div key={task.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    gap: '12px'
                  }}>
                    <div>
                      <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {task.title}
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '9px',
                          backgroundColor: task.status === 'Completed' ? 'var(--success-glow)' : task.status === 'In Progress' ? 'var(--accent-primary-glow)' : 'var(--bg-primary)',
                          color: task.status === 'Completed' ? 'var(--success)' : task.status === 'In Progress' ? '#a5b4fc' : 'var(--text-secondary)',
                          border: '1px solid var(--border-color)'
                        }}>{task.status}</span>
                      </h4>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{task.description}</p>
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Assigned to: {task.assigned_to} | Created: {new Date(task.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    {user.role === 'Staff' ? (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {task.status !== 'In Progress' && task.status !== 'Completed' && (
                          <button onClick={() => handleUpdateTaskStatus(task.id, 'In Progress')} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px' }}>
                            Start Task
                          </button>
                        )}
                        {task.status !== 'Completed' && (
                          <button onClick={() => handleUpdateTaskStatus(task.id, 'Completed')} className="btn btn-success" style={{ padding: '6px 12px', fontSize: '11px' }}>
                            Complete Task
                          </button>
                        )}
                        {task.status === 'Completed' && (
                          <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 'bold' }}>✓ Task Completed</span>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          Operator: <strong style={{ color: 'var(--text-primary)' }}>{task.assigned_to.split('@')[0]}</strong>
                        </div>
                        {user.role === 'Administrator' && task.status === 'Completed' && (
                          <button 
                            onClick={() => handleDeleteTask(task.id)}
                            className="btn btn-secondary btn-icon"
                            style={{ color: 'var(--danger)', padding: '6px' }}
                            title="Delete Completed Task"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {tasksList.length === 0 && (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0', fontSize: '13px' }}>
                    No tasks currently cataloged.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'attendance' && (
          <Attendance 
            user={user} 
            users={usersList} 
          />
        )}

        <Chatbot inventory={inventory} transactions={transactions} />
      </div>
      {/* Global New Task Popup Overlay */}
      {activeNewTask && (
        <div style={notificationModalOverlayStyle}>
          <div style={notificationModalContentStyle} className="panel-glass animate-slide-up">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-primary-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)'
              }}>
                <Bell size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>New Task Assigned!</h3>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                {activeNewTask.title}
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0, lineHeight: '1.4' }}>
                {activeNewTask.description}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => {
                  setActiveNewTask(null);
                  setActiveTab('tasks');
                }} 
                className="btn btn-primary"
                style={{ padding: '8px 16px', fontSize: '12px' }}
              >
                Acknowledge & View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const notificationModalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2000,
  padding: '16px'
};

const notificationModalContentStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '400px',
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  borderRadius: '12px',
  padding: '20px',
  boxShadow: 'var(--shadow-lg)'
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>,
);
