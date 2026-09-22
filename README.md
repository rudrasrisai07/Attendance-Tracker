# 📚 College Attendance Manager 2.0 — Full-Stack Edition
### Concept 5: Modern Dynamic Gradient UI (Vibrant & Fluid)

A production-ready, full-stack Attendance Management Web Application built with **Vanilla HTML5, CSS3, JavaScript (ES6+), Node.js, Express.js, and PostgreSQL**. The system allows students and instructors to track lecture attendance across dynamic subjects and multi-week semesters, with full password recovery, in-app security settings, and an institution-grade Administrator portal for student auditing.

---

## 🎨 Design System: Concept 5 (Modern Dynamic Gradient UI)

The frontend uses the **Concept 5 — Modern Dynamic Gradient UI** archetype:
- **Atmospheric Canvas**: Deep cosmic violet/indigo canvas (`#0A0718`) layered with fluid, multi-point radial gradient ambient meshes.
- **Glassmorphism Surfaces**: Frosted glass cards with `backdrop-filter: blur(16px)`, translucent violet surfaces, and illuminated edge borders.
- **Dynamic Fluid Gradients**: Vibrant violet-to-fuchsia-to-cyan linear gradients (`linear-gradient(135deg, #7C3AED 0%, #C026D3 50%, #EC4899 100%)`) with luminous interactive glow effects on buttons, active tabs, and modals.
- **Luminous Status Badges**: Attendance status states feature emerald green (`#10B981`) for Present and rose crimson (`#F43F5E`) for Absent, paired with dynamically rendered SVG/Canvas gradient donut charts.
- **Adaptive Light Theme**: High-contrast, clean pastel mesh theme toggleable on demand (`ThemeManager`).
- **Pure Vanilla Stack**: Built strictly with semantic HTML5, CSS3, and native JavaScript—no frontend framework, no transpilation, and no bundler required.

---

## 🚀 Key Highlights & Capabilities

- 🛡️ **Full-Stack REST Architecture**: Express.js REST API with parameterized PostgreSQL queries and connection pooling.
- 🔐 **Authentication & Security**:
  - Secure registration & login with 10-round bcrypt password hashing.
  - Cryptographically signed JWT tokens with bearer authentication.
  - Multi-user data isolation (users strictly query their own subjects and attendance).
  - RBAC (Role-Based Access Control) separating normal students from administrators.
- 🔑 **Complete Password Management**:
  - **Forgot Password**: Time-limited (15 min), single-use SHA-256 hashed reset tokens with anti-user-enumeration protection.
  - **Reset Password Page (`reset-password.html`)**: Dedicated responsive view with URL token validation, password strength meter, and password visibility toggles.
  - **In-App Change Password Modal**: Integrated into the student dashboard settings with current password verification and immediate token invalidation.
  - **Consistent Policy**: Minimum 6 characters required across all forms.
- 📧 **Nodemailer Delivery & Local Terminal Fallback**:
  - In development (`EMAIL_ENABLED=false`): Generated password reset links print directly to the server terminal with clear instructions.
  - In production (`EMAIL_ENABLED=true`): Automated dispatch of responsive HTML reset emails via SMTP.
- 👑 **Administrator Portal (`admin.html`)**: Real-time stats (total students, active accounts, attendance rates), user management (activation / deactivation toggle), and student attendance inspection.
- 👆 **Interactive Attendance Matrix**:
  - **Single Click → Absent (❌)**
  - **Double Click → Present (✔)** with a 250ms debouncer preventing accidental absent triggers.
  - **L1–L4 Lecture Slots**: Expandable multi-lecture sessions per date.
- 📈 **Dynamic Analytics**: Real-time circular percentage charts and automated `< 75%` attendance shortage warning badges.
- 📦 **Local Storage Migration Assistant**: Automatic detection and one-click cloud import of legacy attendance data from browser storage into PostgreSQL.
- 📤 **JSON Backup & Restore**: Authenticated semester export and import.
- ⌨️ **Keyboard Navigation**: Power-user shortcuts (<kbd>Ctrl+S</kbd>, <kbd>Ctrl+E</kbd>, <kbd>Ctrl+A</kbd>, etc.).

---

## 🏗️ Architecture Overview

