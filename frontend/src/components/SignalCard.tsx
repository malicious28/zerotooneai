interface Signal {
  id: string
  type: string
  name: string
  description: string
  reach_pct: number
  taxonomy_path: string
}

const TYPE_COLORS: Record<string, string> = {
  location: 'bg-green-100 text-green-700',
  demographic: 'bg-blue-100 text-blue-700',
  transaction: 'bg-orange-100 text-orange-700',
  interest: 'bg-purple-100 text-purple-700',
  behavior: 'bg-pink-100 text-pink-700',
}

interface Props {
  signal: Signal
  onRemove?: (id: string) => void
}

export default function SignalCard({ signal, onRemove }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-start gap-3 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[signal.type] ?? 'bg-gray-100 text-gray-600'}`}>{signal.type}</span>
          <span className="text-xs text-gray-400">{signal.taxonomy_path.split(' > ').slice(-1)[0]}</span>
        </div>
        <p className="text-sm font-medium text-gray-800 mt-1">{signal.name}</p>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{signal.description}</p>
        <p className="text-xs text-indigo-600 font-medium mt-1">{signal.reach_pct}% reach</p>
      </div>
      {onRemove && (
        <button onClick={() => onRemove(signal.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all text-lg leading-none">&times;</button>
      )}
    </div>
  )
}
