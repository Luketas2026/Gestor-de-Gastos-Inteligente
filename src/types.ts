export interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  paymentMethod: string;
  isSuspicious?: boolean;
  receiptUrl?: string;
  items?: string[];
  bankAccountId?: string;
  isAutoClassified?: boolean;
}

export interface Budget {
  id: string;
  category: string;
  limit: number;
  spent: number;
  month: string; // YYYY-MM
  alerts: {
    threshold: number; // e.g., 0.8 for 80%
    triggered: boolean;
    triggeredAt?: string;
  }[];
}

export interface BankConnection {
  id: string;
  bankName: string;
  accountType: string; // e.g., "Corriente", "Ahorros", "Tarjeta de Crédito"
  balance: number;
  lastSynced: string;
  accountNumber: string;
  alias?: string; // apodo opcional (no resuelve a CBU, solo etiqueta visual)
  status: "connected" | "syncing" | "error" | "disconnected";
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
  type: "alert" | "info" | "suspicious" | "sync";
}

export interface SecuritySettings {
  biometricsEnabled: boolean;
  encryptionEnabled: boolean;
  twoFactorEnabled: boolean;
  twoFactorSecret: string;
  encryptionKey: string;
}

export interface AppState {
  expenses: Expense[];
  budgets: Budget[];
  bankConnections: BankConnection[];
  notifications: Notification[];
  securitySettings: SecuritySettings;
}
