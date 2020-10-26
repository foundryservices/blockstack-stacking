const fetch = require('cross-fetch');
const BN = require('bn.js');
const {
  makeRandomPrivKey,
  privateKeyToString,
  getAddressFromPrivateKey,
  TransactionVersion,
  StacksTestnet,
  uintCV,
  tupleCV,
  makeContractCall,
  bufferCV,
  serializeCV,
  deserializeCV,
  cvToString,
  connectWebSocketClient,
  broadcastTransaction,
  standardPrincipalCV,
} = require('@blockstack/stacks-transactions');
const {
  InfoApi,
  AccountsApi,
  SmartContractsApi,
  Configuration,
  TransactionsApi,
} = require('@stacks/blockchain-api-client');
const c32 = require('c32check');

const apiConfig = new Configuration({
  fetchApi: fetch,
  basePath: 'https://stacks-node-api.blockstack.org',
});

// generate rnadom key
//const privateKey = makeRandomPrivKey();a
require('dotenv').config()
const privateKey = process.env.pk

// get Stacks address
const stxAddress = getAddressFromPrivateKey(
  //privateKeyToString(privateKey),
  privateKey,
  TransactionVersion.Testnet
);

console.log(stxAddress)

const info = new InfoApi(apiConfig);

async function displayStackingInfo() {
	const info = new InfoApi(apiConfig);

	const poxInfo = await info.getPoxInfo();
	const coreInfo = await info.getCoreApiInfo();
	const blocktimeInfo = await info.getNetworkBlockTimes();

	return {poxInfo, coreInfo, blocktimeInfo}
}

