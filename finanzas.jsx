import { useState, useEffect } from "react";

const CATEGORIES = [
  { id: "fijos", label: "Fijos", icon: "🏠", color: "#E8C547" },
  { id: "variables", label: "Variables", icon: "⚡", color: "#E87D47" },
  { id: "supermercado", label: "Supermercado", icon: "🛒", color: "#47C5E8" },
  { id: "higiene", label: "Higiene & Limpieza", icon: "🧼", color: "#A0E847" },
  { id: "cannabis", label: "Cannabis", icon: "🌿", color: "#47E8A0" },
  { id: "ropa", label: "Ropa", icon: "👗", color: "#C547E8" },
  { id: "viajes", label: "Viajes", icon: "✈️", color: "#4782E8" },
  { id: "ahorro", label: "Ahorro", icon: "💰", color: "#E84747" },
];

const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function loadData() {
  try {
    const raw = localStorage.getItem("finanzas_v1");
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveData(data) {
  try { localStorage.setItem("finanzas_v1", JSON.stringify(data)); } catch {}
}

export default function App() {
  const now = new Date();
  const [view, setView] = useState("dashboard"); // dashboard | add | budgets | history
  const [data, setData] = useState(loadData);
  const [monthKey, setMonthKey] = useState(getMonthKey(now));
  const [form, setForm] = useState({ amount: "", category: CATEGORIES[0].id, note: "" });
  const [toast, setToast] = useState(null);

  const monthData = data[monthKey] || { budgets: {}, expenses: [], income: 0 };

  function persistData(next) {
    setData(next);
    saveData(next);
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  function addExpense() {
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) return;
    const expense = {
      id: Date.now(),
      amount,
      category: form.category,
      note: form.note.trim(),
      date: new Date().toISOString(),
    };
    const next = {
      ...data,
      [monthKey]: {
        ...monthData,
        expenses: [...(monthData.expenses || []), expense],
      },
    };
    persistData(next);
    setForm({ amount: "", category: CATEGORIES[0].id, note: "" });
    showToast("Gasto agregado ✓");
    setView("dashboard");
  }

  function deleteExpense(id) {
    const next = {
      ...data,
      [monthKey]: {
        ...monthData,
        expenses: monthData.expenses.filter((e) => e.id !== id),
      },
    };
    persistData(next);
  }

  function setIncome(value) {
    const next = {
      ...data,
      [monthKey]: { ...monthData, income: parseFloat(value) || 0 },
    };
    persistData(next);
  }

  function setBudget(catId, value) {
    const next = {
      ...data,
      [monthKey]: {
        ...monthData,
        budgets: { ...monthData.budgets, [catId]: parseFloat(value) || 0 },
      },
    };
    persistData(next);
  }

  function getTotals() {
    const totals = {};
    CATEGORIES.forEach((c) => (totals[c.id] = 0));
    (monthData.expenses || []).forEach((e) => {
      totals[e.category] = (totals[e.category] || 0) + e.amount;
    });
    return totals;
  }

  const totals = getTotals();
  const totalSpent = Object.values(totals).reduce((a, b) => a + b, 0);
  const totalBudget = Object.values(monthData.budgets || {}).reduce((a, b) => a + b, 0);
  const income = monthData.income || 0;
  const available = income - totalSpent;

  const [year, month] = monthKey.split("-").map(Number);
  const monthLabel = `${MONTH_NAMES[month]} ${year}`;

  function prevMonth() {
    const d = new Date(year, month - 1, 1);
    setMonthKey(getMonthKey(d));
  }
  function nextMonth() {
    const d = new Date(year, month + 1, 1);
    setMonthKey(getMonthKey(d));
  }

  return (
    <div style={styles.root}>
      <div style={styles.app}>
        {/* HEADER */}
        <div style={styles.header}>
          <div style={styles.headerTop}>
            <span style={styles.appName}>mis finanzas</span>
            <div style={styles.monthNav}>
              <button style={styles.navBtn} onClick={prevMonth}>‹</button>
              <span style={styles.monthLabel}>{monthLabel}</span>
              <button style={styles.navBtn} onClick={nextMonth}>›</button>
            </div>
          </div>

          <div style={styles.heroRow}>
            <div style={styles.heroCard}>
              <span style={styles.heroCaption}>Ingresos</span>
              <span style={styles.heroAmount}>${income.toLocaleString("es-AR")}</span>
            </div>
            <div style={styles.heroDivider} />
            <div style={styles.heroCard}>
              <span style={styles.heroCaption}>Gastado</span>
              <span style={styles.heroAmount}>${totalSpent.toLocaleString("es-AR")}</span>
            </div>
            <div style={styles.heroDivider} />
            <div style={styles.heroCard}>
              <span style={styles.heroCaption}>Disponible</span>
              <span style={{
                ...styles.heroAmount,
                color: available >= 0 ? "#A0E847" : "#E84747"
              }}>
                ${available.toLocaleString("es-AR")}
              </span>
            </div>
          </div>
        </div>

        {/* NAV */}
        <div style={styles.nav}>
          {[
            { id: "dashboard", label: "Resumen" },
            { id: "add", label: "+ Gasto" },
            { id: "budgets", label: "Límites" },
            { id: "history", label: "Historial" },
          ].map((n) => (
            <button
              key={n.id}
              style={{ ...styles.navItem, ...(view === n.id ? styles.navItemActive : {}) }}
              onClick={() => setView(n.id)}
            >
              {n.label}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div style={styles.content}>
          {view === "dashboard" && <Dashboard categories={CATEGORIES} totals={totals} budgets={monthData.budgets || {}} />}
          {view === "add" && <AddExpense form={form} setForm={setForm} onAdd={addExpense} />}
          {view === "budgets" && <Budgets categories={CATEGORIES} budgets={monthData.budgets || {}} setBudget={setBudget} income={income} setIncome={setIncome} />}
          {view === "history" && <History expenses={monthData.expenses || []} onDelete={deleteExpense} />}
        </div>

        {toast && <div style={styles.toast}>{toast}</div>}
      </div>
    </div>
  );
}

function Dashboard({ categories, totals, budgets }) {
  return (
    <div style={styles.section}>
      {categories.map((cat) => {
        const spent = totals[cat.id] || 0;
        const budget = budgets[cat.id] || 0;
        const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
        const over = budget > 0 && spent > budget;
        return (
          <div key={cat.id} style={styles.catCard}>
            <div style={styles.catHeader}>
              <div style={styles.catLeft}>
                <span style={styles.catIcon}>{cat.icon}</span>
                <span style={styles.catName}>{cat.label}</span>
              </div>
              <div style={styles.catRight}>
                <span style={{ color: over ? "#E84747" : "#fff", fontWeight: 700, fontSize: 15 }}>
                  ${spent.toLocaleString("es-AR")}
                </span>
                {budget > 0 && (
                  <span style={styles.catBudget}> / ${budget.toLocaleString("es-AR")}</span>
                )}
              </div>
            </div>
            {budget > 0 && (
              <div style={styles.barTrack}>
                <div style={{
                  ...styles.barFill,
                  width: `${pct}%`,
                  backgroundColor: over ? "#E84747" : cat.color,
                }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AddExpense({ form, setForm, onAdd }) {
  return (
    <div style={styles.section}>
      <div style={styles.formCard}>
        <label style={styles.label}>Monto</label>
        <input
          style={styles.input}
          type="number"
          inputMode="decimal"
          placeholder="0"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />

        <label style={styles.label}>Categoría</label>
        <div style={styles.catGrid}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              style={{
                ...styles.catPill,
                borderColor: form.category === cat.id ? cat.color : "transparent",
                backgroundColor: form.category === cat.id ? cat.color + "22" : "#1a1a2e",
              }}
              onClick={() => setForm({ ...form, category: cat.id })}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        <label style={styles.label}>Nota (opcional)</label>
        <input
          style={styles.input}
          type="text"
          placeholder="ej: Coto, YPF..."
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
        />

        <button style={styles.primaryBtn} onClick={onAdd}>
          Agregar gasto
        </button>
      </div>
    </div>
  );
}

function Budgets({ categories, budgets, setBudget, income, setIncome }) {
  return (
    <div style={styles.section}>
      <div style={{ ...styles.budgetRow, borderColor: "#E8C547", marginBottom: 6 }}>
        <span style={{ ...styles.budgetLabel, color: "#E8C547", fontWeight: 700 }}>💵 Ingresos del mes</span>
        <input
          style={{ ...styles.budgetInput, color: "#E8C547", borderColor: "#E8C547" }}
          type="number"
          inputMode="decimal"
          placeholder="0"
          value={income || ""}
          onChange={(e) => setIncome(e.target.value)}
        />
      </div>
      <p style={styles.hint}>Límite por categoría</p>
      {categories.map((cat) => (
        <div key={cat.id} style={styles.budgetRow}>
          <span style={styles.budgetLabel}>{cat.icon} {cat.label}</span>
          <input
            style={styles.budgetInput}
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={budgets[cat.id] || ""}
            onChange={(e) => setBudget(cat.id, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}

function History({ expenses, onDelete }) {
  const sorted = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
  if (!sorted.length) return <p style={styles.hint}>Sin gastos este mes.</p>;

  return (
    <div style={styles.section}>
      {sorted.map((e) => {
        const cat = CATEGORIES.find((c) => c.id === e.category);
        const d = new Date(e.date);
        return (
          <div key={e.id} style={styles.expenseRow}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>{cat?.icon}</span>
              <div>
                <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{cat?.label}</div>
                {e.note && <div style={{ color: "#888", fontSize: 12 }}>{e.note}</div>}
                <div style={{ color: "#555", fontSize: 11 }}>{d.toLocaleDateString("es-AR")}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: cat?.color, fontWeight: 700 }}>${e.amount.toLocaleString("es-AR")}</span>
              <button style={styles.deleteBtn} onClick={() => onDelete(e.id)}>✕</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100vh",
    background: "#0a0a14",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    fontFamily: "'DM Mono', 'Courier New', monospace",
  },
  app: {
    width: "100%",
    maxWidth: 420,
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    position: "relative",
  },
  header: {
    background: "linear-gradient(160deg, #12122a 0%, #0a0a14 100%)",
    padding: "24px 20px 16px",
    borderBottom: "1px solid #1e1e3a",
  },
  headerTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  appName: {
    color: "#E8C547",
    fontSize: 13,
    letterSpacing: 3,
    textTransform: "lowercase",
    fontWeight: 700,
  },
  monthNav: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  navBtn: {
    background: "none",
    border: "1px solid #2a2a4a",
    color: "#aaa",
    width: 28,
    height: 28,
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  monthLabel: {
    color: "#ddd",
    fontSize: 13,
    minWidth: 110,
    textAlign: "center",
  },
  heroRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroCard: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  heroDivider: {
    width: 1,
    height: 40,
    background: "#2a2a4a",
  },
  heroCaption: {
    color: "#666",
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroAmount: {
    color: "#fff",
    fontSize: 18,
    fontWeight: 700,
  },
  nav: {
    display: "flex",
    borderBottom: "1px solid #1e1e3a",
    background: "#0d0d1f",
  },
  navItem: {
    flex: 1,
    padding: "12px 4px",
    background: "none",
    border: "none",
    color: "#555",
    fontSize: 11,
    cursor: "pointer",
    letterSpacing: 0.5,
    borderBottom: "2px solid transparent",
    transition: "all 0.2s",
  },
  navItemActive: {
    color: "#E8C547",
    borderBottom: "2px solid #E8C547",
  },
  content: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 16px 32px",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  catCard: {
    background: "#12122a",
    borderRadius: 12,
    padding: "12px 14px",
    border: "1px solid #1e1e3a",
  },
  catHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  catLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  catIcon: { fontSize: 18 },
  catName: { color: "#ccc", fontSize: 13, fontWeight: 500 },
  catRight: { display: "flex", alignItems: "baseline" },
  catBudget: { color: "#444", fontSize: 12 },
  barTrack: {
    height: 4,
    background: "#1e1e3a",
    borderRadius: 2,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 2,
    transition: "width 0.4s ease",
  },
  formCard: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  label: {
    color: "#666",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  input: {
    background: "#12122a",
    border: "1px solid #2a2a4a",
    borderRadius: 10,
    padding: "14px 16px",
    color: "#fff",
    fontSize: 16,
    fontFamily: "inherit",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  catGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  catPill: {
    padding: "10px 8px",
    borderRadius: 8,
    border: "1px solid",
    color: "#ccc",
    fontSize: 12,
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
    transition: "all 0.15s",
  },
  primaryBtn: {
    background: "#E8C547",
    color: "#0a0a14",
    border: "none",
    borderRadius: 12,
    padding: "16px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: 1,
    marginTop: 4,
  },
  budgetRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#12122a",
    borderRadius: 10,
    padding: "12px 14px",
    border: "1px solid #1e1e3a",
  },
  budgetLabel: { color: "#ccc", fontSize: 13 },
  budgetInput: {
    background: "#0a0a14",
    border: "1px solid #2a2a4a",
    borderRadius: 8,
    padding: "8px 12px",
    color: "#E8C547",
    fontSize: 14,
    fontFamily: "inherit",
    width: 110,
    textAlign: "right",
    outline: "none",
  },
  expenseRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#12122a",
    borderRadius: 10,
    padding: "12px 14px",
    border: "1px solid #1e1e3a",
  },
  deleteBtn: {
    background: "none",
    border: "1px solid #2a2a4a",
    color: "#555",
    borderRadius: 6,
    width: 26,
    height: 26,
    cursor: "pointer",
    fontSize: 11,
  },
  hint: {
    color: "#555",
    fontSize: 13,
    textAlign: "center",
    padding: "20px 0",
  },
  toast: {
    position: "fixed",
    bottom: 32,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#A0E847",
    color: "#0a0a14",
    padding: "10px 20px",
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 700,
    fontFamily: "'DM Mono', monospace",
    zIndex: 999,
  },
};
