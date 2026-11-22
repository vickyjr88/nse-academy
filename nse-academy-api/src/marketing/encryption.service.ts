import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private encryptionKey: Buffer;
  private algorithm = 'aes-256-gcm';

  constructor(private configService: ConfigService) {
    // Use a consistent key derived from JWT_SECRET
    const jwtSecret = this.configService.get<string>('JWT_SECRET', 'your-secret');
    // Derive a 32-byte key from the JWT secret using SHA-256
    this.encryptionKey = crypto.createHash('sha256').update(jwtSecret).digest();
  }

  /**
   * Encrypts a string using AES-256-GCM
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv) as any;

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Combine IV, auth tag, and encrypted data
    const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]);
    return combined.toString('base64');
  }

  /**
   * Decrypts a string encrypted with the encrypt method
   */
  decrypt(ciphertext: string): string {
    const combined = Buffer.from(ciphertext, 'base64');

    // Extract IV (first 12 bytes), auth tag (next 16 bytes), and encrypted data (rest)
    const iv = combined.slice(0, 12);
    const authTag = combined.slice(12, 28);
    const encrypted = combined.slice(28).toString('hex');

    const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv) as any;
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
