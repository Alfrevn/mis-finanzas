import { useState, useEffect } from "react";

// ─── FRASES DIARIAS ───────────────────────────────────────────────────────────
const FRASES = [
  "Somos los favoritos del universo",
  "Prueba 2",
  "Prueba 3",
];

function getDailyFrase() {
  const today = new Date().toISOString().slice(0, 10);
  const stored = (() => { try { return JSON.parse(localStorage.getItem("frase_v1")||"{}"); } catch { return {}; } })();
  if (stored.date === today) return stored.frase;
  // pick next unseen
  const seen = stored.seen || [];
  const unseen = FRASES.filter(f => !seen.includes(f));
  const pool = unseen.length > 0 ? unseen : FRASES;
  const frase = pool[Math.floor(Math.random() * pool.length)];
  const newSeen = unseen.length > 0 ? [...seen, frase] : [frase];
  try { localStorage.setItem("frase_v1", JSON.stringify({ date: today, frase, seen: newSeen })); } catch {}
  return frase;
}

// ─── CATEGORÍAS ───────────────────────────────────────────────────────────────
const PRIORITY_CATS   = ["supermercado", "salidas", "higiene"];
const SECONDARY_CATS  = ["fijos", "variables", "ropa", "ropo"];

const CATEGORIES = [
  { id: "supermercado", label: "Supermercado",       icon: "🛒", color: "#818cf8" },
  { id: "salidas",      label: "Salidas",            icon: "🎉", color: "#a78bfa" },
  { id: "higiene",      label: "Higiene & Limpieza", icon: "🧼", color: "#c084fc" },
  { id: "fijos",        label: "Fijos",              icon: "🏠", color: "#60a5fa" },
  { id: "variables",    label: "Variables",          icon: "⚡", color: "#34d399" },
  { id: "ropa",         label: "Ropa",               icon: "👗", color: "#f472b6" },
  { id: "ropo",         label: "Ropo",               icon: "🌿", color: "#4ade80" },
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

// ─── PERÍODO: del día 10 de cada mes al 9 del siguiente ──────────────────────
// El período arranca el día 10. Si hoy es >= 10, período = 10/mes actual → 9/mes siguiente.
// Si hoy es < 10, período = 10/mes anterior → 9/mes actual.
function getPeriodForDate(d = new Date()) {
  const day = d.getDate();
  const year = d.getFullYear();
  const month = d.getMonth();
  if (day >= 10) {
    const start = new Date(year, month, 10);
    const end   = new Date(year, month + 1, 9);
    return { start, end, key: `${year}-${month}` };
  } else {
    const start = new Date(year, month - 1, 10);
    const end   = new Date(year, month, 9);
    return { start, end, key: `${year}-${month - 1 < 0 ? 11 : month - 1}` };
  }
}

function getPeriodLabel(period) {
  const s = period.start;
  const e = period.end;
  return `${s.getDate()}/${s.getMonth()+1}/${s.getFullYear()} – ${e.getDate()}/${e.getMonth()+1}/${e.getFullYear()}`;
}

function prevPeriod(period) {
  const d = new Date(period.start);
  d.setDate(d.getDate() - 1); // go to day 9 of previous period
  return getPeriodForDate(d);
}

function nextPeriod(period) {
  const d = new Date(period.end);
  d.setDate(d.getDate() + 1); // go to day 10 of next period
  return getPeriodForDate(d);
}

function toDateStr(d = new Date()) { return d.toISOString().slice(0, 10); }

// ─── VARIANZA ─────────────────────────────────────────────────────────────────
function calcVariance(budget, startDate, endDate, spent) {
  if (!budget || !startDate || !endDate) return null;
  const start  = new Date(startDate); start.setHours(0,0,0,0);
  const end    = new Date(endDate);   end.setHours(0,0,0,0);
  const today  = new Date();          today.setHours(0,0,0,0);
  const totalDays  = Math.max(1, Math.round((end - start) / 86400000));
  const daysPassed = Math.max(0, Math.round((today - start) / 86400000) + 1);
  const dailyRate  = budget / totalDays;
  const expected   = Math.round(dailyRate * Math.min(daysPassed, totalDays));
  const variance   = spent - expected;
  const daysLeft   = Math.max(0, Math.round((end - today) / 86400000));
  const pctTime    = Math.min((daysPassed / totalDays) * 100, 100);
  return { expected, variance, daysLeft, dailyRate: parseFloat(dailyRate.toFixed(2)), pctTime };
}

// ─── STORAGE ──────────────────────────────────────────────────────────────────
function loadData() {
  try { const r = localStorage.getItem("finanzas_v5"); return r ? JSON.parse(r) : {}; }
  catch { return {}; }
}
function saveData(d) { try { localStorage.setItem("finanzas_v5", JSON.stringify(d)); } catch {} }

const EMPTY = { budgets:{}, expenses:[], incomes:{}, savings:0, savingsLog:[] };

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [period, setPeriod]   = useState(() => getPeriodForDate());
  const [view, setView]       = useState("add");
  const [data, setData]       = useState(loadData);
  const [form, setForm]       = useState({ amount:"", category:CATEGORIES[0].id, note:"", date:toDateStr() });
  const [toast, setToast]     = useState(null);
  const [editSavings, setEditSavings] = useState(false);
  const [savingsInput, setSavingsInput] = useState("");
  const [frase]               = useState(getDailyFrase);

  const key = period.key;
  const md  = data[key] || EMPTY;

  function persist(next) { setData(next); saveData(next); }
  function showToast(msg, type="ok") { setToast({msg,type}); setTimeout(()=>setToast(null),2500); }

  // ─── TOTALS ────────────────────────────────────────────────────────────────
  function getTotals() {
    const t = {};
    CATEGORIES.forEach(c => t[c.id] = 0);
    (md.expenses||[]).forEach(e => { t[e.category] = (t[e.category]||0) + e.amount; });
    return t;
  }

  const totals      = getTotals();
  const totalSpent  = Object.values(totals).reduce((a,b)=>a+b,0);
  const totalIncome = Object.values(md.incomes||{}).reduce((a,b)=>a+b,0);
  const savings     = md.savings || 0;
  // available = income - spent - savings (savings is locked)
  const available   = totalIncome - totalSpent - savings;

  // ─── ADD EXPENSE ───────────────────────────────────────────────────────────
  function addFromForm() {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return;
    const expense = { id:Date.now(), amount:amt, category:form.category, note:form.note.trim(), date:form.date||toDateStr() };
    const newExpenses = [...(md.expenses||[]), expense];
    persist({ ...data, [key]: { ...md, expenses:newExpenses } });
    // feedback
    const budget = md.budgets?.[form.category]||0;
    const newSpent = (totals[form.category]||0) + amt;
    if (budget>0 && newSpent<=budget) showToast("✓ Dentro del límite 🎯","good");
    else if (budget>0 && newSpent>budget) showToast("⚠️ Superaste el límite","warn");
    else showToast("Gasto registrado ✓","ok");
    setForm({ amount:"", category:CATEGORIES[0].id, note:"", date:toDateStr() });
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

  // ─── SAVINGS ───────────────────────────────────────────────────────────────
  // Transfer from savings to cover a category overage
  function transferFromSavings(catId, amount) {
    const amt = parseFloat(amount);
    if (!amt || amt<=0 || amt>savings) return;
    const newSavings = savings - amt;
    const log = [...(md.savingsLog||[]), {
      id: Date.now(),
      date: toDateStr(),
      amount: -amt,
      note: `Transferido a ${CATEGORIES.find(c=>c.id===catId)?.label||catId}`,
    }];
    // add as expense to that category with note
    const expense = { id:Date.now()+1, amount:amt, category:catId, note:"(desde ahorros)", date:toDateStr() };
    persist({ ...data, [key]: { ...md, savings:newSavings, savingsLog:log, expenses:[...(md.expenses||[]), expense] } });
    showToast(`$${amt.toLocaleString("es-AR")} movidos de Ahorro ✓`,"ok");
  }

  // Manual savings edit
  function saveSavingsEdit() {
    const val = parseFloat(savingsInput);
    if (isNaN(val)) return;
    const log = [...(md.savingsLog||[]), {
      id: Date.now(),
      date: toDateStr(),
      amount: val - savings,
      note: "Ajuste manual",
    }];
    persist({ ...data, [key]: { ...md, savings:val, savingsLog:log } });
    setEditSavings(false);
    showToast("Ahorro actualizado ✓","good");
  }

  // End-of-period: add unspent budget to savings
  function doArqueo() {
    let surplus = 0;
    CATEGORIES.forEach(cat => {
      const budget = md.budgets?.[cat.id]||0;
      const spent  = totals[cat.id]||0;
      if (budget>0 && spent<budget) surplus += budget - spent;
    });
    if (surplus<=0) { showToast("No hay excedente para arquear","warn"); return; }
    const newSavings = savings + surplus;
    const log = [...(md.savingsLog||[]), {
      id: Date.now(),
      date: toDateStr(),
      amount: surplus,
      note: `Arqueo de período`,
    }];
    persist({ ...data, [key]: { ...md, savings:newSavings, savingsLog:log } });
    showToast(`Arqueo: +$${surplus.toLocaleString("es-AR")} al ahorro 🏆`,"good");
  }

  // ─── INCOME / BUDGET ───────────────────────────────────────────────────────
  function setIncome(id, val) {
    persist({ ...data, [key]: { ...md, incomes:{...(md.incomes||{}), [id]:parseFloat(val)||0} } });
  }
  function setBudget(id, val) {
    persist({ ...data, [key]: { ...md, budgets:{...(md.budgets||{}), [id]:parseFloat(val)||0} } });
  }

  const priorityCats  = CATEGORIES.filter(c => PRIORITY_CATS.includes(c.id));
  const secondaryCats = CATEGORIES.filter(c => SECONDARY_CATS.includes(c.id));

  const NAV = [
    { id:"add",      icon:"＋", label:"Cargar"   },
    { id:"home",     icon:"⚡", label:"Resumen"  },
    { id:"savings",  icon:"🏆", label:"Ahorro"   },
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
            <button style={S.navBtn} onClick={()=>setPeriod(prevPeriod(period))}>‹</button>
            <span style={S.monthLabel}>{getPeriodLabel(period)}</span>
            <button style={S.navBtn} onClick={()=>setPeriod(nextPeriod(period))}>›</button>
          </div>
        </div>
        <div style={S.heroRow}>
          <div style={S.heroCard}>
            <span style={S.heroCaption}>disponible</span>
            <span style={{...S.heroAmt, color: available>=0?"#818cf8":"#f87171"}}>
              ${available.toLocaleString("es-AR")}
            </span>
          </div>
          <div style={S.heroDivider}/>
          <div style={S.heroCard}>
            <span style={S.heroCaption}>ingresos</span>
            <span style={S.heroAmt}>${totalIncome.toLocaleString("es-AR")}</span>
          </div>
          <div style={S.heroDivider}/>
          <div style={S.heroCard}>
            <span style={S.heroCaption}>gastado</span>
            <span style={S.heroAmt}>${totalSpent.toLocaleString("es-AR")}</span>
          </div>
        </div>

        {/* FRASE DIARIA */}
        <div style={S.fraseBox}>
          <span style={S.fraseText}>✨ {frase}</span>
        </div>
      </div>

      {/* CONTENT */}
      <div style={S.content}>

        {/* ── CARGAR ── */}
        {view==="add" && (
          <div style={S.section}>
            {/* PRIORITY — 3 cols medianas +30% */}
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:7}}>
              {priorityCats.map(cat => {
                const spent   = totals[cat.id]||0;
                const budget  = md.budgets?.[cat.id]||0;
                const ok      = budget>0 && spent<=budget;
                const over    = budget>0 && spent>budget;
                const v       = calcVariance(budget, toDateStr(period.start), toDateStr(period.end), spent);
                const sel     = form.category===cat.id;
                return (
                  <button key={cat.id} style={{
                    display:"flex", flexDirection:"column", alignItems:"center",
                    padding:"14px 4px", borderRadius:14, border:"1.5px solid", cursor:"pointer",
                    borderColor: sel?cat.color: over?"#f87171": ok?"#4ade80":"#2a2a4a",
                    background:  sel?cat.color+"33": over?"#3b091055": ok?"#14532d33":"#12122a",
                    transform: sel?"scale(1.04)":"scale(1)", transition:"all 0.15s",
                  }} onClick={()=>setForm({...form,category:cat.id})}>
                    <span style={{fontSize:26}}>{cat.icon}</span>
                    <span style={{color:"#e2e8f0", fontSize:11, marginTop:4, textAlign:"center", fontWeight:600}}>{cat.label}</span>
                    {budget>0 && (
                      <span style={{fontSize:10, fontWeight:700, marginTop:2, color:over?"#f87171":ok?"#4ade80":"#94a3b8"}}>
                        ${spent.toLocaleString("es-AR")} / ${budget.toLocaleString("es-AR")}
                      </span>
                    )}
                    {v && (
                      <span style={{fontSize:11, fontWeight:800, marginTop:3, color:v.variance<=0?"#4ade80":"#f87171"}}>
                        {v.variance<=0?`+${Math.abs(v.variance).toLocaleString("es-AR")}` : `-${v.variance.toLocaleString("es-AR")}`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* SECONDARY — 4 cols pequeñas */}
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:5}}>
              {secondaryCats.map(cat => {
                const spent  = totals[cat.id]||0;
                const budget = md.budgets?.[cat.id]||0;
                const ok     = budget>0 && spent<=budget;
                const over   = budget>0 && spent>budget;
                const v      = calcVariance(budget, toDateStr(period.start), toDateStr(period.end), spent);
                const sel    = form.category===cat.id;
                return (
                  <button key={cat.id} style={{
                    display:"flex", flexDirection:"column", alignItems:"center",
                    padding:"7px 2px", borderRadius:10, border:"1px solid", cursor:"pointer",
                    borderColor: sel?cat.color: over?"#f87171": ok?"#4ade80":"#2a2a4a",
                    background:  sel?cat.color+"33": over?"#3b091055": ok?"#14532d33":"#12122a",
                    transform: sel?"scale(1.04)":"scale(1)", transition:"all 0.15s",
                  }} onClick={()=>setForm({...form,category:cat.id})}>
                    <span style={{fontSize:16}}>{cat.icon}</span>
                    <span style={{color:"#cbd5e1", fontSize:9, marginTop:2, textAlign:"center"}}>{cat.label}</span>
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
          </div>
        )}

        {/* ── RESUMEN ── */}
        {view==="home" && (
          <div style={S.section}>
            {CATEGORIES.map(cat => {
              const spent  = totals[cat.id]||0;
              const budget = md.budgets?.[cat.id]||0;
              const over   = budget>0 && spent>budget;
              const pct    = budget>0 ? Math.min((spent/budget)*100,100) : 0;
              const v      = calcVariance(budget, toDateStr(period.start), toDateStr(period.end), spent);
              return (
                <div key={cat.id} style={S.catCard}>
                  <div style={S.catHeader}>
                    <div style={S.catLeft}>
                      <span style={{fontSize:18}}>{cat.icon}</span>
                      <span style={{color:"#e2e8f0",fontSize:13,fontWeight:600}}>{cat.label}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      {v && (
                        <span style={{fontSize:11,fontWeight:800,color:v.variance<=0?"#4ade80":"#f87171",
                          background:v.variance<=0?"#14532d55":"#7f1d1d55",borderRadius:6,padding:"2px 7px"}}>
                          {v.variance<=0?`+${Math.abs(v.variance).toLocaleString("es-AR")}` : `-${v.variance.toLocaleString("es-AR")}`}
                        </span>
                      )}
                      <span style={{color:over?"#f87171":"#f1f5f9",fontWeight:700,fontSize:15}}>
                        ${spent.toLocaleString("es-AR")}
                      </span>
                      {budget>0&&<span style={{color:"#475569",fontSize:12}}> / ${budget.toLocaleString("es-AR")}</span>}
                    </div>
                  </div>
                  {budget>0&&(
                    <div style={{...S.barTrack,position:"relative"}}>
                      <div style={{...S.barFill,width:`${pct}%`,backgroundColor:over?"#f87171":cat.color}}/>
                      {v&&v.pctTime>0&&<div style={{position:"absolute",top:0,bottom:0,left:`${v.pctTime}%`,width:2,backgroundColor:"rgba(255,255,255,0.35)"}}/>}
                    </div>
                  )}
                  {v&&budget>0&&(
                    <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                      <span style={S.metaText}>${v.dailyRate}/día</span>
                      <span style={S.metaText}>Esp: ${v.expected.toLocaleString("es-AR")} · {v.daysLeft}d</span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* AHORRO CHIP en resumen */}
            <div style={{...S.catCard, borderColor:"#fbbf24", background:"#1c1a0a"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:20}}>🔒</span>
                  <div>
                    <span style={{color:"#fbbf24",fontSize:13,fontWeight:700}}>Ahorro acumulado</span>
                    <div style={{color:"#92400e",fontSize:10,marginTop:1}}>Este dinero no se toca</div>
                  </div>
                </div>
                <span style={{color:"#fbbf24",fontSize:20,fontWeight:800}}>${savings.toLocaleString("es-AR")}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── AHORRO ── */}
        {view==="savings" && (
          <div style={S.section}>
            <div style={{...S.catCard, borderColor:"#fbbf24", background:"#1c1a0a"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div>
                  <div style={{color:"#fbbf24",fontSize:16,fontWeight:800}}>🔒 Ahorro total</div>
                  <div style={{color:"#92400e",fontSize:11,marginTop:2}}>Este dinero no se toca</div>
                </div>
                <span style={{color:"#fbbf24",fontSize:24,fontWeight:800}}>${savings.toLocaleString("es-AR")}</span>
              </div>

              {editSavings ? (
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <input style={{...S.input,flex:1,padding:"10px",fontSize:16}} type="number"
                    value={savingsInput} onChange={e=>setSavingsInput(e.target.value)} placeholder="Nuevo valor"/>
                  <button style={{...S.primaryBtn,margin:0,padding:"10px 16px"}} onClick={saveSavingsEdit}>✓</button>
                  <button style={{...S.ghostBtn,margin:0,padding:"10px 14px"}} onClick={()=>setEditSavings(false)}>✕</button>
                </div>
              ) : (
                <div style={{display:"flex",gap:8}}>
                  <button style={{...S.ghostBtn,flex:1,margin:0,padding:"10px",fontSize:12}} onClick={()=>{setEditSavings(true);setSavingsInput(String(savings));}}>
                    ✏️ Editar
                  </button>
                  <button style={{...S.primaryBtn,flex:1,margin:0,padding:"10px",fontSize:12}} onClick={doArqueo}>
                    📊 Arquear período
                  </button>
                </div>
              )}
            </div>

            {/* TRANSFERIR DE AHORRO */}
            <p style={S.sectionTitle}>Transferir a categoría</p>
            {CATEGORIES.map(cat => {
              const spent  = totals[cat.id]||0;
              const budget = md.budgets?.[cat.id]||0;
              const over   = budget>0 && spent>budget;
              const excess = over ? spent - budget : 0;
              return (
                <div key={cat.id} style={{...S.catCard, opacity: savings>0?1:0.4}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:18}}>{cat.icon}</span>
                      <div>
                        <span style={{color:"#e2e8f0",fontSize:13}}>{cat.label}</span>
                        {over&&<div style={{color:"#f87171",fontSize:10}}>Excedente: ${excess.toLocaleString("es-AR")}</div>}
                      </div>
                    </div>
                    <TransferInput catId={cat.id} savings={savings} onTransfer={transferFromSavings}/>
                  </div>
                </div>
              );
            })}

            {/* LOG */}
            {(md.savingsLog||[]).length>0 && (
              <>
                <p style={S.sectionTitle}>Movimientos</p>
                {[...(md.savingsLog||[])].reverse().map(l=>(
                  <div key={l.id} style={{...S.catCard,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{color:"#e2e8f0",fontSize:12}}>{l.note}</div>
                      <div style={{color:"#475569",fontSize:10}}>{l.date}</div>
                    </div>
                    <span style={{fontWeight:700,color:l.amount>=0?"#4ade80":"#f87171",fontSize:14}}>
                      {l.amount>=0?`+${l.amount.toLocaleString("es-AR")}`:l.amount.toLocaleString("es-AR")}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ── INGRESOS ── */}
        {view==="ingresos" && (
          <div style={S.section}>
            <p style={S.sectionTitle}>Ingresos del período</p>
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

        {/* ── LÍMITES ── */}
        {view==="limits" && (
          <div style={S.section}>
            <p style={S.sectionTitle}>Límite por categoría · {getPeriodLabel(period)}</p>
            {CATEGORIES.map(cat=>{
              const spent  = totals[cat.id]||0;
              const budget = md.budgets?.[cat.id]||0;
              const v      = calcVariance(budget, toDateStr(period.start), toDateStr(period.end), spent);
              const over   = budget>0 && spent>budget;
              const pct    = budget>0 ? Math.min((spent/budget)*100,100) : 0;
              return (
                <div key={cat.id} style={S.catCard}>
                  <div style={{...S.catHeader,marginBottom:budget>0?10:0}}>
                    <span style={S.rowLabel}>{cat.icon} {cat.label}</span>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      {v&&<span style={{fontSize:11,fontWeight:800,color:v.variance<=0?"#4ade80":"#f87171"}}>
                        {v.variance<=0?`+${Math.abs(v.variance).toLocaleString("es-AR")}` : `-${v.variance.toLocaleString("es-AR")}`}
                      </span>}
                      <input style={S.rowInput} type="number" inputMode="decimal" placeholder="Límite"
                        value={budget||""} onChange={e=>setBudget(cat.id,e.target.value)}/>
                    </div>
                  </div>
                  {budget>0&&(
                    <>
                      <div style={{...S.barTrack,position:"relative"}}>
                        <div style={{...S.barFill,width:`${pct}%`,backgroundColor:over?"#f87171":cat.color}}/>
                        {v&&v.pctTime>0&&<div style={{position:"absolute",top:0,bottom:0,left:`${v.pctTime}%`,width:2,backgroundColor:"rgba(255,255,255,0.35)"}}/>}
                      </div>
                      {v&&<div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                        <span style={S.metaText}>${v.dailyRate}/día</span>
                        <span style={S.metaText}>Esp: ${v.expected.toLocaleString("es-AR")} · {v.daysLeft}d</span>
                      </div>}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── HISTORIAL ── */}
        {view==="history" && (
          <History expenses={md.expenses||[]} onDelete={deleteExpense} onUpdate={updateExpense}/>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div style={S.bottomNav}>
        {NAV.map(n=>(
          <button key={n.id} style={{...S.bnItem,...(view===n.id?S.bnActive:{})}} onClick={()=>setView(n.id)}>
            <span style={{fontSize:16}}>{n.icon}</span>
            <span style={{fontSize:9,marginTop:1}}>{n.label}</span>
          </button>
        ))}
      </div>

      {toast&&(
        <div style={{...S.toast,
          background:toast.type==="good"?"#4ade80":toast.type==="warn"?"#f87171":"#818cf8",
          color:toast.type==="good"?"#052e16":"#fff",
        }}>{toast.msg}</div>
      )}
    </div></div>
  );
}

// ─── TRANSFER INPUT ───────────────────────────────────────────────────────────
function TransferInput({ catId, savings, onTransfer }) {
  const [val, setVal] = useState("");
  return (
    <div style={{display:"flex",gap:6,alignItems:"center"}}>
      <input style={{...S.rowInput,width:80}} type="number" inputMode="decimal" placeholder="$"
        value={val} onChange={e=>setVal(e.target.value)}/>
      <button style={{...S.ghostBtn,margin:0,padding:"6px 10px",fontSize:11,opacity:savings>0?1:0.4}}
        onClick={()=>{ if(val) { onTransfer(catId,val); setVal(""); } }}>
        Mover
      </button>
    </div>
  );
}

// ─── HISTORY ──────────────────────────────────────────────────────────────────
function History({ expenses, onDelete, onUpdate }) {
  const [editId, setEditId] = useState(null);
  const sorted = [...expenses].sort((a,b)=>new Date(b.date)-new Date(a.date));
  if (!sorted.length) return <p style={S.hint}>Sin gastos este período.</p>;
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
                  <input style={{...S.input,flex:1,padding:"8px",fontSize:13}} type="number"
                    defaultValue={e.amount} onBlur={ev=>onUpdate(e.id,"amount",ev.target.value)}/>
                </div>
                <input style={{...S.input,padding:"8px",fontSize:12,marginTop:6}} type="date"
                  defaultValue={e.date.slice(0,10)} onBlur={ev=>onUpdate(e.id,"date",ev.target.value)}/>
                <input style={{...S.input,padding:"8px",fontSize:12,marginTop:6}} type="text"
                  defaultValue={e.note} placeholder="Nota" onBlur={ev=>onUpdate(e.id,"note",ev.target.value)}/>
                <div style={{display:"flex",gap:8,marginTop:8}}>
                  <button style={{...S.primaryBtn,flex:1,padding:"10px",marginTop:0}} onClick={()=>setEditId(null)}>Listo</button>
                  <button style={{...S.ghostBtn,flex:1,padding:"10px",marginTop:0,color:"#f87171",borderColor:"#f87171"}}
                    onClick={()=>{onDelete(e.id);setEditId(null);}}>Borrar</button>
                </div>
              </>
            ) : (
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:20}}>{cat?.icon}</span>
                  <div>
                    <div style={{color:"#f1f5f9",fontWeight:600,fontSize:14}}>{cat?.label}</div>
                    {e.note&&<div style={{color:"#64748b",fontSize:12}}>{e.note}</div>}
                    <div style={{color:"#334155",fontSize:11}}>{e.date.slice(0,10)}</div>
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

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = {
  root:        { minHeight:"100vh", background:"#0f0f1a", display:"flex", justifyContent:"center", fontFamily:"'Nunito', 'Segoe UI', sans-serif" },
  app:         { width:"100%", maxWidth:420, minHeight:"100vh", display:"flex", flexDirection:"column", paddingBottom:70 },
  header:      { background:"linear-gradient(160deg,#1a1a2e 0%,#0f0f1a 100%)", padding:"16px 20px 12px", borderBottom:"1px solid #1e2a3a" },
  headerTop:   { display:"flex", justifyContent:"center", marginBottom:12 },
  monthNav:    { display:"flex", alignItems:"center", gap:8 },
  navBtn:      { background:"none", border:"1px solid #334155", color:"#94a3b8", width:28, height:28, borderRadius:6, cursor:"pointer", fontSize:16 },
  monthLabel:  { color:"#e2e8f0", fontSize:11, minWidth:160, textAlign:"center", fontWeight:600 },
  heroRow:     { display:"flex", justifyContent:"space-between", alignItems:"center" },
  heroCard:    { flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 },
  heroDivider: { width:1, height:36, background:"#1e2a3a" },
  heroCaption: { color:"#475569", fontSize:9, letterSpacing:1, textTransform:"uppercase" },
  heroAmt:     { color:"#f1f5f9", fontSize:18, fontWeight:800 },
  fraseBox:    { marginTop:10, padding:"8px 12px", background:"#1e2a3a", borderRadius:10, textAlign:"center" },
  fraseText:   { color:"#a5f3fc", fontSize:12, fontStyle:"italic", fontFamily:"'Georgia', serif", letterSpacing:0.3 },
  content:     { flex:1, overflowY:"auto", padding:"14px 14px 8px" },
  section:     { display:"flex", flexDirection:"column", gap:10 },
  sectionTitle:{ color:"#475569", fontSize:10, letterSpacing:2, textTransform:"uppercase", margin:"4px 0" },
  catCard:     { background:"#1a1a2e", borderRadius:12, padding:"12px 14px", border:"1px solid #1e2a3a" },
  catHeader:   { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 },
  catLeft:     { display:"flex", alignItems:"center", gap:8 },
  barTrack:    { height:5, background:"#1e2a3a", borderRadius:2, overflow:"hidden" },
  barFill:     { height:"100%", borderRadius:2, transition:"width 0.4s ease" },
  metaText:    { color:"#334155", fontSize:10 },
  row:         { display:"flex", alignItems:"center", justifyContent:"space-between", background:"#1a1a2e", borderRadius:10, padding:"12px 14px", border:"1px solid #1e2a3a" },
  rowLabel:    { color:"#cbd5e1", fontSize:13, fontWeight:500 },
  rowInput:    { background:"#0f0f1a", border:"1px solid #334155", borderRadius:8, padding:"8px 12px", color:"#818cf8", fontSize:14, fontFamily:"inherit", width:110, textAlign:"right", outline:"none" },
  bigInput:    { background:"#1a1a2e", border:"2px solid #818cf8", borderRadius:14, padding:"18px 16px", color:"#f1f5f9", fontSize:30, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box", textAlign:"center", fontWeight:800 },
  input:       { background:"#1a1a2e", border:"1px solid #334155", borderRadius:10, padding:"12px 14px", color:"#e2e8f0", fontSize:15, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box" },
  catGrid:     { display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 },
  primaryBtn:  { background:"#818cf8", color:"#0f0f1a", border:"none", borderRadius:12, padding:"14px", fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"inherit", letterSpacing:0.5, marginTop:4 },
  ghostBtn:    { background:"none", color:"#64748b", border:"1px solid #334155", borderRadius:12, padding:"10px", fontSize:13, cursor:"pointer", fontFamily:"inherit", marginTop:4 },
  bottomNav:   { position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:420, background:"#0f0f1a", borderTop:"1px solid #1e2a3a", display:"flex", zIndex:100 },
  bnItem:      { flex:1, display:"flex", flexDirection:"column", alignItems:"center", padding:"8px 2px", background:"none", border:"none", color:"#334155", cursor:"pointer", fontSize:9, fontFamily:"inherit" },
  bnActive:    { color:"#818cf8" },
  editBtn:     { background:"none", border:"1px solid #334155", borderRadius:6, width:28, height:28, cursor:"pointer", fontSize:13 },
  hint:        { color:"#334155", fontSize:13, textAlign:"center", padding:"20px 0" },
  toast:       { position:"fixed", bottom:80, left:"50%", transform:"translateX(-50%)", padding:"12px 24px", borderRadius:20, fontSize:13, fontWeight:700, zIndex:999, whiteSpace:"nowrap", fontFamily:"inherit" },
  dateInput:   { background:"#0f0f1a", border:"1px solid #334155", borderRadius:8, padding:"6px 10px", color:"#818cf8", fontSize:12, fontFamily:"inherit", width:"100%", outline:"none", boxSizing:"border-box", marginTop:3 },
};
