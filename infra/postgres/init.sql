-- Schema: llms-generator

CREATE TABLE IF NOT EXISTS jobs (
    id VARCHAR(255) PRIMARY KEY,
    url TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- previous_job_id VARCHAR(255) REFERENCES jobs(id),
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS llms_entries (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(255) REFERENCES jobs(id),
    url TEXT NOT NULL UNIQUE,
    content JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS content_hashes (
    id SERIAL PRIMARY KEY,
    url TEXT NOT NULL UNIQUE,
    content_hash VARCHAR(64) NOT NULL,
    last_checked TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_changed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    change_count INTEGER DEFAULT 0,
    is_changed BOOLEAN DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_content_hashes_url ON content_hashes(url);
CREATE INDEX IF NOT EXISTS idx_content_hashes_is_changed ON content_hashes(is_changed);
CREATE INDEX IF NOT EXISTS idx_content_hashes_last_changed ON content_hashes(last_changed); 

CREATE TABLE IF NOT EXISTS templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    content TEXT NOT NULL,
    variables JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DROP INDEX IF EXISTS idx_llms_entries_url;
CREATE INDEX IF NOT EXISTS idx_llms_entries_created_at ON llms_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_llms_entries_job_id ON llms_entries(job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status              ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_templates_name           ON templates(name);