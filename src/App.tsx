import React, { useState, useEffect, useRef } from "react";
import {
  Wallet,
  TrendingUp,
  AlertTriangle,
  FileText,
  Upload,
  Camera,
  RefreshCw,
  Plus,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  Bell,
  Search,
  Sliders,
  Database,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  Download,
  Mail,
  Moon,
  Sun,
  User,
  Info,
  Layers,
  ArrowRight,
  Fingerprint,
  QrCode,
  X,
  CreditCard,
  FileSpreadsheet,
  ShieldAlert,
  LogOut
} from "lucide-react";
import { AppState, Expense, Budget, BankConnection, Notification, SecuritySettings } from "./types";

export default function App() {
  // Theme State
  const [darkMode, setDarkMode] = useState<boolean>(true);

  // Core App State
  const [loading, setLoading] = useState<boolean>(true);
  const [token, setToken] = useState<string | null>(localStorage.getItem("finterra_session_token"));
  const [usernameInput, setUsernameInput] = useState<string>("");
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [login2faRequired, setLogin2faRequired] = useState<boolean>(false);
  const [login2faCode, setLogin2faCode] = useState<string>("");
  const [loginError, setLoginError] = useState<string | null>(null);

  // Authenticated fetch wrapper to automatically inject Authorization headers
  const authFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = {
      ...(init?.headers || {}),
      ...(token ? { "Authorization": `Bearer ${token}` } : {})
    };
    const res = await fetch(input, { ...init, headers });
    if (res.status === 401) {
      setToken(null);
      localStorage.removeItem("finterra_session_token");
      showToast("Sesión expirada. Por favor, inicia sesión de nuevo.", "error");
    }
    return res;
  };
  const [appData, setAppData] = useState<AppState>({
    expenses: [],
    budgets: [],
    bankConnections: [],
    notifications: [],
    securitySettings: {
      biometricsEnabled: true,
      encryptionEnabled: false,
      twoFactorEnabled: false,
      twoFactorSecret: "GEZD4NBVGY3TQOJQ",
      encryptionKey: ""
    }
  });

  // Navigation State
  const [activeTab, setActiveTab] = useState<string>("dashboard");

  // UI Interactive States
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [showEmailPreview, setShowEmailPreview] = useState<{ open: boolean; html: string; email: string } | null>(null);
  
  // OCR Scan States
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [scanning, setScanning] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<{
    vendor: string;
    amount: number;
    date: string;
    category: string;
    items: string[];
    note?: string;
  } | null>(null);

  // Form States
  const [expenseForm, setExpenseForm] = useState({
    amount: "",
    category: "",
    description: "",
    date: new Date().toISOString().substring(0, 10),
    paymentMethod: "Tarjeta de Crédito",
    bankAccountId: ""
  });
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("Todos");

  // Bank Simulator States
  const [syncingBankId, setSyncingBankId] = useState<string | null>(null);
  const [showLinkBankModal, setShowLinkBankModal] = useState<boolean>(false);
  const [newBankForm, setNewBankForm] = useState({
    bankName: "CaixaBank",
    accountType: "Cuenta Corriente",
    balance: "1500",
    accountNumber: "ES45 2100 **** 7788"
  });

  // Security Simulator States
  const [showBiometricScreen, setShowBiometricScreen] = useState<boolean>(true);
  const [passphrase, setPassphrase] = useState<string>("");
  const [e2eHashedKey, setE2eHashedKey] = useState<string>("");
  const [twoFactorInput, setTwoFactorInput] = useState<string>("");
  const [twoFactorVerified, setTwoFactorVerified] = useState<boolean | null>(null);

  // Budget Edit States
  const [editingBudgetCategory, setEditingBudgetCategory] = useState<string | null>(null);
  const [editingBudgetLimit, setEditingBudgetLimit] = useState<string>("");

  // Refs for local files uploads
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch initial data from server on mount or when token changes
  useEffect(() => {
    if (token) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [token]);

  // Update hashed E2E key simulation when passphrase changes
  useEffect(() => {
    if (passphrase) {
      // Simple visual simulation of client-side PBKDF2 hashing
      let hash = 0;
      for (let i = 0; i < passphrase.length; i++) {
        const char = passphrase.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
      }
      setE2eHashedKey("0x" + Math.abs(hash).toString(16).padStart(16, "0") + "ea3c9217b1b0fe219803b9b4f7e2a9b4");
    } else {
      setE2eHashedKey("");
    }
  }, [passphrase]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await authFetch("/api/data");
      if (res.ok) {
        const data: AppState = await res.json();
        setAppData(data);
        // If biometrics is turned off, skip biometric lock screen
        if (!data.securitySettings.biometricsEnabled) {
          setShowBiometricScreen(false);
        }
      } else {
        showToast("Error al cargar datos de sincronización en la nube", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error al conectar con el servidor en la nube", "error");
    } finally {
      setLoading(false);
    }
  };

  // Secure Login handler supporting username, password and 2FA code step
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: usernameInput,
          password: passwordInput,
          code: login2faRequired ? login2faCode : undefined
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        if (data.twoFactorRequired) {
          setLogin2faRequired(true);
          showToast("Autenticación de 2 Factores requerida", "info");
        } else if (data.token) {
          localStorage.setItem("finterra_session_token", data.token);
          setToken(data.token);
          setUsernameInput("");
          setPasswordInput("");
          setLogin2faCode("");
          setLogin2faRequired(false);
          showToast("Sesión iniciada con éxito", "success");
        }
      } else {
        setLoginError(data.error || "Error al iniciar sesión");
        showToast(data.error || "Fallo de autenticación", "error");
      }
    } catch (err) {
      setLoginError("Error de conexión con el servidor");
      showToast("Error de conexión", "error");
    }
  };

  // Secure Logout handler
  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem("finterra_session_token");
    setAppData({
      expenses: [],
      budgets: [],
      bankConnections: [],
      notifications: [],
      securitySettings: {
        biometricsEnabled: true,
        encryptionEnabled: false,
        twoFactorEnabled: false,
        twoFactorSecret: "GEZD4NBVGY3TQOJQ",
        encryptionKey: ""
      }
    });
    showToast("Sesión cerrada", "info");
  };

  // Real 2FA disabling handler
  const handleDisable2FA = async () => {
    try {
      const res = await authFetch("/api/security/disable-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (res.ok) {
        setTwoFactorVerified(null);
        setAppData({ ...appData, securitySettings: data.securitySettings });
        showToast("Autenticación de Dos Factores desactivada", "info");
      } else {
        showToast("Error al desactivar 2FA", "error");
      }
    } catch (err) {
      showToast("Error de red al desactivar 2FA", "error");
    }
  };

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Add Expense Handler
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.amount || !expenseForm.description) {
      showToast("Por favor ingresa importe y descripción", "error");
      return;
    }

    try {
      const res = await authFetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(expenseForm.amount),
          category: expenseForm.category || undefined, // undefined triggers server-side auto-classify
          description: expenseForm.description,
          date: expenseForm.date,
          paymentMethod: expenseForm.paymentMethod,
          bankAccountId: expenseForm.bankAccountId || undefined
        })
      });

      if (res.ok) {
        const result = await res.json();
        showToast(
          result.expense.isAutoClassified
            ? `Gasto guardado. Categorizado automáticamente como '${result.expense.category}'`
            : "Gasto registrado correctamente",
          "success"
        );
        
        // Refresh full state to reflect bank deductions, budgets, and notifications
        await fetchData();

        // Trigger dynamic modal alert if budget threshold exceeded
        if (result.alerts && result.alerts.length > 0) {
          result.alerts.forEach((alert: string) => {
            showToast(alert, "info");
          });
        }

        // Reset Form
        setExpenseForm({
          amount: "",
          category: "",
          description: "",
          date: new Date().toISOString().substring(0, 10),
          paymentMethod: "Tarjeta de Crédito",
          bankAccountId: ""
        });
        setScanResult(null);
        setSelectedImage(null);
      } else {
        showToast("Error al registrar el gasto", "error");
      }
    } catch (err) {
      showToast("Fallo en la comunicación con la nube", "error");
    }
  };

  // Delete Expense Handler
  const handleDeleteExpense = async (id: string) => {
    try {
      const res = await authFetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Gasto eliminado. Saldo reembolsado si correspondía", "info");
        await fetchData();
      } else {
        showToast("Error al eliminar gasto", "error");
      }
    } catch (err) {
      showToast("Fallo de comunicación con la nube", "error");
    }
  };

  // Scan Receipt (OCR) File Selection
  const handleReceiptUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setScanResult(null);
      };
      reader.readAsDataURL(file);
    }
  };

  // Trigger real or simulated OCR using server-side Gemini
  const handleAnalyzeReceipt = async () => {
    if (!selectedImage) return;

    try {
      setScanning(true);
      const res = await authFetch("/api/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: selectedImage })
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          setScanResult(result.data);
          // Autofill form
          setExpenseForm({
            amount: result.data.amount.toString(),
            category: result.data.category,
            description: result.data.vendor,
            date: result.data.date,
            paymentMethod: "Tarjeta de Crédito",
            bankAccountId: appData.bankConnections[0]?.id || ""
          });
          showToast(`OCR finalizado por ${result.method === "gemini_ai_ocr" ? "Gemini 3.5" : "Simulador OCR"}. Datos pre-completados.`, "success");
        } else {
          showToast("No se pudo extraer información del recibo", "error");
        }
      } else {
        showToast("Error en el servidor OCR de recibos", "error");
      }
    } catch (err) {
      showToast("Fallo al conectar con el motor OCR", "error");
    } finally {
      setScanning(false);
    }
  };

  // Simulate Bank real-time Sync pulling
  const handleSyncBank = async (bankId: string) => {
    try {
      setSyncingBankId(bankId);
      showToast("Conectando con la API del banco de forma segura...", "info");
      const res = await authFetch(`/api/banks/sync/${bankId}`, { method: "POST" });
      
      if (res.ok) {
        // Wait 2 seconds for server timeout simulator to finish
        setTimeout(async () => {
          await fetchData();
          setSyncingBankId(null);
          showToast("Sincronización bancaria en tiempo real finalizada", "success");
        }, 2000);
      } else {
        setSyncingBankId(null);
        showToast("Error al sincronizar con la API bancaria", "error");
      }
    } catch (err) {
      setSyncingBankId(null);
      showToast("Fallo de red bancaria", "error");
    }
  };

  // Link New Bank Account via real API
  const handleLinkBank = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await authFetch("/api/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankName: newBankForm.bankName,
          accountType: newBankForm.accountType,
          balance: parseFloat(newBankForm.balance) || 1500,
          accountNumber: newBankForm.accountNumber
        })
      });
      
      if (res.ok) {
        await fetchData();
        setShowLinkBankModal(false);
        showToast(`¡Cuenta de ${newBankForm.bankName} vinculada con éxito y cifrada de extremo a extremo!`, "success");
      } else {
        showToast("Error al vincular banco", "error");
      }
    } catch (err) {
      showToast("Error de conexión al vincular banco", "error");
    }
  };

  // Unlink Bank Account via real API
  const handleUnlinkBank = async (id: string) => {
    try {
      const res = await authFetch(`/api/banks/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Cuenta bancaria desvinculada correctamente", "info");
        await fetchData();
      } else {
        showToast("Error al desvincular cuenta bancaria", "error");
      }
    } catch (err) {
      showToast("Fallo de red al desvincular cuenta", "error");
    }
  };

  // Update budget limit
  const handleSaveBudgetLimit = async (category: string) => {
    if (!editingBudgetLimit) return;
    try {
      const res = await authFetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          limit: parseFloat(editingBudgetLimit)
        })
      });
      if (res.ok) {
        showToast(`Presupuesto de ${category} actualizado correctamente`, "success");
        await fetchData();
        setEditingBudgetCategory(null);
        setEditingBudgetLimit("");
      } else {
        showToast("Error al actualizar presupuesto", "error");
      }
    } catch (err) {
      showToast("Error de conexión", "error");
    }
  };

  // Clear/Read Notifications
  const handleMarkNotificationRead = async (id: string) => {
    try {
      await authFetch(`/api/notifications/read/${id}`, { method: "POST" });
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearNotifications = async () => {
    try {
      await authFetch("/api/notifications/clear", { method: "POST" });
      await fetchData();
      showToast("Notificaciones archivadas", "info");
    } catch (err) {
      console.error(err);
    }
  };

  // Simulation of E2E Encryption Toggle
  const handleToggleEncryption = async (enabled: boolean) => {
    const updatedSettings: SecuritySettings = {
      ...appData.securitySettings,
      encryptionEnabled: enabled,
      encryptionKey: enabled ? e2eHashedKey : ""
    };
    try {
      const res = await authFetch("/api/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedSettings)
      });
      if (res.ok) {
        setAppData({ ...appData, securitySettings: updatedSettings });
        showToast(
          enabled
            ? "Cifrado de extremo a extremo (E2EE) habilitado. Todos tus datos locales y remotos se transmiten cifrados con tu hash privado."
            : "Cifrado remoto deshabilitado.",
          enabled ? "success" : "info"
        );
      }
    } catch (err) {
      showToast("Error al guardar ajustes", "error");
    }
  };

  // Biometrics Lock toggle
  const handleToggleBiometrics = async (enabled: boolean) => {
    const updatedSettings: SecuritySettings = {
      ...appData.securitySettings,
      biometricsEnabled: enabled
    };
    try {
      const res = await authFetch("/api/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedSettings)
      });
      if (res.ok) {
        setAppData({ ...appData, securitySettings: updatedSettings });
        showToast(
          enabled
            ? "Acceso Biométrico activado. Se te solicitará FaceID/TouchID al iniciar la app."
            : "Inicio biométrico desactivado.",
          "info"
        );
      }
    } catch (err) {
      showToast("Error al guardar ajustes", "error");
    }
  };

  // Real 2FA verification using Google Authenticator code
  const handleVerify2FA = async () => {
    if (!twoFactorInput || twoFactorInput.length !== 6) {
      showToast("Por favor ingresa un código de 6 dígitos", "error");
      return;
    }
    try {
      const res = await authFetch("/api/security/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: twoFactorInput })
      });
      const data = await res.json();
      if (res.ok) {
        setTwoFactorVerified(true);
        setAppData({ ...appData, securitySettings: data.securitySettings });
        setTwoFactorInput("");
        showToast("¡Autenticación de Dos Factores (2FA) configurada con éxito!", "success");
      } else {
        setTwoFactorVerified(false);
        showToast(data.error || "Código 2FA incorrecto. Intenta de nuevo.", "error");
      }
    } catch (err) {
      showToast("Error al verificar 2FA", "error");
    }
  };

  // Simulate report export download (CSV/HTML)
  const handleExportData = async (format: "csv" | "pdf" | "excel") => {
    try {
      const res = await authFetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format })
      });
      if (res.ok) {
        const result = await res.json();
        
        // Setup download in browser
        const blob = new Blob([result.csvContent || "Reporte vacio"], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", result.fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast(`Reporte en formato ${format.toUpperCase()} generado y descargado correctamente.`, "success");
      }
    } catch (err) {
      showToast("Error al generar exportación", "error");
    }
  };

  // Simulate email report periodically
  const handleSendEmailReport = async () => {
    try {
      showToast("Generando reporte y conectando con servidor de correo...", "info");
      const res = await authFetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: "pdf",
          email: "luketastoffolon@gmail.com"
        })
      });

      if (res.ok) {
        const result = await res.json();
        setShowEmailPreview({
          open: true,
          html: result.previewHtml,
          email: "luketastoffolon@gmail.com"
        });
        showToast(`¡Informe mensual programado y enviado a luketastoffolon@gmail.com!`, "success");
      }
    } catch (err) {
      showToast("Error al procesar el reporte de correo", "error");
    }
  };

  // Local helper calculations
  const totalBalance = appData.bankConnections.reduce((sum, b) => sum + b.balance, 0);
  const totalMonthlySpent = appData.expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalMonthlyBudget = appData.budgets.reduce((sum, b) => sum + b.limit, 0);

  // Filter & Search expenses
  const filteredExpenses = appData.expenses.filter(e => {
    const matchesSearch =
      e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "Todos" || e.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const unreadNotificationCount = appData.notifications.filter(n => !n.read).length;

  if (!token) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-800"} font-sans transition-colors duration-300`}>
        <div className="w-full max-w-md p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl relative overflow-hidden">
          
          {/* Decorative glowing gradient sphere */}
          <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl"></div>
          <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl"></div>

          <div className="text-center mb-8">
            <div className="inline-flex p-3.5 bg-emerald-500 text-slate-950 rounded-2xl shadow-lg mb-4">
              <Wallet className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight dark:text-white">Finterra</h1>
            <p className="text-xs text-slate-400 mt-1">Gestor de Gastos Inteligente</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {!login2faRequired ? (
              <>
                <div>
                  <label className="text-2xs font-bold text-slate-400 block mb-1.5 uppercase tracking-wider font-semibold">Usuario</label>
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={e => setUsernameInput(e.target.value)}
                    placeholder="luketas"
                    className="w-full px-4 py-3 rounded-2xl border dark:border-slate-800 bg-transparent text-xs focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100"
                    required
                  />
                </div>

                <div>
                  <label className="text-2xs font-bold text-slate-400 block mb-1.5 uppercase tracking-wider font-semibold">Contraseña</label>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-2xl border dark:border-slate-800 bg-transparent text-xs focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100"
                    required
                  />
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="text-center p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 mb-2">
                  <ShieldAlert className="h-6 w-6 text-emerald-400 mx-auto mb-2 animate-bounce" />
                  <h3 className="text-xs font-bold dark:text-white">Verificación de 2 Factores</h3>
                  <p className="text-3xs text-slate-400 mt-1">Ingresa el código temporal de 6 dígitos de tu app de autenticación.</p>
                </div>
                <div>
                  <label className="text-2xs font-bold text-slate-400 block mb-1.5 uppercase tracking-wider font-semibold">Código 2FA</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={login2faCode}
                    onChange={e => setLogin2faCode(e.target.value)}
                    placeholder="Ej. 123456"
                    className="w-full px-4 py-3 rounded-2xl border dark:border-slate-800 bg-transparent text-xs focus:outline-none focus:border-emerald-500 text-center font-mono tracking-widest font-bold text-slate-800 dark:text-slate-100"
                    required
                  />
                </div>
              </div>
            )}

            {loginError && (
              <p className="text-xs text-rose-500 font-semibold text-center bg-rose-500/5 p-2.5 rounded-xl border border-rose-500/10">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-2xl transition-all duration-200 cursor-pointer shadow-lg hover:shadow-emerald-500/25 flex items-center justify-center space-x-1.5 text-xs"
            >
              <span>{login2faRequired ? "Verificar y Acceder" : "Iniciar Sesión"}</span>
            </button>

            {login2faRequired && (
              <button
                type="button"
                onClick={() => {
                  setLogin2faRequired(false);
                  setLogin2faCode("");
                  setLoginError(null);
                }}
                className="w-full text-center text-xs text-slate-400 hover:text-slate-200 cursor-pointer mt-2"
              >
                Volver a usuario/contraseña
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div id="app-root" className={`min-h-screen ${darkMode ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-800"} font-sans transition-colors duration-300`}>
      
      {/* 1. BIOMETRIC LOCK SCREEN SIMULATOR */}
      {showBiometricScreen && appData.securitySettings.biometricsEnabled && (
        <div id="biometric-overlay" className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900 bg-opacity-98 backdrop-blur-md">
          <div className="w-full max-w-md p-8 bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl text-center flex flex-col items-center">
            <div className="p-4 bg-emerald-500 bg-opacity-10 rounded-full mb-6 animate-pulse">
              <Fingerprint className="h-16 w-16 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-white font-sans">Bloqueo Biométrico Activo</h2>
            <p className="text-slate-400 text-sm mb-8 px-4">
              La base de datos de tus gastos está encriptada. Escanea tu huella digital o FaceID para desbloquear la aplicación.
            </p>
            <button
              onClick={() => {
                setShowBiometricScreen(false);
                showToast("Acceso biométrico verificado de forma segura", "success");
              }}
              className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-2xl transition-all duration-200 cursor-pointer shadow-lg hover:shadow-emerald-500/25 flex items-center space-x-2"
            >
              <span>Simular Escaneo Huella</span>
            </button>
            <div className="mt-8 pt-6 border-t border-slate-700 w-full text-xs text-slate-500 flex items-center justify-center space-x-1">
              <ShieldCheck className="h-4.5 w-4.5 text-emerald-400" />
              <span>Cifrado de extremo a extremo activo</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. MAIN APP CONTAINER */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* HEADER SECTION */}
        <header className="flex flex-col md:flex-row justify-between items-center pb-6 mb-8 border-b border-slate-200 dark:border-slate-800 gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-500 text-slate-950 rounded-2xl shadow-md">
              <Wallet className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight dark:text-white">Finterra</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Finanzas Personales e Inteligencia OCR</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 flex-wrap gap-2">
            {/* Cloud Sync Status Indicator */}
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-mono dark:bg-slate-900 bg-slate-100 border dark:border-slate-800 border-slate-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-slate-500 dark:text-slate-400">Nube Sincronizada</span>
            </div>

            {/* Dark Mode Switcher */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2.5 rounded-2xl dark:bg-slate-900 bg-slate-100 border dark:border-slate-800 border-slate-200 hover:opacity-80 transition cursor-pointer"
            >
              {darkMode ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-slate-600" />}
            </button>

            {/* Log Out Button */}
            <button
              onClick={handleLogout}
              className="p-2.5 rounded-2xl dark:bg-rose-950/20 bg-rose-50 border dark:border-rose-900/30 border-rose-200 hover:opacity-80 transition cursor-pointer text-rose-500 dark:text-rose-400"
              title="Cerrar Sesión"
            >
              <LogOut className="h-5 w-5" />
            </button>

            {/* Notifications Button */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-2.5 rounded-2xl dark:bg-slate-900 bg-slate-100 border dark:border-slate-800 border-slate-200 hover:opacity-80 transition relative cursor-pointer"
              >
                <Bell className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 bg-rose-500 text-white rounded-full text-3xs font-bold flex items-center justify-center animate-bounce">
                    {unreadNotificationCount}
                  </span>
                )}
              </button>

              {/* Notifications Panel overlay dropdown */}
              {notificationsOpen && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 dark:bg-slate-900 bg-white border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl z-40 overflow-hidden">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                    <span className="font-bold text-sm">Notificaciones ({unreadNotificationCount})</span>
                    <button onClick={handleClearNotifications} className="text-xs text-rose-500 hover:underline">Limpiar todas</button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {appData.notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">No hay notificaciones pendientes.</div>
                    ) : (
                      appData.notifications.map(notif => (
                        <div
                          key={notif.id}
                          className={`p-4 border-b border-slate-100 dark:border-slate-800/50 flex space-x-3 transition-colors ${
                            notif.read ? "opacity-60 bg-transparent" : "bg-emerald-50 dark:bg-emerald-950/10"
                          }`}
                          onClick={() => handleMarkNotificationRead(notif.id)}
                        >
                          <div className="mt-0.5">
                            {notif.type === "alert" && <AlertTriangle className="h-5 w-5 text-amber-500" />}
                            {notif.type === "suspicious" && <AlertTriangle className="h-5 w-5 text-rose-500 animate-pulse" />}
                            {notif.type === "sync" && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{notif.title}</span>
                              <span className="text-[10px] text-slate-400">{new Date(notif.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{notif.message}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 3. APP NAVIGATION TABS */}
        <nav className="flex space-x-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl mb-8 overflow-x-auto whitespace-nowrap">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-4 py-2.5 rounded-xl font-medium text-xs transition cursor-pointer ${
              activeTab === "dashboard"
                ? "bg-white dark:bg-slate-800 shadow text-emerald-500 dark:text-emerald-400 font-bold"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab("expenses")}
            className={`px-4 py-2.5 rounded-xl font-medium text-xs transition cursor-pointer ${
              activeTab === "expenses"
                ? "bg-white dark:bg-slate-800 shadow text-emerald-500 dark:text-emerald-400 font-bold"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Gastos y OCR
          </button>
          <button
            onClick={() => setActiveTab("budgets")}
            className={`px-4 py-2.5 rounded-xl font-medium text-xs transition cursor-pointer ${
              activeTab === "budgets"
                ? "bg-white dark:bg-slate-800 shadow text-emerald-500 dark:text-emerald-400 font-bold"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Presupuestos
          </button>
          <button
            onClick={() => setActiveTab("banks")}
            className={`px-4 py-2.5 rounded-xl font-medium text-xs transition cursor-pointer ${
              activeTab === "banks"
                ? "bg-white dark:bg-slate-800 shadow text-emerald-500 dark:text-emerald-400 font-bold"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Cuentas Bancarias
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`px-4 py-2.5 rounded-xl font-medium text-xs transition cursor-pointer ${
              activeTab === "security"
                ? "bg-white dark:bg-slate-800 shadow text-emerald-500 dark:text-emerald-400 font-bold"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Seguridad y Cifrado
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`px-4 py-2.5 rounded-xl font-medium text-xs transition cursor-pointer ${
              activeTab === "reports"
                ? "bg-white dark:bg-slate-800 shadow text-emerald-500 dark:text-emerald-400 font-bold"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Reportes y Exportación
          </button>
        </nav>

        {/* 4. MAIN PAGE CONTENT RENDER */}
        {loading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center">
            <RefreshCw className="h-10 w-10 text-emerald-500 animate-spin mb-4" />
            <p className="text-slate-400 text-sm">Cargando base de datos cifrada...</p>
          </div>
        ) : (
          <div>
            {/* ======================================================== */}
            {/* A. DASHBOARD VIEW                                        */}
            {/* ======================================================== */}
            {activeTab === "dashboard" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Stats Column */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Financial Bento Stats cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-6 rounded-3xl bg-emerald-500 text-slate-950 shadow-lg relative overflow-hidden">
                      <div className="absolute right-0 bottom-0 opacity-10 translate-x-4 translate-y-4">
                        <Wallet className="h-40 w-40" />
                      </div>
                      <span className="text-2xs uppercase tracking-widest font-bold opacity-70">Saldo Consolidado</span>
                      <h2 className="text-3xl font-extrabold mt-1">${totalBalance.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</h2>
                      <p className="text-xs opacity-80 mt-4 font-mono">Sincronizado con {appData.bankConnections.length} cuentas bancarias</p>
                    </div>

                    <div className="p-6 rounded-3xl dark:bg-slate-900 bg-white border border-slate-200 dark:border-slate-800 shadow-md">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-2xs uppercase tracking-widest font-bold text-slate-400">Gasto Acumulado (Mes)</span>
                          <h2 className="text-3xl font-extrabold mt-1 text-rose-500">${totalMonthlySpent.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</h2>
                        </div>
                        <div className="p-2 bg-rose-500 bg-opacity-10 text-rose-500 rounded-xl">
                          <TrendingUp className="h-5 w-5" />
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                        <span>Límite total presupuestado:</span>
                        <span className="font-bold">${totalMonthlyBudget.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="mt-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-rose-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min((totalMonthlySpent / (totalMonthlyBudget || 1)) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Categories circle budget visual meters */}
                  <div className="p-6 rounded-3xl dark:bg-slate-900 bg-white border border-slate-200 dark:border-slate-800 shadow-md">
                    <h3 className="text-sm font-bold mb-6">Estado de Límites por Categoría</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-center">
                      {appData.budgets.map(b => {
                        const percent = b.limit > 0 ? (b.spent / b.limit) * 100 : 0;
                        const isOver = percent >= 100;
                        const isWarning = percent >= 80 && percent < 100;
                        
                        // Circle stroke values
                        const radius = 32;
                        const circumference = 2 * Math.PI * radius;
                        const offset = circumference - (Math.min(percent, 100) / 100) * circumference;

                        return (
                          <div key={b.id} className="flex flex-col items-center">
                            <div className="relative h-20 w-20 flex items-center justify-center">
                              <svg className="h-20 w-20 transform -rotate-90">
                                <circle
                                  cx="40"
                                  cy="40"
                                  r={radius}
                                  className="stroke-slate-200 dark:stroke-slate-800"
                                  strokeWidth="6"
                                  fill="transparent"
                                />
                                <circle
                                  cx="40"
                                  cy="40"
                                  r={radius}
                                  className={`transition-all duration-500 ${
                                    isOver ? "stroke-rose-500" : isWarning ? "stroke-amber-500" : "stroke-emerald-400"
                                  }`}
                                  strokeWidth="6"
                                  fill="transparent"
                                  strokeDasharray={circumference}
                                  strokeDashoffset={offset}
                                  strokeLinecap="round"
                                />
                              </svg>
                              <div className="absolute text-2xs font-extrabold">
                                {Math.round(percent)}%
                              </div>
                            </div>
                            <span className="text-xs font-bold mt-2 block">{b.category}</span>
                            <span className="text-3xs text-slate-400 font-mono mt-0.5">${b.spent.toLocaleString("es-AR", { maximumFractionDigits: 0 })} de ${b.limit.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Multi-platform Sync Preview simulator */}
                  <div className="p-6 rounded-3xl bg-slate-100 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2.5 dark:bg-slate-800 bg-white rounded-xl">
                          <Smartphone className="h-6 w-6 text-emerald-400" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Sincronización Móvil Multi-dispositivo</h4>
                          <p className="text-xs text-slate-500">Escanea y accede en tiempo real en iOS o Android</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 bg-white dark:bg-slate-900 p-2 rounded-2xl border dark:border-slate-800 shadow-sm">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(window.location.origin)}`} 
                          alt="Sincronización Móvil QR" 
                          className="h-10 w-10" 
                        />
                        <div className="text-2xs leading-tight">
                          <span className="font-bold block text-slate-700 dark:text-slate-300">Escanea en tu Móvil</span>
                          <span className="text-slate-400">Sincronización en la nube</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Recent Expenses & Active Banks */}
                <div className="space-y-6">
                  {/* Bank list inside dashboard */}
                  <div className="p-6 rounded-3xl dark:bg-slate-900 bg-white border border-slate-200 dark:border-slate-800 shadow-md">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-bold">Cuentas Bancarias</h3>
                      <button onClick={() => setActiveTab("banks")} className="text-xs text-emerald-400 hover:underline">Ver todas</button>
                    </div>
                    <div className="space-y-3">
                      {appData.bankConnections.map(b => (
                        <div key={b.id} className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/20">
                          <div>
                            <span className="text-xs font-bold block">{b.bankName}</span>
                            <span className="text-3xs text-slate-400 font-mono">{b.accountNumber}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200">${b.balance.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                            <span className="text-[9px] text-emerald-400 block font-mono">Sincronizado</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick recent expenses mini-list */}
                  <div className="p-6 rounded-3xl dark:bg-slate-900 bg-white border border-slate-200 dark:border-slate-800 shadow-md">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-bold">Últimos Gastos</h3>
                      <button onClick={() => setActiveTab("expenses")} className="text-xs text-emerald-400 hover:underline">Ver todos</button>
                    </div>
                    <div className="space-y-3">
                      {appData.expenses.slice(0, 4).map(e => (
                        <div key={e.id} className="flex justify-between items-center text-xs">
                          <div className="flex items-center space-x-2">
                            <span className={`w-2 h-2 rounded-full ${
                              e.category === "Alimentación" ? "bg-amber-400" :
                              e.category === "Transporte" ? "bg-blue-400" :
                              e.category === "Servicios" ? "bg-emerald-400" :
                              e.category === "Entretenimiento" ? "bg-purple-400" : "bg-slate-400"
                            }`}></span>
                            <div>
                              <span className="font-bold block leading-tight text-slate-700 dark:text-slate-200">{e.description}</span>
                              <span className="text-[10px] text-slate-400">{e.date}</span>
                            </div>
                          </div>
                          <span className="font-extrabold text-rose-500">-${e.amount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* B. EXPENSES & OCR SCAN VIEW                             */}
            {/* ======================================================== */}
            {activeTab === "expenses" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* 1. Add Gasto Form and Receipt scanner */}
                <div className="lg:col-span-5 space-y-6">
                  
                  {/* OCR Scanner block */}
                  <div className="p-6 rounded-3xl dark:bg-slate-900 bg-white border border-slate-200 dark:border-slate-800 shadow-md">
                    <h3 className="text-sm font-bold mb-3 flex items-center space-x-2">
                      <Camera className="h-5 w-5 text-emerald-400" />
                      <span>Escanear Recibo con IA (OCR)</span>
                    </h3>
                    <p className="text-xs text-slate-400 mb-4">
                      Usa la cámara de tu móvil o sube una foto del tique. Nuestra IA extraerá automáticamente comercio, importe, fecha y artículos.
                    </p>

                    <div className="space-y-4">
                      {selectedImage ? (
                        <div className="relative rounded-2xl overflow-hidden border dark:border-slate-700 bg-slate-950 aspect-video flex items-center justify-center">
                          <img src={selectedImage} alt="Receipt preview" className="max-h-full max-w-full object-contain" />
                          <button
                            onClick={() => {
                              setSelectedImage(null);
                              setScanResult(null);
                            }}
                            className="absolute top-2 right-2 p-1.5 bg-slate-900 bg-opacity-80 rounded-full text-slate-400 hover:text-white"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={handleReceiptUploadClick}
                          className="border-2 border-dashed dark:border-slate-700 border-slate-300 hover:border-emerald-400 dark:hover:border-emerald-500 rounded-2xl p-6 text-center cursor-pointer transition bg-slate-50 dark:bg-slate-950/20"
                        >
                          <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                          <span className="text-xs font-bold block mb-1">Escanear Tique o Factura</span>
                          <span className="text-3xs text-slate-400">Arrastra imagen o clica para abrir cámara</span>
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="image/*"
                            capture="environment" // direct maps to device camera
                            className="hidden"
                          />
                        </div>
                      )}

                      {selectedImage && !scanResult && (
                        <button
                          onClick={handleAnalyzeReceipt}
                          disabled={scanning}
                          className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold rounded-2xl transition cursor-pointer flex items-center justify-center space-x-2 shadow-lg hover:shadow-emerald-500/25 disabled:opacity-50"
                        >
                          {scanning ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              <span>Analizando con IA...</span>
                            </>
                          ) : (
                            <>
                              <Camera className="h-4 w-4" />
                              <span>Escanear y Extraer Datos</span>
                            </>
                          )}
                        </button>
                      )}

                      {scanResult && (
                        <div className="p-4 rounded-2xl bg-emerald-500 bg-opacity-5 border border-emerald-500/20 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-2xs font-extrabold uppercase text-emerald-400">Datos Extraídos de Forma Segura</span>
                            <span className="text-3xs font-mono px-2 py-0.5 rounded-full dark:bg-slate-800 bg-slate-100 dark:text-slate-300">Cifrado E2EE</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-slate-400 block text-3xs">Establecimiento</span>
                              <span className="font-bold">{scanResult.vendor}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-3xs">Importe Total</span>
                              <span className="font-extrabold text-rose-500">${scanResult.amount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-3xs">Fecha</span>
                              <span className="font-medium">{scanResult.date}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-3xs">Categoría Propuesta</span>
                              <span className="font-medium text-emerald-400">{scanResult.category}</span>
                            </div>
                          </div>
                          {scanResult.items && scanResult.items.length > 0 && (
                            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                              <span className="text-slate-400 block text-3xs mb-1">Detalle de Productos:</span>
                              <div className="flex flex-wrap gap-1">
                                {scanResult.items.map((item, idx) => (
                                  <span key={idx} className="text-[10px] bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 rounded">
                                    {item}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expense Form */}
                  <div className="p-6 rounded-3xl dark:bg-slate-900 bg-white border border-slate-200 dark:border-slate-800 shadow-md">
                    <h3 className="text-sm font-bold mb-4">Registrar Gasto Manual</h3>
                    <form onSubmit={handleAddExpense} className="space-y-4">
                      <div>
                        <label className="text-3xs font-bold text-slate-400 uppercase block mb-1">Descripción</label>
                        <input
                          type="text"
                          placeholder="p. ej. Compra semanal Coto"
                          value={expenseForm.description}
                          onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl border dark:border-slate-800 bg-transparent text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-3xs font-bold text-slate-400 uppercase block mb-1">Importe ($)</label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={expenseForm.amount}
                            onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-xl border dark:border-slate-800 bg-transparent text-xs focus:outline-none focus:border-emerald-500 font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-3xs font-bold text-slate-400 uppercase block mb-1">Fecha</label>
                          <input
                            type="date"
                            value={expenseForm.date}
                            onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-xl border dark:border-slate-800 bg-transparent text-xs focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-3xs font-bold text-slate-400 uppercase block mb-1">Categoría</label>
                          <select
                            value={expenseForm.category}
                            onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-xl border dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100"
                          >
                            <option value="" className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white">Clasificación Auto (Por IA)</option>
                            <option value="Alimentación" className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white">Alimentación</option>
                            <option value="Transporte" className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white">Transporte</option>
                            <option value="Servicios" className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white">Servicios</option>
                            <option value="Entretenimiento" className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white">Entretenimiento</option>
                            <option value="Salud" className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white">Salud</option>
                            <option value="Otros" className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white">Otros</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-3xs font-bold text-slate-400 uppercase block mb-1">Método de Pago</label>
                          <select
                            value={expenseForm.paymentMethod}
                            onChange={e => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-xl border dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100"
                          >
                            <option value="Tarjeta de Crédito" className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white">Tarjeta de Crédito</option>
                            <option value="Tarjeta de Débito" className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white">Tarjeta de Débito</option>
                            <option value="Transferencia" className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white">Transferencia</option>
                            <option value="Efectivo" className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white">Efectivo</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-3xs font-bold text-slate-400 uppercase block mb-1">Cargar a Cuenta Vinculada (Opcional)</label>
                        <select
                          value={expenseForm.bankAccountId}
                          onChange={e => setExpenseForm({ ...expenseForm, bankAccountId: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl border dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100"
                        >
                          <option value="" className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white">Ninguna (Gasto Externo)</option>
                          {appData.bankConnections.map(b => (
                            <option key={b.id} value={b.id} className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white">{b.bankName} - Saldo: ${b.balance.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</option>
                          ))}
                        </select>
                        <span className="text-[10px] text-slate-400 mt-1 block">Si seleccionas una cuenta, el importe se deducirá automáticamente de tu saldo bancario en tiempo real.</span>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold rounded-2xl transition cursor-pointer flex items-center justify-center space-x-1.5 shadow-lg hover:shadow-emerald-500/25"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Confirmar y Guardar Gasto</span>
                      </button>
                    </form>
                  </div>
                </div>

                {/* 2. Expenses list */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="p-6 rounded-3xl dark:bg-slate-900 bg-white border border-slate-200 dark:border-slate-800 shadow-md">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 dark:border-slate-800 gap-4 mb-6">
                      <div>
                        <h3 className="text-sm font-bold">Listado Diario de Gastos</h3>
                        <p className="text-xs text-slate-400">Filtrado inteligente en tiempo real</p>
                      </div>

                      {/* Filters */}
                      <div className="flex space-x-2 flex-wrap gap-y-2">
                        <select
                          value={filterCategory}
                          onChange={e => setFilterCategory(e.target.value)}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-2xs bg-white text-slate-800 dark:bg-slate-900 dark:text-white"
                        >
                          <option value="Todos" className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white">Todos</option>
                          <option value="Alimentación" className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white">Alimentación</option>
                          <option value="Transporte" className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white">Transporte</option>
                          <option value="Servicios" className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white">Servicios</option>
                          <option value="Entretenimiento" className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white">Entretenimiento</option>
                          <option value="Salud" className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white">Salud</option>
                          <option value="Otros" className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white">Otros</option>
                        </select>
                      </div>
                    </div>

                    {/* Search query input */}
                    <div className="relative mb-6">
                      <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar por descripción, palabra clave..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border dark:border-slate-800 bg-transparent text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    {/* Expenses Table/Cards */}
                    <div className="space-y-4">
                      {filteredExpenses.length === 0 ? (
                        <div className="text-center py-10 text-xs text-slate-400">
                          No se encontraron gastos con los filtros actuales.
                        </div>
                      ) : (
                        filteredExpenses.map(expense => (
                          <div
                            key={expense.id}
                            className={`p-4 rounded-2xl border transition-all ${
                              expense.isSuspicious
                                ? "border-rose-500 bg-rose-500/5"
                                : "dark:border-slate-800 border-slate-100 dark:bg-slate-950/20 hover:border-slate-300 dark:hover:border-slate-700"
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="space-y-1">
                                <div className="flex items-center space-x-2">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    expense.category === "Alimentación" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400" :
                                    expense.category === "Transporte" ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400" :
                                    expense.category === "Servicios" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400" :
                                    expense.category === "Entretenimiento" ? "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400" :
                                    expense.category === "Salud" ? "bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-400" :
                                    "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-400"
                                  }`}>
                                    {expense.category}
                                  </span>
                                  {expense.isAutoClassified && (
                                    <span className="text-[9px] text-slate-400 italic">🤖 Clasificado por IA</span>
                                  )}
                                  {expense.isSuspicious && (
                                    <span className="text-[9px] font-bold text-rose-500 flex items-center space-x-0.5">
                                      <AlertTriangle className="h-3 w-3 inline" />
                                      <span>SOSPECHOSO</span>
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">{expense.description}</h4>
                                <div className="flex items-center space-x-3 text-[10px] text-slate-400">
                                  <span>{expense.date}</span>
                                  <span>•</span>
                                  <span>{expense.paymentMethod}</span>
                                  {expense.bankAccountId && (
                                    <>
                                      <span>•</span>
                                      <span className="text-emerald-400 font-mono">Bancario</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center space-x-3">
                                <span className={`text-sm font-extrabold ${expense.isSuspicious ? "text-rose-500" : "text-rose-400 dark:text-rose-500"}`}>
                                  -${expense.amount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                                </span>
                                <button
                                  onClick={() => handleDeleteExpense(expense.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* C. BUDGETS & ALERTS VIEW                                 */}
            {/* ======================================================== */}
            {activeTab === "budgets" && (
              <div className="space-y-6">
                <div className="p-6 rounded-3xl dark:bg-slate-900 bg-white border border-slate-200 dark:border-slate-800 shadow-md">
                  <div className="mb-6">
                    <h3 className="text-sm font-bold">Gestión de Presupuestos Mensuales</h3>
                    <p className="text-xs text-slate-400">Define límites máximos de gasto por categoría para evitar excederte.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {appData.budgets.map(b => {
                      const percent = b.limit > 0 ? (b.spent / b.limit) * 100 : 0;
                      const isOver = percent >= 100;
                      const isWarning = percent >= 80 && percent < 100;

                      return (
                        <div
                          key={b.id}
                          className="p-5 rounded-2xl border dark:border-slate-800 border-slate-100 bg-slate-50 dark:bg-slate-950/20 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{b.category}</span>
                                <span className="text-3xs text-slate-400 block font-mono">Mes: {b.month}</span>
                              </div>
                              <div className="text-right">
                                {editingBudgetCategory === b.category ? (
                                  <div className="flex items-center space-x-1">
                                    <input
                                      type="number"
                                      className="w-16 px-2 py-1 border dark:border-slate-800 bg-transparent rounded text-xs"
                                      placeholder={b.limit.toString()}
                                      value={editingBudgetLimit}
                                      onChange={e => setEditingBudgetLimit(e.target.value)}
                                    />
                                    <button
                                      onClick={() => handleSaveBudgetLimit(b.category)}
                                      className="px-2 py-1 bg-emerald-500 text-slate-950 rounded text-3xs font-bold"
                                    >
                                      Ok
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setEditingBudgetCategory(b.category);
                                      setEditingBudgetLimit(b.limit.toString());
                                    }}
                                    className="text-2xs text-emerald-400 hover:underline"
                                  >
                                    Ajustar Límite
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Budget Progress Meter details */}
                            <div className="flex justify-between items-center text-xs text-slate-500 mb-2 font-mono">
                              <span>Gastado: <strong className="text-slate-800 dark:text-slate-200">${b.spent.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</strong></span>
                              <span>Límite: <strong className="text-slate-800 dark:text-slate-200">${b.limit.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</strong></span>
                            </div>

                            {/* Dynamic color warning bar */}
                            <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden mb-3">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isOver ? "bg-rose-500" : isWarning ? "bg-amber-500" : "bg-emerald-400"
                                }`}
                                style={{ width: `${Math.min(percent, 100)}%` }}
                              ></div>
                            </div>
                          </div>

                          <div className="mt-2 pt-3 border-t dark:border-slate-800 border-slate-100 flex justify-between items-center text-3xs">
                            <span className="text-slate-400">Reglas de alerta activas:</span>
                            <div className="flex space-x-1.5 font-mono">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${b.spent >= b.limit * 0.5 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold" : "dark:bg-slate-800 bg-slate-200 text-slate-500"}`}>50%</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${b.spent >= b.limit * 0.8 ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold" : "dark:bg-slate-800 bg-slate-200 text-slate-500"}`}>80%</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${b.spent >= b.limit ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 font-bold animate-pulse" : "dark:bg-slate-800 bg-slate-200 text-slate-500"}`}>100%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Customizable notification rules block */}
                <div className="p-6 rounded-3xl dark:bg-slate-900 bg-white border border-slate-200 dark:border-slate-800 shadow-md">
                  <h3 className="text-sm font-bold mb-4 flex items-center space-x-2">
                    <Bell className="h-5 w-5 text-emerald-400" />
                    <span>Configurar Notificaciones de Presupuesto</span>
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 rounded-2xl dark:bg-slate-950/20 border dark:border-slate-800">
                      <div>
                        <span className="text-xs font-bold block">Alertas preventivas de consumo</span>
                        <span className="text-3xs text-slate-400">Notificar de inmediato cuando se alcance el 50% y 80% del límite de la categoría</span>
                      </div>
                      <input type="checkbox" defaultChecked className="accent-emerald-500" />
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-2xl dark:bg-slate-950/20 border dark:border-slate-800">
                      <div>
                        <span className="text-xs font-bold block">Bloqueo o advertencia estricta</span>
                        <span className="text-3xs text-slate-400">Enviar alertas push cada vez que se agregue un gasto que exceda el 100% del presupuesto</span>
                      </div>
                      <input type="checkbox" defaultChecked className="accent-emerald-500" />
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-2xl dark:bg-slate-950/20 border dark:border-slate-800">
                      <div>
                        <span className="text-xs font-bold block">Resumen semanal y mensual consolidado</span>
                        <span className="text-3xs text-slate-400">Programar el envío periódico a luketastoffolon@gmail.com</span>
                      </div>
                      <input type="checkbox" defaultChecked className="accent-emerald-500" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* D. BANK CONNECTIONS PORTAL                              */}
            {/* ======================================================== */}
            {activeTab === "banks" && (
              <div className="space-y-6">
                <div className="p-6 rounded-3xl dark:bg-slate-900 bg-white border border-slate-200 dark:border-slate-800 shadow-md">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b dark:border-slate-800 border-slate-100 mb-6 gap-4">
                    <div>
                      <h3 className="text-sm font-bold">Integración de Cuentas Bancarias</h3>
                      <p className="text-xs text-slate-400">Vincula tus bancos para recibir transacciones en tiempo real de forma segura (Cifrado E2EE).</p>
                    </div>
                    <button
                      onClick={() => setShowLinkBankModal(true)}
                      className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold rounded-xl transition cursor-pointer shadow-md"
                    >
                      Vincular Nueva Cuenta
                    </button>
                  </div>

                  {/* Bank list cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {appData.bankConnections.map(b => {
                      let cardBgClass = "bg-gradient-to-br from-slate-800 via-slate-900 to-zinc-950 text-white border border-slate-700";
                      let brandLogo = null;
                      
                      const nameLower = b.bankName.toLowerCase();
                      if (nameLower.includes("bbva")) {
                        cardBgClass = "bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-950 text-white border border-blue-600/30 shadow-lg shadow-blue-950/10";
                      } else if (nameLower.includes("santander")) {
                        cardBgClass = "bg-gradient-to-br from-red-600 via-red-700 to-rose-950 text-white border border-red-500/30 shadow-lg shadow-red-950/10";
                      } else if (nameLower.includes("caixa")) {
                        cardBgClass = "bg-gradient-to-br from-cyan-600 via-teal-800 to-slate-950 text-white border border-teal-500/30 shadow-lg shadow-teal-950/10";
                      } else if (nameLower.includes("revolut")) {
                        cardBgClass = "bg-gradient-to-br from-slate-800 via-slate-900 to-zinc-950 text-white border border-slate-700/50 shadow-lg shadow-zinc-950/20";
                      } else if (nameLower.includes("n26")) {
                        cardBgClass = "bg-gradient-to-br from-teal-800 via-slate-900 to-slate-950 text-white border border-teal-500/30 shadow-lg shadow-teal-950/10";
                      } else {
                        cardBgClass = "bg-gradient-to-br from-emerald-700 via-emerald-800 to-teal-950 text-white border border-emerald-600/30 shadow-lg shadow-emerald-950/10";
                      }

                      return (
                        <div
                          key={b.id}
                          className={`p-6 rounded-3xl ${cardBgClass} flex flex-col justify-between h-[230px] relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl`}
                        >
                          {/* Decorative card glow elements */}
                          <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
                          <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-black/25 rounded-full blur-2xl pointer-events-none"></div>

                          {/* Top: Brand & Status */}
                          <div className="flex justify-between items-center z-10">
                            <div>
                              <span className="text-2xs uppercase tracking-widest font-black text-white/50 block">BANCO CONECTADO</span>
                              <h4 className="text-xs font-black tracking-wide text-white uppercase">{b.bankName}</h4>
                            </div>
                            
                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-mono font-bold tracking-wider flex items-center ${
                              b.status === "connected" 
                                ? "bg-white/10 text-emerald-300 backdrop-blur-md" 
                                : "bg-amber-500/20 text-amber-300 backdrop-blur-md animate-pulse"
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${b.status === "connected" ? "bg-emerald-400" : "bg-amber-400"}`}></span>
                              {b.status === "connected" ? "CONECTADO" : "SINCRONIZANDO"}
                            </span>
                          </div>

                          {/* Middle: Chip, Signal and Masked Card Number */}
                          <div className="my-3 flex items-center justify-between z-10">
                            <div className="flex items-center space-x-3">
                              {/* Golden Chip */}
                              <div className="w-8.5 h-6.5 rounded bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 p-1 flex flex-col justify-between shadow-inner relative overflow-hidden">
                                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-25 gap-[1px]">
                                  {[...Array(9)].map((_, i) => <div key={i} className="border border-slate-950"></div>)}
                                </div>
                                <div className="w-full h-full border border-amber-600/30 rounded opacity-60"></div>
                              </div>
                              
                              {/* Contactless icon */}
                              <svg className="h-4 w-4 text-white/40 transform rotate-90" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" d="M12 18a6 6 0 000-12M15 15a3 3 0 000-6M18 12a1 1 0 000-2" />
                              </svg>
                            </div>
                            
                            <span className="text-xs font-mono tracking-widest text-white/90 font-bold">{b.accountNumber}</span>
                          </div>

                          {/* Bottom: Balance and Actions */}
                          <div className="flex justify-between items-end z-10 mt-auto">
                            <div>
                              <span className="text-[9px] uppercase tracking-widest text-white/50 block font-bold">{b.accountType}</span>
                              <span className="text-2xl font-black tracking-tight font-mono">${b.balance.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                            </div>
                            
                            {/* Sync / Trash Action buttons inside the card */}
                            <div className="flex space-x-1 bg-white/10 p-1 rounded-xl backdrop-blur-md">
                              <button
                                onClick={() => handleSyncBank(b.id)}
                                disabled={syncingBankId === b.id}
                                title="Sincronizar movimientos"
                                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <RefreshCw className={`h-3.5 w-3.5 ${syncingBankId === b.id ? "animate-spin" : ""}`} />
                              </button>
                              <button
                                onClick={() => handleUnlinkBank(b.id)}
                                title="Desvincular cuenta bancaria"
                                className="p-2 text-white/60 hover:text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Simulated notifications rule on suspicious movements */}
                <div className="p-6 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200">
                  <h4 className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-2 flex items-center space-x-2">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Detección de Movimientos Sospechosos</span>
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Nuestro sistema utiliza la API bancaria segura para evaluar tus cargos diarios. En caso de transacciones inusualmente altas (&gt;$500.000) o ubicaciones/comercios extraños, el motor generará una alerta push interactiva e ingresará un informe de advertencia en tiempo real para evitar fraudes.
                  </p>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* E. SECURITY, PRIVACY & ENCRYPTION VIEW                  */}
            {/* ======================================================== */}
            {activeTab === "security" && (
              <div className="space-y-6">
                
                {/* 1. Encryption and biometric options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* End to End Encryption */}
                  <div className="p-6 rounded-3xl dark:bg-slate-900 bg-white border border-slate-200 dark:border-slate-800 shadow-md">
                    <h3 className="text-sm font-bold mb-3 flex items-center space-x-2">
                      <Lock className="h-5 w-5 text-emerald-400" />
                      <span>Cifrado de Extremo a Extremo (E2EE)</span>
                    </h3>
                    <p className="text-xs text-slate-400 mb-4">
                      Tus transacciones y saldos se encriptan localmente con una frase de paso. Ni siquiera Finterra puede ver tus datos.
                    </p>

                    <div className="space-y-4">
                      <div>
                        <label className="text-3xs font-bold text-slate-400 uppercase block mb-1">Frase de Paso Privada</label>
                        <input
                          type="password"
                          placeholder="Ingresa tu contraseña secreta de cifrado"
                          value={passphrase}
                          onChange={e => setPassphrase(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border dark:border-slate-800 bg-transparent text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      {e2eHashedKey && (
                        <div className="p-3 bg-slate-950 rounded-xl border dark:border-slate-850 font-mono text-[10px] break-all text-emerald-400">
                          <span className="text-slate-400 text-3xs font-sans block mb-1 uppercase font-bold">Hash AES-256 de Cifrado Local:</span>
                          {e2eHashedKey}
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-2">
                        <span className="text-xs font-bold">Habilitar Transmisión Encriptada</span>
                        <button
                          onClick={() => handleToggleEncryption(!appData.securitySettings.encryptionEnabled)}
                          className={`w-12 h-6.5 rounded-full p-1 transition-colors duration-200 ${
                            appData.securitySettings.encryptionEnabled ? "bg-emerald-500" : "bg-slate-700"
                          }`}
                        >
                          <div
                            className={`w-4.5 h-4.5 bg-slate-950 rounded-full shadow-md transform transition-transform duration-200 ${
                              appData.securitySettings.encryptionEnabled ? "translate-x-5.5" : "translate-x-0"
                            }`}
                          ></div>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Biometrics simulator configuration */}
                  <div className="p-6 rounded-3xl dark:bg-slate-900 bg-white border border-slate-200 dark:border-slate-800 shadow-md">
                    <h3 className="text-sm font-bold mb-3 flex items-center space-x-2">
                      <Fingerprint className="h-5 w-5 text-emerald-400" />
                      <span>Seguridad Biométrica</span>
                    </h3>
                    <p className="text-xs text-slate-400 mb-4">
                      Bloquea el acceso a la aplicación mediante el escáner nativo de huellas dactilares o reconocimiento facial.
                    </p>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 rounded-2xl dark:bg-slate-950/20 border dark:border-slate-800">
                        <div>
                          <span className="text-xs font-bold block">Autenticación al abrir</span>
                          <span className="text-3xs text-slate-400">Solicitar TouchID/FaceID siempre al iniciar la sesión</span>
                        </div>
                        <button
                          onClick={() => handleToggleBiometrics(!appData.securitySettings.biometricsEnabled)}
                          className={`w-12 h-6.5 rounded-full p-1 transition-colors duration-200 ${
                            appData.securitySettings.biometricsEnabled ? "bg-emerald-500" : "bg-slate-700"
                          }`}
                        >
                          <div
                            className={`w-4.5 h-4.5 bg-slate-950 rounded-full shadow-md transform transition-transform duration-200 ${
                              appData.securitySettings.biometricsEnabled ? "translate-x-5.5" : "translate-x-0"
                            }`}
                          ></div>
                        </button>
                      </div>

                      <div className="flex justify-between items-center p-3 rounded-2xl dark:bg-slate-950/20 border dark:border-slate-800">
                        <div>
                          <span className="text-xs font-bold block">Confirmación de transacciones</span>
                          <span className="text-3xs text-slate-400">Solicitar confirmación biométrica antes de transferencias bancarias o gastos grandes</span>
                        </div>
                        <input type="checkbox" defaultChecked className="accent-emerald-500" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Google Authenticator 2FA */}
                <div className="p-6 rounded-3xl dark:bg-slate-900 bg-white border border-slate-200 dark:border-slate-800 shadow-md">
                  <h3 className="text-sm font-bold mb-3">Autenticación de Dos Factores (2FA)</h3>
                  
                  {appData.securitySettings.twoFactorEnabled ? (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                          <ShieldCheck className="h-6 w-6 animate-pulse" />
                        </div>
                        <div>
                          <span className="text-xs font-bold block dark:text-white">Estado: Activo</span>
                          <span className="text-3xs text-slate-400">Tu cuenta está protegida con verificación en dos pasos mediante TOTP.</span>
                        </div>
                      </div>
                      <button
                        onClick={handleDisable2FA}
                        className="px-4 py-2 bg-rose-50/15 hover:bg-rose-500/20 text-rose-500 dark:text-rose-400 text-xs font-bold rounded-xl transition cursor-pointer border border-rose-500/20"
                      >
                        Desactivar 2FA
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-slate-400 mb-6">
                        Asegura tu cuenta vinculando un autenticador de contraseñas de un solo uso (TOTP) como Google Authenticator o Authy.
                      </p>

                      <div className="flex flex-col md:flex-row items-center gap-6">
                        <div className="p-4 bg-white rounded-2xl border border-slate-200 flex items-center justify-center">
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`otpauth://totp/Finterra:luketas?secret=${appData.securitySettings.twoFactorSecret}&issuer=Finterra`)}`} 
                            alt="Código QR 2FA" 
                            className="h-32 w-32" 
                          />
                        </div>

                        <div className="flex-1 space-y-4">
                          <div>
                            <span className="text-2xs font-bold text-slate-400 uppercase block mb-1">Clave de vinculación manual</span>
                            <span className="text-xs font-mono font-bold dark:text-emerald-400 text-emerald-600 block">{appData.securitySettings.twoFactorSecret}</span>
                          </div>

                          <div>
                            <label className="text-2xs font-bold text-slate-400 uppercase block mb-1">Código de Verificación temporal</label>
                            <div className="flex space-x-2">
                              <input
                                type="text"
                                maxLength={6}
                                placeholder="Ej. 123456"
                                value={twoFactorInput}
                                onChange={e => setTwoFactorInput(e.target.value)}
                                className="px-4 py-2.5 rounded-xl border dark:border-slate-800 bg-transparent text-xs focus:outline-none focus:border-emerald-500 font-mono tracking-widest font-bold w-36"
                              />
                              <button
                                onClick={handleVerify2FA}
                                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold rounded-xl transition cursor-pointer"
                              >
                                Verificar y Activar
                              </button>
                            </div>
                          </div>

                          {twoFactorVerified !== null && (
                            <div className={`text-xs font-bold ${twoFactorVerified ? "text-emerald-400" : "text-rose-500"}`}>
                              {twoFactorVerified ? "✓ ¡2FA Verificado y Activo!" : "✗ Código de token incorrecto"}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* F. ANALYTICS, REPORTS & EXPORT VIEW                       */}
            {/* ======================================================== */}
            {activeTab === "reports" && (
              <div className="space-y-6">
                
                {/* Visual Custom SVG Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Category Distribution Chart */}
                  <div className="p-6 rounded-3xl dark:bg-slate-900 bg-white border border-slate-200 dark:border-slate-800 shadow-md">
                    <h3 className="text-sm font-bold mb-4">Gasto por Categoría (Visual)</h3>
                    <div className="h-60 flex items-center justify-center relative">
                      <svg className="w-full h-full" viewBox="0 0 400 220">
                        {/* Dynamic SVG Bars representation for compatibility */}
                        {appData.budgets.map((b, idx) => {
                          const maxSpent = Math.max(...appData.budgets.map(bu => bu.spent)) || 1;
                          const barHeight = (b.spent / maxSpent) * 120;
                          const x = 40 + idx * 55;
                          const y = 160 - barHeight;

                          return (
                            <g key={b.id}>
                              <rect
                                x={x}
                                y={160 - 120}
                                width="30"
                                height="120"
                                rx="4"
                                className="fill-slate-100 dark:fill-slate-800/40"
                              />
                              <rect
                                x={x}
                                y={y}
                                width="30"
                                height={barHeight}
                                rx="4"
                                className={`transition-all duration-1000 ${
                                  b.category === "Alimentación" ? "fill-amber-400" :
                                  b.category === "Transporte" ? "fill-blue-400" :
                                  b.category === "Servicios" ? "fill-emerald-400" :
                                  b.category === "Entretenimiento" ? "fill-purple-400" : "fill-slate-400"
                                }`}
                              />
                              {/* Label */}
                              <text
                                x={x + 15}
                                y="180"
                                textAnchor="middle"
                                className="fill-slate-400 text-4xs font-sans"
                              >
                                {b.category.substring(0, 4)}
                              </text>
                              {/* Amount text */}
                              <text
                                x={x + 15}
                                y={y - 8}
                                textAnchor="middle"
                                className="fill-slate-700 dark:fill-slate-300 text-4xs font-bold font-mono"
                              >
                                ${b.spent.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                              </text>
                            </g>
                          );
                        })}
                        {/* Floor axis line */}
                        <line x1="20" y1="160" x2="380" y2="160" className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="2" />
                      </svg>
                    </div>
                  </div>

                  {/* Monthly Trend simulated view */}
                  <div className="p-6 rounded-3xl dark:bg-slate-900 bg-white border border-slate-200 dark:border-slate-800 shadow-md">
                    <h3 className="text-sm font-bold mb-4">Gasto Diario - Historial de Tendencias</h3>
                    <div className="h-60 flex items-center justify-center">
                      <svg className="w-full h-full" viewBox="0 0 400 220">
                        {/* Beautiful curve grid representing daily transactions */}
                        <path
                          d="M 30 140 Q 90 90, 150 120 T 270 60 T 370 110"
                          fill="none"
                          className="stroke-emerald-400"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                        {/* Dots */}
                        <circle cx="30" cy="140" r="5" className="fill-emerald-400" />
                        <circle cx="150" cy="120" r="5" className="fill-emerald-400" />
                        <circle cx="270" cy="60" r="5" className="fill-emerald-400" />
                        <circle cx="370" cy="110" r="5" className="fill-emerald-400" />

                        {/* Reference lines */}
                        <line x1="30" y1="20" x2="30" y2="180" className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="1" strokeDasharray="3" />
                        <line x1="370" y1="20" x2="370" y2="180" className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="1" strokeDasharray="3" />

                        <text x="30" y="195" className="fill-slate-400 text-4xs font-sans" textAnchor="middle">01 Jul</text>
                        <text x="150" y="195" className="fill-slate-400 text-4xs font-sans" textAnchor="middle">10 Jul</text>
                        <text x="270" y="195" className="fill-slate-400 text-4xs font-sans" textAnchor="middle">20 Jul</text>
                        <text x="370" y="195" className="fill-slate-400 text-4xs font-sans" textAnchor="middle">30 Jul</text>
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Export panel options */}
                <div className="p-6 rounded-3xl dark:bg-slate-900 bg-white border border-slate-200 dark:border-slate-800 shadow-md">
                  <h3 className="text-sm font-bold mb-4">Exportación y Reportes Periódicos</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    {/* CSV/Excel Export */}
                    <div className="p-4 rounded-2xl dark:bg-slate-950/20 border dark:border-slate-800 flex flex-col justify-between">
                      <div>
                        <div className="p-2.5 bg-amber-500 bg-opacity-10 text-amber-500 rounded-xl w-max mb-3">
                          <FileSpreadsheet className="h-5 w-5" />
                        </div>
                        <h4 className="text-xs font-bold mb-1">Exportar Reporte Mensual (Excel/CSV)</h4>
                        <p className="text-3xs text-slate-400">Descarga un archivo compatible con Excel con todos tus gastos diarios organizados.</p>
                      </div>
                      <button
                        onClick={() => handleExportData("excel")}
                        className="mt-4 w-full py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center space-x-1.5"
                      >
                        <Download className="h-4.5 w-4.5" />
                        <span>Descargar Excel</span>
                      </button>
                    </div>

                    {/* PDF Document Print Report */}
                    <div className="p-4 rounded-2xl dark:bg-slate-950/20 border dark:border-slate-800 flex flex-col justify-between">
                      <div>
                        <div className="p-2.5 bg-rose-500 bg-opacity-10 text-rose-500 rounded-xl w-max mb-3">
                          <FileText className="h-5 w-5" />
                        </div>
                        <h4 className="text-xs font-bold mb-1">Descargar Reporte PDF</h4>
                        <p className="text-3xs text-slate-400">Genera una plantilla visual y estructurada de tu presupuesto mensual para imprimir.</p>
                      </div>
                      <button
                        onClick={() => handleExportData("csv")}
                        className="mt-4 w-full py-2 bg-rose-500 hover:bg-rose-600 text-slate-950 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center space-x-1.5"
                      >
                        <Download className="h-4.5 w-4.5" />
                        <span>Generar PDF</span>
                      </button>
                    </div>

                    {/* Email summary simulator (periódicamente) */}
                    <div className="p-4 rounded-2xl dark:bg-slate-950/20 border dark:border-slate-800 flex flex-col justify-between">
                      <div>
                        <div className="p-2.5 bg-emerald-500 bg-opacity-10 text-emerald-400 rounded-xl w-max mb-3">
                          <Mail className="h-5 w-5" />
                        </div>
                        <h4 className="text-xs font-bold mb-1">Informe Periódico por Correo</h4>
                        <p className="text-3xs text-slate-400">Simula el envío periódico automatizado del informe completo directamente a tu email.</p>
                      </div>
                      <button
                        onClick={handleSendEmailReport}
                        className="mt-4 w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center space-x-1.5"
                      >
                        <Mail className="h-4.5 w-4.5" />
                        <span>Enviar por Email</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* G. LINK BANK MODAL DIALOG SIMULATOR                     */}
      {/* ======================================================== */}
      {showLinkBankModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900 bg-opacity-80 backdrop-blur-xs">
          <div className="w-full max-w-md p-6 bg-slate-850 dark:bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl text-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-white flex items-center space-x-1.5">
                <CreditCard className="h-5 w-5 text-emerald-400" />
                <span>Vincular Cuenta con API Bancaria</span>
              </h3>
              <button onClick={() => setShowLinkBankModal(false)} className="p-1.5 text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleLinkBank} className="space-y-4">
              <div>
                <label className="text-3xs font-bold text-slate-400 uppercase block mb-1">Selecciona Entidad Bancaria</label>
                <select
                  value={newBankForm.bankName}
                  onChange={e => setNewBankForm({ ...newBankForm, bankName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs focus:outline-none"
                >
                  <option value="BBVA España">BBVA España</option>
                  <option value="Banco Santander">Banco Santander</option>
                  <option value="CaixaBank">CaixaBank</option>
                  <option value="Revolut">Revolut</option>
                  <option value="Banco Sabadell">Banco Sabadell</option>
                  <option value="ING Direct">ING Direct</option>
                </select>
              </div>

              <div>
                <label className="text-3xs font-bold text-slate-400 uppercase block mb-1">Tipo de Cuenta</label>
                <select
                  value={newBankForm.accountType}
                  onChange={e => setNewBankForm({ ...newBankForm, accountType: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs focus:outline-none"
                >
                  <option value="Cuenta Corriente">Cuenta Corriente</option>
                  <option value="Cuenta de Ahorros">Cuenta de Ahorros</option>
                  <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-3xs font-bold text-slate-400 uppercase block mb-1">Saldo de apertura ($)</label>
                  <input
                    type="number"
                    value={newBankForm.balance}
                    onChange={e => setNewBankForm({ ...newBankForm, balance: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs focus:outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="text-3xs font-bold text-slate-400 uppercase block mb-1">Número de Cuenta</label>
                  <input
                    type="text"
                    value={newBankForm.accountNumber}
                    onChange={e => setNewBankForm({ ...newBankForm, accountNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-500 bg-opacity-5 border border-emerald-500/15 rounded-xl text-[10px] text-slate-400 flex items-start space-x-2">
                <ShieldCheck className="h-4.5 w-4.5 text-emerald-400 mt-0.5 shrink-0" />
                <span>
                  Al hacer clic, autorizas a Finterra a conectar de forma segura mediante protocolo de banca abierta cifrado de extremo a extremo (Open Banking PSD2).
                </span>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Vincular y Cifrar Cuenta
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* H. EMAIL REPORT PREVIEW MODAL SCREEN                     */}
      {/* ======================================================== */}
      {showEmailPreview?.open && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-slate-900 bg-opacity-80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl text-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-100 border-b border-slate-200 flex justify-between items-center">
              <div>
                <span className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                  <Mail className="h-4 w-4 text-emerald-600" />
                  <span>Simulación de Correo Enviado</span>
                </span>
                <span className="text-[10px] text-slate-400 block">De: reportes@finterra.cloud • Para: {showEmailPreview.email}</span>
              </div>
              <button
                onClick={() => setShowEmailPreview(null)}
                className="p-1 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Embedded Email Body Content */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
              <div
                className="bg-white p-4 sm:p-8 rounded-2xl shadow-inner border border-slate-200/50"
                dangerouslySetInnerHTML={{ __html: showEmailPreview.html }}
              />
            </div>

            <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-between items-center text-3xs text-slate-400">
              <span>Sincronizado correctamente • Finterra periodic core</span>
              <button
                onClick={() => setShowEmailPreview(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-2xs"
              >
                Cerrar Vista de Correo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* I. TOAST ALERTS OVERLAYS                                  */}
      {/* ======================================================== */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-55 max-w-sm p-4 rounded-2xl shadow-xl flex items-start space-x-2.5 animate-bounce border text-xs leading-relaxed font-medium bg-slate-900 text-white border-slate-800">
          <div className="mt-0.5">
            {toast.type === "success" && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
            {toast.type === "error" && <AlertTriangle className="h-5 w-5 text-rose-500" />}
            {toast.type === "info" && <Info className="h-5 w-5 text-amber-400" />}
          </div>
          <div>
            <p>{toast.message}</p>
          </div>
        </div>
      )}

    </div>
  );
}
