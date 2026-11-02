import type { ReactNode } from 'react';

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: ReactNode;
}

export function BottomNav({ items, activeKey, label }: { items: NavItem[]; activeKey: string; label: string }) {
  return (
    <nav className="nav" aria-label={label}>
      <ul className="nav__list">
        {items.map((item) => (
          <li key={item.key}>
            <a className="nav__item" href={item.href} aria-current={item.key === activeKey ? 'page' : undefined}>
              {item.icon}
              <span className="nav__label">{item.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
