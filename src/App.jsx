import { useState, useEffect } from "react";

// Categorías prioritarias (visibles siempre) vs secundarias (colapsadas)
const PRIORITY_CATS = ["supermercado", "salidas", "higiene", "ahorro"];
const SECONDARY_CATS = ["fijos", "variables", "ropa", "ropo"];

const CATEGORIES = [
  { id: "supermercado", label: "Supermercado",      icon: "🛒", color: "#a78bfa" },
  { id: "salidas",      label: "Salidas",           icon: "🎉", color: "#8b5cf6" },
  { id: "higiene",      label: "Higiene & Limpieza",icon: "🧼", color: "#7c3aed" },
  { id: "ahorro",       label: "Ahorro",            icon: "💰", color: "#c4b5fd" },
  { id: "fijos",        label: "Fijos",             icon: "🏠", color: "#6d28d9" },
  { id: "variables",    label: "Variables",         icon: "⚡", color: "#5b21b6" },
  { id: "ropa",         label: "Ropa",              icon: "👗", color: "#4c1d95" },
  { id: "ropo",         label: "Ropo",              icon: "🌿", color: "#3b0764" },
];

const INCOME_SOURCES = [
  { id: "alfredo",   label: "Sueldo Alfredo",  icon: "👨" },
  { id: "belen",     label: "Sueldo Belén",    icon: "👩" },
  { id: "workshops", label: "Workshops Belén", icon: "🎓" },
  { id: "clases",    label: "Clases Belén",    icon: "📚" },
  { id: "irs_alf",   label: "IRS Alfredo",     icon: "🏛️" },
  { id: "irs_bel",   label: "IRS Belén",       icon: "🏛️" },
];

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function toDateStr(d = new Date()) { return d.toISOString().slice(0,10); }
function getMonthKey(d = new Date()) { return `${d.getFullYear()}-${d.getMonth()}`; }

function loadData() {
  try { const r = localStorage.getItem("finanzas_v4"); return r ? JSON.parse(r) : {}; }
  catch { return {}; }
}
function saveData(d) { try { localStorage.setItem("finanzas_v4", JSON.stringify(d)); } catch {} }

const EMPTY = { budgets:{}, expenses:[], incomes:{}, startDates:{}, endDates:{} };

function calcVariance(budget, startStr, endStr, spent) {
  if (!budget || !startStr || !endStr) return null;
  const start  = new Date(startStr);
  const end    = new Date(endStr);
  const today  = new Date(); today.setHours(0,0,0,0);
  const totalDays  = Math.max(1, Math.round((end - start) / 86400000));
  const daysPassed = Math.max(0, Math.round((today - start) / 86400000) + 1);
  if (daysPassed < 0) return null;
  const dailyRate = budget / totalDays;
  const expected  = Math.round(dailyRate * Math.min(daysPassed, totalDays));
  const variance  = spent - expected;
  const daysLeft  = Math.max(0, Math.round((end - today) / 86400000));
  const pctTime   = Math.min((daysPassed / totalDays) * 100, 100);
  return { expected, variance, daysLeft, dailyRate: parseFloat(dailyRate.toFixed(2)), pctTime };
}

