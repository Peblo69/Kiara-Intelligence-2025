/*
  # Set up admin user

  1. New Content
    - Insert super admin user with specific user ID
    - Grant full admin permissions
*/

-- Insert super admin user
INSERT INTO admin_users (user_id, role, permissions)
VALUES (
  '00000000-0000-0000-0000-000000000000', -- Replace with your actual Supabase user ID
  'super_admin',
  '{
    "manage_users": true,
    "manage_tokens": true,
    "manage_payments": true,
    "manage_admins": true,
    "view_analytics": true
  }'
);