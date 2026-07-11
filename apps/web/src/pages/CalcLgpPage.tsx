import { useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Calc LGP · Calculadora Love Green (modo DRON) — página pública standalone.
 *
 * Reproducción FIEL del HTML del representante Love Green que pasó JuanCho
 * (11-jul-2026): mismo instrumento (bidones dibujados con su nivel), mismo
 * tema oscuro, misma lógica. Lead magnet como el Visor SIGPAC / Visor de plagas.
 *
 * Dosis = DE TRABAJO del representante (no la etiqueta del bote, que va en
 * mínimos), por categoría de cultivo. Dos productos:
 *   1) LOVE GREEN (LG-MINER) — mineral SÓLIDO, kg/ha.
 *   2) MICRO/PRO — líquido combinado 50% Microbiota + 50% Proenzime, L/ha.
 * Cálculo: agua=caldo×sup×apps · por cuba=(dosis×1000/caldo)×capacidad ·
 * total=dosis×sup×apps. Regla no-inventar: nada fuera de la fuente.
 */

const CAT = {
  extensivo: { lgMin: 0.75, lgMax: 1, lgDef: 1, mpMin: 1.5, mpMax: 2, mpDef: 2 },
  lenoso: { lgMin: 1, lgMax: 1.5, lgDef: 1.5, mpMin: 2, mpMax: 3, mpDef: 3 },
} as const;
type Cat = keyof typeof CAT;

const CROPS: Array<{ id: string; nom: string; cat: Cat }> = [
  { id: 'maiz', nom: 'Maíz', cat: 'extensivo' },
  { id: 'girasol', nom: 'Girasol', cat: 'extensivo' },
  { id: 'trigo', nom: 'Trigo / cereal', cat: 'extensivo' },
  { id: 'patata', nom: 'Patata', cat: 'extensivo' },
  { id: 'horticola', nom: 'Hortícola', cat: 'extensivo' },
  { id: 'olivo', nom: 'Olivo', cat: 'lenoso' },
  { id: 'vina', nom: 'Viña', cat: 'lenoso' },
  { id: 'frutal', nom: 'Frutal / almendro', cat: 'lenoso' },
  { id: 'citricos', nom: 'Cítricos', cat: 'lenoso' },
];
const CUBA_PRESETS = [16, 50, 100, 300, 1000];

const fmt = (n: number, d = 0) => n.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
const dec = (n: number) => (n % 1 ? 1 : 0);
function fmtCant(v: number, solido: boolean): string {
  if (solido) return v >= 1000 ? `${fmt(v / 1000, (v / 1000) % 1 ? 2 : 0)} kg` : `${fmt(v)} g`;
  return v >= 1000 ? `${fmt(v / 1000, (v / 1000) % 1 ? 2 : 0)} L` : `${fmt(v)} mL`;
}

