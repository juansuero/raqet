import { Loader2 } from 'lucide-react'

interface LoadingGenerationStateProps {
  title: string
  steps: string[]
  currentStep: number
}

export function LoadingGenerationState({ title, steps, currentStep }: LoadingGenerationStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Loader2 className="w-8 h-8 text-accent animate-spin mb-4" />
      <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
      <div className="mt-4 space-y-2 w-full max-w-xs">
        {steps.map((step, index) => (
          <div
            key={step}
            className={`flex items-center gap-3 text-sm ${
              index < currentStep
                ? 'text-success'
                : index === currentStep
                ? 'text-foreground font-medium'
                : 'text-muted'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                index < currentStep
                  ? 'bg-success text-white'
                  : index === currentStep
                  ? 'bg-accent text-white'
                  : 'bg-border text-muted'
              }`}
            >
              {index < currentStep ? '✓' : index + 1}
            </div>
            {step}
          </div>
        ))}
      </div>
    </div>
  )
}
