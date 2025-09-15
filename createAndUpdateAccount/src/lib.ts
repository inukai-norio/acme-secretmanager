import { crypto } from 'acme-client';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

export interface KeyConfig {
  type?: 'rsa' | 'ecdsa';
  curve?: 'P-256' | 'P-384' | 'P-521';
  keySize?: number;
}

class Account {
  keyConfig: KeyConfig;
  object: object;
  directoryUrl: string;
  key: string;

  constructor(data: string) {
    const t = JSON.parse(data) as { [key: string]: string };
    this.keyConfig = JSON.parse(t.keyConfig) as KeyConfig;
    this.object = JSON.parse(t.object) as object;
    this.directoryUrl = t.directoryUrl;
    this.key = t.key;
  }

  stringify() {
    return JSON.stringify({
      keyConfig: JSON.stringify(this.keyConfig),
      object: JSON.stringify(this.object),
      directoryUrl: this.directoryUrl,
      key: this.key,
    });
  }
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

export async function getAccount(sm: SecretsManagerClient, SecretId: string, VersionStage: string): Promise<Account> {
  const RawAcountkey = await sm.send(
    new GetSecretValueCommand({
      SecretId,
      VersionStage,
    }),
  );
  if (typeof RawAcountkey.SecretString === 'undefined') {
    throw new Error(`Undefined acountkey`);
  }

  const account = new Account(RawAcountkey.SecretString);
  return account;
}
