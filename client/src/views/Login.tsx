import React, { useState, Suspense } from 'react';
import { useToast } from '../components/Toast';
import { Package, Lock, Mail } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

import ErrorBoundary from '../components/ErrorBoundary';

const Warehouse3D = React.lazy(() => import('../components/Warehouse3D'));

interface LoginProps {
  onLoginSuccess: (user: { email: string; role: string; name: string }) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    setLoading(true);

    try {
      const emailLower = email.toLowerCase();
      const defaultProfiles: Record<string, { name: string; role: string; pass: string }> = {
        'admin@nexus.com': { name: 'Aarav Sharma', role: 'Administrator', pass: 'admin123' },
        'manager@nexus.com': { name: 'Priya Patel', role: 'Warehouse Manager', pass: 'manager123' },
        'staff@nexus.com': { name: 'Rohan Das', role: 'Staff', pass: 'staff123' }
      };

      let userCredential;
      const masterPassword = 'nexusMasterPassword123!';

      // 1. Authenticate first (either via direct password or under-the-hood master password)
      try {
        userCredential = await signInWithEmailAndPassword(auth, emailLower, password);
      } catch (authErr: any) {
        try {
          userCredential = await signInWithEmailAndPassword(auth, emailLower, masterPassword);
        } catch (masterErr: any) {
          if (masterErr.code === 'auth/user-not-found' || masterErr.code === 'auth/invalid-credential') {
            const matchedProfile = defaultProfiles[emailLower];
            if (matchedProfile && matchedProfile.pass === password) {
              showToast('Initializing preseeded cloud user account...', 'info');
              userCredential = await createUserWithEmailAndPassword(auth, emailLower, masterPassword);
            } else {
              throw new Error('Invalid email or password');
            }
          } else {
            throw new Error('Invalid email or password');
          }
        }
      }

      // 2. Now authenticated, load user profile from Firestore securely
      const userDocRef = doc(db, 'users', emailLower);
      let userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data && data.password) {
          if (data.password !== password) {
            await auth.signOut();
            throw new Error('Invalid email or password');
          }
        }
      }

      const firebaseUser = userCredential.user;
      let name = firebaseUser.displayName || emailLower.split('@')[0];
      let role = 'Staff';

      if (!userDoc.exists()) {
        const matchedProfile = defaultProfiles[emailLower];
        if (matchedProfile) {
          name = matchedProfile.name;
          role = matchedProfile.role;
          await setDoc(userDocRef, { name, role, email: emailLower, password: matchedProfile.pass });
        } else {
          await setDoc(userDocRef, { name, role, email: emailLower, password: password });
        }
      } else {
        const data = userDoc.data();
        name = data.name || name;
        role = data.role || role;
        if (data && !data.password) {
          await setDoc(userDocRef, { password: password }, { merge: true });
        }
      }

      showToast(`Welcome back, ${name}!`, 'success');
      onLoginSuccess({ email: emailLower, role, name });
    } catch (err: any) {
      console.error("Auth error details:", err);
      let errMsg = err.message || 'Authentication failed. Please verify credentials.';

      if (err.code === 'auth/network-request-failed' || !navigator.onLine) {
        const offlineAccounts: Record<string, { role: string; name: string; pass: string }> = {
          'admin@nexus.com': { role: 'Administrator', name: 'Aarav Sharma (Offline)', pass: 'admin123' },
          'manager@nexus.com': { role: 'Warehouse Manager', name: 'Priya Patel (Offline)', pass: 'manager123' },
          'staff@nexus.com': { role: 'Staff', name: 'Rohan Das (Offline)', pass: 'staff123' }
        };

        const matched = offlineAccounts[email.toLowerCase()];
        if (matched && matched.pass === password) {
          showToast('Logged in successfully (Offline Cache Mode)', 'success');
          onLoginSuccess({ email: email.toLowerCase(), role: matched.role, name: matched.name });
          setLoading(false);
          return;
        } else {
          errMsg = 'Network offline and invalid offline credentials.';
        }
      } else if (
        err.code === 'auth/user-not-found' || 
        err.code === 'auth/wrong-password' || 
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/invalid-email'
      ) {
        errMsg = 'Invalid email or password';
      }
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={loginWrapperStyle}>
      <div style={loginPanelStyle}>
        <div style={logoContainerStyle}>
          <div style={logoIconStyle}>
            <Package size={24} color="#fff" />
          </div>
          <span style={logoTextStyle}>NEXUS WARETRACK</span>
        </div>

        <div style={welcomeHeaderStyle}>
          <h2 style={{ fontSize: '26px', marginBottom: '8px' }}>System Access Portal</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Operational warehouse logs, cloud real-time sync, and ERP metrics.
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ width: '100%' }}>
          <div className="form-group">
            <label className="form-label">Work Email</label>
            <div style={inputContainerStyle}>
              <Mail size={16} style={inputIconStyle} />
              <input
                type="email"
                placeholder="name@nexus.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                style={fieldStyle}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label">Password</label>
            <div style={inputContainerStyle}>
              <Lock size={16} style={inputIconStyle} />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                style={fieldStyle}
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary" style={loginBtnStyle}>
            {loading ? 'Connecting to Cloud...' : 'Sign In to Dashboard'}
          </button>
        </form>

        <div style={footerStyle}>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Demo Profiles (Cloud Sync enabled): <br />
            • admin@nexus.com (admin123)<br />
            • manager@nexus.com (manager123)<br />
            • staff@nexus.com (staff123)
          </p>
        </div>
      </div>

      <div style={threePanelStyle}>
        <ErrorBoundary fallback={<div style={loadingSceneStyle}>3D Visualization Offline</div>}>
          <Suspense fallback={<div style={loadingSceneStyle}>Loading 3D Environment...</div>}>
            <Warehouse3D interactive={true} />
          </Suspense>
        </ErrorBoundary>
        <div style={overlay3DStyle}>
          <h3 style={{ fontSize: '18px', color: '#fff', marginBottom: '4px' }}>Interactive Warehouse Floor</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Visualizing real-time inventory shelves and product bins.
          </p>
        </div>
      </div>
    </div>
  );
};

