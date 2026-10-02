import type { ReactNode } from 'react'

export function PageTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return <header className="page-title"><span>{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</header>
}

export function ActionCard({ children, action }: { children: ReactNode; action: ReactNode }) {
  return <aside className="action-card"><div>{children}</div>{action}</aside>
}
