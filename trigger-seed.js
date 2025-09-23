const { PrismaClient } = require('@prisma/client');

async function generateApiKey() {
  const crypto = require('crypto');

  // Generate a random API key
  const randomBytes = crypto.randomBytes(32);
  const environment = 'test'; // or 'live'
  const key = `gk_${environment}_${randomBytes.toString('base64url')}`;

  return key;
}

function hashApiKey(apiKey) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

function getKeyPrefix(apiKey) {
  return apiKey.substring(0, 8);
}

function getKeySuffix(apiKey) {
  return apiKey.substring(apiKey.length - 4);
}

async function main() {
  const prisma = new PrismaClient();

  try {
    // Check if default project exists
    let project = await prisma.project.findUnique({
      where: { slug: 'default' }
    });

    if (!project) {
      console.log('Creating default project...');
      project = await prisma.project.create({
        data: {
          name: 'Default Project',
          slug: 'default',
          environment: 'development',
          isDefault: true,
          settings: {
            rateLimits: {
              test: 100,
              production: 1000,
            },
          },
        },
      });
    }

    // Generate API key
    const testApiKey = await generateApiKey();
    const keyHash = hashApiKey(testApiKey);
    const keyPrefix = getKeyPrefix(testApiKey);
    const keySuffix = getKeySuffix(testApiKey);

    // Create API key
    await prisma.apiKey.create({
      data: {
        projectId: project.id,
        keyHash,
        keyPrefix,
        keySuffix,
        name: 'CLI Testing Key',
        scopes: {
          create: [
            { scope: 'messages:send' },
            { scope: 'messages:read' },
            { scope: 'projects:read' },
            { scope: 'projects:write' },
            { scope: 'keys:manage' },
            { scope: 'keys:read' },
            { scope: 'platforms:read' },
            { scope: 'platforms:write' },
          ],
        },
      },
    });

    console.log('='.repeat(60));
    console.log('✅ API Key generated successfully!');
    console.log('Project Slug: default');
    console.log('API Key:', testApiKey);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();