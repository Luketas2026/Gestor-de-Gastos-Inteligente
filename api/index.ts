import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import crypto from "crypto";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { Resend } from "resend";
import { Expense, Budget, Notification, SecuritySettings, AppState } from "../src/types.js";
import mongoose from "mongoose";
import {
  Expense as ExpenseModel,
  Budget as BudgetModel,
  Notification as NotificationModel,
  SecuritySettings as SecuritySettingsModel
} from "../src/db/models.js";

dotenv.config();

// Initialize Resend email client if a key is configured
const resendApiKey = process.env.RESEND_API_KEY;
const resendClient = resendApiKey ? new Resend(resendApiKey) : null;

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "server-db.json");

// Middleware to support large uploads for receipt scanning
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

// Initialize Gemini API client if key exists
const geminiApiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;

if (geminiApiKey && geminiApiKey !== "MY_GEMINI_API_KEY") {
  try {
    aiClient = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    console.log("Gemini API initialized successfully.");
  } catch (err) {
    console.error("Failed to initialize Gemini API:", err);
  }
} else {
  console.log("No valid GEMINI_API_KEY environment variable found. Scanning will operate in high-fidelity simulation mode.");
}

// Default mock data in Spanish for beautiful initial state
const defaultDb: AppState = {
  expenses: [
    {
      id: "exp-1",
      amount: 45500.0,
      category: "Alimentación",
      description: "Compra semanal Coto",
      date: "2026-07-10",
      paymentMethod: "Tarjeta de Crédito",
      isAutoClassified: true
    },
    {
      id: "exp-2",
      amount: 12800.0,
      category: "Transporte",
      description: "Carga de SUBE y taxi",
      date: "2026-07-09",
      paymentMethod: "Tarjeta de Crédito",
      isAutoClassified: false
    },
    {
      id: "exp-3",
      amount: 75000.0,
      category: "Servicios",
      description: "Factura de luz Edesur",
      date: "2026-07-05",
      paymentMethod: "Transferencia",
      isAutoClassified: true
    },
    {
      id: "exp-4",
      amount: 15990.0,
      category: "Entretenimiento",
      description: "Suscripción Netflix Premium",
      date: "2026-07-01",
      paymentMethod: "Tarjeta de Crédito",
      isAutoClassified: true
    },
    {
      id: "exp-5",
      amount: 32400.0,
      category: "Salud",
      description: "Medicamentos Farmacity",
      date: "2026-07-08",
      paymentMethod: "Efectivo",
      isAutoClassified: false
    }
  ],
  budgets: [
    {
      id: "b-1",
      category: "Alimentación",
      limit: 300000,
      spent: 45500.0,
      month: "2026-07",
      alerts: [
        { threshold: 0.5, triggered: false },
        { threshold: 0.8, triggered: false },
        { threshold: 1.0, triggered: false }
      ]
    },
    {
      id: "b-2",
      category: "Transporte",
      limit: 100000,
      spent: 12800.0,
      month: "2026-07",
      alerts: [
        { threshold: 0.5, triggered: false },
        { threshold: 0.8, triggered: false },
        { threshold: 1.0, triggered: false }
      ]
    },
    {
      id: "b-3",
      category: "Servicios",
      limit: 150000,
      spent: 75000.0,
      month: "2026-07",
      alerts: [
        { threshold: 0.5, triggered: true, triggeredAt: "2026-07-05T18:00:00Z" },
        { threshold: 0.8, triggered: false },
        { threshold: 1.0, triggered: false }
      ]
    },
    {
      id: "b-4",
      category: "Entretenimiento",
      limit: 80000,
      spent: 15990.0,
      month: "2026-07",
      alerts: [
        { threshold: 0.5, triggered: false },
        { threshold: 0.8, triggered: false },
        { threshold: 1.0, triggered: false }
      ]
    },
    {
      id: "b-5",
      category: "Salud",
      limit: 100000,
      spent: 32400.0,
      month: "2026-07",
      alerts: [
        { threshold: 0.5, triggered: false },
        { threshold: 0.8, triggered: false },
        { threshold: 1.0, triggered: false }
      ]
    },
    {
      id: "b-6",
      category: "Otros",
      limit: 100000,
      spent: 0,
      month: "2026-07",
      alerts: [
        { threshold: 0.5, triggered: false },
        { threshold: 0.8, triggered: false },
        { threshold: 1.0, triggered: false }
      ]
    }
  ],
  notifications: [
    {
      id: "notif-2",
      title: "Alerta de Presupuesto",
      message: "Has consumido más del 50% de tu presupuesto mensual de Servicios.",
      date: "2026-07-05T18:00:00Z",
      read: false,
      type: "alert"
    }
  ],
  securitySettings: {
    biometricsEnabled: true,
    encryptionEnabled: false,
    twoFactorEnabled: false,
    twoFactorSecret: "GEZD4NBVGY3TQOJQ",
    encryptionKey: ""
  }
};

