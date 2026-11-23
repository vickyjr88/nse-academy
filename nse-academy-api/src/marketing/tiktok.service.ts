/**
 * TikTok photo posts through the Content Posting API.
 *
 * Direct photo posts are asynchronous: create a publish, then poll its status
 * until PUBLISH_COMPLETE. TikTok fetches the images itself, so the card URLs
 * must be publicly reachable and the site's domain must be verified in the
 * TikTok developer portal (PULL_FROM_URL).
 *
 * Unaudited apps can only post to SELF_ONLY. After the app passes TikTok's
 * audit the admin can choose PUBLIC_TO_EVERYONE on the automation screen.
 */
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from './encryption.service';
import { SocialCredential, decryptSocialCredential } from './social-credential';
import { TikTokPrivacy } from './x-automation.config';

export interface PublishedPost {
  postId: string;
  url?: string;
}

export interface CredentialTest {
  success: boolean;
  message: string;
}

const POLL_MS = 3_000;
const MAX_WAIT_MS = 120_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class TikTokService {
  private readonly logger = new Logger(TikTokService.name);
  private readonly api = 'https://open.tiktokapis.com';

  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
  ) {}

  decrypt(row: any): SocialCredential {
    return decryptSocialCredential(this.encryption, row);
  }

  async publishPhoto(
    credential: SocialCredential,
    title: string,
    description: string,
    mediaUrls: string[],
    privacy: TikTokPrivacy,
  ): Promise<PublishedPost> {
    const images = mediaUrls.filter(Boolean).slice(0, 35);
    if (images.length === 0) throw new Error('TikTok needs at least one image');
    const fresh = await this.refreshIfNeeded(credential);

    const body = {
      post_info: {
        title: title.slice(0, 90),
        description: description.slice(0, 4000),
        privacy_level: privacy,
        disable_comment: false,
        auto_add_music: true,
        brand_content_toggle: false,
        brand_organic_toggle: true,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        photo_cover_index: 0,
        photo_images: images,
      },
      post_mode: 'DIRECT_POST',
      media_type: 'PHOTO',
    };

    const created = await this.call('POST', '/v2/post/publish/content/init/', fresh.accessToken, body);
    this.assertOk(created);
    const publishId = String(created?.data?.publish_id ?? '');
    if (!publishId) throw new Error('TikTok did not return a publish id');

    const completed = await this.waitForPublish(publishId, fresh.accessToken);
    const available = completed?.publicaly_available_post_id ?? completed?.publicly_available_post_id;
    const postId = Array.isArray(available) && available.length > 0 ? String(available[0]) : publishId;
    return { postId };
  }

  async test(credential: SocialCredential): Promise<CredentialTest> {
    try {
      const fresh = await this.refreshIfNeeded(credential);
      const data = await this.call('GET', '/v2/user/info/?fields=open_id,display_name', fresh.accessToken);
      this.assertOk(data);
      const user = data?.data?.user;
      return {
        success: true,
        message: `Token is valid (${user?.display_name || user?.open_id || 'TikTok account'})`,
      };
    } catch (error) {
      return { success: false, message: `Credential test failed: ${(error as Error).message}` };
    }
  }

  /**
   * TikTok access tokens last 24 hours. A stored refresh token and the app's
   * client key/secret (in apiKey/apiSecret) keep the account posting without
   * someone pasting a new token every morning.
   */
  async refreshIfNeeded(credential: SocialCredential): Promise<SocialCredential> {
    const expiresSoon = credential.expiresAt && credential.expiresAt.getTime() - Date.now() < 60 * 60 * 1000;
    if (!expiresSoon) return credential;
    if (!credential.refreshToken || !credential.apiKey || !credential.apiSecret) {
      throw new Error('TikTok access token has expired. Add a refresh token, client key and client secret, or paste a new access token.');
    }

    try {
      const response = await axios.post(
        `${this.api}/v2/oauth/token/`,
        new URLSearchParams({
          client_key: credential.apiKey,
          client_secret: credential.apiSecret,
          grant_type: 'refresh_token',
          refresh_token: credential.refreshToken,
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30_000 },
      );
      const data = response.data;
      if (data?.error) throw new Error(`${data.error}: ${data.error_description ?? ''}`.trim());
      const token = String(data?.access_token ?? '');
      if (!token) throw new Error('TikTok did not return an access token');
      const expiresAt = new Date(Date.now() + (Number(data?.expires_in) || 86_400) * 1000);
      const refreshToken = String(data?.refresh_token ?? credential.refreshToken);
      await this.prisma.socialMediaCredential.update({
        where: { id: credential.id },
        data: {
          accessToken: this.encryption.encrypt(token),
          ...(refreshToken !== credential.refreshToken ? { refreshToken: this.encryption.encrypt(refreshToken) } : {}),
          expiresAt,
        },
      });
      this.logger.log(`Renewed the TikTok token until ${expiresAt.toISOString()}`);
      return { ...credential, accessToken: token, refreshToken, expiresAt };
    } catch (error) {
      throw new Error(`TikTok token renewal failed: ${(error as Error).message}`);
    }
  }

  private async waitForPublish(publishId: string, token: string): Promise<any> {
    const deadline = Date.now() + MAX_WAIT_MS;
    for (;;) {
      const data = await this.call('POST', '/v2/post/publish/status/fetch/', token, { publish_id: publishId });
      this.assertOk(data);
      const status = String(data?.data?.status ?? '');
      if (status === 'PUBLISH_COMPLETE' || status === 'SEND_TO_USER_INBOX') return data.data;
      if (status === 'FAILED') throw new Error(`TikTok publish failed: ${data?.data?.fail_reason ?? 'unknown reason'}`);
      if (Date.now() >= deadline) throw new Error('TikTok was still processing the post; it may appear shortly');
      await sleep(POLL_MS);
    }
  }

  private assertOk(response: any): void {
    const code = response?.error?.code;
    if (code && code !== 'ok') {
      throw new Error(`TikTok API ${code}: ${response?.error?.message ?? 'request failed'}`);
    }
  }

  private async call(method: 'GET' | 'POST', path: string, token: string, body?: unknown): Promise<any> {
    try {
      const response = await axios.request({
        method,
        url: `${this.api}${path}`,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { 'Content-Type': 'application/json; charset=UTF-8' } : {}),
        },
        data: body,
        timeout: 45_000,
      });
      return response.data;
    } catch (error) {
      const bodyData: any = (error as any)?.response?.data;
      const detail = bodyData?.error?.message || bodyData?.message || (error as Error).message;
      const code = bodyData?.error?.code;
      throw new Error(code ? `TikTok API ${code}: ${detail}` : String(detail));
    }
  }
}
