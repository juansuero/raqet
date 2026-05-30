import { Lightbulb, AlertTriangle, CheckCircle } from 'lucide-react'

interface AIInsightBoxProps {
  type?: 'insight' | 'alert' | 'success'
  title: string
  children: React.ReactNode
}

export function AIInsightBox({ type = 'insight', title, children }: AIInsightBoxProps) {
  const styles = {
    insight: 'bg-accent-light border-accent-muted/30',
    alert: 'bg-warning/10 border-warning/30',
    success: 'bg-success/10 border-success/30',
  }

  const icons = {
    insight: <Lightbulb className="w-5 h-5 text-accent" />,
    alert: <AlertTriangle className="w-5 h-5 text-warning" />,
    success: <CheckCircle className="w-5 h-5 text-success" />,
  }

  return (
    <div className={`readable-panel rounded-card border p-4 ${styles[type]}`}>
      <div className="flex items-start gap-3">
        {icons[type]}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground mb-1">{title}</p>
          <div className="max-w-[54ch] text-sm text-muted leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  )
}
