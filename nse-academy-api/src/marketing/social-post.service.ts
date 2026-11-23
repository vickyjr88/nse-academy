/**
 * One entry point for every platform. The automation service and the manual
 * admin buttons both call this so the copy rules, draft handling, post history
 * and error messages stay identical whichever platform is switched on.
 */
import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from './encryption.service';
import { XService } from './x.service';
import { MetaService } from './meta.service';
import { TikTokService } from './tiktok.service';
import { SocialCredential, decryptSocialCredential } from './social-credential';
import { MEDIA_ONLY_PLATFORMS, PlatformTarget, SocialPlatform, TikTokPrivacy } from './x-automation.config';
import { PLATFORM_TEXT_LIMIT, platformText, tiktokFields } from './platform-copy';
import * as crypto from 'crypto';

export interface PublishOptions {
  reportType?: string;
  reportId?: string;
  mode?: 'draft' | 'live';
  /** False when the caller updates an existing history row itself (publishing a draft). */
  recordHistory?: boolean;
}

export interface Delivery {
  platform: SocialPlatform;
  status: 'posted' | 'draft' | 'skipped' | 'failed';
  postId?: string;
  url?: string;
  reason?: string;
}

export interface PlatformInfo {
  id: SocialPlatform;
  label: string;
  needsMedia: boolean;
  textLimit: number;
}

const LABELS: Record<SocialPlatform, string> = {
  x: 'X (Twitter)',
  facebook: 'Facebook Page',
  instagram: 'Instagram',
  threads: 'Threads',
  tiktok: 'TikTok',
};