// MongoDB connection function
const mongoURI = process.env.MONGODB_URI;

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) return;
  try {
    if (!mongoURI) {
      throw new Error("MONGODB_URI environment variable is not defined.");
    }
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log("Conectado exitosamente a MongoDB Atlas");
  } catch (err) {
    console.error("Error al conectar a MongoDB:", err);
    throw err;
  }
};

// Database seeding logic
let isSeeded = false;
const seedDatabase = async () => {
  if (isSeeded) return;
  try {
    let securitySettings = await SecuritySettingsModel.findOne();
    if (!securitySettings) {
      await SecuritySettingsModel.create({
        biometricsEnabled: false,
        encryptionEnabled: false,
        twoFactorEnabled: false,
        twoFactorSecret: "GEZD4NBVGY3TQOJQ",
        encryptionKey: ""
      });
    }
    isSeeded = true;
  } catch (err) {
    console.error("Error seeding default security settings:", err);
  }
};

// Authentication and TOTP Session helpers
const SESSION_SECRET = process.env.JWT_SECRET || "finterra-secure-session-key-2026";

const getExpectedToken = () => {
  return crypto.createHmac("sha256", SESSION_SECRET).update("luketas-Internet87+").digest("hex");
};

// Authentication Middleware to protect routes
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${getExpectedToken()}`) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  next();
};

// Base32 decoder to buffer for TOTP secrets
function base32ToBuf(base32: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (let i = 0; i < base32.length; i++) {
    const val = alphabet.indexOf(base32[i].toUpperCase());
    if (val >= 0) bits += val.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    const byte = bits.substring(i, i + 8);
    if (byte.length === 8) bytes.push(parseInt(byte, 2));
  }
  return Buffer.from(bytes);
}

// Verify Google Authenticator TOTP token
function verifyTOTP(secret: string, code: string): boolean {
  try {
    const key = base32ToBuf(secret);
    const epoch = Math.round(Date.now() / 1000);
    const timeStep = Math.floor(epoch / 30);

    // Validate current time step and adjacent steps (handles clock drift of up to 2 minutes)
    for (let i = -4; i <= 4; i++) {
      const step = timeStep + i;
      const buffer = Buffer.alloc(8);
      buffer.writeUInt32BE(Math.floor(step / 0x100000000), 0);
      buffer.writeUInt32BE(step % 0x100000000, 4);

      const hmac = crypto.createHmac("sha1", key);
      hmac.update(buffer);
      const hmacResult = hmac.digest();

      const offset = hmacResult[hmacResult.length - 1] & 0xf;
      const binary = ((hmacResult[offset] & 0x7f) << 24) |
                     ((hmacResult[offset + 1] & 0xff) << 16) |
                     ((hmacResult[offset + 2] & 0xff) << 8) |
                     (hmacResult[offset + 3] & 0xff);

      const otp = (binary % 1000000).toString().padStart(6, "0");
      if (otp === code) {
        return true;
      }
    }
  } catch (err) {
    console.error("Error verifying TOTP:", err);
  }
  return false;
}

// Categorization helper
function autoClassifyExpense(description: string): string {
  const desc = description.toLowerCase();
  
  const rules = [
    { keywords: ["mercadona", "carrefour", "lidl", "supermercado", "comida", "dia", "alcampo", "groceries", "súper", "restaurante", "cena", "cafe", "panaderia", "mcdonalds", "starbucks", "alimentos", "gourmet", "burger"], category: "Alimentación" },
    { keywords: ["uber", "cabify", "taxi", "metro", "autobus", "bus", "gasolina", "repsol", "cepsa", "tren", "renfe", "viaje", "peaje", "parking", "estacionamiento", "billete", "vuelo", "iberia"], category: "Transporte" },
    { keywords: ["luz", "agua", "gas", "internet", "movistar", "vodafone", "orange", "iberdrola", "endesa", "fibra", "teléfono", "telefono", "comunidad", "alquiler", "seguro", "mapfre", "axa"], category: "Servicios" },
    { keywords: ["netflix", "spotify", "hbo", "cine", "teatro", "steam", "playstation", "concierto", "ocio", "juegos", "disney", "museo", "bar", "copas", "cerveza", "fiesta", "suscripción", "suscripcion"], category: "Entretenimiento" },
    { keywords: ["farmacia", "medico", "dentista", "salud", "mutua", "hospital", "clínica", "clinica", "óptica", "optica", "medicina", "psicologo", "gimnasio", "gym", "crossfit"], category: "Salud" }
  ];

  for (const rule of rules) {
    if (rule.keywords.some(kw => desc.includes(kw))) {
      return rule.category;
    }
  }
  return "Otros";
}

// Budget check helper using MongoDB models
async function checkBudgetsAndNotifyDB(expense: any): Promise<string[]> {
  const expenseMonth = expense.date.substring(0, 7); // YYYY-MM
  const alertsTriggered: string[] = [];
  
  // Recalculate spent for this category and month in DB
  const categoryExpenses = await ExpenseModel.find({
    category: expense.category,
    date: { $regex: `^${expenseMonth}` }
  });
  const totalSpent = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);
  
  const budget = await BudgetModel.findOne({
    category: expense.category,
    month: expenseMonth
  });

  if (budget) {
    budget.spent = totalSpent;
    
    // Check alert thresholds
    const newAlerts = [];
    for (const alert of budget.alerts) {
      const thresholdAmount = budget.limit * alert.threshold;
      if (totalSpent >= thresholdAmount && !alert.triggered) {
        alert.triggered = true;
        alert.triggeredAt = new Date().toISOString();
        
        const percent = Math.round(alert.threshold * 100);
        const title = `Presupuesto de ${expense.category}`;
        const message = alert.threshold === 1.0 
          ? `¡Atención! Has excedido el 100% de tu presupuesto límite para ${expense.category} ($${budget.limit}).`
          : `Alerta: Has superado el ${percent}% de tu presupuesto mensual para ${expense.category}. Gasto actual: $${totalSpent.toFixed(2)} de $${budget.limit} limitados.`;
        
        alertsTriggered.push(message);
        
        // Add database notification
        await NotificationModel.create({
          id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          title,
          message,
          date: new Date().toISOString(),
          read: false,
          type: "alert"
        });
      }
      newAlerts.push(alert);
    }
    
    budget.alerts = newAlerts as any;
    await budget.save();
  }
  
  return alertsTriggered;
}

// ==========================================
// REST API ENDPOINTS
// ==========================================

// Login endpoint (Public)
app.post("/api/login", async (req, res) => {
  try {
    await connectDB();
    const { username, password, code } = req.body;
    
    if (username !== "luketas" || password !== "Internet87+") {
      return res.status(401).json({ success: false, error: "Usuario o contraseña incorrectos" });
    }
    
    let securitySettings = await SecuritySettingsModel.findOne();
    if (!securitySettings) {
      securitySettings = await SecuritySettingsModel.create(defaultDb.securitySettings);
    }
    
    if (securitySettings.twoFactorEnabled) {
      if (!code) {
        return res.json({ success: true, twoFactorRequired: true });
      }
      const verified = verifyTOTP(securitySettings.twoFactorSecret, code);
      if (!verified) {
        return res.status(401).json({ success: false, error: "Código 2FA incorrecto o expirado" });
      }
    }
    
    res.json({ success: true, token: getExpectedToken() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Verify and enable 2FA
app.post("/api/security/verify-2fa", authenticateToken, async (req, res) => {
  try {
    await connectDB();
    const { code } = req.body;
    
    let securitySettings = await SecuritySettingsModel.findOne();
    if (!securitySettings) {
      securitySettings = await SecuritySettingsModel.create(defaultDb.securitySettings);
    }
    
    const verified = verifyTOTP(securitySettings.twoFactorSecret, code);
    if (!verified) {
      return res.status(400).json({ success: false, error: "Código de verificación incorrecto" });
    }
    
    securitySettings.twoFactorEnabled = true;
    await securitySettings.save();
    
    res.json({ success: true, securitySettings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Disable 2FA
app.post("/api/security/disable-2fa", authenticateToken, async (req, res) => {
  try {
    await connectDB();
    
    let securitySettings = await SecuritySettingsModel.findOne();
    if (!securitySettings) {
      securitySettings = await SecuritySettingsModel.create(defaultDb.securitySettings);
    }
    
    securitySettings.twoFactorEnabled = false;
    await securitySettings.save();
    
    res.json({ success: true, securitySettings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all data
app.get("/api/data", authenticateToken, async (req, res) => {
  try {
    await connectDB();
    await seedDatabase();
    
    const expenses = await ExpenseModel.find().sort({ date: -1 });
    const budgets = await BudgetModel.find();
    const notifications = await NotificationModel.find().sort({ date: -1 });
    let securitySettings = await SecuritySettingsModel.findOne();
    if (!securitySettings) {
      securitySettings = await SecuritySettingsModel.create(defaultDb.securitySettings);
    }

    res.json({
      expenses,
      budgets,
      notifications,
      securitySettings
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add an expense (or edit if ID exists)
app.post("/api/expenses", authenticateToken, async (req, res) => {
  try {
    await connectDB();
    const rawExpense = req.body;
    
    let expense;
    let alertsTriggered: string[] = [];

    if (rawExpense.id) {
      expense = await ExpenseModel.findOne({ id: rawExpense.id });
    }

    if (expense) {
      // Edit existing
      expense.amount = parseFloat(rawExpense.amount) || 0;
      expense.category = rawExpense.category || expense.category;
      expense.description = rawExpense.description || expense.description;
      expense.date = rawExpense.date || expense.date;
      expense.paymentMethod = rawExpense.paymentMethod || expense.paymentMethod;
      expense.bank = rawExpense.bank || expense.bank;
      await expense.save();
    } else {
      // Add new
      const category = rawExpense.category || autoClassifyExpense(rawExpense.description);
      expense = new ExpenseModel({
        id: rawExpense.id || `exp-${Date.now()}`,
        amount: parseFloat(rawExpense.amount) || 0,
        category,
        description: rawExpense.description || "Gasto sin descripción",
        date: rawExpense.date || new Date().toISOString().substring(0, 10),
        paymentMethod: rawExpense.paymentMethod || "Tarjeta",
        isAutoClassified: !rawExpense.category,
        bank: rawExpense.bank,
        isSuspicious: (parseFloat(rawExpense.amount) || 0) > 500,
        items: Array.isArray(rawExpense.items) ? rawExpense.items : undefined
      });

      await expense.save();
      
      // Create notification if the expense is flagged as suspicious
      if (expense.isSuspicious) {
        await NotificationModel.create({
          id: `notif-${Date.now()}-susp`,
          title: "Transacción Sospechosa",
          message: `Se ha detectado una transacción inusualmente alta de $${expense.amount} en '${expense.description}'. Por favor, verifica tu saldo.`,
          date: new Date().toISOString(),
          read: false,
          type: "suspicious"
        });
      }
    }

    // Recalculate spending and check alerts
    alertsTriggered = await checkBudgetsAndNotifyDB(expense);
    
    res.json({
      success: true,
      expense,
      alerts: alertsTriggered
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete an expense
app.delete("/api/expenses/:id", authenticateToken, async (req, res) => {
  try {
    await connectDB();
    const id = req.params.id;
    const expense = await ExpenseModel.findOne({ id });
    
    if (!expense) {
      return res.status(404).json({ success: false, error: "Gasto no encontrado" });
    }

    await ExpenseModel.deleteOne({ id });
    
    // Recalculate budgets spent for this category
    const expenseMonth = expense.date.substring(0, 7);
    const categoryExpenses = await ExpenseModel.find({
      category: expense.category,
      date: { $regex: `^${expenseMonth}` }
    });
    const totalSpent = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);

    const budget = await BudgetModel.findOne({ category: expense.category, month: expenseMonth });
    if (budget) {
      budget.spent = totalSpent;
      // Reset triggered warnings if spending went back down
      budget.alerts = budget.alerts.map((alert: any) => {
        const thresholdAmount = budget.limit * alert.threshold;
        if (totalSpent < thresholdAmount) {
          alert.triggered = false;
          alert.triggeredAt = undefined;
        }
        return alert;
      }) as any;
      await budget.save();
    }

    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update budgets limits
app.post("/api/budgets", authenticateToken, async (req, res) => {
  try {
    await connectDB();
    const { category, limit, month } = req.body;
    const targetMonth = month || "2026-07";
    
    let budget = await BudgetModel.findOne({ category, month: targetMonth });
    
    const categoryExpenses = await ExpenseModel.find({
      category,
      date: { $regex: `^${targetMonth}` }
    });
    const totalSpent = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);
    const budgetLimit = parseFloat(limit) || 0;

    if (budget) {
      budget.limit = budgetLimit;
      // Reset alert triggers since limits changed
      budget.alerts = budget.alerts.map((a: any) => ({ ...a, triggered: false, triggeredAt: undefined })) as any;
      budget.spent = totalSpent;
      await budget.save();
    } else {
      // Add new budget category
      budget = new BudgetModel({
        id: `b-${Date.now()}`,
        category,
        limit: budgetLimit,
        spent: totalSpent,
        month: targetMonth,
        alerts: [
          { threshold: 0.5, triggered: false },
          { threshold: 0.8, triggered: false },
          { threshold: 1.0, triggered: false }
        ]
      });
      await budget.save();
    }

    // Force re-evaluation of budgets after edit
    const alertsTriggered: string[] = [];
    const newAlerts = [];
    for (const alert of budget.alerts) {
      const thresholdAmount = budget.limit * alert.threshold;
      if (totalSpent >= thresholdAmount && !alert.triggered) {
        alert.triggered = true;
        alert.triggeredAt = new Date().toISOString();

        const percent = Math.round(alert.threshold * 100);
        const title = `Presupuesto de ${category}`;
        const message = alert.threshold === 1.0 
          ? `¡Atención! Has excedido el 100% de tu presupuesto límite para ${category} ($${budget.limit}).`
          : `Alerta: Has superado el ${percent}% de tu presupuesto mensual para ${category}. Gasto actual: $${totalSpent.toFixed(2)} de $${budget.limit} limitados.`;

        alertsTriggered.push(message);

        // Add database notification
        await NotificationModel.create({
          id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          title,
          message,
          date: new Date().toISOString(),
          read: false,
          type: "alert"
        });
      }
      newAlerts.push(alert);
    }
    budget.alerts = newAlerts as any;
    await budget.save();

    const budgets = await BudgetModel.find();
    res.json({ success: true, budgets });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update security settings (encryption keys, 2FA codes, face ID)
app.post("/api/security", authenticateToken, async (req, res) => {
  try {
    await connectDB();
    let securitySettings = await SecuritySettingsModel.findOne();
    if (!securitySettings) {
      securitySettings = new SecuritySettingsModel(defaultDb.securitySettings);
    }
    
    const fieldsToUpdate = req.body;
    Object.assign(securitySettings, fieldsToUpdate);
    await securitySettings.save();
    
    res.json({ success: true, securitySettings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Clear or read notifications
app.post("/api/notifications/read/:id", authenticateToken, async (req, res) => {
  try {
    await connectDB();
    await NotificationModel.updateOne({ id: req.params.id }, { read: true });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/notifications/clear", authenticateToken, async (req, res) => {
  try {
    await connectDB();
    await NotificationModel.deleteMany({});
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Receipt Scanning endpoint via Gemini API (OCR)
app.post("/api/scan-receipt", authenticateToken, async (req, res) => {
  const { image } = req.body; // Expect base64 encoded image string (e.g., data:image/png;base64,xxxx)

  if (!image) {
    return res.status(400).json({ success: false, error: "No se proporcionó ninguna imagen del recibo." });
  }

  // Remove data URI prefix if present
  let base64Data = image;
  let mimeType = "image/jpeg";
  
  if (image.includes(";base64,")) {
    const parts = image.split(";base64,");
    mimeType = parts[0].split(":")[1] || "image/jpeg";
    base64Data = parts[1];
  }

  // Try to use Gemini client
  if (aiClient) {
    try {
      console.log("Parsing receipt using Gemini 3.5 Flash server-side...");
      
      const imagePart = {
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
        },
      };

      const prompt = `Analiza este recibo de compra. Extrae con precisión los siguientes datos en español y devuélvelos estructurados en el formato JSON especificado en el esquema. Intenta deducir la categoría correcta entre: 'Alimentación', 'Transporte', 'Servicios', 'Entretenimiento', 'Salud', o 'Otros'.`;

      const response = await aiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [imagePart, prompt],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              vendor: {
                type: Type.STRING,
                description: "Nombre del comercio o proveedor (ej. Mercadona, Repsol, Farmacia)",
              },
              amount: {
                type: Type.NUMBER,
                description: "El importe total facturado en euros",
              },
              date: {
                type: Type.STRING,
                description: "La fecha de la compra en formato YYYY-MM-DD",
              },
              category: {
                type: Type.STRING,
                description: "La categoría del gasto. Debe ser estrictamente una de estas: 'Alimentación', 'Transporte', 'Servicios', 'Entretenimiento', 'Salud', 'Otros'",
              },
              items: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Lista de productos o servicios individuales detallados en el recibo (máximo 10)",
              }
            },
            required: ["vendor", "amount", "date", "category", "items"]
          }
        }
      });

      const responseText = response.text;
      if (responseText) {
        console.log("Raw Gemini OCR response:", responseText);
        const parsed = JSON.parse(responseText.trim());
        return res.json({
          success: true,
          method: "gemini_ai_ocr",
          data: {
            vendor: parsed.vendor || "Comercio Escaneado",
            amount: parseFloat(parsed.amount) || 0.00,
            date: parsed.date || new Date().toISOString().substring(0, 10),
            category: parsed.category || "Otros",
            items: parsed.items || []
          }
        });
      }
    } catch (err: any) {
      console.error("Gemini OCR error, falling back to simulated parser:", err?.message || err);
      // Fall through to simulation if API call fails
    }
  }

  // High fidelity Simulation Fallback if Gemini key is missing or fails
  console.log("Operating in high-fidelity simulation mode for receipt scanning.");
  
  // Pick a random receipt template to simulate successful parsing
  const simulations = [
    {
      vendor: "Carrefour Market",
      amount: 67.45,
      category: "Alimentación",
      items: ["Pechuga de pollo 1kg", "Leche entera 6L", "Aguacates pack 4", "Pan de molde integral", "Detergente líquido Colón"]
    },
    {
      vendor: "Gasolinera Repsol",
      amount: 55.00,
      category: "Transporte",
      items: ["Combustible Sin Plomo 95", "Agua mineral 50cl"]
    },
    {
      vendor: "Farmacia del Paseo",
      amount: 18.20,
      category: "Salud",
      items: ["Paracetamol 1g", "Ibuprofeno 400mg", "Tiritas adhesivas", "Mascarillas quirúrgicas"]
    }
  ];

  const picked = simulations[Math.floor(Math.random() * simulations.length)];
  
  // Simulate delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  res.json({
    success: true,
    method: "simulated_ocr_engine",
    data: {
      vendor: picked.vendor,
      amount: picked.amount,
      date: new Date().toISOString().substring(0, 10),
      category: picked.category,
      items: picked.items
    },
    note: "Simulado por el motor OCR local (agrega tu GEMINI_API_KEY en Secrets para habilitar la extracción real)."
  });
});

// Report generation helpers (real CSV/XLSX/PDF, no simulated content)
function buildCsvBuffer(expenses: any[]): Buffer {
  const headers = "ID,Fecha,Descripción,Importe,Categoría,Método Pago,Sospechoso\n";
  const rows = expenses.map(e =>
    `"${e.id}","${e.date}","${String(e.description).replace(/"/g, '""')}",${e.amount},"${e.category}","${e.paymentMethod}","${e.isSuspicious ? "SÍ" : "NO"}"`
  ).join("\n");
  return Buffer.from(headers + rows, "utf-8");
}

