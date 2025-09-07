# acme-secretmanager

[AWS Secrets Manager](https://aws.amazon.com/secrets-manager/) の自動更新機能を用いて ACME を定期更新するスクリプト

## 使い方

1. `acme-param.sample.yaml` を参考にパラメータストアを作成してください。
最低限必要なパラメータは `/[prefix]/email` と `/[prefix]/directoryUrl` です。（`prefix` は適切に変更してください）
2. `template.sample.yaml` と `samconfig.sample.toml` を参考に、 `template.yaml` と `samconfig.toml` を作成してください。
先ほど指定した `AcmeParametersPrefix` には `prefix` を指定してください。
3. 下記コマンドでデプロイしてください。

```shell
sam build
sam deploy
```

## パラメータ選択指定方法

TODO
