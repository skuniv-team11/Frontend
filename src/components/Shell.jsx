export function Badge({ children, tone = 'gray' }) {
  return <span className={`badge ${tone}`}>{children}</span>
}

export function SidePanel({ title, children, close }) {
  return <div className="overlay" onClick={close}><aside className="side-panel" onClick={event => event.stopPropagation()}><button className="close" onClick={close}>×</button><h2>{title}</h2>{children}</aside></div>
}

export function Modal({ children, close }) {
  return <div className="modal-backdrop" onClick={close}><div className="modal" onClick={event => event.stopPropagation()}>{children}</div></div>
}
