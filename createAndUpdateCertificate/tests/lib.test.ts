import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createPrivateKey, gatSSMParameter, getAcountkey } from '../src/lib.js';
import { crypto } from 'acme-client';
import { Buffer } from 'node:buffer';
import { SSMClient, GetParametersByPathCommand } from '@aws-sdk/client-ssm';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { mockClient } from 'aws-sdk-client-mock';

describe('createPrivateKey (spyOn)', () => {
  beforeEach(() => {
    jest.spyOn(crypto, 'createPrivateKey').mockImplementation(
      async (keySize) => crypto.createPrivateRsaKey(keySize)
    )
    jest.spyOn(crypto, 'createPrivateRsaKey').mockImplementation(
      async (keySize = 2048) =>  Buffer.from(`rsa_${keySize}`)
    )
    jest.spyOn(crypto, 'createPrivateEcdsaKey').mockImplementation(
      async (namedCurve = 'P-256') =>  Buffer.from(`ecdsa_${namedCurve}`)
    )
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('undefind', async () => {
    const key = await createPrivateKey();
    expect(key).toStrictEqual(Buffer.from('rsa_2048'));
  });

  it('ecdsa => undefind', async () => {
    const key = await createPrivateKey({type : 'ecdsa'});
    expect(key).toStrictEqual(Buffer.from('ecdsa_P-256'));
  });

  it('ecdsa => P-256', async () => {
    const key = await createPrivateKey({type : 'ecdsa', curve: 'P-384'});
    expect(key).toStrictEqual(Buffer.from('ecdsa_P-384'));
  });

  it('rsa => undefind', async () => {
    const key = await createPrivateKey({type : 'rsa'});
    expect(key).toStrictEqual(Buffer.from('rsa_2048'));
  });

  it('rsa => 2048', async () => {
    const key = await createPrivateKey({type : 'rsa', keySize: 4096});
    expect(key).toStrictEqual(Buffer.from('rsa_4096'));
  });
  it('undefind type', async () => {
    const key = await createPrivateKey({type : undefined});
    expect(key).toStrictEqual(Buffer.from('rsa_2048'));
  });
});

describe('gatSSMParameter (aws-sdk-client-mock)', () => {
  const ssm = new SSMClient({});
  const ssmMock = mockClient(ssm);
  beforeEach(() => {
    ssmMock.reset();
    ssmMock
      .on(GetParametersByPathCommand, { Path: '/acme/', Recursive: true })
      .resolvesOnce({
        Parameters: [
          { Name: '/acme/acountkey/type', Value: 'ecdsa' },
          { Name: '/acme/acountkey/curve', Value: 'P-384' },
        ],
        NextToken: 'TOKEN1',
      });
    ssmMock
      .on(GetParametersByPathCommand, { Path: '/acme/', Recursive: true, NextToken: 'TOKEN1' })
      .resolvesOnce({
        Parameters: [
          { Name: '/acme/email', Value: 'info@example.com' },
        ],
        NextToken: 'TOKEN2',
      });
    ssmMock
      .on(GetParametersByPathCommand, { Path: '/acme/', Recursive: true, NextToken: 'TOKEN2' })
      .resolvesOnce({
        Parameters: [
          { Name: '/acme/directoryUrl', Value: 'https://acme.api.example.com/directory' },
        ],
        NextToken: undefined,
      });
    ssmMock
      .on(GetParametersByPathCommand, { Path: '/acme1/', Recursive: true })
      .resolvesOnce({
        Parameters: [
          { Name: undefined, Value: 'https://acme.api.example.com/directory' },
          { Name: '/acme1/email', Value: undefined },
          { Name: undefined, Value: undefined },
          { Name: '/acme1/directoryUrl', Value: 'https://acme.api.example.com/directory' },
        ],
        NextToken: undefined,
      });
  });

  afterEach(() => {

  });

  it('std', async () => {
    const param = await gatSSMParameter(ssm, '/acme/');

    expect(param).toMatchObject({
      acountkey: {
        type: 'ecdsa',
        curve: 'P-384',
      },
      email: 'info@example.com',
      directoryUrl: 'https://acme.api.example.com/directory',
    });
  });
  it('undefined', async () => {
    const param = await gatSSMParameter(ssm, '/acme1/');

    expect(param).toMatchObject({
      directoryUrl: 'https://acme.api.example.com/directory',
    });
  });
});

describe('getAcountkey (aws-sdk-client-mock)', () => {
  const smMock = mockClient(SecretsManagerClient);
  beforeEach(() => {
    smMock.reset();
    smMock
      .on(GetSecretValueCommand, { SecretId: 'accountKey', VersionStage: 'AWSCURRENT' })
      .resolves({
        SecretString: JSON.stringify({accountKey: '1234567890'}),
      });
    smMock
      .on(GetSecretValueCommand, { SecretId: 'accountKey1', VersionStage: 'AWSCURRENT' })
      .resolves({
        SecretString: undefined,
      });
  });

  afterEach(() => {

  });

  it('std', async () => {
    const accountKey = await getAcountkey(<SecretsManagerClient><any>smMock, 'accountKey', 'AWSCURRENT');

    expect(accountKey).toBe('1234567890');
  });
  it('error', async () => {
    await expect(async () => {
      await getAcountkey(<SecretsManagerClient><any>smMock, 'accountKey1', 'AWSCURRENT')
    }).rejects.toThrow();
  });
});
