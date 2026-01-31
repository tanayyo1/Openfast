import Link from 'next/link'
import { DraftEditor } from '@/components/app/editor/DraftEditor'

const variants = [
  {
    title: 'How we run churn interviews as a two-person SaaS',
    body: 'We started doing churn interviews every Friday. Here is the script we use and what surprised us.\n\n1) What problem were you solving?\n2) What was the moment you decided to cancel?\n3) What would have changed your mind?\n\nIf you do churn interviews, what question gives you the most honest answers?',
    riskScore: 18,
    notes: ['No links in body', 'Ends with a clear question', 'Avoids promotional claims'],
  },
  {
    title: 'Anyone else struggle to get honest churn feedback?',
    body: 'Churn feedback is often vague. We changed our approach and started asking for the decision timeline instead of feature requests.\n\nWhat has helped you get more candid answers from churned users?',
    riskScore: 42,
    notes: ['Tone is conversational', 'Keep it short for strict subs', 'No direct CTA'],
  },
  {
    title: 'A simple churn interview template (and what we learned)',
    body: 'We used a lightweight churn interview template for 20 cancellations and found patterns we did not expect.\n\nTemplate:\n- Trigger\n- Alternatives evaluated\n- Deal-breaker\n\nWhat is your most common churn reason?',
    riskScore: 28,
    notes: ['Template adds value', 'Consider adding context about your audience', 'No outbound links'],
  },
]

type DraftPageProps = {
  params: { id: string }
}

export default function DraftPage({ params }: DraftPageProps) {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Draft
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Draft {params.id}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Edit a variant, then request approval before scheduling.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/content"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Back to drafts
          </Link>
          <Link
            href="/scheduling/calendar"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Open scheduling
          </Link>
        </div>
      </div>

      <DraftEditor variants={variants} />
    </div>
  )
}
