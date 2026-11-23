/**
 * Facebook Page, Instagram professional account, and Threads publishing.
 *
 * All three use Meta tokens, but they are different APIs:
 * - Facebook: a Page photo or feed post.
 * - Instagram: container -> wait for FINISHED -> media_publish. Carousels need children.
 * - Threads: container -> wait -> threads_publish.
 *
 * Media is fetched by Meta from a public URL, so the report cards have to be
 * reachable at the moment of the call. Instagram feed images must be between
 * 4:5 and 1.91:1; the API hands it the 4:5 card variant for that reason.
 */
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from './encryption.service';
import { SocialCredential, decryptSocialCredential } from './social-credential';

export interface PublishedPost {
  postId: string;
  url?: string;
}

export interface CredentialTest {
  success: boolean;
  message: string;
}

const POLL_MS = 3_000;
const MAX_WAIT_MS = 60_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class MetaService {
  private readonly logger = new Logger(MetaService.name);
  private readonly threadsApi = 'https://graph.threads.net/v1.0';

  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
  ) {}

  private get version(): string {
    return process.env.META_GRAPH_VERSION || 'v23.0';
  }

  private get graphApi(): string {
    return `https://graph.facebook.com/${this.version}`;
  }

  decrypt(row: any): SocialCredential {
    return decryptSocialCredential(this.encryption, row);
  }

  /** A Page photo post, or a text post when the slot has no image. */
  async publishFacebook(credential: SocialCredential, text: string, mediaUrls: string[]): Promise<PublishedPost> {
    const pageId = credential.externalId;
    if (!pageId) throw new Error('Facebook account has no Page ID (externalId)');
    if (!credential.accessToken) throw new Error('Facebook account has no Page access token');

    if (mediaUrls[0]) {
      const data = await this.call('POST', `${pageId}/photos`, credential.accessToken, {
        url: mediaUrls[0],
        caption: text,
        published: true,
      });
      const id = String(data?.post_id ?? data?.id ?? '');
      if (!id) throw new Error('Facebook did not return a post id');
      return { postId: id, url: `https://www.facebook.com/${id}` };
    }

    const data = await this.call('POST', `${pageId}/feed`, credential.accessToken, { message: text });
    const id = String(data?.id ?? '');
    if (!id) throw new Error('Facebook did not return a post id');
    return { postId: id, url: `https://www.facebook.com/${id}` };
  }

  /** A single image post or a carousel (2-10 images). Instagram has no text-only post. */
  async publishInstagram(credential: SocialCredential, text: string, mediaUrls: string[]): Promise<PublishedPost> {
    const igId = credential.externalId;
    if (!igId) throw new Error('Instagram account has no professional account ID (externalId)');
    if (!credential.accessToken) throw new Error('Instagram account has no access token');
    const images = mediaUrls.filter(Boolean).slice(0, 10);
    if (images.length === 0) throw new Error('Instagram needs at least one image');

    let creationId: string;
    if (images.length === 1) {
      const container = await this.call('POST', `${igId}/media`, credential.accessToken, {
        image_url: images[0],
        caption: text,
      });
      creationId = String(container?.id ?? '');
      await this.waitForInstagram(creationId, credential.accessToken);
    } else {
      const children: string[] = [];
      for (const image of images) {
        const child = await this.call('POST', `${igId}/media`, credential.accessToken, {
          image_url: image,
          is_carousel_item: true,
        });
        const id = String(child?.id ?? '');
        if (!id) throw new Error('Instagram did not return a carousel item id');
        children.push(id);
      }
      for (const child of children) await this.waitForInstagram(child, credential.accessToken);
      const parent = await this.call('POST', `${igId}/media`, credential.accessToken, {
        media_type: 'CAROUSEL',
        children: children.join(','),
        caption: text,
      });
      creationId = String(parent?.id ?? '');
      await this.waitForInstagram(creationId, credential.accessToken);
    }

    const published = await this.call('POST', `${igId}/media_publish`, credential.accessToken, {
      creation_id: creationId,
    });
    const mediaId = String(published?.id ?? '');
    if (!mediaId) throw new Error('Instagram did not return a media id');
    const link = await this.call('GET', mediaId, credential.accessToken, undefined, { fields: 'permalink' }).catch(() => null);
    return { postId: mediaId, url: link?.permalink ? String(link.permalink) : undefined };
  }

  /** A text or single-image Threads post. */
  async publishThreads(credential: SocialCredential, text: string, mediaUrls: string[]): Promise<PublishedPost> {
    const userId = credential.externalId || (await this.threadsUserId(credential));
    if (!userId) throw new Error('Threads account has no user ID (externalId)');
    if (!credential.accessToken) throw new Error('Threads account has no access token');

    const body: Record<string, unknown> = { media_type: 'TEXT', text };
    if (mediaUrls[0]) {
      body.media_type = 'IMAGE';
      body.image_url = mediaUrls[0];
    }
    const made = await this.threadsCall('POST', `${userId}/threads`, credential.accessToken, body);
    const creationId = String(made?.id ?? '');
    if (!creationId) throw new Error('Threads did not return a container id');
    await this.waitForThreads(creationId, credential.accessToken);

    const published = await this.threadsCall('POST', `${userId}/threads_publish`, credential.accessToken, {
      creation_id: creationId,
    });
    const id = String(published?.id ?? '');
    if (!id) throw new Error('Threads did not return a post id');
    const link = await this.threadsCall('GET', id, credential.accessToken, undefined, { fields: 'permalink' }).catch(() => null);
    return { postId: id, url: link?.permalink ? String(link.permalink) : undefined };
  }

  async test(credential: SocialCredential): Promise<CredentialTest> {
    try {
      if (credential.platform === 'facebook') {
        const data = await this.call('GET', credential.externalId || 'me', credential.accessToken, undefined, { fields: 'id,name' });
        return { success: true, message: `Page token is valid (${data?.name || data?.id || 'Page'})` };
      }
      if (credential.platform === 'instagram') {
        if (!credential.externalId) return { success: false, message: 'Add the Instagram professional account ID first' };
        const data = await this.call('GET', credential.externalId, credential.accessToken, undefined, { fields: 'id,username' });
        return { success: true, message: `Token is valid (${data?.username ? `@${data.username}` : data?.id})` };
      }
      if (credential.platform === 'threads') {
        const data = await this.threadsCall('GET', 'me', credential.accessToken, undefined, { fields: 'id,username' });
        return { success: true, message: `Token is valid (${data?.username ? `@${data.username}` : data?.id})` };
      }
      return { success: false, message: `Unsupported Meta platform: ${credential.platform}` };
    } catch (error) {
      return { success: false, message: `Credential test failed: ${(error as Error).message}` };
    }
  }

  /**
   * Threads tokens last 60 days and can be renewed after they are a day old.
   * Renew when the stored expiry is close; a token with no stored expiry is
   * left alone rather than risking a needless refresh failure.
   */
  async refreshThreadsIfNeeded(credential: SocialCredential): Promise<SocialCredential> {
    if (!credential.expiresAt) return credential;
    const daysLeft = (credential.expiresAt.getTime() - Date.now()) / 86_400_000;
    if (daysLeft > 7) return credential;
    try {
      const data = await this.threadsCall('GET', 'refresh_access_token', credential.accessToken, undefined, {
        grant_type: 'th_refresh_token',
      });
      const token = String(data?.access_token ?? '');
      if (!token) return credential;
      const seconds = Number(data?.expires_in) || 60 * 86_400;
      const expiresAt = new Date(Date.now() + seconds * 1000);
      await this.prisma.socialMediaCredential.update({
        where: { id: credential.id },
        data: { accessToken: this.encryption.encrypt(token), expiresAt },
      });
      this.logger.log(`Renewed the Threads token until ${expiresAt.toISOString().slice(0, 10)}`);
      return { ...credential, accessToken: token, expiresAt };
    } catch (error) {
      this.logger.warn(`Threads token renewal failed: ${(error as Error).message}`);
      return credential;
    }
  }

  private async threadsUserId(credential: SocialCredential): Promise<string | null> {
    const data = await this.threadsCall('GET', 'me', credential.accessToken, undefined, { fields: 'id,username' });
    const id = data?.id ? String(data.id) : null;
    if (id) await this.prisma.socialMediaCredential.update({ where: { id: credential.id }, data: { externalId: id } }).catch(() => undefined);
    return id;
  }

  private async waitForInstagram(containerId: string, token: string): Promise<void> {
    await this.poll(async () => {
      const data = await this.call('GET', containerId, token, undefined, { fields: 'status_code' });
      const status = String(data?.status_code ?? '');
      if (status === 'FINISHED' || status === 'PUBLISHED') return true;
      if (status === 'ERROR' || status === 'EXPIRED') throw new Error(`Instagram container ${containerId} ${status}`);
      return false;
    }, `Instagram container ${containerId} was not ready in time`);
  }

  private async waitForThreads(containerId: string, token: string): Promise<void> {
    await this.poll(async () => {
      const data = await this.threadsCall('GET', containerId, token, undefined, { fields: 'status,error_message' });
      const status = String(data?.status ?? '');
      if (status === 'FINISHED' || status === 'PUBLISHED') return true;
      if (status === 'ERROR' || status === 'EXPIRED') {
        throw new Error(`Threads container ${containerId} ${status}: ${data?.error_message ?? ''}`.trim());
      }
      return false;
    }, `Threads container ${containerId} was not ready in time`);
  }

  private async poll(check: () => Promise<boolean>, timeoutMessage: string): Promise<void> {
    const deadline = Date.now() + MAX_WAIT_MS;
    for (;;) {
      if (await check()) return;
      if (Date.now() >= deadline) throw new Error(timeoutMessage);
      await sleep(POLL_MS);
    }
  }

  private async call(
    method: 'GET' | 'POST',
    path: string,
    token: string,
    body?: Record<string, unknown>,
    query?: Record<string, string>,
  ): Promise<any> {
    try {
      const response = await axios.request({
        method,
        url: `${this.graphApi}/${path.replace(/^\//, '')}`,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        data: body,
        params: query,
        timeout: 45_000,
      });
      return response.data;
    } catch (error) {
      throw new Error(this.describe(error));
    }
  }

  private async threadsCall(
    method: 'GET' | 'POST',
    path: string,
    token: string,
    body?: Record<string, unknown>,
    query?: Record<string, string>,
  ): Promise<any> {
    try {
      const response = await axios.request({
        method,
        url: `${this.threadsApi}/${path.replace(/^\//, '')}`,
        data: method === 'POST' ? { ...(body ?? {}), access_token: token } : undefined,
        params: method === 'GET' ? { ...(query ?? {}), access_token: token } : undefined,
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
        timeout: 45_000,
      });
      return response.data;
    } catch (error) {
      throw new Error(this.describe(error));
    }
  }

  private describe(error: any): string {
    const status = error?.response?.status;
    const body = error?.response?.data;
    const detail =
      body?.error?.error_user_msg ||
      body?.error?.message ||
      body?.error_description ||
      (typeof body === 'string' ? body.slice(0, 240) : '') ||
      error?.message;
    const code = body?.error?.code ?? body?.error?.error_subcode ?? status;
    return code ? `Meta API ${code}: ${detail}` : String(detail);
  }
}
