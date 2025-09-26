import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { SecretsManagerClient, CreateSecretCommand, RotateSecretCommand } from '@aws-sdk/client-secrets-manager';

const credentials = await (defaultProvider())();
const sm = new SecretsManagerClient({ credentials });

interface KeyConfig {
  type?: 'rsa' | 'ecdsa';
  curve?: 'P-256' | 'P-384' | 'P-521';
  keySize?: number;
}


function toKvJson(data: object) {
  const ret: [ string, number | string | boolean | undefined ][] = Object.entries(data).map(([k, v]) => {
    switch (typeof v) {
      case 'object':
        return [k, JSON.stringify(v)];
      case 'bigint':
        return [k, v.toString()];
      case 'number':
      case 'string':
      case 'boolean':
      case 'undefined':
        return [k, v];
      default:
        return [k, undefined];
    }
  })
  return JSON.stringify(Object.fromEntries(ret));
}

const accountKeyName = 'acmeAccountKey';
const mailAddress = 'example@example.com';
const directoryUrl = 'https://acme-staging-v02.api.letsencrypt.org/directory';

const priveteKeyName = 'acmePriveteKey';
const domain = 'example.com';
const zoneId = 'XXX';

const account = {
  keyConfig: {
    type: 'ecdsa',
    curve: 'P-384',
  },
  object: {
    termsOfServiceAgreed: true,
    contact: [`mailto:${mailAddress}`],
  },
  directoryUrl: directoryUrl,
  key: '',
};

const a = new CreateSecretCommand({
  Name: accountKeyName,
  SecretString: toKvJson(account),
});

const priveteKey = {
  keyConfig: {
    type: 'ecdsa',
    curve: 'P-384',
  },
  domain: domain,
  hostedZoneId: zoneId,
  AccountSecretId: accountKeyName,
  key: "",
  crt: "",
}
const c = new CreateSecretCommand({
  Name: priveteKeyName,
  SecretString: toKvJson(priveteKey),
});

const aa = await sm.send(a)
const cc = await sm.send(c)

const aaa = new RotateSecretCommand({
  SecretId: aa.Name,
  RotationLambdaARN: process.env.ACCOUNT_LAMBDA,
  RotateImmediately: true,
  RotationRules: {
    AutomaticallyAfterDays: 61, // 素数のため
  }
})

const ccc = new RotateSecretCommand({
  SecretId: cc.Name,
  RotationLambdaARN: process.env.CERTIFICATE_LAMBDA,
  RotateImmediately: true,
  RotationRules: {
    AutomaticallyAfterDays: 31, // 素数のため
  }
})

await sm.send(aaa);

await new Promise((resolve) => setTimeout(resolve, 10_000));

await sm.send(ccc);

