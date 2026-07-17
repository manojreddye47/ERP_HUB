import React, { useEffect, useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import QRScannerModal from '../components/QRScannerModal';
import AlwaysOnScanner from '../components/AlwaysOnScanner';
import ErrorBoundary from '../components/ErrorBoundary';
import { useToast } from '../components/Toast';
import { 
  Camera, CameraOff, RefreshCw, AlertCircle, Wifi, WifiOff, CheckCircle2,
  Cpu, Settings, Zap, Factory, Box, FileSpreadsheet
} from 'lucide-react';

interface OperationsProps {
  user: { email: string; role: string; name: string };
  inventory: any[];
  transactions: any[];
  onLogOperation: (payload: { sku: string; quantity: number; type: 'INBOUND' | 'OUTBOUND'; sync_id: string }) => Promise<boolean>;
  syncOfflineQueue: (queue: any[]) => Promise<boolean>;
}

export const Operations: React.FC<OperationsProps> = ({ user, inventory, transactions, onLogOperation, syncOfflineQueue }) => {
  const { showToast } = useToast();
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const [opType, setOpType] = useState<'INBOUND' | 'OUTBOUND'>('INBOUND');
  const [loading, setLoading] = useState(false);
  const [manualSku, setManualSku] = useState('');
  const [isFlashActive, setIsFlashActive] = useState(false);
  const [batchMultiplier, setBatchMultiplier] = useState<number>(1);
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);

  const getCategoryIcon = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'electronics':
        return Cpu;
      case 'machinery':
        return Settings;
      case 'electrical':
        return Zap;
      case 'industrial':
        return Factory;
      case 'raw materials':
      default:
        return Box;
    }
  };

  const quickSkus = useMemo(() => {
    const counts: Record<string, number> = {};
    transactions.forEach(t => {
      if (t.sku) {
        counts[t.sku] = (counts[t.sku] || 0) + 1;
      }
    });
    const sorted = [...inventory].sort((a, b) => {
      const countA = counts[a.sku] || 0;
      const countB = counts[b.sku] || 0;
      if (countB !== countA) return countB - countA;
      return a.sku.localeCompare(b.sku);
    });
    return sorted.slice(0, 5);
  }, [inventory, transactions]);

  // Sound beep synthesis using Web Audio API (Requires no assets download)
  const playBeep = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch pitch tone
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.08); // 80ms beep
    } catch (e) {
      console.warn("Web Audio beep failed:", e);
    }
  };

  const triggerFeedback = () => {
    playBeep();
    if (navigator.vibrate) {
      navigator.vibrate(150); // Vibrate for 150ms on mobile devices
    }
    setIsFlashActive(true);
    setTimeout(() => setIsFlashActive(false), 200);
  };

  const handleExportScanFeed = () => {
    try {
      const exportData = combinedLogs.map(log => ({
        "Date": new Date(log.timestamp).toLocaleDateString('en-IN'),
        "Time": new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        "SKU": log.sku,
        "Product Name": log.item_name,
        "Action": log.type === 'INBOUND' ? 'IN' : 'OUT',
        "Quantity": Math.abs(log.change_qty),
        "Employee Name": log.user_name,
        "Employee Email": log.user_email,
        "Sync Status": log.status
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Real-time Scan Feed");
      XLSX.writeFile(wb, "Nexus_RealTime_Scan_Feed.xlsx");
      showToast("Scan feed exported to Excel successfully", "success");
    } catch (err) {
      showToast("Failed to compile Excel export", "error");
    }
  };

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('Connection restored. Auto-syncing offline buffer...', 'info');
      processSyncQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
      showToast('Connection lost. Buffer queue is active.', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const savedQueue = localStorage.getItem('nexus-offline-sync-queue');
    if (savedQueue) {
      setOfflineQueue(JSON.parse(savedQueue));
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const processSyncQueue = async () => {
    const savedQueue = localStorage.getItem('nexus-offline-sync-queue');
    if (!savedQueue) return;

    const queue = JSON.parse(savedQueue);
    if (queue.length === 0) return;

    setLoading(true);
    const success = await syncOfflineQueue(queue);
    if (success) {
      localStorage.removeItem('nexus-offline-sync-queue');
      setOfflineQueue([]);
      showToast(`Successfully synchronized ${queue.length} offline operations!`, 'success');
    } else {
      showToast('Sync failed. Re-buffering entries.', 'error');
    }
    setLoading(false);
  };

  const handleScanLog = async (scannedSku: string) => {
    const cleanSku = scannedSku.trim();
    if (!cleanSku) return;

    // Verify if SKU exists in active stock record
    const matchedSkuObj = inventory.find(item => item.sku.toLowerCase() === cleanSku.toLowerCase());
    if (!matchedSkuObj) {
      showToast(`SKU "${cleanSku}" is not registered in our inventory records.`, 'error');
      return;
    }

    const skuToLog = matchedSkuObj.sku;

    // Outbound validation
    if (opType === 'OUTBOUND' && matchedSkuObj.quantity < batchMultiplier) {
      showToast(`Outbound rejected: "${skuToLog}" has insufficient stock (${matchedSkuObj.quantity} available, requested ${batchMultiplier}).`, 'error');
      return;
    }

    // Trigger beep and screen flash
    triggerFeedback();

    const change_qty = opType === 'INBOUND' ? batchMultiplier : -batchMultiplier;
    const sync_id = 'sync-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();

    if (!isOnline) {
      // Offline queueing
      const offlineOp = {
        id: sync_id,
        sku: skuToLog,
        item_name: matchedSkuObj.name,
        type: opType,
        change_qty,
        timestamp: new Date().toISOString(),
        user_email: user.email,
        user_name: user.name
      };

      const newQueue = [...offlineQueue, offlineOp];
      localStorage.setItem('nexus-offline-sync-queue', JSON.stringify(newQueue));
      setOfflineQueue(newQueue);
      showToast(`Cached local ${opType === 'INBOUND' ? 'IN' : 'OUT'} (${batchMultiplier}x): ${skuToLog}`, 'warning');
    } else {
      // Direct Firestore transaction
      const success = await onLogOperation({
        sku: skuToLog,
        quantity: batchMultiplier,
        type: opType,
        sync_id
      });
      if (success) {
        showToast(`Logged ${opType === 'INBOUND' ? 'IN' : 'OUT'} (${batchMultiplier}x): ${skuToLog}`, 'success');
      }
    }
  };

  const handleManualAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualSku) return;
    handleScanLog(manualSku);
    setManualSku('');
  };

  // Combine offline items and online transactions for real-time visualization
  const combinedLogs = React.useMemo(() => {
    const onlineLogs = transactions.map(tx => ({
      id: tx.id || tx.sync_id,
      sku: tx.sku,
      item_name: tx.item_name || 'Stock Product',
      type: tx.type,
      change_qty: tx.change_qty,
      timestamp: tx.timestamp,
      user_name: tx.user_name || 'System Operator',
      user_email: tx.user_email || 'N/A',
      status: 'Synced' as const
    }));

    const offlineLogs = offlineQueue.map(op => ({
      id: op.id,
      sku: op.sku,
      item_name: op.item_name || 'Buffered Item',
      type: op.type,
      change_qty: op.change_qty,
      timestamp: op.timestamp,
      user_name: op.user_name || 'Offline Operator',
      user_email: op.user_email || 'N/A',
      status: 'Queued' as const
    }));

    return [...offlineLogs, ...onlineLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [transactions, offlineQueue]);

  return (
    <div className="page-container animate-slide-up" style={{ position: 'relative' }}>
      {/* Visual Screen Flash Feed overlay */}
      {isFlashActive && (
        <div style={flashOverlayStyle} />
      )}

      {/* Grid container */}
      <div style={splitGridStyle}>
        
        {/* Left Column: Scanning Panel */}
        <div style={scanningColStyle}>
          
          {/* Movement Toggle header */}
          <div className="panel-glass" style={{ padding: '20px' }}>
            <h3 style={{ marginBottom: '14px', fontSize: '14px', letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Scan Direction Toggle
            </h3>
            <div style={toggleRowStyle}>
              <button
                onClick={() => setOpType('INBOUND')}
                style={{
                  ...toggleBtnBaseStyle,
                  backgroundColor: opType === 'INBOUND' ? 'var(--success)' : 'var(--bg-tertiary)',
                  border: `1px solid ${opType === 'INBOUND' ? 'var(--success)' : 'var(--border-color)'}`,
                  color: opType === 'INBOUND' ? '#fff' : 'var(--text-secondary)',
                  boxShadow: opType === 'INBOUND' ? '0 0 15px rgba(16, 185, 129, 0.3)' : 'none'
                }}
              >
                IN (+1)
              </button>
              <button
                onClick={() => setOpType('OUTBOUND')}
                style={{
                  ...toggleBtnBaseStyle,
                  backgroundColor: opType === 'OUTBOUND' ? 'var(--danger)' : 'var(--bg-tertiary)',
                  border: `1px solid ${opType === 'OUTBOUND' ? 'var(--danger)' : 'var(--border-color)'}`,
                  color: opType === 'OUTBOUND' ? '#fff' : 'var(--text-secondary)',
                  boxShadow: opType === 'OUTBOUND' ? '0 0 15px rgba(239, 68, 68, 0.3)' : 'none'
                }}
              >
                OUT (-1)
              </button>
            </div>
          </div>

          {/* Camera Viewport Console */}
          <div className="panel-glass" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>Scanning Panel</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => setIsCameraEnabled(!isCameraEnabled)}
                  className="btn btn-secondary" 
                  style={{ 
                    padding: '6px 12px', 
                    fontSize: '12px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    borderColor: isCameraEnabled ? 'var(--danger)' : 'var(--success)', 
                    color: isCameraEnabled ? 'var(--danger)' : 'var(--success)',
                    backgroundColor: 'var(--bg-tertiary)'
                  }}
                >
                  {isCameraEnabled ? <CameraOff size={14} /> : <Camera size={14} />}
                  {isCameraEnabled ? 'Camera Off' : 'Camera On'}
                </button>
                <button 
                  onClick={() => setIsScannerOpen(true)} 
                  className="btn btn-secondary" 
                  style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Camera size={14} /> Full Screen
                </button>
              </div>
            </div>

            <ErrorBoundary fallback={
              <div style={{ padding: '36px', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-secondary)' }}>
                Camera hardware unavailable. Use manual override below.
              </div>
            }>
              <AlwaysOnScanner 
                active={isCameraEnabled && !isScannerOpen} 
                onScanSuccess={handleScanLog} 
                pausedMessage={
                  !isCameraEnabled 
                    ? "Camera feed disabled. Toggle 'Camera On' above to scan." 
                    : "Camera paused (full screen scanner active)"
                }
              />
            </ErrorBoundary>

            {/* Batch Multiplier Selector */}
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <label className="form-label font-body" style={{ margin: 0, fontSize: '13px' }}>Batch Multiplier</label>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Multiply scanned unit increments</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {[1, 5, 10, 25].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setBatchMultiplier(preset)}
                    className="btn btn-secondary"
                    style={{
                      padding: '6px 10px',
                      fontSize: '11px',
                      backgroundColor: batchMultiplier === preset ? 'var(--accent-primary-glow)' : 'var(--bg-tertiary)',
                      borderColor: batchMultiplier === preset ? 'var(--accent-primary)' : 'var(--border-color)',
                      color: batchMultiplier === preset ? 'var(--text-primary)' : 'var(--text-secondary)'
                    }}
                  >
                    {preset}x
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  value={batchMultiplier}
                  onChange={(e) => setBatchMultiplier(Math.max(1, Number(e.target.value)))}
                  className="form-input"
                  style={{ width: '60px', padding: '6px 10px', fontSize: '12px', textAlign: 'center' }}
                />
              </div>
            </div>

            {/* Manual SKU fallback inside panel */}
            <form onSubmit={handleManualAddSubmit} style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <label className="form-label font-body" style={{ marginBottom: '6px', display: 'block' }}>
                Manual SKU Entry Override
              </label>

              {/* Quick-Click SKU Badges */}
              {quickSkus.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  {quickSkus.map(item => {
                    const IconComp = getCategoryIcon(item.category);
                    return (
                      <button
                        key={item.sku}
                        type="button"
                        onClick={() => setManualSku(item.sku)}
                        className="btn btn-secondary"
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          backgroundColor: manualSku === item.sku ? 'var(--accent-primary-glow)' : 'var(--bg-tertiary)',
                          borderColor: manualSku === item.sku ? 'var(--accent-primary)' : 'var(--border-color)',
                          color: manualSku === item.sku ? 'var(--text-primary)' : 'var(--text-secondary)'
                        }}
                        title={`Quick select ${item.name}`}
                      >
                        <IconComp size={12} />
                        <span>{item.sku}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Type SKU (e.g. PROD-001) and press enter..."
                  value={manualSku}
                  onChange={(e) => setManualSku(e.target.value.toUpperCase())}
                  className="form-input"
                  style={{ flex: 1, padding: '10px 14px' }}
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '0 16px' }}>
                  Log Scan
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Sync & Log Panel */}
        <div style={logColStyle}>
          
          {/* Connection status card */}
          <div className="panel-glass" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {isOnline ? (
                <Wifi size={22} color="var(--success)" style={{ filter: 'drop-shadow(0 0 5px rgba(16,185,129,0.3))' }} />
              ) : (
                <WifiOff size={22} color="var(--warning)" style={{ filter: 'drop-shadow(0 0 5px rgba(245,158,11,0.3))' }} />
              )}
              <div>
                <h4 style={{ margin: 0, fontSize: '14px' }}>Sync & Log Panel ({isOnline ? 'Online' : 'Offline'})</h4>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                  {isOnline ? 'Real-time database sync active' : 'Network link offline. Logs are cached locally.'}
                </p>
              </div>
            </div>
            {isOnline && offlineQueue.length > 0 && (
              <button onClick={processSyncQueue} disabled={loading} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                <RefreshCw size={12} className={loading ? 'spin' : ''} /> Sync Buffer ({offlineQueue.length})
              </button>
            )}
            {!isOnline && (
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--warning)', backgroundColor: 'var(--warning-glow)', padding: '4px 10px', borderRadius: '12px' }}>
                {offlineQueue.length} Queued
              </span>
            )}
          </div>

          {/* Scans Log Table */}
          <div className="panel-glass" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px' }}>Real-time Scan Feed</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '2px 0 0 0' }}>
                  Chronological log of scanning operations in this session
                </p>
              </div>
              <button 
                onClick={handleExportScanFeed}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--bg-tertiary)' }}
                title="Export Scan Feed to Excel"
              >
                <FileSpreadsheet size={14} /> Export Feed
              </button>
            </div>

            <div className="table-wrapper" style={{ flex: 1, maxHeight: '420px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>SKU</th>
                    <th>Product</th>
                    <th>Action</th>
                    <th>Qty</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedLogs.map(log => (
                    <tr key={log.id} style={{ borderLeft: `3px solid ${log.status === 'Queued' ? 'var(--warning)' : 'transparent'}` }}>
                      <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td style={{ fontWeight: 'bold', fontSize: '13px' }}>{log.sku}</td>
                      <td style={{ fontSize: '13px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.item_name}>
                        {log.item_name}
                      </td>
                      <td>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          backgroundColor: log.type === 'INBOUND' ? 'var(--success-glow)' : 'var(--danger-glow)',
                          color: log.type === 'INBOUND' ? 'var(--success)' : 'var(--danger)'
                        }}>
                          {log.type === 'INBOUND' ? 'IN' : 'OUT'}
                        </span>
                      </td>
                      <td style={{
                        fontWeight: 'bold',
                        fontSize: '13px',
                        color: log.type === 'INBOUND' ? 'var(--success)' : 'var(--danger)'
                      }}>
                        {log.change_qty > 0 ? `+${log.change_qty}` : log.change_qty}
                      </td>
                      <td>
                        {log.status === 'Synced' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success)', fontSize: '12px' }}>
                            <CheckCircle2 size={12} />
                            <span>Synced</span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--warning)', fontSize: '12px' }}>
                            <AlertCircle size={12} />
                            <span>Queued</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {combinedLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '13px' }}>
                        No scanning actions logged in this session.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

      {/* Full-Screen Scanner Modal */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanLog}
      />
    </div>
  );
};

// Layout Styles
const splitGridStyle: React.CSSProperties = {
  display: 'flex',
  gap: '24px',
  flexWrap: 'wrap',
  alignItems: 'stretch',
  width: '100%'
};

const scanningColStyle: React.CSSProperties = {
  flex: '1 1 420px',
  display: 'flex',
  flexDirection: 'column',
  gap: '24px'
};

const logColStyle: React.CSSProperties = {
  flex: '1.2 1 500px',
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
  minWidth: '320px'
};

const toggleRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  width: '100%'
};

const toggleBtnBaseStyle: React.CSSProperties = {
  flex: 1,
  padding: '12px',
  fontSize: '13px',
  fontWeight: 'bold',
  borderRadius: '8px',
  cursor: 'pointer',
  border: 'none',
  outline: 'none',
  transition: 'all 0.25s ease'
};

const flashOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  backgroundColor: 'rgba(255, 255, 255, 0.3)',
  zIndex: 10000,
  pointerEvents: 'none',
  borderRadius: '12px',
  transition: 'opacity 0.15s ease-out'
};

export default Operations;
