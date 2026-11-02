import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

dotenv.config();

// In-memory user database (replace with real DB in production)
interface User {
  id: string;
  email: string;
  password: string;
  displayName: string;
  role: "Admin" | "Staff" | "Marketing Manager" | "Accountant" | "Reception";
  createdAt: string;
  isBlocked?: boolean;
}

const users: Map<string, User> = new Map();
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this";

function normalizeServerEmail(input: string): string {
  const norm = (input || "").trim().toLowerCase();
  if (norm === "admin@123") return "admin@123.com";
  if (norm === "m@123") return "m@123.com";
  if (norm === "account@123") return "account@123.com";
  if (norm === "reception" || norm === "reception@123") return "reception@123.com";
  if (norm === "justrip") return "justripjhs@gmail.com";
  if (norm === "justrip1.0" || norm === "justrip1" || norm === "justrip 1.0") return "justriph@gmail.com";
  if (norm === "justrip3.0" || norm === "justrip3" || norm === "justrip 3.0" || norm === "justrip30") return "justrip30@gmail.com";
  if (norm === "justrip4.0" || norm === "justrip4" || norm === "justrip 4.0" || norm === "justrip46") return "justrip46@gmail.com";
  if (norm === "justrip5.0" || norm === "justrip5" || norm === "justrip 5.0" || norm === "justrip53") return "justrip53@gmail.com";
  if (norm.includes("@") && !norm.includes(".")) {
    return `${norm}.com`;
  }
  return norm;
}

// Seed accounts
const seedAccounts = [
  { email: "admin@123.com", password: "Nextrip@123", displayName: "JustTrip Admin", role: "Admin" },
  { email: "jhsmolla3@gmail.com", password: "jhsmolla558", displayName: "JHS Molla (Admin)", role: "Admin" },
  { email: "justripjhs@gmail.com", password: "jhsmolla558", displayName: "justrip", role: "Staff" },
  { email: "justriph@gmail.com", password: "jhsmolla558", displayName: "justrip1.0", role: "Staff" },
  { email: "justrip30@gmail.com", password: "jhsmolla558", displayName: "justrip3.0", role: "Staff" },
  { email: "justrip46@gmail.com", password: "jhsmolla558", displayName: "justrip4.0", role: "Staff" },
  { email: "justrip53@gmail.com", password: "jhsmolla558", displayName: "justrip5.0", role: "Staff" },
  { email: "reception@123.com", password: "Reception@123", displayName: "Front Desk Reception", role: "Reception" },
  { email: "m@123.com", password: "Mar@123", displayName: "Marketing", role: "Marketing Manager" },
  { email: "account@123.com", password: "Account@123", displayName: "Accountant", role: "Accountant" },
];

// Initialize seed accounts
async function initSeedAccounts() {
  for (const account of seedAccounts) {
    if (!users.has(account.email)) {
      const hashedPassword = await bcrypt.hash(account.password, 10);
      users.set(account.email, {
        id: account.email.split("@")[0],
        email: account.email,
        password: hashedPassword,
        displayName: account.displayName,
        role: account.role as any,
        createdAt: new Date().toISOString(),
        isBlocked: false,
      });
    }
  }
}

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

