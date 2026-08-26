import React from 'react';
import { Box, Typography } from '@strapi/design-system';

export function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: 'positive' | 'negative' | 'neutral';
}) {
  const color = tone === 'positive' ? 'success600' : tone === 'negative' ? 'danger600' : 'neutral800';
  return (
    <Box
      padding={5}
      background="neutral0"
      borderColor="neutral200"
      hasRadius
      shadow="filterShadow"
      style={{ flex: 1, minWidth: '160px' }}
    >
      <Typography variant="sigma" textColor="neutral600">{label}</Typography>
      <Box paddingTop={2}>
        <Typography variant="alpha" textColor={color}>{value}</Typography>
      </Box>
    </Box>
  );
}
