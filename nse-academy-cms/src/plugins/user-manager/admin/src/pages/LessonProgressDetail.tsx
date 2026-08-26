import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Loader, Typography, Flex } from '@strapi/design-system';
import { ArrowLeft } from '@strapi/icons';
import { NSE_API_URL, NSE_ADMIN_KEY } from '../index';

interface LessonProgress {
  id: string;
  lessonId: string;
  completed: boolean;
  completedAt: string | null;
  user: { id: string; name: string; email: string };
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box paddingTop={2}>
      <Typography variant="pi" fontWeight="bold">{label}:</Typography> <Typography>{value}</Typography>
    </Box>
  );
}

export function LessonProgressDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [progress, setProgress] = useState<LessonProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${NSE_API_URL}/admin/lesson-progress/${id}`, {
          headers: { 'x-admin-key': NSE_ADMIN_KEY },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setProgress(await res.json());
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <Box padding={8} style={{ display: 'flex', justifyContent: 'center' }}>
        <Loader>Loading lesson progress…</Loader>
      </Box>
    );
  }

  if (error || !progress) {
    return (
      <Box padding={8}>
        <Typography textColor="danger600">Failed to load lesson progress: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box padding={8}>
      <Box paddingBottom={4}>
        <Button variant="tertiary" startIcon={<ArrowLeft />} onClick={() => navigate(-1)}>
          Back
        </Button>
      </Box>

      <Box paddingBottom={4}>
        <Typography variant="alpha">{progress.lessonId}</Typography>
      </Box>

      <Flex gap={4}>
        <Box background="neutral0" padding={4} shadow="filterShadow" hasRadius style={{ flex: 1 }}>
          <Typography variant="beta">Learner</Typography>
          <Field label="Name" value={progress.user.name} />
          <Field label="Email" value={progress.user.email} />
        </Box>

        <Box background="neutral0" padding={4} shadow="filterShadow" hasRadius style={{ flex: 1 }}>
          <Typography variant="beta">Progress</Typography>
          <Field label="Lesson ID" value={progress.lessonId} />
          <Field
            label="Status"
            value={
              <Typography textColor={progress.completed ? 'success600' : 'warning600'}>
                {progress.completed ? 'Completed' : 'In Progress'}
              </Typography>
            }
          />
          <Field
            label="Completed At"
            value={progress.completedAt ? new Date(progress.completedAt).toLocaleString() : '—'}
          />
        </Box>
      </Flex>
    </Box>
  );
}