@Injectable()
export class SocialPostService {
  private readonly logger = new Logger(SocialPostService.name);

  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
    private xService: XService,
    private meta: MetaService,
    private tiktok: TikTokService,
  ) {}

  platforms(): PlatformInfo[] {
    return (Object.keys(LABELS) as SocialPlatform[]).map((id) => ({
      id,
      label: LABELS[id],
      needsMedia: MEDIA_ONLY_PLATFORMS.includes(id),
      textLimit: PLATFORM_TEXT_LIMIT[id],
    }));
  }

  /** The oldest active account on a platform, or the chosen one when it is still active. */
  async resolveCredential(platform: SocialPlatform, preferredId?: string | null) {
    if (preferredId) {
      const chosen = await this.prisma.socialMediaCredential.findFirst({
        where: { id: preferredId, platform, isActive: true },
      });
      if (chosen) return chosen;
    }
    return this.prisma.socialMediaCredential.findFirst({
      where: { platform, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Tailor the X sentence for one target and publish or draft it. A platform
   * that needs an image and has none is skipped here, before any API call.
   */
  async publishTarget(
    target: PlatformTarget,
    baseText: string,
    mediaUrls: string[],
    credentialId: string,
    options: PublishOptions = {},
  ): Promise<Delivery> {
    const platform = target.platform;
    if (MEDIA_ONLY_PLATFORMS.includes(platform) && mediaUrls.filter(Boolean).length === 0) {
      return { platform, status: 'skipped', reason: 'no images' };
    }

    const content = platformText(platform, baseText, target);
    const title = platform === 'tiktok' ? tiktokFields(baseText, target).title : undefined;
    if (options.mode === 'draft') {
      const draft = await this.saveDraft(platform, credentialId, content, mediaUrls, {
        ...options,
        title,
      });
      return { platform, status: 'draft', postId: draft.id };
    }

    const result = await this.publish(platform, credentialId, content, mediaUrls, {
      ...options,
      title,
      privacy: target.tiktokPrivacy,
    });
    return { platform, status: 'posted', postId: result.postId, url: result.url };
  }

  /**
   * Publish already-tailored text. Used by the automation fan-out and by manual
   * posts; resend uses the stored text, which is already tailored.
   */
  async publish(
    platform: SocialPlatform,
    credentialId: string,
    content: string,
    mediaUrls: string[],
    options: PublishOptions & { title?: string; privacy?: TikTokPrivacy } = {},
  ): Promise<{ postId: string; url?: string }> {
    const row = await this.loadActive(credentialId, platform);
    const credential = decryptSocialCredential(this.encryption, row);
    const reportType = options.reportType ?? 'manual';
    const media = mediaUrls.filter(Boolean);

    try {
      let result: { postId: string; url?: string };
      if (platform === 'x') {
        // XService stores its own success and failure rows.
        result = await this.xService.postToX(credentialId, content, media, options.reportId, { reportType });
      } else {
        result = await this.publishToPlatform(platform, credential, content, media, options);
        if (options.recordHistory !== false) {
          await this.record(credentialId, platform, reportType, options.reportId, content, media, result);
        }
      }
      return result;
    } catch (error) {
      const message = (error as Error).message;
      if (platform !== 'x') {
        await this.logFailed(credentialId, platform, reportType, options.reportId, content, media, message);
      }
      throw new InternalServerErrorException(`Failed to post to ${LABELS[platform]}: ${message}`);
    }
  }

  /**
   * Try a failed post again with the text and images it had. A failed row is a record of an attempt, so it is replaced by
   * the outcome: the new published post on success, or the new failure (with its fresh reason) if it fails again. That
   * keeps one history entry per post instead of one more for every retry. If the account is paused or gone, nothing
   * was attempted, so the old entry stays.
   */
  private async retryFailed(
    post: { id: string; credentialId: string; reportType: string; reportId: string | null; content: string; mediaUrls?: string[] | null },
    platform: SocialPlatform,
  ): Promise<{ postId: string; url?: string }> {
    const removeOld = () => this.prisma.socialMediaPost.delete({ where: { id: post.id } }).catch(() => undefined);
    try {
      const result = await this.publish(platform, post.credentialId, post.content, post.mediaUrls ?? [], {
        reportType: post.reportType,
        reportId: post.reportId ?? undefined,
      });
      await removeOld();
      return result;
    } catch (error) {
      // publish() logs a new failed row for any attempt that reached the platform and throws a 500 for it.
      if (error instanceof InternalServerErrorException) await removeOld();
      throw error;
    }
  }

  /** Manual and resent posts publish the stored text as-is; no default suffix or hashtags are added. */
  private plainTarget(platform: SocialPlatform): PlatformTarget {
    return { platform, enabled: true, credentialId: null, suffix: '', hashtags: '', tiktokPrivacy: 'SELF_ONLY' };
  }

  /** Manual post from the admin screen. The admin writes the exact text, so it is only trimmed to the limit. */
  async postNow(
    platform: SocialPlatform,
    credentialId: string,
    content: string,
    mediaUrls: string[] = [],
    options: PublishOptions = {},
  ): Promise<{ postId: string; url?: string }> {
    const target: PlatformTarget = this.plainTarget(platform);
    if (MEDIA_ONLY_PLATFORMS.includes(platform) && mediaUrls.filter(Boolean).length === 0) {
      throw new BadRequestException(`${LABELS[platform]} needs at least one image`);
    }
    const text = platformText(platform, content, target);
    return this.publish(platform, credentialId, text, mediaUrls, {
      ...options,
      title: platform === 'tiktok' ? tiktokFields(content, target).title : undefined,
      privacy: target.tiktokPrivacy,
    });
  }

  async saveDraft(
    platform: SocialPlatform,
    credentialId: string,
    content: string,
    mediaUrls: string[],
    options: PublishOptions & { title?: string } = {},
  ): Promise<{ id: string }> {
    await this.loadActive(credentialId, platform);
    if (platform === 'x') {
      return this.xService.saveDraft({
        credentialId,
        content,
        reportType: options.reportType ?? 'manual',
        reportId: options.reportId,
        mediaUrls,
      });
    }
    const row = await this.prisma.socialMediaPost.create({
      data: {
        credentialId,
        platform,
        reportType: options.reportType ?? 'manual',
        reportId: options.reportId,
        externalPostId: `draft_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        content,
        mediaUrls,
        status: 'draft',
        publishedAt: new Date(),
      },
    });
    return { id: row.id };
  }

  /** Publish a draft in place, or send a published post again as a new post. */
  async resendPost(postId: string): Promise<{ postId: string; url?: string }> {
    const post = await this.prisma.socialMediaPost.findUnique({ where: { id: postId } });
    if (!post) throw new BadRequestException('Post not found');
    const platform = post.platform as SocialPlatform;
    if (post.status === 'failed') return this.retryFailed(post, platform);
    if (platform === 'x') return this.xService.resendPost(postId);

    if (post.status === 'draft') {
      // Publish in place: the draft row becomes the published row, so one post yields one history entry.
      const result = await this.publish(platform, post.credentialId, post.content, post.mediaUrls ?? [], {
        reportType: post.reportType,
        reportId: post.reportId ?? undefined,
        recordHistory: false,
        title: platform === 'tiktok' ? tiktokFields(post.content, this.plainTarget(platform)).title : undefined,
      });
      await this.prisma.socialMediaPost.update({
        where: { id: post.id },
        data: {
          status: 'published',
          externalPostId: result.postId,
          url: result.url,
          publishedAt: new Date(),
          error: null,
        },
      });
      return result;
    }
    if (post.status !== 'published') throw new BadRequestException('Only drafts and published posts can be sent');
    return this.publish(platform, post.credentialId, post.content, post.mediaUrls ?? [], {
      reportType: post.reportType,
      reportId: post.reportId ?? undefined,
    });
  }

  async testCredentials(credentialId: string): Promise<{ success: boolean; message: string }> {
    const row = await this.prisma.socialMediaCredential.findUnique({ where: { id: credentialId } });
    if (!row) return { success: false, message: 'Credential not found' };
    const platform = row.platform as SocialPlatform;
    if (platform === 'x') return this.xService.testCredentials(credentialId);

    const credential = decryptSocialCredential(this.encryption, row);
    const result =
      platform === 'tiktok'
        ? await this.tiktok.test(credential)
        : await this.meta.test(await this.refreshMeta(credential));
    if (result.success) {
      await this.prisma.socialMediaCredential.update({
        where: { id: credentialId },
        data: { lastTestedAt: new Date() },
      });
    }
    return result;
  }

  async deletePost(postId: string): Promise<void> {
    return this.xService.deletePost(postId);
  }

  private async publishToPlatform(
    platform: SocialPlatform,
    credential: SocialCredential,
    content: string,
    media: string[],
    options: { title?: string; privacy?: TikTokPrivacy },
  ): Promise<{ postId: string; url?: string }> {
    if (platform === 'facebook') return this.meta.publishFacebook(credential, content, media);
    if (platform === 'instagram') return this.meta.publishInstagram(credential, content, media);
    if (platform === 'threads') return this.meta.publishThreads(await this.refreshMeta(credential), content, media);
    if (platform === 'tiktok') {
      return this.tiktok.publishPhoto(
        credential,
        options.title ?? content.slice(0, 90),
        content,
        media,
        options.privacy ?? 'SELF_ONLY',
      );
    }
    throw new BadRequestException(`Unsupported platform: ${platform}`);
  }

  private async refreshMeta(credential: SocialCredential): Promise<SocialCredential> {
    if (credential.platform !== 'threads') return credential;
    return this.meta.refreshThreadsIfNeeded(credential);
  }

  private async loadActive(credentialId: string, platform: SocialPlatform) {
    const row = await this.prisma.socialMediaCredential.findUnique({ where: { id: credentialId } });
    if (!row) throw new BadRequestException('Credential not found');
    if (row.platform !== platform) throw new BadRequestException(`That account is not a ${LABELS[platform]} account`);
    if (!row.isActive) throw new BadRequestException(`${LABELS[platform]} credential is not active`);
    return row;
  }

  private async record(
    credentialId: string,
    platform: SocialPlatform,
    reportType: string,
    reportId: string | undefined,
    content: string,
    mediaUrls: string[],
    result: { postId: string; url?: string },
  ): Promise<void> {
    try {
      await this.prisma.socialMediaPost.create({
        data: {
          credentialId,
          platform,
          reportType,
          reportId,
          externalPostId: result.postId,
          url: result.url,
          content,
          mediaUrls,
          status: 'published',
          publishedAt: new Date(),
        },
      });
    } catch (error) {
      // The post is live. A history-write failure must not turn it into an error that causes a retry.
      this.logger.warn(`Posted to ${platform} but could not store the history row: ${(error as Error).message}`);
    }
  }

  private async logFailed(
    credentialId: string,
    platform: SocialPlatform,
    reportType: string,
    reportId: string | undefined,
    content: string,
    mediaUrls: string[],
    error: string,
  ): Promise<void> {
    try {
      await this.prisma.socialMediaPost.create({
        data: {
          credentialId,
          platform,
          reportType,
          reportId,
          externalPostId: `failed_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          content,
          mediaUrls,
          status: 'failed',
          error,
          publishedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.warn(`Could not store the failed ${platform} attempt: ${(err as Error).message}`);
    }
  }
}
