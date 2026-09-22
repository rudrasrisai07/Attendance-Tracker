require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase, isDbConnected } = require('./config/db');

const authRoutes = require('./routes/auth');
const subjectsRoutes = require('./routes/subjects');
const attendanceRoutes = require('./routes/attendance');
const adminRoutes = require('./routes/admin');

const app = express();
const portArg = process.argv.indexOf('--port') !== -1 ? process.argv[process.argv.indexOf('--port') + 1] : null;
const PORT = process.env.PORT || portArg || 5000;

// Security & Parsing Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static Frontend files
const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        databaseConnected: isDbConnected(),
        version: '2.0.0'
    });
});

// Serve frontend HTML pages directly
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendDir, 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(frontendDir, 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(frontendDir, 'register.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(frontendDir, 'admin.html'));
});

app.get('/reset-password', (req, res) => {
    res.sendFile(path.join(frontendDir, 'reset-password.html'));
});

// Fallback for SPA routing if needed
app.get('*', (req, res) => {
    // If request starts with /api/, send 404 JSON
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            success: false,
            message: 'API endpoint not found.'
        });
    }
    res.sendFile(path.join(frontendDir, 'index.html'));
});

// Centralized error handler
app.use((err, req, res, next) => {
    console.error('Server Unhandled Error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error. Please try again later.'
    });
});

// Start Server
async function startServer() {
    console.log('--- Initializing Attendance Manager 2.0 Server ---');
    await initDatabase();

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server is listening on http://localhost:${PORT}`);
        console.log(`📱 Frontend available at:`);
        console.log(`   - Dashboard:      http://localhost:${PORT}/`);
        console.log(`   - Login:          http://localhost:${PORT}/login.html`);
        console.log(`   - Register:       http://localhost:${PORT}/register.html`);
        console.log(`   - Reset Password: http://localhost:${PORT}/reset-password.html`);
        console.log(`   - Admin:          http://localhost:${PORT}/admin.html`);
    });
}

if (require.main === module) {
    startServer();
}

module.exports = app;
