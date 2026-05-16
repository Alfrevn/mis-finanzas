import { useState, useRef, Component } from "react";

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{background:"#0f0f1a",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,gap:16}}>
        <div style={{fontSize:40}}>💥</div>
        <div style={{color:"#f87171",fontWeight:800,fontSize:16,textAlign:"center"}}>Algo salió mal</div>
        <div style={{color:"#64748b",fontSize:12,textAlign:"center",maxWidth:280}}>{this.state.error?.message}</div>
        <button style={{background:"#22d3ee",color:"#0f0f1a",border:"none",borderRadius:12,padding:"12px 24px",fontSize:14,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}
          onClick={()=>{
            try {
              const raw = localStorage.getItem("finanzas_v8") || "{}";
              const blob = new Blob([raw], {type:"application/json"});
              const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
              a.download = `finanzas_backup_${new Date().toISOString().slice(0,10)}.json`; a.click();
            } catch(e) { alert("No se pudo exportar: "+e.message); }
          }}>
          💾 Descargar mis datos antes de cerrar
        </button>
        <button style={{background:"transparent",color:"#475569",border:"1px solid #2a3a4a",borderRadius:12,padding:"10px 24px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}
          onClick={()=>this.setState({error:null})}>
          Intentar de nuevo
        </button>
      </div>
    );
    return this.props.children;
  }
}


const CATEGORIES = [
  { id: "supermercado", label: "Supermercado",       icon: "🛒", color: "#818cf8", prorrated: true,  isSavings: false },
  { id: "salidas",      label: "Gustos",             icon: "🎉", color: "#a78bfa", prorrated: true,  isSavings: false },
  { id: "higiene",      label: "Higiene & Limpieza", icon: "🧼", color: "#c084fc", prorrated: true,  isSavings: false },
  { id: "transporte",   label: "Transporte",         icon: "🚌", color: "#38bdf8", prorrated: true,  isSavings: false },
  { id: "alquiler",     label: "Alquiler",           icon: "🏠", color: "#60a5fa", prorrated: false, isSavings: false },
  { id: "servicios",    label: "Servicios",          icon: "⚡", color: "#34d399", prorrated: false, isSavings: false },
  { id: "ropo",         label: "Ropo",               icon: "🌿", color: "#4ade80", prorrated: false, isSavings: false },
  { id: "ahorro",       label: "Ahorro",             icon: "🔒", color: "#d97706", prorrated: false, isSavings: true  },
];

const SPEND_CATS = CATEGORIES.filter(c => !c.isSavings);

const INCOME_SOURCES = [
  { id: "alfredo",   label: "Sueldo Alfredo",  icon: "👨" },
  { id: "belen",     label: "Sueldo Belén",    icon: "👩" },
  { id: "workshops", label: "Workshops Belén", icon: "🎓" },
  { id: "clases",    label: "Clases Belén",    icon: "📚" },
  { id: "otros",     label: "Otros",           icon: "💼" },
];

const MONTH_NAMES = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO","JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"];
const MIN_PERIOD_KEY = "2026-4";

function getPeriodForDate(d = new Date()) {
  const day = d.getDate(), year = d.getFullYear(), month = d.getMonth();
  if (day >= 10) return { startYear: year, startMonth: month };
  const prev = new Date(year, month - 1, 10);
  return { startYear: prev.getFullYear(), startMonth: prev.getMonth() };
}
function periodKey(p)   { return `${p.startYear}-${p.startMonth}`; }
function periodStart(p) { return new Date(p.startYear, p.startMonth, 10); }
function periodEnd(p)   { return new Date(p.startYear, p.startMonth + 1, 9); }
function periodLabel(p) { return MONTH_NAMES[p.startMonth]; }
function prevPeriod(p)  { const d = new Date(p.startYear, p.startMonth - 1, 10); return { startYear: d.getFullYear(), startMonth: d.getMonth() }; }
function nextPeriod(p)  { const d = new Date(p.startYear, p.startMonth + 1, 10); return { startYear: d.getFullYear(), startMonth: d.getMonth() }; }
function isPeriodAllowed(p) { return periodKey(p) >= MIN_PERIOD_KEY; }

function toDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function calcVariance(budget, startDate, endDate, spent) {
  if (!budget || !startDate || !endDate) return null;
  const start = new Date(startDate); start.setHours(0,0,0,0);
  const end   = new Date(endDate);   end.setHours(0,0,0,0);
  const today = new Date();          today.setHours(0,0,0,0);
  if (today < start) return null;
  const totalDays  = Math.max(1, Math.round((end - start) / 86400000) + 1);
  const daysPassed = Math.min(Math.round((today - start) / 86400000) + 1, totalDays);
  const dailyRate  = budget / totalDays;
  const expected   = Math.round(dailyRate * daysPassed);
  const variance   = spent - expected;
  const daysLeft   = Math.max(0, Math.round((end - today) / 86400000));
  const pctTime    = Math.min((daysPassed / totalDays) * 100, 100);
  return { expected, variance, daysLeft, dailyRate: parseFloat(dailyRate.toFixed(2)), pctTime };
}

function sanitizeData(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  Object.entries(raw).forEach(([pkey, pdata]) => {
    if (!pdata || typeof pdata !== "object") return;
    const incomes = {};
    Object.entries(pdata.incomes||{}).forEach(([k,v]) => { incomes[k] = Number(v)||0; });
    const budgets = {};
    Object.entries(pdata.budgets||{}).forEach(([k,v]) => { budgets[k] = Number(v)||0; });
    const expenses = (pdata.expenses||[]).map(e => ({...e, amount: Number(e.amount)||0}));
    out[pkey] = { ...pdata, incomes, budgets, expenses };
  });
  return out;
}

function loadData() {
  try {
    const r = localStorage.getItem("finanzas_v8");
    if (!r) return {};
    const parsed = JSON.parse(r);
    const clean = sanitizeData(parsed);
    // si hubo diferencias, re-guardar ya saneado
    if (JSON.stringify(parsed) !== JSON.stringify(clean)) {
      localStorage.setItem("finanzas_v8", JSON.stringify(clean));
    }
    return clean;
  }
  catch { return {}; }
}
function saveData(d) { try { localStorage.setItem("finanzas_v8", JSON.stringify(d)); } catch {} }

const EMPTY = { budgets:{}, expenses:[], incomes:{} };

function getCarriedSavings(data, period) {
  let total = 0;
  let p = prevPeriod(period);
  for (let i = 0; i < 24; i++) {
    const k = periodKey(p);
    if (k < MIN_PERIOD_KEY) break;
    const md = data[k];
    if (md) (md.expenses||[]).forEach(e => { if (e.category === "ahorro") total += e.amount; });
    p = prevPeriod(p);
  }
  return Math.max(0, total);
}

function fmtARS(v) { return (Number(v)||0).toLocaleString("es-AR"); }

export default function AppRoot() {
  return <ErrorBoundary><App/></ErrorBoundary>;
}

