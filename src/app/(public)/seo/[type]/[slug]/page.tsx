import { MaxWidth } from '@/components/public/MaxWidth'

const typeLabels: Record<string, string> = {
  city: 'City guide',
  industry: 'Industry playbook',
  alternatives: 'Alternative comparison',
  guides: 'Guide',
}

const typeDescriptions: Record<string, string> = {
  city: 'Localized Reddit strategy for regional communities and meetups.',
  industry: 'Tactics tailored to founders and teams in your sector.',
  alternatives: 'How ReditFast compares and when to choose each option.',
  guides: 'Step-by-step playbooks to build trusted Reddit presence.',
}

type SeoPageProps = {
  params: {
    type: string
    slug: string
  }
}

function toTitleCase(value: string) {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export default function SeoPage({ params }: SeoPageProps) {
  const label = typeLabels[params.type] ?? 'SEO guide'
  const description =
    typeDescriptions[params.type] ??
    'Learn how to build safer, higher-signal Reddit marketing campaigns.'

  return (
    <div className="pb-20 pt-16">
      <MaxWidth>
        <div className="rounded-[32px] border border-border bg-card/80 p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {label}
          </p>
          <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">
            {toTitleCase(params.slug)}
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">{description}</p>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-[24px] border border-border bg-background/70 p-6">
              <p className="text-sm font-semibold">Recommended focus</p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>Respect subreddit tone and response culture.</li>
                <li>Start with comments before launching new posts.</li>
                <li>Use best-time windows to maximize early engagement.</li>
              </ul>
            </div>
            <div className="rounded-[24px] border border-border bg-background/70 p-6">
              <p className="text-sm font-semibold">Suggested resources</p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>Post generator for headline drafts.</li>
                <li>Subreddit analyzer for rules and risk checks.</li>
                <li>Shadowban detector for visibility health.</li>
              </ul>
            </div>
          </div>
        </div>
      </MaxWidth>
    </div>
  )
}