```text
┌──────────────────────────────────────────────────────────────┐
│             Frontend (HTML5 / CSS3 / Vanilla JS)             │
│  - Dashboard (index.html)        - Admin Portal (admin.html) │
│  - Login (login.html)            - Register (register.html)  │
│  - Reset Password (reset-password.html)                      │
│  - Concept 5 Themes (style.css, auth.css, admin.css)         │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTP / JSON REST API (JWT)
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                    Express.js API Server                     │
│  - Auth Middleware (JWT & RBAC)  - Nodemailer Email Service  │
│  - Routes: /api/auth, /api/subjects, /api/attendance          │
│  - Admin Routes: /api/admin (stats, users, audit)            │
└──────────────────────────────┬───────────────────────────────┘
                               │ Parameterized SQL Queries
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                       │
│  - users                         - user_settings             │
│  - subjects                      - attendance                │
│  - password_reset_tokens                                     │
└──────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Technology Stack

### Frontend
- **HTML5**: Semantic layout, accessible forms, modal dialogs.
- **CSS3**: Concept 5 tokens, backdrop-filter glassmorphism, responsive grid/flexbox.
- **Vanilla JavaScript (ES6+)**: Pure client-side code, Fetch API, Canvas API.

### Backend
- **Node.js** (v18+ / v20+ / v22+ compatible)
- **Express.js** (v4.21+)
- **bcryptjs**: Salt generation and one-way password hashing.
- **jsonwebtoken (JWT)**: Signed authentication tokens.
- **nodemailer**: SMTP email dispatcher.
- **pg (node-postgres)**: PostgreSQL client with connection pooling.
- **cors & dotenv**: Cross-origin headers and environment management.

---

## 💻 Local Windows Setup & Installation Guide

Follow these 10 steps to run the application locally on Windows (using PowerShell, Command Prompt, or Windows Terminal):

### 1. Install Node.js
Download and install the LTS version of **Node.js** (v18.0.0 or higher) from [nodejs.org](https://nodejs.org). This automatically installs `npm`.

### 2. Install PostgreSQL
Download and install **PostgreSQL** (v14 or higher) from [postgresql.org](https://www.postgresql.org/download/windows/). During installation, set a master password for the default `postgres` superuser.

### 3. Create the PostgreSQL Database
Open **SQL Shell (psql)** or **pgAdmin 4** and create a new database:
```sql
CREATE DATABASE attendance_tracker;
```

### 4. Run `database/schema.sql`
Apply the database schema to your newly created database.
In PowerShell or Command Prompt:
```powershell
psql -U postgres -d attendance_tracker -f database/schema.sql
```
*(Alternatively, in pgAdmin: Open the Query Tool on `attendance_tracker`, open `database/schema.sql`, and execute it. The server also automatically verifies and applies `database/schema.sql` on startup!)*

### 5. Copy `.env.example` to `.env`
In your project directory, copy the template file to create `.env`:
- **PowerShell**:
  ```powershell
  Copy-Item .env.example .env
  ```
- **Command Prompt**:
  ```cmd
  copy .env.example .env
  ```

### 6. Enter Local PostgreSQL Credentials
Open `.env` in any text editor (Notepad, VS Code, etc.) and configure your local settings:
```env
PORT=5000
NODE_ENV=development

# Enter your local PostgreSQL password
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/attendance_tracker

# Secure random JWT secret
JWT_SECRET=your_super_secret_jwt_random_key_here
JWT_EXPIRES_IN=7d

# Initial Administrator Credentials (used by npm run seed:admin)
ADMIN_NAME=System Administrator
ADMIN_EMAIL=admin@attendance.local
ADMIN_PASSWORD=AdminSecurePassword123!

# Application URL
APP_URL=http://localhost:5000

# Email Delivery Configuration (Keep false for local development)
EMAIL_ENABLED=false
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

### 7. Run `npm install`
Install the required dependencies (Express, PostgreSQL client, bcryptjs, jsonwebtoken, cors, dotenv, nodemailer, nodemon):
```powershell
npm install
```

### 8. Start Development Server
For active development with auto-reloading via `nodemon`:
```powershell
npm run dev
```

### 9. Or Production-Style Local Run
To run standard Node.js without file watchers:
```powershell
npm start
```
*(Optional: Before your first login as admin, run `npm run seed:admin` to seed the admin account).*

### 10. Open in Browser
Navigate your browser to:
```
http://localhost:5000
```
- 📊 **Student Dashboard**: `http://localhost:5000/`
- 🔑 **Sign In / Forgot Password**: `http://localhost:5000/login.html`
- 📝 **Register Account**: `http://localhost:5000/register.html`
- 🛡️ **Administrator Portal**: `http://localhost:5000/admin.html`
- ⚙️ **Account & Password Settings**: Click **⚙️ Settings** in the top navigation bar.

---

## 🔑 Development Password Reset Testing

When `EMAIL_ENABLED=false` (default for local development):
1. Navigate to `http://localhost:5000/login.html` and click **Forgot Password?**
2. Enter your registered email address and click **Send Reset Link**.
3. Look directly at your backend terminal where Node.js / nodemon is running. You will see:
   ```text
   ================================================================
     📧 [LOCAL DEV - PASSWORD RESET DISPATCH]
     To:           Student <alice@college.edu>
     Reset Link:   http://localhost:5000/reset-password.html?token=9f8c...
     Expires in:   15 minutes (single-use)
     Notice:       EMAIL_ENABLED=false. Configure SMTP in .env for production.
   ================================================================
   ```
