import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Flex,
  Link,
  Loader,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Typography,
  TextInput,
  Textarea,
  Alert,
} from '@strapi/design-system';
import { Check, ExternalLink, Trash, Plus } from '@strapi/icons';
import styled from 'styled-components';
import { NSE_API_URL, NSE_ADMIN_KEY } from '../index';

const StyledLink = styled(Link)`
  color: #0066cc;
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
`;

async function fetchJson(path: string, options?: RequestInit) {
  const res = await fetch(`${NSE_API_URL}${path}`, {
    headers: { 'x-admin-key': NSE_ADMIN_KEY },
    ...options,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const SocialMediaMarketingPage: React.FC = () => {
  const [credentials, setCredentials] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState<any>(null);
  const [formData, setFormData] = useState({
    accountName: '',
    apiKey: '',
    apiSecret: '',
    accessToken: '',
    accessTokenSecret: '',
  });
  const [postData, setPostData] = useState({
    credentialId: '',
    content: '',
    mediaUrls: '',
  });

  useEffect(() => {
    loadCredentials();
    loadPosts();
  }, []);

  const showNotification = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadCredentials = async () => {
    try {
      setLoading(true);
      const data = await fetchJson('/marketing/x/credentials');
      setCredentials(data || []);
    } catch (error: any) {
      showNotification('warning', `Failed to load credentials: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadPosts = async () => {
    try {
      const data = await fetchJson('/marketing/x/posts');
      setPosts(data || []);
    } catch (error: any) {
      showNotification('warning', `Failed to load posts: ${error.message}`);
    }
  };

  const handleAddCredential = async () => {
    try {
      setLoading(true);
      await fetchJson('/marketing/x/credentials', {
        method: 'POST',
        body: JSON.stringify(formData),
        headers: { 'Content-Type': 'application/json' },
      });
      showNotification('success', 'X credentials saved successfully');
      setFormData({
        accountName: '',
        apiKey: '',
        apiSecret: '',
        accessToken: '',
        accessTokenSecret: '',
      });
      setShowAddModal(false);
      loadCredentials();
    } catch (error: any) {
      showNotification('warning', `Failed to save credentials: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTestCredential = async (credentialId: string) => {
    try {
      setLoading(true);
      const data = await fetchJson(`/marketing/x/test/${credentialId}`, { method: 'POST' });
      if (data.success) {
        showNotification('success', 'Credentials are valid!');
      } else {
        showNotification('warning', data.message);
      }
      loadCredentials();
    } catch (error: any) {
      showNotification('warning', `Test failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCredential = async (credentialId: string) => {
    if (window.confirm('Are you sure you want to disable this credential?')) {
      try {
        setLoading(true);
        await fetchJson(`/marketing/x/credentials/${credentialId}`, { method: 'DELETE' });
        showNotification('success', 'Credential disabled successfully');
        loadCredentials();
      } catch (error: any) {
        showNotification('warning', `Failed to delete credential: ${error.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handlePostToX = async () => {
    if (!postData.credentialId || !postData.content) {
      showNotification('warning', 'Please select a credential and enter content');
      return;
    }

    try {
      setLoading(true);
      await fetchJson('/marketing/x/post', {
        method: 'POST',
        body: JSON.stringify(postData),
        headers: { 'Content-Type': 'application/json' },
      });
      showNotification('success', 'Posted to X successfully!');
      setPostData({ credentialId: '', content: '', mediaUrls: '' });
      setShowPostModal(false);
      loadPosts();
    } catch (error: any) {
      showNotification('warning', `Failed to post: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading && posts.length === 0) {
    return (
      <Box padding={8} style={{ display: 'flex', justifyContent: 'center' }}>
        <Loader>Loading X posting management…</Loader>
      </Box>
    );
  }

  return (
    <Box padding={8}>
      <Box marginBottom={6}>
        <Typography variant="alpha">X (Twitter) Auto-Posting</Typography>
      </Box>
      
      {notification && (
        <Box marginBottom={6}>
          <Alert closeLabel="Close" title={notification.type === 'success' ? 'Success' : 'Error'} variant={notification.type as any}>
            {notification.message}
          </Alert>
        </Box>
      )}

      <Box marginBottom={6}>
        <Card>
          <CardHeader>
            <Flex justifyContent="space-between" alignItems="center">
              <Typography variant="beta">X Credentials</Typography>
              <Button onClick={() => setShowAddModal(true)} startIcon={<Plus />}>
                Add Credential
              </Button>
            </Flex>
          </CardHeader>
          <Divider />
          <CardBody>
            {credentials.length === 0 ? (
              <Typography>No X credentials configured yet.</Typography>
            ) : (
              <Table>
                <Thead>
                  <Tr>
                    <Th>Account Name</Th>
                    <Th>Status</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {credentials.map((cred: any) => (
                    <Tr key={cred.id}>
                      <Td>{cred.accountName}</Td>
                      <Td>
                        {cred.isActive ? (
                          <Flex gap={2}>
                            <Check />
                            <Typography>Active</Typography>
                          </Flex>
                        ) : (
                          <Typography>Inactive</Typography>
                        )}
                      </Td>
                      <Td>
                        <Flex gap={3}>
                          <Button
                            variant="tertiary"
                            size="S"
                            onClick={() => handleTestCredential(cred.id)}
                          >
                            Test
                          </Button>
                          <Button
                            variant="tertiary"
                            size="S"
                            onClick={() => handleDeleteCredential(cred.id)}
                            startIcon={<Trash />}
                          >
                            Disable
                          </Button>
                        </Flex>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </Box>

      <Box marginBottom={6}>
        <Card>
          <CardHeader>
            <Flex justifyContent="space-between" alignItems="center">
              <Typography variant="beta">Post to X</Typography>
              {credentials.length > 0 && (
                <Button onClick={() => setShowPostModal(true)} startIcon={<Plus />}>
                  New Post
                </Button>
              )}
            </Flex>
          </CardHeader>
          <Divider />
          <CardBody>
            {posts.length === 0 ? (
              <Typography>No posts yet.</Typography>
            ) : (
              <Table>
                <Thead>
                  <Tr>
                    <Th>Account</Th>
                    <Th>Content Preview</Th>
                    <Th>Posted At</Th>
                    <Th>Status</Th>
                    <Th>Link</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {posts.map((post: any) => (
                    <Tr key={post.id}>
                      <Td>{post.accountName}</Td>
                      <Td>{post.content.substring(0, 50)}...</Td>
                      <Td>{new Date(post.createdAt).toLocaleDateString()}</Td>
                      <Td>{post.status}</Td>
                      <Td>
                        {post.postUrl && (
                          <StyledLink href={post.postUrl} target="_blank">
                            <Flex gap={2} alignItems="center">
                              View <ExternalLink />
                            </Flex>
                          </StyledLink>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </Box>

      {showAddModal && (
        <Box marginBottom={6}>
          <Card>
            <CardHeader>
              <Flex justifyContent="space-between" alignItems="center">
                <Typography variant="beta">Add X Credential</Typography>
                <Button variant="tertiary" onClick={() => setShowAddModal(false)}>Close</Button>
              </Flex>
            </CardHeader>
            <Divider />
            <CardBody>
              <Box marginBottom={4}>
                <TextInput
                  label="Account Name"
                  name="accountName"
                  value={formData.accountName}
                  onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                  placeholder="e.g., NSE Academy"
                />
              </Box>
              <Box marginBottom={4}>
                <TextInput
                  label="API Key"
                  name="apiKey"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  type="password"
                />
              </Box>
              <Box marginBottom={4}>
                <TextInput
                  label="API Secret"
                  name="apiSecret"
                  value={formData.apiSecret}
                  onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                  type="password"
                />
              </Box>
              <Box marginBottom={4}>
                <TextInput
                  label="Access Token"
                  name="accessToken"
                  value={formData.accessToken}
                  onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                  type="password"
                />
              </Box>
              <Box marginBottom={4}>
                <TextInput
                  label="Access Token Secret"
                  name="accessTokenSecret"
                  value={formData.accessTokenSecret}
                  onChange={(e) => setFormData({ ...formData, accessTokenSecret: e.target.value })}
                  type="password"
                />
              </Box>
              <Flex gap={3}>
                <Button onClick={() => setShowAddModal(false)} variant="tertiary">Cancel</Button>
                <Button onClick={handleAddCredential}>Save</Button>
              </Flex>
            </CardBody>
          </Card>
        </Box>
      )}

      {showPostModal && credentials.length > 0 && (
        <Box marginBottom={6}>
          <Card>
            <CardHeader>
              <Flex justifyContent="space-between" alignItems="center">
                <Typography variant="beta">Post to X</Typography>
                <Button variant="tertiary" onClick={() => setShowPostModal(false)}>Close</Button>
              </Flex>
            </CardHeader>
            <Divider />
            <CardBody>
              <Box marginBottom={4}>
                <label>
                  <Typography variant="pi" fontWeight="bold" marginBottom={2}>Select Account</Typography>
                  <select 
                    value={postData.credentialId}
                    onChange={(e) => setPostData({ ...postData, credentialId: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #e0e0e0' }}
                  >
                    <option value="">Choose an account...</option>
                    {credentials.map((cred: any) => (
                      <option key={cred.id} value={cred.id}>
                        {cred.accountName}
                      </option>
                    ))}
                  </select>
                </label>
              </Box>
              <Box marginBottom={4}>
                <Textarea
                  label="Post Content"
                  name="content"
                  value={postData.content}
                  onChange={(e) => setPostData({ ...postData, content: e.target.value })}
                  placeholder="Write your post (max 280 characters)"
                  maxLength={280}
                />
              </Box>
              <Box marginBottom={4}>
                <TextInput
                  label="Media URLs (comma-separated)"
                  name="mediaUrls"
                  value={postData.mediaUrls}
                  onChange={(e) => setPostData({ ...postData, mediaUrls: e.target.value })}
                  placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
                />
              </Box>
              <Flex gap={3}>
                <Button onClick={() => setShowPostModal(false)} variant="tertiary">Cancel</Button>
                <Button onClick={handlePostToX}>Post</Button>
              </Flex>
            </CardBody>
          </Card>
        </Box>
      )}
    </Box>
  );
};

export default SocialMediaMarketingPage;

