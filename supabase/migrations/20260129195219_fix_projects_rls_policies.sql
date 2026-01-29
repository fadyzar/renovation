/*
  # Fix infinite recursion in projects RLS policies

  The original policies were causing infinite recursion when checking
  related tables. This migration simplifies the policies to avoid the issue.

  Changes:
  - Simplified projects SELECT policy to avoid checking quotes table
  - Contractors can view seeking_quotes projects
  - Owners can view their own projects
  - Keep the restriction simple and performant
*/

DROP POLICY "Owners can view own projects" ON projects;

CREATE POLICY "Users can view projects appropriately"
  ON projects FOR SELECT
  TO authenticated
  USING (
    auth.uid() = owner_id 
    OR auth.uid() = selected_contractor_id
    OR (
      status = 'seeking_quotes' 
      AND (
        SELECT role FROM profiles WHERE id = auth.uid()
      ) = 'contractor'
    )
  );

DROP POLICY "Owners can create projects" ON projects;

CREATE POLICY "Owners can insert projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY "Owners can update own projects" ON projects;

CREATE POLICY "Owners can update own projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY "Owners can delete own projects" ON projects;

CREATE POLICY "Owners can delete own projects"
  ON projects FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);