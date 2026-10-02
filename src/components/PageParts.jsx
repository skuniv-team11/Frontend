export function PageTitle({ eyebrow, title, description }) {
  return <header className="page-title"><span>{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</header>
}

export function ActionCard({ children, action }) {
  return <aside className="action-card"><div>{children}</div>{action}</aside>
}
