import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Loader,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Typography,
  TextInput,
  SingleSelect,
  SingleSelectOption,
  Flex,
} from '@strapi/design-system';
import { NSE_API_URL, NSE_ADMIN_KEY } from '../index';

interface LessonProgress {
  id: string;
  lessonId: string;
  completed: boolean;
  completedAt: string | null;
  user: {
    name: string;
    email: string;
  };
}

interface LessonProgressResponse {
  data: LessonProgress[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function LessonProgressList() {
  const [progresses, setProgresses] = useState<LessonProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [completed, setCompleted] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => fetchProgress(1), 300);
    return () => clearTimeout(timer);
  }, [search, completed]);

  useEffect(() => {
    fetchProgress(page);
  }, [page]);

  async function fetchProgress(p: number) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: '20',
      });
      if (search) params.append('search', search);
      if (completed) params.append('completed', completed);

      const res = await fetch(`${NSE_API_URL}/admin/lesson-progress?${params.toString()}`, {
        headers: { 'x-admin-key': NSE_ADMIN_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: LessonProgressResponse = await res.json();
      setProgresses(json.data);
      setTotalPages(json.totalPages);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Box padding={8} style={{ display: 'flex', justifyContent: 'center' }}>
        <Loader>Loading lesson progress…</Loader>
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding={8}>
        <Typography textColor="danger600">Failed to load lesson progress: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box padding={8}>
      <Box paddingBottom={4}>
        <Typography variant="alpha">Lesson Progress</Typography>
      </Box>

      <Box paddingBottom={4}>
        <Flex gap={4}>
          <Box style={{ width: '300px' }}>
            <TextInput
              placeholder="Search by user or lesson ID..."
              label="Search"
              name="search"
              value={search}
              onChange={(e: any) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </Box>
          <Box style={{ width: '200px' }}>
            <SingleSelect
              label="Completed Status"
              value={completed}
              onChange={(v: string) => { setCompleted(v); setPage(1); }}
              onClear={() => { setCompleted(''); setPage(1); }}
            >
              <SingleSelectOption value="true">Completed</SingleSelectOption>
              <SingleSelectOption value="false">Incomplete</SingleSelectOption>
            </SingleSelect>
          </Box>
        </Flex>
      </Box>

      <Table colCount={5} rowCount={progresses.length}>
        <Thead>
          <Tr>
            <Th><Typography variant="sigma">User</Typography></Th>
            <Th><Typography variant="sigma">Email</Typography></Th>
            <Th><Typography variant="sigma">Lesson ID</Typography></Th>
            <Th><Typography variant="sigma">Status</Typography></Th>
            <Th><Typography variant="sigma">Completed At</Typography></Th>
          </Tr>
        </Thead>
        <Tbody>
          {progresses.map((progress) => (
            <Tr key={progress.id}>
              <Td><Typography>{progress.user?.name}</Typography></Td>
              <Td><Typography>{progress.user?.email}</Typography></Td>
              <Td><Typography>{progress.lessonId}</Typography></Td>
              <Td>
                <Typography textColor={progress.completed ? 'success600' : 'warning600'}>
                  {progress.completed ? 'Completed' : 'Incomplete'}
                </Typography>
              </Td>
              <Td>
                <Typography>
                  {progress.completedAt ? new Date(progress.completedAt).toLocaleString() : '—'}
                </Typography>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <Box paddingTop={4} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <Button
          size="S"
          variant="tertiary"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </Button>
        <Typography>Page {page} of {totalPages}</Typography>
        <Button
          size="S"
          variant="tertiary"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </Box>
    </Box>
  );
}
