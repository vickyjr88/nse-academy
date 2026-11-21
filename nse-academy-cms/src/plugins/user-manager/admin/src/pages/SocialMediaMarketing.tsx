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
import { useFetchClient, useNotification } from '@strapi/helper-plugin';
import styled from 'styled-components';

const StyledLink = styled(Link)`
  color: #0066cc;
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
`;

const SocialMediaMarketingPage: React.FC = () => {
  const fetchClient = useFetchClient();
  const { toggleNotification } = useNotification();
  const [credentials, setCredentials] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
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

  const loadCredentials = async () => {
    try {
      setLoading(true);
      const { data } = await fetchClient.get('/marketing/x/credentials');
      setCredentials(data || []);
    } catch (error: any) {
      toggleNotification({
        type: 'warning',
        message: `Failed to load credentials: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPosts = async () => {
    try {
      const { data } = await fetchClient.get('/marketing/x/posts');
      setPosts(data || []);
    } catch (error: any) {
      toggleNotification({
        type: 'warning',
        message: `Failed to load posts: ${error.message}`,
      });
    }
  };

  const handleAddCredential = async () => {
    try {
      setLoading(true);
      await fetchClient.post('/marketing/x/credentials', formData);
      toggleNotification({
        type: 'success',
        message: 'X credentials saved successfully',
      });
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
      toggleNotification({
        type: 'warning',
        message: `Failed to save credentials: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestCredential = async (credentialId: string) => {
    try {
      setLoading(true);
      const { data } = await fetchClient.post(`/marketing/x/test/${credentialId}`, {});
      if (data.success) {
        toggleNotification({
          type: 'success',
          message: 'Credentials are valid!',
        });
      } else {
        toggleNotification({
          type: 'warning',
          message: data.message,
        });
      }
      loadCredentials();
    } catch (error: any) {
      toggleNotification({
        type: 'warning',
        message: `Test failed: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCredential = async (credentialId: string) => {
    if (window.confirm('Are you sure you want to disable this credential?')) {
      try {
        setLoading(true);
        await fetchClient.delete(`/marketing/x/credentials/${credentialId}`);
        toggleNotification({
          type: 'success',
          message: 'Credential disabled successfully',
        });
        loadCredentials();
      } catch (error: any) {
        toggleNotification({
          type: 'warning',
          message: `Failed to delete credential: ${error.message}`,
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const handlePostToX = async () => {
    if (!postData.credentialId || !postData.content) {
      toggleNotification({
        type: 'warning',
        message: 'Please select a credential and enter content',
      });
      return;
    }

    try {
      setLoading(true);
      const mediaUrls = postData.mediaUrls
        .split('\n')
        .map((url) => url.trim())
        .filter((url) => url);

      const { data } = await fetchClient.post('/marketing/x/post', {
        credentialId: postData.credentialId,
        content: postData.content,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
      });

      toggleNotification({
        type: 'success',
        message: 'Post published to X successfully!',
      });

      setPostData({ credentialId: '', content: '', mediaUrls: '' });
      setShowPostModal(false);
      loadPosts();
    } catch (error: any) {
      toggleNotification({
        type: 'warning',
        message: `Failed to post: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendPost = async (postId: string) => {
    if (window.confirm('Are you sure you want to resend this post?')) {
      try {
        setLoading(true);
        await fetchClient.post(`/marketing/x/resend/${postId}`, {});
        toggleNotification({
          type: 'success',
          message: 'Post resent to X successfully!',
        });
        loadPosts();
      } catch (error: any) {
        toggleNotification({
          type: 'warning',
          message: `Failed to resend post: ${error.message}`,
        });
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Box padding={8} background="neutral100">
      <Stack spacing={6}>
        <Box>
          <Typography variant="alpha">Social Media Marketing (X/Twitter)</Typography>
          <Typography variant="epsilon" textColor="neutral600">
            Manage your X API credentials and post daily reports to Twitter
          </Typography>
        </Box>

        {/* Credentials Section */}
        <Card>
          <CardHeader>
            <Flex justifyContent="space-between" alignItems="center" width="100%">
              <Typography variant="beta">X API Credentials</Typography>
              <Button
                onClick={() => setShowAddModal(true)}
                variant="default"
                startIcon={<Plus />}
              >
                Add Credential
              </Button>
            </Flex>
          </CardHeader>
          <Divider />
          <CardBody>
            {loading ? (
              <Flex justifyContent="center" padding={4}>
                <Loader />
              </Flex>
            ) : credentials.length === 0 ? (
              <Text textColor="neutral600">No credentials configured. Add one to get started.</Text>
            ) : (
              <Table>
                <Thead>
                  <Tr>
                    <Th>
                      <Text bold>Account</Text>
                    </Th>
                    <Th>
                      <Text bold>Last Tested</Text>
                    </Th>
                    <Th>
                      <Text bold>Actions</Text>
                    </Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {credentials.map((cred) => (
                    <Tr key={cred.id}>
                      <Td>
                        <Text>{cred.accountName}</Text>
                      </Td>
                      <Td>
                        <Text>{cred.lastTestedAt ? new Date(cred.lastTestedAt).toLocaleDateString() : 'Never'}</Text>
                      </Td>
                      <Td>
                        <Flex gap={2}>
                          <Button
                            onClick={() => handleTestCredential(cred.id)}
                            variant="tertiary"
                            size="S"
                            startIcon={<Check />}
                          >
                            Test
                          </Button>
                          <Button
                            onClick={() => handleDeleteCredential(cred.id)}
                            variant="danger"
                            size="S"
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

        {/* Post Composer Section */}
        <Card>
          <CardHeader>
            <Flex justifyContent="space-between" alignItems="center" width="100%">
              <Typography variant="beta">Post to X</Typography>
              <Button
                onClick={() => setShowPostModal(true)}
                variant="default"
                startIcon={<Plus />}
              >
                New Post
              </Button>
            </Flex>
          </CardHeader>
        </Card>

        {/* Posts History Section */}
        <Card>
          <CardHeader>
            <Typography variant="beta">Recent Posts</Typography>
          </CardHeader>
          <Divider />
          <CardBody>
            {loading ? (
              <Flex justifyContent="center" padding={4}>
                <Loader />
              </Flex>
            ) : posts.length === 0 ? (
              <Text textColor="neutral600">No posts yet.</Text>
            ) : (
              <Table>
                <Thead>
                  <Tr>
                    <Th>
                      <Text bold>Account</Text>
                    </Th>
                    <Th>
                      <Text bold>Content</Text>
                    </Th>
                    <Th>
                      <Text bold>Published</Text>
                    </Th>
                    <Th>
                      <Text bold>Status</Text>
                    </Th>
                    <Th>
                      <Text bold>Actions</Text>
                    </Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {posts.map((post) => (
                    <Tr key={post.id}>
                      <Td>
                        <Text>{post.credential?.accountName || 'Unknown'}</Text>
                      </Td>
                      <Td>
                        <Text size="S">{post.content.substring(0, 50)}...</Text>
                      </Td>
                      <Td>
                        <Text>{new Date(post.publishedAt).toLocaleDateString()}</Text>
                      </Td>
                      <Td>
                        {post.status === 'published' ? (
                          <Text textColor="success600">{post.status}</Text>
                        ) : (
                          <Text textColor="danger600">{post.status}</Text>
                        )}
                      </Td>
                      <Td>
                        <Flex gap={2}>
                          {post.externalPostId && !post.externalPostId.startsWith('failed_') && (
                            <StyledLink
                              href={`https://twitter.com/i/web/status/${post.externalPostId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Icon as={ExternalLink} />
                            </StyledLink>
                          )}
                          {post.status === 'published' && (
                            <Button
                              onClick={() => handleResendPost(post.id)}
                              variant="tertiary"
                              size="S"
                              startIcon={<Refresh />}
                            >
                              Resend
                            </Button>
                          )}
                        </Flex>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </Stack>

      {/* Add Credential Modal */}
      {showAddModal && (
        <Modal onClose={() => setShowAddModal(false)} size="L">
          <ModalHeader>Add X API Credentials</ModalHeader>
          <ModalBody>
            <Stack spacing={3} padding={2}>
              <TextInput
                label="Account Name (Display)"
                name="accountName"
                value={formData.accountName}
                onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                placeholder="e.g., @myhandle"
              />
              <TextInput
                label="API Key (Consumer Key)"
                name="apiKey"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                type="password"
              />
              <TextInput
                label="API Secret (Consumer Secret)"
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
            endActions={
              <Button onClick={handleAddCredential} loading={loading}>
                Save Credentials
              </Button>
            }
          />
        </Modal>
      )}

      {/* Post Modal */}
      {showPostModal && (
        <Modal onClose={() => setShowPostModal(false)} size="L">
          <ModalHeader>Post to X</ModalHeader>
          <ModalBody>
            <Stack spacing={3} padding={2}>
              {credentials.length > 0 ? (
                <>
                  <Box>
                    <Text bold>Select Account</Text>
                    <select
                      value={postData.credentialId}
                      onChange={(e) => setPostData({ ...postData, credentialId: e.target.value })}
                      style={{ width: '100%', padding: '8px', marginTop: '8px' }}
                    >
                      <option value="">Choose an account...</option>
                      {credentials.map((cred) => (
                        <option key={cred.id} value={cred.id}>
                          {cred.accountName}
                        </option>
                      ))}
                    </select>
                  </Box>
                  <Textarea
                    label="Post Content"
                    name="content"
                    value={postData.content}
                    onChange={(e) => setPostData({ ...postData, content: e.target.value })}
                    placeholder="Write your post here (280 characters max)"
                  />
                  <Textarea
                    label="Media URLs (one per line)"
                    name="mediaUrls"
                    value={postData.mediaUrls}
                    onChange={(e) => setPostData({ ...postData, mediaUrls: e.target.value })}
                    placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                  />
                </>
              ) : (
                <Alert
                  variant="warning"
                  title="No Credentials"
                  description="Please add X API credentials first"
                />
              )}
            </Stack>
          </ModalBody>
          <ModalFooter
            startActions={<Button onClick={() => setShowPostModal(false)}>Cancel</Button>}
            endActions={
              <Button onClick={handlePostToX} loading={loading}>
                Post Now
              </Button>
            }
          />
        </Modal>
      )}
    </Box>
  );
};

export default SocialMediaMarketingPage;