function App() {
  const [period, setPeriod]     = useState(() => getPeriodForDate());
  const [view, setView]         = useState("gastos");
  const [data, setData]         = useState(loadData);
  const [lastCat, setLastCat]   = useState(() => { try { return localStorage.getItem("last_cat") || "supermercado"; } catch { return "supermercado"; } });
  const [form, setForm]         = useState({ amount:"", category:lastCat, note:"", date:toDateStr(), showNote:false });
  const [toast, setToast]       = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [flashCat, setFlashCat] = useState(null);
  const amountInputRef = useRef(null);

  const key = periodKey(period);
  const md  = data[key] || EMPTY;

  function exportData() {
    try {
      const raw = localStorage.getItem("finanzas_v8") || "{}";
      const blob = new Blob([raw], {type:"application/json"});
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `finanzas_backup_${new Date().toISOString().slice(0,10)}.json`; a.click();
      showToast("💾 Backup descargado","good");
    } catch { showToast("Error al exportar","warn"); }
  }

  function importData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const clean = sanitizeData(parsed);
        saveData(clean); setData(clean);
        showToast("✅ Datos restaurados","good");
        setShowDebug(false);
      } catch { showToast("Archivo inválido","warn"); }
    };
    reader.readAsText(file);
  }

  function persist(updater) {
    setData(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const clean = sanitizeData(next);
      setUndoStack(s => [...s.slice(-2), prev]);
      saveData(clean);
      return clean;
    });
  }
  function undo() {
    if (!undoStack.length) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(s => s.slice(0,-1));
    setData(prev); saveData(prev);
    showToast("↩ Acción deshecha", "ok");
  }
  function showToast(msg, type="ok") {
    setToast({msg,type}); setTimeout(()=>setToast(null), 3500);
  }
  function selectCat(catId) {
    setForm(f=>({...f, category:catId}));
    setLastCat(catId);
    try { localStorage.setItem("last_cat", catId); } catch {}
    setTimeout(() => { amountInputRef.current?.focus(); }, 50);
  }

  function getTotals() {
    const t = {};
    CATEGORIES.forEach(c => t[c.id] = 0);
    (md.expenses||[]).forEach(e => { t[e.category] = (t[e.category]||0) + e.amount; });
    return t;
  }

  const totals         = getTotals();
  const carriedSavings = getCarriedSavings(data, period);
  const currentSavings = carriedSavings + (totals["ahorro"]||0);
  const totalIncome    = Object.values(md.incomes||{}).reduce((a,b)=>a+(Number(b)||0),0);
  const totalSpent     = SPEND_CATS.reduce((a,c)=>a+(totals[c.id]||0),0);
  const available      = totalIncome - totalSpent - (totals["ahorro"]||0);
  const totalBudgets   = Object.values(md.budgets||{}).reduce((a,b)=>a+(Number(b)||0),0);
  const montoRestante  = totalIncome - totalBudgets - currentSavings;

  const pStart = toDateStr(periodStart(period));
  const pEnd   = toDateStr(periodEnd(period));

  function addFromForm() {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return;
    const expense = { id:Date.now(), amount:amt, category:form.category, note:(form.note||"").trim(), date:form.date||toDateStr() };
    persist({ ...data, [key]: { ...md, expenses:[...(md.expenses||[]), expense] } });
    const budget = md.budgets?.[form.category]||0;
    const newSp  = (totals[form.category]||0) + amt;
    if (budget>0&&newSp<=budget)   showToast("✓ Dentro del límite 🎯","good");
    else if (budget>0&&newSp>budget) showToast("⚠️ Superaste el límite","warn");
    else                           showToast("Gasto registrado ✓","ok");
    setFlashCat(form.category);
    setTimeout(() => setFlashCat(null), 600);
    setForm(f=>({...f, amount:"", note:"", date:toDateStr(), showNote:false}));
    setTimeout(() => { amountInputRef.current?.focus(); }, 80);
  }

  function deleteExpense(id) {
    persist({ ...data, [key]: { ...md, expenses:(md.expenses||[]).filter(e=>e.id!==id) } });
  }
  function updateExpense(id, field, value) {
    const expenses = (md.expenses||[]).map(e => e.id===id ? {...e, [field]: field==="amount"?parseFloat(value)||0:value} : e);
    persist({ ...data, [key]: { ...md, expenses } });
  }
  function addSavings(amt) {
    const entry = { id:Date.now(), amount:amt, category:"ahorro", note:"Ahorro", date:toDateStr() };
    persist({ ...data, [key]: { ...md, expenses:[...(md.expenses||[]), entry] } });
    showToast(`💛 +$${fmtARS(amt)} al ahorro`,"good");
  }
  function editSavings(newTotal) {
    const diff = newTotal - currentSavings;
    const entry = { id:Date.now(), amount:diff, category:"ahorro", note:"Ajuste manual", date:toDateStr() };
    persist({ ...data, [key]: { ...md, expenses:[...(md.expenses||[]), entry] } });
    showToast("Ahorro actualizado ✓","good");
  }
  function doArqueo() {
    let surplus = 0;
    SPEND_CATS.forEach(cat => {
      const budget = md.budgets?.[cat.id]||0;
      const spent  = totals[cat.id]||0;
      if (budget>0 && spent<budget) surplus += budget-spent;
    });
    if (surplus<=0) { showToast("No hay excedente","warn"); return; }
    const entry = { id:Date.now(), amount:surplus, category:"ahorro", note:"Arqueo de período", date:toDateStr() };
    persist({ ...data, [key]: { ...md, expenses:[...(md.expenses||[]), entry] } });
    showToast(`+$${fmtARS(surplus)} al ahorro 🏆`,"good");
  }
  function coverFromSavings(catId, excess) {
    const toUse = Math.min(excess, currentSavings);
    if (toUse<=0) return;
    const newBudget = (md.budgets?.[catId]||0) + toUse;
    const entry = { id:Date.now(), amount:-toUse, category:"ahorro", note:`↩ Cubrió ${CATEGORIES.find(c=>c.id===catId)?.label}`, date:toDateStr() };
    persist({ ...data, [key]: { ...md, budgets:{...(md.budgets||{}), [catId]:newBudget}, expenses:[...(md.expenses||[]), entry] } });
    showToast(`$${fmtARS(toUse)} movidos del ahorro`,"ok");
  }
  function setIncome(id, val) {
    persist({ ...data, [key]: { ...md, incomes:{...(md.incomes||{}), [id]:parseFloat(val)||0} } });
  }
  function setBudget(id, val) {
    persist({ ...data, [key]: { ...md, budgets:{...(md.budgets||{}), [id]:parseFloat(val)||0} } });
  }

  const [showDebug, setShowDebug] = useState(false);
  const debugRaw = (() => { try { return localStorage.getItem("finanzas_v8") || "vacío"; } catch { return "error"; } })();

  const NAV = [
    { id:"gastos",   icon:"👌", label:"GASTOS"   },
    { id:"limites",  icon:"🎯", label:"Límites"  },
    { id:"ingresos", icon:"💵", label:"Ingresos" },
    { id:"historial",icon:"📋", label:"Historial"},
  ];

  function CatBtn({ cat, size="md" }) {
    const spent  = totals[cat.id]||0;
    const budget = md.budgets?.[cat.id]||0;
    const ok     = budget>0 && spent<=budget;
    const over   = budget>0 && spent>budget;
    const v      = cat.prorrated ? calcVariance(budget, pStart, pEnd, spent) : null;
    const sel    = form.category===cat.id;

    if (size==="xl") return (
      <button style={{
        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
        padding:"32px 24px", borderRadius:20, border:"2px solid", cursor:"pointer",
        width:"100%", boxSizing:"border-box",
        borderColor: sel?"#22d3ee": over?"#f87171": ok?"#4ade80":"#2a3a4a",
        background:  sel?"#164e6388": over?"#3b091066": ok?"#14532d44":"#1a1a2e",
        transition:"all 0.15s",
      }} onClick={()=>selectCat(cat.id)}>
        <span style={{fontSize:42}}>{cat.icon}</span>
        <div style={{color:"#e2e8f0",fontSize:17,fontWeight:800,marginTop:8}}>{cat.label}</div>
        {budget>0&&<div style={{fontSize:12,fontWeight:700,marginTop:3,color:over?"#f87171":ok?"#4ade80":"#94a3b8"}}>
          ${fmtARS(spent)} / ${fmtARS(budget)}
        </div>}
        {v&&<span style={{fontSize:15,fontWeight:800,marginTop:6,color:v.variance<=0?"#4ade80":"#f87171",background:v.variance<=0?"#14532d66":"#7f1d1d66",borderRadius:10,padding:"5px 14px"}}>
          {v.variance<=0?`+${fmtARS(Math.abs(v.variance))}` : `-${fmtARS(v.variance)}`}
        </span>}
      </button>
    );

    if (size==="lg") return (
      <button style={{
        display:"flex", flexDirection:"column", alignItems:"center",
        padding:"12px 6px", borderRadius:18, border:"2px solid", cursor:"pointer",
        borderColor: sel?"#22d3ee": over?"#f87171": ok?"#4ade80":"#2a3a4a",
        background:  sel?"#164e6388": over?"#3b091066": ok?"#14532d44":"#1a1a2e",
        transition:"all 0.15s",
      }} onClick={()=>selectCat(cat.id)}>
        <span style={{fontSize:30}}>{cat.icon}</span>
        <span style={{color:"#e2e8f0",fontSize:13,marginTop:5,textAlign:"center",fontWeight:700}}>{cat.label}</span>
        {budget>0&&<span style={{fontSize:11,fontWeight:700,marginTop:3,color:over?"#f87171":ok?"#4ade80":"#94a3b8"}}>
          ${fmtARS(spent)} / ${fmtARS(budget)}
        </span>}
        {v&&<span style={{fontSize:12,fontWeight:800,marginTop:4,color:v.variance<=0?"#4ade80":"#f87171",background:v.variance<=0?"#14532d66":"#7f1d1d66",borderRadius:8,padding:"3px 10px"}}>
          {v.variance<=0?`+${fmtARS(Math.abs(v.variance))}` : `-${fmtARS(v.variance)}`}
        </span>}
      </button>
    );

    return (
      <button style={{
        display:"flex", flexDirection:"column", alignItems:"center",
        padding:"7px 2px", borderRadius:10, border:"1.5px solid", cursor:"pointer",
        borderColor: sel?"#22d3ee": over?"#f87171": ok?"#4ade80":"#2a3a4a",
        background:  sel?"#164e6344": over?"#3b091066": ok?"#14532d44":"#1a1a2e",
        transition:"all 0.15s",
      }} onClick={()=>selectCat(cat.id)}>
        <span style={{fontSize:17}}>{cat.icon}</span>
        <span style={{color:"#cbd5e1",fontSize:9,marginTop:2,textAlign:"center",fontWeight:600}}>{cat.label}</span>
        {budget>0&&<span style={{fontSize:8,fontWeight:700,marginTop:1,color:over?"#f87171":ok?"#4ade80":"#64748b"}}>
          ${fmtARS(spent)} / ${fmtARS(budget)}
        </span>}
      </button>
    );
  }

  const today = new Date(); today.setHours(0,0,0,0);
  const pEndDate = new Date(periodEnd(period)); pEndDate.setHours(0,0,0,0);
  const daysLeftPeriod = Math.max(0, Math.round((pEndDate - today) / 86400000));

  return (
    <div style={S.root}><div style={S.app}>

      <div style={S.header}>
        <div style={S.headerTop}>
          <button style={S.navBtn} onClick={()=>{ const p=prevPeriod(period); if(isPeriodAllowed(p)) setPeriod(p); }}>‹</button>
          <div style={S.headerCenter}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={S.monthTitle} onLongPress={()=>setShowDebug(true)} onClick={()=>{}} onDoubleClick={()=>setShowDebug(true)}>{periodLabel(period)}</span>
              <span style={{
                background: daysLeftPeriod<=5?"#7f1d1d":daysLeftPeriod<=10?"#78350f":"#1e3a2e",
                color:      daysLeftPeriod<=5?"#fca5a5":daysLeftPeriod<=10?"#fcd34d":"#86efac",
                fontSize:10, fontWeight:800, borderRadius:8, padding:"3px 8px", letterSpacing:0.5
              }}>{daysLeftPeriod}d</span>
            </div>
            <div style={S.heroRow}>
              <div style={S.heroCard}>
                <span style={S.heroCaption}>disponible</span>
                <span style={{...S.heroAmt,color:available>=0?"#a5b4fc":"#f87171"}}>${fmtARS(available)}</span>
              </div>
              <div style={S.heroDivider}/>
              <div style={S.heroCard}>
                <span style={S.heroCaption}>ingresos</span>
                <span style={S.heroAmt}>${fmtARS(totalIncome)}</span>
              </div>
              <div style={S.heroDivider}/>
              <div style={S.heroCard}>
                <span style={S.heroCaption}>gastado</span>
                <span style={{...S.heroAmt,color:"#f87171"}}>${fmtARS(totalSpent)}</span>
              </div>
            </div>
          </div>
          <button style={S.navBtn} onClick={()=>setPeriod(nextPeriod(period))}>›</button>
        </div>
      </div>

      <div style={S.content}>

        {view==="gastos" && (
          <div style={S.section}>
            <CatBtn cat={CATEGORIES.find(c=>c.id==="supermercado")} size="xl"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <CatBtn cat={CATEGORIES.find(c=>c.id==="salidas")} size="lg"/>
              <CatBtn cat={CATEGORIES.find(c=>c.id==="higiene")} size="lg"/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:5}}>
              {["transporte","alquiler","servicios","ropo"].map(id=>(
                <CatBtn key={id} cat={CATEGORIES.find(c=>c
