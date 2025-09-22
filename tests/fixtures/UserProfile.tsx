import React, { useState, useEffect, useCallback } from 'react';
import type { User, ApiResponse } from '../types/User';
import { fetchUserData, updateUserPreferences } from '../api/userService';

interface UserProfileProps {
  userId: string;
  onUserUpdate?: (user: User) => void;
  theme?: 'light' | 'dark';
}

export const UserProfile: React.FC<UserProfileProps> = ({
  userId,
  onUserUpdate,
  theme = 'light',
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState({
    notifications: true,
    theme: theme,
    language: 'en',
  });

  useEffect(() => {
    async function loadUser() {
      try {
        setLoading(true);
        const response: ApiResponse<User> = await fetchUserData(userId);
        if (response.success) {
          setUser(response.data);
          onUserUpdate?.(response.data);
        }
      } catch (error) {
        console.error('Failed to load user:', error);
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      loadUser();
    }
  }, [userId, onUserUpdate]);

  const handlePreferenceChange = useCallback(
    async (key: keyof typeof preferences, value: any) => {
      const newPrefs = { ...preferences, [key]: value };
      setPreferences(newPrefs);

      if (user) {
        try {
          await updateUserPreferences(user.id, newPrefs);
        } catch (error) {
          console.error('Failed to update preferences:', error);
          // Revert on error
          setPreferences(preferences);
        }
      }
    },
    [preferences, user],
  );

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="user-profile loading">
        <div className="spinner" />
        <p>Loading user profile...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="user-profile error">
        <h3>User not found</h3>
        <p>Unable to load user profile for ID: {userId}</p>
      </div>
    );
  }

  return (
    <div className={`user-profile ${theme}`}>
      <div className="profile-header">
        <div className="avatar">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={`${user.name} avatar`} />
          ) : (
            <div className="avatar-initials">{getInitials(user.name)}</div>
          )}
        </div>
        <div className="user-info">
          <h2>{user.name}</h2>
          <p className="email">{user.email}</p>
          <span className={`status ${user.isActive ? 'active' : 'inactive'}`}>
            {user.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <div className="preferences-section">
        <h3>Preferences</h3>
        <div className="preference-group">
          <label>
            <input
              type="checkbox"
              checked={preferences.notifications}
              onChange={(e) => handlePreferenceChange('notifications', e.target.checked)}
            />
            Enable notifications
          </label>
        </div>

        <div className="preference-group">
          <label>
            Theme:
            <select
              value={preferences.theme}
              onChange={(e) => handlePreferenceChange('theme', e.target.value)}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="auto">Auto</option>
            </select>
          </label>
        </div>

        <div className="preference-group">
          <label>
            Language:
            <select
              value={preferences.language}
              onChange={(e) => handlePreferenceChange('language', e.target.value)}
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
            </select>
          </label>
        </div>
      </div>

      {user.lastLoginAt && (
        <div className="last-activity">
          <p>Last seen: {new Date(user.lastLoginAt).toLocaleDateString()}</p>
        </div>
      )}
    </div>
  );
};
