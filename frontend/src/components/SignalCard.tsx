interface Signal {
  id: string
  type: string
  name: string
  description: string
  reach_pct: number
  taxonomy_path: string
}

const TYPE_STYLES: Record<string, { chip: string; dot: string }> = {
  location:    { chip: 'bg-emerald-50 text-emerald-700 border-emerald-100',   dot: 'bg-emerald-400' },
  demographic: { chip: 'bg-blue-50 text-blue-700 border-blue-100',           dot: 'bg-blue-400' },
  transaction: { chip: 'bg-amber-50 text-amber-700 border-amber-100',        dot: 'bg-amber-400' },
  interest:    { chip: 'bg-violet-50 text-violet-700 border-violet-100',     dot: 'bg-violet-400' },
  behavior:    { chip: 'bg-pink-50 text-pink-700 border-pink-100',           dot: 'bg-pink-400' },
}

const fallback = { chip: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' }

interface Props {
  signal: Signal
  onRemove?: (id: string) => void
}

export default function SignalCard({ signal, onRemove }: Props) {
  const style = TYPE_STYLES[signal.type] ?? fallback

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3.5 flex items-start gap-3 group hover:border-gray-200 hover:shadow-sm transition-all">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${style.chip}`}>
            {signal.type}
          </span>
          <span className="text-xs text-gray-400 truncate">
            {signal.taxonomy_path.split(' > ').slice(-1)[0]}
          </span>
        </div>
        <p className="text-sm font-medium text-gray-800">{signal.name}</p>
        <p className="text-xs text-gray-400 mt-0.5 truncate">{signal.description}</p>
        <div className="flex items-center gap-1.5 mt-2">
          <div className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
          <p className="text-xs text-violet-600 font-medium">{signal.reach_pct}% reach</p>
        </div>
      </div>
      {onRemove && (
        <button
          onClick={() => onRemove(signal.id)}
          className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0 mt-0.5"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      )}
    </div>
  )
}
