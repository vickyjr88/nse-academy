import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from './encryption.service';
import axios, { AxiosInstance } from 'axios';
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
  private xClient: Map<string, AxiosInstance> = new Map();
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
  ): Promise<{ postId: string; url: string }> {
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

      // Create the post
      const postData: any = { text: content };
      if (mediaIds.length > 0) {
        postData.media = {
          media_ids: mediaIds,
        };
      }

      const client = this.getXClient(decryptedCreds);
      const response = await client.post<XPostResponse>('/tweets', postData);

      const postId = response.data.data.id;

      // Store the post record for future reference
      await (this.prisma as any).socialMediaPost.create({
        data: {
          credentialId,
          platform: 'x',
          reportType: 'daily',
          reportId,
          externalPostId: postId,
          content,
          mediaUrls: mediaUrls || [],
          status: 'published',
          publishedAt: new Date(),
        },
      });

      return {
        postId,
        url: `https://twitter.com/i/web/status/${postId}`,
      };
    } catch (error) {
      await this.logFailedPost(credentialId, content, mediaUrls, (error as Error).message, reportId);
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

      // Create the main post
      const postData: any = { text: reportContent };
      if (mediaIds.length > 0) {
        postData.media = {
          media_ids: mediaIds,
        };
      }

      const client = this.getXClient(decryptedCreds);
      const response = await client.post<XPostResponse>('/tweets', postData);

      const postId = response.data.data.id;

      // Store the post record
      await (this.prisma as any).socialMediaPost.create({
        data: {
          credentialId,
          platform: 'x',
          reportType: 'daily',
          reportId: reportDate,
          externalPostId: postId,
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
   * Resend a previously published post to X
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

      if (post.status !== 'published') {
        throw new BadRequestException('Only published posts can be resent');
      }

      // Resend the post
      const result = await this.postToX(
        post.credentialId,
        post.content,
        post.mediaUrls,
        post.reportId,
      );

      return result;
    } catch (error) {
      throw new InternalServerErrorException(`Failed to resend post: ${error.message}`);
    }
  }

  /**
   * Store X credentials (encrypted)
   */
  async storeCredentials(
    accountName: string,
    credentials: XCredentials,
  ): Promise<{ id: string }> {
    const encryptedCreds = {
      apiKey: this.encryption.encrypt(credentials.apiKey),
      apiSecret: this.encryption.encrypt(credentials.apiSecret),
      accessToken: this.encryption.encrypt(credentials.accessToken),
      accessTokenSecret: this.encryption.encrypt(credentials.accessTokenSecret),
    };

    const credential = await (this.prisma as any).socialMediaCredential.upsert({
      where: {
        platform_accountName: {
          platform: 'x',
          accountName,
        },
      },
      update: {
        ...encryptedCreds,
        isActive: true,
        lastTestedAt: new Date(),
      },
      create: {
        platform: 'x',
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
      const client = this.getXClient(decryptedCreds);

      // Test with a simple API call
      await client.get('/tweets/search/recent?query=test&max_results=10');

      // Update last tested time
      await (this.prisma as any).socialMediaCredential.update({
        where: { id: credentialId },
        data: { lastTestedAt: new Date() },
      });

      return { success: true, message: 'Credentials are valid' };
    } catch (error) {
      return { success: false, message: `Credential test failed: ${(error as Error).message}` };
    }
  }

  /**
   * Get all active X credentials
   */
  async getActiveCredentials() {
    return (this.prisma as any).socialMediaCredential.findMany({
      where: {
        platform: 'x',
        isActive: true,
      },
      select: {
        id: true,
        accountName: true,
        lastTestedAt: true,
        createdAt: true,
      },
    });
  }

  /**
   * Disable a credential
   */
  async disableCredential(credentialId: string): Promise<void> {
    await (this.prisma as any).socialMediaCredential.update({
      where: { id: credentialId },
      data: { isActive: false },
    });
  }

  /**
   * Get posts history
   */
  async getPostHistory(credentialId?: string, limit = 50) {
    return (this.prisma as any).socialMediaPost.findMany({
      where: credentialId ? { credentialId, platform: 'x' } : { platform: 'x' },
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

  private getXClient(credentials: XCredentials): AxiosInstance {
    const key = `${credentials.apiKey}:${credentials.accessToken}`;

    if (this.xClient.has(key)) {
      return this.xClient.get(key)!;
    }

    // Create OAuth 1.0a Authorization header
    const authHeader = this.createOAuthHeader(
      'POST',
      `${this.TWITTER_API_URL}/tweets`,
      credentials,
    );

    const client = axios.create({
      baseURL: this.TWITTER_API_URL,
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
    });

    this.xClient.set(key, client);
    return client;
  }

  private createOAuthHeader(
    method: string,
    url: string,
    credentials: XCredentials,
  ): string {
    // OAuth 1.0a header construction for X API
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: credentials.apiKey,
      oauth_token: credentials.accessToken,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_nonce: Math.random().toString(36).substring(2, 15),
      oauth_version: '1.0',
    };

    // Create signature base string
    const sortedParams = Object.keys(oauthParams)
      .sort()
      .map((key) => `${key}=${encodeURIComponent(oauthParams[key])}`)
      .join('&');

    const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;

    // Create signing key
    const signingKey = `${encodeURIComponent(credentials.apiSecret)}&${encodeURIComponent(credentials.accessTokenSecret)}`;

    // Create signature
    const signature = crypto
      .createHmac('sha1', signingKey)
      .update(baseString)
      .digest('base64');

    oauthParams.oauth_signature = signature;

    // Build Authorization header
    const authHeader = `OAuth ${Object.keys(oauthParams)
      .sort()
      .map((key) => `${key}="${encodeURIComponent(oauthParams[key])}"`)
      .join(', ')}`;

    return authHeader;
  }

  private async uploadMedia(credentials: XCredentials, mediaUrls: string[]): Promise<string[]> {
    const mediaIds: string[] = [];

    for (const url of mediaUrls.slice(0, 4)) {
      // X allows max 4 media per tweet
      try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const mediaData = Buffer.from(response.data);

        const form = new FormData();
        form.append('media_data', mediaData.toString('base64'));

        const authHeader = this.createOAuthHeader(
          'POST',
          this.TWITTER_UPLOAD_URL,
          credentials,
        );

        const uploadResponse = await axios.post<{ media_id_string: string }>(
          this.TWITTER_UPLOAD_URL,
          form,
          {
            headers: {
              ...form.getHeaders(),
              Authorization: authHeader,
            },
          },
        );

        mediaIds.push(uploadResponse.data.media_id_string);
      } catch (error) {
        console.error(`Failed to upload media from ${url}:`, error.message);
        // Continue with other media if one fails
      }
    }

    return mediaIds;
  }

  private async logFailedPost(
    credentialId: string,
    content: string,
    mediaUrls: string[] | undefined,
    error: string,
    reportId?: string,
  ): Promise<void> {
    try {
      await (this.prisma as any).socialMediaPost.create({
        data: {
          credentialId,
          platform: 'x',
          reportType: 'daily',
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