async function stack(poxInfo, blocktimeInfo, coreInfo) {
	// will Stacking be executed in the next cycle?
	const stackingExecution = poxInfo.rejection_votes_left_required > 0;

	// how long (in seconds) is a Stacking cycle?
	const cycleDuration = poxInfo.reward_cycle_length * blocktimeInfo.testnet.target_block_time;

	// how much time is left (in seconds) until the next cycle begins?
	const secondsToNextCycle =
	  (poxInfo.reward_cycle_length -
	    ((coreInfo.burn_block_height - poxInfo.first_burnchain_block_height) %
	      poxInfo.reward_cycle_length)) *
	  blocktimeInfo.testnet.target_block_time;

	// the actual datetime of the next cycle start
	const nextCycleStartingAt = new Date();
	nextCycleStartingAt.setSeconds(nextCycleStartingAt.getSeconds() + secondsToNextCycle);

	console.log({
	  stackingExecution,
	  cycleDuration,
	  nextCycleStartingAt,
	  // minimum microstacks required to participate
	  minimumUSTX: poxInfo.min_amount_ustx,
	});

	// stacking eligability
	const accounts = new AccountsApi(apiConfig);

	const accountBalance = await accounts.getAccountBalance({
	  principal: stxAddress,
	});

	const accountSTXBalance = new BN(accountBalance.stx.balance, 10);
	const minAmountSTX = new BN(poxInfo.min_amount_ustx, 10);

	// enough balance for participation?
	const canParticipate = accountSTXBalance.cmp(minAmountSTX) >= 0;

	console.log({
	  stxAddress,
	  btcAddress: c32.c32ToB58(stxAddress),
	  accountSTXBalance: accountSTXBalance.toNumber(),
	  canParticipate,
	});

	//res.json({
	 // stxAddress,
	  //btcAddress: c32.c32ToB58(stxAddress),
	  //accountSTXBalance: accountSTXBalance.toNumber(),
	  //canParticipate,
	//});
	
	// projected stacking period
	// this would be provided by the user
	let numberOfCycles = 3;

	// the projected datetime for the unlocking of tokens
	const unlockingAt = new Date(nextCycleStartingAt);
	unlockingAt.setSeconds(
	  unlockingAt.getSeconds() +
    	    poxInfo.reward_cycle_length * numberOfCycles * blocktimeInfo.testnet.target_block_time
	);

	// checking eligability
	// microstacks tokens to lockup, must be >= poxInfo.min_amount_ustx and <=accountSTXBalance
	let microstacksoLockup = poxInfo.min_amount_ustx;

	// derive bitcoin address from Stacks account and convert into required format
	const hashbytes = bufferCV(Buffer.from(c32.c32addressDecode(stxAddress)[1], 'hex'));
	const version = bufferCV(Buffer.from('01', 'hex'));

	const smartContracts = new SmartContractsApi(apiConfig);

	let [contractAddress, contractName] = poxInfo.contract_id.split('.');

	console.log(contractAddress)

	// read-only contract call
	const isEligible = await smartContracts.callReadOnlyFunction({
	  contractAddress,
	  contractName,
	  functionName: 'can-stack-stx',
	  readOnlyFunctionArgs: {
	    sender: stxAddress,
	    arguments: [
	      `0x${serializeCV(
		tupleCV({
		  hashbytes,
		  version,
		})
	      ).toString('hex')}`,
	      `0x${serializeCV(uintCV(microstacksoLockup)).toString('hex')}`,
	      // explicilty check eligibility for next cycle
	      `0x${serializeCV(uintCV(poxInfo.reward_cycle_id)).toString('hex')}`,
	      `0x${serializeCV(uintCV(numberOfCycles)).toString('hex')}`,
	    ],
	  },
	});

	const response = cvToString(deserializeCV(Buffer.from(isEligible.result.slice(2), 'hex')));

	if (response.startsWith(`(err `)) {
	  // user cannot participate in stacking
	  // error codes: https://github.com/blockstack/stacks-blockchain/blob/master/src/chainstate/stacks/boot/pox.clar#L2
	  console.log({ isEligible: false, errorCode: response });
	  return;
	}
	// success
	console.log({ isEligible: true });

	const tx = new TransactionsApi(apiConfig);

	[contractAddress, contractName] = poxInfo.contract_id.split('.');
	const network = new StacksTestnet();
	const txOptions = {
	  contractAddress,
	  contractName,
	  functionName: 'stack-stx',
	  functionArgs: [
	    uintCV(process.argv[2] * 1000000),
	    tupleCV({
	      hashbytes,
	      version,
	    }),
	    uintCV(coreInfo["burn_block_height"] + 10), 
        uintCV(process.argv[3])
	  ],
	  senderKey: privateKey,
	  validateWithAbi: true,
	  network,
	};

	const transaction = await makeContractCall(txOptions);

	const contractCall = await broadcastTransaction(transaction, network);

	// this will return a new transaction ID
    console.log("Tx Id", contractCall);
    console.log("https://stacks-node-api.blockstack.org/extended/v1/tx/" + contractCall)

	const waitForTransactionSuccess = txId =>
	  new Promise((resolve, reject) => {
	    const pollingInterval = 3000;
	    const intervalID = setInterval(async () => {
	      const resp = await tx.getTransactionById({ txId });
	      if (resp.tx_status === 'success') {
            // stop polling
            clearInterval(intervalID);
            // update UI to display stacking status
            return resolve(resp);
          }
	    }, pollingInterval);
	  });

	const resp = await waitForTransactionSuccess(contractCall.txId);
	console.log('Stacking Response', resp)

	// displaying stacking status
	[contractAddress, contractName] = poxInfo.contract_id.split('.');
	const functionName = 'get-stacker-info';

	const stackingInfo = await smartContracts.callReadOnlyFunction({
	  contractAddress,
	  contractName,
	  functionName,
	  readOnlyFunctionArgs: {
	    sender: stxAddress,
	    arguments: [`0x${serializeCV(standardPrincipalCV(stxAddress)).toString('hex')}`],
	  },
	});

	response = deserializeCV(Buffer.from(stackingInfo.result.slice(2), 'hex'));

	const data = response.value.data;

	console.log({
	  lockPeriod: cvToString(data['lock-period']),
	  amountSTX: cvToString(data['amount-ustx']),
	  firstRewardCycle: cvToString(data['first-reward-cycle']),
	  poxAddr: {
	    version: cvToString(data['pox-addr'].data.version),
	    hashbytes: cvToString(data['pox-addr'].data.hashbytes),
	  },
	});
}

async function main() {
	const {poxInfo, coreInfo, blocktimeInfo} = await displayStackingInfo();
    console.log(poxInfo)
	stack(poxInfo, blocktimeInfo, coreInfo);
}

main()