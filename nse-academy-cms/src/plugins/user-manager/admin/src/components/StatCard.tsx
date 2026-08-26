import React from 'react';
import { Box, Typography } from '@strapi/design-system';

export function StatCard({ label, value }: { label: string; value: string | number }) {
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
        <Typography variant="alpha" textColor="neutral800">{value}</Typography>
      </Box>
    </Box>
  );
}
