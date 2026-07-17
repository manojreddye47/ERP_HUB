import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from '../components/Toast';
import { FileSpreadsheet, FileText, Search, Plus, Edit2, Trash2, Package } from 'lucide-react';

interface InventoryProps {
  user: { email: string; role: string; name: string };
  inventory: any[];
  transactions: any[];
  onAddSku: (item: any) => Promise<boolean>;
  onEditSku: (sku: string, fields: any) => Promise<boolean>;
  onDeleteSku: (sku: string) => Promise<boolean>;
}

export const Inventory: React.FC<InventoryProps> = ({ user, inventory, transactions, onAddSku, onEditSku, onDeleteSku }) => {
  const isStaff = user.role === 'Staff';
  const { showToast } = useToast();

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Form modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Add Item form fields
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [qty, setQty] = useState(0);
  const [price, setPrice] = useState(0);
  const [minThreshold, setMinThreshold] = useState(0);
  const [category, setCategory] = useState('Raw Materials');
  const [vName, setVName] = useState('');
  const [vEmail, setVEmail] = useState('');

  // Reorder form fields
  const [isReorderOpen, setIsReorderOpen] = useState(false);
  const [reorderItem, setReorderItem] = useState<any>(null);
  const [reorderQty, setReorderQty] = useState(100);
  const [reorderVName, setReorderVName] = useState('');
  const [reorderVEmail, setReorderVEmail] = useState('');

  // Categories list
  const categories = ['Raw Materials', 'Electronics', 'Machinery', 'Electrical', 'Industrial'];

  // Filtered inventory list
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const matchSearch = item.sku.toLowerCase().includes(search.toLowerCase()) || 
                          item.name.toLowerCase().includes(search.toLowerCase()) ||
                          item.location.toLowerCase().includes(search.toLowerCase());
      const matchCategory = categoryFilter === 'All' || item.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [inventory, search, categoryFilter]);

  // Export to Excel XLSX
  const handleExportExcel = () => {
    try {
      // 1. Build Inventory Summary Sheet
      const exportData = filteredInventory.map(item => {
        const row: any = {
          "SKU": item.sku,
          "Name": item.name,
          "Location": item.location,
          "Quantity": item.quantity,
          "Min Safety Threshold": item.min_threshold,
          "Category": item.category,
          "Date Added": new Date(item.created_at).toLocaleDateString('en-IN')
        };
        // Enforce RBAC: Hide pricing details from Staff exports
        if (!isStaff) {
          row["Unit Price (INR)"] = `₹${item.price.toFixed(2)}`;
          row["Valuation (INR)"] = `₹${(item.quantity * item.price).toFixed(2)}`;
        }
        return row;
      });

      const wsInventory = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsInventory, "Inventory Summary");

      // 2. Build Real-time Scan Feed Sheet (includes scanning employee info)
      const scanFeedData = transactions.map(log => ({
        "Date": new Date(log.timestamp).toLocaleDateString('en-IN'),
        "Time": new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        "SKU": log.sku,
        "Product Name": log.item_name || 'N/A',
        "Action": log.type === 'INBOUND' ? 'IN' : 'OUT',
        "Quantity": Math.abs(log.change_qty),
        "Employee Name": log.user_name || 'System Operator',
        "Employee Email": log.user_email || 'N/A',
        "Sync Status": 'Synced'
      }));

      const wsScanFeed = XLSX.utils.json_to_sheet(scanFeedData);
      XLSX.utils.book_append_sheet(wb, wsScanFeed, "Real-time Scan Feed");

      XLSX.writeFile(wb, "Nexus_Inventory_Granular_Report.xlsx");
      showToast("Excel spreadsheet downloaded successfully", "success");
    } catch (err) {
      showToast("Failed to compile Excel export", "error");
    }
  };

  // Export to PDF report
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      const nowStr = new Date().toLocaleString('en-IN');
      
      // Document Title & Headers
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(26, 26, 29);
      doc.text("NEXUS WARETRACK - STATUS REPORT", 14, 20);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated: ${nowStr} | Requestor: ${user.name} (${user.role})`, 14, 26);

      // Core Summary Box
      const totalUnits = filteredInventory.reduce((s, i) => s + i.quantity, 0);
      const warnings = filteredInventory.filter(i => i.quantity <= i.min_threshold).length;
      
      let summaryText = `Total Items Listed: ${filteredInventory.length}  |  Total Stock Volume: ${totalUnits} units  |  Alert items: ${warnings}`;
      if (!isStaff) {
        const valuation = filteredInventory.reduce((s, i) => s + (i.quantity * i.price), 0);
        summaryText += `  |  Stock Valuation: INR ${valuation.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}`;
      }

      doc.setFillColor(240, 240, 243);
      doc.rect(14, 32, 182, 12, "F");
      doc.setFontSize(10);
      doc.setFont("Helvetica", "bold");
      doc.text(summaryText, 18, 40);

      // Prepare Table columns
      const headers = isStaff 
        ? [["SKU", "Item Name", "Location", "Quantity", "Safety Min", "Category"]] 
        : [["SKU", "Item Name", "Location", "Quantity", "Unit Price", "Valuation", "Category"]];

      const rows = filteredInventory.map(item => {
        const basic = [item.sku, item.name, item.location, item.quantity];
        if (isStaff) {
          return [...basic, item.min_threshold, item.category];
        } else {
          return [
            ...basic,
            `INR ${item.price.toFixed(2)}`,
            `INR ${(item.quantity * item.price).toLocaleString('en-IN')}`,
            item.category
          ];
        }
      });

      // Generate table
      autoTable(doc, {
        startY: 50,
        head: headers,
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [92, 107, 192] },
        styles: { fontSize: 9 }
      });

      doc.save("Nexus_Warehouse_Quick_Report.pdf");
      showToast("PDF report downloaded successfully", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to compile PDF report", "error");
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await onAddSku({ 
      sku, 
      name, 
      location, 
      quantity: qty, 
      price, 
      min_threshold: minThreshold, 
      category,
      vendor_name: vName,
      vendor_email: vEmail
    });
    if (success) {
      setIsAddOpen(false);
      setSku('');
      setName('');
      setLocation('');
      setQty(0);
      setPrice(0);
      setMinThreshold(0);
      setVName('');
      setVEmail('');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    const success = await onEditSku(editingItem.sku, {
      name,
      location,
      price,
      min_threshold: minThreshold,
      category,
      vendor_name: vName,
      vendor_email: vEmail
    });
    if (success) {
      setIsEditOpen(false);
      setEditingItem(null);
      setVName('');
      setVEmail('');
    }
  };

  const startEdit = (item: any) => {
    setEditingItem(item);
    setName(item.name);
    setLocation(item.location);
    setPrice(item.price);
    setMinThreshold(item.min_threshold);
    setCategory(item.category);
    setVName(item.vendor_name || '');
    setVEmail(item.vendor_email || '');
    setIsEditOpen(true);
  };

  const startReorder = (item: any) => {
    setReorderItem(item);
    setReorderVName(item.vendor_name || '');
    setReorderVEmail(item.vendor_email || '');
    const diff = Math.max(50, (item.min_threshold || 10) * 2 - item.quantity);
    setReorderQty(diff);
    setIsReorderOpen(true);
  };

  const handleReorderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reorderItem || !reorderVEmail) {
      showToast('Vendor email is required to reorder', 'error');
      return;
    }

    const subject = encodeURIComponent(`REORDER REQUEST: SKU ${reorderItem.sku} (${reorderItem.name})`);
    const body = encodeURIComponent(
      `Hi ${reorderVName || 'Supplier'},\n\n` +
      `We would like to place an order for ${reorderQty} units of the following SKU:\n\n` +
      `- Product: ${reorderItem.name}\n` +
      `- SKU: ${reorderItem.sku}\n` +
      `- Delivery Location: ${reorderItem.location}\n\n` +
      `Please reply with your invoice and estimated delivery date.\n\n` +
      `Best regards,\n` +
      `${user.name}\n` +
      `${user.role}`
    );

    window.open(`mailto:${reorderVEmail}?subject=${subject}&body=${body}`, '_blank');
    
    // Auto-update SKU vendor details if edited in reorder prompt
    if (reorderVName !== reorderItem.vendor_name || reorderVEmail !== reorderItem.vendor_email) {
      await onEditSku(reorderItem.sku, {
        vendor_name: reorderVName,
        vendor_email: reorderVEmail
      });
    }

    showToast(`Reorder email prepared for ${reorderVEmail}`, 'success');
    setIsReorderOpen(false);
  };

  return (
    <div className="page-container animate-slide-up">
      {/* Header and Controls */}
      <div style={controlsRowStyle}>
        <div style={searchWrapperStyle}>
          <Search size={18} style={searchIconStyle} />
          <input
            type="text"
            placeholder="Search by SKU, item name, or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={searchInputStyle}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="form-select"
            style={{ padding: '8px 12px', fontSize: '13px' }}
          >
            <option value="All">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <button onClick={handleExportExcel} className="btn btn-secondary" style={btnSmStyle}>
            <FileSpreadsheet size={16} /> Excel
          </button>

          <button onClick={handleExportPDF} className="btn btn-secondary" style={btnSmStyle}>
            <FileText size={16} /> Quick PDF
          </button>

          {!isStaff && (
            <button onClick={() => setIsAddOpen(true)} className="btn btn-primary" style={btnSmStyle}>
              <Plus size={16} /> Add SKU
            </button>
          )}
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="panel-glass">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Item Name</th>
                <th>Location</th>
                <th>Quantity</th>
                {!isStaff && <th>Unit Price</th>}
                {!isStaff && <th>Valuation</th>}
                <th>Category</th>
                <th>Status</th>
                {!isStaff && <th style={{ textAlign: 'center' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredInventory.map(item => {
                const lowStock = item.quantity <= item.min_threshold;
                return (
                  <tr key={item.sku}>
                    <td style={{ fontWeight: 'bold', color: 'var(--accent-primary)' }}>{item.sku}</td>
                    <td>{item.name}</td>
                    <td>📍 {item.location}</td>
                    <td style={{ fontWeight: 'bold' }}>{item.quantity.toLocaleString('en-IN')}</td>
                    {!isStaff && <td>₹{item.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>}
                    {!isStaff && (
                      <td style={{ fontWeight: 'bold' }}>
                        ₹{(item.quantity * item.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    )}
                    <td>
                      <span style={catBadgeStyle}>{item.category}</span>
                    </td>
                    <td>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        backgroundColor: lowStock ? 'var(--danger-glow)' : 'var(--success-glow)',
                        color: lowStock ? 'var(--danger)' : 'var(--success)',
                        border: `1px solid ${lowStock ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`
                      }}>
                        {lowStock ? 'Low Stock' : 'Optimized'}
                      </span>
                    </td>
                    {!isStaff && (
                      <td>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                          {lowStock && (
                            <button 
                              onClick={() => startReorder(item)} 
                              className="btn btn-secondary" 
                              style={{ 
                                padding: '4px 8px', 
                                fontSize: '11px', 
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                borderColor: 'var(--warning)', 
                                color: 'var(--warning)',
                                backgroundColor: 'var(--warning-glow)'
                              }}
                              title="Reorder from Vendor"
                            >
                              Reorder
                            </button>
                          )}
                          <button onClick={() => startEdit(item)} className="btn btn-secondary btn-icon" style={{ padding: '6px' }} title="Edit SKU">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => onDeleteSku(item.sku)} className="btn btn-secondary btn-icon" style={{ padding: '6px', color: 'var(--danger)' }} title="Delete SKU">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredInventory.length === 0 && (
                <tr>
                  <td colSpan={isStaff ? 6 : 9} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    No items match your active search filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add SKU Modal */}
      {isAddOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <div style={modalHeaderStyle}>
              <h3>Add New Inventory SKU</h3>
              <button onClick={() => setIsAddOpen(false)} style={closeBtnStyle}>X</button>
            </div>
            <form onSubmit={handleAddSubmit} style={{ marginTop: '16px' }}>
              <div className="form-group">
                <label className="form-label">SKU (e.g. SKU-1007)</label>
                <input type="text" className="form-input" required value={sku} onChange={e => setSku(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Product Name</label>
                <input type="text" className="form-input" required value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Location (e.g. Locker B-03)</label>
                <input type="text" className="form-input" required value={location} onChange={e => setLocation(e.target.value)} />
              </div>
              <div style={rowFormStyle}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Initial Quantity</label>
                  <input type="number" className="form-input" required min={0} value={qty} onChange={e => setQty(Number(e.target.value))} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Unit Price (₹)</label>
                  <input type="number" className="form-input" required min={0} value={price} onChange={e => setPrice(Number(e.target.value))} />
                </div>
              </div>
              <div style={rowFormStyle}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Safety Alert Limit</label>
                  <input type="number" className="form-input" required min={0} value={minThreshold} onChange={e => setMinThreshold(Number(e.target.value))} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Category</label>
                  <select className="form-select" value={category} onChange={e => setCategory(e.target.value)}>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={rowFormStyle}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Vendor Name</label>
                  <input type="text" placeholder="e.g. Acme Supplies Co." className="form-input" value={vName} onChange={e => setVName(e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Vendor Email</label>
                  <input type="email" placeholder="e.g. sales@acmesupplies.com" className="form-input" value={vEmail} onChange={e => setVEmail(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" onClick={() => setIsAddOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Create SKU Record</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit SKU Modal */}
      {isEditOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <div style={modalHeaderStyle}>
              <h3>Modify SKU: {editingItem?.sku}</h3>
              <button onClick={() => setIsEditOpen(false)} style={closeBtnStyle}>X</button>
            </div>
            <form onSubmit={handleEditSubmit} style={{ marginTop: '16px' }}>
              <div className="form-group">
                <label className="form-label">Product Name</label>
                <input type="text" className="form-input" required value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Location</label>
                <input type="text" className="form-input" required value={location} onChange={e => setLocation(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Unit Price (₹)</label>
                <input type="number" className="form-input" required min={0} value={price} onChange={e => setPrice(Number(e.target.value))} />
              </div>
              <div style={rowFormStyle}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Safety Alert Limit</label>
                  <input type="number" className="form-input" required min={0} value={minThreshold} onChange={e => setMinThreshold(Number(e.target.value))} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Category</label>
                  <select className="form-select" value={category} onChange={e => setCategory(e.target.value)}>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={rowFormStyle}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Vendor Name</label>
                  <input type="text" placeholder="e.g. Acme Supplies Co." className="form-input" value={vName} onChange={e => setVName(e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Vendor Email</label>
                  <input type="email" placeholder="e.g. sales@acmesupplies.com" className="form-input" value={vEmail} onChange={e => setVEmail(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" onClick={() => setIsEditOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vendor Reorder Modal */}
      {isReorderOpen && reorderItem && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <div style={modalHeaderStyle}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={20} style={{ color: 'var(--warning)' }} />
                Reorder Item: {reorderItem.sku}
              </h3>
              <button onClick={() => setIsReorderOpen(false)} style={closeBtnStyle}>X</button>
            </div>
            
            <div style={{ 
              padding: '12px 14px', 
              background: 'var(--warning-glow)', 
              border: '1px solid rgba(245, 158, 11, 0.2)', 
              borderRadius: '6px', 
              fontSize: '12px', 
              color: 'var(--warning)', 
              marginBottom: '16px', 
              lineHeight: '1.4' 
            }}>
              <strong>Low Stock Alert:</strong> Current quantity is <strong>{reorderItem.quantity}</strong>, safety limit is <strong>{reorderItem.min_threshold}</strong>.
            </div>

            <form onSubmit={handleReorderSubmit}>
              <div style={rowFormStyle}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Vendor Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    required 
                    placeholder="e.g. Acme Supplies Co."
                    value={reorderVName} 
                    onChange={e => setReorderVName(e.target.value)} 
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Vendor Email</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    required 
                    placeholder="e.g. sales@acmesupplies.com"
                    value={reorderVEmail} 
                    onChange={e => setReorderVEmail(e.target.value)} 
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Reorder Quantity</label>
                <input 
                  type="number" 
                  className="form-input" 
                  required 
                  min={1} 
                  value={reorderQty} 
                  onChange={e => setReorderQty(Math.max(1, Number(e.target.value)))} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Draft Preview</label>
                <div style={{ 
                  padding: '12px', 
                  background: 'var(--bg-tertiary)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '6px', 
                  fontSize: '11px', 
                  fontFamily: 'monospace', 
                  whiteSpace: 'pre-wrap', 
                  color: 'var(--text-secondary)',
                  maxHeight: '130px',
                  overflowY: 'auto'
                }}>
                  {`To: ${reorderVEmail || '(Enter Email)'}\n` +
                   `Subject: REORDER REQUEST: SKU ${reorderItem.sku}\n\n` +
                   `Hi ${reorderVName || 'Supplier'},\n\n` +
                   `We would like to place an order for ${reorderQty} units of the following SKU:\n` +
                   `- Product: ${reorderItem.name}\n` +
                   `- SKU: ${reorderItem.sku}\n` +
                   `- Delivery Location: ${reorderItem.location}\n\n` +
                   `Please reply with your invoice and estimated delivery date.\n\n` +
                   `Best regards,\n` +
                   `${user.name}`}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" onClick={() => setIsReorderOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--warning)', borderColor: 'var(--warning)' }}>
                  Send Reorder Email
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Inline CSS overrides
const controlsRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '16px'
};

const searchWrapperStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  flex: 1,
  maxWidth: '400px'
};

const searchIconStyle: React.CSSProperties = {
  position: 'absolute',
  left: '12px',
  color: 'var(--text-secondary)'
};

const searchInputStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  padding: '8px 12px 8px 38px',
  color: '#fff',
  width: '100%',
  fontSize: '13px',
  outline: 'none',
  fontFamily: 'var(--font-body)'
};

const btnSmStyle: React.CSSProperties = {
  padding: '8px 14px',
  fontSize: '13px'
};

const catBadgeStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-tertiary)',
  border: '1px solid var(--border-color)',
  padding: '2px 8px',
  borderRadius: '4px',
  fontSize: '11px',
  color: 'var(--text-secondary)',
};

const rowFormStyle: React.CSSProperties = {
  display: 'flex',
  gap: '16px'
};

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  backgroundColor: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10000,
  backdropFilter: 'blur(4px)'
};

const modalContentStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  borderRadius: '12px',
  padding: '24px',
  width: '100%',
  maxWidth: '520px',
  boxShadow: 'var(--shadow-lg)'
};

const modalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderBottom: '1px solid var(--border-color)',
  paddingBottom: '12px'
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontSize: '16px',
  fontWeight: 'bold'
};

export default Inventory;