async function startServer() {
  const app = express();
  
  // Parse CLI args (e.g. npm run dev --port 3000 --host 0.0.0.0)
  const args = process.argv.slice(2);
  const portArgIndex = args.indexOf("--port");
  const portArg = portArgIndex !== -1 ? args[portArgIndex + 1] : undefined;
  const hostArgIndex = args.indexOf("--host");
  const hostArg = hostArgIndex !== -1 ? args[hostArgIndex + 1] : undefined;

  const PORT = Number(portArg) || Number(process.env.PORT) || 3000;
  const HOST = hostArg || "0.0.0.0";

  await initSeedAccounts();

  // Enable generous limits for base64 photo payloads
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ limit: "15mb", extended: true }));

  // Auth middleware
  const verifyToken = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // Auth endpoints
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, displayName } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }

      if (users.has(email)) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user: User = {
        id: email.split("@")[0],
        email,
        password: hashedPassword,
        displayName: displayName || email.split("@")[0],
        role: "Staff",
        createdAt: new Date().toISOString(),
      };

      users.set(email, user);

      const token = jwt.sign(
        { uid: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.json({
        success: true,
        token,
        user: { uid: user.id, email: user.email, displayName: user.displayName },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }

      const targetEmail = normalizeServerEmail(email);
      const user = users.get(targetEmail);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      if (user.isBlocked) {
        return res.status(403).json({
          error: "আপনার অ্যাকাউন্টটি সাময়িকভাবে স্থগিত (Blocked) করা হয়েছে। কর্তৃপক্ষের সাথে যোগাযোগ করুন।",
        });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign(
        { uid: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.json({
        success: true,
        token,
        user: { uid: user.id, email: user.email, displayName: user.displayName, role: user.role },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Create User without modifying current session
  app.post("/api/admin/users/create", async (req, res) => {
    try {
      const { email, password, displayName, role } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }
      const targetEmail = normalizeServerEmail(email);
      if (users.has(targetEmail)) {
        return res.status(400).json({ error: "User already exists with this email/ID" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser: User = {
        id: targetEmail.split("@")[0],
        email: targetEmail,
        password: hashedPassword,
        displayName: displayName || targetEmail.split("@")[0],
        role: role || "Staff",
        createdAt: new Date().toISOString(),
        isBlocked: false,
      };
      users.set(targetEmail, newUser);
      res.json({
        success: true,
        user: {
          uid: newUser.id,
          email: newUser.email,
          displayName: newUser.displayName,
          role: newUser.role,
        },
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin Change Password
  app.post("/api/admin/users/password", async (req, res) => {
    try {
      const { email, newPassword } = req.body;
      if (!email || !newPassword) {
        return res.status(400).json({ error: "Email and new password required" });
      }
      const targetEmail = normalizeServerEmail(email);
      const user = users.get(targetEmail);
      if (!user) {
        // If not in in-memory yet, create it so password updates work smoothly
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        users.set(targetEmail, {
          id: targetEmail.split("@")[0],
          email: targetEmail,
          password: hashedPassword,
          displayName: targetEmail.split("@")[0],
          role: "Staff",
          createdAt: new Date().toISOString(),
          isBlocked: false,
        });
        return res.json({ success: true, message: "User password initialized" });
      }
      user.password = await bcrypt.hash(newPassword, 10);
      users.set(targetEmail, user);
      res.json({ success: true, message: "Password updated successfully" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin Block/Unblock
  app.post("/api/admin/users/block", async (req, res) => {
    try {
      const { email, isBlocked } = req.body;
      const targetEmail = normalizeServerEmail(email);
      let user = users.get(targetEmail);
      if (user) {
        user.isBlocked = !!isBlocked;
        users.set(targetEmail, user);
      } else {
        const hashedPassword = await bcrypt.hash("jhsmolla558", 10);
        user = {
          id: targetEmail.split("@")[0],
          email: targetEmail,
          password: hashedPassword,
          displayName: targetEmail.split("@")[0],
          role: "Staff",
          createdAt: new Date().toISOString(),
          isBlocked: !!isBlocked,
        };
        users.set(targetEmail, user);
      }
      res.json({ success: true, isBlocked: !!isBlocked });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin Delete Staff User
  app.post("/api/admin/users/delete", async (req, res) => {
    try {
      const { email } = req.body;
      const targetEmail = normalizeServerEmail(email);
      users.delete(targetEmail);
      res.json({ success: true, message: `Staff user ${targetEmail} deleted` });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.json({ success: true });
  });

  app.get("/api/auth/me", verifyToken, (req: any, res) => {
    try {
      const user = users.get(req.user.email);
      if (user) {
        return res.json({
          uid: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        });
      }
      // Resilient fallback from verified JWT
      res.json({
        uid: req.user.uid || req.user.email?.split("@")[0] || "user",
        email: req.user.email,
        displayName: req.user.displayName || req.user.email?.split("@")[0] || "User",
        role: req.user.role || "Staff",
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API endpoint for Gemini-powered passport photo editing
  app.post("/api/gemini/edit-photo", verifyToken, async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({
          error:
            "GEMINI_API_KEY is not configured in the system secrets/environment. Please configure it in your Settings > Secrets panel.",
        });
      }

      const { image, prompt, modelName } = req.body;
      if (!image) {
        return res.status(400).json({ error: "No image payload supplied." });
      }

      // Extract raw base64 data and mimeType
      let base64Data = image;
      let mimeType = "image/png";
      if (image.startsWith("data:")) {
        const matches = image.match(/^data:([^;]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          mimeType = matches[1];
          base64Data = matches[2];
        }
      }

      // Initialize the official GoogleGenAI client on the server
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      // Default model is gemini-2.5-flash-image
      const model = modelName || "gemini-2.5-flash-image";

      const response = await ai.models.generateContent({
        model: model,
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            {
              text:
                prompt ||
                "Convert to a premium passport photo style. Adjust background to solid clean white. Change clothing to a modern sharp black suit and white shirt. Align face and shoulders forward elegantly with centered portrait framing, keeping the user's face 100% identical and authentic.",
            },
          ],
        },
      });

      let generatedImageBase64 = null;
      let responseText = "";

      if (response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            generatedImageBase64 = part.inlineData.data;
          } else if (part.text) {
            responseText += part.text;
          }
        }
      }

      if (generatedImageBase64) {
        return res.json({
          success: true,
          image: `data:image/png;base64,${generatedImageBase64}`,
          explanation: responseText,
        });
      } else {
        return res.json({
          success: false,
          text: responseText,
          error:
            "Gemini did not return an updated image part. Response prompt was: " +
            responseText,
        });
      }
    } catch (error: any) {
      console.error("Gemini Edit Error:", error);
      return res.status(500).json({
        error:
          error.message ||
          "An exception occurred inside the server-side Gemini execution context.",
      });
    }
  });

  // Automated WhatsApp Background Dispatch Endpoint
  app.post("/api/whatsapp/send", async (req, res) => {
    try {
      const {
        to,
        recipientName,
        recipientType, // "client" | "agent"
        message,
        passengerId,
        gatewayWebhookUrl,
        gatewayApiKey,
      } = req.body;

      if (!to || !message) {
        return res.status(400).json({ error: "Phone number and message are required" });
      }

      const cleanPhone = String(to).replace(/[^0-9]/g, "");

      // If an external gateway webhook is configured, forward in background
      let gatewayResponse = null;
      if (gatewayWebhookUrl && gatewayWebhookUrl.trim()) {
        try {
          let requestPayload: any = {
            to: cleanPhone,
            phone: cleanPhone,
            message,
            body: message,
            passengerId,
            recipientName,
            recipientType,
          };

          const lowerUrl = gatewayWebhookUrl.toLowerCase();
          if (lowerUrl.includes("ultramsg.com")) {
            // UltraMsg Gateway standard format
            requestPayload = {
              token: gatewayApiKey || "",
              to: cleanPhone,
              body: message,
            };
          } else if (lowerUrl.includes("green-api.com") || lowerUrl.includes("greenapi")) {
            // Green-API standard format
            requestPayload = {
              chatId: cleanPhone.includes("@") ? cleanPhone : `${cleanPhone}@c.us`,
              message: message,
            };
          } else if (lowerUrl.includes("wasapi.io")) {
            // Wasapi format
            requestPayload = {
              to: cleanPhone,
              message: message,
            };
          }

          const resp = await fetch(gatewayWebhookUrl.trim(), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(gatewayApiKey ? { Authorization: `Bearer ${gatewayApiKey}` } : {}),
            },
            body: JSON.stringify(requestPayload),
          });
          const textRes = await resp.text().catch(() => "");
          gatewayResponse = { status: resp.status, ok: resp.ok, responseText: textRes.slice(0, 300) };
        } catch (gateErr: any) {
          console.warn("External WhatsApp Gateway dispatch warning:", gateErr.message);
          gatewayResponse = { error: gateErr.message };
        }
      }

      console.log(`[Auto WhatsApp Dispatch] Recipient: ${cleanPhone} (${recipientType || "client"} - ${recipientName || "N/A"})`);

      return res.json({
        success: true,
        dispatchedAt: new Date().toISOString(),
        recipient: cleanPhone,
        recipientName,
        recipientType: recipientType || "client",
        gatewayResponse,
      });
    } catch (err: any) {
      console.error("WhatsApp dispatch error:", err);
      return res.status(500).json({ error: err.message || "Failed to dispatch WhatsApp" });
    }
  });

  // Vite development vs production serving logic
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`Express custom server running on http://${HOST}:${PORT}`);
  });

  const gracefulShutdown = () => {
    console.log("Shutting down server gracefully...");
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});


