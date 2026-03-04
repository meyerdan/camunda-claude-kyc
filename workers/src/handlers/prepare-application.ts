import { IInputVariables, ICustomHeaders, IOutputVariables, ZeebeJob } from '@camunda8/sdk/dist/zeebe/lib/interfaces-1.0';

export async function prepareApplicationHandler(job: Readonly<ZeebeJob<IInputVariables, ICustomHeaders, IOutputVariables>>) {
  const { applicantName, email, dateOfBirth, country, idDocumentNumber } = job.variables as any;

  // Validate required fields
  const requiredFields = { applicantName, email, dateOfBirth, country, idDocumentNumber };
  for (const [field, value] of Object.entries(requiredFields)) {
    if (!value) {
      return job.fail(`Missing required field: ${field}`);
    }
  }

  const applicationId = `KYC-${Date.now()}`;
  const applicationStartedAt = new Date().toISOString();

  console.log(`[PREPARE] Application ${applicationId} for ${applicantName}`);

  return job.complete({
    applicationId,
    applicationStartedAt,
  });
}
