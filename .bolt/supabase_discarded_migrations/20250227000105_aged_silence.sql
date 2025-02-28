-- Insert super admin user
INSERT INTO admin_users (user_id, role, permissions)
VALUES (
  'YOUR-USER-ID-HERE', -- Replace with your actual Supabase user ID
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