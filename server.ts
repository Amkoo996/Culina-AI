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

const JWT_SECRET = process.env.JWT_SECRET || "culina-secret-key-123";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

const db = new Database("culina.db");

// Initialize DB
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

// Migration: Add postcode column if it doesn't exist (for existing databases)
try {
  db.exec("ALTER TABLE users ADD COLUMN postcode TEXT");
} catch (e) {
  // Column already exists or other error
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // --- Auth Middleware ---
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
      req.userId = decoded.id;
      next();
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // --- API Routes ---

  app.post("/api/auth/register", async (req, res) => {
    const { email, password, firstName, lastName, address, postcode, phone } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = db.prepare("INSERT INTO users (email, password, firstName, lastName, address, postcode, phone) VALUES (?, ?, ?, ?, ?, ?, ?)").run(email, hashedPassword, firstName, lastName, address, postcode, phone);
      const token = jwt.sign({ id: result.lastInsertRowid }, JWT_SECRET);
      res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none" });
      res.json({ id: result.lastInsertRowid, email, firstName, lastName });
    } catch (e) {
      res.status(400).json({ error: "Email already exists" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user.id }, JWT_SECRET);
    res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none" });
    res.json({ id: user.id, email });
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

  // --- Stripe Payment ---
  app.post("/api/create-checkout-session", authenticate, async (req: any, res) => {
    if (!stripe) return res.status(500).json({ error: "Stripe not configured" });
    const { plan } = req.body;
    const prices: any = {
      plus: "price_plus_id", // Replace with real Stripe Price IDs
      premium: "price_premium_id"
    };

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{ price: prices[plan], quantity: 1 }],
        mode: "subscription",
        success_url: `${req.headers.origin}/profile?success=true`,
        cancel_url: `${req.headers.origin}/profile?canceled=true`,
        client_reference_id: req.userId.toString(),
        metadata: { plan }
      });
      res.json({ url: session.url });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Stripe Webhook ---
  // In a real app, you'd use stripe.webhooks.constructEvent
  app.post("/api/webhook", express.raw({ type: 'application/json' }), (req, res) => {
    const sig = req.headers['stripe-signature'];
    // This is a simplified placeholder. Real implementation requires the webhook secret.
    const event = req.body; 

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.client_reference_id;
      const plan = session.metadata.plan;
      
      db.prepare("UPDATE users SET subscription = ? WHERE id = ?").run(plan, userId);
    }

    res.json({ received: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
