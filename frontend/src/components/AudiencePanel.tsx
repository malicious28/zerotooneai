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

const CONFIDENCE_STYLES = {
  high:   { text: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-100' },
  medium: { text: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-100' },
  low:    { text: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-100' },
}

function formatReach(n: number) {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)}Cr`
  if (n >= 100_000)    return `${(n / 100_000).toFixed(1)}L`
  return n.toLocaleString()
}

export default function AudiencePanel({ signals, estimate, isConfirmed, onRemoveSignal, onConfirm }: Props) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900 text-sm">Audience Signals</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          {signals.length} signal{signals.length !== 1 ? 's' : ''} selected
        </p>
      </div>

      {/* Reach estimate */}
      {estimate && signals.length > 0 && (
        <div className="mx-4 mt-4 bg-violet-50 border border-violet-100 rounded-2xl p-4">
          <p className="text-xs font-medium text-violet-500 uppercase tracking-wide mb-2">Estimated Reach</p>
          <p className="text-2xl font-bold text-violet-700">{formatReach(estimate.total_reach)}</p>
          <p className="text-sm text-violet-500 mt-0.5">{estimate.reach_percentage}% of addressable universe</p>
          <div className="mt-2">
            {(() => {
              const s = CONFIDENCE_STYLES[estimate.confidence]
              return (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${s.text} ${s.bg} ${s.border}`}>
                  {estimate.confidence} confidence
                </span>
              )
            })()}
          </div>
        </div>
      )}

      {/* Signals list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {signals.length === 0 ? (
          <div className="text-center mt-10 px-4">
            <div className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <p className="text-sm text-gray-400">No signals yet</p>
            <p className="text-xs text-gray-300 mt-1">Describe your target audience in the chat to generate signals</p>
          </div>
        ) : (
          signals.map(s => (
            <SignalCard key={s.id} signal={s} onRemove={isConfirmed ? undefined : onRemoveSignal} />
          ))
        )}
      </div>

      {/* Footer actions */}
      {!isConfirmed && signals.length > 0 && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100">
          <button
            onClick={onConfirm}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
          >
            Lock in Audience
          </button>
        </div>
      )}
      {isConfirmed && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100">
          <div className="bg-green-50 border border-green-100 text-green-700 text-sm text-center py-2.5 rounded-xl font-medium">
            Audience Locked In ✓
          </div>
        </div>
      )}
    </div>
  )
}
