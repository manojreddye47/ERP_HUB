import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, doc, onSnapshot, setDoc, updateDoc, query, where } from 'firebase/firestore';
import { useToast } from '../components/Toast';
import { Clock, Edit, Plus, FileSpreadsheet, Check, X, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';

interface AttendanceProps {
  user: { email: string; role: string; name: string };
  users: any[];
}

export const Attendance: React.FC<AttendanceProps> = ({ user, users }) => {
  const { showToast } = useToast();
  const isAdmin = user.role === 'Administrator';

  // Sub-navigation state
  const [activeSubTab, setActiveSubTab] = useState<'clock' | 'leaves'>('clock');

  // Attendance states
  const [records, setRecords] = useState<any[]>([]);
  const [todayRecord, setTodayRecord] = useState<any | null>(null);

  // Filters for Admin (Clock In/Out tab)
  const todayDateStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local time
  const [filterDate, setFilterDate] = useState(todayDateStr);
  const [filterEmployee, setFilterEmployee] = useState('All');

  // Attendance Modals state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [editCheckIn, setEditCheckIn] = useState('');
  const [editCheckOut, setEditCheckOut] = useState('');
  const [editStatus, setEditStatus] = useState('Present');
  const [editNotes, setEditNotes] = useState('');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addDate, setAddDate] = useState(todayDateStr);
  const [addCheckIn, setAddCheckIn] = useState('09:00');
  const [addCheckOut, setAddCheckOut] = useState('17:00');
  const [addStatus, setAddStatus] = useState('Present');
  const [addNotes, setAddNotes] = useState('');

  // Leave system states
  const [leaves, setLeaves] = useState<any[]>([]);
  const [leaveStartDate, setLeaveStartDate] = useState('');
  const [leaveEndDate, setLeaveEndDate] = useState('');
  const [leaveType, setLeaveType] = useState('Casual Leave');
  const [leaveReason, setLeaveReason] = useState('');
  const [remarksInput, setRemarksInput] = useState<Record<string, string>>({});

  // 1. Subscribe to Attendance & Leaves
  useEffect(() => {
    // A. Attendance subscription
    let qAttendance = query(collection(db, 'attendance'));
    if (!isAdmin) {
      qAttendance = query(collection(db, 'attendance'), where('email', '==', user.email.toLowerCase()));
    }
    const unsubAttendance = onSnapshot(qAttendance, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ ...doc.data() });
      });
      const sorted = list.sort((a, b) => b.date.localeCompare(a.date));
      setRecords(sorted);

      const today = sorted.find(r => r.date === todayDateStr && r.email === user.email.toLowerCase());
      setTodayRecord(today || null);
    });

    // B. Leaves subscription
    let qLeaves = query(collection(db, 'leaves'));
    if (!isAdmin) {
      qLeaves = query(collection(db, 'leaves'), where('email', '==', user.email.toLowerCase()));
    }
    const unsubLeaves = onSnapshot(qLeaves, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ ...doc.data() });
      });
      // Sort: newest applied first
      const sorted = list.sort((a, b) => b.appliedOn.localeCompare(a.appliedOn));
      setLeaves(sorted);
    });

    return () => {
      unsubAttendance();
      unsubLeaves();
    };
  }, [user, isAdmin, todayDateStr]);

  // 2. Attendance Actions
  const handleCheckIn = async () => {
    try {
      const docId = `${user.email.toLowerCase()}_${todayDateStr}`;
      const checkInTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
      
      const [hours, minutes] = checkInTime.split(':').map(Number);
      const isLate = hours > 9 || (hours === 9 && minutes > 15);
      const status = isLate ? 'Late' : 'Present';

      await setDoc(doc(db, 'attendance', docId), {
        id: docId,
        email: user.email.toLowerCase(),
        name: user.name,
        date: todayDateStr,
        checkIn: checkInTime,
        checkOut: '',
        status: status,
        totalHours: 0,
        notes: 'Clocked in via active session portal',
        lastUpdatedBy: user.email
      });

      showToast(`Clocked In successfully at ${checkInTime}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Clock In failed', 'error');
    }
  };

  const handleCheckOut = async () => {
    if (!todayRecord) return;
    try {
      const checkOutTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
      const checkInTime = todayRecord.checkIn;

      const [inH, inM] = checkInTime.split(':').map(Number);
      const [outH, outM] = checkOutTime.split(':').map(Number);
      const diffMins = (outH * 60 + outM) - (inH * 60 + inM);
      const totalHours = Math.max(0, parseFloat((diffMins / 60).toFixed(2)));

      await updateDoc(doc(db, 'attendance', todayRecord.id), {
        checkOut: checkOutTime,
        totalHours: totalHours,
        lastUpdatedBy: user.email
      });

      showToast(`Clocked Out successfully at ${checkOutTime}. Duration: ${totalHours} hrs`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Clock Out failed', 'error');
    }
  };

  // 3. Admin Attendance overrides
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    try {
      let totalHours = 0;
      if (editCheckIn && editCheckOut) {
        const [inH, inM] = editCheckIn.split(':').map(Number);
        const [outH, outM] = editCheckOut.split(':').map(Number);
        const diffMins = (outH * 60 + outM) - (inH * 60 + inM);
        totalHours = Math.max(0, parseFloat((diffMins / 60).toFixed(2)));
      }

      await updateDoc(doc(db, 'attendance', editingRecord.id), {
        checkIn: editCheckIn,
        checkOut: editCheckOut,
        status: editStatus,
        totalHours: totalHours,
        notes: editNotes,
        lastUpdatedBy: user.email
      });

      showToast('Attendance record updated successfully', 'success');
      setIsEditOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Update failed', 'error');
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addEmail) {
      showToast('Please select an employee profile', 'error');
      return;
    }

    try {
      const selectedUser = users.find(u => u.email === addEmail);
      const name = selectedUser ? selectedUser.name : addEmail.split('@')[0];
      const docId = `${addEmail.toLowerCase()}_${addDate}`;

      let totalHours = 0;
      if (addCheckIn && addCheckOut) {
        const [inH, inM] = addCheckIn.split(':').map(Number);
        const [outH, outM] = addCheckOut.split(':').map(Number);
        const diffMins = (outH * 60 + outM) - (inH * 60 + inM);
        totalHours = Math.max(0, parseFloat((diffMins / 60).toFixed(2)));
      }

      await setDoc(doc(db, 'attendance', docId), {
        id: docId,
        email: addEmail.toLowerCase(),
        name: name,
        date: addDate,
        checkIn: addCheckIn,
        checkOut: addCheckOut,
        status: addStatus,
        totalHours: totalHours,
        notes: addNotes,
        lastUpdatedBy: user.email
      });

      showToast(`Manual record cataloged for ${name}`, 'success');
      setIsAddOpen(false);
      setAddEmail('');
      setAddDate(todayDateStr);
      setAddCheckIn('09:00');
      setAddCheckOut('17:00');
      setAddStatus('Present');
      setAddNotes('');
    } catch (err: any) {
      showToast(err.message || 'Log creation failed', 'error');
    }
  };

  // 4. Leave Request Actions
  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveStartDate || !leaveEndDate || !leaveReason) {
      showToast('Please specify dates and reason', 'error');
      return;
    }
    if (new Date(leaveStartDate) > new Date(leaveEndDate)) {
      showToast('Start Date cannot be after End Date', 'error');
      return;
    }

    try {
      const leaveId = `leave_${Date.now()}`;
      await setDoc(doc(db, 'leaves', leaveId), {
        id: leaveId,
        email: user.email.toLowerCase(),
        name: user.name,
        role: user.role,
        startDate: leaveStartDate,
        endDate: leaveEndDate,
        type: leaveType,
        reason: leaveReason,
        status: 'Pending',
        appliedOn: new Date().toISOString(),
        approvedBy: '',
        remarks: ''
      });

      showToast('Leave request submitted successfully', 'success');
      setLeaveStartDate('');
      setLeaveEndDate('');
      setLeaveReason('');
    } catch (err: any) {
      showToast(err.message || 'Failed to submit leave request', 'error');
    }
  };

  // 5. Admin Leave moderation
  const handleModerateLeave = async (leave: any, approve: boolean) => {
    try {
      const remarks = remarksInput[leave.id] || 'Moderated by Admin';
      const status = approve ? 'Approved' : 'Denied';

      await updateDoc(doc(db, 'leaves', leave.id), {
        status: status,
        approvedBy: user.email,
        remarks: remarks
      });

      // If approved, automatically populate attendance as "Absent" (On Leave)
      if (approve) {
        const start = new Date(leave.startDate);
        const end = new Date(leave.endDate);

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toLocaleDateString('en-CA');
          const docId = `${leave.email.toLowerCase()}_${dateStr}`;

          await setDoc(doc(db, 'attendance', docId), {
            id: docId,
            email: leave.email.toLowerCase(),
            name: leave.name,
            date: dateStr,
            checkIn: '--:--',
            checkOut: '--:--',
            status: 'Absent',
            totalHours: 0,
            notes: `Approved Leave: ${leave.type} - ${leave.reason}`,
            lastUpdatedBy: user.email
          });
        }
      }

      showToast(`Leave request ${status} successfully`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Leave moderation failed', 'error');
    }
  };

  // Filtering logs
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchDate = r.date === filterDate;
      const matchEmployee = filterEmployee === 'All' || r.email === filterEmployee.toLowerCase();
      return matchDate && matchEmployee;
    });
  }, [records, filterDate, filterEmployee]);

  const openEditModal = (record: any) => {
    setEditingRecord(record);
    setEditCheckIn(record.checkIn || '');
    setEditCheckOut(record.checkOut || '');
    setEditStatus(record.status || 'Present');
    setEditNotes(record.notes || '');
    setIsEditOpen(true);
  };

  // Excel exporter
  const handleExportExcel = () => {
    try {
      const exportData = (isAdmin ? filteredRecords : records).map(r => ({
        "Date": r.date,
        "Employee Name": r.name,
        "Email Address": r.email,
        "Check In": r.checkIn || 'N/A',
        "Check Out": r.checkOut || 'N/A',
        "Hours Worked": r.totalHours || 0,
        "Status": r.status,
        "Notes": r.notes || '',
        "Last Updated By": r.lastUpdatedBy || 'System'
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Attendance Sheet");
      XLSX.writeFile(wb, `Nexus_Attendance_Log_${filterDate}.xlsx`);
      showToast("Spreadsheet exported successfully", "success");
    } catch (err) {
      showToast("Failed to compile Excel export", "error");
    }
  };

  // Split leaves for admin view
  const pendingLeaves = useMemo(() => leaves.filter(l => l.status === 'Pending'), [leaves]);
  const processedLeaves = useMemo(() => leaves.filter(l => l.status !== 'Pending'), [leaves]);

  return (
    <div className="page-container animate-slide-up">
      {/* Sub-Navigation tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '20px', marginBottom: '8px' }}>
        <button 
          onClick={() => setActiveSubTab('clock')}
          style={{
            padding: '12px 6px',
            background: 'none',
            border: 'none',
            borderBottom: activeSubTab === 'clock' ? '2px solid var(--accent-primary)' : 'none',
            color: activeSubTab === 'clock' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: 'bold',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          ⏰ Daily Clock In/Out
        </button>
        <button 
          onClick={() => setActiveSubTab('leaves')}
          style={{
            padding: '12px 6px',
            background: 'none',
            border: 'none',
            borderBottom: activeSubTab === 'leaves' ? '2px solid var(--accent-primary)' : 'none',
            color: activeSubTab === 'leaves' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: 'bold',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          🌴 Leave Request Center
        </button>
      </div>

      {activeSubTab === 'clock' && (
        <>
          <div style={headerRowStyle}>
            <div>
              <h3>Employee Attendance Registry</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                {isAdmin 
                  ? 'Admin Overrides: Reviewing and editing all check-in/out records.' 
                  : 'Log arrival/departure times and view your personal haptic logs.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleExportExcel} className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '13px' }}>
                <FileSpreadsheet size={16} /> Export log
              </button>
              {isAdmin && (
                <button onClick={() => setIsAddOpen(true)} className="btn btn-primary" style={{ padding: '8px 12px', fontSize: '13px' }}>
                  <Plus size={16} /> Log Manual Attendance
                </button>
              )}
            </div>
          </div>

          <div className="grid-dashboard" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div className="panel-glass" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: todayRecord ? 'var(--success-glow)' : 'var(--accent-primary-glow)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: todayRecord ? 'var(--success)' : 'var(--accent-primary)'
                }}>
                  <Clock size={24} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px' }}>Check In Status</h4>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                    {todayRecord 
                      ? `Checked In today at ${todayRecord.checkIn}` 
                      : 'You have not checked in for today.'}
                  </p>
                </div>
              </div>

              <div>
                {!todayRecord ? (
                  <button onClick={handleCheckIn} className="btn btn-primary" style={{ padding: '10px 20px' }}>
                    Check In
                  </button>
                ) : !todayRecord.checkOut ? (
                  <button onClick={handleCheckOut} className="btn btn-danger" style={{ padding: '10px 20px' }}>
                    Check Out
                  </button>
                ) : (
                  <span style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    backgroundColor: 'var(--success-glow)',
                    color: 'var(--success)'
                  }}>
                    Completed ({todayRecord.totalHours} hrs)
                  </span>
                )}
              </div>
            </div>

            {isAdmin && (
              <div className="panel-glass" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', padding: '20px', alignItems: 'center' }}>
                <div className="form-group" style={{ flex: '1 1 140px', marginBottom: 0 }}>
                  <label className="form-label">Query Date</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={filterDate}
                    onChange={e => setFilterDate(e.target.value)}
                    style={{ padding: '8px 12px', fontSize: '13px' }}
                  />
                </div>
                <div className="form-group" style={{ flex: '1 1 180px', marginBottom: 0 }}>
                  <label className="form-label">Employee Filter</label>
                  <select 
                    className="form-select" 
                    value={filterEmployee}
                    onChange={e => setFilterEmployee(e.target.value)}
                    style={{ padding: '8px 12px', fontSize: '13px' }}
                  >
                    <option value="All">All Employees</option>
                    {users.map(u => (
                      <option key={u.email} value={u.email}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="panel-glass">
            <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>
              {isAdmin ? `Records for ${filterDate}` : 'Your Attendance History'}
            </h3>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Name</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Status</th>
                    <th>Hours</th>
                    <th>Notes</th>
                    {isAdmin && <th style={{ textAlign: 'center' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {(isAdmin ? filteredRecords : records).map((r) => (
                    <tr key={r.id}>
                      <td>{r.date}</td>
                      <td style={{ fontWeight: 'bold' }}>{r.name}</td>
                      <td>{r.checkIn || '--:--'}</td>
                      <td>{r.checkOut || '--:--'}</td>
                      <td>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          backgroundColor: r.status === 'Present' 
                            ? 'var(--success-glow)' 
                            : r.status === 'Late' 
                            ? 'var(--warning-glow)' 
                            : 'var(--danger-glow)',
                          color: r.status === 'Present' 
                            ? 'var(--success)' 
                            : r.status === 'Late' 
                            ? 'var(--warning)' 
                            : 'var(--danger)',
                        }}>
                          {r.status}
                        </span>
                      </td>
                      <td>{r.totalHours ? `${r.totalHours} hrs` : '--'}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '12px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.notes || 'None'}
                      </td>
                      {isAdmin && (
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <button 
                              onClick={() => openEditModal(r)}
                              className="btn btn-secondary btn-icon"
                              style={{ color: 'var(--accent-teal)', padding: '6px' }}
                              title="Override attendance details"
                            >
                              <Edit size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {(isAdmin ? filteredRecords : records).length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        No check-in logs registered for this scope.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeSubTab === 'leaves' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
          {/* Apply for Leave Panel (Managers/Staff only) */}
          {!isAdmin && (
            <div className="panel-glass animate-slide-up" style={{ flex: '1 1 320px', maxWidth: '400px', alignSelf: 'flex-start' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '16px' }}><Calendar size={18} style={{ marginRight: '6px' }} /> Apply for Leave</h3>
              <form onSubmit={handleApplyLeave}>
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    required 
                    value={leaveStartDate} 
                    onChange={e => setLeaveStartDate(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    required 
                    value={leaveEndDate} 
                    onChange={e => setLeaveEndDate(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Leave Type</label>
                  <select 
                    className="form-select" 
                    value={leaveType} 
                    onChange={e => setLeaveType(e.target.value)}
                  >
                    <option value="Casual Leave">Casual Leave</option>
                    <option value="Sick Leave">Sick Leave</option>
                    <option value="Earned Leave">Earned Leave</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Reason / Justification</label>
                  <textarea 
                    className="form-input" 
                    placeholder="Provide details about your leave..." 
                    style={{ minHeight: '80px', resize: 'vertical' }}
                    required
                    value={leaveReason} 
                    onChange={e => setLeaveReason(e.target.value)} 
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>
                  Submit Leave Request
                </button>
              </form>
            </div>
          )}

          {/* Admin Leaves Moderation Grid OR Personal Leaves History */}
          <div style={{ flex: '2 1 480px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {isAdmin ? (
              <>
                {/* 1. Pending Leaves Moderation Table */}
                <div className="panel-glass">
                  <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '16px' }}>🚨 Pending Leave Moderations</h3>
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Leave Details</th>
                          <th>Duration</th>
                          <th>Reason</th>
                          <th>Admin Remarks</th>
                          <th style={{ textAlign: 'center' }}>Approval</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingLeaves.map((l) => (
                          <tr key={l.id}>
                            <td>
                              <div style={{ fontWeight: 'bold' }}>{l.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{l.role}</div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 'bold', color: 'var(--accent-primary)' }}>{l.type}</div>
                              <div style={{ fontSize: '11px' }}>{l.startDate} to {l.endDate}</div>
                            </td>
                            <td>
                              {Math.ceil((new Date(l.endDate).getTime() - new Date(l.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} days
                            </td>
                            <td>
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.reason}>
                                {l.reason}
                              </div>
                            </td>
                            <td>
                              <input 
                                type="text" 
                                placeholder="Add remarks..." 
                                className="form-input" 
                                style={{ padding: '6px 10px', fontSize: '11px', width: '150px' }}
                                value={remarksInput[l.id] || ''}
                                onChange={(e) => setRemarksInput(prev => ({ ...prev, [l.id]: e.target.value }))}
                              />
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <button 
                                  onClick={() => handleModerateLeave(l, true)} 
                                  className="btn btn-success btn-icon"
                                  style={{ padding: '6px' }}
                                  title="Approve & grant leave"
                                >
                                  <Check size={14} />
                                </button>
                                <button 
                                  onClick={() => handleModerateLeave(l, false)} 
                                  className="btn btn-danger btn-icon"
                                  style={{ padding: '6px' }}
                                  title="Deny leave request"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {pendingLeaves.length === 0 && (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                              No leave requests currently pending approval.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2. Processed Leaves History Log */}
                <div className="panel-glass">
                  <h3 style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Processed Leave Logs</h3>
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Leave Type</th>
                          <th>Dates</th>
                          <th>Status</th>
                          <th>Admin Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {processedLeaves.map((l) => (
                          <tr key={l.id}>
                            <td>
                              <div style={{ fontWeight: 'bold' }}>{l.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{l.email}</div>
                            </td>
                            <td style={{ fontWeight: 'bold' }}>{l.type}</td>
                            <td>{l.startDate} to {l.endDate}</td>
                            <td>
                              <span style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 'bold',
                                backgroundColor: l.status === 'Approved' ? 'var(--success-glow)' : 'var(--danger-glow)',
                                color: l.status === 'Approved' ? 'var(--success)' : 'var(--danger)'
                              }}>{l.status}</span>
                            </td>
                            <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{l.remarks || 'None'}</td>
                          </tr>
                        ))}
                        {processedLeaves.length === 0 && (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                              No processed leave history.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              /* Personal leaves registry for Staff / Managers */
              <div className="panel-glass">
                <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Your Leave Requests History</h3>
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Leave Type</th>
                        <th>Start Date</th>
                        <th>End Date</th>
                        <th>Reason</th>
                        <th>Status</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaves.map((l) => (
                        <tr key={l.id}>
                          <td style={{ fontWeight: 'bold' }}>{l.type}</td>
                          <td>{l.startDate}</td>
                          <td>{l.endDate}</td>
                          <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{l.reason}</td>
                          <td>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              backgroundColor: l.status === 'Approved' 
                                ? 'var(--success-glow)' 
                                : l.status === 'Denied' 
                                ? 'var(--danger-glow)' 
                                : 'var(--warning-glow)',
                              color: l.status === 'Approved' 
                                ? 'var(--success)' 
                                : l.status === 'Denied' 
                                ? 'var(--danger)' 
                                : 'var(--warning)'
                            }}>{l.status}</span>
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{l.remarks || '--'}</td>
                        </tr>
                      ))}
                      {leaves.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                            You have not submitted any leave requests yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Record Modal (Admin Only) */}
      {isEditOpen && editingRecord && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <div style={modalHeaderStyle}>
              <h3>Override Attendance Log</h3>
              <button onClick={() => setIsEditOpen(false)} style={closeBtnStyle}>X</button>
            </div>
            <form onSubmit={handleEditSubmit} style={{ marginTop: '16px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Employee: <strong>{editingRecord.name}</strong> ({editingRecord.email})<br />
                Date: <strong>{editingRecord.date}</strong>
              </p>
              
              <div className="form-group">
                <label className="form-label">Check In Time</label>
                <input 
                  type="time" 
                  className="form-input" 
                  value={editCheckIn}
                  onChange={e => setEditCheckIn(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Check Out Time</label>
                <input 
                  type="time" 
                  className="form-input" 
                  value={editCheckOut}
                  onChange={e => setEditCheckOut(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <select 
                  className="form-select"
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value)}
                >
                  <option value="Present">Present</option>
                  <option value="Late">Late</option>
                  <option value="Half Day">Half Day</option>
                  <option value="Absent">Absent</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Notes / Discrepancy Reason</label>
                <input 
                  type="text" 
                  placeholder="e.g. Manual override - forgotten scan badge"
                  className="form-input"
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }}>
                Apply Override Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Record Modal (Admin Only) */}
      {isAddOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <div style={modalHeaderStyle}>
              <h3>Log Manual Attendance Record</h3>
              <button onClick={() => setIsAddOpen(false)} style={closeBtnStyle}>X</button>
            </div>
            <form onSubmit={handleAddSubmit} style={{ marginTop: '16px' }}>
              <div className="form-group">
                <label className="form-label">Employee Profile</label>
                <select 
                  className="form-select"
                  value={addEmail}
                  onChange={e => setAddEmail(e.target.value)}
                  required
                >
                  <option value="">-- Choose Employee --</option>
                  {users.map(u => (
                    <option key={u.email} value={u.email}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Calendar Date</label>
                <input 
                  type="date" 
                  className="form-input"
                  value={addDate}
                  onChange={e => setAddDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Check In Time</label>
                <input 
                  type="time" 
                  className="form-input"
                  value={addCheckIn}
                  onChange={e => setAddCheckIn(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Check Out Time</label>
                <input 
                  type="time" 
                  className="form-input"
                  value={addCheckOut}
                  onChange={e => setAddCheckOut(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Security status</label>
                <select 
                  className="form-select"
                  value={addStatus}
                  onChange={e => setAddStatus(e.target.value)}
                >
                  <option value="Present">Present</option>
                  <option value="Late">Late</option>
                  <option value="Half Day">Half Day</option>
                  <option value="Absent">Absent</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <input 
                  type="text" 
                  placeholder="e.g. Manually added retrospectively"
                  className="form-input"
                  value={addNotes}
                  onChange={e => setAddNotes(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }}>
                Log Attendance Record
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Internal Page styles
const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '8px',
  flexWrap: 'wrap',
  gap: '16px'
};

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  backgroundColor: 'rgba(0,0,0,0.6)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '16px'
};

const modalContentStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '440px',
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  borderRadius: '12px',
  padding: '24px',
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
  fontSize: '16px',
  cursor: 'pointer',
  fontWeight: 'bold'
};
