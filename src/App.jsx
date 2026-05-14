import { useState } from "react";

const FRASES = [
  "Somos los favoritos del universo",
  "Todo llega a nuestras vidas con facilidad, gozo y gloria",
  "Esperemos las invitaciones",
  "Te amo pequitas",
  "Vamos excelentemente bien",
  "Momentos \"Love is Blind\"",
  "El guionista está re fumado",
];

function getDailyFrase() {
  const today = new Date().toISOString().slice(0, 10);
  const stored = (() => { try { return JSON.parse(localStorage.getItem("frase_v1") || "{}"); } catch { return {}; } })();
  if (stored.date === today) return stored.frase;
  const seen = stored.seen || [];
  const unseen = FRASES.filter(f => !seen.includes(f));
  const pool = unseen.length > 0 ? unseen : FRASES;
  const frase = pool[Math.floor(Math.random() * pool.length)];
  try { localStorage.setItem("frase_v1", JSON.stringify({ date: today, frase, seen: unseen.length > 0 ? [...seen, frase] : [frase] })); } catch {}
  return frase;
}

const CATEGORIES = [
  { id: "supermercado", label: "Supermercado",       icon: "🛒", color: "#818cf8", prorrated: true,  isSavings: false },
  { id: "salidas",      label: "Salidas",            icon: "🎉", color: "#a78bfa", prorrated: true,  isSavings: false },
  { id: "higiene",      label: "Higiene & Limpieza", icon: "🧼", color: "#c084fc", prorrated: true,  isSavings: false },
  { id: "transporte",   label: "Transporte",         icon: "🚌", color: "#38bdf8", prorrated: true,  isSavings: false },
  { id: "alquiler",     label: "Alquiler",           icon: "🏠", color: "#60a5fa", prorrated: false, isSavings: false },
  { id: "servicios",    label: "Servicios",          icon: "⚡", color: "#34d399", prorrated: false, isSavings: false },
  { id: "ropo",         label: "Ropo",               icon: "🌿", color: "#4ade80", prorrated: false, isSavings: false },
  { id: "ahorro",       label: "Ahorro",             icon: "🔒", color: "#d97706", prorrated: false, isSavings: true  },
];

const PRIORITY_IDS  = ["supermercado", "salidas", "higiene", "transporte"];
const SECONDARY_IDS = ["alquiler", "servicios", "ropo"];

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
  // Use local date to avoid UTC timezone shift (e.g. Lisboa UTC+1 would shift dates back 1 day)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── FÓRMULA CORREGIDA ────────────────────────────────────────────────────────
// totalDays = (endDate - startDate).days  → NO +1, son días de distancia
// daysPassed = (today - startDate).days + 1  → día 1 = el propio startDate
// Ejemplo: start=10/5, end=9/6 → totalDays=30
//          today=14/5 → daysPassed=5
//          dailyRate=180/30=6  → expected=6*5=30
function calcVariance(budget, startDate, endDate, spent) {
  if (!budget || !startDate || !endDate) return null;
  const start = new Date(startDate); start.setHours(0,0,0,0);
  const end   = new Date(endDate);   end.setHours(0,0,0,0);
  const today = new Date();          today.setHours(0,0,0,0);
  if (today < start) return null;
  // Inclusive both endpoints: 10/5 to 9/6 = 31 days, 10/6 to 9/7 = 30 days, etc.
  const totalDays  = Math.max(1, Math.round((end - start) / 86400000) + 1);
  const daysPassed = Math.min(Math.round((today - start) / 86400000) + 1, totalDays);
  const dailyRate  = budget / totalDays;
  const expected   = Math.round(dailyRate * daysPassed);
  const variance   = spent - expected;   // negative = under budget = good
  const daysLeft   = Math.max(0, Math.round((end - today) / 86400000));
  const pctTime    = Math.min((daysPassed / totalDays) * 100, 100);
  return { expected, variance, daysLeft, dailyRate: parseFloat(dailyRate.toFixed(2)), pctTime };
}

