import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import Stripe from "stripe";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Konfiguracija varijabli okruženja
const JWT_SECRET = process.env.JWT_SECRET || "culina-secret-key-123";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

// Inicijalizacija SQLite baze
const db = new Database("culina.db");

// Kreiranje tabela
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    firstName TEXT,
    lastName TEXT,
    address TEXT,
    postcode TEXT,
    phone TEXT,
    profile TEXT,
    stats TEXT,
    budget TEXT,
    inventory TEXT,
    grocery TEXT,
    subscription TEXT DEFAULT 'basic'
  )
`);

// Migracija: Dodavanje postcode kolone ako ne postoji
try {
  db.exec("ALTER TABLE users ADD COLUMN postcode TEXT");
} catch (e) {
  // Kolona već postoji
}

async function startServer() {
  const app = express();
  
  // BITNO ZA RENDER: Koristimo port koji nam sistem dodijeli ili 3000 lokalno
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());
  app.use(cookieParser());

  // --- Middleware za autentifikaciju ---
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Niste prijavljeni" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
      req.userId = decoded.id;
      next();
    } catch (e) {
      res.status(401).json({ error: "Nevalidan token" });
    }
  };

  // --- API Rute ---

  app.post("/api/auth/register", async (req, res) => {
    const { email, password, firstName, lastName, address, postcode, phone } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = db.prepare(
        "INSERT INTO users (email, password, firstName, lastName, address, postcode, phone) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(email, hashedPassword, firstName, lastName, address, postcode, phone);
      
      const token = jwt.sign({ id: result.lastInsertRowid }, JWT_SECRET);
      res.cookie("token", token, { 
        httpOnly: true, 
        secure: true, 
        sameSite: "none",
        maxAge: 24 * 60 * 60 * 1000 // 1 dan
      });
      res.json({ id: result.lastInsertRowid, email, firstName, lastName });
    } catch (e) {
      res.status(400).json({ error: "Email već postoji" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Pogrešan email ili lozinka" });
    }
    
    const token = jwt.sign({ id: user.id }, JWT_SECRET);
    res.cookie("token", token, { 
      httpOnly: true, 
      secure: true, 
      sameSite: "none",
      maxAge: 24 * 60 * 60 * 1000 
    });
    res.json({ id: user.id, email, firstName: user.firstName });
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ success: true });
  });

  app.get("/api/user/me", authenticate, (req: any, res) => {
    const user = db.prepare("SELECT id, email, firstName, lastName, address, postcode, phone, profile, stats, budget, inventory, grocery, subscription FROM users WHERE id = ?").get(req.userId) as any;
    res.json(user);
  });

  app.post("/api/user/sync", authenticate, (req: any, res) => {
    const { profile, stats, budget, inventory, grocery } = req.body;
    db.prepare("UPDATE users SET profile = ?, stats = ?, budget = ?, inventory = ?, grocery = ? WHERE id = ?")
      .run(JSON.stringify(profile), JSON.stringify(stats), JSON.stringify(budget), JSON.stringify(inventory), JSON.stringify(grocery), req.userId);
    res.json({ success: true });
  });

  // --- Stripe i Frontend Handling ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Služenje statičkih fajlova u produkciji (Render)
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  // Slušanje na 0.0.0.0 je obavezno za Render
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server pokrenut na portu ${PORT}`);
  });
}

startServer();