4. Copy the `Reset Link` and paste it into your browser.
5. Set your new password and sign in immediately!

To dispatch real emails in production, set `EMAIL_ENABLED=true` and provide valid SMTP credentials in `.env`.

---

## 📂 Project Structure

```text
project-root/
│
├── backend/
│   ├── config/
│   │   └── db.js                 # PostgreSQL Pool & Adaptive Fallback Engine
│   ├── middleware/
│   │   └── auth.js               # JWT Auth & Admin Role Verification
│   ├── routes/
│   │   ├── admin.js              # /api/admin (Metrics, User Audits)
│   │   ├── attendance.js         # /api/attendance (Marking, Slots, Migration)
│   │   ├── auth.js               # /api/auth (Login, Register, Forgot, Reset, Change)
│   │   └── subjects.js           # /api/subjects (User-isolated CRUD)
│   ├── utils/
│   │   └── email.js              # Nodemailer Dispatcher & Terminal Fallback
│   └── server.js                 # Express Server Entry Point (Default Port 5000)
│
├── database/
│   ├── schema.sql                # Complete PostgreSQL Schema (Includes password_reset_tokens)
│   └── seed.js                   # Secure Initial Admin Seeder
│
├── frontend/
│   ├── css/
│   │   ├── admin.css             # Administrator Styles
│   │   ├── auth.css              # Authentication & Modal Styles
│   │   └── style.css             # Concept 5 Modern Dynamic Gradient UI
│   ├── js/
│   │   ├── admin.js              # Admin Dashboard Controllers
│   │   ├── api.js                # Centralized Fetch Wrapper with JWT
│   │   ├── auth.js               # Authentication, Session & Modals
│   │   ├── migration.js          # LocalStorage Cloud Migration Assistant
│   │   ├── script.js             # Attendance Matrix, Debounce & Analytics
│   │   └── theme.js              # Dark/Light Theme Manager
│   ├── admin.html                # Administrator Dashboard
│   ├── index.html                # Student Attendance Dashboard
│   ├── login.html                # Login & Forgot Password
│   ├── register.html             # Student Registration
│   └── reset-password.html       # Dedicated Password Reset Page
│
├── test/
│   └── api-test.js               # Complete 12-Suite Automated Integration Test
│
├── .env.example                  # Environment Configuration Template
├── .gitignore                    # Git Exclusion Rules
├── package.json                  # Clean Production Dependencies
├── package-lock.json             # Fresh Lockfile
└── README.md                     # Documentation
```

---

## 🧪 Automated Integration Tests

Run the full end-to-end integration test suite:
```bash
npm run test:api
```

This tests the complete API and security matrix:
1. **Health Check**: Service status and database readiness.
2. **User Registration**: Input validation, password hashing, and duplicate account rejection.
3. **Authentication & Password Verification**: Login credentials and JWT generation.
4. **Multi-User Data Isolation**: Verification that User A cannot see, edit, or delete User B's subjects.
5. **Attendance Operations**: Single-click absent (1), double-click present (2), and cross-user tampering protection.
6. **Administrator Portal & RBAC**: Admin login, statistics retrieval, student inspection, and account deactivation/reactivation.
7. **LocalStorage Migration API**: Seamless legacy browser data import.
8. **JSON Data Export**: Full semester backup generation.
9. **Forgot Password**: Anti-enumeration generic response and cryptographically secure token creation.
10. **Reset Password**: Token validation, expiration checks, single-use invalidation, password length enforcement (>=6 chars), and old password revocation.
11. **Authenticated Password Change**: Current password verification, validation, and immediate token invalidation.

---

## 🖱️ Attendance Matrix Interaction

| Action | Gesture | Result |
|---|---|---|
| **Mark Absent** | Single Click | Attendance state set to **1** (`❌` icon, rose background) |
| **Mark Present** | Double Click | Attendance state set to **2** (`✔` icon, emerald background) |
| **Clear / Reset**| Click again | Toggles slot back to unmarked (`0`) |
| **More Lectures**| Click `▼` | Expands L2, L3, and L4 lecture slots for that date |

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| <kbd>Ctrl</kbd> + <kbd>S</kbd> | Force Cloud Database Synchronization |
| <kbd>Ctrl</kbd> + <kbd>E</kbd> | Export Attendance JSON Backup |
| <kbd>Ctrl</kbd> + <kbd>R</kbd> | Clear / Reset Displayed Attendance |
| <kbd>Ctrl</kbd> + <kbd>F</kbd> | Focus Subject Search Field |
| <kbd>Ctrl</kbd> + <kbd>A</kbd> | Add New Subject |
| <kbd>Ctrl</kbd> + <kbd>W</kbd> | Add Next Semester Week |
| <kbd>Ctrl</kbd> + <kbd>C</kbd> | Switch to Classes Tab |
| <kbd>Ctrl</kbd> + <kbd>L</kbd> | Switch to Labs Tab |

