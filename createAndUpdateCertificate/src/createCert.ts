import { Route53Client, ChangeResourceRecordSetsCommand, ChangeAction } from '@aws-sdk/client-route-53';
import { crypto, Client, Authorization, CsrBuffer } from 'acme-client';
import { resolveTxt } from 'node:dns/promises';
import { Cert, createPrivateKey } from './lib.js';
const route53 = new Route53Client();

async function route53Challenge(action: ChangeAction, recordName: string, recordValue: string, hostedZoneId: string) {
  const command = new ChangeResourceRecordSetsCommand({
    HostedZoneId: hostedZoneId,
    ChangeBatch: {
      Changes: [
        {
          Action: action,
          ResourceRecordSet: {
            Name: recordName,
            Type: 'TXT',
            TTL: 60,
            ResourceRecords: [{ Value: `"${recordValue}"` }],
          },
        },
      ],
    },
  });
  await route53.send(command);
  console.log(`DNS challenge set: ${action} => ${recordName} -> ${recordValue}`);
}

async function resolveTxtDns(recordName: string) {
  const retValues: string[][] = await resolveTxt(recordName);
  // レコードに指定した値が含まれていれば終了
  console.log(retValues);
  return retValues.map((v) => v[0]);
}

async function waitForDnsPropagation(recordName: string, recordValue: string) {
  const timeoutMs = 600_000; // 600秒=10分
  const intervalMs = 10_000;

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const retValues = await resolveTxtDns(recordName);
      if (retValues.find((v) => v === recordValue)) {
        return;
      }
    }
    catch (e) {
      const err = <{ code: string; message: string }>e;
      if (err.code === 'ENOTFOUND') {
        console.log(err.message);
        // エラーが出ても再度実行
      }
      else {
        throw err;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('timeout');
}

async function createCrt(client: Client, cert: Cert, csr: CsrBuffer) {
  const mkRecordName = (authz: Authorization) => `_acme-challenge.${authz.identifier.value}.`;

  return client.auto({
    csr,
    challengePriority: ['dns-01'],
    challengeCreateFn: async (authz, challenge, keyAuthorization) => {
      if (challenge.type !== 'dns-01') {
        throw new Error(`This code is "dns-01" only supports. (request: "${challenge.type}")`);
      }
      const recordName = mkRecordName(authz);
      await route53Challenge('UPSERT', recordName, keyAuthorization, cert.hostedZoneId);
      // dns が更新されるまで待つ
      await waitForDnsPropagation(recordName, keyAuthorization);
    },
    challengeRemoveFn: async (authz, challenge, keyAuthorization) => {
      if (challenge.type !== 'dns-01') {
        throw new Error(`This code is "dns-01" only supports. (request: "${challenge.type}")`);
      }
      const recordName = mkRecordName(authz);
      await route53Challenge('DELETE', recordName, keyAuthorization, cert.hostedZoneId);
    },
  });
}

export async function createCert(client: Client, cert: Cert) {
  const keyPem = await createPrivateKey(cert.keyConfig);
  const [privateKey, csr] = await crypto.createCsr({
    commonName: cert.domain,
  }, keyPem);

  cert.key = privateKey.toString();
  cert.crt = await createCrt(client, cert, csr);
  return cert;
}
