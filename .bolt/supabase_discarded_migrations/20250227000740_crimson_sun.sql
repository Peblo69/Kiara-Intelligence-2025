/*
  # Add Super Admin User
  
  This migration adds the specified user as a super admin with full permissions.
  
  1. Changes
     - Inserts or updates user as super admin
     - Grants all admin permissions
     
  2. Security
     - Only affects specified user ID
     - Maintains existing admin structure
*/

INSERT INTO admin_users (user_id, role, permissions)
VALUES (
  '64d4b199-de31-43e2-883d-60958b105266', -- Replace with your actual Supabase user ID
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