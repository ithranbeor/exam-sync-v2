// src/components/ResetPassword.tsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.ts';
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/resetPassword.css';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

const ResetPassword: React.FC = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        toast.error('You must open the reset link from your email.');
        setTimeout(() => navigate('/admin-login'), 3000);
      } else {
        setHasSession(true);
      }
    };
    fetchSession();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      console.error('Password reset error:', error.message);
      toast.error('Failed to reset password. Please try again.');
    } else {
      toast.success('Password reset successful!');
      setTimeout(() => navigate('/admin-login'), 2000);
    }

    setSubmitting(false);
  };

  return (
    <div className="reset-password-page">
      <div className="reset-password-overlay"></div>

      <div className="reset-password-container">
        <h2>Reset Your Password</h2>
        <form className="reset-password-form" onSubmit={handleSubmit}>
          <label>New Password</label>
          <div className="password-input-wrapper">
            <input
              type={showNew ? 'text' : 'password'}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={!hasSession || submitting}
            />
            <span onClick={() => setShowNew(!showNew)} className="toggle-password-visibility">
              {showNew ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          <label>Confirm Password</label>
          <div className="password-input-wrapper">
            <input
              type={showConfirm ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={!hasSession || submitting}
            />
            <span onClick={() => setShowConfirm(!showConfirm)} className="toggle-password-visibility">
              {showConfirm ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          <button type="submit" className="btn" disabled={!hasSession || submitting}>
            {submitting ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <ToastContainer position="top-center" autoClose={3000} />
      </div>
    </div>
  );
};

export default ResetPassword;
