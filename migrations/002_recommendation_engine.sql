-- Migration: Add recommendation engine support
-- Run this AFTER the initial database-schema.sql

USE college_ai_visibility;

-- ============================================
-- 1. ADD NEW COLUMNS TO ai_queries TABLE
-- ============================================

-- Add prompt_category column
ALTER TABLE ai_queries 
ADD COLUMN prompt_category VARCHAR(50) NULL AFTER prompt_text;

-- Add explicit reasoning from structured prompt
ALTER TABLE ai_queries 
ADD COLUMN your_college_reasoning TEXT NULL AFTER your_college_context;

-- Add weaknesses identified for your college
ALTER TABLE ai_queries 
ADD COLUMN your_college_weaknesses JSON NULL AFTER your_college_reasoning;

-- Add strengths identified for your college
ALTER TABLE ai_queries 
ADD COLUMN your_college_strengths JSON NULL AFTER your_college_weaknesses;

-- Add sources/citations mentioned in response
ALTER TABLE ai_queries 
ADD COLUMN sources_cited JSON NULL AFTER competitors_mentioned;

-- Add key ranking factors mentioned by AI
ALTER TABLE ai_queries 
ADD COLUMN ranking_factors JSON NULL AFTER sources_cited;

-- Add index for prompt_category
ALTER TABLE ai_queries ADD INDEX idx_prompt_category (prompt_category);


-- ============================================
-- 2. UPDATE recommendations TABLE (if needed)
-- ============================================

-- Drop existing recommendations table and recreate with new structure
DROP TABLE IF EXISTS recommendations;

CREATE TABLE recommendations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  college_id INT NOT NULL,
  priority ENUM('high', 'medium', 'low') NOT NULL,
  category VARCHAR(100) NOT NULL,
  issue TEXT NOT NULL,
  root_cause TEXT NULL,
  recommendation TEXT NOT NULL,
  expected_impact VARCHAR(255) NULL,
  impact_score DECIMAL(5,2) NULL,
  affected_queries JSON NULL COMMENT 'Array of prompt texts affected',
  competitor_reference JSON NULL COMMENT 'Array of competitor comparisons',
  implementation_steps JSON NULL COMMENT 'Array of step strings',
  estimated_effort ENUM('low', 'medium', 'high') NULL,
  estimated_time_days INT NULL,
  status ENUM('open', 'in_progress', 'completed', 'dismissed') DEFAULT 'open',
  validation_status ENUM('pending', 'validated', 'not_validated') DEFAULT 'pending',
  visibility_before DECIMAL(5,2) NULL COMMENT 'Visibility score when recommendation was created',
  visibility_after DECIMAL(5,2) NULL COMMENT 'Visibility score after implementation',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE,
  INDEX idx_college_status (college_id, status),
  INDEX idx_priority (priority),
  INDEX idx_category (category),
  INDEX idx_impact_score (impact_score DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- 3. UPDATE competitors_mentioned JSON STRUCTURE
-- ============================================
-- Note: The competitors_mentioned field in ai_queries now expects this structure:
-- [
--   {
--     "name": "SRM University",
--     "rank": 1,
--     "context": "Strong placement record",
--     "reasoning": "Why they ranked here",
--     "strengths": ["92% placement", "7.2 LPA average"]
--   }
-- ]
-- No schema change needed, just document the expected format.


-- ============================================
-- 4. SAMPLE DATA FOR TESTING (Optional)
-- ============================================

-- You can run this to test the recommendation engine:
-- INSERT INTO recommendations (college_id, priority, category, issue, root_cause, recommendation, expected_impact, impact_score, implementation_steps, estimated_effort, estimated_time_days)
-- VALUES 
-- (1, 'high', 'placement', 'Missing placement statistics', 'AI cannot find placement data for your college', 'Add comprehensive placement statistics to your website', '+30% visibility improvement', 30.00, '["Create Placements page", "Add placement percentage", "List top recruiters"]', 'medium', 7);


-- ============================================
-- 5. VERIFICATION QUERIES
-- ============================================

-- Check ai_queries table structure
-- DESCRIBE ai_queries;

-- Check recommendations table structure
-- DESCRIBE recommendations;

-- Verify new columns exist
-- SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
-- FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_NAME = 'ai_queries' 
-- AND TABLE_SCHEMA = 'college_ai_visibility'
-- ORDER BY ORDINAL_POSITION;