export default function App() {
  const now = new Date();
  const [view, setView]         = useState("add");
  const [data, setData]         = useState(loadData);
  const [monthKey, setMonthKey] = useState(getMonthKey(now));
  const [quickCat, setQuickCat] = useState(null); // for quick-add flow
  const [quickAmt, setQuickAmt] = useState("");
  const [quickNote, setQuickNote] = useState("");
  const [quickDate, setQuickDate] = useState(toDateStr());
  const [showSecondary, setShowSecondary] = useState(false);
  const [toast, setToast]       = useState(null);
  const [form, setForm]         = useState({ amount:"", category:CATEGORIES[0].id, note:"", date:toDateStr() });

  const md = data[monthKey] || EMPTY;

  function persist(next) { setData(next); saveData(next); }
  function showToast(msg, type="ok") { setToast({msg,type}); setTimeout(()=>setToast(null), 2500); }

  function addExpense(cat, amount, note, date) {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return false;
    const expense = { id:Date.now(), amount:amt, category:cat, note:(note||"").trim(), date: date||toDateStr() };
    persist({ ...data, [monthKey]: { ...md, expenses:[...(md.expenses||[]), expense] } });
    const budget = md.budgets?.[cat] || 0;
    const newSpent = getTotals()[cat] + amt;
    if (budget > 0 && newSpent <= budget) {
      showToast("✓ Dentro del límite 🎯", "good");
    } else if (budget > 0 && newSpent > budget) {
      showToast("⚠️ Superaste el límite", "warn");
    } else {
      showToast("Gasto registrado ✓", "ok");
    }
    return true;
  }

  function quickAdd() {
    if (addExpense(quickCat, quickAmt, quickNote, quickDate)) {
      setQuickCat(null); setQuickAmt(""); setQuickNote(""); setQuickDate(toDateStr());
    }
  }

  function addFromForm() {
    if (addExpense(form.category, form.amount, form.note, form.date)) {
      setForm({ amount:"", category:CATEGORIES[0].id, note:"", date:toDateStr() });
      setView("home");
    }
  }

  function deleteExpense(id) {
    persist({ ...data, [monthKey]: { ...md, expenses:(md.expenses||[]).filter(e=>e.id!==id) } });
  }

  function updateExpense(id, field, value) {
    const expenses = (md.expenses||[]).map(e =>
      e.id===id ? {...e, [field]: field==="amount" ? parseFloat(value)||0 : value} : e
    );
    persist({ ...data, [monthKey]: { ...md, expenses } });
  }

  function setIncome(id, val) {
    persist({ ...data, [monthKey]: { ...md, incomes:{...(md.incomes||{}), [id]:parseFloat(val)||0} } });
  }
  function setBudget(id, val) {
    persist({ ...data, [monthKey]: { ...md, budgets:{...(md.budgets||{}), [id]:parseFloat(val)||0} } });
  }
  function setStartDate(id, val) {
    persist({ ...data, [monthKey]: { ...md, startDates:{...(md.startDates||{}), [id]:val} } });
  }
  function setEndDate(id, val) {
    persist({ ...data, [monthKey]: { ...md, endDates:{...(md.endDates||{}), [id]:val} } });
  }

  function getTotals() {
    const t = {};
    CATEGORIES.forEach(c => t[c.id] = 0);
    (md.expenses||[]).forEach(e => { t[e.category] = (t[e.category]||0) + e.amount; });
    return t;
  }

  const totals      = getTotals();
  const totalSpent  = Object.values(totals).reduce((a,b)=>a+b,0);
  const totalIncome = Object.values(md.incomes||{}).reduce((a,b)=>a+b,0);
  const available   = totalIncome - totalSpent;
  const savings     = totals["ahorro"] || 0;

  const [year, month] = monthKey.split("-").map(Number);
  function prevMonth() { setMonthKey(getMonthKey(new Date(year,month-1,1))); }
  function nextMonth() { setMonthKey(getMonthKey(new Date(year,month+1,1))); }

  const priorityCats   = CATEGORIES.filter(c => PRIORITY_CATS.includes(c.id));
  const secondaryCats  = CATEGORIES.filter(c => SECONDARY_CATS.includes(c.id));

  const NAV = [
    { id:"home",     icon:"⚡", label:"Inicio"   },
    { id:"add",      icon:"＋", label:"Cargar"   },
    { id:"ingresos", icon:"💵", label:"Ingresos" },
    { id:"limits",   icon:"🎯", label:"Límites"  },
    { id:"history",  icon:"📋", label:"Historial"},
  ];

  return (
    <div style={S.root}><div style={S.app}>

      {/* HEADER */}
      <div style={S.header}>
        <div style={S.headerTop}>
          <div style={S.monthNav}>
            <button style={S.navBtn} onClick={prevMonth}>‹</button>
            <span style={S.monthLabel}>{MONTHS[month]} {year}</span>
            <button style={S.navBtn} onClick={nextMonth}>›</button>
          </div>
          <div style={S.heroNumbers}>
            <div style={S.heroChip}>
              <span style={S.chipLabel}>disponible</span>
              <span style={{...S.chipAmt, color: available>=0?"#a78bfa":"#f87171"}}>
                ${available.toLocaleString("es-AR")}
              </span>
            </div>
          </div>
        </div>

        {/* SAVINGS TROPHY — dopamine trigger */}
        {savings > 0 && (
          <div style={S.savingsBanner}>
            <span style={{fontSize:20}}>🏆</span>
            <span style={{color:"#fff", fontSize:13, fontWeight:700}}>
              Ya ahorraron ${savings.toLocaleString("es-AR")} este mes
            </span>
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div style={S.content}>

        {/* HOME */}
        {view==="home" && (
          <div style={S.section}>

            {/* QUICK ADD — categorías prioritarias como botones grandes */}
            {!quickCat ? (
              <>
                <p style={S.sectionTitle}>¿Qué gastaron?</p>
                <div style={S.quickGrid}>
                  {priorityCats.map(cat => {
                    const spent  = totals[cat.id]||0;
                    const budget = md.budgets?.[cat.id]||0;
                    const ok     = budget>0 && spent<=budget;
                    const over   = budget>0 && spent>budget;
                    const v      = calcVariance(budget, md.startDates?.[cat.id], md.endDates?.[cat.id], spent);
                    return (
                      <button key={cat.id} style={{
                        ...S.quickBtn,
                        borderColor: over?"#f87171": ok?"#4ade80":"#2a2a4a",
                        background: over?"#3b091055": ok?"#14532d33":"#12122a",
                      }} onClick={()=>{ setQuickCat(cat.id); setQuickDate(toDateStr()); }}>
                        <span style={{fontSize:28}}>{cat.icon}</span>
                        <span style={{color:"#ccc", fontSize:12, marginTop:4}}>{cat.label}</span>
                        {budget>0 && (
                          <span style={{
                            fontSize:11, fontWeight:700, marginTop:2,
                            color: over?"#f87171": ok?"#4ade80":"#888"
                          }}>
                            ${spent.toLocaleString("es-AR")} / ${budget.toLocaleString("es-AR")}
                          </span>
                        )}
                        {v && (
                          <span style={{
                            fontSize:12, fontWeight:700, marginTop:4,
                            color: v.variance<=0?"#4ade80":"#f87171",
                            background: v.variance<=0?"#14532d55":"#7f1d1d55",
                            borderRadius:6, padding:"2px 8px",
                          }}>
                            {v.variance<=0 ? `+${Math.abs(v.variance).toLocaleString("es-AR")}` : `-${v.variance.toLocaleString("es-AR")}`}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* SECONDARY CATS */}
                <button style={S.toggleBtn} onClick={()=>setShowSecondary(s=>!s)}>
                  {showSecondary ? "▲ Ocultar categorías" : "▼ Otras categorías"}
                </button>

                {showSecondary && (
                  <div style={{display:"flex", flexDirection:"column", gap:8}}>
                    {secondaryCats.map(cat => {
                      const spent  = totals[cat.id]||0;
                      const budget = md.budgets?.[cat.id]||0;
                      return (
                        <button key={cat.id} style={{...S.secBtn}} onClick={()=>{ setQuickCat(cat.id); setQuickDate(toDateStr()); }}>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <span style={{fontSize:20}}>{cat.icon}</span>
                            <span style={{color:"#ccc",fontSize:13}}>{cat.label}</span>
                          </div>
                          <span style={{color:cat.color,fontWeight:700,fontSize:13}}>
                            ${spent.toLocaleString("es-AR")}{budget>0?` / $${budget.toLocaleString("es-AR")}`:``}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* RESUMEN RÁPIDO */}
                <div style={S.summaryRow}>
                  <div style={S.summaryChip}><span style={S.chipLabel}>ingresos</span><span style={S.chipVal}>${totalIncome.toLocaleString("es-AR")}</span></div>
                  <div style={S.summaryChip}><span style={S.chipLabel}>gastado</span><span style={S.chipVal}>${totalSpent.toLocaleString("es-AR")}</span></div>
                </div>
              </>
            ) : (
              /* QUICK AMOUNT INPUT */
              <QuickInput
                cat={CATEGORIES.find(c=>c.id===quickCat)}
                amount={quickAmt} setAmount={setQuickAmt}
                note={quickNote} setNote={setQuickNote}
                date={quickDate} setDate={setQuickDate}
                onAdd={quickAdd}
                onCancel={()=>{ setQuickCat(null); setQuickAmt(""); setQuickNote(""); setQuickDate(toDateStr()); }}
              />
            )}
          </div>
        )}

        {/* ADD (full form) */}
        {view==="add" && (
          <div style={S.section}>
            {!form.category ? null : (
              <>
                {/* PRIORITY CATS — 3 columnas medianas */}
                <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6}}>
                  {CATEGORIES.filter(c=>PRIORITY_CATS.includes(c.id) && c.id!=="ahorro").map(cat => {
                    const spent  = totals[cat.id]||0;
                    const budget = md.budgets?.[cat.id]||0;
                    const ok     = budget>0 && spent<=budget;
                    const over   = budget>0 && spent>budget;
                    const v      = calcVariance(budget, md.startDates?.[cat.id], md.endDates?.[cat.id], spent);
                    const selected = form.category===cat.id;
                    return (
                      <button key={cat.id} style={{
                        display:"flex", flexDirection:"column", alignItems:"center",
                        padding:"10px 4px", borderRadius:12, border:"1px solid", cursor:"pointer",
                        borderColor: selected?cat.color: over?"#f87171": ok?"#4ade80":"#2a2a4a",
                        background: selected?cat.color+"33": over?"#3b091055": ok?"#14532d33":"#12122a",
                        transform: selected?"scale(1.03)":"scale(1)",
                        transition:"all 0.15s",
                      }} onClick={()=>setForm({...form,category:cat.id})}>
                        <span style={{fontSize:20}}>{cat.icon}</span>
                        <span style={{color:"#ccc", fontSize:10, marginTop:3, textAlign:"center"}}>{cat.label}</span>
                        {budget>0 && (
                          <span style={{fontSize:9, fontWeight:700, marginTop:2, color: over?"#f87171": ok?"#4ade80":"#888"}}>
                            ${spent.toLocaleString("es-AR")} / ${budget.toLocaleString("es-AR")}
                          </span>
                        )}
                        {v && (
                          <span style={{fontSize:10, fontWeight:700, marginTop:2, color:v.variance<=0?"#4ade80":"#f87171"}}>
                            {v.variance<=0?`+${Math.abs(v.variance).toLocaleString("es-AR")}` : `-${v.variance.toLocaleString("es-AR")}`}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* SECONDARY CATS — 4 columnas pequeñas */}
                <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:5}}>
                  {[...CATEGORIES.filter(c=>c.id==="ahorro"), ...CATEGORIES.filter(c=>SECONDARY_CATS.includes(c.id))].map(cat => {
                    const spent  = totals[cat.id]||0;
                    const budget = md.budgets?.[cat.id]||0;
                    const ok     = budget>0 && spent<=budget;
                    const over   = budget>0 && spent>budget;
                    const v      = calcVariance(budget, md.startDates?.[cat.id], md.endDates?.[cat.id], spent);
                    const selected = form.category===cat.id;
                    return (
                      <button key={cat.id} style={{
                        display:"flex", flexDirection:"column", alignItems:"center",
                        padding:"7px 3px", borderRadius:10, border:"1px solid", cursor:"pointer",
                        borderColor: selected?cat.color: over?"#f87171": ok?"#4ade80":"#2a2a4a",
                        background: selected?cat.color+"33": over?"#3b091055": ok?"#14532d33":"#12122a",
                        transform: selected?"scale(1.03)":"scale(1)",
                        transition:"all 0.15s",
                      }} onClick={()=>setForm({...form,category:cat.id})}>
                        <span style={{fontSize:16}}>{cat.icon}</span>
                        <span style={{color:"#ccc", fontSize:9, marginTop:2, textAlign:"center"}}>{cat.label}</span>
                        {v && (
                          <span style={{fontSize:9, fontWeight:700, marginTop:1, color:v.variance<=0?"#4ade80":"#f87171"}}>
                            {v.variance<=0?`+${Math.abs(v.variance).toLocaleString("es-AR")}` : `-${v.variance.toLocaleString("es-AR")}`}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* MONTO */}
                <input style={S.bigInput} type="number" inputMode="decimal" placeholder="0"
                  value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}
                  onKeyDown={e=>{ if(e.key==="Enter") addFromForm(); }}/>
                <input style={S.input} type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
                <input style={S.input} type="text" placeholder="Nota (opcional)"
                  value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/>
                <button style={S.primaryBtn} onClick={addFromForm}>Registrar</button>
              </>
            )}
          </div>
        )}

        {/* INGRESOS */}
        {view==="ingresos" && (
          <Incomes sources={INCOME_SOURCES} incomes={md.incomes||{}} setIncome={setIncome} total={totalIncome}/>
        )}

        {/* LÍMITES */}
        {view==="limits" && (
          <Limits
            categories={CATEGORIES} budgets={md.budgets||{}} setBudget={setBudget}
            startDates={md.startDates||{}} setStartDate={setStartDate}
            endDates={md.endDates||{}} setEndDate={setEndDate}
            totals={totals}
          />
        )}

        {/* HISTORIAL */}
        {view==="history" && (
          <History expenses={md.expenses||[]} onDelete={deleteExpense} onUpdate={updateExpense}/>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div style={S.bottomNav}>
        {NAV.map(n=>(
          <button key={n.id} style={{...S.bnItem,...(view===n.id?S.bnActive:{})}} onClick={()=>{ setQuickCat(null); setView(n.id); }}>
            <span style={{fontSize:18}}>{n.icon}</span>
            <span style={{fontSize:9, marginTop:2}}>{n.label}</span>
          </button>
        ))}
      </div>

      {/* TOAST */}
      {toast && (
        <div style={{
          ...S.toast,
          background: toast.type==="good"?"#4ade80": toast.type==="warn"?"#f87171":"#a78bfa",
          color: toast.type==="good"?"#052e16": toast.type==="warn"?"#fff":"#0a0a14",
        }}>
          {toast.msg}
        </div>
      )}
    </div></div>
  );
}

// --- QUICK INPUT ---
function QuickInput({ cat, amount, setAmount, note, setNote, date, setDate, onAdd, onCancel }) {
  useEffect(() => {
    const el = document.getElementById("quickamt");
    if (el) el.focus();
  }, []);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <span style={{fontSize:36}}>{cat?.icon}</span>
        <span style={{color:"#fff",fontSize:20,fontWeight:700}}>{cat?.label}</span>
      </div>

      <input
        id="quickamt"
        style={{...S.bigInput}}
        type="number" inputMode="decimal" placeholder="0"
        value={amount} onChange={e=>setAmount(e.target.value)}
        onKeyDown={e=>{ if(e.key==="Enter") onAdd(); }}
      />

      <input style={S.input} type="date" value={date} onChange={e=>setDate(e.target.value)}/>
      <input style={S.input} type="text" placeholder="Nota (opcional)" value={note} onChange={e=>setNote(e.target.value)}/>

      <button style={S.primaryBtn} onClick={onAdd}>Registrar</button>
      <button style={S.ghostBtn} onClick={onCancel}>Cancelar</button>
    </div>
  );
}

// --- ADD (full form) ---
function AddExpense({ form, setForm, onAdd }) {
  return (
    <div style={S.section}><div style={S.formCard}>
      <label style={S.label}>Monto</label>
      <input style={S.input} type="number" inputMode="decimal" placeholder="0"
        value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/>
      <label style={S.label}>Fecha</label>
      <input style={S.input} type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
      <label style={S.label}>Categoría</label>
      <div style={S.catGrid}>
        {CATEGORIES.map(cat=>(
          <button key={cat.id} style={{
            ...S.catPill,
            borderColor: form.category===cat.id?cat.color:"transparent",
            backgroundColor: form.category===cat.id?cat.color+"33":"#1a1a2e",
          }} onClick={()=>setForm({...form,category:cat.id})}>
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>
      <label style={S.label}>Nota (opcional)</label>
      <input style={S.input} type="text" placeholder="ej: Coto, YPF..."
        value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/>
      <button style={S.primaryBtn} onClick={onAdd}>Agregar</button>
    </div></div>
  );
}

// --- INCOMES ---
function Incomes({ sources, incomes, setIncome, total }) {
  return (
    <div style={S.section}>
      <p style={S.sectionTitle}>Ingresos del mes</p>
      {sources.map(src=>(
        <div key={src.id} style={S.row}>
          <span style={S.rowLabel}>{src.icon} {src.label}</span>
          <input style={S.rowInput} type="number" inputMode="decimal" placeholder="0"
            value={incomes[src.id]||""} onChange={e=>setIncome(src.id,e.target.value)}/>
        </div>
      ))}
      <div style={{...S.row,borderColor:"#a78bfa"}}>
        <span style={{...S.rowLabel,color:"#a78bfa",fontWeight:700}}>Total</span>
        <span style={{color:"#a78bfa",fontWeight:700,fontSize:16}}>${total.toLocaleString("es-AR")}</span>
      </div>
    </div>
  );
}

// --- LIMITS ---
function Limits({ categories, budgets, setBudget, startDates, setStartDate, endDates, setEndDate, totals }) {
  return (
    <div style={S.section}>
      <p style={S.sectionTitle}>Límites por categoría</p>
      {categories.map(cat=>{
        const spent = totals[cat.id]||0;
        const budget = budgets[cat.id]||0;
        const v = calcVariance(budget, startDates[cat.id], endDates[cat.id], spent);
        const over = budget>0 && spent>budget;
        const pct = budget>0 ? Math.min((spent/budget)*100,100) : 0;
        return (
          <div key={cat.id} style={S.catCard}>
            <div style={{...S.catHeader,marginBottom:budget>0?10:0}}>
              <span style={S.rowLabel}>{cat.icon} {cat.label}</span>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                {v && (
                  <span style={{fontSize:11,fontWeight:700,color:v.variance<=0?"#4ade80":"#f87171"}}>
                    {v.variance<=0?`+${Math.abs(v.variance).toLocaleString("es-AR")}` : `-${v.variance.toLocaleString("es-AR")}`}
                  </span>
                )}
                <input style={S.rowInput} type="number" inputMode="decimal" placeholder="Límite"
                  value={budget||""} onChange={e=>setBudget(cat.id,e.target.value)}/>
              </div>
            </div>
            {budget>0 && (
              <>
                <div style={{...S.barTrack,marginBottom:8}}>
                  <div style={{...S.barFill,width:`${pct}%`,backgroundColor:over?"#f87171":cat.color}}/>
                  {v && v.pctTime>0 && <div style={{position:"absolute",top:0,bottom:0,left:`${v.pctTime}%`,width:2,backgroundColor:"rgba(255,255,255,0.4)"}}/>}
                </div>
                <div style={{display:"flex",gap:8}}>
                  <div style={{flex:1}}>
                    <div style={S.metaText}>Inicio</div>
                    <input type="date" style={S.dateInput} value={startDates[cat.id]||""} onChange={e=>setStartDate(cat.id,e.target.value)}/>
                  </div>
                  <div style={{flex:1}}>
                    <div style={S.metaText}>Fin</div>
                    <input type="date" style={S.dateInput} value={endDates[cat.id]||""} onChange={e=>setEndDate(cat.id,e.target.value)}/>
                  </div>
                </div>
                {v && (
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
                    <span style={S.metaText}>${v.dailyRate}/día</span>
                    <span style={S.metaText}>Esperado: ${v.expected.toLocaleString("es-AR")} · {v.daysLeft}d restantes</span>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- HISTORY ---
function History({ expenses, onDelete, onUpdate }) {
  const [editId, setEditId] = useState(null);
  const sorted = [...expenses].sort((a,b)=>new Date(b.date)-new Date(a.date));
  if (!sorted.length) return <p style={S.hint}>Sin gastos este mes.</p>;
  return (
    <div style={S.section}>
      <p style={S.sectionTitle}>Historial</p>
      {sorted.map(e=>{
        const cat = CATEGORIES.find(c=>c.id===e.category);
        const isEditing = editId===e.id;
        return (
          <div key={e.id} style={S.catCard}>
            {isEditing ? (
              <>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:18}}>{cat?.icon}</span>
                  <input style={{...S.input,flex:1,padding:"8px 10px",fontSize:13}} type="number"
                    defaultValue={e.amount} onBlur={ev=>onUpdate(e.id,"amount",ev.target.value)}/>
                </div>
                <input style={{...S.input,padding:"8px 10px",fontSize:12,marginTop:8}} type="date"
                  defaultValue={e.date.slice(0,10)} onBlur={ev=>onUpdate(e.id,"date",ev.target.value)}/>
                <input style={{...S.input,padding:"8px 10px",fontSize:12,marginTop:8}} type="text"
                  defaultValue={e.note} placeholder="Nota" onBlur={ev=>onUpdate(e.id,"note",ev.target.value)}/>
                <div style={{display:"flex",gap:8,marginTop:8}}>
                  <button style={{...S.primaryBtn,flex:1,padding:"10px",marginTop:0}} onClick={()=>setEditId(null)}>Listo</button>
                  <button style={{...S.ghostBtn,flex:1,padding:"10px",marginTop:0,color:"#f87171",borderColor:"#f87171"}} onClick={()=>{onDelete(e.id);setEditId(null);}}>Borrar</button>
                </div>
              </>
            ) : (
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:20}}>{cat?.icon}</span>
                  <div>
                    <div style={{color:"#fff",fontWeight:600,fontSize:14}}>{cat?.label}</div>
                    {e.note&&<div style={{color:"#888",fontSize:12}}>{e.note}</div>}
                    <div style={{color:"#555",fontSize:11}}>{e.date.slice(0,10)}</div>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{color:cat?.color,fontWeight:700}}>${(e.amount||0).toLocaleString("es-AR")}</span>
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
  root:         { minHeight:"100vh", background:"#0a0a14", display:"flex", justifyContent:"center", fontFamily:"'DM Mono','Courier New',monospace" },
  app:          { width:"100%", maxWidth:420, minHeight:"100vh", display:"flex", flexDirection:"column", paddingBottom:70 },
  header:       { background:"linear-gradient(160deg,#12122a 0%,#0a0a14 100%)", padding:"16px 20px 12px", borderBottom:"1px solid #1e1e3a" },
  headerTop:    { display:"flex", justifyContent:"space-between", alignItems:"center" },
  monthNav:     { display:"flex", alignItems:"center", gap:8 },
  navBtn:       { background:"none", border:"1px solid #2a2a4a", color:"#aaa", width:28, height:28, borderRadius:6, cursor:"pointer", fontSize:16 },
  monthLabel:   { color:"#ddd", fontSize:13, minWidth:100, textAlign:"center" },
  heroNumbers:  { display:"flex", gap:8 },
  heroChip:     { display:"flex", flexDirection:"column", alignItems:"flex-end" },
  chipLabel:    { color:"#555", fontSize:9, letterSpacing:1, textTransform:"uppercase" },
  chipAmt:      { color:"#fff", fontSize:20, fontWeight:700, lineHeight:1.2 },
  chipVal:      { color:"#ccc", fontSize:15, fontWeight:700 },
  savingsBanner:{ display:"flex", alignItems:"center", gap:10, marginTop:12, background:"#1e1a3a", borderRadius:10, padding:"10px 14px" },
  content:      { flex:1, overflowY:"auto", padding:"16px 16px 8px" },
  section:      { display:"flex", flexDirection:"column", gap:12 },
  sectionTitle: { color:"#666", fontSize:11, letterSpacing:2, textTransform:"uppercase", margin:"4px 0" },
  quickGrid:    { display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 },
  quickBtn:     { display:"flex", flexDirection:"column", alignItems:"center", padding:"16px 8px", borderRadius:14, border:"1px solid", cursor:"pointer", background:"#12122a", transition:"all 0.15s" },
  secBtn:       { display:"flex", justifyContent:"space-between", alignItems:"center", background:"#12122a", borderRadius:10, padding:"12px 14px", border:"1px solid #1e1e3a", cursor:"pointer" },
  toggleBtn:    { background:"none", border:"none", color:"#555", fontSize:11, cursor:"pointer", letterSpacing:1, padding:"4px 0" },
  summaryRow:   { display:"flex", gap:10, marginTop:4 },
  summaryChip:  { flex:1, background:"#12122a", borderRadius:10, padding:"10px 14px", border:"1px solid #1e1e3a", display:"flex", flexDirection:"column", gap:2 },
  bigInput:     { background:"#12122a", border:"2px solid #a78bfa", borderRadius:14, padding:"20px 16px", color:"#fff", fontSize:32, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box", textAlign:"center" },
  catCard:      { background:"#12122a", borderRadius:12, padding:"12px 14px", border:"1px solid #1e1e3a" },
  catHeader:    { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 },
  barTrack:     { height:5, background:"#1e1e3a", borderRadius:2, overflow:"hidden", position:"relative" },
  barFill:      { height:"100%", borderRadius:2, transition:"width 0.4s ease" },
  metaText:     { color:"#555", fontSize:10 },
  row:          { display:"flex", alignItems:"center", justifyContent:"space-between", background:"#12122a", borderRadius:10, padding:"12px 14px", border:"1px solid #1e1e3a" },
  rowLabel:     { color:"#ccc", fontSize:13 },
  rowInput:     { background:"#0a0a14", border:"1px solid #2a2a4a", borderRadius:8, padding:"8px 12px", color:"#a78bfa", fontSize:14, fontFamily:"inherit", width:110, textAlign:"right", outline:"none" },
  dateInput:    { background:"#0a0a14", border:"1px solid #2a2a4a", borderRadius:8, padding:"6px 10px", color:"#a78bfa", fontSize:12, fontFamily:"inherit", width:"100%", outline:"none", boxSizing:"border-box", marginTop:3 },
  formCard:     { display:"flex", flexDirection:"column", gap:12 },
  label:        { color:"#666", fontSize:11, letterSpacing:1, textTransform:"uppercase" },
  input:        { background:"#12122a", border:"1px solid #2a2a4a", borderRadius:10, padding:"14px 16px", color:"#fff", fontSize:16, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box" },
  catGrid:      { display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 },
  catPill:      { padding:"10px 8px", borderRadius:8, border:"1px solid", color:"#ccc", fontSize:12, cursor:"pointer", textAlign:"left", fontFamily:"inherit" },
  primaryBtn:   { background:"#a78bfa", color:"#0a0a14", border:"none", borderRadius:12, padding:"16px", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit", letterSpacing:1, marginTop:4 },
  ghostBtn:     { background:"none", color:"#666", border:"1px solid #2a2a4a", borderRadius:12, padding:"12px", fontSize:13, cursor:"pointer", fontFamily:"inherit", marginTop:4 },
  bottomNav:    { position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:420, background:"#0d0d1f", borderTop:"1px solid #1e1e3a", display:"flex", zIndex:100 },
  bnItem:       { flex:1, display:"flex", flexDirection:"column", alignItems:"center", padding:"10px 4px", background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:9 },
  bnActive:     { color:"#a78bfa" },
  editBtn:      { background:"none", border:"1px solid #2a2a4a", borderRadius:6, width:28, height:28, cursor:"pointer", fontSize:13 },
  hint:         { color:"#555", fontSize:13, textAlign:"center", padding:"20px 0" },
  toast:        { position:"fixed", bottom:80, left:"50%", transform:"translateX(-50%)", padding:"12px 24px", borderRadius:20, fontSize:13, fontWeight:700, zIndex:999, whiteSpace:"nowrap" },
};
