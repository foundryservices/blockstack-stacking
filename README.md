# Start Stacking on Stacks 2.0 Testnet
## from [https://docs.blockstack.org/stacks-blockchain/integrate-stacking](https://docs.blockstack.org/stacks-blockchain/integrate-stacking)

## Create a Wallet
### Using CLI
```
npx blockstack-cli@1.1.0-beta.1 make_keychain -t
```

### Using GUI
Create a wallet by downloading or building from source [here](https://github.com/blockstack/stacks-wallet). You will create a new software wallet or via ledger with a 24 word seed phrase. From there you can request testnet funds or fund via the cli. Next you need to get your private key using the cli
```
npx blockstack-cli@1.1.0-beta.1 get_stacks_wallet_key <Your Seed Phrase>
```

Paste the outputted private key into your .env and you are good to go


## Fund your Wallet
```
curl -XPOST "https://stacks-node-api.blockstack.org/extended/v1/faucets/stx?address=**<stxAddress>**&stacking=true"
```

## Importing your wallet
Create a .env file containing your private key
```.env
pk=<pk>
```

### Run With
```
# install 
npm i 
# stack
node stacking.js [stx to stack] [number of reward cycles]

# example
node stacking.js 2000000 1 # to stack 2 million stx tokens for 1 reward cycle
```

### Viewing the Transaction
After running the script a tx id will be returned you can watch the status of the transaction in a few places 
- https://testnet-explorer.blockstack.org/ - Explorer
- https://stacks-node-api.blockstack.org/extended/v1/tx/<txid>  - extended tx logs
- https://stacks-node-api.blockstack.org/extended/v1/tx/mempool - mempool
