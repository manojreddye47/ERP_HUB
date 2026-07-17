import React, { useMemo, useState } from 'react';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell 
} from 'recharts';
import { Package, TrendingUp, AlertTriangle, ArrowUpRight, ArrowDownRight, IndianRupee } from 'lucide-react';

interface DashboardProps {
  user: { email: string; role: string; name: string };
  inventory: any[];
  transactions: any[];
  onSeedMockData?: () => Promise<void>;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, inventory, transactions, onSeedMockData }) => {
  const isStaff = user.role === 'Staff';

  // 1. Calculations
  const stats = useMemo(() => {
    const totalItems = inventory.reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = inventory.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const lowStockAlerts = inventory.filter(item => item.quantity <= item.min_threshold).length;
    
    // Count transactions today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayTx = transactions.filter(t => new Date(t.timestamp) >= startOfToday).length;

    return { totalItems, totalValue, lowStockAlerts, todayTx };
  }, [inventory, transactions]);

  // 2. Chart 1: Stock Aging (Fresh vs Slow vs Dead Stock)
  const agingData = useMemo(() => {
    const now = new Date().getTime();
    let fresh = 0; // < 14 days
    let mid = 0;   // 14 - 30 days
    let dead = 0;  // > 30 days

    inventory.forEach(item => {
      const createdTime = new Date(item.created_at).getTime();
      const diffDays = (now - createdTime) / (1000 * 60 * 60 * 24);

      if (diffDays < 14) {
        fresh += item.quantity;
      } else if (diffDays <= 30) {
        mid += item.quantity;
      } else {
        dead += item.quantity;
      }
    });

    return [
      { name: 'Fast Moving Stock', value: fresh, color: '#26a69a' },
      { name: 'Stable Stock', value: mid, color: '#5c6bc0' },
      { name: 'Dead or Slow Stock', value: dead, color: '#ef4444' }
    ];
  }, [inventory]);

  // Timeframe selector state for trend line
  const [trendTimeframe, setTrendTimeframe] = useState<'24h' | '1w' | '1m'>('24h');

  // 3. Chart 2: Inventory Trends (Latest transactions stock levels over timeframes)
  const trendData = useMemo(() => {
    const now = new Date();
    const sortedTx = [...transactions].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    // Total units in stock right now
    const finalSum = inventory.reduce((sum, item) => sum + item.quantity, 0);

    let intervals: { label: string; start: Date; end: Date }[] = [];

    if (trendTimeframe === '24h') {
      // Create 8 intervals (each 3 hours wide) to cover 24h cleanly
      for (let i = 7; i >= 0; i--) {
        const end = new Date(now.getTime() - i * 3 * 60 * 60 * 1000);
        const start = new Date(end.getTime() - 3 * 60 * 60 * 1000);
        const label = end.toLocaleTimeString('en-IN', { hour: '2-digit', hour12: false });
        intervals.push({ label: `${label}:00`, start, end });
      }
    } else if (trendTimeframe === '1w') {
      // Create 7 daily intervals to cover the last 7 days cleanly
      for (let i = 6; i >= 0; i--) {
        const end = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
        const label = end.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
        intervals.push({ label, start, end });
      }
    } else {
      // Last 1 Month: Create 10 intervals (each 3 days wide) to span 30 days beautifully
      for (let i = 9; i >= 0; i--) {
        const end = new Date(now.getTime() - i * 3 * 24 * 60 * 60 * 1000);
        const start = new Date(end.getTime() - 3 * 24 * 60 * 60 * 1000);
        const label = end.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
        intervals.push({ label, start, end });
      }
    }

    // Calculate historical stock levels backwards
    const result = intervals.map(interval => {
      let currentVal = finalSum;
      const laterTx = sortedTx.filter(tx => new Date(tx.timestamp) > interval.end);
      
      laterTx.forEach(tx => {
        currentVal -= tx.change_qty;
      });

      return {
        date: interval.label,
        quantity: Math.max(0, currentVal)
      };
    });

    return result;
  }, [inventory, transactions, trendTimeframe]);

  // 4. Chart 3: Top Categories Value Distribution
  const categoryData = useMemo(() => {
    const categories: Record<string, number> = {};
    inventory.forEach(item => {
      const val = item.quantity * item.price;
      categories[item.category] = (categories[item.category] || 0) + val;
    });

    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  }, [inventory]);

  return (
    <div className="page-container animate-slide-up">
      {/* Welcome banner for non-admin users when empty */}
      {inventory.length === 0 && user.role !== 'Administrator' && !isStaff && onSeedMockData && (
        <div className="panel-glass" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', border: '1px solid rgba(92, 107, 192, 0.4)' }}>
          <div>
            <h4 style={{ color: 'var(--text-primary)', marginBottom: '4px' }}>Welcome to Nexus Waretrack ERP</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>The warehouse database is currently empty. Populate the system with mock products, transaction histories, and tasks to preview the interactive charts and analytics.</p>
          </div>
          <button onClick={onSeedMockData} className="btn btn-primary" style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
            Seed Sample Database
          </button>
        </div>
      )}

      {/* Admin seeding and database reset controller */}
      {user.role === 'Administrator' && onSeedMockData && (
        <div className="panel-glass animate-slide-up" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', border: '1px solid rgba(239, 68, 68, 0.2)', backgroundColor: 'rgba(239, 68, 68, 0.02)' }}>
          <div>
            <h4 style={{ color: 'var(--text-primary)', marginBottom: '4px' }}>⚡ System Seed & Database Reset Console</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              Clear out all current products, transactions, and tasks, and seed the Firestore database with fresh mock items distributed across the Stock Aging categories.
            </p>
          </div>
          <button 
            onClick={() => {
              if (window.confirm("Warning: This will completely erase ALL products, transactions, and tasks in the database and seed it fresh. Do you wish to proceed?")) {
                onSeedMockData();
              }
            }} 
            className="btn btn-primary" 
            style={{ 
              padding: '10px 16px', 
              whiteSpace: 'nowrap', 
              backgroundColor: 'var(--danger)', 
              borderColor: 'var(--danger)' 
            }}
          >
            Reset Database & Seed Mock Data
          </button>
        </div>
      )}

      {/* 3D-Interactive Style Cards Grid */}
      <div className="grid-dashboard">
        {/* Card 1 */}
        <div className="card-stat">
          <div className="stat-header">
            <span>Total Units In Stock</span>
            <div className="stat-icon"><Package size={20} /></div>
          </div>
          <div className="stat-val">{stats.totalItems.toLocaleString('en-IN')}</div>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Standard volume capacity</span>
        </div>

        {/* Card 2 (Enforced RBAC: Hide from Staff) */}
        {!isStaff ? (
          <div className="card-stat">
            <div className="stat-header">
              <span>Financial Valuation (INR)</span>
              <div className="stat-icon" style={{ color: 'var(--accent-teal)' }}><IndianRupee size={20} /></div>
            </div>
            <div className="stat-val">₹{stats.totalValue.toLocaleString('en-IN')}</div>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Valuation at active wholesale unit prices</span>
          </div>
        ) : (
          <div className="card-stat" style={{ opacity: 0.7 }}>
            <div className="stat-header">
              <span>Financial Valuation (INR)</span>
              <div className="stat-icon" style={{ color: 'var(--text-muted)' }}><IndianRupee size={20} /></div>
            </div>
            <div className="stat-val" style={{ fontSize: '18px', color: 'var(--text-secondary)', margin: '14px 0' }}>
              🔒 Restricted Access
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Financial metadata hidden for Staff roles</span>
          </div>
        )}

        {/* Card 3 */}
        <div className="card-stat" style={{ borderColor: stats.lowStockAlerts > 0 ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-color)' }}>
          <div className="stat-header">
            <span>Low Stock Alerts</span>
            <div className="stat-icon" style={{ color: 'var(--danger)' }}><AlertTriangle size={20} /></div>
          </div>
          <div className="stat-val" style={{ color: stats.lowStockAlerts > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
            {stats.lowStockAlerts}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Items below safety threshold</span>
        </div>

        {/* Card 4 */}
        <div className="card-stat">
          <div className="stat-header">
            <span>Scan Runs Today</span>
            <div className="stat-icon" style={{ color: 'var(--accent-teal)' }}><TrendingUp size={20} /></div>
          </div>
          <div className="stat-val">{stats.todayTx}</div>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Inbound and Outbound actions today</span>
        </div>
      </div>

      {/* Grid for Graphs */}
      <div style={chartsGridStyle}>
        {/* Trend Graph */}
        <div className="panel-glass chart-trend-panel" style={{ gridColumn: 'span 2', minHeight: '350px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={chartTitleStyle}>Inventory Volume Trend</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0 }}>
                Historical total unit counts computed across recent stock logs
              </p>
            </div>
            {/* Timeframe Selector Tabs */}
            <div style={{ display: 'flex', backgroundColor: 'var(--bg-tertiary)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              {(['24h', '1w', '1m'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTrendTimeframe(tf)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: trendTimeframe === tf ? 'var(--accent-primary)' : 'transparent',
                    color: trendTimeframe === tf ? '#fff' : 'var(--text-secondary)',
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  {tf === '24h' ? '24 Hours' : tf === '1w' ? '1 Week' : '1 Month'}
                </button>
              ))}
            </div>
          </div>
          <div style={{ width: '100%', height: '260px' }}>
            <ResponsiveContainer>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={12} />
                <YAxis stroke="var(--text-secondary)" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px', boxShadow: 'var(--shadow-sm)' }}
                  itemStyle={{ color: 'var(--text-primary)', fontSize: '12px' }}
                  labelStyle={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Line type="monotone" dataKey="quantity" name="Stock Count" stroke="var(--accent-primary)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Aging Pie Graph */}
        <div className="panel-glass" style={{ minHeight: '350px' }}>
          <h3 style={chartTitleStyle}>Stock Aging Analysis</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '20px' }}>
            Total stock segmented by duration in warehouse bins
          </p>
          <div style={{ width: '100%', height: '200px', display: 'flex', justifyContent: 'center' }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={agingData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {agingData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px', boxShadow: 'var(--shadow-sm)' }}
                  itemStyle={{ color: 'var(--text-primary)', fontSize: '12px' }}
                  labelStyle={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 'bold' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
            {agingData.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: item.color }} />
                  <span style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                </div>
                <span style={{ fontWeight: 'bold' }}>{item.value} units</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category Value Bar Chart (Enforced RBAC: Hide from Staff) */}
        {!isStaff && (
          <div className="panel-glass chart-category-panel" style={{ gridColumn: 'span 3', minHeight: '320px' }}>
            <h3 style={chartTitleStyle}>Inventory Valuation by Category</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '20px' }}>
              Cumulative stock valuation formatted in Indian Rupees (INR)
            </p>
            <div style={{ width: '100%', height: '220px' }}>
              <ResponsiveContainer>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} />
                  <YAxis stroke="var(--text-secondary)" fontSize={11} tickFormatter={(v) => `₹${v/1000}k`} />
                  <Tooltip 
                    formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Valuation']}
                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px', boxShadow: 'var(--shadow-sm)' }}
                    itemStyle={{ color: 'var(--text-primary)', fontSize: '12px' }}
                    labelStyle={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="value" name="Valuation" fill="url(#colorVal)" radius={[4, 4, 0, 0]}>
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={index % 2 === 0 ? 'var(--accent-teal)' : 'var(--accent-primary)'} />
                    ))}
                  </Bar>
                  <defs>
                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-teal)" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="var(--accent-teal)" stopOpacity={0.2}/>
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Activity Feed */}
      <div className="panel-glass">
        <h3 style={chartTitleStyle}>Recent Movements Activity</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '16px' }}>
          Real-time updates broadcasted via WebSockets
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {transactions.slice(0, 5).map((tx) => (
            <div key={tx.id} style={txRowStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  padding: '6px',
                  borderRadius: '6px',
                  backgroundColor: tx.type === 'INBOUND' ? 'var(--success-glow)' : 'var(--danger-glow)',
                  color: tx.type === 'INBOUND' ? 'var(--success)' : 'var(--danger)',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  {tx.type === 'INBOUND' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{tx.item_name} ({tx.sku})</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Processed by: {tx.user_name} ({tx.user_email})
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: tx.type === 'INBOUND' ? 'var(--success)' : 'var(--danger)'
                }}>
                  {tx.type === 'INBOUND' ? '+' : ''}{tx.change_qty} units
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {new Date(tx.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          {transactions.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '16px 0' }}>
              No operations logged in database yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// Styles
const chartsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: 24,
};

const chartTitleStyle: React.CSSProperties = {
  fontSize: '16px',
  marginBottom: '4px',
};

const txRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  backgroundColor: 'var(--bg-tertiary)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  transition: 'transform 0.2s',
};

export default Dashboard;
