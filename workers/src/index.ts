import { Camunda8 } from '@camunda8/sdk';
import { prepareApplicationHandler } from './handlers/prepare-application';
import { sendNotificationHandler } from './handlers/send-notification';
import { createAccountHandler } from './handlers/create-account';

const c8 = new Camunda8();
const zeebe = c8.getZeebeGrpcApiClient();

zeebe.createWorker({ taskType: 'prepare-application', taskHandler: prepareApplicationHandler });
zeebe.createWorker({ taskType: 'send-notification', taskHandler: sendNotificationHandler });
zeebe.createWorker({ taskType: 'create-account', taskHandler: createAccountHandler });

console.log('All KYC workers registered. Ctrl+C to exit.');
