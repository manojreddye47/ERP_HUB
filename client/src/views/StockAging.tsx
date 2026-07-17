import React, { useState, useMemo } from 'react';
import { Hourglass, Search, Package, TrendingUp, AlertTriangle } from 'lucide-react';

interface StockAgingProps {
  inventory: any[];
}

export const StockAging: React.FC<StockAgingProps> = ({ inventory }) => {
  const [activeTab, setActiveTab] = useState<'fast' | 'stable' | 'slow'>('fast');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Calculations
  const processedItems = useMemo(() => {
    const now = new Date();
    
    return inventory.map(item => {
      const created = item.created_at ? new Date(item.created_at) : now;
      const diffTime = now.getTime() - created.getTime();
      const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
      return {
        ...item,
        ageDays: diffDays
      };
    });
  }, [inventory]);

  // Grouped items
  const grouped = useMemo(() => {
    const fast: any[] = [];
    const stable: any[] = [];
    const slow: any[] = [];

    processedItems.forEach(item => {
      if (item.ageDays < 14) {
        fast.push(item);
      } else if (item.ageDays <= 30) {
        stable.push(item);
      } else {
        slow.push(item);
      }
    });

    // Helper to calculate totals
    const getTotals = (list: any[]) => {
      const totalQty = list.reduce((sum, item) => sum + item.quantity, 0);
      const totalValue = list.reduce((sum, item) => sum + item.quantity * item.price, 0);
      return { qty: totalQty, val: totalValue };
    };

    return {
      fast: { list: fast, ...getTotals(fast) },
      stable: { list: stable, ...getTotals(stable) },
      slow: { list: slow, ...getTotals(slow) }
    };
  }, [processedItems]);

  // Current active list based on selection
  const currentList = useMemo(() => {
    const list = activeTab === 'fast' ? grouped.fast.list : activeTab === 'stable' ? grouped.stable.list : grouped.slow.list;
    if (!searchQuery) return list;
    
    const query = searchQuery.toLowerCase();
    return list.filter(item => 
      item.sku.toLowerCase().includes(query) || 
      item.name.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      item.location.toLowerCase().includes(query)
    );
  }, [activeTab, grouped, searchQuery]);

  return (
    <div className="page-container animate-slide-up">
      <div style={headerStyle}>
        <div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Hourglass size={20} color="var(--accent-primary)" /> Stock Aging Analysis Hub
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
            Comprehensive tracking of storage durations, shelf velocity status, and warehouse holding values.
          </p>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid-dashboard" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* Fast Moving */}
        <div className="card-stat" style={{ borderLeft: '4px solid var(--accent-teal)' }}>
          <div className="stat-header">
            <span style={{ fontWeight: 'bold', color: 'var(--accent-teal)' }}>⚡ Fast Moving Stock</span>
            <div className="stat-icon" style={{ color: 'var(--accent-teal)' }}><TrendingUp size={18} /></div>
          </div>
          <div className="stat-val" style={{ margin: '8px 0' }}>{grouped.fast.qty.toLocaleString('en-IN')} units</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
            <span>{grouped.fast.list.length} SKUs cataloged</span>
            <span style={{ fontWeight: 'bold' }}>Valuation: ₹{grouped.fast.val.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Stable */}
        <div className="card-stat" style={{ borderLeft: '4px solid var(--accent-primary)' }}>
          <div className="stat-header">
            <span style={{ fontWeight: 'bold', color: 'var(--accent-primary)' }}>🕒 Stable Stock</span>
            <div className="stat-icon" style={{ color: 'var(--accent-primary)' }}><Package size={18} /></div>
          </div>
          <div className="stat-val" style={{ margin: '8px 0' }}>{grouped.stable.qty.toLocaleString('en-IN')} units</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
            <span>{grouped.stable.list.length} SKUs cataloged</span>
            <span style={{ fontWeight: 'bold' }}>Valuation: ₹{grouped.stable.val.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Dead or Slow */}
        <div className="card-stat" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="stat-header">
            <span style={{ fontWeight: 'bold', color: 'var(--danger)' }}>🚨 Dead or Slow Stock</span>
            <div className="stat-icon" style={{ color: 'var(--danger)' }}><AlertTriangle size={18} /></div>
          </div>
          <div className="stat-val" style={{ margin: '8px 0' }}>{grouped.slow.qty.toLocaleString('en-IN')} units</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
            <span>{grouped.slow.list.length} SKUs cataloged</span>
            <span style={{ fontWeight: 'bold' }}>Valuation: ₹{grouped.slow.val.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Search and Navigation Row */}
      <div className="panel-glass" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          {/* Sub tabs */}
          <div style={{ display: 'flex', backgroundColor: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <button
              onClick={() => { setActiveTab('fast'); setSearchQuery(''); }}
              style={getTabStyle(activeTab === 'fast', 'var(--accent-teal)')}
            >
              Fast Moving (&lt; 14 days)
            </button>
            <button
              onClick={() => { setActiveTab('stable'); setSearchQuery(''); }}
              style={getTabStyle(activeTab === 'stable', 'var(--accent-primary)')}
            >
              Stable (14 - 30 days)
            </button>
            <button
              onClick={() => { setActiveTab('slow'); setSearchQuery(''); }}
              style={getTabStyle(activeTab === 'slow', 'var(--danger)')}
            >
              Dead/Slow (&gt; 30 days)
            </button>
          </div>

          {/* Search bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 12px', width: '100%', maxWidth: '280px', height: '38px' }}>
            <Search size={16} color="var(--text-secondary)" />
            <input
              type="text"
              placeholder="Search current stock..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ border: 'none', background: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '13px', width: '100%' }}
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product Name</th>
                <th>Category</th>
                <th>Stock Level</th>
                <th>Warehouse Location</th>
                <th>Unit Price</th>
                <th>Asset Valuation</th>
                <th>Duration in Bins</th>
              </tr>
            </thead>
            <tbody>
              {currentList.map((item) => (
                <tr key={item.sku}>
                  <td style={{ fontWeight: 'bold', color: 'var(--accent-teal)' }}>{item.sku}</td>
                  <td style={{ fontWeight: 'bold' }}>{item.name}</td>
                  <td>{item.category}</td>
                  <td>
                    <span style={{ fontWeight: 'bold' }}>{item.quantity}</span> units
                  </td>
                  <td>📍 {item.location}</td>
                  <td>₹{item.price.toLocaleString('en-IN')}</td>
                  <td>₹{(item.quantity * item.price).toLocaleString('en-IN')}</td>
                  <td>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      backgroundColor: activeTab === 'fast' 
                        ? 'var(--success-glow)' 
                        : activeTab === 'stable' 
                        ? 'var(--accent-primary-glow)' 
                        : 'var(--danger-glow)',
                      color: activeTab === 'fast' 
                        ? 'var(--success)' 
                        : activeTab === 'stable' 
                        ? '#a5b4fc' 
                        : 'var(--danger)',
                    }}>
                      🕒 {item.ageDays === 0 ? 'Added today' : `${item.ageDays} days ago`}
                    </span>
                  </td>
                </tr>
              ))}
              {currentList.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                    No products cataloged in this age category matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Styles helpers
const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '16px',
  flexWrap: 'wrap',
  gap: '12px'
};

const getTabStyle = (isActive: boolean, activeColor: string): React.CSSProperties => ({
  padding: '6px 14px',
  fontSize: '12px',
  fontWeight: 'bold',
  borderRadius: '6px',
  border: 'none',
  cursor: 'pointer',
  backgroundColor: isActive ? activeColor : 'transparent',
  color: isActive ? '#fff' : 'var(--text-secondary)',
  transition: 'var(--transition-smooth)',
  whiteSpace: 'nowrap'
});
