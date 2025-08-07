-- Update opencaselist_scrape_log policy to use RBAC instead of hardcoded email
DROP POLICY IF EXISTS "Admin only scrape log" ON public.opencaselist_scrape_log;

-- Create new policy using RBAC check
CREATE POLICY "Admin only scrape log" ON public.opencaselist_scrape_log
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
      AND (expires_at IS NULL OR expires_at > NOW())
    )
  );