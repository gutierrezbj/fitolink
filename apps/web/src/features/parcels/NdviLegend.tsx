const LEGEND_ITEMS = [
  { color: '#7f1d1d', label: '< 0.15', desc: 'Sin vegetacion' },
  { color: '#dc2626', label: '0.15–0.25', desc: 'Muy escasa' },
  { color: '#f97316', label: '0.25–0.35', desc: 'Escasa' },
  { color: '#eab308', label: '0.35–0.45', desc: 'Moderada' },
  { color: '#84cc16', label: '0.45–0.55', desc: 'Buena' },
  { color: '#16a34a', label: '≥ 0.55', desc: 'Optima' },
];

export default function NdviLegend() {
  return (
    <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl p-3 shadow-sm">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">NDVI</p>
      <div className="space-y-1">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
            <span className="text-[11px] text-gray-600 font-mono w-16">{item.label}</span>
            <span className="text-[10px] text-gray-400">{item.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
