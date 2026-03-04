import { IInputVariables, ICustomHeaders, IOutputVariables, ZeebeJob } from '@camunda8/sdk/dist/zeebe/lib/interfaces-1.0';

export async function createAccountHandler(job: Readonly<ZeebeJob<IInputVariables, ICustomHeaders, IOutputVariables>>) {
  const { applicantName, email, country } = job.variables as any;

  const accountId = `ACC-${Math.random().toString(36).substr(2, 9)}`;
  const accountCreatedAt = new Date().toISOString();

  console.log(`[ACCOUNT CREATED] ${accountId} for ${applicantName}`);

  return job.complete({
    accountId,
    accountCreatedAt,
  });
}
