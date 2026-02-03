-- Create database
CREATE DATABASE IF NOT EXISTS college_ai_visibility;
USE college_ai_visibility;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role ENUM('admin', 'college_user') DEFAULT 'college_user',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Colleges table
CREATE TABLE IF NOT EXISTS colleges (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  college_name VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  website VARCHAR(500),
  nirf_rank INT,
  established_year INT,
  college_type ENUM('private', 'government', 'deemed') DEFAULT 'private',
  programs JSON COMMENT 'Array of programs offered',
  specializations JSON COMMENT 'Array of specializations',
  subscription_plan ENUM('starter', 'professional', 'enterprise') DEFAULT 'professional',
  subscription_status ENUM('trial', 'active', 'expired') DEFAULT 'trial',
  trial_ends_at TIMESTAMP NULL,
  subscription_ends_at TIMESTAMP NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_city (city),
  INDEX idx_subscription_status (subscription_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Competitors table
CREATE TABLE IF NOT EXISTS competitors (
  id INT PRIMARY KEY AUTO_INCREMENT,
  college_id INT NOT NULL,
  competitor_college_name VARCHAR(255) NOT NULL,
  competitor_city VARCHAR(100),
  competitor_nirf_rank INT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE,
  INDEX idx_college_id (college_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Prompt Library table
CREATE TABLE IF NOT EXISTS prompt_library (
  id INT PRIMARY KEY AUTO_INCREMENT,
  prompt_text TEXT NOT NULL,
  category ENUM('general', 'program_specific', 'feature_specific', 'competitive', 'student_intent') NOT NULL,
  is_system_prompt BOOLEAN DEFAULT TRUE,
  college_id INT NULL,
  has_placeholders BOOLEAN DEFAULT FALSE,
  placeholder_fields JSON COMMENT 'Array of placeholder field names',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE,
  INDEX idx_category (category),
  INDEX idx_college_id (college_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AI Queries table
CREATE TABLE IF NOT EXISTS ai_queries (
  id INT PRIMARY KEY AUTO_INCREMENT,
  college_id INT NOT NULL,
  prompt_id INT NOT NULL,
  prompt_text TEXT NOT NULL,
  ai_engine ENUM('chatgpt', 'claude', 'perplexity') DEFAULT 'chatgpt',
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  execution_status ENUM('pending', 'success', 'failed') DEFAULT 'pending',
  error_message TEXT,
  raw_response LONGTEXT,
  colleges_mentioned JSON COMMENT 'Array of college names found',
  your_college_mentioned BOOLEAN DEFAULT FALSE,
  your_college_rank INT,
  your_college_context TEXT,
  competitors_mentioned JSON COMMENT 'Array of competitor objects',
  response_length INT,
  total_colleges_in_response INT,
  INDEX idx_college_date (college_id, executed_at),
  INDEX idx_prompt (prompt_id),
  INDEX idx_status (execution_status),
  FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE,
  FOREIGN KEY (prompt_id) REFERENCES prompt_library(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Visibility Scores table
CREATE TABLE IF NOT EXISTS visibility_scores (
  id INT PRIMARY KEY AUTO_INCREMENT,
  college_id INT NOT NULL,
  period_type ENUM('daily', 'weekly', 'monthly') NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_queries INT NOT NULL,
  mentions_count INT NOT NULL,
  visibility_percentage DECIMAL(5,2) NOT NULL,
  average_rank DECIMAL(4,2),
  category_scores JSON COMMENT 'Scores by category',
  competitor_scores JSON COMMENT 'Competitor comparison data',
  your_rank_among_competitors INT,
  change_from_previous_period DECIMAL(5,2),
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE,
  INDEX idx_college_period (college_id, period_type, period_start),
  UNIQUE KEY unique_period (college_id, period_type, period_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Recommendations table
CREATE TABLE IF NOT EXISTS recommendations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  college_id INT NOT NULL,
  priority ENUM('high', 'medium', 'low') NOT NULL,
  category VARCHAR(100) NOT NULL,
  issue TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  expected_impact VARCHAR(255),
  implementation_steps JSON,
  estimated_effort ENUM('low', 'medium', 'high'),
  estimated_time_days INT,
  status ENUM('open', 'in_progress', 'completed', 'dismissed') DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE,
  INDEX idx_college_status (college_id, status),
  INDEX idx_priority (priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
