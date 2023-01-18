const { executeTransaction, convert, readAppGlobalState } = require("@algo-builder/algob");
const { types } = require("@algo-builder/web");

async function run(runtimeEnv, deployer) {
    // write your code here
    const master = deployer.accountsByName.get("master");
    const team_address = deployer.accountsByName.get("Team");
    const advisors_address = deployer.accountsByName.get("Advisors");
    const private_investor_address = deployer.accountsByName.get("Private_Investors");
    const company_reserve = deployer.accountsByName.get("Company_Reserves");
    
    const approvalFile = "create_approval.py";
    const clearStateFile = "create_clearstate.py";

    const approvalFileVesting = "vesting_approval.py";
    const clearStateFileVesting = "vesting_clearstate.py";


    //deploying the create (mint) contract
    await deployer.deployApp(
        approvalFile,
        clearStateFile,
        {
            sender: master,
            localInts: 0,
            localBytes: 0,
            globalInts: 1,
            globalBytes: 1,
        },
        { totalFee: 1000 }
    );

    // get app info
    const appMint = deployer.getApp(approvalFile, clearStateFile);

    // fund contract with some algos to handle inner txn
    await executeTransaction(deployer, {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: master,
        toAccountAddr: appMint.applicationAccount,
        amountMicroAlgos: 2e7, //20 algos
        payFlags: { totalFee: 1000 },
    });

    //application call to create the asset
    const createAsset = ["create_asset"].map(convert.stringToBytes);
    await executeTransaction(deployer, {
        type: types.TransactionType.CallApp,
        sign: types.SignType.SecretKey,
        fromAccount: master,
        appID: appMint.appID,
        payFlags: { totalFee: 1000 },
        appArgs: createAsset,
    });


    // get the global state
    let globalState = await readAppGlobalState(deployer, master.addr, appMint.appID);
    const assetID = globalState.get("vacoinid");

    console.log(assetID);

    deployer.addCheckpointKV("vacoinid", assetID);


    // deploying the vesting contract 
    await deployer.deployApp(
        approvalFileVesting,
        clearStateFileVesting,
        {
            sender: master,
            localInts: 0,
            localBytes: 0,
            globalInts: 12,
            globalBytes: 4,
            accounts: [    
                advisors_address.addr,
                private_investor_address.addr,
                company_reserve.addr,
                team_address.addr,
            ],
            appArgs: [
                convert.uint64ToBigEndian(assetID),
                convert.uint64ToBigEndian(10000000),//10%
                convert.uint64ToBigEndian(20000000),//20%
                convert.uint64ToBigEndian(30000000),//30%
                convert.uint64ToBigEndian(15000000),//15%
            ],
        },
        { totalFee: 1000 }
    );
            
    // get app info
    const appVesting = deployer.getApp(approvalFileVesting, clearStateFileVesting);

    deployer.addCheckpointKV("VestingAppAddress", appVesting.applicationAccount);
    deployer.addCheckpointKV("VestingAppId", appVesting.appID);
    deployer.addCheckpointKV("VestingTimeStamp", appVesting.timestamp);
    

    const acc  = ["vesting_account"].map(convert.stringToBytes);
    await executeTransaction(deployer, {
        type: types.TransactionType.CallApp,
        sign: types.SignType.SecretKey,
        fromAccount: master,
        appID: appMint.appID,
        payFlags: { totalFee: 1000 },
        accounts: [appVesting.applicationAccount],
        appArgs: acc,
    });

    // callApp to store initial time in global state
    const initTime  = [convert.stringToBytes("initTime"),convert.uint64ToBigEndian(appVesting.timestamp)];
    await executeTransaction(deployer, {
        type: types.TransactionType.CallApp,
        sign: types.SignType.SecretKey,
        fromAccount: master,
        appID: appVesting.appID,
        payFlags: { totalFee: 1000 },
        appArgs: initTime,
    });

    // transfer algos to vesting contract 
    await executeTransaction(deployer, {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: master,
        toAccountAddr: appVesting.applicationAccount,
        amountMicroAlgos: 2e7, //20 algos
        payFlags: { totalFee: 1000 },
    });


    // application call to optin to the asset
    const optinAsset = ["optin"].map(convert.stringToBytes);
    await executeTransaction(deployer, {
        type: types.TransactionType.CallApp,
        sign: types.SignType.SecretKey,
        fromAccount: master,
        appID: appVesting.appID,
        payFlags: { totalFee: 1000 },
        foreignAssets: [assetID],
        appArgs: optinAsset,
    });

    
    //transfer tokens to vesting contracts
    const transfer = [convert.stringToBytes("transferVesting")];
    await executeTransaction(deployer, {
        type: types.TransactionType.CallApp,
        sign: types.SignType.SecretKey,
        fromAccount: master,
        appID: appMint.appID,
        payFlags: { totalFee: 1000 },
        accounts: [deployer.getCheckpointKV("VestingAppAddress")], //appVesting.applicationAccount
        foreignAssets: [assetID],
        appArgs: transfer,
    });

}

module.exports = { default: run };
