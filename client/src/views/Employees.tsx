import React, { useState, useMemo } from 'react';
import { useToast } from '../components/Toast';
import { Trash2, UserPlus, Edit3 } from 'lucide-react';

interface EmployeesProps {
  user: { email: string; role: string; name: string };
  users: any[];
  onAddUser: (fields: any) => Promise<boolean>;
  onDeleteUser: (email: string) => Promise<boolean>;
  onPromoteUser?: (email: string, role: string) => Promise<boolean>;
  onResetPassword?: (email: string, newPass: string) => Promise<boolean>;
  onChangeName?: (email: string, newName: string) => Promise<boolean>;
}

export const Employees: React.FC<EmployeesProps> = ({ user, users, onAddUser, onDeleteUser, onPromoteUser, onResetPassword, onChangeName }) => {
  const { showToast } = useToast();
  const isAdmin = user.role === 'Administrator';
  const isManager = user.role === 'Warehouse Manager';

  // Add User Form States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState(isManager ? 'Staff' : 'Warehouse Manager');

  // Enforce UI Listing Constraints
  const filteredUsers = useMemo(() => {
    if (isAdmin) {
      return users; // Admin sees everyone
    }
    if (isManager) {
      return users.filter(u => u.role === 'Staff'); // Managers see only Staff
    }
    return [];
  }, [users, isAdmin, isManager]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name || !role) {
      showToast('All fields are required', 'error');
      return;
    }

    if (isManager && role !== 'Staff') {
      showToast('Managers are restricted to creating Staff accounts only', 'error');
      return;
    }

    const success = await onAddUser({ email, password, name, role });
    if (success) {
      setIsAddOpen(false);
      setEmail('');
      setPassword('');
      setName('');
      setRole(isManager ? 'Staff' : 'Warehouse Manager');
    }
  };

  return (
    <div className="page-container animate-slide-up">
      <div style={headerRowStyle}>
        <div>
          <h3>Employee Directory & Access Control</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
            {isAdmin 
              ? 'Administrator privilege active: Managing all roles and credentials.' 
              : 'Warehouse Manager privilege active: Managing Staff roles only.'}
          </p>
        </div>
        <button onClick={() => setIsAddOpen(true)} className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '13px' }}>
          <UserPlus size={16} /> Register Employee
        </button>
      </div>

      {/* User listing panel */}
      <div className="panel-glass">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email Address</th>
                <th>Security Role</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(profile => (
                <tr key={profile.email}>
                  <td style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '52px' }}>
                    <div className="user-avatar" style={{ width: '28px', height: '28px', fontSize: '11px' }}>
                      {profile.name.substring(0, 2).toUpperCase()}
                    </div>
                    <span style={{ fontWeight: 'bold' }}>{profile.name}</span>
                  </td>
                  <td>{profile.email}</td>
                  <td>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      backgroundColor: profile.role === 'Administrator' 
                        ? 'var(--danger-glow)' 
                        : profile.role === 'Warehouse Manager' 
                        ? 'var(--accent-primary-glow)' 
                        : 'var(--accent-teal-glow)',
                      color: profile.role === 'Administrator' 
                        ? 'var(--danger)' 
                        : profile.role === 'Warehouse Manager' 
                        ? '#a5b4fc' 
                        : 'var(--accent-teal)',
                      border: `1px solid ${profile.role === 'Administrator' 
                        ? 'rgba(239,68,68,0.2)' 
                        : profile.role === 'Warehouse Manager' 
                        ? 'rgba(92,107,192,0.2)' 
                        : 'rgba(38,166,154,0.2)'}`
                    }}>
                      {profile.role}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      {isAdmin && onChangeName && (
                        <button
                          onClick={() => {
                            const newName = window.prompt(`Enter new name for ${profile.name} (${profile.email}):`, profile.name);
                            if (newName) {
                              const trimmed = newName.trim();
                              if (trimmed.length < 2) {
                                showToast('Name must be at least 2 characters long.', 'error');
                              } else {
                                onChangeName(profile.email, trimmed);
                              }
                            }
                          }}
                          className="btn btn-secondary btn-icon"
                          style={{ color: 'var(--accent-teal)', padding: '6px', marginRight: '8px' }}
                          title="Change Employee Name"
                        >
                          <Edit3 size={14} />
                        </button>
                      )}

                      {profile.email === user.email ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Active Account</span>
                          {isAdmin && onResetPassword && (
                            <button
                              onClick={() => {
                                const newPass = window.prompt(`Enter new password for yourself (${profile.email}):`);
                                if (newPass) {
                                  const trimmed = newPass.trim();
                                  if (trimmed.length < 6) {
                                    showToast('Password must be at least 6 characters long.', 'error');
                                  } else {
                                    onResetPassword(profile.email, trimmed);
                                  }
                                }
                              }}
                              className="btn btn-secondary"
                              style={{ 
                                padding: '4px 8px', 
                                fontSize: '11px', 
                                borderColor: 'var(--accent-teal)', 
                                color: 'var(--accent-teal)',
                                backgroundColor: 'var(--accent-teal-glow)'
                              }}
                              title="Change Your Own Password"
                            >
                              Reset Pass
                            </button>
                          )}
                        </div>
                      ) : (
                        <>
                          {isAdmin && profile.role === 'Staff' && onPromoteUser && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Promote ${profile.name} (${profile.email}) to Warehouse Manager?`)) {
                                  onPromoteUser(profile.email, 'Warehouse Manager');
                                }
                              }}
                              className="btn btn-secondary"
                              style={{ 
                                padding: '4px 8px', 
                                fontSize: '11px', 
                                borderColor: 'var(--accent-primary)', 
                                color: 'var(--accent-primary)',
                                backgroundColor: 'var(--accent-primary-glow)',
                                marginRight: '8px'
                              }}
                              title="Promote to Manager"
                            >
                              Promote
                            </button>
                          )}
                          {isAdmin && profile.role === 'Warehouse Manager' && onPromoteUser && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Demote ${profile.name} (${profile.email}) to Staff Operator?`)) {
                                  onPromoteUser(profile.email, 'Staff');
                                }
                              }}
                              className="btn btn-secondary"
                              style={{ 
                                padding: '4px 8px', 
                                fontSize: '11px', 
                                borderColor: 'var(--danger)', 
                                color: 'var(--danger)',
                                backgroundColor: 'var(--danger-glow)',
                                marginRight: '8px'
                              }}
                              title="Demote to Staff"
                            >
                              Demote
                            </button>
                          )}
                          {isAdmin && onResetPassword && (
                            <button
                              onClick={() => {
                                const newPass = window.prompt(`Enter new password for ${profile.name} (${profile.email}):`);
                                if (newPass) {
                                  const trimmed = newPass.trim();
                                  if (trimmed.length < 6) {
                                    showToast('Password must be at least 6 characters long.', 'error');
                                  } else {
                                    onResetPassword(profile.email, trimmed);
                                  }
                                }
                              }}
                              className="btn btn-secondary"
                              style={{ 
                                padding: '4px 8px', 
                                fontSize: '11px', 
                                borderColor: 'var(--accent-teal)', 
                                color: 'var(--accent-teal)',
                                backgroundColor: 'var(--accent-teal-glow)',
                                marginRight: '8px'
                              }}
                              title="Manually Change Password"
                            >
                              Reset Pass
                            </button>
                          )}
                          <button
                            onClick={() => onDeleteUser(profile.email)}
                            className="btn btn-secondary btn-icon"
                            style={{ color: 'var(--danger)', padding: '6px' }}
                            title="Delete Profile"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No employees registered in this registry scope.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {isAddOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <div style={modalHeaderStyle}>
              <h3>Register New Employee Profile</h3>
              <button onClick={() => setIsAddOpen(false)} style={closeBtnStyle}>X</button>
            </div>
            <form onSubmit={handleSubmit} style={{ marginTop: '16px' }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  className="form-input"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address (Login ID)</label>
                <input
                  type="email"
                  placeholder="name@nexus.com"
                  className="form-input"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Temporary Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="form-input"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Security Access Role</label>
                {isManager ? (
                  <select className="form-select" disabled value="Staff">
                    <option value="Staff">Staff (Restricted Access)</option>
                  </select>
                ) : (
                  <select className="form-select" value={role} onChange={e => setRole(e.target.value)}>
                    <option value="Warehouse Manager">Warehouse Manager</option>
                    <option value="Staff">Staff (Restricted Access)</option>
                    <option value="Administrator">Administrator (Full Access)</option>
                  </select>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" onClick={() => setIsAddOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Create Profile</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Styles
const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
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
  maxWidth: '440px',
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

export default Employees;
