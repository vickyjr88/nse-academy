import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

function corsOrigins(): string[] {
  const configured = [process.env.WEB_URL, process.env.SITE_URL, process.env.CMS_ADMIN_URL].filter(
    (v): v is string => !!v,
  );
  // The CMS admin panel runs entirely in the browser (Strapi's React admin)
  // and calls this API directly with the x-admin-key header - it's a real
  // cross-origin request, not just server-to-server, so its origin has to
  // be allowlisted the same way WEB_URL is.
  const defaults = [
    'https://nseacademy.vitaldigitalmedia.net',
    'https://nseacademy-admin.vitaldigitalmedia.net',
  ];
  // Only add localhost when nothing production-like is configured, rather
  // than gating on NODE_ENV - this deployment doesn't reliably set it, and
  // trusting an unset NODE_ENV would let localhost through in production.
  const localDefaults = configured.length === 0 ? ['http://localhost:3000', 'http://localhost:3010'] : [];
  return [...new Set([...configured, ...defaults, ...localDefaults])];
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  app.set('trust proxy', 1);
  app.use(helmet());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: corsOrigins() });

  const config = new DocumentBuilder()
    .setTitle('NSE Academy API')
    .setDescription('REST API for NSE Academy - investor education platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT ?? 3011;
  await app.listen(port);
  console.log(`NSE Academy API running on http://localhost:${port}`);
  console.log(`Swagger docs at http://localhost:${port}/api`);
}
bootstrap();
