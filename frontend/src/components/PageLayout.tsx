import type React from 'react';
import { PageHeader } from './PageHeader';

export function PageLayout(props: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <PageHeader title={props.title} description={props.description} actions={props.actions} />
      <div style={{ marginTop: 16 }}>{props.children}</div>
    </div>
  );
}
