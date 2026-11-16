import React from 'react';
import styled from 'styled-components';
import { NavLink, useLocation } from 'react-router-dom';
import { SECTIONS, href, locate } from '../sections';
import { Row } from './primitives';
import { usePalette } from './theme';

const Bar = styled.nav`
  display: flex;
  flex: 0 0 auto; /* Strapi's content column is a flex box; without this the bar is squeezed to 1px */
  min-height: 44px;
  gap: 2px;
  overflow-x: auto;
  padding: 0 32px;
  background: ${({ theme }) => theme.colors.neutral0};
  border-bottom: 1px solid ${({ theme }) => theme.colors.neutral150};
`;
const TabLink = styled(NavLink)`
  padding: 12px 14px;
  font-size: 1.3rem;
  font-weight: 600;
  white-space: nowrap;
  text-decoration: none;
  color: ${({ theme }) => theme.colors.neutral600};
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  &:hover {
    color: ${({ theme }) => theme.colors.neutral800};
  }
  &.active {
    color: ${({ theme }) => theme.colors.primary700};
    border-bottom-color: ${({ theme }) => theme.colors.primary600};
  }
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary600};
    outline-offset: -2px;
  }
`;

/** The tabs of whichever section the current page belongs to. Rendered by every page automatically (see actor.tsx). */
export function SectionTabs() {
  const { pathname } = useLocation();
  const here = locate(pathname);
  if (!here) return null;
  return (
    <Bar aria-label={`${here.section.label} pages`}>
      {here.section.tabs.map((t) => (
        // `end` is off so a tab stays highlighted on its detail pages; the longest-match rule in locate() picks the tab.
        <TabLink key={t.id} to={href(t.path)} end={false} className={t.id === here.tab.id ? 'active' : ''}>
          {t.label}
        </TabLink>
      ))}
    </Bar>
  );
}

const Wrap = styled.div`
  flex: 0 0 auto;
  padding: 24px 32px 48px;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

/** The frame of a redesigned page: a title, one line saying what it is for, actions on the right, then the content. */
export function Page({ title, description, actions, children }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  const p = usePalette();
  return (
    <Wrap>
      <Row $justify="space-between" $align="flex-start" $wrap $gap={16}>
        <div style={{ minWidth: 0, maxWidth: 760 }}>
          <h1 style={{ margin: 0, fontSize: '2.4rem', lineHeight: 1.2, fontWeight: 700, color: p.text }}>{title}</h1>
          {description ? <p style={{ margin: '6px 0 0', fontSize: '1.4rem', color: p.muted }}>{description}</p> : null}
        </div>
        {actions ? <Row $gap={8}>{actions}</Row> : null}
      </Row>
      {children}
    </Wrap>
  );
}

export { SECTIONS };
