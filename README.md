# acme-secretmanager

## 概要

ACME 認証のTLS証明書を [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/) の自動更新機能を用いて定期更新するものです。
TLS証明書は、AWS Secrets Manager に保管されます。

## 必要環境

- AWS アカウント
- AWS SAM CLI
- Node.js (v22 以上)
  - npm
- GNU Make
- AWS CLI (任意)

## セットアップ手順

### リポジトリ取得

```sh
git clone https://github.com/inukai-norio/acme-secretmanager.git
cd acme-secretmanager
```

### ビルド

SAM ビルド設定のサンプルを `template.sample.yaml` においていますので、必要に応じて編集して利用してください。

```sh
cp template.sample.yaml template.yaml
sam build
```

### デプロイ

SAM デプロイ設定のサンプルを `samconfig.sample.toml` においていますので、必要に応じて編集して利用してください。

```sh
cp samconfig.sample.toml samconfig.toml
sam deploy --guided
```

## 設定項目 (SSM Parameter Store)

**※設定はのちに変更になります。**

SSM Parameter Store に一部設定を保管しています。

### 補足

- プレフィックス (`myapp`) は `samconfig.toml` の設定値に依存します。
- Parameter Store の設定例は `parameter.sample.yaml` に CloudFormation サンプルとして用意していますが、利用は任意です（手動設定や OpenTofu なども可）。

## 初回実行

初回に鍵の作成が必要なため、Secrets Manager のルーティングを手動で行います。

```sh
aws secretsmanager rotate-secret --secret-id "accountKey"
aws secretsmanager rotate-secret --secret-id "priveteKey"
```

以後自動でルーティングしますので、実行は不要です。

## 利用方法

**※この節の記載は不完全です。**

鍵を Secrets Manager から取得してください。定期的に更新がかかるため、自動で更新する仕組みを作ってください。

### CLI 例

```sh
aws secretsmanager get-secret-value --secret-id "priveteKey" --query SecretString --output text
```

### Node.js (TypeScript) 例

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: "ap-northeast-1" });

const secret = await client.send(
new GetSecretValueCommand({ SecretId: "priveteKey" })
);

console.log(secret.SecretString);
```

## ライセンス

このソフトウェアは ISC License で配布されます。
詳細は [LICENSE](LICENSE)を参照してください。
