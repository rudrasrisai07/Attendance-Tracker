-- ==========================================================
-- ATTENDANCE MANAGER 2.0 - DATABASE SCHEMA
-- PostgreSQL
-- ==========================================================

-- Enable pgcrypto extension if needed for UUIDs or hash helpers
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    account_status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast user email lookup
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. USER SETTINGS TABLE
-- Stores user-specific preferences like semester start date and visible week count
CREATE TABLE IF NOT EXISTS user_settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    classes_weeks_visible INTEGER NOT NULL DEFAULT 1,
    labs_weeks_visible INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. SUBJECTS TABLE
CREATE TABLE IF NOT EXISTS subjects (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_code VARCHAR(50) NOT NULL DEFAULT '',
    subject_name VARCHAR(255) NOT NULL DEFAULT '',
    subject_type VARCHAR(20) NOT NULL CHECK (subject_type IN ('classes', 'labs')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for subjects
CREATE INDEX IF NOT EXISTS idx_subjects_user_type ON subjects(user_id, subject_type);
CREATE INDEX IF NOT EXISTS idx_subjects_user_id ON subjects(user_id);

-- 4. ATTENDANCE TABLE
-- Tracks attendance per user, subject, date, and lecture slot (l1, l2, l3, l4)
-- attendance_status: 1 = absent, 2 = present, 0 = unmarked
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    week INTEGER DEFAULT 1,
    lecture_number VARCHAR(10) NOT NULL CHECK (lecture_number IN ('l1', 'l2', 'l3', 'l4')),
    attendance_status INTEGER NOT NULL CHECK (attendance_status IN (0, 1, 2)),
    open_panel BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_subject_date_lecture UNIQUE (user_id, subject_id, date, lecture_number)
);

-- Indexes for high-frequency queries
CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_subject_date ON attendance(subject_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);

-- 5. PASSWORD RESET TOKENS TABLE
-- Stores cryptographically hashed tokens for secure, single-use password resets
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast token verification and user lookup
CREATE INDEX IF NOT EXISTS idx_password_reset_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);

