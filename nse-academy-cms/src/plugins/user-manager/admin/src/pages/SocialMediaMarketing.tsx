import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Flex,
  Icon,
  Link,
  Loader,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  Typography,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  TextInput,
  Textarea,
  Alert,
} from '@strapi/design-system';
import { Check, ExternalLink, Refresh, Trash, Plus } from '@strapi/icons';
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
      <Stack size={6}>
        <Typography variant="alpha">X (Twitter) Auto-Posting</Typography>
        
        {notification && (
          <Alert closeLabel="Close" title={notification.type === 'success' ? 'Success' : 'Error'} variant={notification.type as any}>
            {notification.message}
          </Alert>
        )}

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
              <Text>No X credentials configured yet.</Text>
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
                            <Text>Active</Text>
                          </Flex>
                        ) : (
                          <Text>Inactive</Text>
                        )}
                      </Td>
                      <Td>
                        <Flex gap={3}>
                          <Button
                            variant="tertiary"
                            size="S"
                            onClick={() => handleTestCredential(cred.id)}
                            startIcon={<Refresh />}
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
              <Text>No posts yet.</Text>
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
      </Stack>

      {showAddModal && (
        <Modal onClose={() => setShowAddModal(false)} labelledBy="add-credential-modal">
          <ModalHeader>
            <Typography variant="beta" id="add-credential-modal">
              Add X Credential
            </Typography>
          </ModalHeader>
          <ModalBody>
            <Stack size={4}>
              <TextInput
                label="Account Name"
                name="accountName"
                value={formData.accountName}
                onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                placeholder="e.g., NSE Academy"
              />
              <TextInput
                label="API Key"
                name="apiKey"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                type="password"
              />
              <TextInput
                label="API Secret"
                name="apiSecret"
                value={formData.apiSecret}
                onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                type="password"
              />
              <TextInput
                label="Access Token"
                name="accessToken"
                value={formData.accessToken}
                onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                type="password"
              />
              <TextInput
                label="Access Token Secret"
                name="accessTokenSecret"
                value={formData.accessTokenSecret}
                onChange={(e) => setFormData({ ...formData, accessTokenSecret: e.target.value })}
                type="password"
              />
            </Stack>
          </ModalBody>
          <ModalFooter
            startActions={<Button onClick={() => setShowAddModal(false)}>Cancel</Button>}
            endActions={<Button onClick={handleAddCredential}>Save</Button>}
          />
        </Modal>
      )}

      {showPostModal && credentials.length > 0 && (
        <Modal onClose={() => setShowPostModal(false)} labelledBy="post-modal">
          <ModalHeader>
            <Typography variant="beta" id="post-modal">
              Post to X
            </Typography>
          </ModalHeader>
          <ModalBody>
            <Stack size={4}>
              <TextInput
                label="Select Account"
                name="credentialId"
                value={postData.credentialId}
                onChange={(e) => setPostData({ ...postData, credentialId: e.target.value })}
                as="select"
              >
                <option value="">Choose an account...</option>
                {credentials.map((cred: any) => (
                  <option key={cred.id} value={cred.id}>
                    {cred.accountName}
                  </option>
                ))}
              </TextInput>
              <Textarea
                label="Post Content"
                name="content"
                value={postData.content}
                onChange={(e) => setPostData({ ...postData, content: e.target.value })}
                placeholder="Write your post (max 280 characters)"
                maxLength={280}
              />
              <TextInput
                label="Media URLs (comma-separated)"
                name="mediaUrls"
                value={postData.mediaUrls}
                onChange={(e) => setPostData({ ...postData, mediaUrls: e.target.value })}
                placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
              />
            </Stack>
          </ModalBody>
          <ModalFooter
            startActions={<Button onClick={() => setShowPostModal(false)}>Cancel</Button>}
            endActions={<Button onClick={handlePostToX}>Post</Button>}
          />
        </Modal>
      )}
    </Box>
  );
};

export default SocialMediaMarketingPage;
