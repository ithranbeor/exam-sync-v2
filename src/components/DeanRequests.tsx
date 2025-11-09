import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient.ts';
import '../styles/deanrequests.css';
import { FaArchive, FaCheckCircle, FaTimesCircle, FaTrash } from "react-icons/fa";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

type DeanRequest = {
  request_id: string;
  sender_name: string;
  subject: string;
  remarks: string;
  submitted_at: string;
  schedule_data?: {
    college_name: string;
    exam_period: string;
    term: string;
    semester: string;
    academic_year: string;
    building: string;
    total_schedules: number;
    schedules: Array<{
      course_id: string;
      section_name: string;
      exam_date: string;
      exam_start_time: string;
      exam_end_time: string;
      room_id: string;
      instructor: string;
      proctor: string;
    }>;
  };
  status?: string;
  college_name?: string;
};

interface SchedulerViewProps {
  user: {
    user_id: number;
    email_address: string;
    first_name?: string;
    last_name?: string;
    middle_name?: string;
  } | null;
}

const DeanRequests: React.FC<SchedulerViewProps> = ({ user }) => {
  const [requests, setRequests] = useState<DeanRequest[]>([]);
  const [history, setHistory] = useState<DeanRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<DeanRequest | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [processingRequest, setProcessingRequest] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [editStatus, setEditStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('');
  const [collegeId, setCollegeId] = useState<string | null>(null);

  useEffect(() => {
    const fetchCollege = async () => {
      if (!user?.user_id) return;

      // Step 1: Get the college_id from the dean’s user_role
      const { data: roleData, error: roleError } = await supabase
        .from('tbl_user_role')
        .select('college_id')
        .eq('user_id', user.user_id)
        .eq('role_id', 1) // or the correct dean role_id
        .maybeSingle();

      if (roleError || !roleData) {
        console.error('Error fetching college_id:', roleError);
        toast.error('Could not load dean college info.');
        return;
      }

      // Step 2: Use that college_id to get the actual college name
      const { data: collegeData, error: collegeError } = await supabase
        .from('tbl_college')
        .select('college_name')
        .eq('college_id', roleData.college_id)
        .maybeSingle();

      if (collegeError || !collegeData) {
        console.error('Error fetching college name:', collegeError);
        toast.error('Could not fetch college name.');
        return;
      }

      setCollegeId(collegeData.college_name); // store the name string, not ID
    };

    fetchCollege();
  }, [user]);

  // Fetch pending requests
  useEffect(() => {
    if (!collegeId) return; // now collegeId holds the NAME string

    const fetchRequests = async () => {
      const { data, error } = await supabase
        .from('tbl_scheduleapproval')
        .select(`
          dean_user_id,
          request_id,
          remarks,
          submitted_at,
          created_at,
          schedule_data,
          status,
          college_name,
          tbl_users:submitted_by (
            first_name,
            last_name
          )
        `)
        .eq('status', 'pending')
        .eq('college_name', collegeId) // ✅ correct column
        .order('submitted_at', { ascending: false });

      if (error) {
        console.error('Error fetching requests:', error);
        toast.error('Failed to load requests');
        return;
      }

      if (data) {
        const mapped = data.map((row: any) => ({
          request_id: row.request_id,
          sender_name: `${row.tbl_users?.first_name || ''} ${row.tbl_users?.last_name || ''}`.trim(),
          subject: 'Exam Schedule Request',
          remarks: row.remarks,
          schedule_data: row.schedule_data,
          submitted_at: row.submitted_at
            ? new Date(row.submitted_at).toLocaleString()
            : 'N/A',
          status: row.status,
          college_name: row.college_name,
        }));

        setRequests(mapped);
      }
    };

    fetchRequests();
    const interval = setInterval(fetchRequests, 10000);
    return () => clearInterval(interval);
  }, [collegeId]);

  // Fetch approved/rejected history
  useEffect(() => {
    if (!collegeId) return;

    const fetchHistory = async () => {
      const { data, error } = await supabase
        .from('tbl_scheduleapproval')
        .select(`
          dean_user_id,
          request_id,
          remarks,
          submitted_at,
          created_at,
          schedule_data,
          status,
          college_name,
          tbl_users:submitted_by (
            first_name,
            last_name
          )
        `)
        .in('status', ['approved', 'rejected'])
        .eq('college_name', collegeId) // ✅ correct filter
        .order('submitted_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching history:', error);
        return;
      }

      if (data) {
        const mapped = data.map((row: any) => ({
          request_id: row.request_id,
          sender_name: `${row.tbl_users?.first_name || ''} ${row.tbl_users?.last_name || ''}`.trim(),
          subject: 'Exam Schedule Request',
          remarks: row.remarks,
          schedule_data: row.schedule_data,
          submitted_at: row.submitted_at
            ? new Date(row.submitted_at).toLocaleString()
            : 'N/A',
          status: row.status,
          college_name: row.college_name,
        }));

        setHistory(mapped);
      }
    };

    fetchHistory();
  }, [collegeId, requests]);

  const sendNotification = async (
    senderId: number,
    receiverId: number,
    title: string,
    message: string,
    status: 'approved' | 'rejected' | 'pending',
    requestId?: string
  ) => {
    try {
      await supabase.from('tbl_notification').insert({
        user_id: receiverId,        // receiver
        sender_id: senderId,        // sender
        title: title,
        message: message,
        type: 'schedule_approval',
        status: 'unread',           // notification read status
        link_url: requestId ? `/inbox/${requestId}` : null,
        is_seen: false,
        priority: status === 'rejected' ? 2 : status === 'approved' ? 1 : 0,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  };

  const handleApprove = async (req: DeanRequest) => {
    if (processingRequest) return;

    const confirmed = globalThis.confirm(
      `Are you sure you want to APPROVE the schedule for ${req.schedule_data?.college_name}?\n\nThis will lock the schedule and prevent further modifications.`
    );

    if (!confirmed) return;

    setProcessingRequest(true);

    try {
      // Get the scheduler's user_id from the request
      const { data: submitterData } = await supabase
        .from('tbl_scheduleapproval')
        .select('submitted_by')
        .eq('request_id', req.request_id)
        .single();

      if (!submitterData) throw new Error('Submitter not found');

      const { error } = await supabase
        .from('tbl_scheduleapproval')
        .update({ 
          status: 'approved',
          submitted_at: new Date().toISOString()
        })
        .eq('request_id', req.request_id);

      if (error) throw error;

      // 🔔 Send notification to scheduler
      await sendNotification(
        user!.user_id,
        submitterData.submitted_by,
        '✅ Schedule Approved',
        `Your schedule for ${req.schedule_data?.college_name} has been approved by the Dean.`,
        'approved',
        req.request_id
      );

      setRequests((prev) => prev.filter((r) => r.request_id !== req.request_id));
      setHistory((prev) => [{ ...req, status: 'approved' }, ...prev]);
      setSelectedRequest(null);
      
      toast.success(`Schedule for ${req.schedule_data?.college_name} approved successfully!`);
    } catch (error: any) {
      console.error('Approval error:', error);
      toast.error('Failed to approve schedule: ' + error.message);
    } finally {
      setProcessingRequest(false);
    }
  };

  const handleReject = async (req: DeanRequest) => {
    if (processingRequest) return;
    setShowRejectionModal(true);
  };

  const confirmRejection = async () => {
    if (!selectedRequest || processingRequest) return;

    if (!rejectionReason.trim()) {
      toast.warn('Please provide a reason for rejection');
      return;
    }

    setProcessingRequest(true);

    try {
      const updatedRemarks = `${rejectionReason}`;

      // Get the scheduler's user_id
      const { data: submitterData } = await supabase
        .from('tbl_scheduleapproval')
        .select('submitted_by')
        .eq('request_id', selectedRequest.request_id)
        .single();

      if (!submitterData) throw new Error('Submitter not found');

      const { error } = await supabase
        .from('tbl_scheduleapproval')
        .update({ 
          status: 'rejected',
          remarks: updatedRemarks,
          submitted_at: new Date().toISOString()
        })
        .eq('request_id', selectedRequest.request_id);

      if (error) throw error;

      // 🔔 Send notification to scheduler
      await sendNotification(
        user!.user_id,
        submitterData.submitted_by,
        '❌ Schedule Rejected',
        `Your schedule for ${selectedRequest.schedule_data?.college_name} has been rejected. Reason: ${rejectionReason}`,
        'rejected',
        selectedRequest.request_id
      );

      setRequests((prev) => prev.filter((r) => r.request_id !== selectedRequest.request_id));
      setHistory((prev) => [{ ...selectedRequest, status: 'rejected', remarks: updatedRemarks }, ...prev]);
      setSelectedRequest(null);
      setShowRejectionModal(false);
      setRejectionReason('');
      
      toast.success(`Schedule for ${selectedRequest.schedule_data?.college_name} rejected`);
    } catch (error: any) {
      console.error('Rejection error:', error);
      toast.error('Failed to reject schedule: ' + error.message);
    } finally {
      setProcessingRequest(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedRequest) return;

    try {
      const { error } = await supabase
        .from('tbl_scheduleapproval')
        .update({ status: newStatus })
        .eq('request_id', selectedRequest.request_id);

      if (error) throw error;

      // Update UI without reloading
      setRequests(prev =>
        prev.map(r => r.request_id === selectedRequest.request_id ? { ...r, status: newStatus } : r)
      );

      setHistory(prev =>
        prev.map(r => r.request_id === selectedRequest.request_id ? { ...r, status: newStatus } : r)
      );

      toast.success(`Status updated to "${newStatus.toUpperCase()}"`);
      setEditStatus(false);
    } catch (error: any) {
      console.error(error);
      toast.error('Failed to update status.');
    }
  };

  const handleDelete = async (req: DeanRequest) => {
    const confirmed = confirm(`Delete this request for ${req.college_name}?`);
    if (!confirmed) return;
    const { error } = await supabase
      .from('tbl_scheduleapproval')
      .delete()
      .eq('request_id', req.request_id)
      .eq('college_name', collegeId); // 🔒 ensure same college
    if (!error) {
      setRequests(prev => prev.filter(r => r.request_id !== req.request_id));
      toast.success('Request deleted.');
    } else toast.error('Delete failed.');
  };

  const handleDeleteAll = async () => {
    const confirmed = confirm('Delete ALL requests from your college?');
    if (!confirmed) return;
    const { error } = await supabase
      .from('tbl_scheduleapproval')
      .delete()
      .eq('college_name', collegeId);
    if (!error) {
      setRequests([]);
      setHistory([]);
      toast.success('All requests deleted.');
    } else toast.error('Failed to delete all.');
  };

  // Render list cards
  const renderCards = (arr: DeanRequest[]) => {
    if (arr.length === 0) {
      return (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 20px', 
          color: '#666',
          fontSize: '14px'
        }}>
          {showHistory ? 'No approval history yet' : 'No pending requests'}
        </div>
      );
    }

    return arr.map((req) => (
      <div
        key={req.request_id}
        className="deanreq-card"
        onClick={() => setSelectedRequest(req)}
        style={{
          cursor: 'pointer',
          borderLeft: req.status === 'approved' ? '4px solid #4CAF50' : 
                      req.status === 'rejected' ? '4px solid #f44336' : 
                      '4px solid #FF9800'
        }}
      >
        <div className="deanreq-left">
          <span className="deanreq-icon">
            {req.status === 'approved' ? <FaCheckCircle style={{color: '#4CAF50'}} /> : 
             req.status === 'rejected' ? <FaTimesCircle style={{color: '#f44336'}} /> : 
             '⏵'}
          </span>
          <span className="deanreq-sender">{req.sender_name}</span>
        </div>
        <div className="deanreq-center">
          {req.schedule_data?.college_name || req.subject}
          {req.schedule_data && (
            <span style={{ fontSize: '11px', marginLeft: '8px', color: '#666' }}>
              ({req.schedule_data.total_schedules} schedules)
            </span>
          )}
        </div>
        <div className="deanreq-date">
          {req.submitted_at}
          {req.status && req.status !== 'pending' && (
            <span
              style={{
                marginLeft: 8,
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 'bold',
                backgroundColor: req.status === 'approved' ? '#4CAF50' : '#f44336',
                color: 'white'
              }}
            >
              {req.status.toUpperCase()}
            </span>
          )}
        </div>
      </div>
    ));
  };

  return (
    <div className="deanreq-container">
      <div className="deanreq-banner">
        Schedule Approval Requests
        <span
          className="deanreq-history-icon"
          onClick={() => setShowHistory((s) => !s)}
          title={showHistory ? "View pending requests" : "View history"}
          style={{ 
            float: 'right', 
            cursor: 'pointer', 
            fontSize: '1.2rem',
            color: showHistory ? '#4CAF50' : 'inherit',
            transition: 'color 0.3s',
            marginLeft: '10px'
          }}
        >
          <FaArchive />
        </span>
        <button
          type="button"
          className="deanreq-btn deny"
          style={{ 
            float: 'right', 
            cursor: 'pointer', 
            fontSize: '1.2rem',
            color: showHistory ? '#7b0909ff' : 'inherit', 
            transition: 'color 0.3s',
            background: 'none',
            border: 'none',     
            padding: '0', 
          }}
          onClick={handleDeleteAll}
        >
          <FaTrash />
        </button>
      </div>

      <p className="deanreq-message">
        {showHistory
          ? `Showing approval history (${history.length} records)`
          : `You have ${requests.length} pending request(s) from schedulers`}
      </p>

      {showHistory ? renderCards(history) : renderCards(requests)}

      {/* Request Detail Modal */}
      {selectedRequest && (
        <div
          className="deanreq-modal-overlay"
          onClick={() => !processingRequest && setSelectedRequest(null)}
        >
          <div
            className="deanreq-modal-pane"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '1900px', maxHeight: '85vh', overflowY: 'auto' }}
          >
            <h3 style={{ marginBottom: '5px' }}>
              From: {selectedRequest.sender_name}
            </h3>
            <h4 style={{ marginTop: '5px', color: '#666' }}>
              {selectedRequest.schedule_data?.college_name || selectedRequest.subject}
            </h4>

            <div className="deanreq-body">
              <div style={{ 
                padding: '10px', 
                backgroundColor: '#f5f5f5', 
                borderRadius: '4px',
                marginBottom: '15px'
              }}>
                <p style={{ margin: '5px 0' }}>
                  <strong>Scheduler's Remarks:</strong> {selectedRequest.remarks}
                </p>
              </div>

              {selectedRequest.schedule_data && (
                <div style={{
                  border: '2px solid #092C4C',
                  borderRadius: '8px',
                  padding: '20px',
                  backgroundColor: 'white',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  {/* Header Info */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '10px',
                    marginBottom: '20px',
                    padding: '15px',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '6px'
                  }}>
                    <div>
                      <strong>College:</strong> {selectedRequest.schedule_data.college_name}
                    </div>
                    <div>
                      <strong>Exam Period:</strong> {selectedRequest.schedule_data.exam_period}
                    </div>
                    <div>
                      <strong>Term:</strong> {selectedRequest.schedule_data.term}
                    </div>
                    <div>
                      <strong>Semester:</strong> {selectedRequest.schedule_data.semester}
                    </div>
                    <div>
                      <strong>Academic Year:</strong> {selectedRequest.schedule_data.academic_year}
                    </div>
                    <div>
                      <strong>Building:</strong> {selectedRequest.schedule_data.building}
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <strong>Total Schedules:</strong> {selectedRequest.schedule_data.total_schedules}
                    </div>
                  </div>
                  
                  {/* Schedules Table */}
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <table style={{ 
                      width: '100%', 
                      borderCollapse: 'collapse',
                      fontSize: '12px'
                    }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: '#092C4C', zIndex: 1 }}>
                        <tr>
                          <th style={{padding: '10px 8px', border: '1px solid #ddd', color: 'white'}}>#</th>
                          <th style={{padding: '10px 8px', border: '1px solid #ddd', color: 'white'}}>Course</th>
                          <th style={{padding: '10px 8px', border: '1px solid #ddd', color: 'white'}}>Section</th>
                          <th style={{padding: '10px 8px', border: '1px solid #ddd', color: 'white'}}>Date</th>
                          <th style={{padding: '10px 8px', border: '1px solid #ddd', color: 'white'}}>Start Time</th>
                          <th style={{padding: '10px 8px', border: '1px solid #ddd', color: 'white'}}>End Time</th>
                          <th style={{padding: '10px 8px', border: '1px solid #ddd', color: 'white'}}>Room</th>
                          <th style={{padding: '10px 8px', border: '1px solid #ddd', color: 'white'}}>Instructor</th>
                          <th style={{padding: '10px 8px', border: '1px solid #ddd', color: 'white'}}>Proctor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRequest.schedule_data.schedules?.map((sched: any, idx: number) => (
                          <tr key={idx} style={{backgroundColor: idx % 2 === 0 ? '#f9f9f9' : 'white'}}>
                            <td style={{padding: '8px', border: '1px solid #ddd', textAlign: 'center'}}>
                              {idx + 1}
                            </td>
                            <td style={{padding: '8px', border: '1px solid #ddd'}}>
                              {sched.course_id}
                            </td>
                            <td style={{padding: '8px', border: '1px solid #ddd'}}>
                              {sched.section_name}
                            </td>
                            <td style={{padding: '8px', border: '1px solid #ddd'}}>
                              {new Date(sched.exam_date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </td>
                            <td style={{padding: '8px', border: '1px solid #ddd'}}>
                              {new Date(sched.exam_start_time).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td style={{padding: '8px', border: '1px solid #ddd'}}>
                              {new Date(sched.exam_end_time).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td style={{padding: '8px', border: '1px solid #ddd', textAlign: 'center'}}>
                              {sched.room_id}
                            </td>
                            <td style={{padding: '8px', border: '1px solid #ddd'}}>
                              {sched.instructor || '-'}
                            </td>
                            <td style={{padding: '8px', border: '1px solid #ddd'}}>
                              {sched.proctor || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="deanreq-actions" style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              {selectedRequest && (
                <>
                  <button
                    type="button"
                    className="deanreq-btn deny"
                    style={{ backgroundColor: '#d32f2f', color: 'white' }}
                    onClick={() => handleDelete(selectedRequest)}
                  >
                    Delete
                  </button>
                </>
              )}

              {selectedRequest.status !== "pending" && !editStatus && (
                <button
                  type="button"
                  className="deanreq-btn"
                  style={{ backgroundColor: "#FF9800", color: "white" }}
                  onClick={() => {
                    setEditStatus(true);
                    setNewStatus(selectedRequest.status || "pending");
                  }}
                >
                  Edit Status
                </button>
              )}

              {/* STATUS DROPDOWN */}
              {editStatus && (
                <>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    style={{
                      padding: "6px",
                      borderRadius: "4px",
                      border: "1px solid #ccc"
                    }}
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>

                  <button
                    type="button"
                    className="deanreq-btn approve"
                    onClick={handleUpdateStatus}
                  >
                    Save
                  </button>

                  <button
                    type="button"
                    className="deanreq-btn cancel"
                    onClick={() => setEditStatus(false)}
                  >
                    Cancel
                  </button>
                </>
              )}

              {/* Existing Close + Approve/Reject buttons */}
              <button type="button" onClick={() => setSelectedRequest(null)} className="deanreq-btn cancel">
                Close
              </button>

              {selectedRequest.status === 'pending' && (
                <>
                  <button type="button" onClick={() => handleReject(selectedRequest)} className="deanreq-btn deny">
                    Reject
                  </button>
                  <button type="button" onClick={() => handleApprove(selectedRequest)} className="deanreq-btn approve">
                    Approve
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {showRejectionModal && (
        <div
          className="deanreq-modal-overlay"
          onClick={() => !processingRequest && setShowRejectionModal(false)}
        >
          <div
            className="deanreq-modal-pane"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '500px' }}
          >
            <h3>Rejection Reason</h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
              Please provide a reason for rejecting this schedule. The scheduler will see this message.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter reason for rejection..."
              rows={5}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '14px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
            />
            <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setShowRejectionModal(false);
                  setRejectionReason('');
                }}
                className="deanreq-btn cancel"
                disabled={processingRequest}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRejection}
                className="deanreq-btn deny"
                disabled={processingRequest || !rejectionReason.trim()}
              >
                {processingRequest ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default DeanRequests;