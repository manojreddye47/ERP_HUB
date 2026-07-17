import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send } from 'lucide-react';

interface ChatMessage {
  sender: 'user' | 'bot';
  text: string | React.ReactNode;
  timestamp: Date;
}

interface ChatbotProps {
  inventory: any[];
  transactions: any[];
}

export const Chatbot: React.FC<ChatbotProps> = ({ inventory, transactions }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: 'bot',
      text: 'Hello! I am Nexus Bot, your warehouse AI assistant. Ask me anything about stock valuations, low stock, item locations, categories, out-of-stock items, or weekly reports!',
      timestamp: new Date()
    }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: ChatMessage = {
      sender: 'user',
      text: textToSend,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    setTimeout(() => {
      const response = processQuery(textToSend);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: response,
          timestamp: new Date()
        }
      ]);
    }, 500);
  };

  const processQuery = (query: string): string | React.ReactNode => {
    const q = query.toLowerCase();

    // 1. Total Valuation Query
    if (q.includes('valuation') || q.includes('worth') || q.includes('total value') || q.includes('total price') || q.includes('inventory value')) {
      const totalVal = inventory.reduce((sum, item) => sum + (item.quantity * item.price), 0);
      const totalQty = inventory.reduce((sum, item) => sum + item.quantity, 0);
      return (
        <div>
          <p><strong>Inventory Valuation Summary:</strong></p>
          <ul style={{ paddingLeft: '16px', margin: '6px 0', fontSize: '12px' }}>
            <li>Unique SKU Profiles: {inventory.length}</li>
            <li>Total Binned Units: {totalQty.toLocaleString('en-IN')} units</li>
            <li>Total Net Worth: <strong style={{ color: 'var(--accent-teal)' }}>₹{totalVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong></li>
          </ul>
        </div>
      );
    }

    // 2. Out of Stock Query
    if (q.includes('out of stock') || q.includes('empty') || q.includes('zero stock') || q.includes('depleted') || q.includes('unavailable')) {
      const outOfStock = inventory.filter(item => item.quantity === 0);
      if (outOfStock.length === 0) {
        return "Excellent! We currently have no items that are completely out of stock.";
      }
      return (
        <div>
          <p style={{ marginBottom: '6px', color: 'var(--danger)', fontWeight: 'bold' }}>⚠️ Out of Stock Alert:</p>
          <ul style={{ paddingLeft: '16px', margin: '6px 0', fontSize: '12px' }}>
            {outOfStock.map(item => (
              <li key={item.sku}>{item.name} ({item.sku}) - Bin: {item.location}</li>
            ))}
          </ul>
        </div>
      );
    }

    // 3. Category Listing Query
    const categories = ['raw materials', 'electronics', 'machinery', 'electrical', 'industrial'];
    const matchedCategory = categories.find(cat => q.includes(cat));
    if (matchedCategory || q.includes('category') || q.includes('categories')) {
      const targetCat = matchedCategory || 'all';
      if (targetCat === 'all') {
        const counts: Record<string, number> = {};
        inventory.forEach(item => {
          counts[item.category] = (counts[item.category] || 0) + 1;
        });
        return (
          <div>
            <p><strong>Inventory Categories:</strong></p>
            <ul style={{ paddingLeft: '16px', margin: '6px 0', fontSize: '12px' }}>
              {Object.entries(counts).map(([name, count]) => (
                <li key={name}>{name}: {count} products</li>
              ))}
            </ul>
          </div>
        );
      } else {
        const catItems = inventory.filter(item => item.category.toLowerCase() === targetCat);
        return (
          <div>
            <p><strong>Category: {targetCat.toUpperCase()} ({catItems.length} items)</strong></p>
            <ul style={{ paddingLeft: '16px', margin: '6px 0', fontSize: '12px' }}>
              {catItems.slice(0, 8).map(item => (
                <li key={item.sku}>{item.name} ({item.sku}) - {item.quantity} units</li>
              ))}
              {catItems.length > 8 && <li>...and {catItems.length - 8} more products</li>}
            </ul>
          </div>
        );
      }
    }

    // 4. Low Stock Query
    if (q.includes('low') || q.includes('threshold') || q.includes('shortage') || q.includes('running low')) {
      const lowStock = inventory.filter(item => item.quantity <= item.min_threshold);
      if (lowStock.length === 0) {
        return "All items are well stocked! There are currently no products below their minimum safety thresholds.";
      }
      return (
        <div>
          <p style={{ marginBottom: '6px' }}>The following items are running low on stock:</p>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>SKU</th>
                <th style={thStyle}>Item</th>
                <th style={thStyle}>Qty</th>
                <th style={thStyle}>Loc</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.slice(0, 6).map(item => (
                <tr key={item.sku}>
                  <td style={tdStyle}>{item.sku}</td>
                  <td style={tdStyle}>{item.name}</td>
                  <td style={{ ...tdStyle, color: 'var(--danger)', fontWeight: 'bold' }}>{item.quantity}</td>
                  <td style={tdStyle}>{item.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {lowStock.length > 6 && <p style={{ fontSize: '10px', margin: '4px 0 0 0', color: 'var(--text-muted)' }}>...and {lowStock.length - 6} more low stock items.</p>}
        </div>
      );
    }

    // 5. Location Query
    if (q.includes('where') || q.includes('location') || q.includes('locate') || q.includes('find')) {
      const searchTerms = query.replace(/where is|location of|location|locate|find|product|item/gi, '').trim().toLowerCase();
      if (!searchTerms) {
        return "Please specify the SKU or name of the item. For example: 'Where is SKU-1002?' or 'Where is Steel Bars?'";
      }

      const match = inventory.find(item => 
        item.sku.toLowerCase().includes(searchTerms) || 
        item.name.toLowerCase().includes(searchTerms)
      );

      if (match) {
        return (
          <div>
            <p><strong>{match.name}</strong> ({match.sku}) is stored at:</p>
            <p style={{ fontSize: '15px', color: 'var(--accent-teal)', fontWeight: 'bold', margin: '6px 0' }}>
              📍 {match.location}
            </p>
            <p style={{ fontSize: '11px' }}>Current stock level: {match.quantity} units (Valued at ₹{match.price.toLocaleString('en-IN')}/unit)</p>
          </div>
        );
      } else {
        return `I couldn't find any item matching "${searchTerms}" in our system.`;
      }
    }

    // 6. Weekly Analysis Query
    if (q.includes('analysis') || q.includes('week') || q.includes('report') || q.includes('summary')) {
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const weeklyTx = transactions.filter(t => new Date(t.timestamp) >= oneWeekAgo);
      const inboundCount = weeklyTx.filter(t => t.type === 'INBOUND').length;
      const outboundCount = weeklyTx.filter(t => t.type === 'OUTBOUND').length;
      
      let totalInboundItems = 0;
      let totalOutboundItems = 0;
      
      weeklyTx.forEach(t => {
        if (t.type === 'INBOUND') totalInboundItems += Math.abs(t.change_qty);
        if (t.type === 'OUTBOUND') totalOutboundItems += Math.abs(t.change_qty);
      });

      return (
        <div>
          <p><strong>Weekly Analysis (Last 7 Days)</strong></p>
          <ul style={{ paddingLeft: '16px', margin: '6px 0', fontSize: '12px' }}>
            <li>Total Logged Movements: {weeklyTx.length}</li>
            <li>Inbound Runs: {inboundCount} (+{totalInboundItems} units)</li>
            <li>Outbound Runs: {outboundCount} (-{totalOutboundItems} units)</li>
            <li>Net Stock Flow: {totalInboundItems - totalOutboundItems} units</li>
          </ul>
        </div>
      );
    }

    // Default Fallback
    return (
      <div>
        <p>I didn't quite catch that. Try asking me about:</p>
        <ul style={{ paddingLeft: '16px', margin: '6px 0', fontSize: '12px' }}>
          <li><strong>Low Stock:</strong> e.g., "What is running low?"</li>
          <li><strong>Item Locations:</strong> e.g., "Where is product SKU-1111?"</li>
          <li><strong>Net Valuation:</strong> e.g., "What is our total inventory worth?"</li>
          <li><strong>Out of Stock:</strong> e.g., "Show me depleted items."</li>
          <li><strong>Categories:</strong> e.g., "Show raw materials category."</li>
          <li><strong>Weekly Analysis:</strong> e.g., "Give me a weekly summary report."</li>
        </ul>
      </div>
    );
  };

  return (
    <div className="chatbot-container">
      {!isOpen && (
        <button onClick={() => setIsOpen(true)} style={chatButtonStyle}>
          <MessageSquare size={24} color="#FFF" />
        </button>
      )}

      {isOpen && (
        <div style={chatWindowStyle} className="chat-window">
          <div style={chatHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={botAvatarStyle}>🤖</div>
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', fontFamily: 'var(--font-display)' }}>Nexus AI Assistant</h4>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>Operational Support</span>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} style={closeButtonStyle}>
              <X size={18} />
            </button>
          </div>

          <div style={messagesAreaStyle}>
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: '12px'
                }}
              >
                <div
                  style={{
                    backgroundColor: msg.sender === 'user' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                    color: msg.sender === 'user' ? '#fff' : 'var(--text-primary)',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    maxWidth: '85%',
                    fontSize: '13px',
                    lineHeight: '1.4',
                    fontFamily: 'var(--font-body)',
                    border: msg.sender === 'user' ? 'none' : '1px solid var(--border-color)'
                  }}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div style={inputAreaStyle}>
            <input
              type="text"
              placeholder="Ask a warehouse query..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
              style={inputStyle}
            />
            <button onClick={() => handleSend(input)} style={sendButtonStyle}>
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const chatButtonStyle: React.CSSProperties = {
  backgroundColor: 'var(--accent-primary)',
  border: 'none',
  borderRadius: '50%',
  width: '56px',
  height: '56px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: 'var(--shadow-lg)',
  transition: 'all 0.2s ease-in-out',
};

const chatWindowStyle: React.CSSProperties = {
  width: '340px',
  height: '440px',
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  borderRadius: '16px',
  boxShadow: 'var(--shadow-lg)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const chatHeaderStyle: React.CSSProperties = {
  padding: '12px 16px',
  backgroundColor: 'var(--bg-tertiary)',
  borderBottom: '1px solid var(--border-color)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
};

const botAvatarStyle: React.CSSProperties = {
  width: '28px',
  height: '28px',
  borderRadius: '50%',
  backgroundColor: 'var(--accent-teal-glow)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '14px'
};

const closeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center'
};

const messagesAreaStyle: React.CSSProperties = {
  flex: 1,
  padding: '16px',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column'
};

const inputAreaStyle: React.CSSProperties = {
  padding: '12px 16px',
  backgroundColor: 'var(--bg-tertiary)',
  borderTop: '1px solid var(--border-color)',
  display: 'flex',
  gap: '8px',
  alignItems: 'center'
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  backgroundColor: 'var(--bg-primary)',
  border: '1px solid var(--border-color)',
  borderRadius: '20px',
  padding: '8px 16px',
  color: 'var(--text-primary)',
  fontSize: '13px',
  outline: 'none',
  fontFamily: 'var(--font-body)'
};

const sendButtonStyle: React.CSSProperties = {
  backgroundColor: 'var(--accent-primary)',
  border: 'none',
  borderRadius: '50%',
  width: '32px',
  height: '32px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#fff'
};



const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  marginTop: '8px',
  fontSize: '11px',
  fontFamily: 'var(--font-body)'
};

const thStyle: React.CSSProperties = {
  borderBottom: '1px solid var(--border-color)',
  color: 'var(--text-secondary)',
  textAlign: 'left',
  padding: '4px'
};

const tdStyle: React.CSSProperties = {
  padding: '4px',
  borderBottom: '1px solid rgba(255,255,255,0.05)'
};

export default Chatbot;
