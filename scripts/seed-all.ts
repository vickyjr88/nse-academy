import { execSync } from 'child_process';
import * as path from 'path';

const scripts = [
  'seed-ebook.ts',
  'seed-trading-guide.ts',
  'seed-glossary.ts',
  'seed-stocks.ts',
  'seed-articles.ts',
];

async function runAll() {
  console.log('🚀 Starting full catalog seeding...\n');
  
  const token = process.env.CMS_API_TOKEN;
  const url = process.env.CMS_URL || 'http://localhost:1337';

  if (!token) {
    console.error('❌ Error: CMS_API_TOKEN environment variable is missing.');
    console.log('Generate a "Full Access" API token in the Strapi Admin (Settings > API Tokens) and set it in your .env or export it.');
    process.exit(1);
  }

  for (const script of scripts) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`📦 Running ${script}...`);
    console.log(`------------------------------------------------------------\n`);
    
    try {
      execSync(`npx ts-node --project scripts/tsconfig.json scripts/${script}`, {
        stdio: 'inherit',
        env: {
          ...process.env,
          CMS_URL: url,
          CMS_API_TOKEN: token
        }
      });
      console.log(`\n✅ ${script} completed successfully.`);
    } catch (error) {
      console.error(`\n❌ Error running ${script}. Seeding halted.`);
      process.exit(1);
    }
  }

  console.log('\n✨ All data successfully seeded! The NSE Academy is now fully populated.');
}

runAll();
