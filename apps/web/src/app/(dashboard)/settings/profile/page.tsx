'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getMe,
  updateProfile,
  changePassword,
  getEmailChangeStatus,
  requestEmailChange,
  cancelEmailChange,
  waiveHoldEmailChange,
  UserProfile,
  EmailChangeStatus
} from '@/lib/api';

export default function ProfileSettingsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [emailChangeStatus, setEmailChangeStatus] = useState<EmailChangeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Profile form state
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [defaultTeamName, setDefaultTeamName] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  // Email change state
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);

  useEffect(() => {
    const storedToken = sessionStorage.getItem('accessToken') || sessionStorage.getItem('token');
    if (!storedToken) {
      router.push('/login');
      return;
    }
    setToken(storedToken);
  }, [router]);

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token]);

  const loadData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [userData, emailStatus] = await Promise.all([
        getMe(token),
        getEmailChangeStatus(token)
      ]);
      setUser(userData);
      setUsername(userData.username);
      setDisplayName(userData.displayName || '');
      setDefaultTeamName(userData.defaultTeamName || '');
      setEmailEnabled(userData.emailEnabled);
      setPushEnabled(userData.pushEnabled);
      setEmailChangeStatus(emailStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateProfile(token, {
        username: username || undefined,
        displayName: displayName || undefined,
        defaultTeamName: defaultTeamName || undefined,
        emailEnabled,
        pushEnabled
      });
      setUser(updated);
      setSuccess('Profile updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!token) return;
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await changePassword(token, { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      setSuccess('Password changed successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestEmailChange = async () => {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await requestEmailChange(token, { newEmail, password: emailPassword });
      setNewEmail('');
      setEmailPassword('');
      setShowEmailForm(false);
      await loadData();
      setSuccess('Email change requested. Check your new email for verification.');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request email change');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEmailChange = async () => {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await cancelEmailChange(token);
      await loadData();
      setSuccess('Email change cancelled');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel email change');
    } finally {
      setSaving(false);
    }
  };

  const handleWaiveHold = async () => {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await waiveHoldEmailChange(token);
      await loadData();
      setSuccess('Hold period waived. Email change will complete upon verification.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to waive hold period');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-lg">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Profile Settings</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      {/* Basic Profile */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your public profile details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user?.email || ''} disabled />
            <p className="text-xs text-muted-foreground mt-1">
              To change your email, use the Email Change section below
            </p>
          </div>
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
            />
          </div>
          <div>
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name (optional)"
            />
          </div>
          <div>
            <Label htmlFor="teamName">Default Team Name</Label>
            <Input
              id="teamName"
              value={defaultTeamName}
              onChange={(e) => setDefaultTeamName(e.target.value)}
              placeholder="Default team name for leagues"
            />
          </div>
          <Button onClick={handleSaveProfile} disabled={saving}>
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>Control how you receive notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="emailNotif">Email Notifications</Label>
              <p className="text-xs text-muted-foreground">Receive notifications via email</p>
            </div>
            <input
              id="emailNotif"
              type="checkbox"
              checked={emailEnabled}
              onChange={(e) => setEmailEnabled(e.target.checked)}
              className="h-4 w-4"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="pushNotif">Push Notifications</Label>
              <p className="text-xs text-muted-foreground">Receive browser push notifications</p>
            </div>
            <input
              id="pushNotif"
              type="checkbox"
              checked={pushEnabled}
              onChange={(e) => setPushEnabled(e.target.checked)}
              className="h-4 w-4"
            />
          </div>
          <Button onClick={handleSaveProfile} disabled={saving}>
            {saving ? 'Saving...' : 'Save Preferences'}
          </Button>
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Change your password</CardDescription>
        </CardHeader>
        <CardContent>
          {!showPasswordForm ? (
            <Button variant="outline" onClick={() => setShowPasswordForm(true)}>
              Change Password
            </Button>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleChangePassword} disabled={saving}>
                  {saving ? 'Changing...' : 'Change Password'}
                </Button>
                <Button variant="outline" onClick={() => setShowPasswordForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Change */}
      <Card>
        <CardHeader>
          <CardTitle>Email Address</CardTitle>
          <CardDescription>Change your account email address</CardDescription>
        </CardHeader>
        <CardContent>
          {emailChangeStatus?.hasPendingRequest ? (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
                <p className="font-medium">Pending Email Change</p>
                <p className="text-sm text-yellow-800">
                  Change from <strong>{emailChangeStatus.request?.currentEmail}</strong> to{' '}
                  <strong>{emailChangeStatus.request?.newEmail}</strong>
                </p>
                <p className="text-sm text-yellow-800 mt-2">
                  Expires: {new Date(emailChangeStatus.request?.expiresAt || '').toLocaleString()}
                </p>
                {emailChangeStatus.request?.canWaive && (
                  <p className="text-sm text-yellow-700 mt-2">
                    A hold period applies. You can waive it for immediate change after verification.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {emailChangeStatus.request?.canWaive && (
                  <Button onClick={handleWaiveHold} disabled={saving}>
                    Waive Hold Period
                  </Button>
                )}
                <Button variant="outline" onClick={handleCancelEmailChange} disabled={saving}>
                  Cancel Email Change
                </Button>
              </div>
            </div>
          ) : !showEmailForm ? (
            <Button variant="outline" onClick={() => setShowEmailForm(true)}>
              Change Email
            </Button>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="newEmail">New Email Address</Label>
                <Input
                  id="newEmail"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="new@email.com"
                />
              </div>
              <div>
                <Label htmlFor="emailPassword">Current Password</Label>
                <Input
                  id="emailPassword"
                  type="password"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleRequestEmailChange} disabled={saving}>
                  {saving ? 'Requesting...' : 'Request Email Change'}
                </Button>
                <Button variant="outline" onClick={() => setShowEmailForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="mt-6 flex gap-4">
        <Button variant="outline" onClick={() => router.push('/dashboard')}>
          Back to Dashboard
        </Button>
        <Button variant="outline" onClick={() => router.push('/notifications')}>
          View Notifications
        </Button>
      </div>
    </div>
  );
}