// CSS del HTML original, con las variables/selectores acotados bajo .lgp.
const CSS = `
.lgp-page{min-height:100vh;background:#0f1512}
.lgp{--bg:#0f1512;--panel:#18211c;--panel2:#1f2a23;--line:#2c3a30;--txt:#e8f0ea;--muted:#8aa295;--accent:#4ba36a;--accent2:#7fd39a;--warn:#e0a83d;--err:#e0603d;--radius:16px;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:var(--txt);line-height:1.4;-webkit-font-smoothing:antialiased;padding:16px;max-width:520px;margin:0 auto}
.lgp *{box-sizing:border-box;margin:0;padding:0}
.lgp .topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.lgp .topbar a{color:var(--muted);font-size:12px;text-decoration:none}
.lgp .topbar a:hover{color:var(--accent2)}
.lgp header{display:flex;align-items:center;gap:10px;margin-bottom:4px}
.lgp .logo{width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-weight:800;color:#0f1512;font-size:16px}
.lgp h1{font-size:19px;font-weight:700;letter-spacing:-.2px}
.lgp .sub{color:var(--muted);font-size:12.5px;margin:2px 0 18px}
.lgp .card{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:16px;margin-bottom:14px}
.lgp label{display:block;font-size:13px;color:var(--muted);margin-bottom:7px;font-weight:600}
.lgp .field{margin-bottom:16px}
.lgp .field:last-child{margin-bottom:0}
.lgp input[type=number]{width:100%;background:var(--panel2);border:1px solid var(--line);border-radius:11px;color:var(--txt);font-size:20px;font-weight:600;padding:12px 14px;outline:none}
.lgp input[type=number]:focus{border-color:var(--accent)}
.lgp select{width:100%;background:var(--panel2);border:1px solid var(--line);border-radius:11px;color:var(--txt);font-size:18px;font-weight:600;padding:12px 14px;outline:none;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='%238aa295' viewBox='0 0 16 16'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center}
.lgp select:focus{border-color:var(--accent)}
.lgp .valinput{background:transparent;border:none;border-bottom:1px dashed var(--line);outline:none;color:var(--accent2);font-size:22px;font-weight:700;text-align:right;width:5.5ch;padding:0 2px 1px;appearance:textfield;-webkit-appearance:textfield}
.lgp .valinput:focus{border-bottom-color:var(--accent)}
.lgp .valinput::-webkit-outer-spin-button,.lgp .valinput::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.lgp .unit{position:relative}
.lgp .unit span.u{position:absolute;right:14px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:13px;font-weight:600;pointer-events:none}
.lgp .presets{display:flex;gap:8px;flex-wrap:wrap;margin-top:9px}
.lgp .chip{background:var(--panel2);border:1px solid var(--line);color:var(--muted);border-radius:9px;padding:7px 12px;font-size:13px;font-weight:600;cursor:pointer;transition:.12s}
.lgp .chip.active{background:var(--accent);border-color:var(--accent);color:#0f1512}
.lgp .slider-row{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:8px}
.lgp .slider-val{font-size:22px;font-weight:700;color:var(--accent2)}
.lgp .slider-val small{font-size:13px;color:var(--muted);font-weight:600}
.lgp input[type=range]{width:100%;accent-color:var(--accent);height:26px}
.lgp .steppers{display:flex;gap:8px}
.lgp .steppers button{flex:1;background:var(--panel2);border:1px solid var(--line);color:var(--txt);font-size:18px;font-weight:700;padding:11px;border-radius:11px;cursor:pointer}
.lgp .steppers .n{flex:1.4;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700}
.lgp .prod{display:flex;align-items:center;justify-content:space-between;padding:13px 0;border-top:1px solid var(--line)}
.lgp .prod:first-of-type{border-top:none}
.lgp .pn{font-size:15px;font-weight:700}
.lgp .tag{color:var(--muted);font-weight:500;font-size:12px}
.lgp .doseline{display:flex;align-items:center;gap:6px;margin-top:8px;flex-wrap:wrap}
.lgp input[type=number].dinput{width:96px;background:var(--panel2);border:1px solid var(--line);border-radius:10px;color:var(--accent2);font-size:22px;font-weight:800;text-align:center;padding:9px 6px;appearance:textfield;-webkit-appearance:textfield;outline:none}
.lgp input[type=number].dinput:focus{border-color:var(--accent)}
.lgp .dinput::-webkit-outer-spin-button,.lgp .dinput::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.lgp .uu{color:var(--txt);font-size:15px;font-weight:700}
.lgp .ref{display:block;color:var(--muted);font-size:12px;margin-top:7px}
.lgp .ref b{color:var(--accent2);font-weight:700}
.lgp .ref.out b{color:var(--warn)}
.lgp .sw{position:relative;width:46px;height:27px;flex:0 0 auto;margin-left:12px;cursor:pointer}
.lgp .sw input{opacity:0;width:0;height:0;position:absolute}
.lgp .sw .track{position:absolute;inset:0;background:var(--panel2);border:1px solid var(--line);border-radius:20px;transition:.15s}
.lgp .sw .knob{position:absolute;top:3px;left:3px;width:20px;height:20px;background:var(--muted);border-radius:50%;transition:.15s}
.lgp .sw input:checked + .track{background:var(--accent);border-color:var(--accent)}
.lgp .sw input:checked ~ .knob{transform:translateX(19px);background:#0f1512}
.lgp .hero{background:linear-gradient(135deg,#1c2a20,#22331f);border:1px solid #365a3f;padding:18px 16px}
.lgp .hero .cap{font-size:12px;text-transform:uppercase;letter-spacing:.6px;color:#7fae8c;font-weight:700;text-align:center;margin-bottom:14px}
.lgp .drums{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px}
.lgp .drum{position:relative;background:#152018;border:1px solid #2f4636;border-radius:13px;padding:11px 12px;overflow:hidden;min-height:118px}
.lgp .drum .lvl{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,rgba(75,163,106,.30),rgba(75,163,106,.10));z-index:0;transition:height .2s}
.lgp .drum .dh{position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;margin-bottom:9px}
.lgp .drum .dnum{font-size:12px;font-weight:800;color:var(--accent2);letter-spacing:.3px}
.lgp .drum .dtag{font-size:9.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;border:1px solid var(--line);border-radius:6px;padding:2px 6px}
.lgp .drum .drow{position:relative;z-index:1;display:flex;justify-content:space-between;align-items:baseline;font-size:13px;padding:3px 0}
.lgp .drum .drow .l{color:var(--muted);font-weight:600}
.lgp .drum .drow .v{font-weight:800;color:var(--txt)}
.lgp .drum .drow.agua .v{color:#8fc7de}
.lgp .drum .drow.lg .v{color:#e6d49a}
.lgp .drum .drow.mp .v{color:#9fd8b2}
.lgp .drum .aguasub{position:relative;z-index:1;text-align:right;font-size:10px;color:var(--muted);margin:-2px 0 2px}
.lgp .drumsNote{grid-column:1/-1;text-align:center;color:var(--muted);font-size:12px;padding:6px}
.lgp .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.lgp .stat{background:var(--panel);border:1px solid var(--line);border-radius:13px;padding:13px}
.lgp .stat .k{font-size:12px;color:var(--muted);font-weight:600;margin-bottom:4px}
.lgp .stat .v{font-size:22px;font-weight:700}
.lgp .stat .v small{font-size:12px;color:var(--muted);font-weight:600}
.lgp .note{display:flex;gap:9px;font-size:12.5px;color:var(--muted);background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--warn);border-radius:10px;padding:11px 12px;margin-top:14px}
.lgp .foot{text-align:center;color:var(--muted);font-size:11px;margin-top:16px;line-height:1.6}
.lgp .section-t{font-size:12px;text-transform:uppercase;letter-spacing:.6px;color:var(--muted);font-weight:700;margin:0 0 4px}
`;

