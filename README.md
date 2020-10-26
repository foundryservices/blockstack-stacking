# Start Stacking on Stacks 2.0 Testnet
## from [https://docs.blockstack.org/stacks-blockchain/integrate-stacking](https://docs.blockstack.org/stacks-blockchain/integrate-stacking)

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