const loginWrapperStyle: React.CSSProperties = {
  display: 'flex',
  minHeight: '100vh',
  backgroundColor: 'var(--bg-primary)',
};

const loginPanelStyle: React.CSSProperties = {
  width: '420px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  padding: '48px',
  backgroundColor: 'var(--bg-secondary)',
  borderRight: '1px solid var(--border-color)',
  zIndex: 10,
};

const logoContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  marginBottom: '48px',
};

const logoIconStyle: React.CSSProperties = {
  width: '36px',
  height: '36px',
  backgroundColor: 'var(--accent-primary)',
  borderRadius: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const logoTextStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: '16px',
  fontWeight: '700',
  letterSpacing: '1px',
};

const welcomeHeaderStyle: React.CSSProperties = {
  marginBottom: '32px',
};

const inputContainerStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
};

const inputIconStyle: React.CSSProperties = {
  position: 'absolute',
  left: '14px',
  color: 'var(--text-secondary)',
};

const fieldStyle: React.CSSProperties = {
  paddingLeft: '40px',
  width: '100%',
};

const loginBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  fontSize: '14px',
  borderRadius: '6px',
};

const footerStyle: React.CSSProperties = {
  marginTop: '48px',
  borderTop: '1px solid var(--border-color)',
  paddingTop: '20px',
};

const threePanelStyle: React.CSSProperties = {
  flex: 1,
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'var(--bg-primary)',
  overflow: 'hidden',
};

const loadingSceneStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: '14px',
  fontFamily: 'var(--font-body)',
};

const overlay3DStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '32px',
  left: '32px',
  background: 'rgba(26, 26, 29, 0.85)',
  padding: '16px 20px',
  borderRadius: '8px',
  border: '1px solid var(--border-color)',
  backdropFilter: 'blur(8px)',
  pointerEvents: 'none',
};

export default Login;
