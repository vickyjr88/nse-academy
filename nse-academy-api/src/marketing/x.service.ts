import { BadRequestException, HttpException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from './encryption.service';
import axios from 'axios';
import FormData from 'form-data';
import * as crypto from 'crypto';

interface XCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

interface XPostResponse {
  data: {
    id: string;
    text: string;
  };
}

@Injectable()
export class XService {
  private readonly TWITTER_API_URL = 'https://api.twitter.com/2';
  private readonly TWITTER_UPLOAD_URL = 'https://upload.twitter.com/1.1/media/upload.json';

  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
  ) {}

  /**
   * Post a text message to X with optional media
   */
  async postToX(
    credentialId: string,
    content: string,
    mediaUrls?: string[],
    reportId?: string,
    opts?: { reportType?: string; quoteTweetId?: string },
  ): Promise<{ postId: string; url: string }> {
    const reportType = opts?.reportType ?? 'daily';
    try {
      const credential = await (this.prisma as any).socialMediaCredential.findUnique({
        where: { id: credentialId },
      });

      if (!credential) {
        throw new BadRequestException('X credential not found');
      }

      if (!credential.isActive) {
        throw new BadRequestException('X credential is not active');
      }

      // Decrypt credentials
      const decryptedCreds = this.decryptCredentials(credential);

      // Upload media if provided
      let mediaIds: string[] = [];
      if (mediaUrls && mediaUrls.length > 0) {
        mediaIds = await this.uploadMedia(decryptedCreds, mediaUrls);
      }

      const postId = await this.sendTweet(decryptedCreds, content, mediaIds, opts?.quoteTweetId);

      const url = `https://twitter.com/i/web/status/${postId}`;

      // Store the post record for future reference
      await (this.prisma as any).socialMediaPost.create({
        data: {
          credentialId,
          platform: 'x',
          reportType,
          reportId,
          externalPostId: postId,
          url,
          content,
          mediaUrls: mediaUrls || [],
          quoteTweetId: opts?.quoteTweetId,
          status: 'published',
          publishedAt: new Date(),
        },
      });

      return { postId, url };
    } catch (error) {
      await this.logFailedPost(credentialId, content, mediaUrls, (error as Error).message, reportId, reportType);
      throw new InternalServerErrorException(`Failed to post to X: ${(error as Error).message}`);
    }
  }

  /**
   * Post market report to X with card images
   * Posts main text first, then follows with card images
   */
  async postReportToX(
    credentialId: string,
    reportContent: string,
    cardImageUrls: string[],
    reportDate: string,
  ): Promise<{ postId: string; url: string; cardCount: number }> {
    try {
      const credential = await (this.prisma as any).socialMediaCredential.findUnique({
        where: { id: credentialId },
      });

      if (!credential) {
        throw new BadRequestException('X credential not found');
      }

      if (!credential.isActive) {
        throw new BadRequestException('X credential is not active');
      }

      // Decrypt credentials
      const decryptedCreds = this.decryptCredentials(credential);

      // Upload card images if provided (max 4 per post on X)
      let mediaIds: string[] = [];
      if (cardImageUrls && cardImageUrls.length > 0) {
        mediaIds = await this.uploadMedia(decryptedCreds, cardImageUrls.slice(0, 4));
      }

      const postId = await this.sendTweet(decryptedCreds, reportContent, mediaIds);

      // Store the post record
      await (this.prisma as any).socialMediaPost.create({
        data: {
          credentialId,
          platform: 'x',
          reportType: 'daily',
          reportId: reportDate,
          externalPostId: postId,
          url: `https://twitter.com/i/web/status/${postId}`,
          content: reportContent,
          mediaUrls: cardImageUrls || [],
          status: 'published',
          publishedAt: new Date(),
        },
      });

      return {
        postId,
        url: `https://twitter.com/i/web/status/${postId}`,
        cardCount: mediaIds.length,
      };
    } catch (error) {
      await this.logFailedPost(
        credentialId,
        reportContent,
        cardImageUrls,
        (error as Error).message,
        reportDate,
      );
      throw new InternalServerErrorException(`Failed to post report to X: ${(error as Error).message}`);
    }
  }

  /**
   * Publish a draft in place, or resend a published post as a new post.
   * A draft that quotes a stream item keeps that quote.
   */
  async resendPost(postId: string): Promise<{ postId: string; url: string }> {
    try {
      const post = await (this.prisma as any).socialMediaPost.findUnique({
        where: { id: postId },
        include: { credential: true },
      });

      if (!post) {
        throw new BadRequestException('Post not found');
      }

      if (post.status === 'draft') return this.publishDraft(post);
      if (post.status !== 'published') {
        throw new BadRequestException('Only drafts and published posts can be sent');
      }

      return await this.postToX(post.credentialId, post.content, post.mediaUrls, post.reportId, {
        reportType: post.reportType,
        quoteTweetId: post.quoteTweetId ?? undefined,
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(`Failed to resend post: ${(error as Error).message}`);
    }
  }

  /** Stores a post locally. Nothing is sent to X until the draft is published. */
  async saveDraft(input: {
    credentialId: string;
    content: string;
    reportType: string;
    reportId?: string;
    mediaUrls?: string[];
    quoteTweetId?: string;
  }): Promise<{ id: string }> {
    const row = await (this.prisma as any).socialMediaPost.create({
      data: {
        credentialId: input.credentialId,
        platform: 'x',
        reportType: input.reportType,
        reportId: input.reportId,
        externalPostId: `draft_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        content: input.content,
        mediaUrls: input.mediaUrls ?? [],
        quoteTweetId: input.quoteTweetId,
        status: 'draft',
        publishedAt: new Date(),
      },
    });
    return { id: row.id };
  }

  private async publishDraft(post: any): Promise<{ postId: string; url: string }> {
    const credential = post.credential;
    if (!credential?.isActive) throw new BadRequestException('X credential is not active');
    const decrypted = this.decryptCredentials(credential);
    const mediaIds = post.mediaUrls?.length ? await this.uploadMedia(decrypted, post.mediaUrls) : [];
    const tweetId = await this.sendTweet(decrypted, post.content, mediaIds, post.quoteTweetId ?? undefined);
    const url = `https://twitter.com/i/web/status/${tweetId}`;
    await (this.prisma as any).socialMediaPost.update({
      where: { id: post.id },
      data: { status: 'published', externalPostId: tweetId, url, publishedAt: new Date(), error: null },
    });
    return { postId: tweetId, url };
  }

  private async sendTweet(credentials: XCredentials, content: string, mediaIds: string[], quoteTweetId?: string): Promise<string> {
    const postData: Record<string, unknown> = { text: content };
    if (mediaIds.length > 0) postData.media = { media_ids: mediaIds };
    if (quoteTweetId) postData.quote_tweet_id = quoteTweetId;
    const response = await this.xApi<XPostResponse>(credentials, 'POST', '/tweets', { json: postData });
    return response.data.id;
  }

  /**
   * Store encrypted credentials for any supported platform. The same row shape
   * carries X's four OAuth keys, Meta's page/user token, and TikTok's refresh
   * token, so the admin screen and the database stay one pattern.
   */
  async storeCredentials(
    accountName: string,
    credentials: Partial<XCredentials> & {
      bearerToken?: string;
      refreshToken?: string;
      externalId?: string;
      expiresAt?: Date | null;
    },
    platform = 'x',
  ): Promise<{ id: string }> {
    const encryptedCreds = {
      // The columns are NOT NULL for historical reasons. An empty encrypted value is valid and decrypts to ''.
      apiKey: this.encryption.encrypt(credentials.apiKey?.trim() ?? ''),
      apiSecret: this.encryption.encrypt(credentials.apiSecret?.trim() ?? ''),
      accessToken: this.encryption.encrypt(credentials.accessToken?.trim() ?? ''),
      accessTokenSecret: this.encryption.encrypt(credentials.accessTokenSecret?.trim() ?? ''),
      ...(credentials.bearerToken?.trim() ? { bearerToken: this.encryption.encrypt(credentials.bearerToken.trim()) } : {}),
      ...(credentials.refreshToken?.trim() ? { refreshToken: this.encryption.encrypt(credentials.refreshToken.trim()) } : {}),
      ...(credentials.externalId?.trim() ? { externalId: credentials.externalId.trim() } : {}),
      ...(credentials.expiresAt ? { expiresAt: credentials.expiresAt } : {}),
    };

    const credential = await (this.prisma as any).socialMediaCredential.upsert({
      where: {
        platform_accountName: { platform, accountName },
      },
      update: {
        ...encryptedCreds,
        isActive: true,
        lastTestedAt: new Date(),
      },
      create: {
        platform,
        accountName,
        ...encryptedCreds,
        isActive: true,
      },
    });

    return { id: credential.id };
  }

  /**
   * Test X API credentials
   */
  async testCredentials(credentialId: string): Promise<{ success: boolean; message: string }> {
    try {
      const credential = await (this.prisma as any).socialMediaCredential.findUnique({
        where: { id: credentialId },
      });

      if (!credential) {
        return { success: false, message: 'Credential not found' };
      }

      const decryptedCreds = this.decryptCredentials(credential);

      // /users/me works on every X access tier and proves the four keys belong together.
      const me = await this.xApi<{ data: { username: string } }>(decryptedCreds, 'GET', '/users/me');

      await (this.prisma as any).socialMediaCredential.update({
        where: { id: credentialId },
        data: { lastTestedAt: new Date() },
      });

      return { success: true, message: `Credentials are valid (signed in as @${me.data.username})` };
    } catch (error) {
      return { success: false, message: `Credential test failed: ${(error as Error).message}` };
    }
  }

  /** Active accounts for one platform, or every platform when none is named. */
  async getActiveCredentials(platform?: string) {
    const rows = await (this.prisma as any).socialMediaCredential.findMany({
      where: {
        ...(platform ? { platform } : {}),
        isActive: true,
      },
      orderBy: [{ platform: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        platform: true,
        accountName: true,
        externalId: true,
        expiresAt: true,
        lastTestedAt: true,
        createdAt: true,
        bearerToken: true,
        refreshToken: true,
      },
    });
    return rows.map(
      ({
        bearerToken,
        refreshToken,
        ...rest
      }: {
        bearerToken: string | null;
        refreshToken: string | null;
      }) => ({ ...rest, hasBearer: Boolean(bearerToken), hasRefreshToken: Boolean(refreshToken) }),
    );
  }

  /**
   * Edit an account. Only the fields that are provided change, so a rotated access token can be saved without retyping the
   * API key. Changing any key clears the "last tested" mark because the new keys have not been checked yet.
   */
  async updateCredential(
    credentialId: string,
    changes: Partial<XCredentials> & {
      accountName?: string;
      bearerToken?: string;
      refreshToken?: string;
      externalId?: string;
      expiresAt?: Date | null;
    },
  ): Promise<{ id: string }> {
    const existing = await (this.prisma as any).socialMediaCredential.findUnique({ where: { id: credentialId } });
    if (!existing) throw new NotFoundException('Account not found');

    const data: Record<string, unknown> = {};
    if (changes.accountName?.trim()) data.accountName = changes.accountName.trim();
    if (changes.externalId !== undefined) data.externalId = changes.externalId.trim() || null;
    if (changes.expiresAt !== undefined) data.expiresAt = changes.expiresAt;
    for (const field of ['apiKey', 'apiSecret', 'accessToken', 'accessTokenSecret', 'refreshToken'] as const) {

      const value = changes[field]?.trim();
      if (value) data[field] = this.encryption.encrypt(value);
    }
    if (changes.bearerToken?.trim()) data.bearerToken = this.encryption.encrypt(changes.bearerToken.trim());
    // A bearer token is not part of the OAuth 1.0a posting keys, so it does not invalidate the last posting test.
    if (Object.keys(data).some((k) => !['accountName', 'bearerToken', 'externalId', 'expiresAt'].includes(k))) data.lastTestedAt = null;
    if (Object.keys(data).length === 0) return { id: credentialId };

    try {
      await (this.prisma as any).socialMediaCredential.update({ where: { id: credentialId }, data });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new BadRequestException('Another account on this platform already uses that name');
      }
      throw error;
    }
    return { id: credentialId };
  }

  /** Delete an account. Its post history goes with it (the database cascades). */
  async deleteCredential(credentialId: string): Promise<void> {
    const existing = await (this.prisma as any).socialMediaCredential.findUnique({ where: { id: credentialId } });
    if (!existing) throw new NotFoundException('Account not found');
    await (this.prisma as any).socialMediaCredential.delete({ where: { id: credentialId } });
  }

  /** Remove one entry from the post history. The post on X itself is not touched. */
  async deletePost(postId: string): Promise<void> {
    const existing = await (this.prisma as any).socialMediaPost.findUnique({ where: { id: postId } });
    if (!existing) throw new NotFoundException('Post not found');
    await (this.prisma as any).socialMediaPost.delete({ where: { id: postId } });
  }

  /** Remove every failed attempt from the post history, optionally for one platform. */
  async clearFailedPosts(platform?: string): Promise<{ deleted: number }> {
    const result = await (this.prisma as any).socialMediaPost.deleteMany({
      where: { status: 'failed', ...(platform ? { platform } : {}) },
    });
    return { deleted: result.count };
  }

  /**
   * Get posts history across platforms, or for one account/platform.
   */
  async getPostHistory(credentialId?: string, limit = 50, platform?: string) {
    return (this.prisma as any).socialMediaPost.findMany({
      where: {
        ...(credentialId ? { credentialId } : {}),
        ...(platform ? { platform } : {}),
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
      include: {
        credential: {
          select: { accountName: true },
        },
      },
    });
  }

  private decryptCredentials(credential: any): XCredentials {
    return {
      apiKey: this.encryption.decrypt(credential.apiKey),
      apiSecret: this.encryption.decrypt(credential.apiSecret),
      accessToken: this.encryption.decrypt(credential.accessToken),
      accessTokenSecret: this.encryption.decrypt(credential.accessTokenSecret),
    };
  }

  /** RFC 3986 percent-encoding, which OAuth 1.0a signatures require (encodeURIComponent leaves !'()* unescaped). */
  private pct(value: string): string {
    return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  }

  /**
   * OAuth 1.0a header for one request. It must be built per request: the timestamp and nonce are single-use, and every
   * query-string parameter has to be part of the signature. JSON and multipart bodies are not.
   */
  private createOAuthHeader(
    method: string,
    url: string,
    credentials: XCredentials,
    query: Record<string, string> = {},
  ): string {
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: credentials.apiKey,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: credentials.accessToken,
      oauth_version: '1.0',
    };

    const signedParams = { ...query, ...oauthParams };
    const paramString = Object.keys(signedParams)
      .sort()
      .map((key) => `${this.pct(key)}=${this.pct(signedParams[key])}`)
      .join('&');

    const baseString = `${method.toUpperCase()}&${this.pct(url)}&${this.pct(paramString)}`;
    const signingKey = `${this.pct(credentials.apiSecret)}&${this.pct(credentials.accessTokenSecret)}`;
    oauthParams.oauth_signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

    return `OAuth ${Object.keys(oauthParams)
      .sort()
      .map((key) => `${this.pct(key)}="${this.pct(oauthParams[key])}"`)
      .join(', ')}`;
  }

  /** Calls the X API v2 with a freshly signed request. */
  private async xApi<T>(
    credentials: XCredentials,
    method: 'GET' | 'POST',
    path: string,
    options: { query?: Record<string, string>; json?: unknown } = {},
  ): Promise<T> {
    const url = `${this.TWITTER_API_URL}${path}`;
    try {
      const response = await axios.request<T>({
        method,
        url,
        params: options.query,
        data: options.json,
        headers: {
          Authorization: this.createOAuthHeader(method, url, credentials, options.query),
          ...(options.json ? { 'Content-Type': 'application/json' } : {}),
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(this.describeXError(error));
    }
  }

  /** X explains its refusals in the response body; the bare status code alone ("403") does not say why. */
  private describeXError(error: any): string {
    const status = error?.response?.status;
    const body = error?.response?.data;
    const detail =
      body?.detail ||
      body?.errors?.map((e: any) => e.message).join('; ') ||
      body?.title ||
      (typeof body === 'string' ? body.slice(0, 200) : '') ||
      error?.message;
    const message = status ? `X API ${status}: ${detail}` : String(detail);
    return status === 401
      ? `${message}. X did not recognise the keys. Check that the API key/secret and the access token/secret are from the same app and were not regenerated since, and that none is a Bearer Token or an OAuth 2.0 Client ID/Secret.`
      : message;
  }

  private async uploadMedia(credentials: XCredentials, mediaUrls: string[]): Promise<string[]> {
    const mediaIds: string[] = [];
    let lastError = '';

    for (const url of mediaUrls.slice(0, 4)) {
      // X allows max 4 media per tweet
      try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const mediaData = Buffer.from(response.data);

        const form = new FormData();
        form.append('media_data', mediaData.toString('base64'));

        const uploadResponse = await axios.post<{ media_id_string: string }>(this.TWITTER_UPLOAD_URL, form, {
          headers: {
            ...form.getHeaders(),
            Authorization: this.createOAuthHeader('POST', this.TWITTER_UPLOAD_URL, credentials),
          },
        });

        mediaIds.push(uploadResponse.data.media_id_string);
      } catch (error) {
        lastError = this.describeXError(error);
        console.error(`Failed to upload media from ${url}: ${lastError}`);
        // One bad image does not stop the others.
      }
    }

    // Posting the text alone would silently drop the report's images, so make the failure visible instead.
    if (mediaUrls.length > 0 && mediaIds.length === 0) {
      throw new Error(`None of the ${Math.min(mediaUrls.length, 4)} images could be uploaded (${lastError})`);
    }

    return mediaIds;
  }

  /** App-only token for the filtered stream and recent search. Posting does not use this. */
  async bearerTokenFor(credentialId: string): Promise<string> {
    const credential = await (this.prisma as any).socialMediaCredential.findUnique({ where: { id: credentialId } });
    if (!credential?.bearerToken) throw new BadRequestException('This X account has no bearer token for reads');
    return this.encryption.decrypt(credential.bearerToken);
  }

  async bearerRequest<T>(
    credentialId: string,
    method: 'GET' | 'POST',
    path: string,
    options: { query?: Record<string, string>; json?: unknown } = {},
  ): Promise<T> {
    const token = await this.bearerTokenFor(credentialId);
    const url = `${this.TWITTER_API_URL}${path}`;
    try {
      const response = await axios.request<T>({
        method,
        url,
        params: options.query,
        data: options.json,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.json ? { 'Content-Type': 'application/json' } : {}),
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(this.describeXError(error));
    }
  }

  private async logFailedPost(
    credentialId: string,
    content: string,
    mediaUrls: string[] | undefined,
    error: string,
    reportId?: string,
    reportType = 'daily',
  ): Promise<void> {
    try {
      await (this.prisma as any).socialMediaPost.create({
        data: {
          credentialId,
          platform: 'x',
          reportType,
          reportId,
          externalPostId: `failed_${Date.now()}`,
          content,
          mediaUrls: mediaUrls || [],
          status: 'failed',
          error,
          publishedAt: new Date(),
        },
      });
    } catch (err) {
      console.error('Failed to log failed post:', err);
    }
  }
}
