import SignalCard from './SignalCard'

interface AudienceEstimate {
  total_reach: number
  reach_percentage: number
  confidence: 'high' | 'medium' | 'low'
}

interface Props {
  signals: any[]
  estimate: AudienceEstimate | null
  isConfirmed: boolean
  onRemoveSignal: (id: string) => void
  onConfirm: () => void
}

const CONFIDENCE_COLOR = { high: 'text-green-600', medium: 'text-yellow-600', low: 'text-red-500' }

function formatReach(n: number) {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)}Cr`
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)}L`
  return n.toLocaleString()
}

export default function AudiencePanel({ signals, estimate, isConfirmed, onRemoveSignal, onConfirm }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-gray-800">Audience Signals</h2>
        <p className="text-xs text-gray-400 mt-0.5">{signals.length} signal{signals.length !== 1 ? 's' : ''} selected</p>
      </div>

      {estimate && signals.length > 0 && (
        <div className="mx-4 mt-4 bg-indigo-50 rounded-xl p-4">
          <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide">Estimated Reach</p>
          <p className="text-2xl font-bold text-indigo-700 mt-1">{formatReach(estimate.total_reach)}</p>
          <p className="text-sm text-indigo-600">{estimate.reach_percentage}% of addressable universe</p>
          <p className={`text-xs mt-1 font-medium ${CONFIDENCE_COLOR[estimate.confidence]}`}>
            {estimate.confidence} confidence
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {signals.length === 0 ? (
          <p className="text-sm text-gray-400 text-center mt-8">No signals yet. Chat with AI to build your audience.</p>
        ) : (
          signals.map(s => <SignalCard key={s.id} signal={s} onRemove={isConfirmed ? undefined : onRemoveSignal} />)
        )}
      </div>

      {!isConfirmed && signals.length > 0 && (
        <div className="p-4 border-t">
          <button onClick={onConfirm} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg text-sm transition-colors">
            Confirm Audience
          </button>
        </div>
      )}
      {isConfirmed && (
        <div className="p-4 border-t">
          <div className="bg-green-50 text-green-700 text-sm text-center py-2 rounded-lg font-medium">Audience Confirmed</div>
        </div>
      )}
    </div>
  )
}
