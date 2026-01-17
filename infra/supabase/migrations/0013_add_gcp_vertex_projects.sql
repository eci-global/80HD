-- Migration: Add GCP Vertex AI project tracking
-- Created: 2026-01-17

-- Main table for tracking GCP Vertex AI projects
CREATE TABLE gcp_vertex_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_unit TEXT NOT NULL UNIQUE,
    project_id TEXT NOT NULL UNIQUE,
    project_number TEXT NOT NULL,
    folder_id TEXT,
    api_key_id TEXT NOT NULL,
    api_key_value TEXT NOT NULL,  -- Encrypted with pgcrypto
    api_key_created_at TIMESTAMPTZ DEFAULT NOW(),
    api_key_last_rotated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT NOT NULL,
    status TEXT CHECK (status IN ('active', 'suspended', 'deleted')) DEFAULT 'active',
    metadata JSONB,
    CONSTRAINT valid_business_unit CHECK (business_unit ~ '^[a-z0-9\-]+$')
);

-- Create indexes for common queries
CREATE INDEX idx_gcp_vertex_projects_business_unit ON gcp_vertex_projects(business_unit);
CREATE INDEX idx_gcp_vertex_projects_project_id ON gcp_vertex_projects(project_id);
CREATE INDEX idx_gcp_vertex_projects_status ON gcp_vertex_projects(status);

-- Row-Level Security
ALTER TABLE gcp_vertex_projects ENABLE ROW LEVEL SECURITY;

-- Policy: Service role has full access
CREATE POLICY "Allow service role full access"
    ON gcp_vertex_projects
    FOR ALL
    TO service_role
    USING (true);

-- Policy: Users can view their business unit projects
CREATE POLICY "Users can view their business unit"
    ON gcp_vertex_projects
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.user_id = auth.uid()
            AND user_profiles.business_unit = gcp_vertex_projects.business_unit
        )
    );

-- Audit log table for tracking all operations
CREATE TABLE gcp_vertex_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT,
    action TEXT NOT NULL,  -- 'created', 'api_key_generated', 'api_key_rotated', etc.
    performed_by TEXT NOT NULL,
    performed_at TIMESTAMPTZ DEFAULT NOW(),
    details JSONB,
    CONSTRAINT fk_project FOREIGN KEY (project_id)
        REFERENCES gcp_vertex_projects(project_id)
        ON DELETE SET NULL
);

-- Create index for audit log queries
CREATE INDEX idx_gcp_vertex_audit_log_project_id ON gcp_vertex_audit_log(project_id);
CREATE INDEX idx_gcp_vertex_audit_log_performed_at ON gcp_vertex_audit_log(performed_at);
CREATE INDEX idx_gcp_vertex_audit_log_action ON gcp_vertex_audit_log(action);

-- Row-Level Security for audit log
ALTER TABLE gcp_vertex_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Service role has full access
CREATE POLICY "Allow service role full access on audit log"
    ON gcp_vertex_audit_log
    FOR ALL
    TO service_role
    USING (true);

-- Policy: Users can view audit logs for their business unit projects
CREATE POLICY "Users can view their business unit audit logs"
    ON gcp_vertex_audit_log
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM gcp_vertex_projects
            JOIN user_profiles ON user_profiles.business_unit = gcp_vertex_projects.business_unit
            WHERE gcp_vertex_projects.project_id = gcp_vertex_audit_log.project_id
            AND user_profiles.user_id = auth.uid()
        )
    );

-- Function to automatically log project operations
CREATE OR REPLACE FUNCTION log_gcp_vertex_operation()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO gcp_vertex_audit_log (project_id, action, performed_by, details)
        VALUES (NEW.project_id, 'project_created', NEW.created_by,
                jsonb_build_object('business_unit', NEW.business_unit));
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.api_key_id != NEW.api_key_id) THEN
            INSERT INTO gcp_vertex_audit_log (project_id, action, performed_by, details)
            VALUES (NEW.project_id, 'api_key_rotated', current_user,
                    jsonb_build_object('old_key_id', OLD.api_key_id, 'new_key_id', NEW.api_key_id));
        END IF;
        IF (OLD.status != NEW.status) THEN
            INSERT INTO gcp_vertex_audit_log (project_id, action, performed_by, details)
            VALUES (NEW.project_id, 'status_changed', current_user,
                    jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
        END IF;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO gcp_vertex_audit_log (project_id, action, performed_by, details)
        VALUES (OLD.project_id, 'project_deleted', current_user,
                jsonb_build_object('business_unit', OLD.business_unit));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic audit logging
CREATE TRIGGER gcp_vertex_projects_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON gcp_vertex_projects
    FOR EACH ROW EXECUTE FUNCTION log_gcp_vertex_operation();

-- Grant necessary permissions
GRANT SELECT ON gcp_vertex_projects TO authenticated;
GRANT SELECT ON gcp_vertex_audit_log TO authenticated;
GRANT ALL ON gcp_vertex_projects TO service_role;
GRANT ALL ON gcp_vertex_audit_log TO service_role;
