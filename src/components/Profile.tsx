// deno-lint-ignore-file no-explicit-any
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient.ts';
import '../styles/profile.css';
import { MdEdit } from 'react-icons/md';
import { FaTrash } from 'react-icons/fa';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface UserProfile {
  user_id: number;
  first_name: string;
  last_name: string;
  middle_name: string;
  email_address: string;
  contact_number: string;
  avatar_url: string | null;
}

interface UserRoleInfo {
  role_name: string;
  college_name: string | null;
  department_name: string | null;
}

interface ProfileProps {
  user: {
    user_id: string;
    email: string;
  } | null;
}

const Profile: React.FC<ProfileProps> = ({ user }) => {
  const [profile, setProfile] = useState<UserProfile>({
    user_id: 0,
    first_name: '',
    last_name: '',
    middle_name: '',
    email_address: '',
    contact_number: '',
    avatar_url: null,
  });

  const [originalProfile, setOriginalProfile] = useState<UserProfile | null>(null);
  const [editingPersonalDetails, setEditingPersonalDetails] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);
  const [userRoles, setUserRoles] = useState<UserRoleInfo[]>([]);
  const [confirmEmail, setConfirmEmail] = useState('');


  // Password change states
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const fetchProfile = useCallback(async () => {
    if (!user?.user_id) {
      setLoading(false);
      setError('User not logged in.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data: userData, error: fetchError } = await supabase
        .from('tbl_users')
        .select('*')
        .eq('user_id', user.user_id)
        .single();

      if (fetchError) throw fetchError;

      if (userData) {
        const fetchedProfile: UserProfile = {
          first_name: userData.first_name || '',
          last_name: userData.last_name || '',
          middle_name: userData.middle_name || '',
          email_address: userData.email_address || user.email || '',
          contact_number: userData.contact_number || '',
          avatar_url: userData.avatar_url || null,
          user_id: userData.user_id || 0,
        };
        setProfile(fetchedProfile);
        setOriginalProfile(fetchedProfile);
        setPreview(fetchedProfile.avatar_url || null);
      }
    } catch (err: any) {
      console.error('Error loading profile:', err.message);
      setError('Failed to load profile. ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.user_id) {
      toast.error('No file selected or user not logged in.');
      return;
    }

    try {
      if (profile.avatar_url) {
        toast.warn('Please delete the current profile picture before uploading a new one.');
        return;
      }

      const ext = file.name.split('.').pop();
      const filePath = `${user.user_id}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      if (!urlData?.publicUrl) throw new Error('Could not get avatar URL');

      const finalUrl = `${urlData.publicUrl}?v=${Date.now()}`;
      const { error: dbError } = await supabase
        .from('tbl_users')
        .update({ avatar_url: finalUrl })
        .eq('user_id', user.user_id);

      if (dbError) throw dbError;

      setProfile((prev) => ({ ...prev, avatar_url: finalUrl }));
      setPreview(finalUrl);
    } catch (err: any) {
      console.error('Avatar upload error:', err.message);
      toast.error('Failed to upload avatar. ' + err.message);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!profile.avatar_url || !user?.user_id) {
      toast.error('No avatar to delete or user not logged in.');
      return;
    }

    try {
      const urlParts = profile.avatar_url.split('/avatars/');
      if (urlParts.length !== 2) throw new Error('Invalid avatar URL format.');

      const fileName = urlParts[1];
      const { error: deleteError } = await supabase.storage
        .from('avatars')
        .remove([fileName]);

      if (deleteError) throw new Error('Failed to delete from storage: ' + deleteError.message);

      const { error: dbError } = await supabase
        .from('tbl_users')
        .update({ avatar_url: null })
        .eq('user_id', user.user_id);

      if (dbError) throw new Error('Failed to update profile: ' + dbError.message);

      setProfile((prev) => ({ ...prev, avatar_url: null }));
      setPreview(null);
      toast.success('Profile picture deleted.');
    } catch (err: any) {
      console.error('Avatar delete error:', err.message);
      toast.error('Error deleting avatar. ' + err.message);
    }
  };

  const fetchUserRoles = useCallback(async () => {
    if (!user?.user_id) return;

    const { data, error } = await supabase
      .from('tbl_user_role')
      .select(`
        role_id,
        tbl_roles(role_name),
        tbl_college(college_name),
        tbl_department(department_name)
      `)
      .eq('user_id', user.user_id);

    if (error) {
      console.error('Error fetching user roles:', error.message);
      return;
    }

    const mappedRoles: UserRoleInfo[] = (data || []).map((role: any) => ({
      role_name: role.tbl_roles?.role_name || 'Unknown Role',
      college_name: role.tbl_college?.college_name || null,
      department_name: role.tbl_department?.department_name || null,
    }));

    setUserRoles(mappedRoles);
  }, [user]);

  useEffect(() => {
    fetchProfile();
    fetchUserRoles();
  }, [fetchProfile, fetchUserRoles]);

  const handleSaveChanges = async () => {
    if (!user?.user_id) {
      toast.error('User not logged in. Cannot save profile.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const updatePayload = {
        first_name: profile.first_name,
        middle_name: profile.middle_name,
        last_name: profile.last_name,
        email_address: profile.email_address,
        contact_number: profile.contact_number,
        avatar_url: profile.avatar_url,
      };

      const { error: updateError } = await supabase
        .from('tbl_users')
        .update(updatePayload)
        .eq('user_id', profile.user_id);

      if (updateError) throw updateError;

      setEditingPersonalDetails(false);
      await fetchProfile();
      toast.success('Profile updated successfully!');
    } catch (err: any) {
      console.error('Error saving profile:', err.message);
      toast.error('Failed to save profile. ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    if (originalProfile) {
      setProfile(originalProfile);
      setPreview(originalProfile.avatar_url);
    }
    setEditingPersonalDetails(false);
  };

  const handleSendResetLink = async () => {
    if (!profile.email_address) {
      toast.error('No email found on this account.');
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(profile.email_address, {
      redirectTo: 'http://localhost:5173/reset-password', // Replace with your redirect URL
    });

    if (error) {
      console.error('Reset link error:', error.message);
      toast.error('Failed to send reset link.');
    } else {
      toast.success('Reset link sent to your email.');
    }
  };

  const handlePasswordChange = async () => {
    if (confirmEmail.trim() !== profile.email_address.trim()) {
      toast.error('Email does not match. Please confirm your account.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      console.error('Password update failed:', error.message);
      toast.error('Failed to change password.');
    } else {
      toast.success('Password updated successfully.');
      setShowPasswordForm(false);
      setNewPassword('');
      setConfirmPassword('');
      setConfirmEmail('');
    }
  };

  if (loading) {
    return (
      <div className="profile-container">
        <div className="profile-card loading-state">
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-header-title">Profile Details</div>

      <div className="profile-section profile-info-card">
        <div className="profile-avatar-wrapper">
          <img
            src={preview || './src/assets/default-pp.jpg'}
            alt="Profile Avatar"
            className="profile-avatar"
          />
          {editingPersonalDetails && (
            <>
              <label htmlFor="avatar-upload" className="profile-avatar-edit-icon">
                <MdEdit size={24} />
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  style={{ display: 'none' }}
                />
              </label>

              {preview && (
                <button
                  type="button"
                  className="delete-avatar-btn"
                  onClick={handleDeleteAvatar}
                  title="Delete Profile Picture"
                >
                  <FaTrash />
                </button>
              )}
            </>
          )}
        </div>

        <div className="profile-name-details">
          <div className="profile-full-name">
            {profile.first_name} {profile.middle_name} {profile.last_name}
          </div>
          <div className="profile-user-type">
            {userRoles.length > 0 ? (
              userRoles.map((role, index) => (
                <div key={index}>
                  <strong>{role.role_name}</strong>
                  {role.college_name && ` - ${role.college_name}`}
                  {role.department_name && ` / ${role.department_name}`}
                </div>
              ))
            ) : (
              <span>No roles assigned</span>
            )}
          </div>
        </div>
      </div>

      {/* Personal Details */}
      <div className="profile-section personal-details-card">
        <div className="personal-details-header">
          <h3>Personal Details</h3>
          {!editingPersonalDetails && (
            <button
              type="button"
              className="edit-details-btn"
              onClick={() => setEditingPersonalDetails(true)}
              disabled={loading}
            >
              <MdEdit />
            </button>
          )}
        </div>

        <div className="personal-details-grid">
          <div className="profile-field-group">
            <label>First Name</label>
            <input
              name="first_name"
              type="text"
              value={profile.first_name}
              onChange={handleChange}
              disabled={!editingPersonalDetails || loading}
            />
          </div>
          <div className="profile-field-group">
            <label>M.I.</label>
            <input
              name="middle_name"
              type="text"
              value={profile.middle_name}
              onChange={handleChange}
              disabled={!editingPersonalDetails || loading}
            />
          </div>
          <div className="profile-field-group">
            <label>Last Name</label>
            <input
              name="last_name"
              type="text"
              value={profile.last_name}
              onChange={handleChange}
              disabled={!editingPersonalDetails || loading}
            />
          </div>

          <div className="profile-field-group">
            <label>User ID</label>
            <input type="text" value={profile.user_id} disabled />
          </div>

          <div className="profile-field-group span-2-columns">
            <label>Email Address</label>
            <input
              name="email_address"
              type="email"
              value={profile.email_address}
              onChange={handleChange}
              disabled={!editingPersonalDetails || loading}
            />
          </div>

          <div className="profile-field-group">
            <label>Contact No.</label>
            <input
              name="contact_number"
              type="text"
              value={profile.contact_number}
              onChange={handleChange}
              disabled={!editingPersonalDetails || loading}
            />
          </div>
        </div>

        {editingPersonalDetails && (
          <div className="personal-details-actions">
            <button type='button' className="btn cancel-personal-details" onClick={handleCancelEdit} disabled={loading}>
              Cancel
            </button>
            <button type='button' className="btn save-changes-global" onClick={handleSaveChanges} disabled={loading}>
              Save
            </button>
          </div>
        )}
      </div>

      <div className="profile-section password-change-card">
        {showPasswordForm ? (
          <div className="password-form">
            <div className="profile-field-group">
              <label>Confirm Email Address</label>
              <input
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder="Enter your email to confirm"
              />
            </div>
            <div className="profile-field-group">
              <label>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="profile-field-group">
              <label>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <div className="password-actions">
              <button type='button' className="btn cancel-personal-details" onClick={() => setShowPasswordForm(false)}>Cancel</button>
              <button type='button' className="btn save-changes-global" onClick={handlePasswordChange}>Update Password</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn change-password-btn" onClick={handleSendResetLink}>
            Change Password
          </button>
        )}
      </div>

      <ToastContainer position="top-center" autoClose={3000} />
    </div>
  );
};

export default Profile;
