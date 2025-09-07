import { SSMClient, paginateGetParametersByPath } from '@aws-sdk/client-ssm';
import { crypto } from 'acme-client';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

export interface KeyConfig {
  type?: 'rsa' | 'ecdsa';
  curve?: 'P-256' | 'P-384' | 'P-521';
  keySize?: number;
}

export interface Param {
  acountkey?: KeyConfig;
  priveteKey?: KeyConfig;
  email: string;
  directoryUrl: string;
}

export async function createPrivateKey(keyConfig?: KeyConfig) {
  if (typeof keyConfig === 'undefined') {
    return crypto.createPrivateKey();
  }
  if (keyConfig.type === 'rsa') {
    return crypto.createPrivateRsaKey(keyConfig.keySize);
  }
  if (keyConfig.type === 'ecdsa') {
    return crypto.createPrivateEcdsaKey(keyConfig.curve);
  }
  return crypto.createPrivateKey();
}

export async function getAcountkey(sm: SecretsManagerClient, SecretId: string, VersionStage: string) {
  const RawAcountkey = await sm.send(
    new GetSecretValueCommand({
      SecretId,
      VersionStage,
    }),
  );
  if (typeof RawAcountkey.SecretString === 'undefined') {
    throw new Error(`Undefined acountkey`);
  }
  const { accountKey } = <{ accountKey: string }>JSON.parse(RawAcountkey.SecretString);
  return accountKey;
}

export async function gatSSMParameter(ssm: SSMClient, path: string): Promise<Param> {
  const notNormalizedOut: { key: string; value: string }[] = [];
  const out = <Param>{};
  const paginator = paginateGetParametersByPath(
    { client: ssm },
    {
      Path: path,
      Recursive: true,
      WithDecryption: true,
    },
  );
  for await (const page of paginator) {
    for (const p of page.Parameters ?? []) {
      if (typeof p.Name === 'undefined') {
        continue;
      }
      if (typeof p.Value === 'undefined') {
        continue;
      }
      const key = p.Name.replace(`${path}`, '');
      notNormalizedOut.push({ key, value: p.Value });
    }
  }
  notNormalizedOut.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0).forEach((v) => {
    const splitKeys = v.key.split('/');
    if (splitKeys.length === 1) {
      out[v.key] = v.value;
    }
    else {
      let target = out;
      const key = splitKeys.pop();
      for (let i = 0; i < splitKeys.length; i++) {
        const splitKey = splitKeys[i];
        if (!target[splitKey]) {
          target[splitKey] = {};
        }
        target = target[splitKey];
      }
      target[<string>key] = v.value;
    }
  });
  return out;
}
