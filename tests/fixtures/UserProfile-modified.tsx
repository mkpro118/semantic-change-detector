import React, { useState, useEffect, useCallback } from 'react';
import type { User, ApiResponse } from '../types/User';
import { fetchUserData, updateUserPreferences, trackUserActivity } from '../api/userService';

interface UserProfileProps {
  userId: string;
  onUserUpdate?: (user: User) => void;
  theme?: 'light' | 'dark' | 'auto';
  showActivity?: boolean;
}

export const UserProfile: React.FC<UserProfileProps> = ({
  userId,
  onUserUpdate,
  theme = 'light',
  showActivity = false,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState({
    notifications: true,
    theme: theme,
    language: 'en',
    timezone: 'UTC',
  });

  useEffect(() => {
    async function loadUser() {
      try {
        setLoading(true);
        setError(null);
        const response: ApiResponse<User> = await fetchUserData(userId);
        if (response.success) {
          setUser(response.data);
          onUserUpdate?.(response.data);

          if (showActivity) {
            await trackUserActivity('profile_viewed', { userId });
          }
        } else {
          setError(response.error || 'Failed to load user');
        }
      } catch (error) {
        console.error('Failed to load user:', error);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      loadUser();
    }
  }, [userId, onUserUpdate, showActivity]);

  const handlePreferenceChange = useCallback(
    async (key: keyof typeof preferences, value: any) => {
      const newPrefs = { ...preferences, [key]: value };
      setPreferences(newPrefs);

      if (user) {
        try {
          await updateUserPreferences(user.id, newPrefs);

          // Track preference changes
          if (showActivity) {
            await trackUserActivity('preference_changed', {
              userId: user.id,
              preference: key,
              value,
            });
          }
        } catch (error) {
          console.error('Failed to update preferences:', error);
          // Revert on error
          setPreferences(preferences);
          setError('Failed to save preferences');
        }
      }
    },
    [preferences, user, showActivity],
  );

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatLastSeen = (date: string): string => {
    const lastSeen = new Date(date);
    const now = new Date();
    const diffInHours = (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) return 'Online now';
    if (diffInHours < 24) return `${Math.floor(diffInHours)} hours ago`;
    return lastSeen.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="user-profile loading">
        <div className="spinner" />
        <p>Loading user profile...</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="user-profile error">
        <h3>Error</h3>
        <p>{error || `Unable to load user profile for ID: ${userId}`}</p>
        <button onClick={() => window.location.reload()}>Try Again</button>
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
          {user.role && <span className="role-badge">{user.role}</span>}
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
              <option value="de">German</option>
            </select>
          </label>
        </div>

        <div className="preference-group">
          <label>
            Timezone:
            <select
              value={preferences.timezone}
              onChange={(e) => handlePreferenceChange('timezone', e.target.value)}
            >
              <option value="UTC">UTC</option>
              <option value="EST">Eastern</option>
              <option value="PST">Pacific</option>
              <option value="CET">Central European</option>
            </select>
          </label>
        </div>
      </div>

      {user.lastLoginAt && (
        <div className="last-activity">
          <p>Last seen: {formatLastSeen(user.lastLoginAt)}</p>
        </div>
      )}

      {showActivity && user.activityLog && (
        <div className="activity-section">
          <h3>Recent Activity</h3>
          <ul className="activity-list">
            {user.activityLog.slice(0, 5).map((activity, index) => (
              <li key={index} className="activity-item">
                <span className="activity-action">{activity.action}</span>
                <span className="activity-time">
                  {new Date(activity.timestamp).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
