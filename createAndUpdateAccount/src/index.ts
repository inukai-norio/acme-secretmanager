import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { SecretsManagerClient, PutSecretValueCommand, UpdateSecretVersionStageCommand, ListSecretVersionIdsCommand } from '@aws-sdk/client-secrets-manager';
import { SecretsManagerRotationEvent } from 'aws-lambda'
import { createPrivateKey, gatSSMParameter, getAcountkey } from './lib.js';
import { Client } from 'acme-client';
import { SSMClient } from '@aws-sdk/client-ssm';

const credentials = await (defaultProvider())();
const ssm = new SSMClient({ credentials });
const sm = new SecretsManagerClient({ credentials });

const acmeParametersPrefix = process.env.AcmeParametersPrefix;
const VersionStage = {
  current: 'AWSCURRENT',
  pending: 'AWSPENDING',
}

export async function handler(event: SecretsManagerRotationEvent) {
  const { SecretId, ClientRequestToken, Step } = event;
  try {
    const acmeParam = await gatSSMParameter(ssm, `/${acmeParametersPrefix}/`)
    console.log(acmeParam)
    if (Step === "createSecret") {
      // 鍵を更新
      const newAccountKey = await createPrivateKey(acmeParam.acountkey)
      await sm.send(new PutSecretValueCommand({
        SecretId,
        ClientRequestToken,
        SecretString: JSON.stringify({ accountKey: newAccountKey.toString('ascii') }),
        VersionStages: [VersionStage.pending],
      }))

    } else if (Step === "setSecret") {
      // 鍵を配置
      // 相手先サーバの鍵を更新
      // アカウントキー取得処理
      const accountKey: string = await (async () => {
        try {
          return getAcountkey(sm, SecretId, VersionStage.current);
        } catch (err) {
          if (err.name !== 'ResourceNotFoundException') {
            throw err;
          }
          console.log('initial run');
          return '';
        }
      })();
      const newAccountKey = await getAcountkey(sm, SecretId, VersionStage.pending);
      if (accountKey === '') {
        // 初回実行
        const client = new Client({
          directoryUrl: acmeParam.directoryUrl,
          accountKey: newAccountKey,
        });
        await client.createAccount({
          termsOfServiceAgreed: true,
          contact: [`mailto:${acmeParam.email}`]
        })
      } else {
        // 2回目以降の実行
        // ログイン
        const client = new Client({
          directoryUrl: acmeParam.directoryUrl,
          accountKey,
        });
        // アカウントキー更新処理
        await client.updateAccountKey(newAccountKey);
      }
      return;
    } else if (Step === "testSecret") {
      // 鍵が利用できることを確認
      // 本コードでは省略
      return;
    } else if (Step === "finishSecret") {
      /* 更新した鍵を最新バージョンとしてマークする */
      const { Versions } = await sm.send(
        new ListSecretVersionIdsCommand({ SecretId })
      );
      if (typeof Versions === 'undefined') {
        throw new Error('Versions is undefined');
      }
      const curr = Versions.find((v) => typeof v.VersionStages !== 'undefined' && v.VersionStages.includes(VersionStage.current));
      if (typeof curr === 'undefined') {
        throw new Error('curr is undefined');
      }
      await sm.send(new UpdateSecretVersionStageCommand({
        SecretId,
        VersionStage: VersionStage.current,
        MoveToVersionId: ClientRequestToken,
        RemoveFromVersionId: curr.VersionId,
      }))
    } else {
      throw new Error(`Unexpected step ${Step}`);
    }
  } catch (err) {
    // 失敗したらただちに切り戻し
    await sm.send(new UpdateSecretVersionStageCommand({
      SecretId,
      VersionStage: VersionStage.pending,
      RemoveFromVersionId: ClientRequestToken,
    }));
    throw err; // Secrets Manager へ失敗を返してリトライを促す
  }
};
