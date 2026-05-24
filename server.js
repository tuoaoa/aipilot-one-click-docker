const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const dotenv = require("dotenv");
const axios = require("axios");
const { DatabaseSync } = require("node:sqlite");
const path = require("path");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4005;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DB_PATH = "/opt/global_ai_brain.db";

if (!GEMINI_API_KEY) {
    console.warn("WARNING: GEMINI_API_KEY is not set. The backend will return simulated errors.");
}

// Database Connection using Node.js Built-in SQLite
let db;
try {
    db = new DatabaseSync(DB_PATH);
    console.log("Connected to global SQLite database using node:sqlite successfully.");

    // Create users table for multi-tenancy
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            api_key TEXT UNIQUE NOT NULL,
            tier TEXT DEFAULT 'free',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Create file_snapshots table
    db.exec(`
        CREATE TABLE IF NOT EXISTS file_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            project_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_hash TEXT NOT NULL,
            summary TEXT,
            functions TEXT,
            last_updated INTEGER NOT NULL,
            UNIQUE(user_id, project_name, file_path)
        );
    `);

    // Initialize history table
    db.exec(`
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender TEXT,
            message TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

} catch (err) {
    console.error("Error connecting to global SQLite database:", err.message);
}

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Multi-Tenant Token Authentication Middleware
const authMiddleware = (req, res, next) => {
    const token = req.headers["x-memory-auth"];
    if (!token) {
        console.warn(`[Auth Warning] Missing memory auth token from ${req.ip}`);
        return res.status(401).json({ error: "Unauthorized: Missing memory auth token." });
    }
    
    try {
        const query = db.prepare("SELECT id, tier FROM users WHERE api_key = ?");
        const user = query.get(token);
        
        if (!user) {
            console.warn(`[Auth Warning] Invalid memory auth token attempt from ${req.ip}`);
            return res.status(401).json({ error: "Unauthorized: Invalid memory auth token." });
        }
        
        // Inject tenant context
        req.user_id = user.id;
        req.user_tier = user.tier;
        next();
    } catch (err) {
        console.error("Auth middleware database error:", err.message);
        return res.status(500).json({ error: "Internal server error during authentication." });
    }
};

// Rate Limiter: max 30 requests per 10 minutes per IP
const apiLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 30,
    message: { error: "Quá nhiều yêu cầu, vui lòng thử lại sau." }
});

// --- Centralized Cloud Brain APIs ---

// 1. Sync File Snapshot (Multi-Tenant)
app.post("/api/memory/sync", authMiddleware, (req, res) => {
    const { project_name, file_path, file_hash, summary, functions } = req.body;
    
    if (!project_name || !file_path || !file_hash) {
        return res.status(400).json({ error: "Missing required parameters: project_name, file_path, file_hash." });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    try {
        const insert = db.prepare(`
            INSERT OR REPLACE INTO file_snapshots 
            (user_id, project_name, file_path, file_hash, summary, functions, last_updated)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        insert.run(
            req.user_id,
            project_name, 
            file_path, 
            file_hash, 
            summary || "", 
            functions ? JSON.stringify(functions) : "[]", 
            timestamp
        );
        res.json({ success: true });
    } catch (err) {
        console.error("Error syncing snapshot:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// 2. Check File Hashes for Pruning (Multi-Tenant)
app.post("/api/memory/check", authMiddleware, (req, res) => {
    const { project_name, files } = req.body;

    if (!project_name || !Array.isArray(files)) {
        return res.status(400).json({ error: "Missing project_name or files array." });
    }

    const results = { unchanged: [], changed: [] };
    try {
        const query = db.prepare("SELECT file_hash FROM file_snapshots WHERE user_id = ? AND project_name = ? AND file_path = ?");
        files.forEach(file => {
            const row = query.get(req.user_id, project_name, file.file_path);
            if (!row || row.file_hash !== file.file_hash) {
                results.changed.push(file.file_path);
            } else {
                results.unchanged.push(file.file_path);
            }
        });
        res.json(results);
    } catch (err) {
        console.error("Error checking snapshots:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// 3. Get File Snapshot Metadata (Multi-Tenant)
app.post("/api/memory/get", authMiddleware, (req, res) => {
    const { project_name, file_path } = req.body;

    if (!project_name || !file_path) {
        return res.status(400).json({ error: "Missing required parameters: project_name, file_path." });
    }

    try {
        const query = db.prepare("SELECT * FROM file_snapshots WHERE user_id = ? AND project_name = ? AND file_path = ?");
        const row = query.get(req.user_id, project_name, file_path);
        if (!row) {
            return res.status(404).json({ error: "Snapshot not found." });
        }
        res.json({
            project_name: row.project_name,
            file_path: row.file_path,
            file_hash: row.file_hash,
            summary: row.summary,
            functions: JSON.parse(row.functions || "[]"),
            last_updated: row.last_updated
        });
    } catch (err) {
        console.error("Error fetching snapshot:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- Recall Endpoint ---
app.post("/api/recall", apiLimiter, async (req, res) => {
    try {
        const { query, context } = req.body;

        if (!query || typeof query !== "string") {
            return res.status(400).json({ error: "Missing or invalid query." });
        }
        if (!context || !Array.isArray(context)) {
            return res.status(400).json({ error: "Missing or invalid context." });
        }

        const safeContext = context.slice(0, 10);
        let totalLength = 0;
        const processedContext = safeContext.map(chunk => {
            const sum = chunk.summary ? chunk.summary.substring(0, 300) : "";
            const trans = chunk.transcript ? chunk.transcript.substring(0, 300) : "";
            totalLength += sum.length + trans.length;
            return `ID: ${chunk.id} | Nội dung: ${sum} ${trans}`;
        });

        if (totalLength > 5000) {
            return res.status(400).json({ error: "Context quá lớn." });
        }

        if (!GEMINI_API_KEY) {
            return res.status(503).json({ error: "Backend chưa được cấu hình API Key." });
        }

        const systemPrompt = `Bạn là BỘ NÃO THỨ 2 của người dùng — trợ lý HỒI TƯỞNG KÝ ỨC thông minh.
CHỈ dùng thông tin từ KÝ ỨC (context) được cung cấp.`;

        const promptText = `CÂU HỎI: ${query}\n\nKÝ ỨC (Context):\n${processedContext.join("\n")}`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const payload = {
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: { response_mime_type: "application/json" }
        };

        const response = await axios.post(url, payload);
        const candidate = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!candidate) {
            throw new Error("Invalid response from Gemini API");
        }

        res.json(JSON.parse(candidate));
    } catch (error) {
        console.error("Error processing /api/recall:", error.message);
        res.status(500).json({ error: "Đã xảy ra lỗi." });
    }
});

app.listen(PORT, () => {
    console.log(`Global AI Brain SaaS node core is running on port ${PORT}`);
});
