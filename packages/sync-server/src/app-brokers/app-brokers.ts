import express from 'express';

import { SecretName, secretsService } from '#services/secrets-service';
import {
  requestLoggerMiddleware,
  validateSessionMiddleware,
} from '#util/middlewares';

import { fetchFlexStatement } from './ibkr';
import { createTradeRepublicRouter } from './traderepublic-routes';

const app = express();
export { app as handlers };
app.use(express.json());
app.use(requestLoggerMiddleware);
app.use(validateSessionMiddleware);

app.use('/traderepublic', createTradeRepublicRouter());

function getIbkrCredentials() {
  const token = secretsService.get(SecretName.ibkr_flexToken);
  const queryId = secretsService.get(SecretName.ibkr_flexQueryId);
  return token && queryId ? { token, queryId } : null;
}

app.post('/status', async (req, res) => {
  res.send({
    status: 'ok',
    data: { ibkr: { configured: getIbkrCredentials() != null } },
  });
});

app.post('/ibkr/trades', async (req, res) => {
  const credentials = getIbkrCredentials();
  if (!credentials) {
    res.send({ status: 'error', reason: 'not-configured' });
    return;
  }

  try {
    res.send({
      status: 'ok',
      data: await fetchFlexStatement(credentials.token, credentials.queryId),
    });
  } catch (error) {
    res.send({
      status: 'error',
      reason: error instanceof Error ? error.message : String(error),
    });
  }
});
