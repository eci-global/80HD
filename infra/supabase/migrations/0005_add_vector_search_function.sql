-- Migration: Add vector similarity search function
-- Description: Creates a function for performing cosine similarity search on activity_chunks embeddings
-- Verification: Run this migration twice and verify state is identical
--
-- Verification queries (run these after migration to confirm idempotency):
-- SELECT proname FROM pg_proc WHERE proname = 'match_activity_chunks';

-- Function for vector similarity search
CREATE OR REPLACE FUNCTION match_activity_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  p_tenant_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  activity_id uuid,
  content text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ac.id,
    ac.activity_id,
    ac.content,
    1 - (ac.embedding <=> query_embedding) AS similarity
  FROM activity_chunks ac
  WHERE ac.tenant_id = COALESCE(p_tenant_id, (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()))
    AND ac.status = 'completed'
    AND ac.embedding IS NOT NULL
    AND 1 - (ac.embedding <=> query_embedding) > match_threshold
  ORDER BY ac.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION match_activity_chunks(vector, float, int, uuid) TO authenticated;

