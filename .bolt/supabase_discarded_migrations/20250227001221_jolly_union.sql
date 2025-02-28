/*
  # Set up admin user

  1. New Admin User
     - Adds super admin role for specified user ID
     - Grants all admin permissions
     - Ensures idempotent operation with conflict handling

  2. Security
     - Uses secure permission structure
     - Maintains audit trail capability
*/

INSERT INTO admin_users (user_id, role, permissions)
VALUES (
  '64d4b199-de31-43e2-883d-60958b105266',  -- Your user ID
  'super_admin',
  '{
    "manage_users": true,
    "manage_tokens": true,
    "manage_payments": true,
    "manage_admins": true,
    "view_analytics": true,
    "manage_subscriptions": true
  }'
)
ON CONFLICT (user_id) 
DO UPDATE SET
  role = 'super_admin',
  permissions = '{
    "manage_users": true,
    "manage_tokens": true,
    "manage_payments": true,
    "manage_admins": true,
    "view_analytics": true,
    "manage_subscriptions": true
  }',
  updated_at = now();