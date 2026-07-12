import mongoose from "mongoose";

// Schema for individual expenses
const ExpenseSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  category: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: String, required: true },
  paymentMethod: { type: String, required: true },
  isSuspicious: { type: Boolean, default: false },
  receiptUrl: { type: String },
  items: { type: [String] },
  bankAccountId: { type: String },
  isAutoClassified: { type: Boolean, default: false }
});

// Schema for budget thresholds and alerts
const BudgetAlertSchema = new mongoose.Schema({
  threshold: { type: Number, required: true },
  triggered: { type: Boolean, required: true, default: false },
  triggeredAt: { type: String }
}, { _id: false });

// Schema for budgets
const BudgetSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  category: { type: String, required: true },
  limit: { type: Number, required: true },
  spent: { type: Number, required: true, default: 0 },
  month: { type: String, required: true }, // Format: YYYY-MM
  alerts: { type: [BudgetAlertSchema], default: [] }
});

// Schema for bank accounts/connections
const BankConnectionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  bankName: { type: String, required: true },
  accountType: { type: String, required: true },
  balance: { type: Number, required: true },
  lastSynced: { type: String, required: true },
  accountNumber: { type: String, required: true },
  alias: { type: String },
  status: {
    type: String, 
    required: true, 
    enum: ["connected", "syncing", "error", "disconnected"], 
    default: "connected" 
  }
});

// Schema for notifications
const NotificationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  date: { type: String, required: true },
  read: { type: Boolean, required: true, default: false },
  type: { 
    type: String, 
    required: true, 
    enum: ["alert", "info", "suspicious", "sync"] 
  }
});

// Schema for security settings
const SecuritySettingsSchema = new mongoose.Schema({
  biometricsEnabled: { type: Boolean, required: true, default: true },
  encryptionEnabled: { type: Boolean, required: true, default: false },
  twoFactorEnabled: { type: Boolean, required: true, default: false },
  twoFactorSecret: { type: String, required: true, default: "GEZD4NBVGY3TQOJQ" },
  encryptionKey: { type: String, default: "" }
});

export const Expense = mongoose.model("Expense", ExpenseSchema);
export const Budget = mongoose.model("Budget", BudgetSchema);
export const BankConnection = mongoose.model("BankConnection", BankConnectionSchema);
export const Notification = mongoose.model("Notification", NotificationSchema);
export const SecuritySettings = mongoose.model("SecuritySettings", SecuritySettingsSchema);
