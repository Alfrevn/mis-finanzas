import { useState } from "react";

const FRASES = [
  "Somos los favoritos del universo",
  "Prueba 2",
  "Prueba 3",
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

// prorrated: varianza diaria activa | false: solo límite vs acumulado
// isSavings: lógica especial — acumula, no se gasta, viaja entre períodos
const CATEGORIES = [
  { id: "supermercado", label: "Supermercado",       icon: "🛒", color: "#818cf8", prorrated: true,  isSavings: false },
  { id: "salidas",      label: "Salidas",            icon: "🎉", color: "#a78bfa", prorrated: true,  isSavings: false },
  { id: "higiene",      label: "Higiene & Limpieza", icon: "🧼", color: "#c084fc", prorrated: true,  isSavings: false },
  { id: "alquiler",     label: "Alquiler",           icon: "🏠", color: "#60a5fa", prorrated: false, isSavings: false },
  { id: "servicios",    label: "Servicios",          icon: "⚡", color: "#34d399", prorrated: false, isSavings: false },
  { id: "transporte",   label: "Transporte",         icon: "🚌", color: "#f472b6", prorrated: false, isSavings: false },
  { id: "ropo",         label: "Ropo",               icon: "🌿", color: "#4ade80", prorrated: false, isSavings: false },
  { id: "ahorro",       label: "Ahorro",             icon: "🔒", color: "#a78bfa", prorrated: false, isSavings: true  },
];

const PRIORITY_IDS  = ["supermercado", "salidas", "higiene", "ahorro"];
const SECONDARY_IDS = ["alquiler", "servicios", "transporte", "ropo"];

const INCOME_SOURCES = [
  { id: "alfredo",   label: "Sueldo Alfredo",  icon: "👨" },
  { id: "belen",     label: "Sueldo Belén",    icon: "👩" },
  { id: "workshops", label: "Workshops Belén", icon: "🎓" },
  { id: "clases",    label: "Clases Belén",    icon: "📚" },
  { id: "irs_alf",   label: "IRS Alfredo",     icon: "🏛️" },
  { id: "irs_bel",   label: "IRS Belén",       icon: "🏛️" },
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
function toDateStr(d = new Date()) { return d.toISOString().slice(0, 10); }

function calcVariance(budget, startDate, endDate, spent) {
  if (!budget || !startDate || !endDate) return null;
  const start = new Date(startDate); start.setHours(0,0,0,0);
  const end   = new Date(endDate);   end.setHours(0,0,0,0);
  const today = new Date();          today.setHours(0,0,0,0);
  const totalDays  = Math.max(1, Math.round((end - start) / 86400000));
  const daysPassed = Math.max(0, Math.round((today - start) / 86400000) + 1);
  const dailyRate  = budget / totalDays;
  const expected   = Math.round(dailyRate * Math.min(daysPassed, totalDays));
  const variance   = spent - expected;
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

// ─── Carry savings from previous period ──────────────────────────────────────
function getCarriedSavings(data, period) {
  // Walk back up to 24 periods to find accumulated savings
  let total = 0;
  let p = prevPeriod(period);
  for (let i = 0; i < 24; i++) {
    const k = periodKey(p);
    if (k < MIN_PERIOD_KEY) break;
    const md = data[k];
    if (md) {
      const periodSavings = (md.expenses||[])
        .filter(e => e.category === "ahorro")
        .reduce((a,b) => a + b.amount, 0);
      // subtract any savings transfers out
      const transfers = (md.savingsTransfers||[]).reduce((a,b) => a + b.amount, 0);
      total += periodSavings - transfers;
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
  const [transferMode, setTransferMode] = useState(null); // catId being covered

  const key = periodKey(period);
  const md  = data[key] || EMPTY;

  function persist(next) {
    setUndoStack(stack => [...stack.slice(-2), data]);
    setData(next); saveData(next);
  }

  function undo() {
    if (!undoStack.length) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(s => s.slice(0,-1));
    setData(prev); saveData(prev);
    showToast("↩ Acción deshecha","ok");
  }

  function showToast(msg, type="ok") {
    setToast({msg,type});
    setTimeout(()=>setToast(null), 3500);
  }

  function selectCat(catId) {
    setForm(f=>({...f,category:catId}));
    setLastCat(catId);
    try { localStorage.setItem("last_cat", catId); } catch {}
  }

  function getTotals() {
    const t = {};
    CATEGORIES.forEach(c => t[c.id] = 0);
    (md.expenses||[]).forEach(e => { t[e.category] = (t[e.category]||0) + e.amount; });
    return t;
  }

  const totals       = getTotals();
  const carriedSavings = getCarriedSavings(data, period);
  // current period savings = carried + this period's ahorro expenses
  const currentSavings = carriedSavings + (totals["ahorro"] || 0);
  const totalSpent   = Object.values(totals).filter((_,i) => CATEGORIES[i]?.id !== "ahorro").reduce((a,b)=>a+b,0)
    + (totals["ahorro"]||0); // ahorro counts as allocated
  const totalIncome  = Object.values(md.incomes||{}).reduce((a,b)=>a+b,0);
  const available    = totalIncome - Object.values(totals).reduce((a,b)=>a+b,0);
  const totalBudgets = Object.values(md.budgets||{}).reduce((a,b)=>a+b,0);
  const montoRestante = totalIncome - (md.budgets?.["ahorro"]||0) - (totalBudgets - (md.budgets?.["ahorro"]||0)) ;

  const pStart = toDateStr(periodStart(period));
  const pEnd   = toDateStr(periodEnd(period));

  function addFromForm() {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return;
    const expense = { id:Date.now(), amount:amt, category:form.category, note:(form.note||"").trim(), date:form.date||toDateStr() };
    persist({ ...data, [key]: { ...md, expenses:[...(md.expenses||[]), expense] } });
    const budget   = md.budgets?.[form.category]||0;
    const newSpent = (totals[form.category]||0) + amt;
    const cat = CATEGORIES.find(c=>c.id===form.category);
    if (cat?.isSavings) showToast(`💜 +$${amt.toLocaleString("es-AR")} al ahorro`,"good");
    else if (budget>0 && newSpent<=budget) showToast("✓ Dentro del límite 🎯","good");
    else if (budget>0 && newSpent>budget) showToast("⚠️ Superaste el límite","warn");
    else showToast("Gasto registrado ✓","ok");
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

  // Transfer from savings to cover an existing overage — no new expense created,
  // just records a transfer and raises the effective limit for that category
  function coverFromSavings(catId, amount) {
    const amt = parseFloat(amount);
    const spent = totals[catId]||0;
    const budget = md.budgets?.[catId]||0;
    const overage = Math.max(0, spent - budget);
    const toTransfer = Math.min(amt, currentSavings);
    if (!toTransfer || toTransfer <= 0) return;
    // Raise the limit for this category by the transfer amount
    const newBudget = budget + toTransfer;
    // Record a negative ahorro expense (reduces savings this period)
    const savingsExpense = { id:Date.now(), amount:-toTransfer, category:"ahorro", note:`↩ Cubrió ${CATEGORIES.find(c=>c.id===catId)?.label}`, date:toDateStr() };
    persist({
      ...data,
      [key]: {
        ...md,
        budgets: {...(md.budgets||{}), [catId]: newBudget},
        expenses: [...(md.expenses||[]), savingsExpense],
      }
    });
    showToast(`$${toTransfer.toLocaleString("es-AR")} movidos al límite de ${CATEGORIES.find(c=>c.id===catId)?.label}`,"ok");
    setTransferMode(null);
  }

  function doArqueo() {
    let surplus = 0;
    CATEGORIES.filter(c=>!c.isSavings).forEach(cat => {
      const budget = md.budgets?.[cat.id]||0;
      const spent  = totals[cat.id]||0;
      if (budget>0 && spent<budget) surplus += budget-spent;
    });
    if (surplus<=0) { showToast("No hay excedente","warn"); return; }
    const savingsExpense = { id:Date.now(), amount:surplus, category:"ahorro", note:"Arqueo de período", date:toDateStr() };
    persist({ ...data, [key]: { ...md, expenses:[...(md.expenses||[]), savingsExpense] } });
    showToast(`+$${surplus.toLocaleString("es-AR")} al ahorro 🏆`,"good");
  }

  function setIncome(id, val) {
    persist({ ...data, [key]: { ...md, incomes:{...(md.incomes||{}), [id]:parseFloat(val)||0} } });
  }
  function setBudget(id, val) {
    persist({ ...data, [key]: { ...md, budgets:{...(md.budgets||{}), [id]:parseFloat(val)||0} } });
  }

  const priorityCats  = CATEGORIES.filter(c => PRIORITY_IDS.includes(c.id));
  const secondaryCats = CATEGORIES.filter(c => SECONDARY_IDS.includes(c.id));

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
                <span style={S.heroCaption}>ahorro 🔒</span>
                <span style={{...S.heroAmt, color:"#c4b5fd"}}>${currentSavings.toLocaleString("es-AR")}</span>
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
            {/* PRIORITY 2x2 grid for 4 items */}
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:9}}>
              {priorityCats.map(cat => {
                const spent  = totals[cat.id]||0;
                const effectiveSpent = cat.isSavings ? currentSavings : spent;
                const budget = cat.isSavings ? (md.budgets?.["ahorro"]||0) : (md.budgets?.[cat.id]||0);
                const ok     = budget>0 && effectiveSpent<=budget;
                const over   = budget>0 && effectiveSpent>budget;
                const v      = cat.prorrated ? calcVariance(budget, pStart, pEnd, effectiveSpent) : null;
                const sel    = form.category===cat.id;
                return (
                  <button key={cat.id} style={{
                    display:"flex", flexDirection:"column", alignItems:"center",
                    padding:"20px 6px", borderRadius:18, border:"2px solid", cursor:"pointer",
                    borderColor: sel?"#c4b5fd": over?"#f87171": ok?"#4ade80":"#2a3a4a",
                    background:  sel?"#c4b5fd22": over?"#3b091066": ok?"#14532d44":"#1a1a2e",
                    transform: sel?"scale(1.05)":"scale(1)", transition:"all 0.15s",
                  }} onClick={()=>selectCat(cat.id)}>
                    <span style={{fontSize:32}}>{cat.icon}</span>
                    <span style={{color:"#e2e8f0", fontSize:12, marginTop:6, textAlign:"center", fontWeight:700}}>{cat.label}</span>
                    {cat.isSavings && carriedSavings>0 && (
                      <span style={{color:"#7c3aed",fontSize:9,marginTop:2}}>+${carriedSavings.toLocaleString("es-AR")} arrastrado</span>
                    )}
                    {budget>0&&(
                      <span style={{fontSize:10, fontWeight:700, marginTop:3, color:over?"#f87171":ok?"#4ade80":"#94a3b8"}}>
                        ${effectiveSpent.toLocaleString("es-AR")} / ${budget.toLocaleString("es-AR")}
                      </span>
                    )}
                    {v&&(
                      <span style={{fontSize:11,fontWeight:800,marginTop:4,
                        color:v.variance<=0?"#4ade80":"#f87171",
                        background:v.variance<=0?"#14532d66":"#7f1d1d66",
                        borderRadius:6,padding:"2px 8px"}}>
                        {v.variance<=0?`+${Math.abs(v.variance).toLocaleString("es-AR")}` : `-${v.variance.toLocaleString("es-AR")}`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* SECONDARY 4 cols */}
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
                    padding:"8px 3px", borderRadius:10, border:"1px solid", cursor:"pointer",
                    borderColor: sel?"#c4b5fd": over?"#f87171": ok?"#4ade80":"#2a3a4a",
                    background:  sel?"#c4b5fd22": over?"#3b091066": ok?"#14532d44":"#1a1a2e",
                    transform: sel?"scale(1.05)":"scale(1)", transition:"all 0.15s",
                  }} onClick={()=>selectCat(cat.id)}>
                    <span style={{fontSize:17}}>{cat.icon}</span>
                    <span style={{color:"#cbd5e1",fontSize:9,marginTop:3,textAlign:"center"}}>{cat.label}</span>
                    {budget>0&&(
                      <span style={{fontSize:9,fontWeight:700,marginTop:2,color:over?"#f87171":ok?"#4ade80":"#64748b"}}>
                        ${spent.toLocaleString("es-AR")} / ${budget.toLocaleString("es-AR")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <input style={S.bigInput} type="number" inputMode="decimal" placeholder="0"
              value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}
              onKeyDown={e=>{ if(e.key==="Enter") addFromForm(); }}/>
            <input style={S.inputSm} type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
            {!form.showNote
              ? <button style={S.noteToggle} onClick={()=>setForm(f=>({...f,showNote:true}))}>+ agregar nota</button>
              : <input style={S.inputSm} type="text" placeholder="Nota..." value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} autoFocus/>
            }
            <button style={S.primaryBtn} onClick={addFromForm}>👌 Registrar</button>

            {/* ARQUEO + UNDO */}
            <div style={{display:"flex",gap:8,marginTop:2}}>
              <button style={{...S.ghostBtn,flex:1,margin:0,padding:"9px",fontSize:11}} onClick={doArqueo}>📊 Arquear período</button>
              {undoStack.length>0&&(
                <button style={{...S.ghostBtn,flex:1,margin:0,padding:"9px",fontSize:11,color:"#f87171",borderColor:"#f8717166"}} onClick={undo}>↩ Deshacer</button>
              )}
            </div>

            {/* COVER FROM SAVINGS */}
            {currentSavings>0 && CATEGORIES.filter(c=>!c.isSavings).some(c=>(totals[c.id]||0)>(md.budgets?.[c.id]||0) && (md.budgets?.[c.id]||0)>0) && (
              <div style={{...S.catCard,borderColor:"#7c3aed"}}>
                <div style={{color:"#c4b5fd",fontSize:12,fontWeight:700,marginBottom:8}}>💜 Cubrir excedente con ahorro</div>
                {CATEGORIES.filter(c=>!c.isSavings).map(cat=>{
                  const spent = totals[cat.id]||0;
                  const budget = md.budgets?.[cat.id]||0;
                  const over = budget>0 && spent>budget;
                  if (!over) return null;
                  const excess = spent-budget;
                  return (
                    <div key={cat.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <span style={{color:"#e2e8f0",fontSize:12}}>{cat.icon} {cat.label} <span style={{color:"#f87171"}}>+${excess.toLocaleString("es-AR")}</span></span>
                      <button style={{background:"#7c3aed",color:"#fff",border:"none",borderRadius:8,padding:"5px 12px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}
                        onClick={()=>coverFromSavings(cat.id, excess)}>
                        Cubrir ${excess.toLocaleString("es-AR")}
                      </button>
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
              return (
                <div key={cat.id} style={{...S.catCard,...(cat.isSavings?{borderColor:"#7c3aed"}:{})}}>
                  <div style={{...S.catHeader,marginBottom:budget>0?8:0}}>
                    <span style={{...S.rowLabel,...(cat.isSavings?{color:"#c4b5fd"}:{})}}>{cat.icon} {cat.label}</span>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      {v&&<span style={{fontSize:11,fontWeight:800,color:v.variance<=0?"#4ade80":"#f87171"}}>
                        {v.variance<=0?`+${Math.abs(v.variance).toLocaleString("es-AR")}` : `-${v.variance.toLocaleString("es-AR")}`}
                      </span>}
                      <input style={{...S.rowInput,...(cat.isSavings?{color:"#c4b5fd",borderColor:"#7c3aed66"}:{})}}
                        type="number" inputMode="decimal" placeholder="Límite"
                        value={budget||""} onChange={e=>setBudget(cat.id,e.target.value)}/>
                    </div>
                  </div>
                  {budget>0&&(
                    <>
                      <div style={{...S.barTrack,position:"relative"}}>
                        <div style={{...S.barFill,width:`${pct}%`,backgroundColor:over?"#f87171":cat.color}}/>
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

      {/* BOTTOM NAV — 4 tabs, Gastos más ancho */}
      <div style={S.bottomNav}>
        {NAV.map(n=>(
          <button key={n.id} style={{
            ...S.bnItem,
            ...(view===n.id?(n.id==="gastos"?S.bnMainActive:S.bnActive):{}),
            ...(n.id==="gastos"?S.bnMain:{}),
          }} onClick={()=>setView(n.id)}>
            <span style={{fontSize:n.id==="gastos"?28:17}}>{n.icon}</span>
            <span style={{fontSize:n.id==="gastos"?12:9,marginTop:1,fontWeight:n.id==="gastos"?800:400,letterSpacing:n.id==="gastos"?1:0}}>{n.label}</span>
          </button>
        ))}
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
                    defaultValue={e.amount} onBlur={ev=>onUpdate(e.id,"amount",ev.target.value)}/>
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
                  <span style={{color: e.amount<0?"#f87171":cat?.color, fontWeight:700}}>
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
  bigInput:    { background:"#1a1a2e", border:"2px solid #818cf8", borderRadius:14, padding:"13px 16px", color:"#f1f5f9", fontSize:28, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box", textAlign:"center", fontWeight:800 },
  inputSm:     { background:"#1a1a2e", border:"1px solid #334155", borderRadius:10, padding:"10px 13px", color:"#e2e8f0", fontSize:14, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box" },
  noteToggle:  { background:"none", border:"none", color:"#475569", fontSize:12, cursor:"pointer", textAlign:"left", padding:"0 2px", fontFamily:"inherit" },
  primaryBtn:  { background:"#6366f1", color:"#fff", border:"none", borderRadius:12, padding:"13px", fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"inherit", marginTop:4, width:"100%" },
  ghostBtn:    { background:"none", color:"#64748b", border:"1px solid #334155", borderRadius:12, padding:"9px", fontSize:13, cursor:"pointer", fontFamily:"inherit", marginTop:4 },
  bottomNav:   { position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:420, background:"#0a0a14", borderTop:"1px solid #1e2a3a", display:"flex", zIndex:100, paddingBottom:"env(safe-area-inset-bottom)" },
  bnItem:      { flex:1, display:"flex", flexDirection:"column", alignItems:"center", padding:"8px 2px", background:"none", border:"none", color:"#334155", cursor:"pointer", fontSize:9, fontFamily:"inherit" },
  bnActive:    { color:"#818cf8" },
  bnMain:      { flex:1.8, background:"#12122a" },
  bnMainActive:{ color:"#fff", background:"#1e1e3a" },
  editBtn:     { background:"none", border:"1px solid #334155", borderRadius:6, width:28, height:28, cursor:"pointer", fontSize:13 },
  hint:        { color:"#334155", fontSize:13, textAlign:"center", padding:"20px 0" },
  toast:       { position:"fixed", bottom:82, left:"50%", transform:"translateX(-50%)", padding:"14px 28px", borderRadius:24, fontSize:15, fontWeight:800, zIndex:999, whiteSpace:"nowrap", fontFamily:"inherit", boxShadow:"0 4px 24px rgba(0,0,0,0.4)" },
};