---

## 🔒 Security Architecture

1. **No Plain-Text Passwords**: Every password is processed with bcrypt using 10 salt rounds upon registration or admin seeding. Password hashes are never exposed through API responses.
2. **Strict User Isolation**: All subject and attendance endpoints enforce `WHERE user_id = req.user.id`. User A can never read, modify, or delete User B's subjects or attendance records.
3. **Role-Based Access Control (RBAC)**: Administrator endpoints (`/api/admin/*`) require both a valid JWT and verification that `req.user.role === 'admin'`. Normal users receive `403 Forbidden`.
4. **Parameterized SQL Queries**: All database operations use `$1, $2, ...` placeholders via `pg.Pool`, completely protecting against SQL injection attacks.
5. **Account Status Enforcement**: When an administrator deactivates an account (`account_status = 'inactive'`), active tokens are immediately rejected with `403 Forbidden`.
6. **Single-Use Password Reset Tokens**: Password reset tokens are generated with 32 cryptographic random bytes, stored exclusively as SHA-256 hashes, set to expire in 15 minutes, and invalidated upon use or subsequent requests.

---

## 📡 REST API Endpoints

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Register a new account (`name`, `email`, `password`, `confirmPassword`).
- `POST /api/auth/login` — Sign in and receive JWT token (`email`, `password`).
- `GET /api/auth/me` — Retrieve current authenticated user profile (`Bearer <token>`).
- `POST /api/auth/logout` — Acknowledge client-side session termination.
- `POST /api/auth/forgot-password` — Request a single-use, time-limited password reset link (`email`).
- `POST /api/auth/reset-password` — Complete password reset (`token`, `newPassword`, `confirmPassword`).
- `POST /api/auth/change-password` — Authenticated password change (`currentPassword`, `newPassword`, `confirmPassword`).

### Subjects (`/api/subjects`)
- `GET /api/subjects?type=classes|labs` — Fetch authenticated user's subjects.
- `POST /api/subjects` — Create a new subject for the authenticated user.
- `PUT /api/subjects/:id` — Update subject code or name (checks ownership).
- `DELETE /api/subjects/:id` — Delete subject and associated attendance records.

### Attendance & Settings (`/api/attendance`)
- `GET /api/attendance` — Retrieve full attendance map for the user.
- `POST /api/attendance/mark` — Mark attendance for a slot (`subject_id`, `date`, `lecture_number`, `attendance_status`).
- `POST /api/attendance/panel-state` — Save expand/collapse state of L2–L4 panel.
- `GET /api/attendance/settings` — Get user semester settings.
- `PUT /api/attendance/settings` — Update semester start date or visible week counts.
- `POST /api/attendance/migrate` — Import legacy LocalStorage payload to PostgreSQL.
- `GET /api/attendance/export` — Export user's complete data as a JSON file.

### Administration (`/api/admin`) *(Requires Admin Role)*
- `GET /api/admin/stats` — System summary (total users, active accounts, total records, average attendance).
- `GET /api/admin/users?search=&role=&status=` — Paginated and filterable user list.
- `PUT /api/admin/users/:id/status` — Activate or deactivate an account.
- `DELETE /api/admin/users/:id` — Delete a user and cascade their attendance (self-deletion blocked).
- `GET /api/admin/users/:id/attendance` — Inspect a student's subjects and attendance breakdown.

---

## 📦 Local Storage Migration Guide

If you previously used Attendance Manager v1 (which stored attendance in your browser's Local Storage):
1. Register a new account or log in.
2. The application automatically detects `attendanceManagerData` in your browser.
3. An alert banner will appear at the top: **"Existing Local Storage Attendance Found"**.
4. Click **☁️ Migrate to Cloud**.
5. Your subjects, visible weeks, and attendance history will be validated and inserted into PostgreSQL, permanently linked to your account!

---

## 🚀 Deployment

### Deploying to Render / Railway / Heroku
1. Connect your GitHub repository.
2. Add a PostgreSQL database add-on.
3. In Environment Variables, specify:
   - `DATABASE_URL` (provided by PostgreSQL service)
   - `JWT_SECRET` (secure random string)
   - `ADMIN_EMAIL` & `ADMIN_PASSWORD`
4. Set Build Command: `npm install`
5. Set Start Command: `node database/seed.js && node backend/server.js`

### Deploying to Vercel
A [`vercel.json`](vercel.json) file is included. Connect the repo to Vercel, configure environment variables in project settings, and Vercel will host both the frontend statically and the Express backend as serverless functions.

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).
