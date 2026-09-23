import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });

const apiKey = process.env.RENDER_API_KEY;
const SERVICE_ID = process.env.RENDER_SERVICE_ID || 'srv-dai9u02d0e5s73fsnv6g'; // Homebase

if (!apiKey) {
  console.error('Error: RENDER_API_KEY is not set in environment or .env.local');
  process.exit(1);
}

const shouldWait = process.argv.includes('--wait') || process.argv.includes('-w');

async function fetchDeploys() {
  const res = await fetch(`https://api.render.com/v1/services/${SERVICE_ID}/deploys?limit=5`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch deploys: ${res.status} ${res.statusText}`);
  }

  const deploys = await res.json();
  return deploys.map((d: any) => d.deploy || d);
}

async function main() {
  console.log(`Checking Render deployments for Homebase (${SERVICE_ID})...\n`);

  if (!shouldWait) {
    const deploys = await fetchDeploys();
    for (const deploy of deploys) {
      const commit = deploy.commit;
      const statusIcon =
        deploy.status === 'live'
          ? '🟢 LIVE'
          : deploy.status === 'update_in_progress' || deploy.status === 'build_in_progress'
          ? '🟡 IN PROGRESS'
          : deploy.status === 'deactivated'
          ? '⚪ PREVIOUS'
          : '🔴 ' + deploy.status.toUpperCase();

      console.log(`[${statusIcon}] Deploy: ${deploy.id}`);
      console.log(`  Status:    ${deploy.status}`);
      console.log(`  Created:   ${deploy.createdAt}`);
      console.log(`  Finished:  ${deploy.finishedAt || 'in progress'}`);
      if (commit) {
        console.log(`  Commit:    ${commit.id?.slice(0, 7)} - ${commit.message?.trim().split('\n')[0]}`);
      }
      console.log('');
    }
    return;
  }

  // Wait / Monitor Mode
  console.log('Monitoring latest deploy until completion...\n');
  const startTime = Date.now();
  const maxWaitMs = 10 * 60 * 1000; // 10 minutes timeout

  let lastStatus = '';

  while (Date.now() - startTime < maxWaitMs) {
    const deploys = await fetchDeploys();
    const latest = deploys[0];

    if (!latest) {
      console.error('No deploys found.');
      process.exit(1);
    }

    if (latest.status !== lastStatus) {
      lastStatus = latest.status;
      const commit = latest.commit;
      const commitMsg = commit ? `[${commit.id?.slice(0, 7)}] ${commit.message?.trim().split('\n')[0]}` : '';
      console.log(`[${new Date().toLocaleTimeString()}] Deploy ${latest.id}: Status is "${latest.status}" ${commitMsg}`);
    }

    if (latest.status === 'live') {
      console.log(`\n🎉 Success: Deployment ${latest.id} is now LIVE on Render!`);
      process.exit(0);
    }

    if (latest.status === 'build_failed' || latest.status === 'update_failed' || latest.status === 'canceled') {
      console.error(`\n❌ Error: Deployment ${latest.id} failed with status "${latest.status}".`);
      process.exit(1);
    }

    // Wait 6 seconds before next poll
    await new Promise((r) => setTimeout(r, 6000));
  }

  console.error('\n⚠️ Timed out waiting for deployment to finish.');
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
