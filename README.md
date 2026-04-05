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

### 出力

- `FunctionCreateAccountArn`
  - Account 鍵更新 lambda の ARN
- `FunctionCreateCertificateArn`
  - TLS 鍵更新 lambda の ARN

## 設定項目

Secrets Manager に TLS 鍵やアカウント情報を保存します。  
テンプレートは `secrets-manager.sample.yaml` を参照してください。

### Account 鍵

| 項目           | 説明                            |
|----------------|---------------------------------|
| `keyConfig`    | 鍵の設定（下記参照）              |
| `object`       | Account 作成時に必要な設定。エスケープされた JSON 文字列で記載する。<br>参照: [RFC 8555 7.1.2. Account Objects](https://datatracker.ietf.org/doc/html/rfc8555#section-7.1.2) |
| `directoryUrl` | ACME エンドポイント              |
| `key`          | **Account 秘密鍵 (Private Key)** |

### TLS 鍵

| 項目             | 説明                        |
|------------------|----------------------------|
| `keyConfig`      | 鍵の設定（下記参照）         |
| `domain`         | 証明書を発行するドメイン名    |
| `hostedZoneId`   | Route53 の Hosted Zone ID  |
| `AccountSecretId`| 上記 Account 鍵の Secret ID |
| `key`            | **サーバー秘密鍵 (Private Key, `*.key`)** — サーバーのみが保持する |
| `crt`            | **サーバー証明書 (Certificate, `*.crt`)** — 公開鍵と CA 署名を含む |

### keyConfig

エスケープされた JSON 文字列で指定します（各項目は任意）。

| 項目     | 説明                       |
|----------|----------------------------|
| `type`   | 鍵のアルゴリズム (`rsa` または `ecdsa`) |
| `curve`  | ECDSA のカーブ名           |
| `keySize`| RSA のキー長               |

### 用語補足

- **秘密鍵 (`*.key`)**
  サーバーが保持する非公開の鍵。外部に公開してはいけない。
- **証明書 (`*.crt`)**
  公開鍵と認証局 (CA) の署名を含むファイル。クライアントはこれを検証して通信相手の正当性を確認する。

## 初回実行

あらかじめ `secrets-manager.sample.yaml` 等を用いて、Secrets Manager の Secret と RotationSchedule を作成してください。
`secrets-manager.sample.yaml` を利用する場合、初回実行が行われ `key` / `crt` が作成されます。
CLI などで作成した場合初回 `key` / `crt` が空のため、Secrets Manager のローテーションを手動実行して鍵を生成します。

```sh
aws secretsmanager rotate-secret --secret-id "acmeAccountKey"
aws secretsmanager rotate-secret --secret-id "acmePrivateKey"
```

以後自動でローテーションしますので、実行は不要です。

## 利用方法

鍵を Secrets Manager から取得してください。定期的に更新がかかるため、自動で更新する仕組みを作ってください。

### CLI 例

```sh
aws secretsmanager get-secret-value --secret-id "acmePrivateKey" --query SecretString --output text
```

## ライセンス

このソフトウェアは ISC License で配布されます。
詳細は [LICENSE](LICENSE)を参照してください。
