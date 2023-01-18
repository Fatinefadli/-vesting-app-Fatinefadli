const { convert, runtime } = require("@algo-builder/algob");
const { types } = require("@algo-builder/web");

const approvalFileCreate = "create_approval.py";
const clearStateFileCreate = "create_clearstate.py";

const approvalFileVesting = "vesting_approval.py";
const clearStateFileVesting = "vesting_clearstate.py";


const initContract = (runtime, creatorAccount, approvalFile, clearStateFile, locInts, locBytes, gloInts, gloBytes, accounts, args) => {
    // create new app
    runtime.deployApp(
        approvalFile,
        clearStateFile,
        {
            sender: creatorAccount,
            localInts: locInts,
            localBytes: locBytes,
            globalInts: gloInts,
            globalBytes: gloBytes,
            accounts: accounts,
            appArgs: args,
        },
        { totalFee: 1000 }, //pay flags
    );

    const appInfo = runtime.getAppInfoFromName(approvalFile, clearStateFile);
    const appAddress = appInfo.applicationAccount;  

    // fund the contract
    runtime.executeTx({
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: creatorAccount, //use the account object
        toAccountAddr: appAddress, //app address
        amountMicroAlgos: 5e7, //50 algos
        payFlags: { totalFee: 1000 },
    });

    return appInfo;
};



const initMint = (runtime,master) => {
    return initContract(
        runtime, 
        master, 
        approvalFileCreate, 
        clearStateFileCreate,
        0,
        0,
        1,
        1,
        [],
        []
    );
};


const createAsset = (runtime,master,appID) => {

    //create asset
    const createAsset = ["create_asset"].map(convert.stringToBytes);
    runtime.executeTx({
        type: types.TransactionType.CallApp,
        sign: types.SignType.SecretKey,
        fromAccount: master,
        appID: appID,
        payFlags: { totalFee: 1000 },
        appArgs: createAsset,
    });

    //get asset ID
    const getGlobal = (appID, key) => runtime.getGlobalState(appID, key);
    const assetID = Number(getGlobal(appID, "vacoinid"));

    return assetID;
}


const initVesting = (runtime,master,accounts,assetID) => {
    return initContract(
        runtime, 
        master, 
        approvalFileVesting, 
        clearStateFileVesting,
        0,
        0,
        12,
        4,
        accounts,
        [convert.uint64ToBigEndian(assetID),// asset ID
        convert.uint64ToBigEndian(10_000_000),// Advisors
        convert.uint64ToBigEndian(20_000_000),// Private Investors
        convert.uint64ToBigEndian(30_000_000),// Company Reserves
        convert.uint64ToBigEndian(15_000_000),// Team
        ]
    );
};

const optIn = (runtime, account, appID, assetID) => {
    const optinAsset = ["optin"].map(convert.stringToBytes);
    runtime.executeTx({
        type: types.TransactionType.CallApp,
        sign: types.SignType.SecretKey,
        fromAccount: account,
        appID: appID,
        payFlags: { totalFee: 1000 },
        foreignAssets: [assetID],
        appArgs: optinAsset,
    });
};

const transfer = (runtime, type, amountToSend, account, appID, appAccount, assetID) => {
    const appArgs = [convert.stringToBytes(type),convert.uint64ToBigEndian(amountToSend)];
    runtime.executeTx({
        type: types.TransactionType.CallApp,
        sign: types.SignType.SecretKey,
        fromAccount: account,
        appID: appID,
        payFlags: { totalFee: 1000 },
        accounts: [appAccount],
        foreignAssets: [assetID],
        appArgs: appArgs,
    });
};

const saveAccounts = (runtime, account, appID, vestingAppAdress) => {
    const save_accounts  = ["vesting_account"].map(convert.stringToBytes);
    runtime.executeTx({
        type: types.TransactionType.CallApp,
        sign: types.SignType.SecretKey,
        fromAccount: account,
        appID: appID,
        payFlags: { totalFee: 1000 },
        accounts: [vestingAppAdress],
        appArgs: save_accounts,
    });
}

const withdraw = (runtime, account, assetID, app, amountOfAsset) => {
    const appArgs = [convert.stringToBytes("withdrawFromVesting"),convert.uint64ToBigEndian(amountOfAsset)];
    runtime.executeTx(
        [
            {type: types.TransactionType.TransferAlgo,
            sign: types.SignType.SecretKey,
            fromAccount: account,
            toAccountAddr: app.applicationAccount,
            amountMicroAlgos: 1000,
            payFlags: { totalFee: 1000 },
            },
            {type: types.TransactionType.CallApp,
            sign: types.SignType.SecretKey,
            fromAccount: account,
            appID: app.appID,
            payFlags: { totalFee: 1000 },
            foreignAssets: [assetID],
            appArgs: appArgs,
            }
        ]
    );
}

module.exports = {
    initMint,
    createAsset,
    initVesting,
    optIn,
    transfer,
    saveAccounts,
    withdraw,
}