export default function CalcLgpPage() {
  const [cultivo, setCultivo] = useState('maiz');
  const [sup, setSup] = useState(1);
  const [caldo, setCaldo] = useState(50);
  const [cuba, setCuba] = useState(300);
  const [apps, setApps] = useState(1);
  const [onLG, setOnLG] = useState(true);
  const [onMP, setOnMP] = useState(true);

  const crop = CROPS.find((c) => c.id === cultivo) ?? CROPS[0];
  const k = CAT[crop.cat];
  const [doseLG, setDoseLG] = useState<number>(k.lgDef);
  const [doseMP, setDoseMP] = useState<number>(k.mpDef);

  const changeCultivo = (id: string) => {
    setCultivo(id);
    const c = CROPS.find((x) => x.id === id) ?? CROPS[0];
    setDoseLG(CAT[c.cat].lgDef);
    setDoseMP(CAT[c.cat].mpDef);
  };

  const lgOut = onLG && doseLG > 0 && (doseLG < k.lgMin || doseLG > k.lgMax);
  const mpOut = onMP && doseMP > 0 && (doseMP < k.mpMin || doseMP > k.mpMax);

  // ---- cálculo (fiel) ----
  const aguaTotal = caldo * sup * apps;
  const full = cuba > 0 ? Math.floor(aguaTotal / cuba) : 0;
  const resto = +(aguaTotal - full * cuba).toFixed(2);
  const nCubas = full + (resto > 0 ? 1 : 0);

  type Prod = { key: 'lg' | 'mp'; nombre: string; solido: boolean; dosisHa: number; unidad: string; split: boolean };
  const activos: Prod[] = [];
  if (onLG) activos.push({ key: 'lg', nombre: 'Love Green', solido: true, dosisHa: doseLG, unidad: 'kg', split: false });
  if (onMP) activos.push({ key: 'mp', nombre: 'Micro/Pro', solido: false, dosisHa: doseMP, unidad: 'L', split: true });

  const perAgua = (a: number, d: number) => (d * 1000 / caldo) * a; // g o mL en 'a' litros de caldo

  // lista de cubas: N llenas + 1 parcial
  const cubas: Array<{ agua: number; parcial: boolean }> = [];
  for (let i = 0; i < full; i++) cubas.push({ agua: cuba, parcial: false });
  if (resto > 0) cubas.push({ agua: resto, parcial: true });

  return (
    <div className="lgp-page">
      <style>{CSS}</style>
      <div className="lgp">
        <div className="topbar">
          <Link to="/" aria-label="Volver a la página principal">&larr; Volver a AgroM · FitoLink</Link>
        </div>

        <header>
          <div className="logo">LG</div>
          <div><h1>Calculadora Love Green</h1></div>
        </header>
        <p className="sub">Aplicación con dron · dosis por cuba y por parcela</p>

        {/* PARÁMETROS */}
        <div className="card">
          <div className="field">
            <label>Cultivo</label>
            <div className="unit">
              <select value={cultivo} onChange={(e) => changeCultivo(e.target.value)}>
                {CROPS.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--accent2)', marginTop: 7, fontWeight: 600 }}>
              {crop.cat === 'lenoso' ? 'Leñoso (dosis alta)' : 'Extensivo (dosis estándar)'}
            </div>
          </div>

          <div className="field">
            <div className="slider-row">
              <label style={{ margin: 0 }}>Superficie a tratar <span style={{ fontWeight: 500, opacity: 0.7 }}>· editable</span></label>
              <div className="slider-val">
                <input type="number" className="valinput" value={sup} min={0} step={0.01} inputMode="decimal"
                  onChange={(e) => setSup(Math.max(0, +e.target.value || 0))} /><small> ha</small>
              </div>
            </div>
            <input type="range" min={0.5} max={50} step={0.25} value={Math.min(50, Math.max(0.5, sup))} onChange={(e) => setSup(+e.target.value)} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              <span>0,5</span><span>50 ha</span>
            </div>
          </div>

          <div className="field">
            <div className="slider-row">
              <label style={{ margin: 0 }}>Caldo por hectárea</label>
              <div className="slider-val">{caldo}<small> L/ha</small></div>
            </div>
            <input type="range" min={20} max={150} step={5} value={caldo} onChange={(e) => setCaldo(+e.target.value)} />
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Referencia del representante: ~50 L/ha en general.</div>
          </div>

          <div className="field">
            <label>Capacidad de la cuba / depósito</label>
            <div className="unit">
              <input type="number" value={cuba} min={1} step={1} inputMode="numeric" onChange={(e) => setCuba(Math.max(1, +e.target.value || 1))} />
              <span className="u">L</span>
            </div>
            <div className="presets">
              {CUBA_PRESETS.map((v) => (
                <div key={v} className={`chip${cuba === v ? ' active' : ''}`} onClick={() => setCuba(v)}>{v} L</div>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Nº de aplicaciones (ciclo)</label>
            <div className="steppers">
              <button onClick={() => setApps((a) => Math.max(1, a - 1))}>−</button>
              <div className="n">{apps}</div>
              <button onClick={() => setApps((a) => Math.min(9, a + 1))}>+</button>
            </div>
          </div>
        </div>

        {/* PRODUCTOS Y DOSIS */}
        <div className="card">
          <div className="section-t">Dosis por hectárea</div>
          <p style={{ fontSize: '11.5px', color: 'var(--muted)', marginBottom: 6 }}>Se ajusta sola con el cultivo · editable</p>

          <div className="prod">
            <div style={{ flex: 1 }}>
              <div className="pn">Love Green <span className="tag">· mineral, sólido</span></div>
              <div className="doseline">
                <input className="dinput" type="number" min={0} step={0.05} value={doseLG} inputMode="decimal"
                  onChange={(e) => setDoseLG(Math.max(0, +e.target.value || 0))} /><span className="uu">kg por hectárea</span>
              </div>
              <span className={`ref${lgOut ? ' out' : ''}`}>Recomendado para {crop.nom.toLowerCase()}: <b>{fmt(k.lgMin, 2)}–{fmt(k.lgMax, 2)} kg/ha</b>{lgOut ? ' · fuera de rango' : ''}</span>
            </div>
            <label className="sw"><input type="checkbox" checked={onLG} onChange={(e) => setOnLG(e.target.checked)} /><span className="track" /><span className="knob" /></label>
          </div>

          <div className="prod">
            <div style={{ flex: 1 }}>
              <div className="pn">Micro/Pro <span className="tag">· 50% microbiota + 50% proenzime, líquido</span></div>
              <div className="doseline">
                <input className="dinput" type="number" min={0} step={0.1} value={doseMP} inputMode="decimal"
                  onChange={(e) => setDoseMP(Math.max(0, +e.target.value || 0))} /><span className="uu">litros por hectárea</span>
              </div>
              <span className={`ref${mpOut ? ' out' : ''}`}>Recomendado para {crop.nom.toLowerCase()}: <b>{fmt(k.mpMin, 1)}–{fmt(k.mpMax, 1)} L/ha</b>{mpOut ? ' · fuera de rango' : ''}</span>
            </div>
            <label className="sw"><input type="checkbox" checked={onMP} onChange={(e) => setOnMP(e.target.checked)} /><span className="track" /><span className="knob" /></label>
          </div>
        </div>

        {/* RESULTADO: plan de carga (bidones) */}
        <div className="card hero">
          <div className="cap">Plan de carga{activos.length && nCubas ? ` · ${nCubas} cuba${nCubas !== 1 ? 's' : ''}` : ''}</div>
          {activos.length === 0 ? (
            <div className="drums"><div className="drumsNote">Activa al menos un producto.</div></div>
          ) : cubas.length > 40 ? (
            <div className="drums">
              <div className="drumsNote">
                {nCubas} cubas ({full} llenas de {fmt(cuba)} L{resto > 0 ? ` + 1 de ${fmt(resto, dec(resto))} L` : ''}).
                Cada llena: {activos.map((p) => `${p.nombre} ${fmtCant(perAgua(cuba, p.dosisHa), p.solido)}`).join(' · ')}. Demasiadas para dibujar una a una.
              </div>
            </div>
          ) : (
            <div className="drums">
              {cubas.map((cb, idx) => {
                const nivel = Math.min(100, (cb.agua / cuba) * 100);
                let litrosProd = 0;
                activos.forEach((p) => { if (!p.solido) litrosProd += perAgua(cb.agua, p.dosisHa) / 1000; });
                const aguaNeta = Math.max(0, cb.agua - litrosProd);
                return (
                  <div className="drum" key={idx}>
                    <div className="lvl" style={{ height: `${nivel}%` }} />
                    <div className="dh"><span className="dnum">CUBA {idx + 1}</span><span className="dtag">{cb.parcial ? 'parcial' : 'llena'}</span></div>
                    <div className="drow agua"><span className="l">Agua</span><span className="v">{fmt(aguaNeta, dec(aguaNeta))} L</span></div>
                    {litrosProd > 0 && <div className="aguasub">{fmt(cb.agua, dec(cb.agua))} L cuba − {fmt(litrosProd, dec(litrosProd))} L producto</div>}
                    {activos.map((p) => (
                      <div className={`drow ${p.key}`} key={p.key}><span className="l">{p.nombre}</span><span className="v">{fmtCant(perAgua(cb.agua, p.dosisHa), p.solido)}</span></div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* DESGLOSE PARCELA */}
        <div className="grid">
          <div className="stat">
            <div className="k">Agua total (caldo)</div>
            <div className="v">{fmt(aguaTotal, dec(aguaTotal))}<small> L</small></div>
          </div>
          <div className="stat">
            <div className="k">Cubas a preparar</div>
            <div className="v">{nCubas}</div>
            {nCubas > 1 && resto > 0 && resto < cuba && (
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>última cuba: {fmt(resto, dec(resto))} L</div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          {activos.map((p) => {
            const total = p.dosisHa * sup * apps;
            return (
              <div className="stat" key={p.key} style={{ marginBottom: 10 }}>
                <div className="k">Total {p.nombre} · parcela</div>
                <div className="v">{fmt(total, dec(total))} {p.unidad} <small>· {fmt(p.dosisHa, dec(p.dosisHa))} {p.unidad}/ha{p.split ? ` · micro ${fmt(total / 2, dec(total / 2))} ${p.unidad} + pro ${fmt(total / 2, dec(total / 2))} ${p.unidad}` : ''}</small></div>
              </div>
            );
          })}
        </div>

        {onLG && onMP && (
          <div className="note">
            <span>⚠️</span>
            <span><b>Cuidado con la mezcla:</b> Love Green es alcalino y el Micro/Pro ácido; pueden reaccionar en la cuba. Prueba de compatibilidad antes o pasadas separadas. Limpiar depósitos tras aplicar.</span>
          </div>
        )}

        <p className="foot">
          Dosis del representante · caldo 50 L/ha. Extensivos: LG 0,75–1 kg/ha + Micro/Pro 1,5–2 L/ha.
          Leñosos: LG 1–1,5 kg/ha + Micro/Pro 2–3 L/ha. La etiqueta del bote va en mínimos.
        </p>
      </div>
    </div>
  );
}
