/*
  # Fix RLS Policies for User Creation

  1. Changes
    - Add RLS policy to allow authenticated users to create their own user record
    - Add RLS policy to allow authenticated users to update their own user record
    - Add RLS policy to allow authenticated users to read their own user record

  2. Security
    - Ensures users can only access their own data
    - Maintains data isolation between users
    - Prevents unauthorized access
*/

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

-- Allow users to create their own record
CREATE POLICY "Users can create own record"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Allow users to read their own record
CREATE POLICY "Users can read own record"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow users to update their own record
CREATE POLICY "Users can update own record"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Ensure RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;