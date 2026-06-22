import { StateMessage, type StateMessageProps } from '@/components/ui/StateMessage'

export type EmptyStateProps = StateMessageProps

export function EmptyState(props: EmptyStateProps) {
  return <StateMessage {...props} />
}
