import { Route53Client, ChangeResourceRecordSetsCommand, ChangeAction } from '@aws-sdk/client-route-53';
import { crypto, Client, Authorization, CsrBuffer } from 'acme-client';
import { resolveTxt } from 'node:dns/promises';
import { Param, createPrivateKey } from './lib.js';
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
  console.log(retValues)
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
    } catch (err) {
      console.log(err)
      // エラーが出ても再度実行
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("timeout");
}

async function createCrt(client: Client, acmeParam: Param, hostedZoneId: string, csr: CsrBuffer) {
  const mkRecordName = (authz: Authorization) => `_acme-challenge.${authz.identifier.value}.`;

  return client.auto({
    csr,
    email: acmeParam.email,
    termsOfServiceAgreed: true,
    challengePriority: ['dns-01'],
    challengeCreateFn: async (authz, challenge, keyAuthorization) => {
      if (challenge.type !== 'dns-01') {
        throw new Error(`This code is "dns-01" only supports. (request: "${challenge.type}")`);        
      }
      const recordName = mkRecordName(authz);
      await route53Challenge('UPSERT', recordName, keyAuthorization, hostedZoneId);
      // dns が更新されるまで待つ
      await waitForDnsPropagation(recordName, keyAuthorization);
    },
    challengeRemoveFn:  async (authz, challenge, keyAuthorization) => {
      if (challenge.type !== 'dns-01') {
        throw new Error(`This code is "dns-01" only supports. (request: "${challenge.type}")`);        
      }
      const recordName = mkRecordName(authz);
      await route53Challenge('DELETE', recordName, keyAuthorization, hostedZoneId);
    },
  });
}

export async function createCert(client: Client, acmeParam: Param, domain: string, hostedZoneId: string) {
  const keyPem = await createPrivateKey(acmeParam.priveteKey);
  const [privateKey, csr] = await crypto.createCsr({
    commonName: domain,
  }, keyPem);


  const [key, crt] = await Promise.all([
    privateKey.toString(),
    createCrt(client, acmeParam, hostedZoneId, csr),
  ]);

  return {
    key,
    crt,
  };
}