function loadData() {
  try { const r = localStorage.getItem("finanzas_v8"); return r ? JSON.parse(r) : {}; }
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
    if (md) {
      (md.expenses||[]).forEach(e => {
        if (e.category === "ahorro") total += e.amount; // negative entries reduce it
      });
    }
    p = prevPeriod(p);
  }
  return Math.max(0, total);
}

export default function App() {
  const [period, setPeriod]   = useState(() => getPeriodForDate());
  const [view, setView]       = useState("gastos");
  const [data, setData]       = useState(loadData);
  const [lastCat, setLastCat] = useState(() => { try { return localStorage.getItem("last_cat") || "supermercado"; } catch { return "supermercado"; } });
  const [form, setForm]       = useState({ amount:"", category:lastCat, note:"", date:toDateStr(), showNote:false });
  const [toast, setToast]     = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [frase]               = useState(getDailyFrase);

  const key = periodKey(period);
  const md  = data[key] || EMPTY;

  function persist(next) {
    setUndoStack(s => [...s.slice(-2), data]);
    setData(next); saveData(next);
  }

  function undo() {
    if (!undoStack.length) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(s => s.slice(0,-1));
    setData(prev); saveData(prev);
    showToast("↩ Acción deshecha", "ok");
  }

  function showToast(msg, type="ok") {
    setToast({msg,type});
    setTimeout(()=>setToast(null), 3500);
  }

  function selectCat(catId) {
    setForm(f=>({...f, category:catId}));
    setLastCat(catId);
    try { localStorage.setItem("last_cat", catId); } catch {}
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
  const totalIncome    = Object.values(md.incomes||{}).reduce((a,b)=>a+b,0);
  const totalSpent     = CATEGORIES.filter(c=>!c.isSavings).reduce((a,c)=>a+(totals[c.id]||0),0);
  const available      = totalIncome - totalSpent - (totals["ahorro"]||0);
  const totalBudgets   = Object.values(md.budgets||{}).reduce((a,b)=>a+b,0);
  const montoRestante  = totalIncome - totalBudgets;

  const pStart = toDateStr(periodStart(period));
  const pEnd   = toDateStr(periodEnd(period));

  function addFromForm() {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return;
    const expense = { id:Date.now(), amount:amt, category:form.category, note:(form.note||"").trim(), date:form.date||toDateStr() };
    persist({ ...data, [key]: { ...md, expenses:[...(md.expenses||[]), expense] } });
    const cat    = CATEGORIES.find(c=>c.id===form.category);
    const budget = md.budgets?.[form.category]||0;
    const newSp  = (totals[form.category]||0) + amt;
    if (cat?.isSavings)            showToast(`💛 +$${amt.toLocaleString("es-AR")} al ahorro`, "good");
    else if (budget>0&&newSp<=budget) showToast("✓ Dentro del límite 🎯", "good");
    else if (budget>0&&newSp>budget)  showToast("⚠️ Superaste el límite", "warn");
    else                           showToast("Gasto registrado ✓", "ok");
    setForm(f=>({...f, amount:"", note:"", date:toDateStr(), showNote:false}));
  }

  function deleteExpense(id) {
    persist({ ...data, [key]: { ...md, expenses:(md.expenses||[]).filter(e=>e.id!==id) } });
  }

  function updateExpense(id, field, value) {
    const expenses = (md.expenses||[]).map(e =>
      e.id===id ? {...e, [field]: field==="amount"?parseFloat(value)||0:value} : e
    );
    persist({ ...data, [key]: { ...md, expenses } });
  }

  // Cover overage: raises the limit for that category, records negative ahorro entry
  function coverFromSavings(catId, excess) {
    const toUse = Math.min(excess, currentSavings);
    if (toUse <= 0) return;
    const newBudget = (md.budgets?.[catId]||0) + toUse;
    const savingsEntry = { id:Date.now(), amount:-toUse, category:"ahorro", note:`↩ Cubrió ${CATEGORIES.find(c=>c.id===catId)?.label}`, date:toDateStr() };
    persist({ ...data, [key]: { ...md, budgets:{...(md.budgets||{}), [catId]:newBudget}, expenses:[...(md.expenses||[]), savingsEntry] } });
    showToast(`$${toUse.toLocaleString("es-AR")} movidos del ahorro`, "ok");
  }

  function doArqueo() {
    let surplus = 0;
    CATEGORIES.filter(c=>!c.isSavings).forEach(cat => {
      const budget = md.budgets?.[cat.id]||0;
      const spent  = totals[cat.id]||0;
      if (budget>0 && spent<budget) surplus += budget-spent;
    });
    if (surplus<=0) { showToast("No hay excedente","warn"); return; }
    const entry = { id:Date.now(), amount:surplus, category:"ahorro", note:"Arqueo de período", date:toDateStr() };
    persist({ ...data, [key]: { ...md, expenses:[...(md.expenses||[]), entry] } });
    showToast(`+$${surplus.toLocaleString("es-AR")} al ahorro 🏆`, "good");
  }

  function setIncome(id, val) {
    persist({ ...data, [key]: { ...md, incomes:{...(md.incomes||{}), [id]:parseFloat(val)||0} } });
  }
  function setBudget(id, val) {
    persist({ ...data, [key]: { ...md, budgets:{...(md.budgets||{}), [id]:parseFloat(val)||0} } });
  }

  const priorityCats  = CATEGORIES.filter(c => PRIORITY_IDS.includes(c.id));
  const secondaryCats = CATEGORIES.filter(c => SECONDARY_IDS.includes(c.id));
  const hasOverages   = CATEGORIES.filter(c=>!c.isSavings).some(c=>(totals[c.id]||0)>(md.budgets?.[c.id]||1e9) && (md.budgets?.[c.id]||0)>0);

  const NAV = [
    { id:"gastos",   icon:"👌", label:"GASTOS"   },
    { id:"limites",  icon:"🎯", label:"Límites"  },
    { id:"ingresos", icon:"💵", label:"Ingresos" },
    { id:"historial",icon:"📋", label:"Historial"},
  ];

  return (
    <div style={S.root}><div style={S.app}>

      {/* HEADER */}
      <div style={S.header}>
        <div style={S.headerTop}>
          <button style={S.navBtn} onClick={()=>{ const p=prevPeriod(period); if(isPeriodAllowed(p)) setPeriod(p); }}>‹</button>
          <div style={S.headerCenter}>
            <span style={S.monthTitle}>{periodLabel(period)}</span>
            <div style={S.heroRow}>
              <div style={S.heroCard}>
                <span style={S.heroCaption}>disponible</span>
                <span style={{...S.heroAmt, color:available>=0?"#a5b4fc":"#f87171"}}>${available.toLocaleString("es-AR")}</span>
              </div>
              <div style={S.heroDivider}/>
              <div style={S.heroCard}>
                <span style={S.heroCaption}>ingresos</span>
                <span style={S.heroAmt}>${totalIncome.toLocaleString("es-AR")}</span>
              </div>
              <div style={S.heroDivider}/>
              <div style={S.heroCard}>
                <span style={S.heroCaption}>gastado</span>
                <span style={{...S.heroAmt, color:"#f87171"}}>${totalSpent.toLocaleString("es-AR")}</span>
              </div>
            </div>
          </div>
          <button style={S.navBtn} onClick={()=>setPeriod(nextPeriod(period))}>›</button>
        </div>
        <div style={S.fraseBox}>
          <span style={S.fraseText}>✨ {frase}</span>
        </div>
      </div>

      {/* CONTENT */}
      <div style={S.content}>

        {/* ── GASTOS ── */}
        {view==="gastos" && (
          <div style={S.section}>

            {/* 4 PRIORITY — 2x2 grid, big */}
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
              {priorityCats.map(cat => {
                const spent  = totals[cat.id]||0;
                const budget = md.budgets?.[cat.id]||0;
                const ok     = budget>0 && spent<=budget;
                const over   = budget>0 && spent>budget;
                const v      = cat.prorrated ? calcVariance(budget, pStart, pEnd, spent) : null;
                const sel    = form.category===cat.id;
                return (
                  <button key={cat.id} style={{
                    display:"flex", flexDirection:"column", alignItems:"center",
                    padding:"22px 6px", borderRadius:20, border:"2px solid", cursor:"pointer",
                    borderColor: sel?"#22d3ee": over?"#f87171": ok?"#4ade80":"#2a3a4a",
                    background:  sel?"#164e6388": over?"#3b091066": ok?"#14532d44":"#1a1a2e",
                    transform: sel?"scale(1.04)":"scale(1)", transition:"all 0.15s",
                  }} onClick={()=>selectCat(cat.id)}>
                    <span style={{fontSize:34}}>{cat.icon}</span>
                    <span style={{color:"#e2e8f0", fontSize:13, marginTop:6, textAlign:"center", fontWeight:700}}>{cat.label}</span>
                    {budget>0&&(
                      <span style={{fontSize:11, fontWeight:700, marginTop:3, color:over?"#f87171":ok?"#4ade80":"#94a3b8"}}>
                        ${spent.toLocaleString("es-AR")} / ${budget.toLocaleString("es-AR")}
                      </span>
                    )}
                    {v&&(
                      <span style={{fontSize:12,fontWeight:800,marginTop:5,
                        color:v.variance<=0?"#4ade80":"#f87171",
                        background:v.variance<=0?"#14532d66":"#7f1d1d66",
                        borderRadius:8,padding:"3px 10px"}}>
                        {v.variance<=0?`+${Math.abs(v.variance).toLocaleString("es-AR")}` : `-${v.variance.toLocaleString("es-AR")}`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* SECONDARY — 4 cols, one row */}
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:5}}>
              {secondaryCats.map(cat => {
                const spent  = totals[cat.id]||0;
                const budget = md.budgets?.[cat.id]||0;
                const ok     = budget>0 && spent<=budget;
                const over   = budget>0 && spent>budget;
                const sel    = form.category===cat.id;
                return (
                  <button key={cat.id} style={{
                    display:"flex", flexDirection:"column", alignItems:"center",
                    padding:"7px 2px", borderRadius:10, border:"1.5px solid", cursor:"pointer",
                    borderColor: sel?"#22d3ee": over?"#f87171": ok?"#4ade80":"#2a3a4a",
                    background:  sel?"#164e6344": over?"#3b091066": ok?"#14532d44":"#1a1a2e",
                    transform: sel?"scale(1.04)":"scale(1)", transition:"all 0.15s",
                  }} onClick={()=>selectCat(cat.id)}>
                    <span style={{fontSize:17}}>{cat.icon}</span>
                    <span style={{color:"#cbd5e1",fontSize:9,marginTop:2,textAlign:"center",fontWeight:600}}>{cat.label}</span>
                    {budget>0&&(
                      <span style={{fontSize:8,fontWeight:700,marginTop:1,color:over?"#f87171":ok?"#4ade80":"#64748b"}}>
                        ${spent.toLocaleString("es-AR")} / ${budget.toLocaleString("es-AR")}
                      </span>
                    )}
                  </button>
                );
              })}
              {/* AHORRO como botón secundario */}
              {(()=>{
                const cat = CATEGORIES.find(c=>c.id==="ahorro");
                const sel = form.category==="ahorro";
                return (
                  <button key="ahorro" style={{
                    display:"flex", flexDirection:"column", alignItems:"center",
                    padding:"7px 2px", borderRadius:10, border:"1.5px solid", cursor:"pointer",
                    borderColor: sel?"#22d3ee":"#92400e",
                    background:  sel?"#164e6344":"#1c150a",
                    transform: sel?"scale(1.04)":"scale(1)", transition:"all 0.15s",
                  }} onClick={()=>selectCat("ahorro")}>
                    <span style={{fontSize:17}}>{cat.icon}</span>
                    <span style={{color:"#fbbf24",fontSize:9,marginTop:2,textAlign:"center",fontWeight:700}}>{cat.label}</span>
                    <span style={{fontSize:8,fontWeight:700,marginTop:1,color:"#d97706"}}>
                      ${currentSavings.toLocaleString("es-AR")}
                    </span>
                  </button>
                );
              })()}
            </div>

            {/* MONTO */}
            <input style={S.bigInput} type="number" inputMode="decimal" placeholder="0"
              value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}
              onKeyDown={e=>{ if(e.key==="Enter") addFromForm(); }}/>
            <input style={S.inputSm} type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
            {!form.showNote
              ? <button style={S.noteToggle} onClick={()=>setForm(f=>({...f,showNote:true}))}>+ agregar nota</button>
              : <input style={S.inputSm} type="text" placeholder="Nota..." value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} autoFocus/>
            }
            <button style={S.primaryBtn} onClick={addFromForm}>👌 Registrar</button>

            <div style={{display:"flex",gap:8,marginTop:2}}>
              <button style={{...S.ghostBtn,flex:1,margin:0,padding:"9px",fontSize:11}} onClick={doArqueo}>📊 Arquear período</button>
              {undoStack.length>0&&(
                <button style={{...S.ghostBtn,flex:1,margin:0,padding:"9px",fontSize:11,color:"#f87171",borderColor:"#f8717166"}} onClick={undo}>↩ Deshacer</button>
              )}
            </div>

            {/* CUBRIR EXCEDENTES CON AHORRO */}
            {currentSavings>0 && hasOverages && (
              <div style={{...S.catCard,borderColor:"#92400e",background:"#1c150a"}}>
                <div style={{color:"#fbbf24",fontSize:12,fontWeight:700,marginBottom:8}}>💛 Cubrir excedente con ahorro</div>
                {CATEGORIES.filter(c=>!c.isSavings).map(cat=>{
                  const spent = totals[cat.id]||0;
                  const budget = md.budgets?.[cat.id]||0;
                  if (!(budget>0 && spent>budget)) return null;
                  const excess = spent-budget;
                  return (
                    <div key={cat.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <span style={{color:"#e2e8f0",fontSize:12}}>{cat.icon} {cat.label} <span style={{color:"#f87171"}}>+${excess.toLocaleString("es-AR")}</span></span>
                      <button style={{background:"#d97706",color:"#fff",border:"none",borderRadius:8,padding:"5px 12px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}
                        onClick={()=>coverFromSavings(cat.id, excess)}>Cubrir</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── LÍMITES ── */}
        {view==="limites" && (
          <div style={S.section}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <p style={{...S.sectionTitle,margin:0}}>LÍMITES · {periodLabel(period)}</p>
              <div style={{textAlign:"right"}}>
                <span style={{color:"#475569",fontSize:9,textTransform:"uppercase",letterSpacing:1}}>monto restante</span>
                <div style={{color:montoRestante>=0?"#4ade80":"#f87171",fontSize:15,fontWeight:800}}>
                  ${montoRestante.toLocaleString("es-AR")}
                </div>
              </div>
            </div>
            {CATEGORIES.map(cat=>{
              const spent  = cat.isSavings ? currentSavings : (totals[cat.id]||0);
              const budget = md.budgets?.[cat.id]||0;
              const over   = budget>0 && spent>budget;
              const pct    = budget>0 ? Math.min((spent/budget)*100,100) : 0;
              const v      = cat.prorrated ? calcVariance(budget, pStart, pEnd, spent) : null;
              const isSav  = cat.isSavings;
              return (
                <div key={cat.id} style={{...S.catCard,...(isSav?{borderColor:"#92400e",background:"#1c150a"}:{})}}>
                  <div style={{...S.catHeader,marginBottom:budget>0?8:0}}>
                    <span style={{...S.rowLabel,...(isSav?{color:"#fbbf24"}:{})}}>{cat.icon} {cat.label}</span>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      {v&&<span style={{fontSize:11,fontWeight:800,color:v.variance<=0?"#4ade80":"#f87171"}}>
                        {v.variance<=0?`+${Math.abs(v.variance).toLocaleString("es-AR")}` : `-${v.variance.toLocaleString("es-AR")}`}
                      </span>}
                      <input style={{...S.rowInput,...(isSav?{color:"#fbbf24",borderColor:"#92400e"}:{})}}
                        type="number" inputMode="decimal" placeholder="Límite"
                        value={budget||""} onChange={e=>setBudget(cat.id,e.target.value)}/>
                    </div>
                  </div>
                  {budget>0&&(
                    <>
                      <div style={{...S.barTrack,position:"relative"}}>
                        <div style={{...S.barFill,width:`${pct}%`,backgroundColor:over?"#f87171":isSav?"#d97706":cat.color}}/>
                        {v&&v.pctTime>0&&<div style={{position:"absolute",top:0,bottom:0,left:`${v.pctTime}%`,width:2,backgroundColor:"rgba(255,255,255,0.3)"}}/>}
                      </div>
                      {v&&<div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                        <span style={S.metaText}>${v.dailyRate}/día</span>
                        <span style={S.metaText}>Esp: ${v.expected.toLocaleString("es-AR")} · {v.daysLeft}d</span>
                      </div>}
                      {!v&&<div style={{marginTop:4}}>
                        <span style={{...S.metaText,color:over?"#f87171":"#64748b"}}>
                          {over?`Excedente: $${(spent-budget).toLocaleString("es-AR")}`:`Restante: $${(budget-spent).toLocaleString("es-AR")}`}
                        </span>
                      </div>}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── INGRESOS ── */}
        {view==="ingresos" && (
          <div style={S.section}>
            <p style={S.sectionTitle}>INGRESOS · {periodLabel(period)}</p>
            {INCOME_SOURCES.map(src=>(
              <div key={src.id} style={S.row}>
                <span style={S.rowLabel}>{src.icon} {src.label}</span>
                <input style={S.rowInput} type="number" inputMode="decimal" placeholder="0"
                  value={md.incomes?.[src.id]||""} onChange={e=>setIncome(src.id,e.target.value)}/>
              </div>
            ))}
            <div style={{...S.row,borderColor:"#818cf8"}}>
              <span style={{...S.rowLabel,color:"#818cf8",fontWeight:700}}>Total</span>
              <span style={{color:"#818cf8",fontWeight:700,fontSize:16}}>${totalIncome.toLocaleString("es-AR")}</span>
            </div>
          </div>
        )}

        {/* ── HISTORIAL ── */}
        {view==="historial" && (
          <History expenses={md.expenses||[]} onDelete={deleteExpense} onUpdate={updateExpense}/>
        )}
      </div>

      {/* BOTTOM NAV — 4 tabs */}
      <div style={S.bottomNav}>
        {NAV.map(n=>{
          const active = view===n.id;
          const isMain = n.id==="gastos";
          return (
            <button key={n.id} style={{
              ...S.bnItem,
              ...(isMain?S.bnMain:{}),
              color: active?"#22d3ee":"#475569",
              borderTop: active?"2px solid #22d3ee":"2px solid transparent",
              background: "transparent",
            }} onClick={()=>setView(n.id)}>
              <span style={{fontSize:isMain?28:17,transition:"all 0.15s"}}>{n.icon}</span>
              <span style={{fontSize:isMain?12:9,marginTop:1,fontWeight:active?800:400,letterSpacing:isMain?1:0}}>{n.label}</span>
            </button>
          );
        })}
      </div>

      {toast&&(
        <div style={{...S.toast,
          background:toast.type==="good"?"#4ade80":toast.type==="warn"?"#fb923c":"#818cf8",
          color:toast.type==="good"?"#052e16":"#fff",
        }}>{toast.msg}</div>
      )}
    </div></div>
  );
}

function History({ expenses, onDelete, onUpdate }) {
  const [editId, setEditId] = useState(null);
  const sorted = [...expenses].sort((a,b)=>new Date(b.date)-new Date(a.date));
  if (!sorted.length) return <p style={S.hint}>Sin gastos este período.</p>;
  return (
    <div style={S.section}>
      <p style={S.sectionTitle}>HISTORIAL</p>
      {sorted.map(e=>{
        const cat = CATEGORIES.find(c=>c.id===e.category);
        const isEditing = editId===e.id;
        return (
          <div key={e.id} style={S.catCard}>
            {isEditing?(
              <>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:18}}>{cat?.icon}</span>
                  <input style={{...S.inputSm,flex:1}} type="number"
                    defaultValue={Math.abs(e.amount)} onBlur={ev=>onUpdate(e.id,"amount",ev.target.value)}/>
                </div>
                <input style={{...S.inputSm,marginTop:6}} type="date"
                  defaultValue={e.date?.slice(0,10)} onBlur={ev=>onUpdate(e.id,"date",ev.target.value)}/>
                <input style={{...S.inputSm,marginTop:6}} type="text"
                  defaultValue={e.note} placeholder="Nota" onBlur={ev=>onUpdate(e.id,"note",ev.target.value)}/>
                <div style={{display:"flex",gap:8,marginTop:8}}>
                  <button style={{...S.primaryBtn,flex:1,padding:"10px",marginTop:0}} onClick={()=>setEditId(null)}>Listo</button>
                  <button style={{background:"none",color:"#f87171",border:"1px solid #f8717166",borderRadius:12,flex:1,padding:"10px",cursor:"pointer",fontFamily:"inherit",fontSize:13}}
                    onClick={()=>{onDelete(e.id);setEditId(null);}}>Borrar</button>
                </div>
              </>
            ):(
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:20}}>{cat?.icon}</span>
                  <div>
                    <div style={{color:"#f1f5f9",fontWeight:600,fontSize:14}}>{cat?.label}</div>
                    {e.note&&<div style={{color:"#64748b",fontSize:12}}>{e.note}</div>}
                    <div style={{color:"#334155",fontSize:11}}>{e.date?.slice(0,10)}</div>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{color:e.amount<0?"#f87171":cat?.color,fontWeight:700}}>
                    {e.amount<0?"-":"+"}${Math.abs(e.amount||0).toLocaleString("es-AR")}
                  </span>
                  <button style={S.editBtn} onClick={()=>setEditId(e.id)}>✏️</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const S = {
  root:        { minHeight:"100vh", background:"#0f0f1a", display:"flex", justifyContent:"center", fontFamily:"'Nunito','Segoe UI',sans-serif" },
  app:         { width:"100%", maxWidth:420, minHeight:"100vh", display:"flex", flexDirection:"column", paddingBottom:72 },
  header:      { background:"linear-gradient(160deg,#1a1a2e 0%,#0f0f1a 100%)", padding:"14px 16px 10px", borderBottom:"1px solid #1e2a3a" },
  headerTop:   { display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 },
  headerCenter:{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:6 },
  monthTitle:  { color:"#f1f5f9", fontSize:20, fontWeight:900, letterSpacing:3 },
  navBtn:      { background:"none", border:"1px solid #334155", color:"#94a3b8", width:30, height:30, borderRadius:8, cursor:"pointer", fontSize:18, flexShrink:0 },
  heroRow:     { display:"flex", justifyContent:"center", alignItems:"center", width:"100%" },
  heroCard:    { flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 },
  heroDivider: { width:1, height:32, background:"#1e2a3a" },
  heroCaption: { color:"#475569", fontSize:9, letterSpacing:1, textTransform:"uppercase" },
  heroAmt:     { color:"#f1f5f9", fontSize:16, fontWeight:800 },
  fraseBox:    { marginTop:8, padding:"7px 12px", background:"#1e2a3a", borderRadius:10, textAlign:"center" },
  fraseText:   { color:"#a5f3fc", fontSize:12, fontStyle:"italic", fontFamily:"Georgia,serif", letterSpacing:0.3 },
  content:     { flex:1, overflowY:"auto", padding:"12px 12px 8px" },
  section:     { display:"flex", flexDirection:"column", gap:9 },
  sectionTitle:{ color:"#475569", fontSize:10, letterSpacing:2, textTransform:"uppercase", margin:"2px 0" },
  catCard:     { background:"#1a1a2e", borderRadius:12, padding:"11px 13px", border:"1px solid #1e2a3a" },
  catHeader:   { display:"flex", justifyContent:"space-between", alignItems:"center" },
  barTrack:    { height:5, background:"#1e2a3a", borderRadius:2, overflow:"hidden" },
  barFill:     { height:"100%", borderRadius:2, transition:"width 0.4s ease" },
  metaText:    { color:"#334155", fontSize:10 },
  row:         { display:"flex", alignItems:"center", justifyContent:"space-between", background:"#1a1a2e", borderRadius:10, padding:"11px 13px", border:"1px solid #1e2a3a" },
  rowLabel:    { color:"#cbd5e1", fontSize:13, fontWeight:500 },
  rowInput:    { background:"#0f0f1a", border:"1px solid #334155", borderRadius:8, padding:"7px 11px", color:"#818cf8", fontSize:14, fontFamily:"inherit", width:110, textAlign:"right", outline:"none" },
  bigInput:    { background:"#1a1a2e", border:"2px solid #22d3ee", borderRadius:14, padding:"13px 16px", color:"#f1f5f9", fontSize:28, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box", textAlign:"center", fontWeight:800 },
  inputSm:     { background:"#1a1a2e", border:"1px solid #334155", borderRadius:10, padding:"10px 13px", color:"#e2e8f0", fontSize:14, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box" },
  noteToggle:  { background:"none", border:"none", color:"#475569", fontSize:12, cursor:"pointer", textAlign:"left", padding:"0 2px", fontFamily:"inherit" },
  primaryBtn:  { background:"#0891b2", color:"#fff", border:"none", borderRadius:12, padding:"13px", fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"inherit", marginTop:4, width:"100%" },
  ghostBtn:    { background:"none", color:"#64748b", border:"1px solid #334155", borderRadius:12, padding:"9px", fontSize:13, cursor:"pointer", fontFamily:"inherit", marginTop:4 },
  bottomNav:   { position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:420, background:"#0a0a14", borderTop:"1px solid #1e2a3a", display:"flex", zIndex:100, paddingBottom:"env(safe-area-inset-bottom)" },
  bnItem:      { flex:1, display:"flex", flexDirection:"column", alignItems:"center", padding:"8px 2px", background:"none", border:"none", cursor:"pointer", fontSize:9, fontFamily:"inherit", borderTop:"2px solid transparent", transition:"all 0.15s" },
  bnMain:      { flex:1.8 },
  editBtn:     { background:"none", border:"1px solid #334155", borderRadius:6, width:28, height:28, cursor:"pointer", fontSize:13 },
  hint:        { color:"#334155", fontSize:13, textAlign:"center", padding:"20px 0" },
  toast:       { position:"fixed", bottom:82, left:"50%", transform:"translateX(-50%)", padding:"14px 28px", borderRadius:24, fontSize:15, fontWeight:800, zIndex:999, whiteSpace:"nowrap", fontFamily:"inherit", boxShadow:"0 4px 24px rgba(0,0,0,0.4)" },
};
