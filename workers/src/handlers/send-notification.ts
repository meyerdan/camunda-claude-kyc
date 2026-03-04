import { IInputVariables, ICustomHeaders, IOutputVariables, ZeebeJob } from '@camunda8/sdk/dist/zeebe/lib/interfaces-1.0';

export async function sendNotificationHandler(job: Readonly<ZeebeJob<IInputVariables, ICustomHeaders, IOutputVariables>>) {
  const { email, applicantName, notificationType } = job.variables as any;

  console.log(`[NOTIFICATION] To: ${email}, Type: ${notificationType}, Name: ${applicantName}`);

  return job.complete({
    notificationSentAt: new Date().toISOString(),
  });
}
