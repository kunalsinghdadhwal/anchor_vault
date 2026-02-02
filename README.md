### Anchor Vault Program

Solana Turbin3


All tests passing

```bash

  anchor_vault
    ✔ Initialize the vault (406ms)
    ✔ Deposit SOL into the vault (425ms)
    ✔ Withdraw SOL from the vault (429ms)
    ✔ Close the vault (431ms)


  4 passing (3s)


```

#### Deployement


```bash
kunal@Crusader:~/anchor_vault$ anchor deploy \
  --provider.cluster devnet \
  --provider.wallet /home/kunal/turbin3-wallet.json


Deploying cluster: https://api.devnet.solana.com
Upgrade authority: /home/kunal/turbin3-wallet.json
Deploying program "anchor_vault"...
Program path: /home/kunal/anchor_vault/target/deploy/anchor_vault.so...
Program Id: EeDxaFVqGEAeXE3YxFdMUjNCSfNBguVL3ZZq9AC1yUme

Signature: 4yePT8wjin7cv7joec7aJAYSHifUj174xfgVnHT8V8Py2WEivQmhudyxiDjTZBTTsEQ7nwbK9JdnoaotDfpbfKxT

Waiting for program EeDxaFVqGEAeXE3YxFdMUjNCSfNBguVL3ZZq9AC1yUme to be confirmed...
Program confirmed on-chain
Idl data length: 533 bytes
Step 0/533
Idl account created: D5AngqoLY4FbNiWU3yNo1kB9ADVNn9pwsaptgCb62fmR
Deploy success
```