async function buildXlsxBuffer(expenses: any[], budgets: any[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  const expensesSheet = workbook.addWorksheet("Gastos");
  expensesSheet.columns = [
    { header: "Fecha", key: "date", width: 12 },
    { header: "Descripción", key: "description", width: 32 },
    { header: "Categoría", key: "category", width: 18 },
    { header: "Importe", key: "amount", width: 14 },
    { header: "Método de Pago", key: "paymentMethod", width: 18 },
    { header: "Sospechoso", key: "suspicious", width: 12 }
  ];
  expensesSheet.getRow(1).font = { bold: true };
  expenses.forEach(e => {
    expensesSheet.addRow({
      date: e.date,
      description: e.description,
      category: e.category,
      amount: e.amount,
      paymentMethod: e.paymentMethod,
      suspicious: e.isSuspicious ? "SÍ" : "NO"
    });
  });

  const budgetsSheet = workbook.addWorksheet("Presupuestos");
  budgetsSheet.columns = [
    { header: "Categoría", key: "category", width: 18 },
    { header: "Gastado", key: "spent", width: 14 },
    { header: "Límite", key: "limit", width: 14 },
    { header: "% Usado", key: "pct", width: 12 }
  ];
  budgetsSheet.getRow(1).font = { bold: true };
  budgets.forEach(b => {
    budgetsSheet.addRow({
      category: b.category,
      spent: b.spent,
      limit: b.limit,
      pct: b.limit > 0 ? `${Math.round((b.spent / b.limit) * 100)}%` : "-"
    });
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

function buildPdfBuffer(expenses: any[], budgets: any[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", chunk => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    doc.fontSize(18).text("Finterra - Reporte Mensual de Gastos", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#64748b").text(`Generado el ${new Date().toLocaleDateString("es-AR")}`, { align: "center" });
    doc.moveDown(1.5);

    doc.fontSize(13).fillColor("#0f172a").text("Resumen");
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor("#334155").text(`Gasto total: $${totalExpenses.toFixed(2)}`);
    doc.moveDown(1);

    doc.fontSize(13).fillColor("#0f172a").text("Presupuestos por categoría");
    doc.moveDown(0.3);
    budgets.forEach(b => {
      const pct = b.limit > 0 ? Math.round((b.spent / b.limit) * 100) : 0;
      doc.fontSize(10).fillColor("#334155").text(`${b.category}: $${b.spent.toFixed(2)} de $${b.limit.toFixed(2)} (${pct}%)`);
    });
    doc.moveDown(1);

    doc.fontSize(13).fillColor("#0f172a").text("Detalle de gastos");
    doc.moveDown(0.3);
    expenses.forEach(e => {
      doc.fontSize(9).fillColor("#334155").text(
        `${e.date}   ${e.description}   [${e.category}]   $${e.amount.toFixed(2)}${e.isSuspicious ? "  ⚠ SOSPECHOSO" : ""}`
      );
    });

    doc.end();
  });
}

function buildReportEmailHtml(expenses: any[], budgets: any[], email: string): string {
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const categoryTotals = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0f172a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">📊 Informe Financiero Mensual</h2>
      <p>Hola, <strong>${email}</strong>.</p>
      <p>Aquí tienes tu resumen de gastos y presupuestos mensuales acumulado al día de hoy.</p>

      <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <span style="color: #64748b; font-size: 14px;">GASTO TOTAL DEL MES</span>
        <h1 style="color: #ef4444; margin: 5px 0 0 0;">$${totalExpenses.toFixed(2)}</h1>
      </div>

      <h3>Gastos por Categoría:</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0;">Categoría</th>
            <th style="padding: 10px; text-align: right; border-bottom: 1px solid #e2e8f0;">Total Gastado</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(categoryTotals).map(([cat, val]) => `
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: 500;">${cat}</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #334155;">$${(val as number).toFixed(2)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <h3>Resumen del Presupuesto:</h3>
      <ul style="padding-left: 20px; color: #475569;">
        ${budgets.map(b => {
          const pct = b.limit > 0 ? Math.round((b.spent / b.limit) * 100) : 0;
          const color = pct >= 100 ? "#ef4444" : pct >= 80 ? "#f97316" : "#10b981";
          return `<li style="margin-bottom: 8px;"><strong>${b.category}</strong>: $${b.spent.toFixed(2)} de $${b.limit} limitados (<span style="color: ${color}; font-weight: bold;">${pct}%</span>)</li>`;
        }).join("")}
      </ul>

      <div style="margin-top: 30px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
        Informe generado por tu Gestor de Gastos Inteligente (Finterra).
      </div>
    </div>
  `;
}

// Export endpoints: real CSV/XLSX/PDF downloads and real email delivery via Resend
app.post("/api/export", authenticateToken, async (req, res) => {
  try {
    await connectDB();
    const { format, email } = req.body;

    const expenses = await ExpenseModel.find().sort({ date: -1 });
    const budgets = await BudgetModel.find();

    if (email) {
      if (!resendClient) {
        return res.status(503).json({
          success: false,
          error: "El envío de email no está configurado (falta RESEND_API_KEY en el servidor)."
        });
      }

      const bodyHtml = buildReportEmailHtml(expenses, budgets, email);
      const pdfBuffer = await buildPdfBuffer(expenses, budgets);

      const { data, error } = await resendClient.emails.send({
        from: "Finterra <onboarding@resend.dev>",
        to: email,
        subject: "Informe Mensual de Gastos - Finterra",
        html: bodyHtml,
        attachments: [
          {
            filename: `reporte_mensual_${new Date().toISOString().substring(0, 7)}.pdf`,
            content: pdfBuffer.toString("base64")
          }
        ]
      });

      if (error) {
        return res.status(502).json({ success: false, error: error.message || "Error al enviar el email." });
      }

      return res.json({
        success: true,
        message: `El informe fue enviado a ${email}.`,
        previewHtml: bodyHtml,
        emailId: data?.id
      });
    }

    const fileBase = `reporte_mensual_${new Date().toISOString().substring(0, 7)}`;

    if (format === "excel") {
      const buffer = await buildXlsxBuffer(expenses, budgets);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${fileBase}.xlsx"`);
      return res.send(buffer);
    }

    if (format === "pdf") {
      const buffer = await buildPdfBuffer(expenses, budgets);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${fileBase}.pdf"`);
      return res.send(buffer);
    }

    // Default: CSV
    const buffer = buildCsvBuffer(expenses);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileBase}.csv"`);
    return res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// VITE DEV SERVER AND DIST STATIC FILE SERVERS
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite dev server mounted as middleware.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Production static build files server mounted.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running in ${process.env.NODE_ENV || "development"} mode on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;

