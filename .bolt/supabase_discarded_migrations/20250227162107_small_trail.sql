-- Add specific super admin user with full permissions
INSERT INTO admin_users (user_id, role, permissions)
VALUES (
  '64d4b199-de31-43e2-883d-60958b105266',  -- Your specific user ID
  'super_admin',
  '{
    "manage_users": true,
    "manage_tokens": true,
    "manage_payments": true,
    "manage_admins": true,
    "view_analytics": true,
    "manage_subscriptions": true,
    "manage_system": true,
    "manage_content": true,
    "manage_settings": true
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
    "manage_subscriptions": true,
    "manage_system": true,
    "manage_content": true,
    "manage_settings": true
  }',
  updated_at = now();